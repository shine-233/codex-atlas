/* CODEX ATLAS — 信号回路示波器（签名元素）
   在指定容器里渲染一圈 Agent 循环电路：琥珀点顺时针=请求出站，
   钢青点逆时针=SSE 事件回流。prefers-reduced-motion 时静止显示。
   opts.interactive 时站点可悬停/聚焦/点击，配合 onHover / onLeave 回调。
   标签布局：自动放在走线外侧（上/下边→上下外侧堆叠；左右侧→左右外侧），
   避免互相碰撞与越界截断；可用站点级 dx / dy / anchor 微调。 */
(function () {
  
  var C = window.CATheme || { get: function (n, f) { return f; } };
  var C_BG0 = C.get("--bg0", C_BG0);
  var C_LINE = C.get("--line", C_LINE);
  var C_LINE_STRONG = C.get("--line-strong", C_LINE_STRONG);
  var C_GRID = C.get("--line", C_GRID);
  var C_AMBER = C.get("--amber", C_AMBER);
  var C_STEEL = C.get("--steel", C_STEEL);
  var C_INK = C.get("--ink", C_INK);
  var C_FAINT = C.get("--faint", C_FAINT);
  var C_DIM = C.get("--dim", C_DIM);
"use strict";

  var NS = "http://www.w3.org/2000/svg";

  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  /* 站点沿矩形回路顺时针分布，f 为周长占比 */
  var DEFAULT_STATIONS = [
    { f: 0.13, label: "Responses API", sub: "POST · SSE", color: "steel" },
    { f: 0.31, label: "run_turn 采样", sub: "core/src/session", color: "amber" },
    { f: 0.49, label: "工具 · 沙箱执行", sub: "tools → sandboxing", color: "amber" },
    { f: 0.63, label: "历史写回", sub: "needs_follow_up", color: "amber" },
    { f: 0.81, label: "App Server 队列", sub: "Op::UserInput", color: "steel" },
    { f: 0.94, label: "TUI 输入", sub: "codex-rs/tui", color: "steel" }
  ];

  /* 估算文本宽度：CJK 按 1 个字宽，拉丁按约半个字宽 */
  function estTextWidth(text, fs) {
    var w = 0;
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      w += c > 0x2e7f ? fs : fs * 0.55;
    }
    return w;
  }

  function mount(host, opts) {
    opts = opts || {};
    var W = opts.width || 720;
    var H = opts.height || 300;
    var labeled = !!opts.labels;
    var rx = 34;
    var stations = opts.stations || DEFAULT_STATIONS;

    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H,
      role: "img",
      "aria-label": "Agent 循环回路示意图：请求经 App Server 进入采样循环，调用模型与工具后把结果写回历史",
      preserveAspectRatio: "xMidYMid meet"
    });
    svg.style.display = "block";
    svg.style.width = "100%";
    svg.style.height = "auto";

    var padX = labeled ? 96 : Math.max(18, Math.min(60, W * 0.18));
    var padY = labeled ? 56 : Math.max(16, Math.min(40, H * 0.26));
    var tx = padX, ty = padY;
    var tw = W - padX * 2, th = H - padY * 2;

    /* 底层网格刻度 */
    if (!opts.plain) {
      var grid = el("g", { stroke: C_GRID, "stroke-width": "1" });
      for (var gx = tx; gx <= tx + tw; gx += tw / 12) {
        grid.appendChild(el("line", { x1: gx, y1: ty - 18, x2: gx, y2: ty + th + 18, "stroke-dasharray": "1 7" }));
      }
      svg.appendChild(grid);
    }

    /* 主回路走线（非 plain 模式加一道极淡的琥珀底光，让电路有通电感） */
    if (!opts.plain) {
      svg.appendChild(el("rect", {
        x: tx, y: ty, width: tw, height: th, rx: rx, ry: rx,
        fill: "none",
        stroke: "rgba(255,180,84,.07)",
        "stroke-width": "6"
      }));
    }
    var trace = el("rect", {
      x: tx, y: ty, width: tw, height: th, rx: rx, ry: rx,
      fill: "none",
      stroke: C_LINE_STRONG,
      "stroke-width": "1.6"
    });
    svg.appendChild(trace);
    host.appendChild(svg); /* 先挂进 DOM，getTotalLength 才有几何 */
    host.classList.add("loopscope-wrap");
    var ticks = el("g", {});
    var L2 = 0;
    try {
      L2 = trace.getTotalLength();
      var step = labeled ? 46 : 64;
      for (var d = 0; d < L2; d += step) {
        var p = trace.getPointAtLength(d);
        var q = trace.getPointAtLength(Math.min(L2, d + 3));
        var dx = q.x - p.x, dy = q.y - p.y;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var nx = -dy / len, ny = dx / len;
        ticks.appendChild(el("line", {
          x1: p.x + nx * 4, y1: p.y + ny * 4,
          x2: p.x + nx * 9, y2: p.y + ny * 9,
          stroke: C_LINE, "stroke-width": "1"
        }));
        ticks.appendChild(el("line", {
          x1: p.x - nx * 4, y1: p.y - ny * 4,
          x2: p.x - nx * 9, y2: p.y - ny * 9,
          stroke: C_LINE, "stroke-width": "1"
        }));
      }
    } catch (e) { /* getTotalLength 不可用时静默跳过装饰 */ }
    svg.appendChild(ticks);

    /* 站点（interactive 时包一层 <a>，可聚焦可点击） */
    var stationNodes = [];
    stations.forEach(function (st) {
      if (!L2) return;
      var pt = trace.getPointAtLength(st.f * L2);
      var c = st.color === "amber" ? C_AMBER : C_STEEL;
      var g = el("g", opts.interactive ? { class: "ls-station" } : {});
      if (opts.interactive) {
        g.setAttribute("tabindex", "0");
        g.setAttribute("role", "link");
      }
      if (st.href) g.setAttribute("data-href", st.href);

      var ring = el("circle", {
        class: "ls-ring",
        cx: pt.x, cy: pt.y, r: labeled ? 5 : 4,
        fill: C_BG0, stroke: c, "stroke-width": "1.6",
        style: "transition:r .15s;"
      });
      g.appendChild(ring);
      g.appendChild(el("circle", {
        cx: pt.x, cy: pt.y, r: labeled ? 1.8 : 1.4, fill: c
      }));
      /* 命中区：透明大圆保证手指/鼠标好点 */
      g.appendChild(el("circle", {
        cx: pt.x, cy: pt.y, r: labeled ? 26 : 16,
        fill: "transparent", stroke: "none"
      }));

      /* 标签：默认放在走线外侧，避免碰撞与越界；站点可用 dx/dy/anchor 覆盖 */
      if (labeled && !(opts.interactive && st.tipOnly)) {
        /* 判断主导轴：离中心更远的那条轴是所在边 */
        var verticalEdge = Math.abs(pt.y - (ty + th / 2)) > Math.abs(pt.x - (tx + tw / 2));
        /* 外侧方向：顶/底边→垂直向外；左右边→水平向外 */
        var outY = pt.y <= ty + th / 2 ? -1 : 1;
        var anchorOut = (pt.x > tx + tw / 2) ? "end" : "start";
        /* 站点级覆盖优先 */
        var anchor = st.anchor || anchorOut;
        var lx, t1y, t2y;
        if (verticalEdge) {
          /* 上下边：两行标签都堆在走线外侧 */
          var stackDir = outY;
          t1y = pt.y + stackDir * 18 + (st.t1dy != null ? st.t1dy : 0);
          t2y = pt.y + stackDir * 31 + (st.t2dy != null ? st.t2dy : 0);
          lx = pt.x + (st.dx != null ? st.dx : 0);
          anchor = st.anchor || (stackDir === -1 ? anchorOut : anchorOut === "end" ? "start" : "end");
          /* 左右对齐仍按所在半区 */
          if (st.anchor == null) anchor = anchorOut;
        } else {
          /* 左右边：标签并排在水平外侧 */
          var outX = pt.x <= tx + tw / 2 ? -1 : 1;
          lx = pt.x + outX * 16 + (st.dx != null ? st.dx : 0);
          t1y = pt.y - 4 + (st.dy != null ? st.dy : 0);
          t2y = pt.y + 11 + (st.dy != null ? st.dy : 0);
        }
        /* 越界钳制：保证文字完整留在画布内 */
        var maxW = Math.max(estTextWidth(st.label, 12), estTextWidth(st.sub, 10));
        if (anchor === "start" && lx + maxW > W - 8) lx = W - 8 - maxW;
        if (anchor === "end" && lx - maxW < 8) lx = 8 + maxW;

        var t1 = el("text", {
          x: lx, y: t1y,
          fill: C_INK, "font-size": "11.5",
          "font-family": "'IBM Plex Mono', monospace",
          "text-anchor": anchor
        });
        t1.textContent = st.label;
        var t2 = el("text", {
          x: lx, y: t2y,
          fill: C_FAINT, "font-size": "9.5",
          "font-family": "'IBM Plex Mono', monospace",
          "text-anchor": anchor
        });
        t2.textContent = st.sub;
        g.appendChild(t1);
        g.appendChild(t2);
      }

      if (opts.interactive) {
        g.addEventListener("mouseenter", function () {
          ring.setAttribute("r", labeled ? 7 : 6);
          if (opts.onHover) opts.onHover(st, g);
        });
        g.addEventListener("mouseleave", function () {
          ring.setAttribute("r", labeled ? 5 : 4);
          if (opts.onLeave) opts.onLeave(st, g);
        });
        g.addEventListener("focus", function () {
          ring.setAttribute("r", labeled ? 7 : 6);
          if (opts.onHover) opts.onHover(st, g);
        });
        g.addEventListener("blur", function () {
          ring.setAttribute("r", labeled ? 5 : 4);
          if (opts.onLeave) opts.onLeave(st, g);
        });
        g.addEventListener("click", function () {
          if (st.href) location.href = st.href;
          if (opts.onStation) opts.onStation(st, g);
        });
        g.addEventListener("keydown", function (ev) {
          if (ev.key !== "Enter" && ev.key !== " ") return;
          ev.preventDefault();
          if (st.href) location.href = st.href;
          if (opts.onStation) opts.onStation(st, g);
        });
      }

      svg.appendChild(g);
      stationNodes.push({ g: g, ring: ring, st: st });
    });

    /* 中心读数 */
    if (labeled && opts.centerLabel !== false) {
      var ct = el("text", {
        x: W / 2, y: H / 2 - 4,
        fill: C_DIM, "font-size": "12",
        "font-family": "'IBM Plex Mono', monospace",
        "letter-spacing": "0.35em",
        "text-anchor": "middle"
      });
      ct.textContent = opts.centerText || "TURN LOOP";
      svg.appendChild(ct);
    }

    /* 双向脉冲 */
    var paused = false;
    if (L2 && !window.PrefersReducedMotion) {
      /* 拖尾：每个信号点带三枚渐隐残影，读出运动方向 */
      function mkTrail(color) {
        var arr = [];
        [{ r: 2.3, o: 0.32 }, { r: 1.8, o: 0.18 }, { r: 1.4, o: 0.09 }].forEach(function (t) {
          var c = el("circle", { r: t.r, fill: color, "fill-opacity": t.o });
          arr.push(c); svg.appendChild(c);
        });
        return arr;
      }
      var trailA = mkTrail(C_AMBER);
      var trailB = mkTrail(C_STEEL);
      var histA = [], histB = [];
      function pushHist(hist, p) {
        hist.unshift(p);
        if (hist.length > 16) hist.pop();
      }
      function placeTrail(trail, hist) {
        for (var k = 0; k < trail.length; k++) {
          var p = hist[Math.min(hist.length - 1, (k + 1) * 4)];
          if (p) { trail[k].setAttribute("cx", p.x); trail[k].setAttribute("cy", p.y); }
        }
      }

      var dotA = el("circle", { r: 3.2, fill: C_AMBER }); /* 请求：顺时针 */
      var dotB = el("circle", { r: 3.2, fill: C_STEEL }); /* 事件：逆时针 */
      var haloA = el("circle", { r: 7, fill: "none", stroke: C_AMBER, "stroke-opacity": 0.35, "stroke-width": 1 });
      var haloB = el("circle", { r: 7, fill: "none", stroke: C_STEEL, "stroke-opacity": 0.35, "stroke-width": 1 });
      [dotA, dotB, haloA, haloB].forEach(function (n) { svg.appendChild(n); });

      var speed = opts.speed || 42; /* px per frame-ish */
      var da = 0, db = L2 * 0.5, last = null;

      function place(node, halo, dd) {
        var p = trace.getPointAtLength(((dd % L2) + L2) % L2);
        node.setAttribute("cx", p.x);
        node.setAttribute("cy", p.y);
        halo.setAttribute("cx", p.x);
        halo.setAttribute("cy", p.y);
        return p;
      }

      function frame(ts) {
        if (last == null) last = ts;
        var dt = Math.min(ts - last, 50); /* 钳制：离屏/切页回来不跳帧 */
        last = ts;
        if (!paused && hostInView) {
          da = (da + speed * dt / 1000) % L2;
          db = (db - speed * 0.72 * dt / 1000) % L2;
          pushHist(histA, place(dotA, haloA, da));
          pushHist(histB, place(dotB, haloB, db));
          placeTrail(trailA, histA);
          placeTrail(trailB, histB);
        }
        /* 离屏或页面隐藏时降频轮询，不烧 rAF（性能：miniscope 常驻页顶） */
        if (!document.hidden && hostInView) requestAnimationFrame(frame);
        else setTimeout(function () { requestAnimationFrame(frame); }, 500);
      }
      var hostInView = true;
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (ents) {
          hostInView = ents[0].isIntersecting;
        }, { rootMargin: "80px" }).observe(host);
      }
      requestAnimationFrame(frame);
    }

    /* 外部联动：按周长占比高亮某个站点 */
    function setActiveByFraction(f) {
      stationNodes.forEach(function (n) {
        var near = Math.abs(n.st.f - f) < 0.06;
        n.ring.setAttribute("stroke", near ? "#e7edf3" : (n.st.color === "amber" ? C_AMBER : C_STEEL));
        n.ring.setAttribute("stroke-width", near ? "2.4" : "1.6");
      });
    }

    return {
      svg: svg,
      setActiveByFraction: setActiveByFraction,
      setPaused: function (v) { paused = !!v; }
    };
  }

  window.LoopScope = { mount: mount };
})();
