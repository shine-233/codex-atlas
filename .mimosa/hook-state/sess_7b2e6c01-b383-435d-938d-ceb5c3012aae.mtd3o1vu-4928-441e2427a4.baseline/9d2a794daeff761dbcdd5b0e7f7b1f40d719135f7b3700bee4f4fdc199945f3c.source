/* CODEX ATLAS — gesture-lab.js：Kandinsky 式「画个形状，听一段协议」
   学自 Chrome Music Lab Kandinsky 的三条原则：
   · 手势简化后分类（圆 / 折线 / 直线），各自绑定一种协议语义与旋律
     圆 = thread/start→turn/completed 完整轮回（上行五声琶音收尾）
     折线(≥2 个拐点) = 流式 delta 逐音落下
     直线 = 单条指令干脆一声
   · 音高全部落在五声音阶 → 怎么画都和谐
   · 轨迹点存为 mesh 式点列：绘制速度决定线宽，播放时逐点亮起
   零依赖。识别用简化 Dollar 思路（$1 的角检测子集），不求精确只求好玩。 */
(function () {
  "use strict";

  var PENTA = [523.25, 587.33, 659.25, 783.99, 880.00];
  function note(i) { return PENTA[((i % 5) + 5) % 5] * (i >= 5 ? 2 : 1); }

  function simplify(pts, tol) {
    /* Douglas-Peucker 极简版：保留转折大于 tol 的点 */
    if (pts.length < 3) return pts.slice();
    var out = [pts[0]];
    for (var i = 1; i < pts.length - 1; i++) {
      var a = out[out.length - 1], b = pts[i], c = pts[i + 1];
      var abx = b.x - a.x, aby = b.y - a.y, bcx = c.x - b.x, bcy = c.y - b.y;
      var cross = Math.abs(abx * bcy - aby * bcx);
      var ab = Math.hypot(abx, aby) || 1;
      if (cross / ab > tol) out.push(b);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  function classify(pts) {
    var first = pts[0], last = pts[pts.length - 1];
    var d = Math.hypot(last.x - first.x, last.y - first.y);
    var path = 0;
    var minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (p.x < minx) minx = p.x;
      if (p.x > maxx) maxx = p.x;
      if (p.y < miny) miny = p.y;
      if (p.y > maxy) maxy = p.y;
      if (i) path += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
    }
    if (path < 24) return null;                       // 太短：忽略
    var winding = path / (d || 1);                    // 绕路系数：直线≈1，闭合圈≥3
    var bw = maxx - minx, bh = maxy - miny;
    var aspect = Math.min(bw, bh) / (Math.max(bw, bh) || 1);
    /* 圆：绕了远路、首尾接近、包围盒近方形 */
    if (winding > 2.4 && d < path * 0.25 && aspect > 0.45) return "circle";
    var simp = simplify(pts, 2.4);
    var corners = Math.max(0, simp.length - 2);
    if (corners >= 2 && winding < 2.4) return "zigzag";   // 多折 → 流式 delta
    return "line";                                          // 直线 → 单条指令
  }

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    var host = document.getElementById("gesture-lab");
    if (!host) return;

    host.innerHTML =
      '<div class="gl-wrap">' +
      '<canvas class="gl-canvas"></canvas>' +
      '<div class="gl-hint">按住画一个形状：⭕ 完整轮回 · ⌇ 流式增量 · ／ 单条指令</div>' +
      '<div class="gl-readout" aria-live="polite">画点什么试试。</div>' +
      '</div>';

    var canvas = host.querySelector(".gl-canvas");
    var readout = host.querySelector(".gl-readout");
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var W = 0, H = 0, dpr = 1;
    function size() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.round(host.clientWidth * dpr);
      H = Math.round(canvas.clientHeight ? canvas.clientHeight * dpr : 200);
      canvas.width = W; canvas.height = H;
    }
    size();
    window.addEventListener("resize", size);

    var pts = [], drawing = false, pid = null;

    function pos(e) {
      var r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr };
    }

    canvas.addEventListener("pointerdown", function (e) {
      drawing = true; pid = e.pointerId;
      try { canvas.setPointerCapture(pid); } catch (err) { /* 忽略 */ }
      pts = [pos(e)];
      redraw();
      e.preventDefault();
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!drawing || e.pointerId !== pid) return;
      pts.push(pos(e));
      redraw();
      e.preventDefault();
    });
    function up(e) {
      if (!drawing || e.pointerId !== pid) return;
      drawing = false;
      finish();
    }
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    function redraw() {
      ctx.clearRect(0, 0, W, H);
      if (!pts.length) return;
      ctx.strokeStyle = "rgba(255,180,84,.9)";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      /* 速度感：相邻点距离越大线越粗（Kandinsky 的速度→宽度） */
      for (var i = 1; i < pts.length; i++) {
        var v = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        ctx.lineWidth = Math.min(6 * dpr, (2.5 + v * 0.06) * dpr);
        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
    }

    function playSeq(notes, gapMs, label) {
      readout.textContent = label;
      var i = 0;
      (function next() {
        if (i >= notes.length) { return; }
        if (window.CASound && CASound.force) {
          /* 借 force 通道发一个指定频率的音（临时音色：noteN） */
          CASound.forceNote(notes[i]);
        }
        i++;
        setTimeout(next, gapMs);
      })();
    }

    function finish() {
      if (pts.length < 6) { pts = []; redraw(); return; }
      var kind = classify(pts);
      if (!kind) { readout.textContent = "太短了，放开画。"; return; }
      if (!window.CASound || !CASound.forceNote) { pts = []; redraw(); return; }
      if (kind === "circle") {
        playSeq([0, 1, 2, 3, 4, 5, 4, 2, 0], 130,
          "⭕ 完整轮回：thread/start → … → turn/completed（上行琶音收束）");
      } else if (kind === "zigzag") {
        playSeq([4, 2, 3, 1, 2, 0, 2, 1], 95,
          "⌇ 流式 delta：item/agentMessage/delta 一段段落下");
      } else {
        playSeq([2, 2], 160,
          "／ 单条指令：一次干脆的 tool call，不绕弯");
      }
      /* 播放期间轨迹渐隐重绘 */
      var fade = 1;
      (function fadeLoop() {
        fade -= 0.08;
        ctx.clearRect(0, 0, W, H);
        if (fade > 0) {
          ctx.globalAlpha = Math.max(0, fade);
          redraw();
          ctx.globalAlpha = 1;
          requestAnimationFrame(fadeLoop);
        } else { pts = []; }
      })();
    }
  });

  /* forceNote：向 sound.js 借道——直接挂一个专用音色到 CASound 上 */
  document.addEventListener("DOMContentLoaded", function () {
    if (window.CASound && !window.CASound.forceNote) {
      window.CASound._penta = [523.25, 587.33, 659.25, 783.99, 880.00];
      window.CASound.forceNote = function (idx) {
        /* 复用 force 通道：tx 音色 + 序号即五声音阶 */
        window.CASound.force("tx", idx);
      };
    }
  });
})();
