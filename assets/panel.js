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

  /* 当前线路高亮（按 pathname 匹配 rail 链接） */
  ready(function () {
    var path = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".rail-ch, .mobile-nav a").forEach(function (a) {
      var target = a.getAttribute("href").split("/").pop();
      if (target === path || (path === "" && target === "index.html")) {
        a.setAttribute("aria-current", "page");
      }
    });
    /* 编号说明：纯数字导航 */
    document.querySelectorAll(".ch-no").forEach(function (el) {
      el.title = "编号：00 总览 · 01–05 五条线路 · 06 术语速查";
    });
  });

  /* CHECKPOINT · 出站自检：mount(容器, 题目数组)
     题目格式：{ q: 问题, opts: [选项…], a: 正确下标, why: 解析 } */
  window.CAQuiz = {
    mount: function (host, questions) {
      if (!host || !questions || !questions.length) return;
      var scoreB = null;

      function pad(n) { return (n < 10 ? "0" : "") + n; }

      function updateScore() { scoreB.textContent = correct + ""; }

      var head = document.createElement("div");
      head.className = "panel-title";
      var h3 = document.createElement("h3");
      h3.textContent = "CHECKPOINT · 出站自检";
      var ro = document.createElement("span");
      ro.className = "readout";
      ro.append("答对 ");
      scoreB = document.createElement("b");
      scoreB.textContent = "0";
      ro.appendChild(scoreB);
      ro.append(" / " + questions.length);
      head.appendChild(h3);
      head.appendChild(ro);
      host.appendChild(head);

      var list = document.createElement("ol");
      list.className = "cq-list";

      var correct = 0;

      questions.forEach(function (item, qi) {
        var li = document.createElement("li");
        li.className = "cq-item";

        var q = document.createElement("p");
        q.className = "cq-q";
        q.textContent = item.q;
        li.appendChild(q);

        var opts = document.createElement("div");
        opts.className = "cq-opts";
        item.opts.forEach(function (label, oi) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "cq-opt";
          b.textContent = label;
          b.addEventListener("click", function () {
            if (li.classList.contains("done")) return;
            li.classList.add("done");
            Array.prototype.forEach.call(opts.children, function (btn, idx) {
              btn.disabled = true;
              if (idx === item.a) btn.classList.add("right");
              else if (idx === oi) btn.classList.add("wrong");
              else btn.classList.add("mute");
            });
            if (oi === item.a) correct++;
            updateScore();
            ex.innerHTML = "<b>" + (oi === item.a ? "答对了。" : "差一点。") + "</b> " + item.why;
          });
          opts.appendChild(b);
        });
        li.appendChild(opts);

        var ex = document.createElement("p");
        ex.className = "cq-ex";
        ex.setAttribute("aria-live", "polite");
        li.appendChild(ex);

        list.appendChild(li);
      });

      host.appendChild(list);
      updateScore();
    }
  };
})();
