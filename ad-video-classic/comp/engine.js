// A small WebGL2 engine for the classical-art ad: paintings as depth-displaced 3D surfaces, textured planes,
// extruded 3D text, write-on calligraphy, scenes rendered into textures (for zoom-through cuts), and a film
// finish (grade, vignette, grain). Deterministic: frame t always gives the same picture.
(() => {
  'use strict';
  const W = 1920, H = 1080;
  const canvas = document.getElementById('c');
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false, alpha: false });
  if (!gl) throw new Error('no webgl2');

  // ---------- math ----------
  const M = {
    persp(fovDeg, aspect, near, far) {
      const f = 1 / Math.tan((fovDeg * Math.PI) / 360), nf = 1 / (near - far);
      return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
    },
    lookAt(e, c, up = [0, 1, 0]) {
      let z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]];
      let l = Math.hypot(...z); z = z.map((v) => v / l);
      let x = [up[1] * z[2] - up[2] * z[1], up[2] * z[0] - up[0] * z[2], up[0] * z[1] - up[1] * z[0]];
      l = Math.hypot(...x); x = x.map((v) => v / l);
      const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
      return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
        -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1];
    },
    mul(a, b) {
      const o = new Array(16);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s;
      }
      return o;
    },
    // model = T * Rz * Ry * Rx * S   (degrees)
    model(p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
      const [rx, ry, rz] = r.map((d) => (d * Math.PI) / 180);
      const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
      const Rx = [1, 0, 0, 0, 0, cx, sx, 0, 0, -sx, cx, 0, 0, 0, 0, 1];
      const Ry = [cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1];
      const Rz = [cz, sz, 0, 0, -sz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      const S = [s[0], 0, 0, 0, 0, s[1], 0, 0, 0, 0, s[2], 0, 0, 0, 0, 1];
      const T = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, p[0], p[1], p[2], 1];
      return M.mul(T, M.mul(Rz, M.mul(Ry, M.mul(Rx, S))));
    },
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = {
    io: (x) => { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
    out: (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3),
    in: (x) => Math.pow(clamp(x, 0, 1), 3),
    sine: (x) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x, 0, 1)),
    expo: (x) => { x = clamp(x, 0, 1); return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); },
    back: (x) => { x = clamp(x, 0, 1); const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    lin: (x) => clamp(x, 0, 1),
  };
  // keyframes: [[t, value(s)], ...] with an easing per segment (k[2]) — values may be numbers or arrays
  function track(keys, t, defEase = ease.io) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [t0, a] = keys[i - 1], [t1, b, e] = keys[i];
        const k = (e || defEase)((t - t0) / Math.max(1e-6, t1 - t0));
        return Array.isArray(a) ? a.map((v, j) => lerp(v, b[j], k)) : lerp(a, b, k);
      }
    }
    return keys[keys.length - 1][1];
  }
  // deterministic noise
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  // ---------- GL helpers ----------
  function shader(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
    return s;
  }
  function program(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl.VERTEX_SHADER, vs)); gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  function grid(nx, ny) {
    const uv = [], idx = [];
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) uv.push(i / nx, j / ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: idx.length };
  }

  const VS = `#version 300 es
  layout(location=0) in vec2 a_uv;
  uniform mat4 u_proj, u_view, u_model;
  uniform sampler2D u_depth;
  uniform vec4 u_uvRect;     // part of the texture shown (u0, v0, u1, v1)
  uniform vec2 u_size;       // plane size in world units
  uniform float u_depthAmt, u_depthMid, u_useDepth, u_curl;
  out vec2 v_uv; out vec2 v_q; out float v_d;
  void main() {
    vec2 uv = mix(u_uvRect.xy, u_uvRect.zw, a_uv);
    float d = u_useDepth > 0.5 ? texture(u_depth, uv).r : 0.5;
    vec3 p = vec3((a_uv.x - 0.5) * u_size.x, (0.5 - a_uv.y) * u_size.y, (d - u_depthMid) * u_depthAmt * u_useDepth);
    p.z += u_curl * (a_uv.x - 0.5) * (a_uv.x - 0.5) * u_size.x;   // a page that bends a little
    v_uv = uv; v_q = a_uv; v_d = d;
    gl_Position = u_proj * u_view * u_model * vec4(p, 1.0);
  }`;
  const FS = `#version 300 es
  precision highp float;
  in vec2 v_uv; in vec2 v_q; in float v_d;
  uniform sampler2D u_tex, u_tex2, u_reveal;
  uniform float u_opacity, u_mix, u_bright, u_sat, u_maskLo, u_maskHi, u_alphaCut, u_revealT, u_useReveal, u_solid, u_edge;
  uniform vec3 u_color, u_tint;
  out vec4 o;
  void main() {
    vec4 c = texture(u_tex, v_uv);
    if (u_mix > 0.0) c = mix(c, texture(u_tex2, v_uv), u_mix);
    float a = c.a * u_opacity;
    if (u_maskHi > u_maskLo) a *= smoothstep(u_maskLo, u_maskHi, v_d);
    if (u_useReveal > 0.5) { float r = texture(u_reveal, v_q).r; a *= smoothstep(r - 0.004, r + 0.004, u_revealT); }
    if (u_edge > 0.0) { vec2 e = smoothstep(vec2(0.0), vec2(u_edge), v_q) * smoothstep(vec2(0.0), vec2(u_edge), 1.0 - v_q); a *= e.x * e.y; }
    if (a <= u_alphaCut) discard;
    vec3 rgb = u_solid > 0.5 ? u_color : c.rgb;
    float l = dot(rgb, vec3(0.299, 0.587, 0.114));
    rgb = mix(vec3(l), rgb, u_sat) * u_bright * u_tint;
    o = vec4(rgb, a);
  }`;
  const PVS = `#version 300 es
  layout(location=0) in vec2 a_uv; out vec2 v_uv;
  void main() { v_uv = a_uv; gl_Position = vec4(a_uv * 2.0 - 1.0, 0.0, 1.0); }`;
  const PFS = `#version 300 es
  precision highp float;
  in vec2 v_uv; uniform sampler2D u_a, u_b, u_bloom;
  uniform float u_mixAB, u_vig, u_grain, u_seed, u_ca, u_fadeAmt, u_lift, u_warm, u_contrast, u_blurDir;
  uniform float u_bloomAmt, u_leak, u_time, u_flash;
  uniform vec3 u_fade;
  out vec4 o;
  float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + u_seed) * 43758.5453); }
  vec3 samp(sampler2D s, vec2 uv) {
    vec2 d = (uv - 0.5) * u_ca;
    return vec3(texture(s, uv + d).r, texture(s, uv).g, texture(s, uv - d).b);
  }
  void main() {
    vec2 uv = v_uv;
    vec3 a = samp(u_a, uv), b = samp(u_b, uv);
    vec3 c = mix(a, b, u_mixAB);
    // bloom with a warm halation tint
    vec3 bl = texture(u_bloom, uv).rgb;
    c += bl * u_bloomAmt * vec3(1.0, 0.82, 0.62);
    // drifting light leaks from the edges (warm), slow
    vec2 p1 = vec2(0.1 + 0.25 * sin(u_time * 0.21), 0.85 + 0.1 * cos(u_time * 0.17));
    vec2 p2 = vec2(0.95 - 0.2 * cos(u_time * 0.13), 0.15 + 0.2 * sin(u_time * 0.19));
    float l1 = exp(-pow(length((uv - p1) * vec2(1.6, 1.0)) / 0.45, 2.0));
    float l2 = exp(-pow(length((uv - p2) * vec2(1.6, 1.0)) / 0.38, 2.0));
    c += u_leak * (l1 * vec3(1.0, 0.45, 0.18) + l2 * vec3(1.0, 0.7, 0.35)) * (0.75 + 0.25 * sin(u_time * 1.3));
    c *= 1.0 + u_flash;
    // grade: gentle contrast, warm highlights, lifted blacks
    c = (c - 0.5) * u_contrast + 0.5;
    c = mix(c, c * vec3(1.06, 1.0, 0.9), u_warm);
    c = c * (1.0 - u_lift) + u_lift * vec3(0.06, 0.045, 0.04);
    float r = length((uv - 0.5) * vec2(1.0, 0.82));
    c *= 1.0 - u_vig * smoothstep(0.38, 0.95, r);
    c = mix(c, u_fade, u_fadeAmt);
    c += (h(uv * vec2(1920.0, 1080.0)) - 0.5) * u_grain;
    o = vec4(clamp(c, 0.0, 1.0), 1.0);
  }`;

  const prog = program(VS, FS);
  const post = program(PVS, PFS);
  const MESH = grid(220, 220);
  const QUAD = grid(1, 1);
  const PAGE = grid(40, 8);

  // ---------- textures ----------
  const textures = {};
  function texFromSource(src, { mip = true, clampEdge = true } = {}) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const wrap = clampEdge ? gl.CLAMP_TO_EDGE : gl.REPEAT;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext && mip) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    return { t, w: src.width, h: src.height, aspect: src.width / src.height };
  }
  async function loadTex(key, url, opts) {
    const img = new Image(); img.src = url; await img.decode();
    textures[key] = texFromSource(img, opts);
    return textures[key];
  }
  { const c = document.createElement('canvas'); c.width = c.height = 2; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 2, 2); textures.white = texFromSource(c, { mip: false }); }
  { const c = document.createElement('canvas'); c.width = c.height = 2; const x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, 2, 2); textures.grey = texFromSource(c, { mip: false }); }

  // text (and its write-on order map) drawn with the page's fonts
  const textCache = {};
  // font: 'Family' or 'style weight|Family' (e.g. 'italic|Fell', '700|Cinzel')
  const fontStr = (font, size) => { const [pre, fam] = font.includes('|') ? font.split('|') : ['', font]; return `${pre} ${size}px ${fam}`.trim(); };
  function textTex(key, lines, { font, size = 200, color = '#fff', align = 'center', lineH = 1.05, pad = 0.18, letter = 0, stroke = null, shadow = null, reveal = false, slant = 0 } = {}) {
    if (textCache[key]) return textCache[key];
    const c = document.createElement('canvas'), x = c.getContext('2d');
    x.font = fontStr(font, size);
    if (letter) x.letterSpacing = `${letter}px`;
    const widths = lines.map((l) => x.measureText(l).width);
    const tw = Math.max(...widths), padPx = size * pad;
    c.width = Math.ceil(tw + padPx * 2 + Math.abs(slant) * size); c.height = Math.ceil(size * lineH * lines.length + padPx * 2);
    x.font = fontStr(font, size); if (letter) x.letterSpacing = `${letter}px`;
    x.textBaseline = 'alphabetic'; x.fillStyle = color;
    const base = (i) => padPx + size * lineH * i + size * 0.82;
    const left = (i) => (align === 'center' ? (c.width - widths[i]) / 2 : align === 'right' ? c.width - padPx - widths[i] : padPx);
    if (shadow) { x.shadowColor = shadow.color; x.shadowBlur = shadow.blur; x.shadowOffsetX = shadow.x || 0; x.shadowOffsetY = shadow.y || 0; }
    lines.forEach((l, i) => {
      if (stroke) { x.lineWidth = stroke.w; x.strokeStyle = stroke.color; x.strokeText(l, left(i), base(i)); }
      x.fillText(l, left(i), base(i));
    });
    const out = { tex: texFromSource(c), w: c.width, h: c.height, aspect: c.width / c.height };
    if (reveal) {
      // writing order: line by line, left to right, following the ink
      const r = document.createElement('canvas'); r.width = c.width; r.height = c.height;
      const rx = r.getContext('2d'); const img = rx.createImageData(c.width, c.height);
      const n = lines.length;
      for (let y = 0; y < c.height; y++) {
        const li = clamp(Math.floor((y - padPx) / (size * lineH)), 0, n - 1);
        const x0 = left(li), x1 = left(li) + widths[li];
        for (let xx = 0; xx < c.width; xx++) {
          const fx = clamp((xx - x0) / Math.max(1, x1 - x0), 0, 1);
          const v = Math.round(clamp((li + fx) / n, 0, 1) * 250 + 2);
          const k = (y * c.width + xx) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255;
        }
      }
      rx.putImageData(img, 0, 0);
      out.reveal = texFromSource(r, { mip: false });
    }
    textCache[key] = out;
    return out;
  }
  // glyph advances for laying out single letters
  function measure(str, font, size, letter = 0) {
    const c = document.createElement('canvas').getContext('2d'); c.font = fontStr(font, size); if (letter) c.letterSpacing = `${letter}px`;
    return [...str].map((ch) => c.measureText(ch).width);
  }

  // ---------- framebuffers ----------
  const fbos = {};
  function fbo(name, w = W, h = H) {
    if (fbos[name]) return fbos[name];
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    fbos[name] = { f, tex: { t, w, h, aspect: w / h }, w, h };
    return fbos[name];
  }

  // ---------- drawing ----------
  let cam = { proj: M.persp(40, W / H, 0.01, 200), view: M.lookAt([0, 0, 2.747], [0, 0, 0]) };
  const D0 = 1 / Math.tan((20 * Math.PI) / 180);   // camera distance at which a plane 2 units tall fills the frame (fov 40)
  function camera({ pos = [0, 0, D0], target = null, fov = 40, roll = 0 } = {}) {
    const tg = target || [pos[0], pos[1], pos[2] - 1];
    const up = [Math.sin((roll * Math.PI) / 180), Math.cos((roll * Math.PI) / 180), 0];
    cam = { proj: M.persp(fov, W / H, 0.01, 200), view: M.lookAt(pos, tg, up) };
  }
  function begin(target, clear = [0, 0, 0]) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.f : null);
    gl.viewport(0, 0, target ? target.w : W, target ? target.h : H);
    gl.clearColor(clear[0], clear[1], clear[2], 1); gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
  function bindTex(unit, tex, loc) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, (tex || textures.white).t); gl.uniform1i(loc, unit); }

  // draw a plane: tex, size [w,h], pos, rot, scale; options for depth relief, masks, reveal, solid colour
  function draw(o) {
    const { u } = prog; gl.useProgram(prog.p);
    const mesh = o.depth ? MESH : o.curl ? PAGE : QUAD;
    gl.uniformMatrix4fv(u.u_proj, false, cam.proj); gl.uniformMatrix4fv(u.u_view, false, cam.view);
    gl.uniformMatrix4fv(u.u_model, false, M.model(o.pos, o.rot, o.scale));
    gl.uniform4fv(u.u_uvRect, o.uv || [0, 0, 1, 1]);
    gl.uniform2fv(u.u_size, o.size);
    gl.uniform1f(u.u_depthAmt, o.depthAmt ?? 0); gl.uniform1f(u.u_depthMid, o.depthMid ?? 0.5);
    gl.uniform1f(u.u_useDepth, o.depth ? 1 : 0); gl.uniform1f(u.u_curl, o.curl || 0);
    bindTex(0, o.tex, u.u_tex); bindTex(1, o.depth, u.u_depth); bindTex(2, o.tex2, u.u_tex2); bindTex(3, o.reveal, u.u_reveal);
    gl.uniform1f(u.u_opacity, o.opacity ?? 1); gl.uniform1f(u.u_mix, o.mix || 0);
    gl.uniform1f(u.u_bright, o.bright ?? 1); gl.uniform1f(u.u_sat, o.sat ?? 1);
    gl.uniform1f(u.u_maskLo, o.mask ? o.mask[0] : 0); gl.uniform1f(u.u_maskHi, o.mask ? o.mask[1] : 0);
    gl.uniform1f(u.u_alphaCut, o.alphaCut ?? 0.002);
    gl.uniform1f(u.u_useReveal, o.reveal ? 1 : 0); gl.uniform1f(u.u_revealT, o.revealT ?? 1);
    gl.uniform1f(u.u_solid, o.color ? 1 : 0); gl.uniform3fv(u.u_color, o.color || [1, 1, 1]);
    gl.uniform3fv(u.u_tint, o.tint || [1, 1, 1]);
    gl.uniform1f(u.u_edge, o.edge || 0);
    gl.depthMask(o.depthWrite !== false && !o.add);
    if (o.noDepthTest) gl.disable(gl.DEPTH_TEST); else gl.enable(gl.DEPTH_TEST);
    if (o.add) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.bindVertexArray(mesh.vao); gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
    if (o.add) gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(true); gl.enable(gl.DEPTH_TEST);
  }

  // a painting that fills the frame: crop = [u0, v0, u1, v1] of the image shown edge to edge at the start camera
  // (the crop's aspect should be 16:9; the plane is enlarged by `margin` so camera moves never show its edge)
  function painting(tex, depth, { crop, margin = 1.12, depthAmt = 0.5, z = 0, pos = [0, 0], opacity = 1, mask = null, bright = 1, sat = 1, rot = [0, 0, 0], tint, mix, tex2 } = {}) {
    let [u0, v0, u1, v1] = crop || [0, 0, 1, 1];
    // widen the crop by the margin, clamped to the image
    const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, hu = ((u1 - u0) / 2) * margin, hv = ((v1 - v0) / 2) * margin;
    const a0 = Math.max(0, cu - hu), a1 = Math.min(1, cu + hu), b0 = Math.max(0, cv - hv), b1 = Math.min(1, cv + hv);
    // world size: the original crop is 2 units tall
    const unitPerV = 2 / (v1 - v0);
    const hgt = (b1 - b0) * unitPerV, wid = ((a1 - a0) * tex.w / tex.h) * unitPerV * 1;
    const offX = (((a0 + a1) / 2 - cu) * tex.w / tex.h) * unitPerV, offY = -((b0 + b1) / 2 - cv) * unitPerV;
    draw({ tex, depth, uv: [a0, b0, a1, b1], size: [wid, hgt], pos: [pos[0] + offX, pos[1] + offY, z], rot, depthAmt, opacity, mask, bright, sat, tint, mix, tex2 });
  }

  // 3D letters: front face plus an extruded body; `letters` animates each glyph separately
  function text3d(t, { pos = [0, 0, 0], rot = [0, 0, 0], height = 0.5, depth = 0.12, layers = 18, side = [0.25, 0.12, 0.05], opacity = 1, bright = 1, perLetter = null, font, sizePx = 240, color = '#fff', str, letter = 0 }) {
    // perLetter(i, n) -> { dx, dy, dz, rx, ry, rz, s, o } offsets for glyph i
    if (!perLetter) {
      const tt = textTex(`${str}|${font}|${color}|${sizePx}|${letter}`, [str], { font, size: sizePx, color, letter, pad: 0.08 });
      const w = height * tt.aspect;
      for (let k = layers; k >= 1; k--) {
        const shade = 0.55 + 0.45 * (1 - k / layers);
        draw({ tex: tt.tex, size: [w, height], pos, rot, scale: [1, 1, 1], color: side.map((c) => c * shade), alphaCut: 0.45, opacity, ...{ pos: offsetAlong(pos, rot, -depth * (k / layers)) } });
      }
      draw({ tex: tt.tex, size: [w, height], pos, rot, alphaCut: 0.3, opacity, bright });
      return;
    }
    const chars = [...str];
    const adv = measure(str, font, sizePx, letter);
    const total = adv.reduce((a, b) => a + b, 0);
    let x = -total / 2;
    const k = height / (sizePx * 1.16);
    chars.forEach((ch, i) => {
      const cx = (x + adv[i] / 2) * k; x += adv[i];
      if (ch === ' ') return;
      const p = perLetter(i, chars.length);
      if (p.o !== undefined && p.o <= 0.001) return;
      const tt = textTex(`${ch}|${font}|${color}|${sizePx}`, [ch], { font, size: sizePx, color, pad: 0.08 });
      const h = height * (p.s ?? 1), w = h * tt.aspect;
      const lp = [pos[0] + cx + (p.dx || 0), pos[1] + (p.dy || 0), pos[2] + (p.dz || 0)];
      const lr = [rot[0] + (p.rx || 0), rot[1] + (p.ry || 0), rot[2] + (p.rz || 0)];
      for (let j = layers; j >= 1; j--) {
        const shade = 0.55 + 0.45 * (1 - j / layers);
        draw({ tex: tt.tex, size: [w, h], pos: offsetAlong(lp, lr, -depth * (j / layers) * (p.s ?? 1)), rot: lr, color: side.map((c) => c * shade), alphaCut: 0.45, opacity: opacity * (p.o ?? 1) });
      }
      draw({ tex: tt.tex, size: [w, h], pos: lp, rot: lr, alphaCut: 0.3, opacity: opacity * (p.o ?? 1), bright });
    });
  }
  // move along a rotated plane's normal
  function offsetAlong(p, r, d) {
    const m = M.model([0, 0, 0], r, [1, 1, 1]);
    return [p[0] + m[8] * d, p[1] + m[9] * d, p[2] + m[10] * d];
  }

  // bloom: bright pass into a quarter-size buffer, then a wide separable blur (twice)
  const BPFS = `#version 300 es
  precision highp float; in vec2 v_uv; uniform sampler2D u_a; uniform vec2 u_px; uniform float u_th; out vec4 o;
  void main() {
    vec3 c = (texture(u_a, v_uv + u_px * vec2(-1, -1)).rgb + texture(u_a, v_uv + u_px * vec2(1, -1)).rgb + texture(u_a, v_uv + u_px * vec2(-1, 1)).rgb + texture(u_a, v_uv + u_px * vec2(1, 1)).rgb) * 0.25;
    float l = max(c.r, max(c.g, c.b));
    o = vec4(c * smoothstep(u_th, u_th + 0.25, l), 1.0);
  }`;
  const BLFS = `#version 300 es
  precision highp float; in vec2 v_uv; uniform sampler2D u_a; uniform vec2 u_dir; out vec4 o;
  void main() {
    vec3 s = vec3(0.0); float wsum = 0.0;
    for (int i = -8; i <= 8; i++) { float w = exp(-float(i * i) / 24.0); s += texture(u_a, v_uv + u_dir * float(i)).rgb * w; wsum += w; }
    o = vec4(s / wsum, 1.0);
  }`;
  const bpP = program(PVS, BPFS), blP = program(PVS, BLFS);
  function pass(p, src, dst, set) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.f); gl.viewport(0, 0, dst.w, dst.h);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    gl.useProgram(p.p); bindTex(0, src.tex, p.u.u_a); set(p.u);
    gl.bindVertexArray(QUAD.vao); gl.drawElements(gl.TRIANGLES, QUAD.count, gl.UNSIGNED_INT, 0);
    gl.enable(gl.BLEND); gl.enable(gl.DEPTH_TEST);
  }
  function bloom(src, th = 0.72) {
    const a = fbo('bloomA', 480, 270), b = fbo('bloomB', 480, 270);
    pass(bpP, src, a, (u) => { gl.uniform2f(u.u_px, 1 / W, 1 / H); gl.uniform1f(u.u_th, th); });
    for (let k = 0; k < 2; k++) {
      pass(blP, a, b, (u) => gl.uniform2f(u.u_dir, (1.6 + k) / 480, 0));
      pass(blP, b, a, (u) => gl.uniform2f(u.u_dir, 0, (1.6 + k) / 270));
    }
    return a;
  }

  // copy a framebuffer onto another with a weight (additive), for averaging motion-blur samples
  const BFS = `#version 300 es
  precision highp float; in vec2 v_uv; uniform sampler2D u_a; uniform float u_w; out vec4 o;
  void main() { o = vec4(texture(u_a, v_uv).rgb * u_w, 1.0); }`;
  const blitP = program(PVS, BFS);
  function blit(src, dst, w, clear) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.f); gl.viewport(0, 0, dst.w, dst.h);
    if (clear) { gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); }
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(blitP.p); bindTex(0, src.tex, blitP.u.u_a); gl.uniform1f(blitP.u.u_w, w);
    gl.bindVertexArray(QUAD.vao); gl.drawElements(gl.TRIANGLES, QUAD.count, gl.UNSIGNED_INT, 0);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.enable(gl.DEPTH_TEST);
  }
  // soft bands and spots drawn on a canvas: 'vband' (alpha 0-1-0 vertically), 'hfade' (alpha 1 to 0 downwards)
  function gradTex(key, kind, size = 256) {
    if (textures[key]) return textures[key];
    const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
    let g;
    if (kind === 'vband') { g = x.createLinearGradient(0, 0, 0, size); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
    else if (kind === 'hfade') { g = x.createLinearGradient(0, 0, 0, size); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.6, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
    else if (kind === 'radial') { g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    textures[key] = texFromSource(c, { mip: false });
    return textures[key];
  }
  async function loadSvgTex(key, url, size = 1024) {
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement('canvas'); c.width = c.height = size;
    c.getContext('2d').drawImage(img, 0, 0, size, size);
    textures[key] = texFromSource(c);
    return textures[key];
  }

  // final composite: scene a (and b, mixed), film finish
  function finish(a, b, { mixAB = 0, vig = 0.55, grain = 0.045, ca = 0.0016, fade = [0, 0, 0], fadeAmt = 0, lift = 0.02, warm = 0.35, contrast = 1.06, seed = 0, bloomAmt = 0, bloomTh = 0.72, leak = 0, time = 0, flash = 0 } = {}) {
    const bl = bloomAmt > 0 ? bloom(b && mixAB > 0.5 ? b : a, bloomTh) : null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    const { u } = post; gl.useProgram(post.p);
    bindTex(0, a.tex, u.u_a); bindTex(1, (b || a).tex, u.u_b);
    gl.uniform1f(u.u_mixAB, b ? mixAB : 0); gl.uniform1f(u.u_vig, vig); gl.uniform1f(u.u_grain, grain); gl.uniform1f(u.u_seed, seed);
    gl.uniform1f(u.u_ca, ca); gl.uniform3fv(u.u_fade, fade); gl.uniform1f(u.u_fadeAmt, fadeAmt); gl.uniform1f(u.u_lift, lift);
    gl.uniform1f(u.u_warm, warm); gl.uniform1f(u.u_contrast, contrast);
    bindTex(2, bl ? bl.tex : textures.grey, u.u_bloom); gl.uniform1f(u.u_bloomAmt, bl ? bloomAmt : 0);
    gl.uniform1f(u.u_leak, leak); gl.uniform1f(u.u_time, time); gl.uniform1f(u.u_flash, flash);
    gl.bindVertexArray(QUAD.vao); gl.drawElements(gl.TRIANGLES, QUAD.count, gl.UNSIGNED_INT, 0);
    gl.enable(gl.BLEND); gl.enable(gl.DEPTH_TEST);
  }

  const clearDepth = () => gl.clear(gl.DEPTH_BUFFER_BIT);
  window.E = { clearDepth, gl, W, H, M, D0, ease, track, clamp, lerp, hash, textures, loadTex, loadSvgTex, texFromSource, textTex, measure, fbo, camera, begin, draw, painting, text3d, finish, blit, gradTex, offsetAlong };
})();
