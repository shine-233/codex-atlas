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
      el.title = "编号：00 总览 · 01–05 五条线路 · 06 术语速查";
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
    "首页的回路图能悬停：琥珀点是请求出站，钢青点是事件回流。"
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
