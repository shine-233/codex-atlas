/* CODEX ATLAS · panel/pet —— 自 panel.js 拆出，加载顺序必须在 panel.js 之后 */
(function () {
  /* 站宠小鳕：cod 谐音鳕鱼。点它游一圈，顺带给一条真实有用的提示。 */
  var FISH =
    '<svg viewBox="0 0 46 40" aria-hidden="true">' +
    '<path class="cod-tail" d="M11 20 L2 12 L5.5 20 L2 28 Z" fill="#ffb454"/>' +
    '<path d="M9 20 Q19 7 31 12 Q42 16.5 42 20 Q42 23.5 31 28 Q19 33 9 20 Z" fill="#1b232c" stroke="#ffb454" stroke-width="2"/>' +
    '<path d="M21 13 L24.5 8 L28 12" stroke="#ffb454" stroke-width="1.6" fill="none"/>' +
    '<circle class="cod-eye" cx="33.5" cy="17.5" r="1.7" fill="#ffb454"/>' +
    '<path d="M14 22 Q20 25 26 22" stroke="rgba(255,180,84,.55)" stroke-width="1.3" fill="none"/>' +
    "</svg>";

  var TIPS = [
    "01 的滑杆能拖到任意一站反复看，<span class='kbd'>←</span><span class='kbd'>→</span> 也行。",
    "03 的全景矩阵格子可以点——点谁，上面的判定器就跳到哪个组合。",
    "04 播放到第 11 条会停下来等你裁决。批准和拒绝是两段不同的剧情。",
    "02 里把 AGENTS.md 四个目录位全打开，能看到触顶截断长什么样。",
    "05 试试搜 <b>mcp</b> 或 <b>cloud</b>，看成员怎么跨带分布。",
    "每页末尾的 CHECKPOINT 全部答对会盖 ALL CLEAR 徽章。",
    "正文里带虚线下划线的词，悬停或回车就有人话解释。",
    "每台仪器的状态写在地址栏里，刷新或分享链接都不丢。",
    "首页的回路图能悬停：琥珀点是请求出站，钢青点是事件回流。",
    "01 下方的 TURN SIMULATOR 能自己开一轮：运行中再插话，看 steer 怎么并入。",
    "成本对照上面有个小赌局——先猜缓存能省几倍，再拉滑杆对答案。",
    "右下角的 ♪ 打开后，盖章、答对、通关都会响。默认是关的，不打扰。",
    "左栏底部有「学习档案」：自检成绩和翻卡进度都在里面，能导出也能一键清空。",
    "03 底部那个审批弹窗是真的能点的——批准一次、本轮允许和拒绝，给的结果各不相同。",
    "03 的沙盘把围墙画了出来：换动作看命令包走位，撞墙、等签字、穿墙，全是活的。",
    "02 答疑表下面有个 compact 演示：拖到触顶，亲眼看历史被压成一段加密摘要。",
    "04 的 ACT III：rollout 文件逐行点开看，文件名生成器能演示回滚线程怎么命名。",
    "07E 的 hooks 事件轴有 8 个实测事件名——session_start 到 session_end，点着看挂点。",
    "右下角的「静」一键关掉全站动画：演示、截图或者想让页面凉快一下的时候用。",
    "首页底部的拨弦区有五根弦，一根弦对应一条线路——扫弦也算复习。",
    "按住我可以把你手里的这条鱼拎起来甩出去——落点随缘，鱼没事。"
  ];
  var tipIdx = -1;
  function nextTip() {
    tipIdx = (tipIdx + 1 + Math.floor(Math.random() * 2)) % TIPS.length;
    return TIPS[tipIdx];
  }

  var toast = document.createElement("div");
  toast.className = "cod-toast";
  toast.setAttribute("role", "status");
  document.body.appendChild(toast);
  var toastTimer = null;
  function showToast(html) {
    toast.innerHTML = html;
    toast.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 6200);
  }
  window.CAToast = showToast;

  function swimOnce(done) {
    if (window.PrefersReducedMotion) { done(); return; }
    var s = document.createElement("div");
    s.className = "cod-swim";
    s.innerHTML = FISH;
    document.body.appendChild(s);
    var t0 = null, DUR = 2400;
    var W = window.innerWidth + 140;
    function frame(ts) {
      if (t0 == null) t0 = ts;
      var p = Math.min(1, (ts - t0) / DUR);
      var ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      s.style.transform = "translateX(" + (ease * W) + "px) translateY(" + Math.sin(p * Math.PI * 3) * 10 + "px)";
      if (p < 1) requestAnimationFrame(frame);
      else s.remove();
    }
    requestAnimationFrame(frame);
    setTimeout(done, 500);
  }

  var pet = document.createElement("button");
  pet.type = "button";
  pet.className = "cod-pet";
  pet.setAttribute("aria-label", "站宠小鳕：点一下给条使用提示");
  pet.title = "小鳕 · 点我有提示";
  pet.innerHTML = FISH;
  pet.addEventListener("click", function () {
    var tip = nextTip();
    swimOnce(function () { showToast("<b>小鳕</b> · " + tip); });
  });
  document.body.appendChild(pet);

   /* 小彩蛋：连点七下，它承认自己是站宠 */
  var taps = 0, tapTimer = null;
  pet.addEventListener("click", function () {
    taps++;
    if (tapTimer) clearTimeout(tapTimer);
    tapTimer = setTimeout(function () { taps = 0; }, 1600);
    if (taps >= 7) {
      taps = 0;
      showToast("<b>小鳕</b> · 是，我是站宠。codex 词源是法典，跟鳕鱼没关系——但 cod 是鳕鱼，这站说了算。");
    }
  });

  /* 抓起来扔：按住拖走是拎着，甩出去带惯性，撞墙反弹，落定后自己游回角落。
     纯手写抛体物理（重力 + 恢复系数 + 地面摩擦），不碰任何既有行为：
     轻点仍是提示、连点仍是彩蛋（拖过的 click 在捕获阶段吃掉）。 */
  (function () {
    if (window.PrefersReducedMotion || !window.PointerEvent) return;
    var mode = "idle";          /* idle | press | hold | fly | home */
    var homeX = -1, homeY = -1;
    var px = 0, py = 0, offX = 0, offY = 0, fw = 46, fh = 40;
    var samples = [], suppressClick = false, flyRaf = 0, flyT0 = 0, thrown = 0;
    try { thrown = parseInt(localStorage.getItem("ca-pet-flings") || "0", 10) || 0; } catch (e) { }

    /* 拖过之后再放手的这次 click 不是「点」，捕获阶段拦掉，别误触提示 */
    pet.addEventListener("click", function (e) {
      if (!suppressClick) return;
      suppressClick = false;
      e.stopImmediatePropagation();
      e.preventDefault();
    }, true);

    function rememberHome() {
      if (homeX >= 0) return;
      var r = pet.getBoundingClientRect();
      homeX = r.left; homeY = r.top; fw = r.width || 46; fh = r.height || 40;
    }
    function place(x, y) {
      pet.style.right = "auto"; pet.style.bottom = "auto";
      pet.style.left = Math.round(x) + "px";
      pet.style.top = Math.round(y) + "px";
    }
    function velFromSamples() {
      var now = performance.now(), a = null, b = null;
      var i = samples.length - 1;
      for (; i >= 0; i--) {
        if (now - samples[i].t <= 110) { b = samples[i]; continue; }
        break;
      }
      if (!b) b = samples[samples.length - 1];
      for (i = 0; i < samples.length; i++) {
        if (now - samples[i].t <= 110) { a = samples[i]; break; }
      }
      if (!a || !b || b.t === a.t) return { vx: 0, vy: 0 };
      var dt = (b.t - a.t) / 1000;
      return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
    }

    pet.addEventListener("pointerdown", function (e) {
      if (mode === "fly") { catchMidair(e); return; }
      if (mode !== "idle" || (e.button !== undefined && e.button > 0)) return;
      homeX = -1; homeY = -1;   /* 每次抓取都重测家：窗口 resize 后 right/bottom 锚点会移动 */
      rememberHome();
      mode = "press";
      px = homeX; py = homeY;
      offX = e.clientX - homeX; offY = e.clientY - homeY;
      samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
      try { pet.setPointerCapture(e.pointerId); } catch (err) { }
    });

    pet.addEventListener("pointermove", function (e) {
      if (mode !== "press" && mode !== "hold") return;
      var nx = e.clientX - offX, ny = e.clientY - offY;
      if (mode === "press") {
        if (Math.abs(nx - px) + Math.abs(ny - py) < 7) return;
        mode = "hold";
        pet.classList.add("cod-hold");
        pet.style.transform = "rotate(0deg)";
        place(px, py);
      }
      px = Math.min(Math.max(nx, -fw), window.innerWidth);
      py = Math.min(Math.max(ny, -fh), window.innerHeight + fh);
      place(px, py);
      samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (samples.length > 8) samples.shift();
    });

    function release() {
      if (mode !== "press" && mode !== "hold") return;
      var wasHold = mode === "hold";
      mode = "idle";
      pet.classList.remove("cod-hold");
      if (!wasHold) return;
      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 240);   /* 兜底：别把下一次真点击吃掉 */
      var v = velFromSamples();
      startFly(px, py, v.vx * 0.9, v.vy * 0.9);
    }
    pet.addEventListener("pointerup", release);
    pet.addEventListener("pointercancel", release);

    /* 飞行中被接住：就地拎着继续玩 */
    function catchMidair(e) {
      cancelAnimationFrame(flyRaf);
      mode = "hold";
      pet.classList.add("cod-hold");
      rememberHome();
      offX = fw / 2; offY = fh / 2;
      px = e.clientX - offX; py = e.clientY - offY;
      place(px, py);
      samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
      try { pet.setPointerCapture(e.pointerId); } catch (err) { }
    }

    function startFly(x, y, vx, vy) {
      mode = "fly";
      flyT0 = performance.now();
      var sp = Math.sqrt(vx * vx + vy * vy), MAXV = 2100;
      if (sp > MAXV) { vx *= MAXV / sp; vy *= MAXV / sp; }
      var spin = 0, last = flyT0;
      var G = 2600, REST = 0.58;

      function step(ts) {
        var dt = Math.min(0.032, (ts - last) / 1000);
        last = ts;
        vy += G * dt;
        x += vx * dt; y += vy*dt;
        var W = window.innerWidth, H = window.innerHeight, bw = W - fw - 4, bh = H - fh - 4;
        if (x < 4) { x = 4; vx = -vx * REST; }
        else if (x > bw) { x = bw; vx = -vx * REST; }
        var floorHit = false;
        if (y < 4) { y = 4; vy = -vy * REST; }
        else if (y > bh) { y = bh; vy = -vy * REST * 0.72; vx *= 0.94; floorHit = true; }
        spin += vx * dt * 0.22;
        pet.style.transform = "rotate(" + Math.max(-26, Math.min(26, spin)) + "deg)";
        place(x, y);
        var still = Math.abs(vx) < 60 && Math.abs(vy) < 90 && floorHit;
        var timedOut = ts - flyT0 > 6000;
        if (!still && !timedOut) { flyRaf = requestAnimationFrame(step); return; }
        settle(x, y);
      }
      flyRaf = requestAnimationFrame(step);

      thrown++;
      if (thrown === 3) {
        try { localStorage.setItem("ca-pet-flings", "3"); } catch (e) { }
        showToast("<b>小鳕</b> · 行吧，鳍练出来了。轻点是提示，拖住才是起飞。");
      } else if (thrown < 3) {
        try { localStorage.setItem("ca-pet-flings", String(thrown)); } catch (e) { }
      }
    }

    /* 键盘发射（Bruno Simon 游戏化）：WASD 把小鳕朝对应方向弹出去，
       复用 fling 物理管线（重力/反弹/摩擦全套）。方向键留给各页单步仪。 */
    document.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      var t = e.target;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      var DIRS = {
        w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0],
        W: [0, -1], A: [-1, 0], S: [0, 1], D: [1, 0]
      };
      var dir = DIRS[e.key];
      if (!dir || mode === "fly") return;
      var r = pet.getBoundingClientRect();
      var POWER = 980;
      startFly(
        r.left + r.width / 2,
        r.top + r.height / 2,
        dir[0] * POWER,
        dir[1] * POWER - 240
      );
      showToast("<b>WASD</b> · 小鳕已被发射。再按其他键换方向，或等它自己游回来。");
      e.preventDefault();
    });

    function settle(x, y) {
      cancelAnimationFrame(flyRaf);
      mode = "home";
      pet.style.transform = "rotate(0deg)";
      place(x, y);
      setTimeout(function () { swimBack(); }, 850);
    }

    function swimBack() {
      var sx = parseFloat(pet.style.left) || homeX;
      var sy = parseFloat(pet.style.top) || homeY;
      var t0 = null, DUR = 780;
      function frame(ts) {
        if (t0 == null) t0 = ts;
        var p = Math.min(1, (ts - t0) / DUR);
        var ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        var cx = sx + (homeX - sx) * ease;
        var cy = sy + (homeY - sy) * ease - Math.sin(p * Math.PI) * 26;
        place(cx, cy);
        pet.style.transform = "rotate(" + (Math.sin(p * Math.PI * 4) * 5).toFixed(1) + "deg)";
        if (p < 1 && mode === "home") { requestAnimationFrame(frame); return; }
        /* 回家：清掉内联样式，交还给 right/bottom 锚定 */
        mode = "idle";
        pet.style.cssText = "";
        pet.style.touchAction = "none";
        pet.classList.remove("pet-happy");
        void pet.offsetWidth;
        pet.classList.add("pet-happy");
        setTimeout(function () { pet.classList.remove("pet-happy"); }, 900);
      }
      if (window.PrefersReducedMotion) { mode = "idle"; pet.style.cssText = ""; pet.style.touchAction = "none"; return; }
      requestAnimationFrame(frame);
    }

    pet.style.touchAction = "none";
    pet.title = "小鳕 · 点我有提示 · 抓住可以扔";
  })();

  /* 悬停气泡：小鳕冒一句短话，20 秒内不重复打扰 */
  var QUIPS = [
    "在看哪条线路？",
    "滑杆是可以倒着拖的。",
    "今天也想通关。",
    "别忘了我底下还藏着彩蛋。",
    "有工具调用才会转第二圈哦。",
    "累了就按 ? 歇一会儿。",
    "♪ 开了的话，我游泳也有水泡声。",
    "「静」按下去之后，我就一动不动装石头。"
  ];
  var bubble = document.createElement("div");
  bubble.className = "cod-bubble";
  bubble.setAttribute("aria-hidden", "true");
  document.body.appendChild(bubble);
  var bubbleTimer = null, lastBubble = 0, quipIdx = Math.floor(Math.random() * QUIPS.length);
  function showBubble() {
    var now = Date.now();
    if (now - lastBubble < 20000) return;
    lastBubble = now;
    quipIdx = (quipIdx + 1) % QUIPS.length;
    bubble.textContent = QUIPS[quipIdx];
    bubble.classList.add("show");
    if (bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { bubble.classList.remove("show"); }, 3200);
  }
  pet.addEventListener("mouseenter", showBubble);
  pet.addEventListener("focus", showBubble);

  /* 闲置巡游：页面可见且用户半分钟没动，小鳕自己游一圈（不弹提示） */
  var lastActive = Date.now();
  function markActive() { lastActive = Date.now(); }
  ["pointerdown", "keydown", "wheel", "touchstart"].forEach(function (evName) {
    document.addEventListener(evName, markActive, { passive: true });
  });
  (function idleSwimLoop() {
    setTimeout(function () {
      if (!document.hidden && Date.now() - lastActive > 45000 && !window.PrefersReducedMotion) {
        swimOnce(function () {});
      }
      idleSwimLoop();
    }, 50000 + Math.floor(Math.random() * 40000));
  })();

  /* 彩蛋：连打 codex 五个键，鱼群出动（输入框里打字不触发） */
  (function () {
    if (window.PrefersReducedMotion) return;
    var buf = "", lastFire = 0;
    document.addEventListener("keydown", function (e) {
      var tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!e.key || e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).slice(-5);
      if (buf !== "codex" || Date.now() - lastFire < 8000) return;
      lastFire = Date.now();
      buf = "";
      for (var i = 0; i < 6; i++) {
        (function (i) {
          setTimeout(function () {
            var s = document.createElement("div");
            s.className = "cod-swim";
            s.innerHTML = FISH;
            s.style.opacity = String(0.5 + 0.5 * Math.random());
            document.body.appendChild(s);
            var t0 = null, DUR = 1900 + Math.random() * 1300;
            var amp = 6 + Math.random() * 16, ph = Math.random() * 6.28, sp = 0.72 + Math.random() * 0.9;
            var W2 = window.innerWidth + 140;
            function frame(ts) {
              if (t0 == null) t0 = ts;
              var p = Math.min(1, (ts - t0) / DUR);
              var ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
              s.style.transform = "translateX(" + (ease * W2 * sp).toFixed(1) + "px) translateY(" +
                (Math.sin(p * Math.PI * 3 + ph) * amp).toFixed(1) + "px)";
              if (p < 1) requestAnimationFrame(frame);
              else s.remove();
            }
            requestAnimationFrame(frame);
          }, i * 170);
        })(i);
      }
      showToast("<b>小鳕</b> · 呼叫鱼群——全员出动！这个暗号都让你摸出来了。");
      if (window.CASound) CASound.play("grand");
    });
  })();

  /* 自检通关时，小鳕游过屏幕庆祝一下 + 一把彩纸 */
  document.addEventListener("ca:allclear", function () {
    CAConfetti.fire(false);
    var done2 = false;
    swimOnce(function () {
      if (done2) return;
      done2 = true;
      showToast("<b>小鳕</b> · ALL CLEAR！这条线路通关了。五条全通那天，我给你撒最大的那把彩纸。");
    });
    if (!window.PrefersReducedMotion) setTimeout(swimOnce, 700);
  });

  /* 五条线路全部通关（仅首次达成时由首页广播）：双倍游 + 大把彩纸 */
  document.addEventListener("ca:grandclear", function () {
    showToast("<b>小鳕</b> · 五条线路全部通关！从队列对到 WFP，这张地图现在归你了。");
    CAConfetti.fire(true);
    swimOnce(function () {});
    if (!window.PrefersReducedMotion) setTimeout(function () { swimOnce(function () {}); }, 800);
  });

  /* 答题反馈：答对原地一蹦，答错往下一沉。不弹提示，别打断做题。 */
  var reactTimer = null;
  document.addEventListener("ca:quiz", function (ev) {
    if (window.PrefersReducedMotion) return;
    var ok = !!(ev.detail && ev.detail.ok);
    pet.classList.remove("pet-happy", "pet-ouch");
    void pet.offsetWidth;
    pet.classList.add(ok ? "pet-happy" : "pet-ouch");
    if (reactTimer) clearTimeout(reactTimer);
    reactTimer = setTimeout(function () {
      pet.classList.remove("pet-happy", "pet-ouch");
    }, 900);
  });

  /* 眼神跟随光标：只动 cx/cy 属性，不碰 transform——眨眼动画走的是
     transform 轨道，两条轨道互不覆盖。悬停设备 + 未开减动效才启用。 */
  (function () {
    var CAN_HOVER = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!CAN_HOVER || window.PrefersReducedMotion) return;
    var eye = pet.querySelector(".cod-eye");
    if (!eye) return;
    var BX = parseFloat(eye.getAttribute("cx")), BY = parseFloat(eye.getAttribute("cy"));
    var raf = 0, tx = BX, ty = BY;
    document.addEventListener("pointermove", function (e) {
      var r = pet.getBoundingClientRect();
      /* 以鳕鱼身体中心为原点，把光标方向压进 1.3px 的瞳孔活动半径 */
      var ox = e.clientX - (r.left + r.width * 0.72);
      var oy = e.clientY - (r.top + r.height * 0.44);
      var d = Math.sqrt(ox * ox + oy * oy) || 1;
      var k = Math.min(1.3, d / 40) / d;
      tx = BX + ox * k; ty = BY + oy * k;
      if (!raf) {
        raf = requestAnimationFrame(function () {
          raf = 0;
          eye.setAttribute("cx", tx.toFixed(2));
          eye.setAttribute("cy", ty.toFixed(2));
        });
      }
    }, { passive: true });
  })();

  /* 全站速通收尾反应：按成绩说话，答得差就把最弱的那条线路指出来 */
  document.addEventListener("ca:speedrun", function (ev) {
    var d = ev.detail || {};
    var correct = d.correct || 0, total = d.total || 8;
    var LINE_NAMES = { "loop.html": "01 循环回路", "prompt.html": "02 输入组装",
      "sandbox.html": "03 权限沙箱", "appserver.html": "04 协议线路", "atlas.html": "05 Crate 图谱" };
    var weakest = null, worst = 2;
    try {
      var rec = window.CAProgress ? CAProgress.read() : {};
      Object.keys(LINE_NAMES).forEach(function (k) {
        if (rec[k] && rec[k].t) {
          var ratio = rec[k].c / rec[k].t;
          if (ratio < worst) { worst = ratio; weakest = LINE_NAMES[k]; }
        } else if (worst > 0) { worst = -1; weakest = LINE_NAMES[k] + "（还没做过自检）"; }
      });
    } catch (e) { /* 读不到进度就不点名 */ }
    var line;
    if (correct >= total) line = correct + "/" + total + "，满分收工。这站的出题人已经没什么可教你的了——去读真源码吧。";
    else if (correct * 2 >= total) line = correct + "/" + total + "，底子有了。" + (weakest ? "最不稳的是「" + weakest + "」，去把它的自检补完再回来。" : "五条线路的自检都过一遍，成绩还会涨。");
    else line = correct + "/" + total + "。别急，" + (weakest ? "先把「" + weakest + "」的自检补齐，再回来速通。" : "把五条线路的自检做完再来，成绩会不一样。");
    if (correct >= total) CAConfetti.fire(false);
    swimOnce(function () { showToast("<b>小鳕</b> · " + line); });
  });

  /* 升级播报：称号变了小鳕来报。ca-level 首次写入不播——老玩家回来
     不想被「恭喜升到路过」糊脸，只播之后真实发生的升级。 */
  (function () {
    var lvNow = CAXP.level(CAXP.calc());
    var prev = null;
    try { prev = localStorage.getItem("ca-level"); } catch (e) { /* 忽略 */ }
    if (prev === null) {
      try { localStorage.setItem("ca-level", String(lvNow)); } catch (e) { /* 忽略 */ }
      return;
    }
    if (lvNow > Number(prev)) {
      try { localStorage.setItem("ca-level", String(lvNow)); } catch (e) { /* 忽略 */ }
      CAConfetti.fire(false);
      swimOnce(function () {
        showToast("<b>小鳕</b> · 升级！称号「" + CAXP.levels[lvNow][1] + "」。XP 只算你真做过的事：自检、翻卡、速通、足迹。");
      });
    }
  })();

})();
