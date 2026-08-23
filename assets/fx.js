/* CODEX ATLAS — fx.js · 首页动效层（零依赖）
   技法出处（学自 GitHub 头部仓库的公开做法，全部手写实现）：
   · constellation 粒子场 ← particles.js / tsParticles 的签名效果
   · 文字解码 churn ← GSAP ScrambleText 约定：逐字截止、等宽防抖、
     aria-label 存终稿 + churn 层 aria-hidden、reduced-motion 直接出全文
   · 3D 倾斜卡片 ← transitions.dev 范式：指针跟踪在永不变形的外层平面上，
     JS 只写 CSS 变量，CSS 负责合成；进快出弹，两段过渡分开
   · 磁吸按钮 ← 通用 micro-interaction：位移系数 0.22、rAF 插值回位
   所有效果三重门控：prefers-reduced-motion / hover:none / pointer:coarse。 */
(function () {
  "use strict";

  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var CAN_HOVER = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  /* ---------- 1 · constellation 信号粒子场 ---------- */
  function mountField(host) {
    if (!host || REDUCED || !window.requestAnimationFrame) return;
    var canvas = document.createElement("canvas");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
    host.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var W = 0, H = 0, dpr = 1;
    var AMBER = "255,180,84", STEEL = "143,199,232";
    var parts = [];
    var mouse = { x: -999, y: -999 };
    var running = false, rafId = 0;

    function size() {
      var rect = host.getBoundingClientRect();
      W = Math.max(1, Math.round(rect.width));
      H = Math.max(1, Math.round(rect.height));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seed() {
      parts.length = 0;
      var n = Math.min(64, Math.max(26, Math.floor(W * H / 16000)));
      for (var i = 0; i < n; i++) {
        var steel = Math.random() < 0.42;
        parts.push({
          x: Math.random() * W, y: Math.random() * H,
          bx: (Math.random() - 0.5) * 0.34, by: (Math.random() - 0.5) * 0.34,
          vx: 0, vy: 0,
          r: 0.8 + Math.random() * 1.3,
          c: steel ? STEEL : AMBER,
          tw: 0.5 + Math.random() * 0.5, tws: 0.4 + Math.random() * 0.8
        });
      }
    }

    var LINK = 108, REPEL = 92;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var i, j, p, q, dx, dy, d;
      for (i = 0; i < parts.length; i++) {
        p = parts[i];
        /* 回归基础漂移 + 鼠标斥力 */
        p.vx += (p.bx - p.vx) * 0.02;
        p.vy += (p.by - p.vy) * 0.02;
        dx = p.x - mouse.x; dy = p.y - mouse.y;
        d = Math.sqrt(dx * dx + dy * dy);
        if (d < REPEL && d > 0.01) {
          var f = (1 - d / REPEL) * 0.5;
          p.vx += dx / d * f;
          p.vy += dy / d * f;
        }
        var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (sp > 1.1) { p.vx *= 1.1 / sp; p.vy *= 1.1 / sp; }
        p.x += p.vx; p.y += p.vy;
        if (p.x < -8) p.x = W + 8; else if (p.x > W + 8) p.x = -8;
        if (p.y < -8) p.y = H + 8; else if (p.y > H + 8) p.y = -8;
      }
      /* 近距连线：constellation 的签名 */
      ctx.lineWidth = 1;
      for (i = 0; i < parts.length; i++) {
        p = parts[i];
        for (j = i + 1; j < parts.length; j++) {
          q = parts[j];
          dx = p.x - q.x; dy = p.y - q.y;
          if (Math.abs(dx) > LINK || Math.abs(dy) > LINK) continue;
          d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK) {
            ctx.strokeStyle = "rgba(" + p.c + "," + ((1 - d / LINK) * 0.14).toFixed(3) + ")";
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
      }
      var t = performance.now() / 1000;
      for (i = 0; i < parts.length; i++) {
        p = parts[i];
        var a = 0.32 + 0.3 * (0.5 + 0.5 * Math.sin(t * p.tws + p.tw * 6.28));
        ctx.fillStyle = "rgba(" + p.c + "," + a.toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
      }
      rafId = requestAnimationFrame(frame);
    }

    function start() { if (!running) { running = true; rafId = requestAnimationFrame(frame); } }
    function stop() { if (running) { running = false; cancelAnimationFrame(rafId); } }

    size(); seed();
    var rszTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(rszTimer);
      rszTimer = setTimeout(function () { size(); seed(); }, 160);
    });
    host.parentElement.addEventListener("pointermove", function (e) {
      var rect = host.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    });
    host.parentElement.addEventListener("pointerleave", function () { mouse.x = -999; mouse.y = -999; });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (ents) {
        ents.forEach(function (en) { en.isIntersecting ? start() : stop(); });
      }, { rootMargin: "60px" }).observe(host);
    } else start();
  }

  /* ---------- 2 · 文字解码（churn） ---------- */
  function decode(span) {
    if (span._fxDecoded) return;
    span._fxDecoded = true;
    var origHTML = span.innerHTML;
    var origText = span.textContent;
    if (REDUCED || !window.requestAnimationFrame || origText.length < 3) return;

    span.setAttribute("aria-label", origText);
    span.textContent = "";
    var churn = document.createElement("span");
    churn.setAttribute("aria-hidden", "true");
    churn.style.whiteSpace = "pre";
    span.appendChild(churn);

    var GLYPHS = "01<>/{}[]#$%&*+=~^|";
    var n = origText.length;
    var lockAt = [], i;
    for (i = 0; i < n; i++) {
      lockAt.push(i * 26 + Math.random() * 60 + 240);
    }
    var total = lockAt[n - 1] + 60;
    var t0 = null;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var el = ts - t0, out = "", done = true;
      for (var k = 0; k < n; k++) {
        var ch = origText[k];
        if (ch === " " || ch === "\n") { out += ch; continue; }
        if (el >= lockAt[k]) out += ch;
        else { done = false; out += GLYPHS[(Math.random() * GLYPHS.length) | 0]; }
      }
      churn.textContent = out;
      if (!done && el < total) requestAnimationFrame(step);
      else {
        span.innerHTML = origHTML;
        span.removeAttribute("aria-label");
      }
    }
    requestAnimationFrame(step);
  }

  /* ---------- 3 · 数字滚动 ---------- */
  function countUp(el) {
    if (el._fxCounted) return;
    el._fxCounted = true;
    var target = parseInt(el.getAttribute("data-count"), 10);
    if (isNaN(target)) return;
    if (REDUCED || !window.requestAnimationFrame) { el.textContent = target.toLocaleString("en-US"); return; }
    var t0 = null, DUR = 1150;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / DUR);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString("en-US");
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------- 4 · 3D 倾斜面板（外层平面跟踪，内层变形） ---------- */
  var TILT_MAX = 3.2;
  function tiltWrap(wrapper, card) {
    if (wrapper._fxTilt) return;
    wrapper._fxTilt = true;
    var pending = null, frameReq = 0;

    function apply() {
      frameReq = 0;
      if (pending === null) return;
      var e = pending, rect = wrapper.getBoundingClientRect();
      var px = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      var py = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      card.classList.add("is-tilting");
      card.style.setProperty("--tilt-rx", ((0.5 - py) * TILT_MAX).toFixed(2) + "deg");
      card.style.setProperty("--tilt-ry", ((px - 0.5) * TILT_MAX).toFixed(2) + "deg");
      card.style.setProperty("--spot-x", (px * 100).toFixed(1) + "%");
      card.style.setProperty("--spot-y", (py * 100).toFixed(1) + "%");
      pending = null;
    }

    wrapper.addEventListener("pointerenter", function () {
      card.classList.add("is-hover");
    });
    wrapper.addEventListener("pointermove", function (e) {
      pending = e;
      if (!frameReq) frameReq = requestAnimationFrame(apply);
    });
    wrapper.addEventListener("pointerleave", function () {
      card.classList.remove("is-hover", "is-tilting");
      card.style.setProperty("--tilt-rx", "0deg");
      card.style.setProperty("--tilt-ry", "0deg");
    });
  }

  /* ---------- 5 · 磁吸按钮 ---------- */
  function magnet(btn) {
    if (btn._fxMag) return;
    btn._fxMag = true;
    var tx = 0, ty = 0, cx = 0, cy = 0, hovering = false, raf = 0;
    function loop() {
      cx += (tx - cx) * 0.22; cy += (ty - cy) * 0.22;
      btn.style.transform = "translate3d(" + cx.toFixed(2) + "px," + cy.toFixed(2) + "px,0)";
      if (hovering || Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) {
        raf = requestAnimationFrame(loop);
      } else { btn.style.transform = ""; raf = 0; }
    }
    btn.addEventListener("pointermove", function (e) {
      var r = btn.getBoundingClientRect();
      tx = Math.max(-6, Math.min(6, (e.clientX - r.left - r.width / 2) * 0.22));
      ty = Math.max(-5, Math.min(5, (e.clientY - r.top - r.height / 2) * 0.22));
      if (!hovering) { hovering = true; if (!raf) raf = requestAnimationFrame(loop); }
    });
    btn.addEventListener("pointerleave", function () {
      hovering = false; tx = 0; ty = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    });
  }

  /* ---------- 装配 ---------- */
  ready(function () {
    var fieldHost = document.getElementById("hero-field");
    if (fieldHost) mountField(fieldHost);

    Array.prototype.forEach.call(document.querySelectorAll("[data-decode]"), function (el) {
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (ents, obs) {
          ents.forEach(function (en) {
            if (en.isIntersecting) { obs.disconnect(); decode(el); }
          });
        }, { threshold: 0.6 }).observe(el);
      } else decode(el);
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-count]"), countUp);

    if (CAN_HOVER && !REDUCED) {
      /* 首页线路面板：JS 包一层永不变形的外层平面，指针在外层跟踪 */
      Array.prototype.forEach.call(document.querySelectorAll(".container section .panel"), function (p) {
        if (p.parentElement.classList.contains("fx-tilt-wrap")) return;
        var w = document.createElement("div");
        w.className = "fx-tilt-wrap";
        p.parentNode.insertBefore(w, p);
        w.appendChild(p);
        var glare = document.createElement("div");
        glare.className = "fx-glare";
        glare.setAttribute("aria-hidden", "true");
        p.appendChild(glare);
        tiltWrap(w, p);
      });
      Array.prototype.forEach.call(document.querySelectorAll(".btn.primary"), magnet);
    }
  });

  window.CAFx = { mountField: mountField, decode: decode, countUp: countUp };
})();
