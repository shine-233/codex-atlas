/* CODEX ATLAS — 就地术语卡（Page Previews 式）
   扫描 #main 正文，每个术语只在每页第一次出现处加虚线标记；
   悬停 / 键盘聚焦 / 点按时弹出人话解释卡。定义与 glossary.html 同源维护。 */
(function () {
  "use strict";

  var TERMS = [
    { v: ["SSE", "Server-Sent Events"], name: "SSE",
      d: "服务器往客户端单向推流的 HTTP 机制。模型的字是一个一个流回来的，底层就是它。",
      w: "01 第10–11站", href: "labs/loop.html" },
    { v: ["Responses API"], name: "Responses API",
      d: "OpenAI 的模型 HTTP 接口：Codex 每次采样都向它 POST 一次请求，然后逐条读回流。",
      w: "01 第10站", href: "labs/loop.html" },
    { v: ["base_instructions"], name: "base_instructions",
      d: "随 CLI 打包的模型身份指令（「你是 Codex CLI…」），七层负载的第 1 层。",
      w: "02 第1层", href: "labs/prompt.html" },
    { v: ["developer_instructions"], name: "developer_instructions",
      d: "你在 ~/.codex/config.toml 里写的可选指令层。放长期偏好；项目约定走 AGENTS.md。",
      w: "02 第4层", href: "labs/prompt.html" },
    { v: ["AGENTS.md", "AGENTS.override.md"], name: "AGENTS.md",
      d: "沿目录逐层读取的项目约定文件：越近的越具体，覆盖更通用的；总量受 32 KiB 默认上限。",
      w: "02 第5层", href: "labs/prompt.html" },
    { v: ["needs_follow_up"], name: "needs_follow_up",
      d: "「本轮还没完」的标记：只要出现工具调用就置 true，历史写回后再采样一圈。",
      w: "01 第11–13站", href: "labs/loop.html" },
    { v: ["TurnComplete"], name: "TurnComplete",
      d: "一轮任务正式结束的事件。看到它，这轮的账就结了。",
      w: "01 第13站", href: "labs/loop.html" },
    { v: ["run_turn"], name: "run_turn",
      d: "核心里负责「向模型要一次回复」的函数；每次被调前重新组装 Prompt、全量重发历史。",
      w: "01 第9站", href: "labs/loop.html" },
    { v: ["steer_input"], name: "steer_input",
      d: "把新输入汇进正在运行的那一轮：你的插话被并入，而不是排队等它跑完。",
      w: "01 第7站", href: "labs/loop.html" },
    { v: ["队列对"], name: "队列对",
      d: "Codex 核心的骨架：两条异步通道，一边收指令（Submission 进），一边吐事件（Event 出）。",
      w: "01 第6站", href: "labs/loop.html" },
    { v: ["Op::UserInput"], name: "Op::UserInput",
      d: "「用户说了一句话」在核心内部的指令类型表示。",
      w: "01 第6站 · 04", href: "labs/loop.html" },
    { v: ["Seatbelt"], name: "Seatbelt",
      d: "macOS 的沙箱强制机制：每条命令在按当前模式生成的 profile 规则下启动。",
      w: "03 macOS 一列", href: "labs/sandbox.html" },
    { v: ["Landlock"], name: "Landlock",
      d: "Linux 内核的文件树访问过滤机制，与 seccomp 搭配成 linux-sandbox 路线。",
      w: "03 Linux 一列", href: "labs/sandbox.html" },
    { v: ["seccomp"], name: "seccomp",
      d: "Linux 系统调用收窄机制：缩小进程能调用的内核接口面。",
      w: "03 Linux 一列", href: "labs/sandbox.html" },
    { v: ["WFP"], name: "WFP",
      d: "Windows Filtering Platform：Windows 上管网络流量的内核框架。",
      w: "03 Windows 一列", href: "labs/sandbox.html" },
    { v: ["MCP"], name: "MCP",
      d: "Model Context Protocol：给模型接外部工具的标准协议。注意：MCP 工具不在 Codex 沙箱管辖内。",
      w: "03 底部说明", href: "labs/sandbox.html" },
    { v: ["App Server", "AppServerTarget"], name: "App Server",
      d: "把 Codex 核心包成 JSON-RPC 服务的进程；IDE 插件、桌面 App、TUI 都是它的客户端。",
      w: "04 全篇", href: "labs/appserver.html" },
    { v: ["embedded"], name: "embedded 模式",
      d: "本地默认形态：App Server 与 TUI 跑在同一个进程里，但协议边界照在。",
      w: "01 第3站", href: "labs/loop.html" },
    { v: ["stdio JSONL", "JSONL"], name: "stdio JSONL",
      d: "主传输方式：标准输入输出上每行一条 JSON。简单、可调试。",
      w: "04", href: "labs/appserver.html" },
    { v: ["JSON-RPC"], name: "JSON-RPC",
      d: "双向消息协议：客户端能发请求，服务端也能发请求——审批就是反向请求的证据。",
      w: "04", href: "labs/appserver.html" },
    { v: ["Thread"], name: "Thread",
      d: "协议三原语之一：会话容器，可创建、恢复、分叉、归档。",
      w: "04 三原语表", href: "labs/appserver.html" },
    { v: ["Item"], name: "Item",
      d: "协议最小条目单位：用户消息、agent 回复、命令执行、审批请求……都是 Item。",
      w: "04 三原语表", href: "labs/appserver.html" },
    { v: ["rollout"], name: "rollout",
      d: "会话轨迹落盘机制：事件历史写成磁盘文件，断线恢复的数据基础。",
      w: "05 B2", href: "labs/atlas.html" },
    { v: ["crate"], name: "crate",
      d: "Rust 的编译单元，约等于一个包。135 个工作区成员就是 135 个 crate。",
      w: "05", href: "labs/atlas.html" },
    { v: ["codex exec"], name: "codex exec",
      d: "非交互一次性执行入口：codex exec \"任务\"。不进终端界面，CI 与脚本场景的主力形态。",
      w: "05 B1", href: "labs/atlas.html" },
    { v: ["apply_patch", "apply-patch"], name: "apply_patch",
      d: "特色补丁工具：模型输出的修改以补丁形式描述，由它落成真实的磁盘变更。",
      w: "05 B3", href: "labs/atlas.html" },
    { v: ["shell-escalation"], name: "shell-escalation",
      d: "审批升级流：沙箱内拿不到的权限，经你批准后换一种方式重跑。",
      w: "05 B3", href: "labs/atlas.html" },
    { v: ["execpolicy"], name: "execpolicy",
      d: "执行策略引擎：判定哪些命令属于安全白名单，可以免审批直接跑。",
      w: "05 B4", href: "labs/atlas.html" },
    { v: ["TUI"], name: "TUI",
      d: "Terminal UI，终端里的交互界面；正在重构为 App Server 的标准子进程客户端。",
      w: "01 第3站", href: "labs/loop.html" },
    { v: ["previous_response_id"], name: "previous_response_id",
      d: "官方 API 的会话续接参数；Codex 有意不用它，保持请求无状态以兼容零数据保留。",
      w: "01 第10站", href: "labs/loop.html" },
    { v: ["auto_compact_limit"], name: "auto_compact_limit",
      d: "token 总量超过阈值就自动压缩历史的开关，压缩走 /responses/compact。",
      w: "02 答疑表", href: "labs/prompt.html" },
    { v: ["tool spec", "ToolRouter"], name: "tool spec",
      d: "发给模型的可用工具说明书：名字与参数形状，模型照着决定调什么。",
      w: "CH02 第2层", href: "labs/prompt.html" },
    { v: ["token"], name: "token",
      d: "模型计费与计量的最小文本单位：一段话会被切成许多 token，输入和输出分开算账。",
      w: "01 成本对照 · 04 用量回传", href: "labs/loop.html" },
    { v: ["auth.json"], name: "auth.json",
      d: "~/.codex 下的凭据文件：ChatGPT 路线存 id/access/refresh 三件套，API key 路线存密钥本体。",
      w: "07 A 房", href: "labs/deep.html" },
    { v: ["profiles", "[profiles"], name: "profiles",
      d: "config.toml 里把一组键值打包命名的场景包，--profile 一键整套切换。",
      w: "07 B 房", href: "labs/deep.html" },
    { v: ["trust_level", "项目信任"], name: "项目信任",
      d: "第一次在某个目录启动会弹确认；点过的目录进 config 的 projects 表，之后免问。",
      w: "07 B 房", href: "labs/deep.html" },
    { v: ["/init", "/compact", "/approvals"], name: "斜杠命令",
      d: "TUI 客户端本地处理的输入命令（/init、/model、/compact…），根本不会发给模型。",
      w: "07 D 房", href: "labs/deep.html" }
  ];

  /* 词条里的 href 按根目录书写；在 labs/ 子页里要补一层前缀，
     否则「详见」和「全部术语」会解析成 labs/labs/... 打不开（历史 bug）。 */
  var IN_LABS = location.pathname.indexOf("/labs/") !== -1;
  function P(rel) { return (IN_LABS ? "../" : "") + rel; }

  /* 长词优先，避免 TurnComplete 被 Turn/Item 类短词截胡 */
  var ENTRIES = [];
  TERMS.forEach(function (t, i) {
    t.v.forEach(function (variant) {
      ENTRIES.push({ s: variant.toLowerCase(), idx: i, len: variant.length });
    });
  });
  ENTRIES.sort(function (a, b) { return b.len - a.len; });

  function isWordChar(ch) {
    return /[a-z0-9_$/]/i.test(ch);
  }

  function findInText(text) {
    var L = text.toLowerCase();
    for (var e = 0; e < ENTRIES.length; e++) {
      var en = ENTRIES[e];
      var start = 0, pos;
      while ((pos = L.indexOf(en.s, start)) !== -1) {
        var end = pos + en.s.length;
        var before = pos === 0 ? "\n" : L.charAt(pos - 1);
        var after = end >= L.length ? "\n" : L.charAt(end);
        if (!isWordChar(before) && !isWordChar(after)) {
          return { entry: en, start: pos, end: end };
        }
        start = pos + 1;
      }
    }
    return null;
  }

  function skippable(node) {
    var el = node.parentElement;
    while (el && el !== root) {
      var tag = el.tagName;
      if (tag === "A" || tag === "CODE" || tag === "PRE" || tag === "BUTTON" ||
          tag === "KBD" || tag === "SCRIPT" || tag === "STYLE" ||
          tag === "TEXTAREA" || tag === "SELECT" ||
          (el.classList && (el.classList.contains("ca-term") || el.classList.contains("noautolink")))) {
        return true;
      }
      el = el.parentElement;
    }
    return false;
  }

  /* ---------- 弹出卡片（单例） ---------- */
  var tip = document.createElement("div");
  tip.id = "ca-tip";
  tip.className = "ca-tip";
  tip.setAttribute("role", "tooltip");
  document.body.appendChild(tip);

  var currentTrigger = null;

  function showFor(el) {
    var t = TERMS[parseInt(el.getAttribute("data-t"), 10)];
    if (!t) return;
    tip.innerHTML =
      '<b class="tt-name">' + t.name + "</b>" +
      "<span>" + t.d + "</span>" +
      '<span class="tt-foot"><a href="' + P(t.href) + '">详见 ' + t.w + "</a>" +
      ' · <a href="' + P("glossary.html") + '">全部术语</a></span>';
    tip.classList.add("show");
    tip.style.left = "-9999px";
    tip.style.top = "-9999px";
    var r = el.getBoundingClientRect();
    var tw = tip.offsetWidth, th = tip.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    var left = r.left + r.width / 2 - tw / 2;
    left = Math.max(10, Math.min(vw - tw - 10, left));
    var top = r.bottom + 8;
    if (top + th > vh - 8) top = r.top - th - 8;
    tip.style.left = Math.round(left) + "px";
    tip.style.top = Math.round(Math.max(8, top)) + "px";
    el.setAttribute("aria-describedby", "ca-tip");
    currentTrigger = el;
  }

  function hide() {
    tip.classList.remove("show");
    if (currentTrigger) currentTrigger.removeAttribute("aria-describedby");
    currentTrigger = null;
  }

  tip.addEventListener("mouseenter", function () {});
  tip.addEventListener("mouseleave", hide);
  window.addEventListener("scroll", hide, { passive: true });
  window.addEventListener("resize", hide);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && currentTrigger) { hide(); currentTrigger.focus(); }
  });
  document.addEventListener("click", function (e) {
    if (currentTrigger && !tip.contains(e.target) &&
        !(e.target.classList && e.target.classList.contains("ca-term"))) hide();
  });

  /* ---------- 扫描正文，标记首次出现 ---------- */
  var root = document.getElementById("main");
  if (!root) return;

  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: function (node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      var p = node.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      var tag = p.tagName;
      if (tag === "H1" || tag === "H2" || tag === "H3") return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  var matched = {};
  var nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach(function (node) {
    if (skippable(node)) return;
    var hit = findInText(node.nodeValue);
    if (!hit) return;
    if (matched[hit.entry.idx]) return;
    matched[hit.entry.idx] = true;

    var text = node.nodeValue;
    var before = document.createTextNode(text.slice(0, hit.start));
    var mark = document.createElement("span");
    mark.className = "ca-term";
    mark.setAttribute("tabindex", "0");
    mark.setAttribute("data-t", hit.entry.idx);
    mark.textContent = text.slice(hit.start, hit.end);
    var after = document.createTextNode(text.slice(hit.end));

    node.parentNode.insertBefore(before, node);
    node.parentNode.insertBefore(mark, node);
    node.parentNode.insertBefore(after, node);
    node.parentNode.removeChild(node);

    mark.addEventListener("mouseenter", function () { showFor(mark); });
    mark.addEventListener("focus", function () { showFor(mark); });
    mark.addEventListener("blur", hide);
    mark.addEventListener("click", function (e) {
      e.stopPropagation();
      if (currentTrigger === mark) hide(); else showFor(mark);
    });
  });
})();
