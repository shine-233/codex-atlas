#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""逐条核对站点「真实源码切片」的行号是否仍与钉住基线一致。

原理：每个切片有 src-loc 标注（路径 :起-止 · @sha）和 src-code 展示块。
展示块是截取/拼接版，不能整体哈希；本工具取其首尾锚点行（反转义、压平
空白后前 50 字符），去 raw 文件标注行号 ±窗口内精确查找：
  OK            首锚点在标注起点附近命中
  DRIFT         锚点在别处命中（给出实际行号）
  ANCHOR-MISS   锚点全文找不到（上游删改了这段内容）
  NO-LINES      src-loc 无可校验行号（纯说明文字）
用法：python tools/verify_slices.py [--json out.json] [--only FILESUB]
退出码：0 = 全部 OK；1 = 有 DRIFT / ANCHOR-MISS；3 = 事故。
"""
import html as htmllib
import json
import re
import sys
import urllib.request
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
RAW = "https://raw.githubusercontent.com/openai/codex"
UA = {"User-Agent": "codex-atlas-slice-check"}
WIN_B, WIN_A = 4, 14

_cache = {}


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8")


def get_lines(path, sha):
    key = path
    if key not in _cache:
        clean = re.sub(r"^(?:\./)?codex-rs/", "", path)   # 站点标注自带 codex-rs/ 前缀
        url = f"{RAW}/{sha}/codex-rs/{clean}"
        try:
            _cache[key] = fetch(url).splitlines()
        except urllib.error.HTTPError as e:
            body = ""
            try:
                body = e.read().decode("utf-8", errors="replace")[:120]
            except Exception:
                pass
            print(f"   !! GET {url} -> HTTP {e.code}")
            raise RuntimeError(f"[{path}] under {sha[:12]} -> HTTP {e.code} body={body!r}") from e
        except Exception as e:
            raise RuntimeError(f"[{path}] under {sha[:12]} -> {e}") from e
    return _cache[key]
    return _cache[key]


def norm(s):
    return re.sub(r"\s+", "", s)


def anchors(code_html):
    text = htmllib.unescape(code_html)
    rows = [norm(r) for r in text.split("\n")]
    rows = [r for r in rows if len(r) >= 14]
    if not rows:
        return None, None
    first = rows[0][:50]
    last = rows[-1][-50:] if len(rows) > 1 else ""
    return first, last


def find_line(lines_norm, needle, hint_start, hint_end):
    """在 [hint_start, hint_end] 行窗口内找包含 needle 的行（1-based）；
    窗口没有就全文件找；返回行号或 None。"""
    n = len(lines_norm)
    lo, hi = max(1, hint_start), min(n, hint_end)
    for i in range(lo, hi + 1):
        if needle in lines_norm[i - 1]:
            return i
    for i in range(1, n + 1):
        if lo <= i <= hi:
            continue
        if needle in lines_norm[i - 1]:
            return i
    return None


def find_all(lines_norm, needle):
    out = []
    for i, l in enumerate(lines_norm, 1):
        if needle in l:
            out.append(i)
    return out


def near_any(hits, targets, win=WIN_A):
    """hits 里是否有行落在任一 target ±win 内；返回该行或 None。"""
    for h in hits:
        for t in targets:
            if t is not None and abs(h - t) <= win:
                return h
    return None


def parse_loc(loc_text):
    """src-loc 文本 → [(path, start, end)|None]；无行号的区间为 None。"""
    loc_text = loc_text.replace("同文件", "@@SAME@@")
    out = []
    # 路径 token：xxx/yyy.rs / zzz.js 等
    tokens = re.findall(
        r"([A-Za-z0-9_\-./]+(?:\.rs|\.js|\.toml|\.md))|(@@SAME@@)", loc_text)
    paths = [t[0] or "@@SAME@@" for t in tokens]
    # 每个路径后面跟着的行号组，直到下一个路径出现为止
    cuts = [loc_text.find(p) if p != "@@SAME@@" else 0 for p in paths]
    if not paths:
        return []
    segs = []
    for i, p in enumerate(paths):
        begin = cuts[i]
        end = cuts[i + 1] if i + 1 < len(paths) else len(loc_text)
        segs.append((p, loc_text[begin:end]))
    prev_path = None
    for p, seg in segs:
        if p == "@@SAME@@":
            p = prev_path
        else:
            prev_path = p
        if not p:
            continue
        nums = []
        for chunk in re.findall(r":\s*(\d+(?:\s*[-–]\s*\d+)?(?:\s*,\s*\d+(?:\s*[-–]\s*\d+)?)*)", seg):
            for a, b, single in re.findall(r"(\d+)\s*[-–]\s*(\d+)|(\d+)", chunk):
                if a:
                    nums.append((int(a), int(b)))
                else:
                    nums.append((int(single), None))
        if not nums:
            out.append((p, None, None))
        for a, b in nums:
            out.append((p, a, b))
    return out


def check_slice(page, loc_text, code_html, sha, results):
    ranges = parse_loc(loc_text)
    if not ranges:
        results.append({"page": page, "loc": loc_text.strip()[:70],
                        "status": "NO-PATH"})
        return
    first_a, last_a = anchors(code_html)
    # 按文件分组：同文件的区间共享一次判定；多文件拼接各自独立
    groups = []
    for p, s, e in ranges:
        if p.startswith("src/") and groups:
            mprev = re.match(r"(codex-rs/[^/]+/)", groups[0][0])
            if mprev:
                p = mprev.group(1) + p       # 相对引用继承上一组 crate 前缀
        if groups and groups[-1][0] == p:
            groups[-1][1].append((s, e))
        else:
            groups.append((p, [(s, e)]))
    for gidx, (path, spans) in enumerate(groups):
        starts = [s for s, _ in spans if s is not None]
        ends = [e for _, e in spans if e is not None]
        start = starts[0] if starts else None
        end = ends[-1] if ends else None
        gi = gidx
        try:
            lines = get_lines(path, sha)
        except Exception as e:
            results.append({"page": page, "path": path, "start": start,
                            "status": "FETCH-FAIL", "detail": str(e)[:260]})
            continue
        ln = [norm(l) for l in lines]
        rec = {"page": page, "path": path, "start": start,
               "end": end, "file_lines": len(lines), "ranges": spans}
        status = "OK"
        detail = ""
        if start is None:
            rec["status"] = "NO-LINES"
            results.append(rec)
            continue
        if first_a and gi == 0:
            hits = find_all(ln, first_a)
            if not hits:
                status = "ANCHOR-MISS"
                detail = "first anchor not found: " + first_a[:30]
            elif start in hits:
                detail = f"first anchor at {start}"
            else:
                status = "DRIFT"
                detail = f"first anchor hits {hits[:4]}, labeled {start}"
        elif gi > 0:
            status = "OK"
            detail = "second file of concat slice; presence verified"
        else:
            status = "EMPTY-CODE"
        if status == "OK" and last_a and ends:
            hits2 = find_all(ln, last_a)
            hit2 = near_any(hits2, ends)
            if hit2 is None:
                status = "TAIL-WARN"
                detail += f"; last anchor hits {hits2[:3]} not near {ends}"
            else:
                detail += f"; last anchor at {hit2}"
        rec["status"] = status
        rec["detail"] = detail
        results.append(rec)


def iter_slices():
    pages = sorted(ROOT.rglob("*.html"))
    for page in pages:
        rel = str(page.relative_to(ROOT)).replace("\\", "/")
        text = page.read_text(encoding="utf-8")
        for m in re.finditer(
                r'<span class="src-loc">(.*?)</span>\s*(?:\n|<span class="src-code">)'
                r'(.*?)(?:</span>\s*</pre>|</span></pre>)',
                text, re.S):
            yield rel, htmllib.unescape(m.group(1)), m.group(2)
        # loop.html 动态 SRC 字典：loc: "...", ... code: "..."
        for m in re.finditer(r'loc:\s*"([^"]+)"[^{}]*?code:\s*"((?:[^"\\]|\\.)*)"',
                             text, re.S):
            code = m.group(2).encode().decode("unicode_escape", errors="ignore")
            yield rel + "#SRC", m.group(1), code


def main():
    args = sys.argv[1:]
    json_out = args[args.index("--json") + 1] if "--json" in args else None
    sum_out = args[args.index("--summary") + 1] if "--summary" in args else None
    only = args[args.index("--only") + 1] if "--only" in args else None

    index = (ROOT / "index.html").read_text(encoding="utf-8")
    m40 = re.search(r"([0-9a-f]{40})", index)
    m8 = re.search(r"@([0-9a-f]{8})\b", index)
    sha = None
    if m40:
        sha = m40.group(1)
    else:
        mm = re.search(r"@([0-9a-f]{8})", index)
        if not mm:
            print("找不到基线提交号")
            sys.exit(3)
        api = f"https://api.github.com/repos/openai/codex/commits/{mm.group(1)}"
        req = urllib.request.Request(api, headers=UA)
        with urllib.request.urlopen(req, timeout=30) as r:
            sha = json.loads(r.read().decode())["sha"]
    print(f"基线：{sha[:12]}")

    results = []
    n = 0
    for page, loc, code in iter_slices():
        if only and only not in page:
            continue
        n += 1
        try:
            check_slice(page, loc, code, sha, results)
        except Exception as e:
            results.append({"page": page, "loc": loc[:60],
                            "status": "ERROR", "detail": str(e)[:80]})
    bad = [r for r in results
           if r.get("status") in ("DRIFT", "ANCHOR-MISS", "ERROR",
                                  "FETCH-FAIL", "EMPTY-CODE")]
    warn = [r for r in results if r.get("status") == "TAIL-WARN"]
    ok_n = sum(1 for r in results if r.get("status") == "OK")
    nl = sum(1 for r in results if r.get("status") in ("NO-LINES", "NO-PATH"))
    print(f"共解析 {n} 条切片标注 · OK {ok_n} · 无行号跳过 {nl} · 尾行警告 {len(warn)} · 异常 {len(bad)}")
    for r in warn:
        print(f"~ [TAIL-WARN] {r.get('page','')} {r.get('path','')} :{r.get('start')}-{r.get('end')}"
              f" {r.get('detail','')[:90]}")
    for r in results:
        st = r.get("status")
        mark = "OK " if st == "OK" else ("-- " if st in ("NO-LINES", "NO-PATH") else "!! ")
        print(f"{mark}[{st}] {r.get('page','')} {r.get('path', r.get('loc',''))}"
              f" :{r.get('start')}-{r.get('end')} {r.get('detail','')}")
    if json_out:
        Path(json_out).write_text(json.dumps(results, ensure_ascii=False, indent=1),
                                  encoding="utf-8")
        print("报告已写入 " + json_out)
    if sum_out:
        s = ["# 切片行号核对报告", "",
             f"- 基线提交：`{sha[:12]}`",
             f"- 切片标注：{n} 条 · OK {ok_n} · 尾行警告 {len(warn)} · 异常 {len(bad)}", ""]
        if bad:
            s.append("## 漂移清单")
            for r in bad:
                s.append(f"- **{r.get('status')}** `{r.get('page','')}` "
                         f"{r.get('path', r.get('loc',''))} :{r.get('start')} — {r.get('detail','')}")
            s.append("")
        if warn:
            s.append("## 尾行警告（手写节选，首锚已命中，人工抽验即可）")
            for r in warn:
                s.append(f"- `{r.get('path','')}` :{r.get('start')}-{r.get('end')}")
        Path(sum_out).write_text("\n".join(s), encoding="utf-8")
        print("摘要已写入 " + sum_out)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        print("✗ 事故：" + repr(e))
        sys.exit(3)
