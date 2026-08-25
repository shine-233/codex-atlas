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

  /* 主题：尽早应用，避免首帧闪错色 */
  try {
    var savedTheme = localStorage.getItem("ca-theme");
    if (savedTheme === "light") document.documentElement.setAttribute("data-theme", "light");
    else if (!savedTheme && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches)
      document.documentElement.setAttribute("data-theme", "light");
  } catch (e) { /* 忽略 */ }

  /* hash 状态：#s=3&x=1 形式的键值对读写 */
  window.PanelState = {
    read: function () {
      var out = {};
      var h = location.hash.replace(/^#/, "");
      if (!h) return out;
      h.split("&").forEach(function (kv) {
        var p = kv.split("=");
        if (!p[0]) return;
        /* 畸形转义（截断分享链接等）不让它炸掉整页初始化 */
        function dec(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
        out[dec(p[0])] = dec(p[1] || "");
      });
      return out;
    },
    write: function (obj) {
      /* 合并语义：同页多台仪器共用一个 hash，写入只动自己的键。
         传空串 = 显式清除该键（各仪器的 reset 都依赖这一点）。 */
      var cur = window.PanelState.read();
      Object.keys(obj).forEach(function (k) {
        if (obj[k] === "" || obj[k] == null) delete cur[k];
        else cur[k] = obj[k];
      });
      var parts = Object.keys(cur).map(function (k) {
        return encodeURIComponent(k) + "=" + encodeURIComponent(cur[k]);
      });
      var s = parts.length ? "#" + parts.join("&") : "";
      history.replaceState(null, "", location.pathname + location.search + s);
    }
  };

  /* 主题读取助手：canvas / SVG 从 token 取色，浅深主题共用一套绘制代码 */
  window.CATheme = {
    get: function (name, fallback) {
      try {
        var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return v || fallback;
      } catch (e) { return fallback; }
    },
    rgb: function (name, fallback) {
      var hex = this.get(name, "").replace("#", "");
      if (hex.length === 6) {
        return parseInt(hex.slice(0, 2), 16) + "," + parseInt(hex.slice(2, 4), 16) + "," + parseInt(hex.slice(4, 6), 16);
      }
      return fallback;
    },
    isLight: function () { return document.documentElement.getAttribute("data-theme") === "light"; }
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

      /* 重做本节：清空作答状态重来一遍（存档成绩会在重答时覆盖） */
      var redo = document.createElement("button");
      redo.type = "button";
      redo.className = "btn cq-redo";
      redo.textContent = "↺ 重做本节";
      redo.style.marginTop = "14px";
      redo.addEventListener("click", function () {
        correct = 0;
        allClearShown = false;
        updateScore();
        Array.prototype.forEach.call(list.querySelectorAll(".cq-item"), function (li) {
          li.classList.remove("done");
          var ex2 = li.querySelector(".cq-ex");
          if (ex2) ex2.innerHTML = "";
          Array.prototype.forEach.call(li.querySelectorAll(".cq-opt"), function (btn) {
            btn.disabled = false;
            btn.classList.remove("right", "wrong", "mute");
          });
        });
        Array.prototype.forEach.call(host.querySelectorAll(".cq-allclear"), function (b2) { b2.remove(); });
      });
      host.appendChild(redo);
    }
  };
})();

/* ---------- 全局增强：进度条 / 滚动浮现 / 快捷键速查 / 站宠小鳕 ---------- */
(function () {
  "use strict";
  var reduced = window.PrefersReducedMotion === true;

  /* ---------- 聚光导览引擎：CATour.start(steps)
     steps: [{ sel, title, text }]。聚光框 + 遮罩 + 步骤卡，←→ 翻页，Esc 退出。 ---------- */
  var tourLayer = null, tourIdx = 0, tourSteps = null, tourSpot = null;
  function tourClear() {
    if (tourLayer) { tourLayer.remove(); tourLayer = null; }
    tourSteps = null;
    window.removeEventListener("resize", tourPaint);
    window.removeEventListener("scroll", tourPaint, true);
    document.removeEventListener("keydown", tourKeys);
  }
  function tourPaint() {
    if (!tourSteps || !tourSpot) return;
    var st = tourSteps[tourIdx];
    var el = st.sel ? document.querySelector(st.sel) : null;
    if (!el) { tourNext(1); return; }
    var r = el.getBoundingClientRect();
    var pad = 10;
    tourSpot.style.top = (r.top - pad) + "px";
    tourSpot.style.left = (r.left - pad) + "px";
    tourSpot.style.width = (r.width + pad * 2) + "px";
    tourSpot.style.height = (r.height + pad * 2) + "px";
    var card = tourLayer.querySelector(".tour-card");
    var below = r.bottom + 16 + 190 < window.innerHeight;
    card.style.top = below ? (r.bottom + 16) + "px" : "";
    card.style.bottom = below ? "" : (window.innerHeight - r.top + 16) + "px";
    card.style.left = Math.max(12, Math.min(window.innerWidth - 372, r.left)) + "px";
  }
  function tourRender() {
    var st = tourSteps[tourIdx];
    tourPaint();
    var card = tourLayer.querySelector(".tour-card");
    card.innerHTML =
      '<div class="tc-step">' + (tourIdx + 1) + " / " + tourSteps.length + (st.badge ? " · " + st.badge : "") + "</div>" +
      "<h4>" + st.title + "</h4>" +
      "<p>" + st.text + "</p>" +
      '<div class="tc-nav">' +
      '<button type="button" class="btn" id="tour-prev"' + (tourIdx === 0 ? " disabled" : "") + ">◀ 上一步</button>" +
      '<button type="button" class="btn primary" id="tour-next">' + (tourIdx === tourSteps.length - 1 ? "完成 ✓" : "下一步 ▶") + "</button>" +
      "</div>";
    card.querySelector("#tour-prev").addEventListener("click", function () { tourNext(-1); });
    card.querySelector("#tour-next").addEventListener("click", function () {
      if (tourIdx === tourSteps.length - 1) tourClear();
      else tourNext(1);
    });
    if (st.sel) {
      var el = document.querySelector(st.sel);
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    }
  }
  function tourNext(d) {
    tourIdx = Math.max(0, Math.min(tourSteps.length - 1, tourIdx + d));
    tourRender();
  }
  function tourKeys(e) {
    if (e.key === "Escape") tourClear();
    else if (e.key === "ArrowRight") tourNext(1);
    else if (e.key === "ArrowLeft") tourNext(-1);
  }
  window.CATour = {
    start: function (steps) {
      if (!steps || !steps.length) return;
      tourClear();
      tourSteps = steps;
      tourIdx = 0;
      tourLayer = document.createElement("div");
      tourLayer.className = "tour-layer";
      tourLayer.innerHTML =
        '<div class="tour-spot"></div>' +
        '<div class="tour-card"></div>';
      document.body.appendChild(tourLayer);
      tourSpot = tourLayer.querySelector(".tour-spot");
      tourLayer.addEventListener("click", function (e) {
        if (e.target === tourLayer || e.target === tourSpot) tourClear();
      });
      document.addEventListener("keydown", tourKeys);
      window.addEventListener("resize", tourPaint);
      window.addEventListener("scroll", tourPaint, true);
      tourRender();
      if (window.CASound) CASound.play("pop");
    }
  };
  /* 页面在 load 前定义 window.CATOUR_STEPS 即自动获得「▶ 导览」按钮 */
  window.addEventListener("load", function () {
    if (typeof window.CATOUR_STEPS !== "object" || !window.CATOUR_STEPS.length) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tour-fab";
    btn.textContent = "▶ 导览";
    btn.title = "聚光导览：逐步介绍本页每台仪器（←→ 翻页，Esc 退出）";
    btn.setAttribute("aria-label", "开始本页聚光导览");
    btn.addEventListener("click", function () { window.CATour.start(window.CATOUR_STEPS); });
    document.body.appendChild(btn);
  });

  /* 内容闪示：目标元素重放一次琥珀底光，标出"刚才的操作改了这里" */
  window.CAFlash = function (el) {
    if (!el || reduced) return;
    el.classList.remove("fx-flash");
    void el.offsetWidth;
    el.classList.add("fx-flash");
  };

  /* ---------- 代码片段一键复制：给 pre 挂悬浮 ⧉ 按钮（Stripe 文档惯例） ---------- */
  window.CACopyAttach = function (pre) {
    if (!pre || pre.__caCopy) return;
    pre.__caCopy = true;
    var wrap = document.createElement("div");
    wrap.className = "ca-copywrap";
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ca-copybtn";
    btn.textContent = "⧉ 复制";
    btn.addEventListener("click", function () {
      var text = pre.textContent;
      function done() {
        btn.textContent = "已复制 ✓";
        if (window.CASound) CASound.play("pop");
        setTimeout(function () { btn.textContent = "⧉ 复制"; }, 1500);
      }
      function fallback() {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch (e) { /* 尽力而为 */ }
        ta.remove();
        done();
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else fallback();
    });
    wrap.appendChild(btn);
  };

  /* 聚光倾斜卡：指针进入时轻微 3D 倾斜，高光跟随光标（零依赖微交互）。
     触屏与 reduced-motion 环境自动跳过；配合 styles.css 的 ::after 高光层使用。 */
  window.CATilt = function (els) {
    try {
      if (reduced) return;
      if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return;
      Array.prototype.forEach.call(els, function (el) {
        if (el.__caTilt) return;
        el.__caTilt = true;
        el.addEventListener("pointermove", function (e) {
          var r = el.getBoundingClientRect();
          if (!r.width || !r.height) return;
          var x = (e.clientX - r.left) / r.width;
          var y = (e.clientY - r.top) / r.height;
          el.style.transform = "perspective(900px) rotateX(" + ((0.5 - y) * 2.2).toFixed(2) +
            "deg) rotateY(" + ((x - 0.5) * 3).toFixed(2) + "deg)";
          el.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
          el.style.setProperty("--my", (y * 100).toFixed(1) + "%");
          el.classList.add("ca-spot");
        });
        el.addEventListener("pointerleave", function () {
          el.style.transform = "";
          el.classList.remove("ca-spot");
        });
      });
    } catch (e) { /* 老浏览器跳过 */ }
  };

  /* SVG 地图手势：拖拽平移 · 滚轮缩放（锚定光标）· 双击复位。
     touch-action: pan-y —— 纵向滚动仍留给页面，横向拖拽归地图。 */
  window.CAPanZoom = function (host) {
    var svg = host.querySelector("svg");
    if (!svg || host.__caPz) return;
    host.__caPz = true;
    var base = null, vb = null;
    var dragging = false, lx = 0, ly = 0;

    function readBase() {
      if (base) return;   /* 基准只在首次捕获：之后 viewBox 被缩放也不能污染它 */
      var b = svg.viewBox.baseVal;
      base = [b.x, b.y, b.width, b.height];
      if (!vb) vb = base.slice();
    }
    function write() {
      svg.setAttribute("viewBox", vb[0] + " " + vb[1] + " " + vb[2] + " " + vb[3]);
    }
    function clamp() {
      var minW = base[2] * 0.3;
      if (vb[2] < minW) { vb[2] = minW; vb[3] = base[3] * (minW / base[2]); }
      if (vb[2] > base[2]) { vb[2] = base[2]; vb[3] = base[3]; }
      if (vb[0] < 0) vb[0] = 0;
      if (vb[1] < 0) vb[1] = 0;
      if (vb[0] + vb[2] > base[2]) vb[0] = base[2] - vb[2];
      if (vb[1] + vb[3] > base[3]) vb[1] = base[3] - vb[3];
    }
    function at(clientX, clientY) {
      var r = svg.getBoundingClientRect();
      return [(clientX - r.left) / r.width * vb[2] + vb[0],
              (clientY - r.top) / r.height * vb[3] + vb[1]];
    }

    host.addEventListener("wheel", function (e) {
      readBase();
      var k = e.deltaY < 0 ? 0.86 : 1.16;
      var p = at(e.clientX, e.clientY);
      var nw = Math.max(base[2] * 0.3, Math.min(base[2], vb[2] * k));
      var nk = nw / vb[2];
      vb[0] = p[0] - (p[0] - vb[0]) * nk;
      vb[1] = p[1] - (p[1] - vb[1]) * nk;
      vb[2] *= nk; vb[3] *= nk;
      clamp(); write();
      e.preventDefault();
    }, { passive: false });

    host.addEventListener("pointerdown", function (e) {
      readBase();
      dragging = true; lx = e.clientX; ly = e.clientY;
      host.style.cursor = "grabbing";
    });
    host.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var r = host.getBoundingClientRect();
      vb[0] -= (e.clientX - lx) / r.width * vb[2];
      vb[1] -= (e.clientY - ly) / r.height * vb[3];
      lx = e.clientX; ly = e.clientY;
      clamp(); write();
    });
    function up() { dragging = false; host.style.cursor = "grab"; }
    host.addEventListener("pointerup", up);
    host.addEventListener("pointercancel", up);
    host.addEventListener("dblclick", function () {
      readBase(); vb = base.slice(); write();
    });
    host.style.cursor = "grab";
    host.style.touchAction = "pan-y";
  };

  /* 彩纸：通关庆祝用。一次性 canvas，重力 + 旋转 + 淡出，结束自清理。 */
  window.CAConfetti = {
    fire: function (big) {
      if (reduced || !window.requestAnimationFrame) return;
      var cv = document.createElement("canvas");
      cv.className = "ca-confetti";
      cv.setAttribute("aria-hidden", "true");
      document.body.appendChild(cv);
      var ctx = cv.getContext("2d");
      if (!ctx) { cv.remove(); return; }
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
      ctx.scale(dpr, dpr);
      var COLORS = [CATheme.get("--amber", "#ffb454"), CATheme.get("--steel", "#8fc7e8"), CATheme.get("--ok", "#7bc98b"), CATheme.get("--ink", "#e7edf3"), CATheme.get("--deny", "#f0796a")];
      var pieces = [];
      var n = big ? 190 : 130;
      for (var i = 0; i < n; i++) {
        var fromLeft = i % 2 === 0;
        pieces.push({
          x: fromLeft ? -12 : innerWidth + 12,
          y: innerHeight * (0.55 + Math.random() * 0.3),
          vx: (fromLeft ? 1 : -1) * (5 + Math.random() * 7) * (big ? 1.15 : 1),
          vy: -(8 + Math.random() * 7),
          w: 5 + Math.random() * 6, h: 8 + Math.random() * 8,
          rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3,
          c: COLORS[(Math.random() * COLORS.length) | 0],
          life: 1
        });
      }
      var t0 = null;
      function step(ts) {
        if (t0 === null) t0 = ts;
        var el = ts - t0;
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        var alive = 0;
        for (var j = 0; j < pieces.length; j++) {
          var p = pieces[j];
          if (p.life <= 0) continue;
          alive++;
          p.vy += 0.22; p.vx *= 0.992;
          p.x += p.vx; p.y += p.vy; p.rot += p.vr;
          if (el > 1500) p.life -= 0.03;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.c;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
        if (alive > 0 && el < 4200) requestAnimationFrame(step);
        else cv.remove();
      }
      requestAnimationFrame(step);
    }
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

  /* 标题遮罩揭示：h1/h2 进入视口时从遮罩里升起来（SplitText 整块版）。
     只包一层 span，不拆字，中文换行不受影响；reduced-motion 与无 JS 环境保持静态。 */
  if (!reduced && "IntersectionObserver" in window) {
    var mrIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.querySelector(".ca-mr").classList.add("on");
          mrIO.unobserve(en.target);
        }
      });
    }, { rootMargin: "0px 0px -6% 0px" });
    Array.prototype.forEach.call(document.querySelectorAll("#main h1, #main h2"), function (h) {
      if (h.__caMr || h.closest(".no-mr")) return;
      /* 首页 hero h1 让给 fx.js 的弹性动力标题：遮罩的 overflow:hidden 会剪掉被斥开的字符 */
      if (h.tagName === "H1" && h.closest(".hero")) return;
      h.__caMr = true;
      var inner = document.createElement("span");
      inner.className = "ca-mr";
      while (h.firstChild) inner.appendChild(h.firstChild);
      h.appendChild(inner);
      h.classList.add("ca-mr-h");
      mrIO.observe(h);
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
      ["index.html", "loop.html", "prompt.html", "sandbox.html", "appserver.html", "atlas.html", "deep.html", "glossary.html"]
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
    var ALLPAGES = ["index.html", "loop.html", "prompt.html", "sandbox.html", "appserver.html", "atlas.html", "deep.html", "glossary.html"];
    var PNAME = {
      "loop.html": "01 循环回路", "prompt.html": "02 输入组装", "sandbox.html": "03 权限沙箱",
      "appserver.html": "04 协议线路", "atlas.html": "05 Crate 图谱", "deep.html": "07 深水区"
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
        showToast("<b>小鳕</b> · 档案进剪贴板了。贴到备忘录里就能带走。");
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
      ["appserver.html", "04 协议线路"], ["atlas.html", "05 Crate 图谱"], ["deep.html", "07 深水区"]
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
        "labs/appserver.html", "labs/atlas.html", "labs/deep.html", "glossary.html"];
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
      { no: "03", name: "权限沙箱 · 场景判定器", sub: "模式×审批×动作", href: P("labs/sandbox.html"), kw: "sandbox 权限 沙箱 seatbelt landlock wfp 判定 审批" },
      { name: "↳ CONFIG BRIDGE · 配置片段生成", sub: "", href: P("labs/sandbox.html") + "#cfg-panel", kw: "config toml 配置 cli 片段" },
      { name: "↳ SANDBOX YARD · 空间沙盘", sub: "围墙在哪，包往哪走", href: P("labs/sandbox.html") + "#yard-panel", kw: "yard 沙盘 围墙 空间 可视化 fence" },
      { name: "↳ MCP DETOUR · 双路径对比", sub: "内置穿墙 / MCP 绕墙", href: P("labs/sandbox.html") + "#mcp-lane-panel", kw: "mcp detour 双路径 rmcp 绕墙 外部服务器" },
      { no: "04", name: "协议线路 · 报文时间线", sub: "审批分支 · 双向通道", href: P("labs/appserver.html"), kw: "protocol json-rpc 协议 报文 thread turn item 挂起" },
      { no: "05", name: "Crate 图谱", sub: "135 成员 · 列表/树图", href: P("labs/atlas.html"), kw: "atlas crate 图谱 treemap 树图 workspace rust" },
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
    "成本对照上面有个小赌局——先猜缓存能省几倍，再拉滑杆对答案。",
    "右下角的 ♪ 打开后，盖章、答对、通关都会响。默认是关的，不打扰。",
    "左栏底部有「学习档案」：自检成绩和翻卡进度都在里面，能导出也能一键清空。",
    "03 底部那个审批弹窗是真的能点的——批准一次、本轮允许和拒绝，给的结果各不相同。",
    "03 的沙盘把围墙画了出来：换动作看命令包走位，撞墙、等签字、穿墙，全是活的。",
    "02 答疑表下面有个 compact 演示：拖到触顶，亲眼看历史被压成一段加密摘要。",
    "04 新增 ACT III：rollout 文件逐行点开看，文件名生成器能演示回滚线程怎么命名。",
    "07E 的 hooks 事件轴有 8 个实测事件名——session_start 到 session_end，点着看挂点。"
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

  /* 抓起来扔：按住拖走是拎着，甩出去带惯性，撞墙反弹，落定后自己游回角落。
     纯手写抛体物理（重力 + 恢复系数 + 地面摩擦），不碰任何既有行为：
     轻点仍是提示、连点仍是彩蛋（拖过的 click 在捕获阶段吃掉）。 */
  (function () {
    if (reduced || !window.PointerEvent) return;
    var mode = "idle";          /* idle | press | hold | fly | home */
    var homeX = -1, homeY = -1;
    var px = 0, py = 0, offX = 0, offY = 0, fw = 46, fh = 40;
    var samples = [], suppressClick = false, flyRaf = 0, flyT0 = 0, thrown = 0;
    try { thrown = parseInt(localStorage.getItem("ca-pet-flings") || "0", 10) || 0; } catch (e) { }

    /* 拖过之后再放手的这次 click 不是「点」，捕获阶段拦掉，别误触提示 */
    pet.addEventListener("click", function (e) {
      if (!suppressClick) return;
      suppressClick = false;
      e.stopImmediatePropagation();
      e.preventDefault();
    }, true);

    function rememberHome() {
      if (homeX >= 0) return;
      var r = pet.getBoundingClientRect();
      homeX = r.left; homeY = r.top; fw = r.width || 46; fh = r.height || 40;
    }
    function place(x, y) {
      pet.style.right = "auto"; pet.style.bottom = "auto";
      pet.style.left = Math.round(x) + "px";
      pet.style.top = Math.round(y) + "px";
    }
    function velFromSamples() {
      var now = performance.now(), a = null, b = null;
      var i = samples.length - 1;
      for (; i >= 0; i--) {
        if (now - samples[i].t <= 110) { b = samples[i]; continue; }
        break;
      }
      if (!b) b = samples[samples.length - 1];
      for (i = 0; i < samples.length; i++) {
        if (now - samples[i].t <= 110) { a = samples[i]; break; }
      }
      if (!a || !b || b.t === a.t) return { vx: 0, vy: 0 };
      var dt = (b.t - a.t) / 1000;
      return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
    }

    pet.addEventListener("pointerdown", function (e) {
      if (mode === "fly") { catchMidair(e); return; }
      if (mode !== "idle" || (e.button !== undefined && e.button > 0)) return;
      homeX = -1; homeY = -1;   /* 每次抓取都重测家：窗口 resize 后 right/bottom 锚点会移动 */
      rememberHome();
      mode = "press";
      px = homeX; py = homeY;
      offX = e.clientX - homeX; offY = e.clientY - homeY;
      samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
      try { pet.setPointerCapture(e.pointerId); } catch (err) { }
    });

    pet.addEventListener("pointermove", function (e) {
      if (mode !== "press" && mode !== "hold") return;
      var nx = e.clientX - offX, ny = e.clientY - offY;
      if (mode === "press") {
        if (Math.abs(nx - px) + Math.abs(ny - py) < 7) return;
        mode = "hold";
        pet.classList.add("cod-hold");
        pet.style.transform = "rotate(0deg)";
        place(px, py);
      }
      px = Math.min(Math.max(nx, -fw), window.innerWidth);
      py = Math.min(Math.max(ny, -fh), window.innerHeight + fh);
      place(px, py);
      samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (samples.length > 8) samples.shift();
    });

    function release() {
      if (mode !== "press" && mode !== "hold") return;
      var wasHold = mode === "hold";
      mode = "idle";
      pet.classList.remove("cod-hold");
      if (!wasHold) return;
      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 240);   /* 兜底：别把下一次真点击吃掉 */
      var v = velFromSamples();
      startFly(px, py, v.vx * 0.9, v.vy * 0.9);
    }
    pet.addEventListener("pointerup", release);
    pet.addEventListener("pointercancel", release);

    /* 飞行中被接住：就地拎着继续玩 */
    function catchMidair(e) {
      cancelAnimationFrame(flyRaf);
      mode = "hold";
      pet.classList.add("cod-hold");
      rememberHome();
      offX = fw / 2; offY = fh / 2;
      px = e.clientX - offX; py = e.clientY - offY;
      place(px, py);
      samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
      try { pet.setPointerCapture(e.pointerId); } catch (err) { }
    }

    function startFly(x, y, vx, vy) {
      mode = "fly";
      flyT0 = performance.now();
      var sp = Math.sqrt(vx * vx + vy * vy), MAXV = 2100;
      if (sp > MAXV) { vx *= MAXV / sp; vy *= MAXV / sp; }
      var spin = 0, last = flyT0;
      var G = 2600, REST = 0.58;

      function step(ts) {
        var dt = Math.min(0.032, (ts - last) / 1000);
        last = ts;
        vy += G * dt;
        x += vx * dt; y += vy*dt;
        var W = window.innerWidth, H = window.innerHeight, bw = W - fw - 4, bh = H - fh - 4;
        if (x < 4) { x = 4; vx = -vx * REST; }
        else if (x > bw) { x = bw; vx = -vx * REST; }
        var floorHit = false;
        if (y < 4) { y = 4; vy = -vy * REST; }
        else if (y > bh) { y = bh; vy = -vy * REST * 0.72; vx *= 0.94; floorHit = true; }
        spin += vx * dt * 0.22;
        pet.style.transform = "rotate(" + Math.max(-26, Math.min(26, spin)) + "deg)";
        place(x, y);
        var still = Math.abs(vx) < 60 && Math.abs(vy) < 90 && floorHit;
        var timedOut = ts - flyT0 > 6000;
        if (!still && !timedOut) { flyRaf = requestAnimationFrame(step); return; }
        settle(x, y);
      }
      flyRaf = requestAnimationFrame(step);

      thrown++;
      if (thrown === 3) {
        try { localStorage.setItem("ca-pet-flings", "3"); } catch (e) { }
        showToast("<b>小鳕</b> · 行吧，鳍练出来了。轻点是提示，拖住才是起飞。");
      } else if (thrown < 3) {
        try { localStorage.setItem("ca-pet-flings", String(thrown)); } catch (e) { }
      }
    }

    function settle(x, y) {
      cancelAnimationFrame(flyRaf);
      mode = "home";
      pet.style.transform = "rotate(0deg)";
      place(x, y);
      setTimeout(function () { swimBack(); }, 850);
    }

    function swimBack() {
      var sx = parseFloat(pet.style.left) || homeX;
      var sy = parseFloat(pet.style.top) || homeY;
      var t0 = null, DUR = 780;
      function frame(ts) {
        if (t0 == null) t0 = ts;
        var p = Math.min(1, (ts - t0) / DUR);
        var ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        var cx = sx + (homeX - sx) * ease;
        var cy = sy + (homeY - sy) * ease - Math.sin(p * Math.PI) * 26;
        place(cx, cy);
        pet.style.transform = "rotate(" + (Math.sin(p * Math.PI * 4) * 5).toFixed(1) + "deg)";
        if (p < 1 && mode === "home") { requestAnimationFrame(frame); return; }
        /* 回家：清掉内联样式，交还给 right/bottom 锚定 */
        mode = "idle";
        pet.style.cssText = "";
        pet.style.touchAction = "none";
        pet.classList.remove("pet-happy");
        void pet.offsetWidth;
        pet.classList.add("pet-happy");
        setTimeout(function () { pet.classList.remove("pet-happy"); }, 900);
      }
      if (reduced) { mode = "idle"; pet.style.cssText = ""; pet.style.touchAction = "none"; return; }
      requestAnimationFrame(frame);
    }

    pet.style.touchAction = "none";
    pet.title = "小鳕 · 点我有提示 · 抓住可以扔";
  })();

  /* 悬停气泡：小鳕冒一句短话，20 秒内不重复打扰 */
  var QUIPS = [
    "在看哪条线路？",
    "滑杆是可以倒着拖的。",
    "今天也想通关。",
    "别忘了我底下还藏着彩蛋。",
    "有工具调用才会转第二圈哦。",
    "累了就按 ? 歇一会儿。",
    "♪ 开了的话，我游泳也有水泡声。"
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

  /* 彩蛋：连打 codex 五个键，鱼群出动（输入框里打字不触发） */
  (function () {
    if (reduced) return;
    var buf = "", lastFire = 0;
    document.addEventListener("keydown", function (e) {
      var tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!e.key || e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).slice(-5);
      if (buf !== "codex" || Date.now() - lastFire < 8000) return;
      lastFire = Date.now();
      buf = "";
      for (var i = 0; i < 6; i++) {
        (function (i) {
          setTimeout(function () {
            var s = document.createElement("div");
            s.className = "cod-swim";
            s.innerHTML = FISH;
            s.style.opacity = String(0.5 + 0.5 * Math.random());
            document.body.appendChild(s);
            var t0 = null, DUR = 1900 + Math.random() * 1300;
            var amp = 6 + Math.random() * 16, ph = Math.random() * 6.28, sp = 0.72 + Math.random() * 0.9;
            var W2 = window.innerWidth + 140;
            function frame(ts) {
              if (t0 == null) t0 = ts;
              var p = Math.min(1, (ts - t0) / DUR);
              var ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
              s.style.transform = "translateX(" + (ease * W2 * sp).toFixed(1) + "px) translateY(" +
                (Math.sin(p * Math.PI * 3 + ph) * amp).toFixed(1) + "px)";
              if (p < 1) requestAnimationFrame(frame);
              else s.remove();
            }
            requestAnimationFrame(frame);
          }, i * 170);
        })(i);
      }
      showToast("<b>小鳕</b> · 呼叫鱼群——全员出动！这个暗号都让你摸出来了。");
      if (window.CASound) CASound.play("grand");
    });
  })();

  /* 自检通关时，小鳕游过屏幕庆祝一下 + 一把彩纸 */
  document.addEventListener("ca:allclear", function () {
    CAConfetti.fire(false);
    var done2 = false;
    swimOnce(function () {
      if (done2) return;
      done2 = true;
      showToast("<b>小鳕</b> · ALL CLEAR！这条线路通关了。五条都通的话，源码地图基本就是你的了。");
    });
    if (!reduced) setTimeout(swimOnce, 700);
  });

  /* 五条线路全部通关（仅首次达成时由首页广播）：双倍游 + 大把彩纸 */
  document.addEventListener("ca:grandclear", function () {
    showToast("<b>小鳕</b> · 五条线路全部通关！从队列对到 WFP，这张地图现在归你了。");
    CAConfetti.fire(true);
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

  /* 眼神跟随光标：只动 cx/cy 属性，不碰 transform——眨眼动画走的是
     transform 轨道，两条轨道互不覆盖。悬停设备 + 未开减动效才启用。 */
  (function () {
    var CAN_HOVER = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!CAN_HOVER || reduced) return;
    var eye = pet.querySelector(".cod-eye");
    if (!eye) return;
    var BX = parseFloat(eye.getAttribute("cx")), BY = parseFloat(eye.getAttribute("cy"));
    var raf = 0, tx = BX, ty = BY;
    document.addEventListener("pointermove", function (e) {
      var r = pet.getBoundingClientRect();
      /* 以鳕鱼身体中心为原点，把光标方向压进 1.3px 的瞳孔活动半径 */
      var ox = e.clientX - (r.left + r.width * 0.72);
      var oy = e.clientY - (r.top + r.height * 0.44);
      var d = Math.sqrt(ox * ox + oy * oy) || 1;
      var k = Math.min(1.3, d / 40) / d;
      tx = BX + ox * k; ty = BY + oy * k;
      if (!raf) {
        raf = requestAnimationFrame(function () {
          raf = 0;
          eye.setAttribute("cx", tx.toFixed(2));
          eye.setAttribute("cy", ty.toFixed(2));
        });
      }
    }, { passive: true });
  })();

  /* 全站速通收尾反应：按成绩说话，答得差就把最弱的那条线路指出来 */
  document.addEventListener("ca:speedrun", function (ev) {
    var d = ev.detail || {};
    var correct = d.correct || 0, total = d.total || 8;
    var LINE_NAMES = { "loop.html": "01 循环回路", "prompt.html": "02 输入组装",
      "sandbox.html": "03 权限沙箱", "appserver.html": "04 协议线路", "atlas.html": "05 Crate 图谱" };
    var weakest = null, worst = 2;
    try {
      var rec = window.CAProgress ? CAProgress.read() : {};
      Object.keys(LINE_NAMES).forEach(function (k) {
        if (rec[k] && rec[k].t) {
          var ratio = rec[k].c / rec[k].t;
          if (ratio < worst) { worst = ratio; weakest = LINE_NAMES[k]; }
        } else if (worst > 0) { worst = -1; weakest = LINE_NAMES[k] + "（还没做过自检）"; }
      });
    } catch (e) { /* 读不到进度就不点名 */ }
    var line;
    if (correct >= total) line = correct + "/" + total + "，满分收工。这站的出题人已经没什么可教你的了——去读真源码吧。";
    else if (correct * 2 >= total) line = correct + "/" + total + "，底子有了。" + (weakest ? "最不稳的是「" + weakest + "」，去把它的自检补完再回来。" : "五条线路的自检都过一遍，成绩还会涨。");
    else line = correct + "/" + total + "。别急，" + (weakest ? "先把「" + weakest + "」的自检补齐，再回来速通。" : "把五条线路的自检做完再来，成绩会不一样。");
    if (correct >= total) CAConfetti.fire(false);
    swimOnce(function () { showToast("<b>小鳕</b> · " + line); });
  });

  /* 升级播报：称号变了小鳕来报。ca-level 首次写入不播——老玩家回来
     不想被「恭喜升到路过」糊脸，只播之后真实发生的升级。 */
  (function () {
    var lvNow = caLevel(caXP());
    var prev = null;
    try { prev = localStorage.getItem("ca-level"); } catch (e) { /* 忽略 */ }
    if (prev === null) {
      try { localStorage.setItem("ca-level", String(lvNow)); } catch (e) { /* 忽略 */ }
      return;
    }
    if (lvNow > Number(prev)) {
      try { localStorage.setItem("ca-level", String(lvNow)); } catch (e) { /* 忽略 */ }
      CAConfetti.fire(false);
      swimOnce(function () {
        showToast("<b>小鳕</b> · 升级！称号「" + XP_LEVELS[lvNow][1] + "」。XP 只算你真做过的事：自检、翻卡、速通、足迹。");
      });
    }
  })();

  /* 主题切换钮：持久化 ca-theme，刷新一次让 canvas/SVG 按新色重绘 */
  (function () {
    var tbtn = document.createElement("button");
    tbtn.type = "button";
    tbtn.className = "theme-toggle";
    function paintTheme() {
      var light = document.documentElement.getAttribute("data-theme") === "light";
      tbtn.textContent = light ? "\u263E" : "\u2600";
      tbtn.setAttribute("aria-pressed", light ? "true" : "false");
      tbtn.setAttribute("aria-label", light ? "切回深色主题" : "切换浅色图纸主题");
      tbtn.title = light ? "切回深色主题" : "浅色图纸主题（会刷新一次页面）";
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", light ? "#f0ece1" : "#101418");
    }
    paintTheme();
    tbtn.addEventListener("click", function (e) {
      var light = document.documentElement.getAttribute("data-theme") === "light";
      try { localStorage.setItem("ca-theme", light ? "dark" : "light"); } catch (err) { /* 忽略 */ }
      var swap = function () {
        if (light) document.documentElement.removeAttribute("data-theme");
        else document.documentElement.setAttribute("data-theme", "light");
        paintTheme();
      };
      /* 圆形揭示（View Transitions）：从按钮中心扩散换肤，播完再刷新一次
         让 canvas/SVG 仪器按新色重绘。不支持/减动效 → 原地换 + 立即刷新。 */
      var reduce = window.PrefersReducedMotion === true;
      var rect = tbtn.getBoundingClientRect();
      var x = (e.clientX || rect.left + rect.width / 2);
      var y = (e.clientY || rect.top + rect.height / 2);
      if (!reduce && document.startViewTransition) {
        document.documentElement.classList.add("theme-vt");
        var vt = document.startViewTransition(swap);
        vt.ready.then(function () {
          var r = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y));
          document.documentElement.animate(
            { clipPath: [
                "circle(0px at " + x + "px " + y + "px)",
                "circle(" + r + "px at " + x + "px " + y + "px)"
              ] },
            { duration: 560, easing: "ease-in-out",
              pseudoElement: "::view-transition-new(root)" });
        }).catch(function () { /* 揭示被打断就算了 */ });
        vt.finished.finally(function () {
          document.documentElement.classList.remove("theme-vt");
          setTimeout(function () { location.reload(); }, 140);
        }).catch(function () { /* 打断时 finally 已兜底，这里只吞掉拒绝 */ });
      } else {
        swap();
        setTimeout(function () { location.reload(); }, 60);
      }
    });
    document.body.appendChild(tbtn);
  })();

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

  /* ---------- 可拖数字（scrubbable number，Bret Victor Tangle 手法）----------
     按住左右拖改值；指针捕获保证拖出元素仍持续生效；键盘可达；
     touch-action:none 把横向手势留给数值、竖向滚动留给页面。 */
  window.CAScrub = {
    make: function (el, o) {
      if (!el || !o || !o.onInput) return;
      el.classList.add("ca-scrub");
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
      el.setAttribute("role", "slider");
      el.setAttribute("aria-label", o.label || "左右拖动调整数值");
      var val = o.value;
      function clamp(v) {
        v = Math.max(o.min, Math.min(o.max, v));
        if (o.step) v = Math.round(v / o.step) * o.step;
        return Math.round(v * 100) / 100;
      }
      function paint() {
        el.textContent = o.fmt ? o.fmt(val) : val;
        el.setAttribute("aria-valuenow", val);
        el.setAttribute("aria-valuemin", o.min);
        el.setAttribute("aria-valuemax", o.max);
        el.setAttribute("aria-valuetext", el.textContent);
      }
      function commit(nv) {
        if (nv === val) return;
        val = nv; paint(); o.onInput(val);
        if (window.CASound) CASound.play("click");
      }
      var sx = 0, pid = null;
      el.addEventListener("pointerdown", function (e) {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        sx = e.clientX; pid = e.pointerId;
        try { el.setPointerCapture(pid); } catch (err) { /* 忽略 */ }
        e.preventDefault();
      });
      el.addEventListener("pointermove", function (e) {
        if (pid === null || e.pointerId !== pid) return;
        var per = o.dragStep || o.keyStep || o.step || 1;
        commit(clamp(val + (e.clientX - sx) / 6 * per));   /* 每 6px 走一步 */
        sx = e.clientX;
      });
      function up(e) { if (e.pointerId === pid) pid = null; }
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("keydown", function (e) {
        var st = o.keyStep || o.step || 1;
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") { commit(clamp(val - st)); e.preventDefault(); }
        else if (e.key === "ArrowRight" || e.key === "ArrowUp") { commit(clamp(val + st)); e.preventDefault(); }
      });
      paint();
    }
  };
})();
