#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""核对 codex-atlas 的基线数字是否与上游 openai/codex 一致。

「数字对得上才算数」的自动化：
  1. 从站点文件里提取钉住的基线提交号、135 个成员、CA_DEPS 边表、wire 方法名单
  2. 实时抓取该提交下的上游文件，逐项比对
  3. 顺带看一眼 main 分支漂到哪了——漂了就提醒该换基线

用法：
  python tools/verify_baseline.py                 # 完整核对（含 135 份依赖爬取，约 1-2 分钟）
  python tools/verify_baseline.py --skip-deps     # 快速模式：只对名单和方法名，不爬依赖
  python tools/verify_baseline.py --json out.json # 报告另存 JSON
  python tools/verify_baseline.py --summary s.md  # 另存 Markdown 摘要（给 CI 用）

退出码：0 = 钉住的提交下全部对上
        1 = 数字对不上（附差异清单）
        2 = 上游 main 已漂移（数字本身没错，但该考虑换基线了）
仅网络不可达等事故退出 3。
"""
import json
import re
import sys
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ATLAS = ROOT / "labs" / "atlas.html"
APPSERVER = ROOT / "labs" / "appserver.html"

API = "https://api.github.com/repos/openai/codex"
RAW = "https://raw.githubusercontent.com/openai/codex"
UA = {"User-Agent": "codex-atlas-baseline-check"}

report = {
    "pinned_sha": None,
    "upstream_sha": None,
    "upstream_moved": False,
    "members_site": 0,
    "members_upstream": 0,
    "members_added": [],
    "members_removed": [],
    "edges_site": 0,
    "edges_upstream": 0,
    "edges_added": [],
    "edges_removed": [],
    "edges_external": 0,
    "wire_site": 0,
    "wire_upstream": 0,
    "wire_added": [],
    "wire_removed": [],
    "errors": [],
}


def die(msg, code=3):
    print("✗ " + msg)
    sys.exit(code)


def fetch(url, binary=False):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    return data if binary else data.decode("utf-8")


def fetch_json(url):
    return json.loads(fetch(url))


# ---------- 第一步：从站点文件提取钉住的数据 ----------

def load_site():
    if not ATLAS.exists() or not APPSERVER.exists():
        die("找不到 labs/atlas.html 或 labs/appserver.html——请在仓库根目录运行", 3)

    atlas = ATLAS.read_text(encoding="utf-8")
    appserver = APPSERVER.read_text(encoding="utf-8")
    index = (ROOT / "index.html").read_text(encoding="utf-8")

    # 完整 40 位哈希优先（index 证据框里有）；只有短哈希就经 API 补全
    sha = None
    m = re.search(r"([0-9a-f]{40})", index) or re.search(r"([0-9a-f]{40})", atlas)
    if m:
        sha = m.group(1)
    else:
        m = re.search(r"@([0-9a-f]{8,39})", atlas)
        if not m:
            die("站点里没找到基线提交号（长短期都没有）")
        try:
            sha = fetch_json(f"{API}/commits/{m.group(1)}")["sha"]
        except Exception as e:
            die(f"短提交号 {m.group(1)} 经 API 解析失败：{e}")

    m = re.search(r"var CA_DEPS = (\{.*?\});", atlas, re.S)
    if not m:
        die("atlas.html 里没找到 CA_DEPS 边表")
    deps = json.loads(m.group(1))

    m = re.search(r"var CA_DEG = (\{.*?\});", atlas, re.S)
    if not m:
        die("atlas.html 里没找到 CA_DEG 度表")
    deg = json.loads(m.group(1))

    # 成员名单的正源是 BANDS（CA_DEG 会漏掉零依赖的叶子 crate）
    band_crates = re.findall(r'crates:\[([^\]]*)\]', atlas)
    members = set()
    for grp in band_crates:
        for name in re.findall(r'"([^"]+)"', grp):
            members.add(name)
    if not members:
        die("atlas.html 里没解析到 BANDS 的 crates 名单")

    wire = re.findall(r'\{"w":"([^"]+)","d":"([^"]+)"', appserver)
    if not wire:
        die("appserver.html 里没找到 WIRE REGISTRY 行")

    return sha, deps, deg, members, [w for w, _ in wire]


# ---------- 第二步：上游文件 ----------

def parse_cargo_members(cargo_src):
    """从 Cargo.toml 抠 [workspace].members，支持跨行与注释。"""
    m = re.search(r"members\s*=\s*\[(.*?)\]", cargo_src, re.S)
    if not m:
        return []
    out = []
    for part in m.group(1).split(","):
        part = part.split("#", 1)[0].strip()
        part = part.strip().strip('"').strip("'")
        if part:
            out.append(part)
    return out


def expand_globs(members, sha):
    """members 里有 glob（如 crates/*）时，用 contents API 展开成具体目录。"""
    out = []
    for mem in members:
        if "*" not in mem:
            out.append(mem)
            continue
        base = mem.split("*")[0].rstrip("/")
        try:
            entries = fetch_json(f"{API}/contents/{base}?ref={sha}")
        except urllib.error.HTTPError as e:
            report["errors"].append(f"展开 {mem} 失败：HTTP {e.code}")
            continue
        for ent in entries:
            if ent.get("type") != "dir":
                continue
            cand = base + "/" + ent["name"]
            try:
                fetch(f"{RAW}/{sha}/codex-rs/{cand}/Cargo.toml")
                out.append(cand)
            except urllib.error.HTTPError:
                pass  # 有目录没 Cargo.toml，不是 crate
    return out


def parse_internal_deps(cargo_src, member_set, crate_name):
    """抠 [dependencies] 段的键（不含 dev/build），过滤出成员内边。"""
    deps = set()
    lines = cargo_src.splitlines()
    section = None
    for ln in lines:
        s = ln.strip()
        m = re.match(r"^\[(.+?)\]", s)
        if m:
            sec = m.group(1)
            if sec == "dependencies":
                section = "deps"
            elif sec.startswith("dependencies."):
                section = "deps"          # [dependencies.foo] 目标限定依赖也算
                deps.add(sec.split(".", 1)[1])
            elif sec in ("dev-dependencies", "build-dependencies") or \
                    sec.startswith("dev-dependencies.") or sec.startswith("build-dependencies."):
                section = "other"
            else:
                section = "other"
            continue
        if section != "deps" or not s or s.startswith("#"):
            continue
        m = re.match(r"^([A-Za-z0-9_\-]+)\s*=", s)
        if m:
            deps.add(m.group(1))
    # crate 名连字符/下划线等价（Rust 包名规则）
    norm = {d.replace("_", "-") for d in deps}
    return {d for d in norm if d in member_set and d != crate_name}


def extract_wire_names(rs_src):
    """从 common.rs 抠形如 thread/start 的字符串字面量（启发式：含 / 的小写字符串）。
    tmp/example、unknown/method 这类是文件里的测试夹具/文档占位，滤掉免得报假警。"""
    names = set(re.findall(r'"([a-z][a-z0-9]*(?:/[A-Za-z0-9_]+)+)"', rs_src))
    return {n for n in names if not n.startswith(("tmp/", "unknown/", "example/", "mock/"))}


# ---------- 主流程 ----------

def main():
    args = sys.argv[1:]
    skip_deps = "--skip-deps" in args
    json_out = args[args.index("--json") + 1] if "--json" in args else None
    sum_out = args[args.index("--summary") + 1] if "--summary" in args else None

    sha, deps, deg, site_members, wire_site = load_site()
    report["members_site"] = len(site_members)
    report["edges_site"] = sum(len(v) for v in deps.values())
    report["wire_site"] = len(wire_site)
    deg_missing = sorted(site_members - set(deg.keys()))
    if deg_missing:
        print(f"ℹ CA_DEG 度表比成员名单少 {len(deg_missing)} 个（零依赖叶子，不影响核对）：{'、'.join(deg_missing)}")
    print(f"站点基线：{sha[:12]} · 成员 {len(site_members)} · 边 {report['edges_site']} · wire {len(wire_site)}")

    # 上游 main 漂到哪了
    try:
        latest = fetch_json(f"{API}/commits/main")
        up_sha = latest["sha"]
        report["upstream_sha"] = up_sha
        report["upstream_moved"] = up_sha != sha
        print(f"上游 main：{up_sha[:12]} · " + ("与基线一致" if up_sha == sha else "⚠ 已漂移"))
    except Exception as e:
        report["errors"].append(f"取上游 main 失败：{e}")
        print("⚠ 取上游 main 失败（不影响钉住提交的核对）")

    ok = True

    # 成员名单
    try:
        cargo = fetch(f"{RAW}/{sha}/codex-rs/Cargo.toml")
        members = expand_globs(parse_cargo_members(cargo), sha)
        member_set = set(members)
        report["members_upstream"] = len(member_set)
        added = sorted(member_set - site_members)
        removed = sorted(site_members - member_set)
        report["members_added"], report["members_removed"] = added, removed
        if added or removed or len(member_set) != len(site_members):
            ok = False
            print(f"✗ 成员名单对不上：上游 {len(member_set)} vs 站点 {len(site_members)}")
            for a in added:
                print("   + " + a)
            for r in removed:
                print("   - " + r)
        else:
            print(f"✓ 成员名单一致（{len(member_set)}）")
    except Exception as e:
        report["errors"].append(f"成员核对失败：{e}")
        ok = False
        print("✗ 成员核对失败：" + str(e))

    # 依赖边（可选，慢）
    if not skip_deps:
        try:
            up_edges = {}
            ext_targets = set()
            fetched = 0
            pkg_to_dir = {}   # [package] name → workspace 目录名
            raws = {}
            for mem in sorted(member_set):
                try:
                    src = fetch(f"{RAW}/{sha}/codex-rs/{mem}/Cargo.toml")
                except urllib.error.HTTPError:
                    continue
                fetched += 1
                raws[mem] = src
                m = re.search(r'\[package\][^\[]*?\bname\s*=\s*"([^"]+)"', src, re.S)
                if m:
                    pkg_to_dir[m.group(1).replace("_", "-")] = mem
            def raw_dep_keys(src):
                """所有 *dependencies 段的原始键（含 target 限定段）。
                站点 814 的口径把 dev 依赖也算进去（core 的 codex-home 就是 dev-dep），
                这里保持同一口径；build-dependencies 一并算入，差异靠 diff 列表说话。"""
                keys = set()
                section = None
                for ln in src.splitlines():
                    s = ln.strip()
                    m = re.match(r"^\[(.+?)\]", s)
                    if m:
                        sec = m.group(1)
                        last = sec.split(".")[-1].strip("'\"")
                        if last.endswith("dependencies"):
                            section = "deps"
                            if sec != last and sec.startswith("dependencies."):
                                keys.add(sec.split(".", 1)[1])
                        else:
                            section = "other"
                        continue
                    if section != "deps" or not s or s.startswith("#"):
                        continue
                    m = re.match(r"^([A-Za-z0-9_\-]+)\s*=", s)
                    if m:
                        keys.add(m.group(1).replace("_", "-"))
                return keys
            for mem, src in raws.items():
                for key in raw_dep_keys(src):
                    target = pkg_to_dir.get(key)
                    if target and target != mem:
                        up_edges.setdefault(mem, set()).add(target)
                    elif target is None and key not in pkg_to_dir:
                        # 不在成员映射里的依赖键：可能是外部包，也可能是漏抓的成员
                        ext_targets.add(key)
            # 站点边表里的目标也可能指向非成员包（chatgpt 等），单独数
            for src_name, dsts in deps.items():
                for d in dsts:
                    if d not in site_members:
                        ext_targets.add(d)
            up_flat = {s: sorted(v) for s, v in up_edges.items()}
            site_flat = {s: sorted(set(v)) for s, v in deps.items()}
            n_up = sum(len(v) for v in up_flat.values())
            n_site = sum(len(v) for v in site_flat.values())
            report["edges_upstream"] = n_up
            report["edges_external"] = len(ext_targets)
            added_edges, removed_edges = [], []
            for s in sorted(set(up_flat) | set(site_flat)):
                su = set(up_flat.get(s, []))
                ss = set(site_flat.get(s, []))
                for d in sorted(su - ss):
                    added_edges.append(f"{s} -> {d}")
                for d in sorted(ss - su):
                    removed_edges.append(f"{s} -> {d}")
            report["edges_added"], report["edges_removed"] = added_edges, removed_edges
            if added_edges or removed_edges or n_up != n_site:
                ok = False
                print(f"✗ 依赖边对不上：重爬 {n_up} vs 站点 {n_site}（外部目标 {len(ext_targets)} 个）")
                for a in added_edges[:20]:
                    print("   + " + a)
                for r in removed_edges[:20]:
                    print("   - " + r)
                if len(added_edges) > 20 or len(removed_edges) > 20:
                    print(f"   … 共 +{len(added_edges)} / -{len(removed_edges)}")
            else:
                print(f"✓ 依赖边一致（{n_up} 条内部边，爬了 {fetched} 份 Cargo.toml）")
        except Exception as e:
            report["errors"].append(f"依赖边核对失败：{e}")
            ok = False
            print("✗ 依赖边核对失败：" + str(e))

    # wire 方法名
    try:
        rs = fetch(f"{RAW}/{sha}/codex-rs/app-server-protocol/src/protocol/common.rs")
        up_wire = extract_wire_names(rs)
        site_wire = set(wire_site)
        report["wire_upstream"] = len(up_wire)
        wa = sorted(up_wire - site_wire)
        wr = sorted(site_wire - up_wire)
        report["wire_added"], report["wire_removed"] = wa, wr
        # 站点多出来的名字多半来自枚举推导（serde 改名），启发式抠不到——只提示，不算失败。
        # 上游多出来的字符串字面量才是真信号：新方法出现了。
        if wa:
            ok = False
            print(f"✗ 上游出现站点没有的 wire 方法（{len(wa)} 个）——该更新 WIRE REGISTRY 了：")
            for a in wa[:15]:
                print("   + " + a)
            if wr:
                print(f"   ℹ 另有 {len(wr)} 个站点方法未在 common.rs 字面量中出现（枚举推导名，人工抽查即可）")
        else:
            print(f"✓ wire 方法名无新增（上游字面量 {len(up_wire)} · 站点 {len(site_wire)}）")
    except Exception as e:
        report["errors"].append(f"wire 核对失败：{e}")
        print("⚠ wire 核对失败：" + str(e))

    # 收尾
    report["ok"] = ok and not report["errors"]
    print()
    if not ok:
        print("结论：✗ 数字对不上——按上面的差异清单更新站点数据，或核对爬取口径。")
    elif report["upstream_moved"]:
        print("结论：⚠ 钉住的提交下全对，但上游 main 已经往前走了——该挑个新提交换基线了。")
    else:
        print("结论：✓ 全部对得上，且基线就是上游 main 当前位置。")

    if json_out:
        Path(json_out).write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
        print("报告已写入 " + json_out)
    if sum_out:
        s = ["# 基线核对报告", "",
             f"- 钉住提交：`{sha[:12]}`",
             f"- 上游 main：`{(report['upstream_sha'] or '')[:12]}`" + ("（已漂移）" if report["upstream_moved"] else "（一致）"),
             f"- 成员：站点 {report['members_site']} / 上游 {report['members_upstream']}",
             f"- 依赖边：站点 {report['edges_site']} / 上游 {report['edges_upstream']}",
             f"- wire 方法：站点 {report['wire_site']} / 上游 {report['wire_upstream']}", ""]
        if report["members_added"] or report["members_removed"]:
            s.append("## 成员差异")
            s += ["+ " + a for a in report["members_added"]] + ["- " + r for r in report["members_removed"]] + [""]
        if report["edges_added"] or report["edges_removed"]:
            s.append("## 依赖边差异")
            s += ["+ " + a for a in report["edges_added"][:50]] + ["- " + r for r in report["edges_removed"][:50]] + [""]
        if report["wire_added"] or report["wire_removed"]:
            s.append("## wire 差异")
            s += ["+ " + a for a in report["wire_added"]] + ["- " + r for r in report["wire_removed"]] + [""]
        Path(sum_out).write_text("\n".join(s), encoding="utf-8")
        print("摘要已写入 " + sum_out)

    sys.exit(1 if not ok else (2 if report["upstream_moved"] else 0))


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except urllib.error.URLError as e:
        die("网络不可达：" + str(e))
    except Exception as e:
        die("意外错误：" + repr(e))
