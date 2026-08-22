/* CODEX ATLAS — 共享面板逻辑 */
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  /* 移动端抽屉导航 */
  ready(function () {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.querySelector(".mobile-nav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });

  /* hash 状态：#s=3&x=1 形式的键值对读写 */
  window.PanelState = {
    read: function () {
      var out = {};
      var h = location.hash.replace(/^#/, "");
      if (!h) return out;
      h.split("&").forEach(function (kv) {
        var p = kv.split("=");
        if (p[0]) out[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || "");
      });
      return out;
    },
    write: function (obj) {
      var parts = [];
      Object.keys(obj).forEach(function (k) {
        if (obj[k] !== "" && obj[k] != null) {
          parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(obj[k]));
        }
      });
      var s = parts.length ? "#" + parts.join("&") : "";
      history.replaceState(null, "", location.pathname + location.search + s);
    }
  };

  /* 动效偏好 */
  window.PrefersReducedMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 当前频道高亮（按 pathname 匹配 rail 链接） */
  ready(function () {
    var path = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".rail-ch, .mobile-nav a").forEach(function (a) {
      var target = a.getAttribute("href").split("/").pop();
      if (target === path || (path === "" && target === "index.html")) {
        a.setAttribute("aria-current", "page");
      }
    });
  });
})();
