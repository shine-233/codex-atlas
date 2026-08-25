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
  /* canvas 仪器四件套基座：建画布 / DPR 尺寸 / 离屏感知 / resize 防抖。
     七台 canvas 仪器原本各抄一遍这套样板——抽出来，新仪器直接用。
     opts: { draw:    必填，(重新)绘制一帧
             onResize: 尺寸变化后的额外回调（默认只调 draw）
             onInView: function(visible) 离屏/回屏通知（仪器拿来启停自己的循环）
             onVisibility: function(visible) 页签显隐通知 }
     返回 { canvas, ctx, size(), W(), H(), inView() }；
     size() 在宿主宽度 <4px（隐藏态）时返回 false，调用方据此跳过绘制。 */
  window.CACanvas = {
    create: function (host, opts) {
    opts = opts || {};
    /* opts.canvas 传入则收养已有画布（如 404 页 HTML 里写死的那个） */
    var canvas = opts.canvas || document.createElement("canvas");
    if (!opts.canvas) {
      canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
      host.appendChild(canvas);
    }
      var ctx = canvas.getContext("2d");
      if (!ctx) return null;
      var W = 1, H = 1, dpr = 1, inView = true, rzT = 0;
      function size() {
        var r = host.getBoundingClientRect();
        if (r.width < 4) return false;
        W = Math.max(1, Math.round(r.width));
        H = Math.max(1, Math.round(r.height));
        dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return true;
      }
      function onResize() {
        clearTimeout(rzT);
        rzT = setTimeout(function () {
          if (!size()) return;
          if (opts.onResize) opts.onResize();
          else if (opts.draw) opts.draw();
        }, 150);
      }
      window.addEventListener("resize", onResize);
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (ents) {
          ents.forEach(function (en) {
            inView = en.isIntersecting;
            if (inView) { size(); if (opts.draw) opts.draw(); }
            if (opts.onInView) opts.onInView(inView);
          });
        }, { rootMargin: "80px" }).observe(host);
      }
      document.addEventListener("visibilitychange", function () {
        if (opts.onVisibility) opts.onVisibility(!document.hidden);
      });
      return {
        canvas: canvas, ctx: ctx, size: size,
        W: function () { return W; },
        H: function () { return H; },
        inView: function () { return inView; }
      };
    }
  };

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
