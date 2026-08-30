#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""切片再锚定：基线迁移后把 src-loc 标注行号搬到新提交下的真实位置。

原理：取展示代码块的首/尾非空行为锚，在新文件中定位；首锚新位 = 新起点，
  中段边界按刚性平移（delta），尾锚验证平移假设——偏差 >2 行即标 MANUAL 留人。
支持两种切片形态：<span class="src-loc"> 与 loop.html 的 loc:"..."/code:"..." 字典。

用法：python tools/reanchor_slices.py --old <迁移前40位sha> [--dry-run]
退出码：0 = 全部就位 / 1 = 存在 MANUAL。
"""
import html as htmllib
import re
import sys
import time
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
RAW = "https://raw.githubusercontent.com/openai/codex"
UA = {"User-Agent": "codex-atlas-reanchor"}

_cache = {}


def norm(s):
    return re.sub(r"\s+", " ", s.strip())


def _fetch(path, sha):
    rel = path[len("codex-rs/"):] if path.startswith("codex-rs/") else path
    url = f"{RAW}/{sha}/codex-rs/{rel}"
    last = None
    for i in range(3):
        try:
            req = urllib.request.Request(url, headers=UA)
            return urllib.request.urlopen(req, timeout=30).read().decode("utf-8").split("\n")
        except Exception as e:
            last = e
            time.sleep(1.5 * (i + 1))
    raise RuntimeError(f"{path}@{sha[:12]}: {last}")


def get_lines(path, sha):
    key = (path, sha)
    if key not in _cache:
        _cache[key] = _fetch(path, sha)
    return _cache[key]


def get_lines_old(path, old_sha):
    return get_lines(path, old_sha)


def parse_loc(loc):
    """[(path, [(start,end|None),...])]；路径间的文本段归属前一路径，
    src/ 相对路径继承首个 crate 前缀。"""
    pats = list(re.finditer(r"(codex-rs/[^\s:]+|\bsrc/[^\s:]+)", loc))
    out = []
    for i, pm in enumerate(pats):
        seg_end = pats[i + 1].start() if i + 1 < len(pats) else len(loc)
        seg = loc[pm.end():seg_end]
        spans = [(int(sm.group(1)), int(sm.group(2)) if sm.group(2) else None)
                 for sm in re.finditer(r":(\d+)(?:-(\d+))?", seg)]
        out.append([pm.group(0), spans])
    prefix = None
    for item in out:
        if item[0].startswith("src/") and prefix:
            item[0] = prefix + item[0]
        mp = re.match(r"(codex-rs/[^/]+/)", item[0])
        if mp:
            prefix = mp.group(1)
    return out


def reanchor_loc(loc, code_html, sha, old_sha):
    """返回 (new_loc|None, status, detail)。new_loc=None 表示无需改写。

    每个 span 独立再锚定：从旧提交文件里取该 span 首/尾行的真实内容，
    到新提交文件中精确定位——不依赖整块刚性平移的假设，段内编辑也能对齐。
    """
    groups = parse_loc(loc)
    if not groups or all(not g[1] for g in groups):
        return None, "SKIP", "无行号标注"

    flat_new = []
    for p, spans in groups:
        try:
            new_lines = get_lines(p, sha)
        except Exception as e:
            return None, "MANUAL", "new fetch fail: %s" % str(e)[:70]
        try:
            old_lines = get_lines_old(p, old_sha)
        except Exception as e:
            return None, "MANUAL", "old fetch fail: %s" % str(e)[:70]
        nln = [norm(l) for l in new_lines]
        oln = [norm(l) for l in old_lines]

        def best_block(a, b):
            """旧块 [a..b] 在新文件里的最佳落点：整块滑窗比对。返回 (pos, score)。"""
            L = b - a + 1
            oblock = oln[a - 1:b]
            head = oblock[0][:90]
            best_key, best_h = None, None
            for i, l in enumerate(nln):
                if head not in l:
                    continue
                h = i + 1
                if h + L - 1 > len(nln):
                    continue
                score = sum(1 for k in range(L) if nln[h - 1 + k] == oblock[k])
                key = (-score, abs(h - a))
                if best_key is None or key < best_key:
                    best_key, best_h = key, h
            return best_h, (None if best_h is None else -best_key[0])

        need = []
        for (a, b) in spans:
            if a > len(oln) or (b is not None and b > len(oln)):
                return None, "MANUAL", "旧行号越界 @%d %s" % (a, p)
            need.append((a, b))

        prev_end = 0
        for (a, b) in need:
            h, score = best_block(a, b)
            if h is None or score < 0.6 * ((b or a) - a + 1):
                return None, "MANUAL", "块匹配失败 @%d-%d %s" % (a, b or a, p)
            na = h
            nb = h + ((b or a) - a) if b else None
            # 尾部纯空行不计入展示范围（上游文件末尾多出的空行不属于切片内容）
            while nb and nb > na and nln[nb - 1] == "":
                nb -= 1
            if nb is not None and nb < na:
                return None, "MANUAL", "span 倒置 @%d %s" % (a, p)
            flat_new.append((na, nb))
            prev_end = nb or na

    tokens = [(a, b) for _, sps in groups for (a, b) in sps]
    it = iter(flat_new)

    def repl(m):
        a, b = next(it)
        return ":%d-%d" % (a, b) if b is not None else ":%d" % a

    n_tokens = len(tokens)
    new_loc = re.sub(r":(\d+)(?:-(\d+))?", repl, loc, count=n_tokens)
    if new_loc == loc:
        return None, "SAME", "行号已正确"
    d0 = flat_new[0][0] - tokens[0][0]
    return new_loc, "MOVED", "delta %+d%s" % (d0, "" if all(
        fn[0] - t[0] == d0 for fn, t in zip(flat_new, tokens)) else "（非均匀）")


SRCLOC_RE = re.compile(
    r'(<span class="src-loc">)(.*?)(</span>)', re.S)
SRCLOC_CODE_RE = re.compile(r'<span class="src-code">(.*?)</span>', re.S)
DICT_RE = re.compile(r'(loc:\s*")([^"]+)("[^{}]*?code:\s*")((?:[^"\\]|\\.)*)(")', re.S)


def main():
    args = sys.argv[1:]
    DRY = "--dry-run" in args
    mo = re.search(r"--old\s+([0-9a-f]{40})", " ".join(args))
    old_sha = mo.group(1) if mo else None
    if not old_sha:
        print("用法：reanchor_slices.py --old <迁移前40位sha> [--dry-run]")
        sys.exit(3)
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    sha = re.search(r"([0-9a-f]{40})", index).group(1)
    print("再锚定：", old_sha[:12], "->", sha[:12], "(--dry-run)" if DRY else "")
    stats = {"SAME": 0, "MOVED": 0, "MANUAL": 0, "SKIP": 0}
    manual = []

    for page in sorted(ROOT.rglob("*.html")):
        text = page.read_text(encoding="utf-8")
        edits = []  # (start, end, replacement)

        for m in SRCLOC_RE.finditer(text):
            tail = text[m.end():m.end() + 80000]
            cm = SRCLOC_CODE_RE.search(tail)
            code_html = cm.group(1) if cm else ""
            new_loc, st, detail = reanchor_loc(htmllib.unescape(m.group(2)), code_html, sha, old_sha)
            stats[st] += 1
            head = m.group(2).split("·")[0].strip()[:58]
            if st == "MANUAL":
                manual.append((page.name, head, detail))
            if st == "MOVED":
                esc = new_loc.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                edits.append((m.start(2), m.end(2), esc))
                print("  MOVED  %-16s %s | %s" % (page.name, head, detail))

        for m in DICT_RE.finditer(text):
            new_loc, st, detail = reanchor_loc(m.group(2), m.group(4), sha, old_sha)
            stats[st] += 1
            head = m.group(2).split("·")[0].strip()[:58]
            if st == "MANUAL":
                manual.append((page.name, head, detail))
            if st == "MOVED":
                edits.append((m.start(2), m.end(2), new_loc))
                print("  MOVED  %-16s %s | %s" % (page.name, head, detail))
            elif st in ("SAME", "SKIP", "MANUAL"):
                print("  %-5s  %-14s %s | %s" % (st, page.name, head, detail))

        # src-loc 的 SAME/SKIP/MANUAL 不重复打印（上面只打印了 MOVED），补一条汇总即可
        if edits and not DRY:
            ordered = sorted(edits)
            for idx, (start, end, _) in enumerate(ordered):
                if not (0 <= start <= end <= len(text)):
                    raise RuntimeError("非法编辑区间 %s:%d-%d" % (page.name, start, end))
                if idx and start < ordered[idx - 1][1]:
                    raise RuntimeError("重叠编辑区间 %s:%d-%d" % (page.name, start, end))
            for start, end, rep in sorted(edits, reverse=True):
                text = text[:start] + rep + text[end:]
            page.write_text(text, encoding="utf-8", newline="")
            print("  written:", page.name)

    print("\n汇总：", stats)
    if manual:
        print("需人工处理：")
        for name, head, d in manual:
            print("  -", name, "|", head, "|", d)
    sys.exit(1 if manual else 0)


if __name__ == "__main__":
    main()
