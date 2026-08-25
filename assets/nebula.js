/* ============================================================
   nebula.js — hero WebGL 星云层（零依赖，手写 fragment shader）
   学自 ciechanowski 的渲染质感与 INK Games 的「单画布 GPU 层」：
   fbm 值噪声星云 + 三层视差星野 + 指针微视差。
   · 无 WebGL / reduced-motion → 渲染一帧静态后停止（或直接降级）
   · 页面隐藏即暂停 rAF；DPR 封顶 1.5 保帧率
   ============================================================ */
(function () {
  "use strict";

  function mount(host) {
    if (!host) return false;
    var canvas = document.createElement("canvas");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
    canvas.setAttribute("aria-hidden", "true");
    host.insertBefore(canvas, host.firstChild);

    var gl = canvas.getContext("webgl", { antialias: false, alpha: true, premultipliedAlpha: false })
          || canvas.getContext("experimental-webgl");
    if (!gl) { canvas.remove(); return false; }

    var VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
    var FRAG = [
      "precision mediump float;",
      "uniform vec2 uRes;",
      "uniform float uT;",
      "uniform vec2 uMouse;",      // -1..1 视差
      "uniform float uGrain;",     // 滚动速度注入的颗粒强度
      "uniform float uCloud;",     // 云量 0..1
      "uniform float uHue;",       // 色相偏移（弧度）
      "",
      "vec3 hueRotate(vec3 c, float a){",
      "  const vec3 k=vec3(.57735);",
      "  float ca=cos(a), sa=sin(a);",
      "  return c*ca+cross(k,c)*sa+k*dot(k,c)*(1.-ca);}",
      "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
      "float noise(vec2 p){",
      "  vec2 i=floor(p),f=fract(p);",
      "  vec2 u=f*f*(3.-2.*f);",
      "  return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),",
      "             mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}",
      "float fbm(vec2 p){",
      "  float v=0.,a=.5;",
      "  for(int k=0;k<5;k++){v+=a*noise(p);p=p*2.03+vec2(17.3,9.1);a*=.55;}",
      "  return v;}",
      "",
      "void main(){",
      "  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;",
      "  float t=uT*.02;",
      "  vec2 par=uMouse*.035;",
      "",
      "  /* 星云：双域扭曲 fbm，琥珀×钢青双色；uCloud 控制云量对比 */",
      "  vec2 q=uv*1.6+par;",
      "  float w=fbm(q+t*.35);",
      "  float f=fbm(q+vec2(w*1.4,-w*.9)-t*.12);",
      "  float cover=mix(.15,.85,uCloud);",
      "  float body=smoothstep(cover-.35,cover+.35,f);",
      "  vec3 amber=vec3(1.0,.71,.33);",
      "  vec3 steel=vec3(.56,.78,.91);",
      "  vec3 col=mix(steel*mix(.42,.16,uCloud),amber*(.30+.30*uCloud),body);",
      "  col+=amber*pow(f,3.)*(.10+.24*uCloud);",
      "  col*=smoothstep(1.25,.15,length(uv));       // 边缘压暗",
      "  col*=mix(.70,.34+.30*f,uCloud);",
      "",
      "  /* 星野：三层视差闪烁 */",
      "  for(int l=0;l<3;l++){",
      "    float fl=float(l);",
      "    vec2 sp=(uv+.5*uMouse*(.008+.010*fl))*pow(2.1,fl+2.);",
      "    sp+=floor(t*8.*pow(.5,fl))/pow(2.1,fl+2.);",
      "    vec2 id=floor(sp),gv=fract(sp)-.5;",
      "    float h=hash(id+fl*31.7);",
      "    if(h>.93){",
      "      float tw=.55+.45*sin(uT*(1.5+h)+h*40.);",
      "      float d=length(gv-(vec2(hash(id+7.),hash(id+13.))-.5)*.6);",
      "      col+=vec3(1.,.92,.78)*smoothstep(.09,.0,d)*tw*(.32-.07*fl);",
      "    }",
      "  }",
      "",
      "  col+=(hash(gl_FragCoord.xy+uT)-.5)*uGrain;   // 滚动速度→颗粒",
      "  col=hueRotate(max(col,0.0), uHue);           // 访客可拖的色相偏移",
      "  gl_FragColor=vec4(col,1.);",
      "}"
    ].join("\n");

    function shader(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn("nebula shader:", gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }
    var vs = shader(gl.VERTEX_SHADER, VERT), fs = shader(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { canvas.remove(); return false; }
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return false; }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var locP = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(locP);
    gl.vertexAttribPointer(locP, 2, gl.FLOAT, false, 0, 0);

    var uRes = gl.getUniformLocation(prog, "uRes");
    var uT = gl.getUniformLocation(prog, "uT");
    var uM = gl.getUniformLocation(prog, "uMouse");
    var uG = gl.getUniformLocation(prog, "uGrain");
    var uCloud = gl.getUniformLocation(prog, "uCloud");
    var uHue = gl.getUniformLocation(prog, "uHue");

    /* 访客可玩参数：云量 / 色相 / 流速（setParam 更新并保证至少一帧生效） */
    var params = { cloud: 0.55, hue: 0, speed: 1 };
    var t0 = null, tOff = 12.3;

    var W = 0, H = 0;
    function resize() {
      var r = host.getBoundingClientRect();
      var dpr = Math.min(1.5, window.devicePixelRatio || 1);
      W = Math.max(1, Math.round(r.width * dpr));
      H = Math.max(1, Math.round(r.height * dpr));
      canvas.width = W; canvas.height = H;
      gl.viewport(0, 0, W, H);
      gl.uniform2f(uRes, W, H);
    }
    resize();
    window.addEventListener("resize", function () {
      clearTimeout(canvas.__rz);
      canvas.__rz = setTimeout(resize, 140);
    });

    /* 指针视差：lerp 平滑（0.06——比卡片慢，星云是远景） */
    var tx = 0, ty = 0, mx = 0, my = 0;
    var hero = host.closest("section") || document.body;
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = -((e.clientY - r.top) / r.height - 0.5) * 2;
    });
    hero.addEventListener("pointerleave", function () { tx = 0; ty = 0; });

    /* 滚动速度 → 颗粒强度（zenith-interface 的动态 film grain） */
    var lastY = window.scrollY, grain = 0, grainT = 0;
    function onScroll() {
      var v = Math.min(1, Math.abs(window.scrollY - lastY) / 90);
      lastY = window.scrollY;
      grainT = Math.max(grainT, v * 0.16);
    }
    window.addEventListener("scroll", onScroll, { passive: true });

    var REDUCED = window.PrefersReducedMotion === true;
    var running = false, raf = 0;
    var FPS_CAP = 30, lastPaint = 0;   /* 慢漂移背景 30fps 与 60fps 视觉等价，GPU 减半 */

    function paint(timeSec) {
      gl.uniform1f(uT, timeSec);
      gl.uniform2f(uM, mx, my);
      gl.uniform1f(uG, grain);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function frame(now) {
      raf = 0;
      if (t0 === null) t0 = now;
      if (now - lastPaint < 1000 / FPS_CAP - 2) {
        raf = requestAnimationFrame(frame);      /* 未到节拍：跳帧不重绘 */
        return;
      }
      lastPaint = now;
      mx += (tx - mx) * 0.06;
      my += (ty - my) * 0.06;
      grainT *= 0.92;
      grain += (grainT - grain) * 0.2;
      paint((now - t0) / 1000 * params.speed + tOff);
      if (running && !REDUCED) raf = requestAnimationFrame(frame);
      else raf = 0;
    }
    function start() {
      if (running || REDUCED) return;
      running = true;
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }

    /* 静止时也要有第一帧（reduced-motion / 唤醒前） */
    paint(tOff);

    /* 离屏与页签隐藏共用一个闸门：任一不满足就停，别让星云在看不见时烧 GPU */
    var ioOn = true;
    function gate() {
      if (ioOn && !document.hidden) start();
      else stop();
    }

    document.addEventListener("visibilitychange", gate);

    /* 与页面其他仪器共用可见性节流：离开视口就睡 */
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (en) { ioOn = en.isIntersecting; gate(); });
      }, { rootMargin: "10% 0px" }).observe(host);
    } else start();

    window.CANebula.setParam = function (name, value) {
      if (!(name in params)) return false;
      params[name] = value;
      if (!running) {                     // 静帧（reduced-motion / 离屏）也要即时生效
        var now = performance.now();
        if (t0 === null) t0 = now;
        paint((now - t0) / 1000 * params.speed + tOff);
      }
      return true;
    };
    window.CANebula.params = function () {
      return { cloud: params.cloud, hue: params.hue, speed: params.speed };
    };

    return true;
  }

  window.CANebula = { mount: mount };
})();
