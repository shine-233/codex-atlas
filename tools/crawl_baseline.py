#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""给定 openai/codex 的提交号，爬出站点需要的数据块，输出可直接粘贴的 JS。

产出：
  - CA_DEPS / CA_DEG 两个 <script> 数据行（atlas.html 用）
  - 成员名单与总数
  - 带级聚合（9×9 矩阵口径）与带间动线数字
  - 入度/出度 TOP 榜（DEPENDENCY FACTS 用）
  - 外部目标统计（chatgpt 等非成员包）

用法：
  python tools/crawl_baseline.py <sha> [--out baseline-data.json]
依赖：仅标准库。135 份 Cargo.toml，约 1-2 分钟。
"""
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

# GBK 控制台打不出 ⚠/✗ 会直接 UnicodeEncodeError 崩掉，先兜底
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

UA = {"User-Agent": "codex-atlas-crawler"}
API = "https://api.github.com/repos/openai/codex"
RAW = "https://raw.githubusercontent.com/openai/codex"


def f(url, tries=3):
    # 上百份 Cargo.toml 顺序抓取，网络抽风一次就前功尽弃，指数退避重试兜底
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            return urllib.request.urlopen(req, timeout=30).read().decode()
        except Exception as e:
            last = e
            if i < tries - 1:
                time.sleep(1.5 * (i + 1))
    raise last


def parse_members(src):
    m = re.search(r"members\s*=\s*\[(.*?)\]", src, re.S)
    out = []
    for part in m.group(1).split(","):
        p = part.split("#", 1)[0].strip().strip('"').strip("'")
        if p:
            out.append(p)
    return out


def pkg_name(src):
    m = re.search(r'\[package\][^\[]*?\bname\s*=\s*"([^"]+)"', src, re.S)
    return m.group(1).replace("_", "-") if m else None


def dep_keys(src):
    keys = set()
    section = None
    for ln in src.splitlines():
        s = ln.strip()
        m = re.match(r"^\[(.+?)\]", s)
        if m:
            sec = m.group(1)
            last = sec.split(".")[-1].strip("'\"")
            # 与站点 814 口径一致：所有 *dependencies 段（含 target 限定、含 dev）
            section = "deps" if last.endswith("dependencies") else "other"
            continue
        if section != "deps" or not s or s.startswith("#"):
            continue
        m = re.match(r"^([A-Za-z0-9_\-]+)\s*=", s)
        if m:
            keys.add(m.group(1).replace("_", "-"))
    return keys


def main():
    sha = sys.argv[1] if len(sys.argv) > 1 else die("用法：crawl_baseline.py <sha> [--out x.json]")
    out = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else None
    if len(sha) < 40:
        sha = json.loads(f(f"{API}/commits/{sha}"))["sha"]
    print("基线：", sha)

    members = parse_members(f(f"{RAW}/{sha}/codex-rs/Cargo.toml"))
    member_set = set(members)
    print("members:", len(members))

    pkg_to_dir, raws = {}, {}
    for mem in sorted(member_set):
        src = f(f"{RAW}/{sha}/codex-rs/{mem}/Cargo.toml")
        raws[mem] = src
        pn = pkg_name(src)
        if pn:
            pkg_to_dir[pn] = mem

    deps, deg = {}, {m: 0 for m in members}
    external = {}
    for mem, src in raws.items():
        for key in dep_keys(src):
            target = pkg_to_dir.get(key)
            if target and target != mem:
                deps.setdefault(mem, []).append(target)
                deg[target] += 1          # CA_DEG 口径 = 被依赖数（入度），与 DEPENDENCY FACTS 一致
            elif not target:
                external.setdefault(key, []).append(mem)

    # 排序：deps 键按字典序（站点原口径即逐字母），deg 按值降序再名字
    deps_js = json.dumps({k: sorted(deps.get(k, [])) for k in sorted(deps)}, ensure_ascii=False)
    deg_js = json.dumps({k: deg[k] for k in sorted(deg)}, ensure_ascii=False)

    # 带级聚合需要站点的 BANDS 归属——从 atlas.html 抠
    atlas = (Path(__file__).resolve().parent.parent / "labs" / "atlas.html").read_text(encoding="utf-8")
    crate_to_band = {}
    for grp in re.findall(r'crates:\[([^\]]*)\]', atlas):
        for name in re.findall(r'"([^"]+)"', grp):
            crate_to_band[name] = None  # 先占位
    # 再按带顺序填 no
    bands = []
    for m in re.finditer(r'no:"(B\d)"[^}]*?crates:\[([^\]]*)\]', atlas):
        no = m.group(1)
        for name in re.findall(r'"([^"]+)"', m.group(2)):
            bands.append((name, no))
    crate_band = dict(bands)

    band_pairs = {}
    unmapped = []
    for src_name, dsts in deps.items():
        b1 = crate_band.get(src_name)
        if not b1:
            unmapped.append(src_name)
            continue
        for d in dsts:
            b2 = crate_band.get(d)
            if not b2:
                unmapped.append(d)
                continue
            k = f"{b1}->{b2}"
            band_pairs[k] = band_pairs.get(k, 0) + 1

    ins = sorted(((v, k) for k, v in deg.items()), reverse=True)
    # 出度榜
    outs = sorted(((len(v), k) for k, v in deps.items()), reverse=True)

    data = {
        "sha": sha,
        "members": sorted(member_set),
        "member_count": len(member_set),
        "internal_edges": sum(len(v) for v in deps.values()),
        "external_targets": {k: v for k, v in sorted(external.items())},
        "unmapped_in_bands": sorted(set(unmapped)),
        "band_pairs": band_pairs,
        "top_in": [(k, v) for v, k in ins[:14]],
        "top_out": [(k, v) for v, k in outs[:14]],
    }

    print()
    print("== 粘贴进 atlas.html 的两行 ==")
    print("var CA_DEPS =", deps_js)
    print()
    print("var CA_DEG =", deg_js)
    print()
    print("== 汇总 ==")
    print("成员:", data["member_count"], "· 内部边:", data["internal_edges"],
          "· 外部目标:", {k: len(v) for k, v in data["external_targets"].items()})
    print("带间聚合:", json.dumps(band_pairs, ensure_ascii=False))
    print("入度 TOP:", data["top_in"][:12])
    print("出度 TOP:", data["top_out"][:12])
    if unmapped:
        print("⚠ BANDS 里没有的成员（需要归带）：", sorted(set(unmapped)))

    if out:
        Path(out).write_text(json.dumps(
            {**data, "ca_deps_js": "var CA_DEPS = " + deps_js + ";", "ca_deg_js": "var CA_DEG = " + deg_js + ";"},
            ensure_ascii=False, indent=1), encoding="utf-8")
        print("已写入", out)


def die(msg):
    print(msg)
    sys.exit(3)


if __name__ == "__main__":
    main()
