/* CODEX ATLAS — cursor.js：自定义磁性光环光标（全站）
   学自 100daysofcraft 的参数学与 luxury site 惯例：
   · 双层结构：中心点即时跟手，光环以 lerp 0.15 追赶（滞后即质感）
   · 可交互元素（.btn/.seg button/a/...）悬停时光环放大 1.6x 并贴附元素中心
   · 文本输入上隐藏光环（原生 I-beam 接管）
   · 触屏 / prefers-reduced-motion 不启用；页面隐藏时暂停 rAF */
(function () {
  "use strict";
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!window.matchMedia || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  document.body.classList.add("cur-on");   /* 守卫通过才隐藏原生指针 */

  var ring = document.createElement("div");
  var dot = document.createElement("div");
  ring.className = "cur-ring";
  dot.className = "cur-dot";
  document.body.appendChild(ring);
  document.body.appendChild(dot);

  var mx = innerWidth / 2, my = innerHeight / 2;   // 真实指针
  var rx = mx, ry = my;                            // 光环（追赶）
  var scale = 1, tScale = 1;
  var visible = false, running = false, raf = 0;
  var hot = null;                                  // 当前吸附的目标元素

  function onMove(e) {
    mx = e.clientX; my = e.clientY;
    if (!visible) {
      visible = true;
      ring.style.opacity = "1"; dot.style.opacity = "1";
      rx = mx; ry = my;                             // 首次出现不漂移
    }
    var t = e.target;
    var el = t.closest && t.closest("a, button, [role='button'], .btn, .seg button, .cr, .cq-opt, .cell, input[type='range'], .ca-scrub, label.switch-row");
    var isText = t.closest && t.closest("input:not([type='range']), textarea, select");
    hot = isText ? null : (el || null);
    tScale = isText ? 0 : (hot ? 1.6 : 1);
    dot.classList.toggle("hide", !!isText);
    start();
  }

  function frame() {
    /* 光环追赶指针；若吸附在交互元素上则向其中心靠拢 */
    var tx = mx, ty = my;
    if (hot && hot.getBoundingClientRect) {
      var r = hot.getBoundingClientRect();
      tx = r.left + r.width / 2;
      ty = r.top + Math.min(r.height / 2, 40);
      tScale = 1.6;
    }
    rx += (tx - rx) * 0.15;
    ry += (ty - ry) * 0.15;
    scale += (tScale - scale) * 0.18;
    ring.style.transform = "translate(" + (rx - 16) + "px," + (ry - 16) + "px) scale(" + scale.toFixed(3) + ")";
    dot.style.transform = "translate(" + (mx - 2.5) + "px," + (my - 2.5) + "px)";
    /* 指针静止且无吸附 → 渐隐省电 */
    if (!hot && Math.abs(tx - mx) < 0.5 && Math.abs(ty - my) < 0.5 && !visible) { stop(); return; }
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  document.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerdown", function () {
    ring.classList.add("press");
    setTimeout(function () { ring.classList.remove("press"); }, 160);
  }, { passive: true });
  document.addEventListener("pointerleave", function () {
    visible = false;
    ring.style.opacity = "0"; dot.style.opacity = "0";
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else if (visible) start();
  });
})();
