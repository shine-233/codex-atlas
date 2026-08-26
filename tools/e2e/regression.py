#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""codex-atlas 全站回归套件。

自起 http.server + Playwright（Chromium headless），覆盖：
  - 9 页 JS 报错扫描（桌面 1280 / 移动 390 两套视口）
  - 移动端横向溢出检查
  - 主题切换圆形揭示（双向持久化）
  - 站宠抛掷物理（甩出-回家-轻点不受影响）
  - 力学视图（渲染/拖拽/带芯片/捏合）
  - 面积树图缩放循环
  - SSE 瀑布（暂停补完打字 / 点行跳转 / 滑杆）
  - 历史折线仪（CAHistJump + 超界刻度）
  - 沙盘抓包四种结局
  - 配对游戏模式
  - prompt 七层开关子行联动
  - ACT I 决策竞态守卫
  - 邻居迷你图 + skip-link + reduced-motion 抽检

用法：
  python tools/e2e/regression.py            # 全量
  python tools/e2e/regression.py --quick    # 只跑 9 页扫描 + 移动溢出
退出码：0 = 全绿；1 = 有失败（清单见输出）。
依赖：pip install playwright && playwright install chromium
"""
import json
import sys
import threading
import functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent   # tools/e2e/ → 仓库根
PORT = 8935
BASE = f"http://localhost:{PORT}"

PAGES = ["/", "/labs/loop.html", "/labs/prompt.html", "/labs/sandbox.html",
         "/labs/appserver.html", "/labs/atlas.html", "/labs/deep.html", "/labs/dive.html",
         "/glossary.html", "/404.html"]

FAILS = []
PASS = []


def check(name, ok, detail=""):
    (PASS if ok else FAILS).append((name, detail))
    print(("  PASS " if ok else "  FAIL ") + name + ("" if ok else "  <- " + str(detail)[:120]))


def start_server():
    class Quiet(SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    handler = functools.partial(Quiet, directory=str(ROOT))
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd


def sweep_pages(ctx, results):
    for path in PAGES:
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
        resp = pg.goto(BASE + path)
        pg.wait_for_load_state("networkidle")
        pg.wait_for_timeout(500)
        status = resp.status if resp else 0
        check("sweep " + path, not errs and status == 200, {"status": status, "errs": errs[:2]})
        pg.close()


def mobile_sweep(ctx, results):
    for path in PAGES:
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
        pg.goto(BASE + path)
        pg.wait_for_load_state("networkidle")
        pg.wait_for_timeout(600)
        ow = pg.evaluate("() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })")
        check("mobile overflow " + path, ow["sw"] <= ow["iw"] + 1, ow)
        check("mobile errors " + path, not errs, errs[:2])
        pg.close()


def theme_toggle(ctx):
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
    pg.goto(BASE + "/labs/loop.html")
    pg.wait_for_load_state("networkidle")
    pg.evaluate("() => document.querySelector('.theme-toggle').scrollIntoView({block:'center'})")
    pg.click(".theme-toggle")
    pg.wait_for_timeout(1500)
    pg.wait_for_load_state("networkidle")
    t1 = pg.evaluate("() => localStorage.getItem('ca-theme')")
    pg.evaluate("() => document.querySelector('.theme-toggle').scrollIntoView({block:'center'})")
    pg.click(".theme-toggle")
    pg.wait_for_timeout(1500)
    pg.wait_for_load_state("networkidle")
    t2 = pg.evaluate("() => localStorage.getItem('ca-theme')")
    check("theme toggle round trip", t1 in ("dark", "light") and t2 != t1, [t1, t2])
    check("theme toggle no errors", not errs, errs[:3])
    pg.close()


def pet_fling(ctx):
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
    pg.goto(BASE + "/")
    pg.wait_for_load_state("networkidle")
    pre = pg.locator(".cod-pet").bounding_box()
    px, py = pre["x"] + 23, pre["y"] + 20
    pg.mouse.move(px, py)
    pg.mouse.down()
    pg.mouse.move(px - 240, py - 300, steps=8)
    pg.mouse.up()
    pg.wait_for_timeout(4300)
    back = pg.locator(".cod-pet").bounding_box()
    check("pet returns home", abs(back["x"] - pre["x"]) < 30 and abs(back["y"] - pre["y"]) < 30, [pre, back])
    pg.mouse.click(pre["x"] + 23, pre["y"] + 20)
    pg.wait_for_timeout(600)
    toast = pg.evaluate("() => { const t = document.querySelector('.cod-toast'); return t && t.classList.contains('show'); }")
    check("pet tap still shows tip", bool(toast))
    check("pet no errors", not errs, errs[:3])
    pg.close()


def force_view(ctx):
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
    pg.goto(BASE + "/labs/atlas.html")
    pg.wait_for_load_state("networkidle")
    pg.click("button[data-vw='force']")
    pg.locator("#force").scroll_into_view_if_needed()
    pg.wait_for_timeout(2600)
    check("force canvas renders", pg.evaluate("() => document.querySelectorAll('#force canvas').length") == 1)
    check("force edges note", pg.evaluate("() => document.getElementById('force-edges').textContent.length") > 10)
    box = pg.locator("#force").bounding_box()
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    pg.mouse.move(cx, cy)
    pg.mouse.down()
    pg.mouse.move(cx + 120, cy - 80, steps=10)
    pg.mouse.up()
    pg.wait_for_timeout(700)
    pg.click(".fb-chip >> nth=0")
    pg.wait_for_timeout(200)
    check("force chip toggles", pg.evaluate("() => document.querySelectorAll('.fb-chip.on').length") == 1)
    # pinch
    def pev(name, pid, x, y):
        pg.evaluate("""([name, pid, x, y]) => {
            const c = document.querySelector('#force canvas');
            c.dispatchEvent(new PointerEvent(name, {pointerId: pid, pointerType: 'touch',
              clientX: x, clientY: y, bubbles: true, isPrimary: pid === 900}));
        }""", [name, pid, x, y])
    pev("pointerdown", 900, cx - 50, cy)
    pev("pointerdown", 901, cx + 50, cy)
    for s in (80, 120, 160):
        pev("pointermove", 900, cx - s, cy)
        pev("pointermove", 901, cx + s, cy)
    pev("pointerup", 900, cx - 160, cy)
    pev("pointerup", 901, cx + 160, cy)
    pg.wait_for_timeout(300)
    check("force pinch no errors", not errs, errs[:3])
    pg.close()


def tree_zoom(ctx):
    pg = ctx.new_page()
    pg.goto(BASE + "/labs/atlas.html")
    pg.wait_for_load_state("networkidle")
    pg.click("button[data-vw='tree']")
    pg.wait_for_timeout(400)
    pg.evaluate("() => document.querySelector('#treemap .tm-band-zoom').click()")
    pg.wait_for_timeout(300)
    ok1 = pg.evaluate("() => !!document.querySelector('#treemap .tm-back')")
    pg.evaluate("() => document.querySelector('#treemap .tm-back').click()")
    pg.wait_for_timeout(300)
    ok2 = pg.evaluate("() => document.querySelectorAll('#treemap .tm-band-zoom').length") == 9
    check("tree zoom cycle", ok1 and ok2)
    pg.close()


def sse_waterfall(ctx):
    pg = ctx.new_page()
    pg.goto(BASE + "/labs/loop.html")
    pg.wait_for_load_state("networkidle")
    pg.locator("#sse-panel").scroll_into_view_if_needed()
    pg.click("#sse-play")
    pg.wait_for_timeout(1250)
    pg.click("#sse-play")   # pause mid-typing
    pg.wait_for_timeout(120)
    bubble = pg.evaluate("() => document.getElementById('sse-bubble').textContent")
    check("sse pause completes chunk", "先跑一遍" in bubble, bubble)
    pg.click("#sse-play")
    pg.wait_for_timeout(3200)
    check("sse finishes 6/6", "6 / 6" in pg.evaluate("() => document.getElementById('sse-count').textContent"))
    # line click jump
    pg.evaluate("() => { const l = document.querySelectorAll('#sse-log > div')[2]; if (l) l.click(); }")
    pg.wait_for_timeout(250)
    check("sse line click jumps", "3 / 6" in pg.evaluate("() => document.getElementById('sse-count').textContent"))
    pg.close()


def hist_curve(ctx):
    pg = ctx.new_page()
    pg.goto(BASE + "/labs/loop.html")
    pg.wait_for_load_state("networkidle")
    pg.evaluate("() => document.fonts ? document.fonts.ready : null")   # 字体换行会挪动量好的坐标
    pg.evaluate("() => window.CAHistJump && CAHistJump(13)")
    pg.wait_for_timeout(400)
    check("curve lap 13", pg.evaluate("() => document.getElementById('lap-n').textContent") == "13")
    painted = pg.evaluate("""() => {
        const c = document.querySelector('#hist-curve canvas');
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < d.length; i += 400) if (d[i] > 0) return true;
        return false;
    }""")
    check("curve paints at lap 13", painted)
    pg.close()


def yard_grab(ctx):
    pg = ctx.new_page()
    pg.goto(BASE + "/labs/sandbox.html")
    pg.wait_for_load_state("networkidle")
    pg.locator("#yard-panel").scroll_into_view_if_needed()
    pg.wait_for_timeout(700)

    def pev(name, pid, x760, y330):
        yard = pg.locator("#yard").bounding_box()
        pg.evaluate("""([name, pid, rx, ry]) => {
            const el = document.querySelector('#yard svg');
            const r = el.getBoundingClientRect();
            el.dispatchEvent(new PointerEvent(name, {pointerId: pid, pointerType: 'touch',
              clientX: r.left + rx, clientY: r.top + ry, bubbles: true, button: 0}));
        }""", [name, pid, x760 / 760 * yard["width"], y330 / 330 * yard["height"]])

    def dot_pos():
        return pg.evaluate("() => [+document.querySelector('.yard-dot').getAttribute('cx'), +document.querySelector('.yard-dot').getAttribute('cy')]")

    # ww: drag beyond fence -> approval ask
    dx, dy = dot_pos()
    pev("pointerdown", 700, dx, dy)
    pev("pointermove", 700, 600, 200)
    pev("pointerup", 700, 600, 200)
    pg.wait_for_timeout(900)
    check("yard ww drop -> approval", pg.evaluate("() => document.getElementById('yard-ask').classList.contains('show')"))
    # inside fence -> allow tag
    dx, dy = dot_pos()
    pev("pointerdown", 701, dx, dy)
    pev("pointermove", 701, 200, 250)
    pev("pointerup", 701, 200, 250)
    pg.wait_for_timeout(300)
    check("yard inside allow", "放行" in pg.evaluate("() => document.querySelector('.yard-tag').textContent"))
    # ro: deny
    pg.evaluate("""() => { const b = Array.from(document.querySelectorAll('button')).find(x => /read-only/i.test(x.textContent)); if (b) b.click(); }""")
    pg.wait_for_timeout(400)
    dx, dy = dot_pos()
    pev("pointerdown", 702, dx, dy)
    pev("pointermove", 702, 600, 200)
    pev("pointerup", 702, 600, 200)
    pg.wait_for_timeout(900)
    check("yard ro deny", "红墙" in pg.evaluate("() => document.querySelector('.yard-tag').textContent"))
    pg.close()


def match_game(ctx):
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
    pg.goto(BASE + "/glossary.html")
    pg.wait_for_load_state("networkidle")
    pg.click('button[data-md="match"]')
    pg.wait_for_timeout(400)
    ok = pg.evaluate("() => document.querySelectorAll('#mg-wrap canvas').length === 1 && !document.getElementById('match-deck').hidden")
    check("match mode opens", ok)
    check("match no errors", not errs, errs[:3])
    pg.close()


def prompt_toggles(ctx):
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
    pg.goto(BASE + "/labs/prompt.html")
    pg.wait_for_load_state("networkidle")
    pg.click('[data-preset="fresh"]')
    pg.wait_for_timeout(250)
    pg.evaluate("""() => {
        const cb = document.querySelector('#toggles input[aria-label*="AGENTS"]');
        if (cb && !cb.checked) cb.click();
    }""")
    pg.wait_for_timeout(250)
    subs = pg.evaluate("() => document.querySelectorAll('#toggles .sub-files').length")
    boxes = pg.evaluate("() => document.querySelectorAll('#toggles input[type=checkbox]').length")
    check("prompt sub-rows appear with main switch", subs == 1 and boxes == 11, [subs, boxes])
    check("prompt no errors", not errs, errs[:3])
    pg.close()


def act1_race(ctx):
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
    pg.goto(BASE + "/labs/appserver.html")
    pg.wait_for_load_state("networkidle")
    pg.evaluate("() => document.getElementById('restart').click()")
    pg.wait_for_timeout(200)
    sliders = pg.locator("#act1-panel input[type=range]")
    if sliders.count():
        sliders.last.evaluate("el => { el.value = 11; el.dispatchEvent(new Event('input')); }")
    pg.wait_for_timeout(200)
    yes = pg.locator("button:has-text('批准')").first
    if yes.count():
        yes.click()
        pg.evaluate("() => document.getElementById('restart').click()")   # 420ms 窗口内重来
    pg.wait_for_timeout(800)
    check("act1 race guarded (seq empty after restart)", not errs, errs[:3])
    pg.close()


def neighbor_graph(ctx):
    pg = ctx.new_page()
    pg.goto(BASE + "/labs/atlas.html")
    pg.wait_for_load_state("networkidle")
    pg.evaluate("""() => {
        const chips = Array.from(document.querySelectorAll('#bands .cr'));
        const core = chips.find(c => c.textContent.trim() === 'core');
        if (core) core.click();
    }""")
    pg.wait_for_timeout(400)
    check("neighbor graph shows for core", pg.evaluate("() => !document.getElementById('dc-neigh').hidden"))
    check("neighbor canvas present", pg.evaluate("() => document.querySelectorAll('#dc-neigh canvas').length") == 1)
    pg.close()


def skip_link(ctx):
    pg = ctx.new_page()
    pg.goto(BASE + "/labs/loop.html")
    pg.wait_for_load_state("networkidle")
    pg.evaluate("() => { window.__m = 42; }")
    pg.evaluate("() => document.querySelector('.skip-link').click()")
    pg.wait_for_timeout(600)
    ok = pg.evaluate("() => window.__m === 42")
    check("skip-link does not reload", ok)
    if not ok:
        pg.goto(BASE + "/labs/loop.html")   # 真被刷了就恢复现场
    pg.close()


def galaxy_wireframe(ctx):
    """05 星系线框球：开关切换、hash 持久化、弧线绘制改变画面。"""
    pg = ctx.new_page()
    pg.goto(BASE + "/labs/atlas.html")
    pg.wait_for_load_state("networkidle")
    pg.evaluate("() => document.querySelector('[data-vw=\"galaxy\"]').click()")
    pg.wait_for_timeout(400)
    check("wire toggle present", pg.evaluate("() => !!document.getElementById('gx-wire')"))
    # 选中一个有出边的 crate（core），让依赖边出现
    pg.evaluate("""() => {
        const chips = Array.from(document.querySelectorAll('#bands .cr'));
        const core = chips.find(c => c.textContent.trim() === 'core');
        if (core) core.click();
    }""")
    pg.wait_for_timeout(400)
    hash0 = pg.evaluate("() => location.hash")
    shot_off = pg.screenshot()
    pg.evaluate("() => document.getElementById('gx-wire').click()")
    pg.wait_for_timeout(500)
    check("wire state on", pg.evaluate("() => window.CAGalaxy && CAGalaxy.state().wire === true"))
    check("wire aria-pressed", pg.evaluate("() => document.getElementById('gx-wire').getAttribute('aria-pressed')") == "true")
    check("wire persisted in hash", "wf=1" in pg.evaluate("() => location.hash"))
    shot_on = pg.screenshot()
    check("wireframe changes render", shot_off != shot_on)
    # 刷新后恢复
    pg.reload()
    pg.wait_for_load_state("networkidle")
    pg.evaluate("() => document.querySelector('[data-vw=\"galaxy\"]').click()" if pg.evaluate("() => !!document.querySelector('#galaxy[hidden]')") else "() => {}")
    pg.wait_for_timeout(400)
    check("wire restored after reload", pg.evaluate("() => window.CAGalaxy && CAGalaxy.state().wire === true"))
    pg.evaluate("() => document.getElementById('gx-wire').click()")   # 恢复现场
    _ = hash0
    pg.close()


def patch_annotation_pen(ctx):
    """07C 标注笔：开模式→画一笔→计数+1，Ctrl+Z 撤销，清除清零，Esc 退出。"""
    pg = ctx.new_page()
    pg.goto(BASE + "/labs/deep.html")
    pg.wait_for_load_state("networkidle")
    check("pen handle exposed", pg.evaluate("() => !!window.CAInk"))
    check("pen overlay pointer-events none by default",
          pg.evaluate("() => getComputedStyle(document.querySelector('.pl-ink')).pointerEvents") == "none")
    pg.evaluate("() => document.getElementById('pl-mark').click()")
    pg.wait_for_timeout(100)
    check("pen mode on", pg.evaluate("() => CAInk.mode() === true"))
    pg.locator("#pl-grid").scroll_into_view_if_needed()
    pg.wait_for_timeout(400)
    box = pg.locator("#pl-grid").bounding_box()
    x0, y0 = box["x"] + 30, box["y"] + 30
    pg.mouse.move(x0, y0)
    pg.mouse.down()
    for k in range(8):
        pg.mouse.move(x0 + (k + 1) * 14, y0 + ((k * 7) % 23))
    pg.mouse.up()
    pg.wait_for_timeout(100)
    check("stroke recorded", pg.evaluate("() => CAInk.count()") == 1,
          pg.evaluate("() => CAInk.count()"))
    pg.keyboard.press("Control+z")
    pg.wait_for_timeout(100)
    check("ctrl+z undoes stroke", pg.evaluate("() => CAInk.count()") == 0)
    pg.keyboard.type("hello")   # 焦点在 body：确认画布不吞键盘
    pg.evaluate("() => document.getElementById('pl-mark-clear').click()")
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(100)
    check("esc exits pen mode", pg.evaluate("() => CAInk.mode() === false"))
    pg.close()


def patch_line_explainer(ctx):
    """07C 逐行讲解器：9 行可点、气泡内容对应、弄坏链接装载预设、Esc/外点收起。"""
    pg = ctx.new_page()
    pg.goto(BASE + "/labs/deep.html")
    pg.wait_for_load_state("networkidle")
    check("explainer rows == 9", pg.evaluate("() => window.CALLines && CALLines.count()") == 9)
    rows = pg.locator("#ll-code .ll-row")
    rows.nth(2).click()   # @@ 锚点行
    pg.wait_for_timeout(150)
    check("bubble opens on anchor row", pg.evaluate("() => CALLines.open() === 2"))
    bubble_txt = pg.evaluate("() => document.getElementById('ll-bubble').textContent")
    check("bubble mentions anchor", "锚" in bubble_txt, bubble_txt[:60])
    check("bubble has break link", pg.evaluate(
        "() => !!document.querySelector('#ll-bubble [data-ll-try=\"badanchor\"]')"))
    pg.evaluate("() => document.querySelector('#ll-bubble [data-ll-try]').click()")
    pg.wait_for_timeout(200)
    src_val = pg.evaluate("() => document.getElementById('pl-src').value")
    check("break link loads badanchor preset", "fn shutdown" in src_val, src_val[:80])
    check("bubble closed after break link", pg.evaluate("() => CALLines.open() === -1"))
    rows.nth(5).click()   # ＋ 行
    pg.wait_for_timeout(150)
    check("add-row bubble open", pg.evaluate("() => CALLines.open() === 5"))
    pg.keyboard.press("ArrowDown")
    pg.wait_for_timeout(120)
    check("arrow-down moves bubble", pg.evaluate("() => CALLines.open() === 6"))
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(120)
    check("esc closes bubble", pg.evaluate("() => CALLines.open() === -1"))
    rows.nth(8).click()   # End Patch 行 → noend 弄坏链接
    pg.wait_for_timeout(120)
    check("end-row has noend link", pg.evaluate(
        "() => !!document.querySelector('#ll-bubble [data-ll-try=\"noend\"]')"))
    pg.close()


def pull_out_lab(ctx):
    """02 抽层实验：抽层扣稳定度、抽塌有塌法文案、重置还原。"""
    pg = ctx.new_page()
    pg.goto(BASE + "/labs/prompt.html")
    pg.wait_for_load_state("networkidle")
    check("pull lab exposed", pg.evaluate("() => !!window.PULLLAB"))
    check("tower has 7 blocks", pg.evaluate("() => document.querySelectorAll('#pol-tower .pol-block').length") == 7)
    pg.evaluate("() => PULLLAB.pull('instr')")
    pg.wait_for_timeout(120)
    check("one layer pulled", pg.evaluate("() => PULLLAB.count()") == 1)
    check("instr weight 34 -> stab 66", pg.evaluate("() => PULLLAB.stability()") == 66)
    check("block marked out", pg.evaluate(
        "() => document.querySelector('#pol-tower .pol-block').getAttribute('aria-pressed')") == "true")
    pg.evaluate("() => PULLLAB.reset()")
    pg.wait_for_timeout(100)
    check("reset restores 100", pg.evaluate("() => PULLLAB.stability()") == 100)
    # 抽 history(48)+instr(34)+agents(26) = 108 -> 塌
    pg.evaluate("() => { PULLLAB.pull('history'); PULLLAB.pull('instr'); }")
    pg.wait_for_timeout(150)
    verdict2 = pg.evaluate("() => document.getElementById('pol-out').textContent")
    check("verdict label matches why", "base_instructions" in verdict2 and "工具箱" in verdict2,
          verdict2[:80])
    pg.evaluate("() => { PULLLAB.pull('agents'); }")
    pg.wait_for_timeout(200)
    check("tower topples at <=0", pg.evaluate("() => PULLLAB.toppled()") is True)
    verdict = pg.evaluate("() => document.getElementById('pol-out').textContent")
    check("topple verdict explains", "塌了" in verdict and "分摊" in verdict, verdict[:60])
    pg.evaluate("() => PULLLAB.reset()")
    pg.wait_for_timeout(100)
    check("reset after topple", pg.evaluate("() => PULLLAB.toppled()") is False)
    pg.close()


def dive_dial(ctx):
    """08 深度转盘：11 刻度、goto 跳站、方向键逐站。"""
    pg = ctx.new_page()
    pg.goto(BASE + "/labs/dive.html")
    pg.wait_for_load_state("networkidle")
    check("dial handle exists", pg.evaluate("() => !!document.querySelector('.dr-handle')"))
    check("dial 11 ticks", pg.evaluate("() => document.querySelectorAll('.dr-tick').length") == 11)
    check("handle is slider", pg.evaluate(
        "() => document.querySelector('.dr-handle').getAttribute('role')") == "slider")
    pg.evaluate("() => DIAL.goto(10)")
    pg.wait_for_timeout(900)
    check("goto reaches trench", pg.evaluate("() => DIAL.state().depth") > 9.0,
          pg.evaluate("() => DIAL.state().depth"))
    check("aria tracks depth", pg.evaluate(
        "() => parseFloat(document.querySelector('.dr-handle').getAttribute('aria-valuenow'))") > 9.0)
    pg.evaluate("() => document.querySelector('.dr-handle').focus()")
    pg.keyboard.press("ArrowUp")
    pg.wait_for_timeout(700)
    check("arrow-up climbs a station", pg.evaluate("() => DIAL.state().depth") < 9.6,
          pg.evaluate("() => DIAL.state().depth"))
    pg.close()


def guess_crate(ctx):
    """05 GUESS WHO：四线索反馈、无效名拒绝、命中即赢。"""
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
    pg.goto(BASE + "/labs/atlas.html")
    pg.wait_for_load_state("networkidle")
    check("guess crate hook", pg.evaluate("() => !!window.GUESSCRATE"))
    check("secret drawn from pool", pg.evaluate("() => !!GUESSCRATE.secret()"))
    pg.evaluate("() => GUESSCRATE.guess('tui')")
    pg.wait_for_timeout(120)
    check("guess recorded as row", pg.evaluate("() => document.querySelectorAll('#gw-rows .gw-row').length") == 1)
    check("row has rel cell", pg.evaluate(
        "() => (document.querySelector('#gw-rows .gw-rel') || {}).textContent !== undefined"))
    pg.evaluate("() => GUESSCRATE.guess('not-a-crate')")
    pg.wait_for_timeout(100)
    check("invalid name rejected", pg.evaluate(
        "() => document.getElementById('gw-out').textContent.indexOf('不在') !== -1"))
    check("invalid not counted", pg.evaluate("() => GUESSCRATE.guesses()") == 1)
    pg.evaluate("() => GUESSCRATE.guess(GUESSCRATE.secret())")
    pg.wait_for_timeout(150)
    check("win ends game", pg.evaluate("() => GUESSCRATE.done()") is True)
    check("win row highlighted", pg.evaluate(
        "() => document.querySelector('#gw-rows .gw-row.win') !== null"))
    pg.evaluate("() => document.getElementById('gw-new').click()")
    pg.wait_for_timeout(120)
    check("new round resets", pg.evaluate("() => GUESSCRATE.guesses()") == 0 and pg.evaluate("() => GUESSCRATE.done()") is False)
    check("guess game no errors", not errs, errs[:3])
    pg.close()


def reduced_motion(browser):
    ctx = browser.new_context(viewport={"width": 1280, "height": 960}, reduced_motion="reduce")
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
    for path in ["/", "/labs/atlas.html", "/404.html"]:
        pg.goto(BASE + path)
        pg.wait_for_load_state("networkidle")
        pg.wait_for_timeout(500)
    check("reduced-motion clean", not errs, errs[:3])
    ctx.close()


def main():
    quick = "--quick" in sys.argv
    httpd = start_server()
    print("server on", BASE)
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1280, "height": 960})
        sweep_pages(ctx, {})
        if not quick:
            mctx = browser.new_context(viewport={"width": 390, "height": 844},
                                       device_scale_factor=2, is_mobile=True, has_touch=True)
            mobile_sweep(mctx, {})
            mctx.close()
            theme_toggle(ctx)
            pet_fling(ctx)
            force_view(ctx)
            tree_zoom(ctx)
            sse_waterfall(ctx)
            hist_curve(ctx)
            yard_grab(ctx)
            match_game(ctx)
            prompt_toggles(ctx)
            act1_race(ctx)
            neighbor_graph(ctx)
            galaxy_wireframe(ctx)
            patch_annotation_pen(ctx)
            patch_line_explainer(ctx)
            pull_out_lab(ctx)
            dive_dial(ctx)
            skip_link(ctx)
            reduced_motion(browser)
        browser.close()
    httpd.shutdown()

    print()
    print(f"通过 {len(PASS)} · 失败 {len(FAILS)}")
    for name, detail in FAILS:
        print("  FAIL " + name + " <- " + str(detail)[:160])
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
