/* CODEX ATLAS · panel/theme —— 自 panel.js 拆出，加载顺序必须在 panel.js 之后 */
(function () {
  /* 主题切换钮：持久化 ca-theme，刷新一次让 canvas/SVG 按新色重绘 */
  (function () {
    var tbtn = document.createElement("button");
    tbtn.type = "button";
    tbtn.className = "theme-toggle";
    function paintTheme() {
      var light = document.documentElement.getAttribute("data-theme") === "light";
      tbtn.textContent = light ? "\u263E" : "\u2600";
      tbtn.setAttribute("aria-pressed", light ? "true" : "false");
      tbtn.setAttribute("aria-label", light ? "切回深色主题" : "切换浅色图纸主题");
      tbtn.title = light ? "切回深色主题" : "浅色图纸主题（会刷新一次页面）";
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", light ? "#f0ece1" : "#101418");
    }
    paintTheme();
    tbtn.addEventListener("click", function (e) {
      var light = document.documentElement.getAttribute("data-theme") === "light";
      try { localStorage.setItem("ca-theme", light ? "dark" : "light"); } catch (err) { /* 忽略 */ }
      var swap = function () {
        if (light) document.documentElement.removeAttribute("data-theme");
        else document.documentElement.setAttribute("data-theme", "light");
        paintTheme();
      };
      /* 圆形揭示（View Transitions）：从按钮中心扩散换肤，播完再刷新一次
         让 canvas/SVG 仪器按新色重绘。不支持/减动效 → 原地换 + 立即刷新。 */
      var reduce = window.PrefersReducedMotion === true;
      var rect = tbtn.getBoundingClientRect();
      var x = (e.clientX || rect.left + rect.width / 2);
      var y = (e.clientY || rect.top + rect.height / 2);
      if (!reduce && document.startViewTransition) {
        document.documentElement.classList.add("theme-vt");
        var vt = document.startViewTransition(swap);
        vt.ready.then(function () {
          var r = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y));
          document.documentElement.animate(
            { clipPath: [
                "circle(0px at " + x + "px " + y + "px)",
                "circle(" + r + "px at " + x + "px " + y + "px)"
              ] },
            { duration: 560, easing: "ease-in-out",
              pseudoElement: "::view-transition-new(root)" });
        }).catch(function () { /* 揭示被打断就算了 */ });
        vt.finished.finally(function () {
          document.documentElement.classList.remove("theme-vt");
          setTimeout(function () { location.reload(); }, 140);
        }).catch(function () { /* 打断时 finally 已兜底，这里只吞掉拒绝 */ });
      } else {
        swap();
        setTimeout(function () { location.reload(); }, 60);
      }
    });
    document.body.appendChild(tbtn);
  })();

  /* ---------- 动效总开关「静/动」：ciechanow.ski 的 global pause 手法 ----------
     关掉后写入 ca-motion=off 并刷新一次：所有仪器在初始化时读到静态标志，
     直接以终态呈现（与系统减动效同一通道，见 panel.js 的 PrefersReducedMotion）。 */
  (function () {
    var mbtn = document.createElement("button");
    mbtn.type = "button";
    mbtn.className = "theme-toggle motion-toggle";
    function isOff() {
      try { return localStorage.getItem("ca-motion") === "off"; } catch (err) { return false; }
    }
    function paint() {
      var off = isOff();
      mbtn.textContent = off ? "\u25B6" : "\u9759";
      mbtn.setAttribute("aria-pressed", off ? "true" : "false");
      mbtn.setAttribute("aria-label", off ? "恢复全站动效" : "关闭全站动效（静音面板模式）");
      mbtn.title = off ? "恢复动效（会刷新一次页面）" : "静：关掉全部动画，仪器落定成终态（会刷新一次页面）";
    }
    paint();
    mbtn.addEventListener("click", function () {
      try { localStorage.setItem("ca-motion", isOff() ? "on" : "off"); } catch (err) { /* 忽略 */ }
      setTimeout(function () { location.reload(); }, 60);
    });
    document.body.appendChild(mbtn);
  })();

  /* Web 字体就绪后重排一遍 SVG 文本：个别在回退字体下完成首排的节点，
      字体交换后不重新量宽，拉丁词会以零宽度消失（Chromium 实测）。 */
  function resvgTexts() {
    document.querySelectorAll("svg text").forEach(function (t) {
      var s = t.textContent;
      if (!s) return;
      t.textContent = "";
      t.textContent = s;
    });
  }
  if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
    document.fonts.ready.then(resvgTexts);
  } else {
    window.addEventListener("load", resvgTexts);
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

