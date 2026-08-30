/* CODEX ATLAS — proto-audio.js：04 报文时间线的「可听版」（Chrome Music Lab 手法）
   让协议结构被听见：客户端请求 = 上行短音，服务端通知 = 下行滑音，
   审批挂起 = 低鸣双音，裁决 = 两连确认。方向听两秒就记住了。
   零侵入实现：MutationObserver 盯 #seq 的 .cur 行出现，不改时间线自身代码。
   独立开关（ca-proto-audio），与全局 ♪ 互不影响；发声走 CASound.force 旁路。 */
(function () {
  "use strict";

  var KEY = "ca-proto-audio";
  var on = false;
  var seqN = 0;                        /* 报文序号 → 五声音阶音高，连续播放即旋律 */
  try { on = localStorage.getItem(KEY) === "1"; } catch (e) { /* 默认关 */ }

  function cueOf(row) {
    if (row.querySelector(".chip.deny")) return "pgate";          /* 审批挂起 */
    var k = row.querySelector(".kk");
    if (k && /decision/.test(k.textContent)) return "verdict";     /* 裁决应答 */
    if (row.classList.contains("dir-c2s") || row.classList.contains("dir-int")) return "tx";
    return "rx";
  }

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    var seq = document.getElementById("seq");
    if (!seq || !window.CASound) return;

    var mo = new MutationObserver(function (muts) {
      if (!on || document.hidden) return;
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType === 1 && n.classList.contains("msg") &&
              (n.classList.contains("cur") || n.classList.contains("gate"))) {
            window.CASound.force(cueOf(n), seqN++);
          }
        }
      }
    });
    mo.observe(seq, { childList: true });

    /* 开关按钮：塞进播放控件行 */
    var controls = document.querySelector(".controls");
    if (!controls) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn proto-audio-toggle";
    function paint() {
      btn.textContent = on ? "🔊 可听版·开" : "♪ 可听版";
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.title = on ? "协议节奏已开——请求上行、通知下行、审批低鸣" : "打开后播放全程时每条报文都会发出自己的声音";
    }
    paint();
    btn.addEventListener("click", function () {
      on = !on;
      try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) { /* 内存态也行 */ }
      paint();
      if (on && window.CASound) CASound.play("toggleOn"); else if (window.CASound) CASound.play("toggleOff");
    });
    controls.appendChild(btn);
  });
})();
