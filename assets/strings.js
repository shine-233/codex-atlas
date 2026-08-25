/* CODEX ATLAS — STRING ROOM · 拨弦休息区（首页）
   Trionn 获奖站的「可拨动琴弦」手法，弦的内容换成站点自己的五条主线。
   光标划过琴弦即拨响：用前后两个指针位置做线段相交判定，划得越快振幅越大；
   振动是弦路径的二次贝塞尔中点做阻尼正弦，rAF 驱动、衰减到阈值自动停表。
   音色走 sound.js 的 pluck（五声音阶，seq = 弦序号）；跟随全局 ♪ 开关，
   关着时弦照样颤、只是不出声——提示就写在面板下面。
   触屏拖划同样有效；prefers-reduced-motion 下免振动、点按仍可发声。 */
(function () {
  "use strict";
  var host = document.getElementById("strings-viz");
  if (!host) return;

  var LINES = [
    { no: "01", name: "循环回路" },
    { no: "02", name: "输入组装" },
    { no: "03", name: "权限沙箱" },
    { no: "04", name: "协议线路" },
    { no: "05", name: "Crate 图谱" }
  ];
  var X0 = 96, X1 = 736, XM = (X0 + X1) / 2;
  var TOP = 24, GAP = 34;
  var H = TOP + GAP * (LINES.length - 1) + 24;

  var NS = "http://www.w3.org/2000/svg";
  function E(n, a) { var x = document.createElementNS(NS, n); for (var k in a) x.setAttribute(k, a[k]); return x; }

  var svg = E("svg", { viewBox: "0 0 760 " + H, preserveAspectRatio: "xMidYMid meet" });
  svg.style.width = "100%";
  svg.style.height = "auto";
  svg.style.display = "block";
  svg.style.touchAction = "none";

  var reduced = window.PrefersReducedMotion === true;
  var strings = [];

  LINES.forEach(function (ln, i) {
    var y = TOP + GAP * i;

    var g = E("g", { class: "ca-str-g", tabindex: "0", role: "button",
      "aria-label": "拨响 " + ln.no + " " + ln.name });
    var hit = E("rect", { x: X0 - 10, y: y - 12, width: X1 - X0 + 20, height: 24,
      fill: "transparent" });
    g.appendChild(hit);

    var label = E("text", { class: "ca-str-label", x: X0 - 14, y: y + 4, "text-anchor": "end" });
    label.textContent = ln.no + " " + ln.name;
    g.appendChild(label);

    var path = E("path", { class: "ca-str", d: "M" + X0 + " " + y + " Q" + XM + " " + y + " " + X1 + " " + y });
    g.appendChild(path);

    function pluck(vel) {
      var s = strings[i];
      if (!reduced) {
        s.amp = Math.min(15, 4 + (vel || 0) * 0.12);
        s.phase = 0;
        if (!s.live) { s.live = true; wake(); }
      }
      if (window.CASound) CASound.play("pluck", i);
      g.classList.add("hit");
      setTimeout(function () { g.classList.remove("hit"); }, 260);
    }
    g.caPluck = pluck;

    g.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      pluck(8);
    });
    g.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pluck(8); }
    });

    svg.appendChild(g);
    strings.push({ path: path, y: y, amp: 0, phase: 0, live: false, g: g });
  });

  /* 划弦判定：上一指针位置 → 当前位置 的线段，与哪根弦的 y 相交就拨哪根。
     速度换成振幅——慢慢蹭过去是轻拨，甩过去是扫弦。 */
  var prev = null;
  svg.addEventListener("pointermove", function (e) {
    var r = svg.getBoundingClientRect();
    var sx = (e.clientX - r.left) / r.width * 760;
    var sy = (e.clientY - r.top) / r.height * H;
    if (prev && !reduced) {
      strings.forEach(function (s) {
        if (sx < X0 || sx > X1) return;
        /* 前后两点在弦两侧 = 这一步划过了这根弦；位移越大劲越大 */
        if ((prev.y - s.y) * (sy - s.y) <= 0) {
          s.g.caPluck(6 + Math.abs(sy - prev.y) * 1.6);
        }
      });
    }
    prev = { x: sx, y: sy };
  });
  svg.addEventListener("pointerleave", function () { prev = null; });

  /* 阻尼振动：amp * e^(-t/0.28) * sin(phase)，衰减到 0.3px 停表归位 */
  var rafId = null, last = null;
  function wake() {
    if (rafId != null) return;
    last = null;
    rafId = requestAnimationFrame(tick);
  }
  function tick(ts) {
    if (last == null) last = ts;
    var dt = Math.min(ts - last, 50) / 1000;
    last = ts;
    var any = false;
    strings.forEach(function (s) {
      if (!s.live) return;
      s.phase += dt * 46;
      s.amp *= Math.exp(-dt / 0.24);
      if (s.amp < 0.3) {
        s.live = false; s.amp = 0;
        s.path.setAttribute("d", "M" + X0 + " " + s.y + " Q" + XM + " " + s.y + " " + X1 + " " + s.y);
        return;
      }
      any = true;
      var d = s.amp * Math.sin(s.phase);
      s.path.setAttribute("d", "M" + X0 + " " + s.y + " Q" + XM + " " + (s.y + d).toFixed(2) + " " + X1 + " " + s.y);
    });
    if (any) rafId = requestAnimationFrame(tick);
    else rafId = null;
  }

  host.appendChild(svg);
})();
