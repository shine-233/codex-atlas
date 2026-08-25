/* CODEX ATLAS — 微音效引擎
   零依赖、零音频文件：全部音色用 WebAudio 振荡器与噪声现场合成。
   默认关闭（右下角 ♪ 开关手动打开），偏好记在 localStorage（ca-sound），
   重置学习进度时保留。页面隐藏时不发声。 */
(function () {
  "use strict";

  var KEY = "ca-sound";
  var enabled = false;
  try { enabled = localStorage.getItem(KEY) === "1"; } catch (e) { /* 存不上就默认关 */ }

  var ctx = null, master = null;
  var last = {};

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.16;
        /* 轻压限：快速连点时叠音不破音 */
        if (ctx.createDynamicsCompressor) {
          var comp = ctx.createDynamicsCompressor();
          master.connect(comp); comp.connect(ctx.destination);
        } else {
          master.connect(ctx.destination);
        }
      } catch (e) { ctx = null; return false; }
    }
    if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) { /* 忽略 */ } }
    return true;
  }

  function tone(freq, type, t0, dur, peak, slideTo) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.06);
  }

  function noise(t0, dur, peak, hp) {
    var n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = hp ? "highpass" : "lowpass";
    f.frequency.value = hp || 900;
    var g = ctx.createGain();
    g.gain.setValueAtTime(peak, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }

  /* 音色表：同一套合成引擎，语义各不相同 */
  var CUES = {
    click:     function (t) { tone(2100, "square", t, 0.03, 0.10); },
    toggleOn:  function (t) { tone(880, "triangle", t, 0.08, 0.22, 1320); },
    toggleOff: function (t) { tone(1100, "triangle", t, 0.08, 0.18, 700); },
    stamp:     function (t) { noise(t, 0.09, 0.30); tone(150, "sine", t, 0.12, 0.35, 90); },
    ok:        function (t) { tone(740, "sine", t, 0.09, 0.25); tone(1108, "sine", t + 0.09, 0.16, 0.26); },
    miss:      function (t) { tone(220, "sawtooth", t, 0.14, 0.13, 160); },
    deny:      function (t) { tone(180, "square", t, 0.10, 0.15, 130); noise(t, 0.05, 0.07, 1400); },
    pop:       function (t) { tone(520, "sine", t, 0.06, 0.20, 1040); },
    clear:     function (t) { [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(f, "triangle", t + i * 0.085, 0.22, 0.24); }); },
    grand:     function (t) {
      [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (f, i) {
        tone(f, "triangle", t + i * 0.09, 0.30, 0.25);
      });
      noise(t + 0.52, 0.25, 0.09, 2000);
    },
    whoosh:    function (t) { noise(t, 0.28, 0.09, 600); },
    /* ---------- 协议节奏器（04 可听版）：方向与语义各占一种声形 ---------- */
    tx:        function (t) { tone(920, "square", t, 0.045, 0.12); },                 /* c2s 上行请求 */
    rx:        function (t) { tone(660, "sine", t, 0.09, 0.16, 430); },               /* s2c 下行通知 */
    pgate:     function (t) { tone(196, "triangle", t, 0.22, 0.16); tone(392, "sine", t + 0.05, 0.18, 0.10); }, /* 审批挂起 */
    verdict:   function (t) { tone(587, "triangle", t, 0.07, 0.2); tone(880, "triangle", t + 0.08, 0.14, 0.22); }
  };

  function play(name) {
    if (!enabled || !CUES[name]) return;
    if (document.hidden) return;
    var now = Date.now();
    if (last[name] && now - last[name] < 60) return;   /* 同音色 60ms 内去重 */
    last[name] = now;
    if (!ensure()) return;
    try { CUES[name](ctx.currentTime + 0.01); } catch (e) { /* 出声失败不影响交互 */ }
  }

  window.CASound = {
    play: play,
    /* 旁路通道：独立开关的仪器（如 04 可听版）用 force 发声——
       仍受页面隐藏与 AudioContext 门控，但不依赖全局 ♪ 偏好。 */
    force: function (name) {
      if (!CUES[name]) return;
      if (document.hidden) return;
      if (!ensure()) return;
      try { CUES[name](ctx.currentTime + 0.01); } catch (e) { /* 出声失败不影响交互 */ }
    }
  };

  /* ---------- 全局开关按钮（右下角，站宠旁边） ---------- */
  function paint(btn) {
    btn.textContent = enabled ? "\u266A" : "\u266A\u0338";
    btn.setAttribute("aria-pressed", enabled ? "true" : "false");
    btn.setAttribute("aria-label", enabled ? "关闭界面音效" : "开启界面音效");
    btn.title = enabled ? "音效已开（点一下关掉）" : "音效已关——点一下开：盖章、答对、通关都会响";
    btn.classList.toggle("on", enabled);
  }

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "snd-toggle";
    paint(btn);
    btn.addEventListener("click", function () {
      enabled = !enabled;
      try { localStorage.setItem(KEY, enabled ? "1" : "0"); } catch (e) { /* 内存态也行 */ }
      paint(btn);
      /* 这次点击本身就是解锁 AudioContext 的手势 */
      if (enabled) play("toggleOn"); else play("toggleOff");
    });
    document.body.appendChild(btn);

    /* 通用按压声：只挂在真实控件上，60ms 去重 + 低音量，不吵 */
    document.addEventListener("pointerdown", function (e) {
      if (!enabled || e.button !== 0) return;
      var el = e.target.closest && e.target.closest(
        ".btn, .seg button, .act, .cell, .cr, .cq-opt, .rail-ch, .cmdk-item, .stage-item, .lm-node, .budget-seg, .mode-card"
      );
      if (el) play("click");
    }, { passive: true });

    /* 站宠游动配一声水泡 */
    document.addEventListener("pointerdown", function (e) {
      if (e.target.closest && e.target.closest(".cod-pet")) play("pop");
    }, { passive: true });
  });

  /* ---------- 事件接线：站点各处广播的自定义事件 ---------- */
  document.addEventListener("ca:quiz", function (ev) {
    play(ev.detail && ev.detail.ok ? "ok" : "miss");
  });
  document.addEventListener("ca:allclear", function () {
    play("clear");
    setTimeout(function () { play("whoosh"); }, 350);
  });
  document.addEventListener("ca:grandclear", function () { play("grand"); });
  document.addEventListener("ca:stamp", function (ev) {
    var v = ev.detail && ev.detail.v;
    play(v === "deny" ? "deny" : v === "cond" ? "stamp" : "click");
  });
})();
