/* CODEX ATLAS — fluid.js · 零依赖流体光标尾迹
   Jos Stam《Real-Time Fluid Dynamics for Games》(GDC 2003) 的紧凑 CPU 版：
   半拉格朗日平流 + Jacobi 压力投影 + 速度衰减当粘滞。
   染料在 132 格宽的低分辨率网格上解算，ImageData 推上离屏画布后
   双线性放大到全屏——低分辨率本身就是柔化滤镜，不需要模糊后处理。
   指针移动注入速度与染料：划过页面拖出一缕琥珀墨，点按砸一团。
   触屏 / reduced-motion / 「静」开关一律不启用；能量耗尽自动停表。 */
(function () {
  "use strict";
  if (window.PrefersReducedMotion === true) return;
  if (!window.matchMedia || !window.matchMedia("(pointer: fine)").matches) return;

  var canvas = document.createElement("canvas");
  canvas.className = "ca-fluid";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  var ctx = canvas.getContext("2d");
  if (!ctx) { canvas.remove(); return; }

  /* ---------- 解算网格 ---------- */
  var SW = 132, SH = 76;               /* 低分辨率：性能与柔化兼得 */
  var u, v, u0, v0, d, d0, p, div;
  var i, j, idx;

  function alloc() {
    var n = SW * SH;
    u = new Float32Array(n); v = new Float32Array(n);
    u0 = new Float32Array(n); v0 = new Float32Array(n);
    d = new Float32Array(n); d0 = new Float32Array(n);
    p = new Float32Array(n); div = new Float32Array(n);
  }
  alloc();

  /* ---------- 画布尺寸 ---------- */
  var W = 0, H = 0;
  var off = document.createElement("canvas");
  off.width = SW; off.height = SH;
  var octx = off.getContext("2d");
  var img = octx.createImageData(SW, SH);

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W; canvas.height = H;
  }
  resize();
  window.addEventListener("resize", resize);

  /* 双线性采样（边界 clamp） */
  function sample(f, x, y) {
    if (x < 0) x = 0; if (x > SW - 1.001) x = SW - 1.001;
    if (y < 0) y = 0; if (y > SH - 1.001) y = SH - 1.001;
    var x0 = x | 0, y0 = y | 0;
    var fx = x - x0, fy = y - y0;
    var a = f[y0 * SW + x0], b = f[y0 * SW + x0 + 1];
    var c = f[(y0 + 1) * SW + x0], e = f[(y0 + 1) * SW + x0 + 1];
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + e * fx * fy;
  }

  function advect(f, src) {
    for (j = 1; j < SH - 1; j++) {
      for (i = 1; i < SW - 1; i++) {
        idx = j * SW + i;
        f[idx] = sample(src, i - u[idx] * 0.55, j - v[idx] * 0.55);
      }
    }
  }

  /* 压力投影：让速度场回到无散度（Stam 的 incompressibility 步） */
  function project() {
    var h = 1;
    for (j = 1; j < SH - 1; j++) {
      for (i = 1; i < SW - 1; i++) {
        idx = j * SW + i;
        div[idx] = -0.5 * h * (u[idx + 1] - u[idx - 1] + v[idx + SW] - v[idx - SW]);
        p[idx] = 0;
      }
    }
    for (var k = 0; k < 6; k++) {
      for (j = 1; j < SH - 1; j++) {
        for (i = 1; i < SW - 1; i++) {
          idx = j * SW + i;
          p[idx] = (div[idx] + p[idx - 1] + p[idx + 1] + p[idx - SW] + p[idx + SW]) / 4;
        }
      }
    }
    for (j = 1; j < SH - 1; j++) {
      for (i = 1; i < SW - 1; i++) {
        idx = j * SW + i;
        u[idx] -= 0.5 * (p[idx + 1] - p[idx - 1]) / h;
        v[idx] -= 0.5 * (p[idx + SW] - p[idx - SW]) / h;
      }
    }
  }

  /* ---------- 指针注入 ---------- */
  var px = -1, py = -1;
  function splat(x, y, dx, dy, dyeAmt) {
    var cx = x / W * SW, cy = y / H * SH;
    var cvx = dx / W * SW * 0.9, cvy = dy / H * SH * 0.9;
    var R = 2.6, R2 = R * R;
    var i0 = Math.max(1, (cx - R) | 0), i1 = Math.min(SW - 2, (cx + R) | 0);
    var j0 = Math.max(1, (cy - R) | 0), j1 = Math.min(SH - 2, (cy + R) | 0);
    for (j = j0; j <= j1; j++) {
      for (i = i0; i <= i1; i++) {
        var ddx = i - cx, ddy = j - cy;
        var g = Math.exp(-(ddx * ddx + ddy * ddy) / R2);
        idx = j * SW + i;
        u[idx] += cvx * g; v[idx] += cvy * g;
        d[idx] = Math.min(1.6, d[idx] + dyeAmt * g);
      }
    }
  }

  window.addEventListener("pointermove", function (e) {
    if (px < 0) { px = e.clientX; py = e.clientY; return; }
    var dx = e.clientX - px, dy = e.clientY - py;
    var speed = Math.sqrt(dx * dx + dy * dy);
    if (speed < 0.5) return;
    splat(e.clientX, e.clientY, dx, dy, Math.min(0.5, 0.10 + speed * 0.012));
    px = e.clientX; py = e.clientY;
    wake();
  }, { passive: true });

  window.addEventListener("pointerdown", function (e) {
    splat(e.clientX, e.clientY, 0, 0, 0.9);
    px = e.clientX; py = e.clientY;
    wake();
  }, { passive: true });

  /* ---------- 渲染 + 主循环（有能量才转） ---------- */
  var AMBER = window.CATheme ? CATheme.get("--amber", "#ffb454") : "#ffb454";
  var rgb = [255, 180, 84];
  var m = /^#?([0-9a-f]{6})$/i.exec(AMBER);
  if (m) {
    rgb = [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
  }

  var running = false, raf = 0, last = null;

  function paint() {
    var data = img.data;
    for (var n = 0, pi = 0; n < d.length; n++, pi += 4) {
      var a = d[n] > 1 ? 1 : d[n];
      data[pi] = rgb[0]; data[pi + 1] = rgb[1]; data[pi + 2] = rgb[2];
      data[pi + 3] = a * 255;
    }
    octx.putImageData(img, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(off, 0, 0, W, H);
  }

  function step() {
    project();
    advect(u0, u); advect(v0, v);
    u.set(u0); v.set(v0);
    project();
    advect(d0, d); d.set(d0);
    for (var n = 0; n < d.length; n++) {
      u[n] *= 0.985; v[n] *= 0.985;
      d[n] *= 0.975;
    }
  }

  function energy() {
    var e = 0;
    for (var n = 0; n < d.length; n += 7) {
      var a = Math.abs(u[n]) + Math.abs(v[n]);
      if (a > e) e = a;
      if (d[n] > e) e = d[n];
    }
    return e;
  }

  function frame(ts) {
    if (document.hidden) { running = false; raf = 0; return; }
    if (last == null) last = ts;
    last = ts;
    step();
    paint();
    if (energy() > 0.02) {
      raf = requestAnimationFrame(frame);
    } else {
      running = false; raf = 0;
      ctx.clearRect(0, 0, W, H);
    }
  }

  function wake() {
    if (running || window.PrefersReducedMotion === true) return;
    running = true;
    last = null;
    raf = requestAnimationFrame(frame);
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && running) wake();
  });
})();
