/* CODEX ATLAS — 共享面板逻辑 */
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  /* 移动端抽屉导航 */
  ready(function () {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.querySelector(".mobile-nav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });

  /* hash 状态：#s=3&x=1 形式的键值对读写 */
  window.PanelState = {
    read: function () {
      var out = {};
      var h = location.hash.replace(/^#/, "");
      if (!h) return out;
      h.split("&").forEach(function (kv) {
        var p = kv.split("=");
        if (p[0]) out[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || "");
      });
      return out;
    },
    write: function (obj) {
      var parts = [];
      Object.keys(obj).forEach(function (k) {
        if (obj[k] !== "" && obj[k] != null) {
          parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(obj[k]));
        }
      });
      var s = parts.length ? "#" + parts.join("&") : "";
      history.replaceState(null, "", location.pathname + location.search + s);
    }
  };

  /* 动效偏好 */
  window.PrefersReducedMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 当前线路高亮（按 pathname 匹配 rail 链接） */
  ready(function () {
    var path = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".rail-ch, .mobile-nav a").forEach(function (a) {
      var target = a.getAttribute("href").split("/").pop();
      if (target === path || (path === "" && target === "index.html")) {
        a.setAttribute("aria-current", "page");
      }
    });
    /* 编号说明：纯数字导航 */
    document.querySelectorAll(".ch-no").forEach(function (el) {
      el.title = "编号：00 总览 · 01–05 五条线路 · 06 术语速查 · 07 深水区支线";
    });
  });

  /* 已读进度：访问过的线路在 rail 里点亮小点（localStorage，仅本机） */
  ready(function () {
    try {
      var path = location.pathname.split("/").pop() || "index.html";
      if (path.indexOf(".html") !== -1) {
        var seen = JSON.parse(localStorage.getItem("ca-seen") || "{}");
        if (!seen[path]) {
          seen[path] = 1;
          localStorage.setItem("ca-seen", JSON.stringify(seen));
        }
        document.querySelectorAll(".rail-ch").forEach(function (a) {
          var target = a.getAttribute("href").split("/").pop();
          if (seen[target] && !a.hasAttribute("aria-current")) {
            a.classList.add("seen");
            a.title = "读过这条线路";
          }
        });
      }
    } catch (e) { /* localStorage 不可用时静默跳过 */ }
  });

  /* CHECKPOINT · 出站自检：mount(容器, 题目数组)
     题目格式：{ q: 问题, opts: [选项…], a: 正确下标, why: 解析 }
     作答结果写入 localStorage（ca-quiz:<页名>），供首页通关徽章读取。 */
  window.CAProgress = {
    read: function () {
      var out = {};
      try {
        Object.keys(localStorage).forEach(function (k) {
          if (k.indexOf("ca-quiz:") === 0) {
            try { out[k.slice(8)] = JSON.parse(localStorage.getItem(k)); } catch (e) { /* 跳过坏数据 */ }
          }
        });
      } catch (e) { /* localStorage 不可用时返回空 */ }
      return out;
    }
  };

  window.CAQuiz = {
    mount: function (host, questions) {
      if (!host || !questions || !questions.length) return;
      var scoreB = null;

      function pad(n) { return (n < 10 ? "0" : "") + n; }

      function updateScore() { scoreB.textContent = correct + ""; }

      var head = document.createElement("div");
      head.className = "panel-title";
      var h3 = document.createElement("h3");
      h3.textContent = "CHECKPOINT · 出站自检";
      var ro = document.createElement("span");
      ro.className = "readout";
      ro.append("答对 ");
      scoreB = document.createElement("b");
      scoreB.textContent = "0";
      ro.appendChild(scoreB);
      ro.append(" / " + questions.length);
      head.appendChild(h3);
      head.appendChild(ro);
      host.appendChild(head);

      var list = document.createElement("ol");
      list.className = "cq-list";

      var correct = 0;
      var allClearShown = false;

      function maybeAllClear() {
        if (allClearShown || correct < questions.length) return;
        allClearShown = true;
        var badge = document.createElement("p");
        badge.className = "cq-allclear";
        badge.setAttribute("role", "status");
        badge.innerHTML = "<span>ALL CLEAR</span>全部答对——这条线路的关卡你已通关，可以出站了。";
        host.appendChild(badge);
        /* 广播通关事件，站宠小鳕会来庆祝 */
        try { document.dispatchEvent(new CustomEvent("ca:allclear", { detail: { page: location.pathname.split("/").pop() } })); } catch (e) { /* 老浏览器就跳过 */ }
      }

      questions.forEach(function (item, qi) {
        var li = document.createElement("li");
        li.className = "cq-item";

        var q = document.createElement("p");
        q.className = "cq-q";
        q.textContent = item.q;
        li.appendChild(q);

        var opts = document.createElement("div");
        opts.className = "cq-opts";
        item.opts.forEach(function (label, oi) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "cq-opt";
          b.textContent = label;
          b.addEventListener("click", function () {
            if (li.classList.contains("done")) return;
            li.classList.add("done");
            Array.prototype.forEach.call(opts.children, function (btn, idx) {
              btn.disabled = true;
              if (idx === item.a) btn.classList.add("right");
              else if (idx === oi) btn.classList.add("wrong");
              else btn.classList.add("mute");
            });
            if (oi === item.a) correct++;
            updateScore();
            try {
              localStorage.setItem(
                "ca-quiz:" + (location.pathname.split("/").pop() || "index.html"),
                JSON.stringify({ c: correct, t: questions.length })
              );
            } catch (e) { /* 存不上就算了 */ }
            ex.innerHTML = "<b>" + (oi === item.a ? "答对了。" : "差一点。") + "</b> " + item.why;
            maybeAllClear();
            try {
              document.dispatchEvent(new CustomEvent("ca:quiz", { detail: { ok: oi === item.a } }));
            } catch (e) { /* 老浏览器就跳过 */ }
          });
          opts.appendChild(b);
        });
        li.appendChild(opts);

        var ex = document.createElement("p");
        ex.className = "cq-ex";
        ex.setAttribute("aria-live", "polite");
        li.appendChild(ex);

        list.appendChild(li);
      });

      host.appendChild(list);
      updateScore();
    }
  };
})();

/* ---------- 全局增强：进度条 / 滚动浮现 / 快捷键速查 / 站宠小鳕 ---------- */
(function () {
  "use strict";
  var reduced = window.PrefersReducedMotion === true;

  /* 内容闪示：目标元素重放一次琥珀底光，标出"刚才的操作改了这里" */
  window.CAFlash = function (el) {
    if (!el || reduced) return;
    el.classList.remove("fx-flash");
    void el.offsetWidth;
    el.classList.add("fx-flash");
  };

  /* 阅读进度：顶部 2px 琥珀条 */
  var bar = document.createElement("div");
  bar.id = "ca-progress";
  document.body.appendChild(bar);
  function paintBar() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    bar.style.transform = "scaleX(" + (max > 0 ? Math.min(1, h.scrollTop / max) : 0) + ")";
  }
  window.addEventListener("scroll", paintBar, { passive: true });
  window.addEventListener("resize", paintBar);
  paintBar();

  /* 滚动浮现：只对当前视口外的区块加 .rv，首屏内容不闪 */
  if (!reduced && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("vis"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll("main section, .cost-demo, .evidence").forEach(function (el) {
      if (el.getBoundingClientRect().top > window.innerHeight * 0.92) {
        el.classList.add("rv");
        io.observe(el);
      }
    });
  }

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
      { no: "03", name: "权限沙箱 · 场景判定器", sub: "模式×审批×动作", href: P("labs/sandbox.html"), kw: "sandbox 权限 沙箱 seatbelt landlock wfp 判定 审批" },
      { name: "↳ CONFIG BRIDGE · 配置片段生成", sub: "", href: P("labs/sandbox.html") + "#cfg-panel", kw: "config toml 配置 cli 片段" },
      { no: "04", name: "协议线路 · 报文时间线", sub: "审批分支 · 双向通道", href: P("labs/appserver.html"), kw: "protocol json-rpc 协议 报文 thread turn item 挂起" },
      { no: "05", name: "Crate 图谱", sub: "135 成员 · 列表/树图", href: P("labs/atlas.html"), kw: "atlas crate 图谱 treemap 树图 workspace rust" },
      { no: "06", name: "术语速查 · 人话版", sub: "可检索", href: P("glossary.html"), kw: "glossary 术语 名词 解释" },
      { name: "↳ 自测模式 · 翻卡回忆", sub: "记得/忘了存档", href: P("glossary.html") + "#md=drill", kw: "flashcard drill 自测 记忆 翻卡 背题" },
      { no: "07", name: "深水区 A · 凭据流", sub: "ChatGPT vs API key", href: P("labs/deep.html") + "#mod-a", kw: "auth login 登录 凭据 token oauth auth.json api key" },
      { name: "深水区 B · 配置系统全貌", sub: "优先级阶梯", href: P("labs/deep.html") + "#mod-b", kw: "config toml profile 配置 优先级 覆盖" },
      { name: "深水区 C · apply_patch 解剖台", sub: "可编辑可应用", href: P("labs/deep.html") + "#mod-c", kw: "patch 补丁 apply diff hunk 锚点 格式" },
      { name: "深水区 D · TUI 后台", sub: "事件映射+斜杠命令", href: P("labs/deep.html") + "#mod-d", kw: "tui 终端 slash 命令 界面 渲染" },
      { name: "深水区 E · 扩展挂点地图", sub: "skills/hooks/memories", href: P("labs/deep.html") + "#mod-e", kw: "skill hook memory 扩展 插件 技能 记忆 钩子" },
      { act: "keys", no: "?", name: "快捷键速查", sub: "按 ? 也行", href: "", kw: "shortcut keyboard 键盘 快捷键 help 帮助" }
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
    }

    function run(i) {
      var c = shown[i];
      if (!c) return;
      close();
      if (c.act === "keys") { toggleKeys(true); return; }
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

  /* 站宠小鳕：cod 谐音鳕鱼。点它游一圈，顺带给一条真实有用的提示。 */
  var FISH =
    '<svg viewBox="0 0 46 40" aria-hidden="true">' +
    '<path class="cod-tail" d="M11 20 L2 12 L5.5 20 L2 28 Z" fill="#ffb454"/>' +
    '<path d="M9 20 Q19 7 31 12 Q42 16.5 42 20 Q42 23.5 31 28 Q19 33 9 20 Z" fill="#1b232c" stroke="#ffb454" stroke-width="2"/>' +
    '<path d="M21 13 L24.5 8 L28 12" stroke="#ffb454" stroke-width="1.6" fill="none"/>' +
    '<circle class="cod-eye" cx="33.5" cy="17.5" r="1.7" fill="#ffb454"/>' +
    '<path d="M14 22 Q20 25 26 22" stroke="rgba(255,180,84,.55)" stroke-width="1.3" fill="none"/>' +
    "</svg>";

  var TIPS = [
    "01 的滑杆能拖到任意一站反复看，<span class='kbd'>←</span><span class='kbd'>→</span> 也行。",
    "03 的全景矩阵格子可以点——点谁，上面的判定器就跳到哪个组合。",
    "04 播放到第 11 条会停下来等你裁决。批准和拒绝是两段不同的剧情。",
    "02 里把 AGENTS.md 四个目录位全打开，能看到触顶截断长什么样。",
    "05 试试搜 <b>mcp</b> 或 <b>cloud</b>，看成员怎么跨带分布。",
    "每页末尾的 CHECKPOINT 全部答对会盖 ALL CLEAR 徽章。",
    "正文里带虚线下划线的词，悬停或回车就有人话解释。",
    "每台仪器的状态写在地址栏里，刷新或分享链接都不丢。",
    "首页的回路图能悬停：琥珀点是请求出站，钢青点是事件回流。",
    "01 下方的 TURN SIMULATOR 能自己开一轮：运行中再插话，看 steer 怎么并入。",
    "成本对照上面有个小赌局——先猜缓存能省几倍，再拉滑杆对答案。"
  ];
  var tipIdx = -1;
  function nextTip() {
    tipIdx = (tipIdx + 1 + Math.floor(Math.random() * 2)) % TIPS.length;
    return TIPS[tipIdx];
  }

  var toast = document.createElement("div");
  toast.className = "cod-toast";
  toast.setAttribute("role", "status");
  document.body.appendChild(toast);
  var toastTimer = null;
  function showToast(html) {
    toast.innerHTML = html;
    toast.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 6200);
  }

  function swimOnce(done) {
    if (reduced) { done(); return; }
    var s = document.createElement("div");
    s.className = "cod-swim";
    s.innerHTML = FISH;
    document.body.appendChild(s);
    var t0 = null, DUR = 2400;
    var W = window.innerWidth + 140;
    function frame(ts) {
      if (t0 == null) t0 = ts;
      var p = Math.min(1, (ts - t0) / DUR);
      var ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      s.style.transform = "translateX(" + (ease * W) + "px) translateY(" + Math.sin(p * Math.PI * 3) * 10 + "px)";
      if (p < 1) requestAnimationFrame(frame);
      else s.remove();
    }
    requestAnimationFrame(frame);
    setTimeout(done, 500);
  }

  var pet = document.createElement("button");
  pet.type = "button";
  pet.className = "cod-pet";
  pet.setAttribute("aria-label", "站宠小鳕：点一下给条使用提示");
  pet.title = "小鳕 · 点我有提示";
  pet.innerHTML = FISH;
  pet.addEventListener("click", function () {
    var tip = nextTip();
    swimOnce(function () { showToast("<b>小鳕</b> · " + tip); });
  });
  document.body.appendChild(pet);

   /* 小彩蛋：连点七下，它承认自己是站宠 */
  var taps = 0, tapTimer = null;
  pet.addEventListener("click", function () {
    taps++;
    if (tapTimer) clearTimeout(tapTimer);
    tapTimer = setTimeout(function () { taps = 0; }, 1600);
    if (taps >= 7) {
      taps = 0;
      showToast("<b>小鳕</b> · 是，我是站宠。codex 词源是法典，跟鳕鱼没关系——但 cod 是鳕鱼，这站说了算。");
    }
  });

  /* 悬停气泡：小鳕冒一句短话，20 秒内不重复打扰 */
  var QUIPS = [
    "在看哪条线路？",
    "滑杆是可以倒着拖的。",
    "今天也想通关。",
    "别忘了我底下还藏着彩蛋。",
    "有工具调用才会转第二圈哦。",
    "累了就按 ? 歇一会儿。"
  ];
  var bubble = document.createElement("div");
  bubble.className = "cod-bubble";
  bubble.setAttribute("aria-hidden", "true");
  document.body.appendChild(bubble);
  var bubbleTimer = null, lastBubble = 0, quipIdx = Math.floor(Math.random() * QUIPS.length);
  function showBubble() {
    var now = Date.now();
    if (now - lastBubble < 20000) return;
    lastBubble = now;
    quipIdx = (quipIdx + 1) % QUIPS.length;
    bubble.textContent = QUIPS[quipIdx];
    bubble.classList.add("show");
    if (bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { bubble.classList.remove("show"); }, 3200);
  }
  pet.addEventListener("mouseenter", showBubble);
  pet.addEventListener("focus", showBubble);

  /* 闲置巡游：页面可见且用户半分钟没动，小鳕自己游一圈（不弹提示） */
  var lastActive = Date.now();
  function markActive() { lastActive = Date.now(); }
  ["pointerdown", "keydown", "wheel", "touchstart"].forEach(function (evName) {
    document.addEventListener(evName, markActive, { passive: true });
  });
  (function idleSwimLoop() {
    setTimeout(function () {
      if (!document.hidden && Date.now() - lastActive > 45000 && !reduced) {
        swimOnce(function () {});
      }
      idleSwimLoop();
    }, 50000 + Math.floor(Math.random() * 40000));
  })();

  /* 自检通关时，小鳕游过屏幕庆祝一下 */
  document.addEventListener("ca:allclear", function () {
    var done2 = false;
    swimOnce(function () {
      if (done2) return;
      done2 = true;
      showToast("<b>小鳕</b> · ALL CLEAR！这条线路通关了。五条都通的话，源码地图基本就是你的了。");
    });
    if (!reduced) setTimeout(swimOnce, 700);
  });

  /* 五条线路全部通关（仅首次达成时由首页广播）：双倍游庆祝 */
  document.addEventListener("ca:grandclear", function () {
    showToast("<b>小鳕</b> · 五条线路全部通关！从队列对到 WFP，这张地图现在归你了。");
    swimOnce(function () {});
    if (!reduced) setTimeout(function () { swimOnce(function () {}); }, 800);
  });

  /* 答题反馈：答对原地一蹦，答错往下一沉。不弹提示，别打断做题。 */
  var reactTimer = null;
  document.addEventListener("ca:quiz", function (ev) {
    if (reduced) return;
    var ok = !!(ev.detail && ev.detail.ok);
    pet.classList.remove("pet-happy", "pet-ouch");
    void pet.offsetWidth;
    pet.classList.add(ok ? "pet-happy" : "pet-ouch");
    if (reactTimer) clearTimeout(reactTimer);
    reactTimer = setTimeout(function () {
      pet.classList.remove("pet-happy", "pet-ouch");
    }, 900);
  });

  /* Web 字体就绪后重排一遍 SVG 文本：个别在回退字体下完成首排的节点，
     字体交换后不重新量宽，拉丁词会以零宽度消失（Chromium 实测）。 */
  function resvgTexts() {
    document.querySelectorAll("svg text").forEach(function (t) {
      var s = t.textContent;
      if (!s) return;
      t.textContent = "";
      t.textContent = s;
    });
  }
  if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
    document.fonts.ready.then(resvgTexts);
  } else {
    window.addEventListener("load", resvgTexts);
  }
})();
