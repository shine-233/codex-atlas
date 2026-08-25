/* CODEX ATLAS · panel/page —— 自 panel.js 拆出，加载顺序必须在 panel.js 之后 */
(function () {
  /* 快捷键速查（? 呼出 / Esc 关闭） */
  var layer = document.createElement("div");
  layer.className = "kbd-layer";
  layer.setAttribute("role", "dialog");
  layer.setAttribute("aria-modal", "true");
  layer.setAttribute("aria-label", "键盘快捷键速查");
  layer.innerHTML =
    '<div class="kbd-card">' +
    '<h3>快捷键速查</h3>' +
    '<p class="kc-sub">全站通用 · 再按 ? 或 Esc 关闭</p>' +
    "<table class=\"rt\"><tbody>" +
    "<tr><td><span class='kbd'>Ctrl K</span> / <span class='kbd'>/</span></td><td>呼出命令面板，跨页直达任意仪器</td></tr>" +
    "<tr><td><span class='kbd'>?</span></td><td>呼出 / 关闭本表</td></tr>" +
    "<tr><td><span class='kbd'>Esc</span></td><td>关闭弹层；在搜索框里则清空关键词</td></tr>" +
    "<tr><td><span class='kbd'>←</span> <span class='kbd'>→</span></td><td>01 阶段单步 · 04 报文逐条</td></tr>" +
    "<tr><td><span class='kbd'>空格</span></td><td>01 播放 / 暂停全程</td></tr>" +
    "<tr><td><span class='kbd'>Tab</span></td><td>移动焦点；虚线术语词上回车可看解释卡</td></tr>" +
    "</tbody></table>" +
    '<p class="small muted">各仪器的按钮、滑杆、矩阵格子都支持点按，不依赖键盘也能走完全程。</p>' +
    "</div>";
  document.body.appendChild(layer);
  var lastFocus = null;
  function toggleKeys(force) {
    var open = typeof force === "boolean" ? force : !layer.classList.contains("open");
    layer.classList.toggle("open", open);
    if (open) {
      lastFocus = document.activeElement;
      var card = layer.querySelector(".kbd-card");
      if (card) { card.setAttribute("tabindex", "-1"); card.focus(); }
    } else if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
      lastFocus = null;
    }
  }
  /* 弹层内没有其他可停留元素，Tab 不让它漏到背景页面 */
  layer.addEventListener("keydown", function (e) {
    if (e.key === "Tab") e.preventDefault();
  });
  document.addEventListener("keydown", function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (e.key === "?" && !typing) { e.preventDefault(); toggleKeys(); }
    else if (e.key === "Escape" && layer.classList.contains("open")) toggleKeys(false);
  });
  layer.addEventListener("click", function (e) { if (e.target === layer) toggleKeys(false); });

  /* ---------- XP：把本机真实进度折算成分数与称号（纯本地，不上传） ----------
     口径：主线自检每题 10 分，支线 6 分，翻卡 4 分，速通每题 15 分，足迹每页 5 分。
     称号只描述你在这台浏览器里做过什么，不承诺任何别的事。 */
  var XP_LEVELS = [
    [0, "路过"], [80, "读码学徒"], [180, "信号员"], [320, "循环驯兽师"],
    [500, "crate 考古学家"], [720, "深水潜航员"], [950, "全图通"]
  ];
  function caXP() {
    var xp = 0;
    try {
      var seen = JSON.parse(localStorage.getItem("ca-seen") || "{}");
      var seenCount = 0;
      ["index.html", "loop.html", "prompt.html", "sandbox.html", "appserver.html", "atlas.html", "deep.html", "glossary.html", "dive.html"]
        .forEach(function (p) { if (seen[p]) seenCount++; });
      xp += seenCount * 5;
      var quiz = window.CAProgress ? CAProgress.read() : {};
      ["loop.html", "prompt.html", "sandbox.html", "appserver.html", "atlas.html"].forEach(function (k) {
        if (quiz[k]) xp += quiz[k].c * 10;
      });
      if (quiz["deep.html"]) xp += quiz["deep.html"].c * 6;
      var f = JSON.parse(localStorage.getItem("ca-flash-glossary") || "{}");
      Object.keys(f).forEach(function (k) { if (f[k] === true) xp += 4; });
      var sr = JSON.parse(localStorage.getItem("ca-speedrun") || "null");
      if (sr && sr.correct) xp += sr.correct * 15;
    } catch (e) { /* 存储不可用就按 0 算 */ }
    return xp;
  }
  function caLevel(xp) {
    var lv = 0;
    for (var i = 0; i < XP_LEVELS.length; i++) { if (xp >= XP_LEVELS[i][0]) lv = i; }
    return lv;
  }

  /* ---------- 学习档案：本机进度总览 · 导出 · 重置 ----------
     数据全部在 localStorage（ca-*），这里只做汇总展示与清理；
     音效偏好（ca-sound）在重置时保留。 */
  var profLayer = document.createElement("div");
  profLayer.className = "kbd-layer";
  profLayer.setAttribute("role", "dialog");
  profLayer.setAttribute("aria-modal", "true");
  profLayer.setAttribute("aria-label", "学习档案");
  profLayer.innerHTML = '<div class="kbd-card" id="prof-card"></div>';
  document.body.appendChild(profLayer);
  var profLastFocus = null, profArmReset = false, profResetTimer = null;

  function profClose() {
    profLayer.classList.remove("open");
    if (profLastFocus && typeof profLastFocus.focus === "function") profLastFocus.focus();
    profLastFocus = null;
  }

  function openProfile() {
    profLastFocus = document.activeElement;
    var card = document.getElementById("prof-card");

    var seen = {};
    try { seen = JSON.parse(localStorage.getItem("ca-seen") || "{}"); } catch (e) { /* 忽略 */ }
    var ALLPAGES = ["index.html", "loop.html", "prompt.html", "sandbox.html", "appserver.html", "atlas.html", "deep.html", "glossary.html", "dive.html"];
    var PNAME = {
      "loop.html": "01 循环回路", "prompt.html": "02 输入组装", "sandbox.html": "03 权限沙箱",
      "appserver.html": "04 协议线路", "atlas.html": "05 Crate 图谱", "deep.html": "07 深水区",
      "dive.html": "08 调用栈下潜"
    };
    var seenCount = ALLPAGES.filter(function (p) { return seen[p]; }).length;

    var quiz = window.CAProgress ? CAProgress.read() : {};
    var MAIN5 = ["loop.html", "prompt.html", "sandbox.html", "appserver.html", "atlas.html"];
    var quizRows = "", cleared = 0;
    ALLPAGES.forEach(function (p) {
      if (!PNAME[p]) return;
      var rec = quiz[p];
      var pct = rec && rec.t ? Math.round(rec.c / rec.t * 100) : 0;
      /* 只数五条主线，与首页「五条全通」口径一致（deep 是支线，单独展示不计入） */
      if (MAIN5.indexOf(p) !== -1 && rec && rec.t && rec.c >= rec.t) cleared++;
      quizRows += "<tr><td>" + PNAME[p] + (MAIN5.indexOf(p) !== -1 ? "" : " · 支线") + "</td><td>" +
        (rec ? "答对 <b>" + rec.c + "</b> / " + rec.t : "<span style='color:var(--faint);'>还没做过</span>") +
        '<span class="prof-meter" aria-hidden="true"><i style="width:' + pct + '%;"></i></span></td></tr>';
    });

    var flash = 0;
    try {
      var f = JSON.parse(localStorage.getItem("ca-flash-glossary") || "{}");
      Object.keys(f).forEach(function (k) { if (f[k] === true) flash++; });
    } catch (e) { /* 忽略 */ }

    /* XP 行：等级称号 + 距下一级的进度条 */
    var xp = caXP(), lv = caLevel(xp);
    var nxt = XP_LEVELS[lv + 1];
    var xpRow = "<tr><td>经验 · 称号</td><td><b>" + XP_LEVELS[lv][1] + "</b> · " + xp + " XP";
    if (nxt) {
      var pctX = Math.round((xp - XP_LEVELS[lv][0]) / (nxt[0] - XP_LEVELS[lv][0]) * 100);
      xpRow += '<span class="prof-meter" aria-hidden="true"><i style="width:' + pctX + '%;"></i></span>' +
        '<span style="color:var(--faint);font-size:11.5px;">下一级「' + nxt[1] + "」还差 " + (nxt[0] - xp) + "</span>";
    } else {
      xpRow += "<span style='color:var(--amber);'> · 已满级</span>";
    }
    xpRow += "</td></tr>";

    card.innerHTML =
      "<h3>学习档案</h3>" +
      '<p class="kc-sub">只存在这台浏览器的 localStorage 里 · 不上传任何数据</p>' +
      "<table class=\"rt\"><tbody>" +
      xpRow +
      "<tr><td>线路足迹</td><td>读过 <b>" + seenCount + "</b> / " + ALLPAGES.length + " 页</td></tr>" +
      "<tr><td>自检通关</td><td><b>" + cleared + "</b> / 5 条主线全对</td></tr>" +
      quizRows +
      "<tr><td>翻卡记忆</td><td>已记牢 <b>" + flash + "</b> 个术语</td></tr>" +
      "</tbody></table>" +
      '<div class="prof-actions">' +
      '<button type="button" class="btn" id="prof-copy">复制档案 JSON</button>' +
      '<button type="button" class="btn" id="prof-reset">重置全部进度</button>' +
      "</div>" +
      '<p class="small muted">「复制」把上面这些打成一段 JSON 存档留念（不含恢复导入——数据只在这台浏览器的 localStorage 里）。「重置」清空自检成绩、已读圆点和翻卡记录——音效开关保留。</p>';

    /* 剪贴板 API 不可用时的兜底：隐藏 textarea + execCommand */
    function fallbackCopy(text) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { document.execCommand("copy"); } catch (e) { /* 老浏览器尽力而为 */ }
      document.body.removeChild(ta);
    }

    card.querySelector("#prof-copy").addEventListener("click", function () {
      var payload = { site: "codex-atlas", exportedAt: new Date().toISOString(), pagesSeen: seenCount, xp: xp, level: XP_LEVELS[lv][1], quiz: quiz, flashcardsKnown: flash };
      var text = JSON.stringify(payload, null, 2);
      var btn2 = this;
      function done() {
        btn2.textContent = "已复制 ✓";
        CAToast("<b>小鳕</b> · 档案进剪贴板了。贴到备忘录里就能带走。");
        setTimeout(function () { btn2.textContent = "复制档案 JSON"; }, 1800);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
      } else { fallbackCopy(text); done(); }
    });

    var resetBtn = card.querySelector("#prof-reset");
    resetBtn.addEventListener("click", function () {
      if (!profArmReset) {
        profArmReset = true;
        resetBtn.textContent = "再点一次，确认清空";
        resetBtn.classList.add("danger");
        if (profResetTimer) clearTimeout(profResetTimer);
        profResetTimer = setTimeout(function () {
          profArmReset = false;
          resetBtn.textContent = "重置全部进度";
          resetBtn.classList.remove("danger");
        }, 3200);
        return;
      }
      try {
        var kill = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k.indexOf("ca-") === 0 && k !== "ca-sound") kill.push(k);
        }
        kill.forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) { /* 存储不可用就没什么可清的 */ }
      location.reload();
    });

    profArmReset = false;
    if (profResetTimer) clearTimeout(profResetTimer);
    profLayer.classList.add("open");
    card.setAttribute("tabindex", "-1");
    card.focus();
  }
  window.CAXP = { calc: caXP, level: caLevel, levels: XP_LEVELS };
window.CAProfileOpen = openProfile;

  profLayer.addEventListener("keydown", function (e) { if (e.key === "Tab") e.preventDefault(); });
  profLayer.addEventListener("click", function (e) { if (e.target === profLayer) profClose(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && profLayer.classList.contains("open")) profClose();
  });

  /* 左栏底部入口（移动端走 Ctrl K 命令面板） */
  Array.prototype.forEach.call(document.querySelectorAll(".rail-foot"), function (foot) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "rail-profile";
    b.textContent = "学习档案";
    b.title = "自检成绩 · 翻卡进度 · 导出 / 重置（仅存本机）";
    b.addEventListener("click", openProfile);
    foot.appendChild(b);
  });

  /* ---------- 「接下来」推荐卡：按真实进度指下一站 ----------
     首页有路由表和速通，不重复；内页做完自检后，这里告诉你去哪。
     推荐逻辑：本页没做满先做满 → 否则按 01→07 顺序找第一条没满的线 →
     全满则送你去速通验收。数据全部来自本机 CAProgress。 */
  (function () {
    var main = document.getElementById("main");
    if (!main) return;
    var here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    if (here === "" || here === "index.html") return;
    var isLab = location.pathname.indexOf("/labs/") !== -1;
    var pre = isLab ? "" : "labs/";
    var quiz = window.CAProgress ? CAProgress.read() : {};
    var ORDER = [
      ["loop.html", "01 循环回路"], ["prompt.html", "02 输入组装"], ["sandbox.html", "03 权限沙箱"],
      ["appserver.html", "04 协议线路"], ["atlas.html", "05 Crate 图谱"], ["deep.html", "07 深水区"],
      ["dive.html", "08 调用栈下潜"]
    ];
    function unfinished(k) {
      var r = quiz[k];
      if (!r || !r.t) return { done: false, c: 0, t: 0 };
      return { done: r.c >= r.t, c: r.c, t: r.t };
    }
    var target = null, why = "";
    var inOrder = ORDER.some(function (o) { return o[0] === here; });
    var curRec = unfinished(here);
    if (inOrder && !curRec.done) {
      target = here;
      why = curRec.t
        ? "本页自检 " + curRec.c + " / " + curRec.t + "，先做满，进度环才会闭合成实心。"
        : "本页的 CHECKPOINT 还没做过——做完它，首页线路图上这站才有进度环。";
    }
    if (!target) {
      for (var i = 0; i < ORDER.length; i++) {
        if (ORDER[i][0] === here) continue;
        var r2 = unfinished(ORDER[i][0]);
        if (!r2.done) {
          target = ORDER[i][0];
          why = r2.t ? "自检 " + r2.c + " / " + r2.t + "，还差 " + (r2.t - r2.c) + " 题就通关。"
                     : "还没去过——这条线上有能上手的仪器。";
          break;
        }
      }
    }
    var href, title, sub;
    if (target) {
      var nm = ORDER.filter(function (o) { return o[0] === target; })[0];
      title = nm ? nm[1] : "术语速查";
      href = target === "glossary.html" ? (isLab ? "../glossary.html" : "glossary.html") : pre + target;
      sub = why;
    } else {
      title = "全站速通 · 验收";
      href = (isLab ? "../index.html" : "index.html") + "#speedrun";
      sub = "五条主线加支线的自检全通了。8 题限时速通走一遍，看成绩配不配得上这张地图。";
    }
    var card = document.createElement("section");
    card.className = "next-card";
    card.innerHTML =
      '<p class="nc-eyebrow">下一步 · 按你的进度</p>' +
      '<div class="nc-row"><a class="nc-link" href="' + href + '">' + title + " →</a>" +
      "<p class='nc-why'>" + sub + "</p></div>";
    var quizEl = document.getElementById("quiz");
    if (quizEl && quizEl.parentNode) quizEl.parentNode.insertBefore(card, quizEl.nextSibling);
    else main.appendChild(card);
  })();

  /* ---------- 回到顶部：长页往下滚过一屏半才现身，键盘可达 ---------- */
  (function () {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ca-top";
    btn.textContent = "↑ 顶部";
    btn.setAttribute("aria-label", "回到页面顶部");
    btn.title = "回到顶部";
    var shown = false;
    function paint() {
      var show = window.scrollY > window.innerHeight * 1.5;
      if (show !== shown) { shown = show; btn.classList.toggle("show", show); }
    }
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: window.PrefersReducedMotion ? "auto" : "smooth" });
    });
    window.addEventListener("scroll", paint, { passive: true });
    paint();
    document.body.appendChild(btn);
  })();

  /* ---------- 空闲预取：八页互指，配合跨页过渡接近秒开 ----------
     requestIdleCallback 里逐个注入 <link rel="prefetch">；
     saveData 或 2G 用户直接跳过——省流量优先于快。 */
  (function () {
    function go() {
      var here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
      var isLab = location.pathname.indexOf("/labs/") !== -1;
      var pages = ["index.html", "labs/loop.html", "labs/prompt.html", "labs/sandbox.html",
        "labs/appserver.html", "labs/atlas.html", "labs/deep.html", "labs/dive.html", "glossary.html"];
      var conn = navigator.connection || {};
      if (conn.saveData || /2g$/i.test(conn.effectiveType || "")) return;
      pages.forEach(function (p) {
        var file = p.split("/").pop();
        if (file === here) return;
        var href = p.indexOf("labs/") === 0 ? (isLab ? file : p) : (isLab ? "../" + p : p);
        if (document.querySelector('link[rel="prefetch"][href="' + href + '"]')) return;
        var l = document.createElement("link");
        l.rel = "prefetch"; l.href = href;
        document.head.appendChild(l);
      });
    }
    if ("requestIdleCallback" in window) { try { requestIdleCallback(go, { timeout: 4000 }); } catch (e) { setTimeout(go, 2500); } }
    else setTimeout(go, 2500);
  })();

  /* ---------- 全站命令面板：Ctrl+K 或 / 呼出，跨页直达任意仪器 ---------- */
  (function () {
    var IN_LABS = location.pathname.indexOf("/labs/") !== -1;
    function P(rel) { return (IN_LABS ? "../" : "") + rel; }

    var CMDS = [
      { no: "00", name: "总览 · 按问题查路由表", sub: "找入口", href: P("index.html"), kw: "overview 总览 路由 入口 route" },
      { no: "01", name: "循环回路 · 单步仪", sub: "13 站 · 播放/键盘", href: P("labs/loop.html"), kw: "loop agent turn 阶段 循环 回路" },
      { name: "↳ 第10站 · POST /responses", sub: "出站与 SSE", href: P("labs/loop.html") + "#s=10", kw: "sse api endpoint 出站 采样" },
      { name: "↳ 会话建立段 / 重采样回路图", sub: "拓扑联动", href: P("labs/loop.html") + "#setup-panel", kw: "topology 拓扑 setup 建立段" },
      { name: "↳ TURN SIMULATOR · 自己开一轮", sub: "队列对 / steer 沙盒", href: P("labs/loop.html") + "#sim-panel", kw: "simulator 沙盒 队列 steer 并入 状态机 turn 自己开" },
      { no: "02", name: "输入组装 · 组装仪", sub: "七层开关", href: P("labs/prompt.html"), kw: "prompt payload agents 层叠 32kib 负载" },
      { name: "↳ PULL-OUT LAB · 抽层实验", sub: "把请求塔抽塌", href: P("labs/prompt.html") + "#pull-lab", kw: "抽层 jenga 塔 稳定度 塌 后果 pull" },
      { no: "03", name: "权限沙箱 · 场景判定器", sub: "模式×审批×动作", href: P("labs/sandbox.html"), kw: "sandbox 权限 沙箱 seatbelt landlock wfp 判定 审批" },
      { name: "↳ CONFIG BRIDGE · 配置片段生成", sub: "", href: P("labs/sandbox.html") + "#cfg-panel", kw: "config toml 配置 cli 片段" },
      { name: "↳ SANDBOX YARD · 空间沙盘", sub: "围墙在哪，包往哪走", href: P("labs/sandbox.html") + "#yard-panel", kw: "yard 沙盘 围墙 空间 可视化 fence" },
      { name: "↳ MCP DETOUR · 双路径对比", sub: "内置穿墙 / MCP 绕墙", href: P("labs/sandbox.html") + "#mcp-lane-panel", kw: "mcp detour 双路径 rmcp 绕墙 外部服务器" },
      { no: "04", name: "协议线路 · 报文时间线", sub: "审批分支 · 双向通道", href: P("labs/appserver.html"), kw: "protocol json-rpc 协议 报文 thread turn item 挂起" },
      { no: "05", name: "Crate 图谱", sub: "136 成员 · 列表/树图/力图", href: P("labs/atlas.html"), kw: "atlas crate 图谱 treemap 树图 workspace rust" },
      { no: "06", name: "术语速查 · 人话版", sub: "可检索", href: P("glossary.html"), kw: "glossary 术语 名词 解释" },
      { name: "↳ 自测模式 · 翻卡回忆", sub: "记得/忘了存档", href: P("glossary.html") + "#md=drill", kw: "flashcard drill 自测 记忆 翻卡 背题" },
      { no: "07", name: "深水区 A · 凭据流", sub: "ChatGPT vs API key", href: P("labs/deep.html") + "#mod-a", kw: "auth login 登录 凭据 token oauth auth.json api key" },
      { name: "深水区 B · 配置系统全貌", sub: "优先级阶梯", href: P("labs/deep.html") + "#mod-b", kw: "config toml profile 配置 优先级 覆盖" },
      { name: "深水区 C · apply_patch 解剖台", sub: "可编辑可应用", href: P("labs/deep.html") + "#mod-c", kw: "patch 补丁 apply diff hunk 锚点 格式" },
      { name: "深水区 D · TUI 后台", sub: "事件映射+斜杠命令", href: P("labs/deep.html") + "#mod-d", kw: "tui 终端 slash 命令 界面 渲染" },
      { name: "深水区 E · 扩展挂点地图", sub: "skills/hooks/memories", href: P("labs/deep.html") + "#mod-e", kw: "skill hook memory 扩展 插件 技能 记忆 钩子" },
      { name: "↳ HOOKS 事件轴 · 8 个实测钩子", sub: "session_start…session_end", href: P("labs/deep.html") + "#mod-e", kw: "hooks events 事件 钩子 pre_tool_use post_tool_use" },
      { name: "深水区 F · Code Mode 实验位", sub: "V8 跑模型代码（推演）", href: P("labs/deep.html") + "#mod-f", kw: "code mode v8 实验 javascript host" },
      { name: "深水区 G · 源码覆盖地图", sub: "39 文件 · 13 crate 切片台账", href: P("labs/deep.html") + "#mod-g", kw: "coverage 覆盖 台账 切片 清单 files sliced" },
      { name: "08 · 调用栈下潜", sub: "滚动即下潜：L0 命令行到海沟底", href: P("labs/dive.html"), kw: "dive 下潜 调用栈 call stack 深度 纵览 scrollytelling" },
      { name: "↳ ACT III · rollout 文件解剖", sub: "JSONL 落盘与恢复", href: P("labs/appserver.html") + "#act3-panel", kw: "rollout jsonl 落盘 恢复 文件名 解剖" },
      { act: "keys", no: "?", name: "快捷键速查", sub: "按 ? 也行", href: "", kw: "shortcut keyboard 键盘 快捷键 help 帮助" },
      { act: "profile", no: "◆", name: "学习档案 · 成绩与重置", sub: "左栏底部也有入口", href: "", kw: "progress 档案 进度 重置 reset 导出 export 成绩 分数" }
    ];

    var layer = document.createElement("div");
    layer.className = "cmdk-layer";
    layer.setAttribute("role", "dialog");
    layer.setAttribute("aria-modal", "true");
    layer.setAttribute("aria-label", "全站命令面板");
    layer.innerHTML =
      '<div class="cmdk-card">' +
      '<input type="text" class="cmdk-input" placeholder="跨页直达：输线路、房间、机制名…（↑↓ 选择 · Enter 打开 · Esc 关闭）" aria-label="搜索站内目的地" autocomplete="off">' +
      '<div class="cmdk-list" role="listbox" aria-label="目的地列表"></div>' +
      "</div>";
    document.body.appendChild(layer);

    var input = layer.querySelector(".cmdk-input");
    var listBox = layer.querySelector(".cmdk-list");
    /* 输入即过滤：没有这一句，搜索框就是死的（Enter 永远跳第一项） */
    input.addEventListener("input", function () { hot = 0; renderList(); });
    var hot = 0;
    var shown = [];
    var lastFocus = null;

    function paintHot() {
      var items = listBox.querySelectorAll(".cmdk-item");
      Array.prototype.forEach.call(items, function (el, i) {
        el.classList.toggle("hot", i === hot);
        el.setAttribute("aria-selected", i === hot ? "true" : "false");
      });
      if (items[hot] && items[hot].scrollIntoView) items[hot].scrollIntoView({ block: "nearest" });
    }

    function renderList() {
      var q = input.value.trim().toLowerCase();
      shown = CMDS.filter(function (c) {
        return !q || (c.name + " " + c.sub + " " + c.kw + " " + (c.no || "")).toLowerCase().indexOf(q) !== -1;
      });
      hot = Math.max(0, Math.min(hot, shown.length - 1));
      if (!shown.length) {
        listBox.innerHTML =
          '<p class="cmdk-empty">没有匹配的目的地。试试：补丁、凭据、树图、自测、审批——<br>或者按 <b style="color:var(--dim);">?</b> 看全部快捷键。</p>';
        return;
      }
      listBox.innerHTML = "";
      shown.forEach(function (c, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "cmdk-item" + (i === hot ? " hot" : "");
        b.id = "cmdk-opt-" + i;
        b.setAttribute("role", "option");
        b.setAttribute("aria-selected", i === hot ? "true" : "false");
        b.innerHTML =
          '<span class="ck-no">' + (c.no || (c.act ? "?" : "·")) + "</span>" +
          '<span class="ck-name">' + c.name + "</span>" +
          '<span class="ck-sub">' + (c.sub || "") + "</span>";
        b.addEventListener("click", function () { run(i); });
        b.addEventListener("mousemove", function () { if (hot !== i) { hot = i; paintHot(); } });
        listBox.appendChild(b);
      });
      /* 读屏跟随高亮项（aria-activedescendant 挂在输入框上） */
      input.setAttribute("aria-activedescendant", shown.length ? "cmdk-opt-" + hot : "");
    }

    function run(i) {
      var c = shown[i];
      if (!c) return;
      close();
      if (c.act === "keys") { toggleKeys(true); return; }
      if (c.act === "profile") { openProfile(); return; }
      if (c.href) location.href = c.href;
    }

    function open() {
      lastFocus = document.activeElement;
      layer.classList.add("open");
      input.value = "";
      hot = 0;
      renderList();
      setTimeout(function () { input.focus(); }, 0);
    }
    function close() {
      layer.classList.remove("open");
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
      lastFocus = null;
    }
    function toggle() { layer.classList.contains("open") ? close() : open(); }

    document.addEventListener("keydown", function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        toggle();
        return;
      }
      if (layer.classList.contains("open")) {
        if (e.key === "Escape") { e.preventDefault(); close(); }
        else if (e.key === "Tab") { e.preventDefault(); }   /* 焦点陷阱：aria-modal 弹层不留焦 */
        else if (e.key === "ArrowDown") { e.preventDefault(); hot = Math.min(shown.length - 1, hot + 1); paintHot(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); hot = Math.max(0, hot - 1); paintHot(); }
        else if (e.key === "Enter") { e.preventDefault(); run(hot); }
        return;
      }
      if (e.key === "/" && !typing && !layer.classList.contains("open")) { e.preventDefault(); open(); }
    });
    layer.addEventListener("mousedown", function (e) { if (e.target === layer) close(); });

    var fab = document.createElement("button");
    fab.type = "button";
    fab.className = "cmdk-fab";
    fab.setAttribute("aria-label", "打开全站命令面板");
    fab.title = "全站直达（Ctrl K 或 / ）";
    fab.textContent = "直达 · Ctrl K";
    fab.addEventListener("click", open);
    document.body.appendChild(fab);
  })();

})();
