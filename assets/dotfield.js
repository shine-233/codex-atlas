/* CODEX ATLAS — dotfield.js：hero 第二层「噪声场点阵」
   学自 UniqueUI 的 Noise Dot Field Hero：
   · 点阵格点被正弦噪声场推移，像风里的沙
   · 指针周围一个衰减口袋把点推开——页面在「呼吸着避开你」
   · 滚动相位注入：往下滚 = 场往前涌
   · reduced-motion 只画一帧；离屏暂停；DPR 封顶 1.5 */
(function () {
  "use strict";
  if (window.PrefersReducedMotion === true) return;

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    var host = document.getElementById("hero-field");
    if (!host || !window.CanvasRenderingContext2D) return;

    var canvas = document.createElement("canvas");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
    host.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    if (!ctx) { canvas.remove(); return; }

    var W = 0, H = 0, dpr = 1, CELL = 17;
    function size() {
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      W = Math.round(host.clientWidth * dpr);
      H = Math.round(host.clientHeight * dpr);
      canvas.width = W; canvas.height = H;
      CELL = Math.max(13, Math.round(17 * dpr));
    }
    size();
    window.addEventListener("resize", function () {
      clearTimeout(canvas.__rz);
      canvas.__rz = setTimeout(function () { size(); staticFrame(); }, 140);
    });

    /* 指针与滚动 */
    var mx = -9999, my = -9999;
    var scrollPhase = 0, scrollVel = 0, lastY = window.scrollY;
    host.parentElement.addEventListener("pointermove", function (e) {
      var r = canvas.getBoundingClientRect();
      mx = (e.clientX - r.left) * dpr;
      my = (e.clientY - r.top) * dpr;
    }, { passive: true });
    host.parentElement.addEventListener("pointerleave", function () { mx = my = -9999; });
    window.addEventListener("scroll", function () {
      var dy = window.scrollY - lastY;
      lastY = window.scrollY;
      scrollVel += dy * 0.004 * dpr;
    }, { passive: true });

    function fieldNoise(x, y, t) {
      /* 双正弦叠加当廉价噪声场：够用且零依赖 */
      return Math.sin(x * 0.011 + t) + Math.cos(y * 0.009 - t * 0.8) +
             Math.sin((x + y) * 0.006 + t * 0.6);
    }

    var running = false, raf = 0, t = 0, lastT = 0;
    var FPS_CAP = 30, lastPaint = 0;

    function drawFrame(now) {
      ctx.clearRect(0, 0, W, H);
      var dt = Math.min(64, now - lastT) / 1000;
      lastT = now;
      t += dt;
      scrollPhase += scrollVel; scrollVel *= 0.9;
      for (var gy = CELL / 2; gy < H; gy += CELL) {
        for (var gx = CELL / 2; gx < W; gx += CELL) {
          var n = fieldNoise(gx, gy + scrollPhase * 8, t * 1.4);
          var px = gx + n * 3.2;
          var py = gy + fieldNoise(gy, gx - scrollPhase * 8, t * 1.1) * 3.2;
          /* 指针口袋：靠近则沿径向推开并淡出 */
          var dx = px - mx, dy2 = py - my;
          var md2 = dx * dx + dy2 * dy2;
          var avoid = 0;
          if (md2 < 90 * 90 * dpr * dpr) {
            var md = Math.sqrt(md2) || 1;
            avoid = 1 - md / (90 * dpr);
            px += (dx / md) * avoid * 14 * dpr;
            py += (dy2 / md) * avoid * 14 * dpr;
          }
          var alpha = 0.10 + 0.10 * (n * 0.5 + 0.5) - avoid * 0.16;
          if (alpha <= 0.01) continue;
          var s = (avoid > 0 ? 1.9 : 1.35) * dpr;
          ctx.fillStyle = avoid > 0
            ? "rgba(255,180,84," + alpha.toFixed(3) + ")"
            : "rgba(160,185,210," + alpha.toFixed(3) + ")";
          ctx.fillRect(px - s / 2, py - s / 2, s, s);
        }
      }
    }
    function frame(now) {
      raf = 0;
      if (now - lastPaint < 1000 / 30 - 2) { raf = requestAnimationFrame(frame); return; }
      lastPaint = now;
      drawFrame(now);
      if (running) raf = requestAnimationFrame(frame);
    }
    function start() {
      if (running || REDUCED()) return;
      running = true;
      lastPaint = 0;
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }
    function REDUCED() { return window.PrefersReducedMotion === true; }
    function staticFrame() { drawFrame(performance.now()); }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else if (!REDUCED()) start();
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (en) { en.isIntersecting ? start() : stop(); });
      }, { rootMargin: "10% 0px" }).observe(host);
    } else start();

    staticFrame();
  });
})();
