/* Infinity Fitness Gym — hero 3D
   A glowing LED "infinity" tube rendered with raw WebGL2 + a small bloom chain.
   No libraries. Falls back to an SVG loop when WebGL2 isn't available. */
(function () {
  'use strict';
  const canvas = document.getElementById('gl');
  if (!canvas) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'high-performance' });
  if (!gl) { document.documentElement.classList.add('no-gl'); return; }

  const hdr = !!gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('OES_texture_float_linear');
  const IFMT = hdr ? gl.RGBA16F : gl.RGBA8;
  const TTYPE = hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;

  /* ---------- tiny mat4 ---------- */
  const M = {
    id: () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]),
    mul(a, b) { const o = new Float32Array(16);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
        o[c*4+r] = a[r]*b[c*4] + a[4+r]*b[c*4+1] + a[8+r]*b[c*4+2] + a[12+r]*b[c*4+3]; }
      return o; },
    persp(fov, asp, n, f) { const t = 1 / Math.tan(fov / 2), o = new Float32Array(16);
      o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o; },
    trans(x, y, z) { const o = M.id(); o[12] = x; o[13] = y; o[14] = z; return o; },
    scale(x, y, z) { const o = M.id(); o[0] = x; o[5] = y; o[10] = z; return o; },
    rx(a) { const o = M.id(), c = Math.cos(a), s = Math.sin(a); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o; },
    ry(a) { const o = M.id(), c = Math.cos(a), s = Math.sin(a); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o; },
    rz(a) { const o = M.id(), c = Math.cos(a), s = Math.sin(a); o[0] = c; o[1] = s; o[4] = -s; o[5] = c; return o; }
  };

  /* ---------- geometry: tube along a lemniscate ---------- */
  function curve(t) {
    const s = Math.sin(t), c = Math.cos(t), d = 1 + s * s, A = 1.65;
    return [A * c / d, A * s * c / d * 1.08, 0.3 * s];
  }
  function buildTube(N, R, rad) {
    const pts = [], tan = [];
    for (let i = 0; i <= N; i++) pts.push(curve(i / N * Math.PI * 2));
    for (let i = 0; i <= N; i++) {
      const a = pts[(i - 1 + N) % N], b = pts[(i + 1) % N];
      const d = [b[0]-a[0], b[1]-a[1], b[2]-a[2]], l = Math.hypot(...d);
      tan.push([d[0]/l, d[1]/l, d[2]/l]);
    }
    // rotation-minimising frames (double reflection)
    const cross = (u, v) => [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
    const dot = (u, v) => u[0]*v[0]+u[1]*v[1]+u[2]*v[2];
    const norm = (u) => { const l = Math.hypot(...u); return [u[0]/l, u[1]/l, u[2]/l]; };
    let n0 = norm(cross(tan[0], [0, 0, 1]));
    const nor = [n0];
    for (let i = 0; i < N; i++) {
      const v1 = [pts[i+1][0]-pts[i][0], pts[i+1][1]-pts[i][1], pts[i+1][2]-pts[i][2]];
      const c1 = dot(v1, v1), rL = nor[i], tL = tan[i];
      const rl = [rL[0]-2/c1*dot(v1,rL)*v1[0], rL[1]-2/c1*dot(v1,rL)*v1[1], rL[2]-2/c1*dot(v1,rL)*v1[2]];
      const tl = [tL[0]-2/c1*dot(v1,tL)*v1[0], tL[1]-2/c1*dot(v1,tL)*v1[1], tL[2]-2/c1*dot(v1,tL)*v1[2]];
      const v2 = [tan[i+1][0]-tl[0], tan[i+1][1]-tl[1], tan[i+1][2]-tl[2]], c2 = dot(v2, v2);
      nor.push(norm([rl[0]-2/c2*dot(v2,rl)*v2[0], rl[1]-2/c2*dot(v2,rl)*v2[1], rl[2]-2/c2*dot(v2,rl)*v2[2]]));
    }
    // close the twist seam
    const bi0 = cross(tan[0], nor[0]);
    let twist = Math.atan2(dot(nor[N], bi0), dot(nor[N], nor[0]));
    const V = [], I = [];
    for (let i = 0; i <= N; i++) {
      const T = tan[i]; let Nn = nor[i]; const B0 = cross(T, Nn);
      const a = -twist * i / N, ca = Math.cos(a), sa = Math.sin(a);
      Nn = [Nn[0]*ca + B0[0]*sa, Nn[1]*ca + B0[1]*sa, Nn[2]*ca + B0[2]*sa];
      const B = cross(T, Nn), P = pts[i];
      for (let j = 0; j <= rad; j++) {
        const th = j / rad * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th);
        const nx = Nn[0]*cs + B[0]*sn, ny = Nn[1]*cs + B[1]*sn, nz = Nn[2]*cs + B[2]*sn;
        V.push(P[0]+nx*R, P[1]+ny*R, P[2]+nz*R, nx, ny, nz, i / N);
      }
    }
    const W = rad + 1;
    for (let i = 0; i < N; i++) for (let j = 0; j < rad; j++) {
      const a = i*W+j, b = (i+1)*W+j; I.push(a, b, a+1, b, b+1, a+1);
    }
    return { v: new Float32Array(V), i: new Uint32Array(I) };
  }

  /* ---------- shaders ---------- */
  const VS_TUBE = `#version 300 es
  layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in float aU;
  uniform mat4 uP, uV, uM; out vec3 vN; out vec3 vW; out float vU;
  void main(){ vec4 w = uM*vec4(aPos,1.); vW=w.xyz; vN=mat3(uM)*aNor; vU=aU; gl_Position=uP*uV*w; }`;
  const FS_TUBE = `#version 300 es
  precision highp float;
  in vec3 vN; in vec3 vW; in float vU; out vec4 o;
  uniform vec3 uCam; uniform float uT, uReveal, uRefl, uFloorY;
  void main(){
    float head = uReveal;
    if(vU > head) discard;
    vec3 n = normalize(vN); vec3 v = normalize(uCam - vW);
    float ndv = abs(dot(n,v));
    vec3 blue = vec3(0.086,0.663,0.906);
    vec3 core = vec3(0.80,0.95,1.0);
    vec3 col = mix(blue*0.8, core, pow(ndv, 6.0)*0.8);
    col += blue * pow(1.0-ndv, 2.5) * 0.9;
    // LED chase: two comets running around the loop
    float p1 = fract(vU - uT*0.075), p2 = fract(vU - uT*0.075 + 0.5);
    float c = exp(-p1*26.0) + exp(-p2*26.0);
    float glowHead = (uReveal < 1.0) ? exp(-(head - vU)*60.0)*3.0 : 0.0;
    col *= 0.95 + c*2.4 + glowHead;
    if(uRefl > 0.5){
      float d = clamp((uFloorY - vW.y)/1.4, 0.0, 1.0);
      col *= 0.16 * (1.0 - d);
    }
    o = vec4(col, 1.0);
  }`;
  const VS_Q = `#version 300 es
  const vec2 p[3]=vec2[3](vec2(-1,-1),vec2(3,-1),vec2(-1,3));
  out vec2 vUv; void main(){ vUv=p[gl_VertexID]*.5+.5; gl_Position=vec4(p[gl_VertexID],0,1); }`;
  const FS_BRIGHT = `#version 300 es
  precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform vec2 uTexel; uniform float uThr;
  void main(){
    vec3 c = texture(uTex, vUv + uTexel*vec2(-.5,-.5)).rgb + texture(uTex, vUv + uTexel*vec2(.5,-.5)).rgb
           + texture(uTex, vUv + uTexel*vec2(-.5,.5)).rgb + texture(uTex, vUv + uTexel*vec2(.5,.5)).rgb;
    c *= .25; float l = max(c.r, max(c.g, c.b));
    float k = uThr > 0.0 ? smoothstep(uThr, uThr + 0.85, l) : 1.0;
    o = vec4(c * k, 1.);
  }`;
  const FS_BLUR = `#version 300 es
  precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform vec2 uDir;
  void main(){
    vec3 c = texture(uTex, vUv).rgb * 0.2270270270;
    c += texture(uTex, vUv + uDir*1.3846153846).rgb * 0.3162162162;
    c += texture(uTex, vUv - uDir*1.3846153846).rgb * 0.3162162162;
    c += texture(uTex, vUv + uDir*3.2307692308).rgb * 0.0702702703;
    c += texture(uTex, vUv - uDir*3.2307692308).rgb * 0.0702702703;
    o = vec4(c, 1.);
  }`;
  const FS_COMP = `#version 300 es
  precision highp float; in vec2 vUv; out vec4 o;
  uniform sampler2D uScene, uB1, uB2; uniform float uFade;
  void main(){
    vec3 c = texture(uScene, vUv).rgb + texture(uB1, vUv).rgb*1.1 + texture(uB2, vUv).rgb*1.6;
    c = 1.0 - exp(-c*1.05);
    float a = clamp(max(c.r, max(c.g, c.b))*1.25, 0., 1.);
    o = vec4(c, a) * uFade;
  }`;

  function prog(vs, fs) {
    const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }

  let P;
  try {
    P = { tube: prog(VS_TUBE, FS_TUBE), bright: prog(VS_Q, FS_BRIGHT), blur: prog(VS_Q, FS_BLUR), comp: prog(VS_Q, FS_COMP) };
  } catch (e) { console.warn(e); document.documentElement.classList.add('no-gl'); return; }

  const geo = buildTube(720, 0.082, 28);
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, geo.v, gl.STATIC_DRAW);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.i, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 28, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 28, 24);
  gl.bindVertexArray(null);
  const emptyVao = gl.createVertexArray();

  /* ---------- render targets ---------- */
  function tex(w, h) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, IFMT, w, h, 0, gl.RGBA, TTYPE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function fbo(t) { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return f; }
  let RT = null;
  function makeTargets(w, h) {
    if (RT) { RT.del.forEach(fn => fn()); }
    const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
    const msFb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, msFb);
    const cRb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, cRb);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, IFMT, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, cRb);
    const dRb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, dRb);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, dRb);
    const sceneT = tex(w, h), sceneF = fbo(sceneT);
    const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1), qw = Math.max(1, w >> 3), qh = Math.max(1, h >> 3);
    const h1 = tex(hw, hh), h2 = tex(hw, hh), q1 = tex(qw, qh), q2 = tex(qw, qh);
    RT = { w, h, hw, hh, qw, qh, msFb, sceneT, sceneF, h1, h2, q1, q2, h1F: fbo(h1), h2F: fbo(h2), q1F: fbo(q1), q2F: fbo(q2),
      del: [() => gl.deleteFramebuffer(msFb), () => gl.deleteRenderbuffer(cRb), () => gl.deleteRenderbuffer(dRb)] };
    [sceneT, h1, h2, q1, q2].forEach(t => RT.del.push(() => gl.deleteTexture(t)));
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /* ---------- state ---------- */
  let W = 0, H = 0, dpr = 1;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const still = /[?&]still/.test(location.search);
  let scrollP = 0, sp = 0, reveal = (reduce || still) ? 1 : 0, started = reduce || still, visible = true, t0 = performance.now();
  const hero = document.getElementById('hero');

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, W > 1400 ? 1.5 : 1.75);
    W = canvas.clientWidth; H = canvas.clientHeight;
    const w = Math.max(2, Math.round(W * dpr)), h = Math.max(2, Math.round(H * dpr));
    if (!RT || canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; makeTargets(w, h); }
  }
  addEventListener('resize', resize);
  addEventListener('pointermove', e => { mouse.tx = e.clientX / innerWidth * 2 - 1; mouse.ty = e.clientY / innerHeight * 2 - 1; }, { passive: true });
  addEventListener('scroll', () => { scrollP = Math.min(1, Math.max(0, scrollY / (hero.offsetHeight || 1))); }, { passive: true });
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) loop(); }).observe(hero);
  window.addEventListener('infinity:start', () => { started = true; t0 = performance.now(); });

  function quad(p) { gl.useProgram(p.p); gl.bindVertexArray(emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3); }
  function bindTex(unit, t, loc) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, unit); }

  let raf = 0, last = performance.now(), T = 0;
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!reduce) T += dt;
    if (started && reveal < 1) reveal = Math.min(1, reveal + dt / 1.9);
    mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 3.2);
    mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 3.2);
    sp += (scrollP - sp) * Math.min(1, dt * 6);

    const asp = W / H, wide = asp > 1.05;
    const proj = M.persp(35 * Math.PI / 180, asp, 0.1, 50);
    const cam = [0, 0, 7.2 - sp * 3.2];
    const view = M.trans(-cam[0], -cam[1], -cam[2]);
    const ox = wide ? Math.min(1.9, 0.7 + (asp - 1) * 0.95) : 0;
    const oy = wide ? 0.98 : 1.2;
    const sc = wide ? 0.8 : Math.min(0.8, asp * 1.12);
    const ease = 1 - Math.pow(1 - reveal, 3);
    let model = M.trans(ox * (1 - sp * .6), oy + sp * 0.4, 0);
    model = M.mul(model, M.scale(sc * (0.9 + ease * 0.1), sc * (0.9 + ease * 0.1), sc));
    model = M.mul(model, M.rx(-0.28 + mouse.y * 0.22 + sp * 1.25 + (reduce ? 0 : Math.sin(T * 0.4) * 0.05)));
    model = M.mul(model, M.ry(-0.35 + mouse.x * 0.45 + (reduce ? 0 : Math.sin(T * 0.23) * 0.22) + sp * 0.6));
    model = M.mul(model, M.rz(0.04 + sp * 0.2));
    const floorY = oy - 1.25;
    const refl = M.mul(M.mul(M.trans(0, floorY, 0), M.scale(1, -1, 1)), M.mul(M.trans(0, -floorY, 0), model));

    // 1) scene into MSAA buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, RT.msFb); gl.viewport(0, 0, RT.w, RT.h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    const tp = P.tube; gl.useProgram(tp.p); gl.bindVertexArray(vao);
    gl.uniformMatrix4fv(tp.u.uP, false, proj); gl.uniformMatrix4fv(tp.u.uV, false, view);
    gl.uniform3fv(tp.u.uCam, cam); gl.uniform1f(tp.u.uT, T); gl.uniform1f(tp.u.uReveal, started ? ease * 1.001 : 0);
    gl.uniform1f(tp.u.uFloorY, floorY);
    if (wide) { gl.uniformMatrix4fv(tp.u.uM, false, refl); gl.uniform1f(tp.u.uRefl, 1); gl.drawElements(gl.TRIANGLES, geo.i.length, gl.UNSIGNED_INT, 0); }
    gl.uniformMatrix4fv(tp.u.uM, false, model); gl.uniform1f(tp.u.uRefl, 0);
    gl.drawElements(gl.TRIANGLES, geo.i.length, gl.UNSIGNED_INT, 0);
    gl.disable(gl.DEPTH_TEST);

    // resolve
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, RT.msFb); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, RT.sceneF);
    gl.blitFramebuffer(0, 0, RT.w, RT.h, 0, 0, RT.w, RT.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);

    // 2) bright pass -> half
    gl.bindFramebuffer(gl.FRAMEBUFFER, RT.h1F); gl.viewport(0, 0, RT.hw, RT.hh);
    gl.useProgram(P.bright.p); bindTex(0, RT.sceneT, P.bright.u.uTex); gl.uniform2f(P.bright.u.uTexel, 1 / RT.w, 1 / RT.h); gl.uniform1f(P.bright.u.uThr, 0.35); quad(P.bright);
    // blur half
    gl.useProgram(P.blur.p);
    for (let k = 0; k < 2; k++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, RT.h2F); bindTex(0, RT.h1, P.blur.u.uTex); gl.uniform2f(P.blur.u.uDir, (1 + k) / RT.hw, 0); quad(P.blur);
      gl.bindFramebuffer(gl.FRAMEBUFFER, RT.h1F); bindTex(0, RT.h2, P.blur.u.uTex); gl.uniform2f(P.blur.u.uDir, 0, (1 + k) / RT.hh); quad(P.blur);
    }
    // 3) wide glow at 1/8
    gl.bindFramebuffer(gl.FRAMEBUFFER, RT.q1F); gl.viewport(0, 0, RT.qw, RT.qh);
    gl.useProgram(P.bright.p); bindTex(0, RT.h1, P.bright.u.uTex); gl.uniform2f(P.bright.u.uTexel, 1 / RT.hw, 1 / RT.hh); gl.uniform1f(P.bright.u.uThr, 0.0); quad(P.bright);
    gl.useProgram(P.blur.p);
    for (let k = 0; k < 3; k++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, RT.q2F); bindTex(0, RT.q1, P.blur.u.uTex); gl.uniform2f(P.blur.u.uDir, 1.5 / RT.qw, 0); quad(P.blur);
      gl.bindFramebuffer(gl.FRAMEBUFFER, RT.q1F); bindTex(0, RT.q2, P.blur.u.uTex); gl.uniform2f(P.blur.u.uDir, 0, 1.5 / RT.qh); quad(P.blur);
    }
    // 4) composite to canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, RT.w, RT.h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const c = P.comp; gl.useProgram(c.p);
    bindTex(0, RT.sceneT, c.u.uScene); bindTex(1, RT.h1, c.u.uB1); bindTex(2, RT.q1, c.u.uB2);
    gl.uniform1f(c.u.uFade, 1 - Math.max(0, (sp - 0.55) / 0.45));
    quad(c);

    if (visible && !reduce) loop();
    else if (reduce && started && reveal < 1) loop();
  }
  function loop() { if (!raf) raf = requestAnimationFrame(frame); }

  resize();
  loop();
  if (reduce) { started = true; reveal = 1; }
  // redraw once for reduced motion on resize / scroll
  if (reduce) { addEventListener('resize', loop); addEventListener('scroll', loop, { passive: true }); addEventListener('pointermove', loop, { passive: true }); }
})();
