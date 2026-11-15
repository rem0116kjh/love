/* NOËL · A procedural winter, rendered with native WebGL. No dependencies. */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const smooth = (a, b, n) => { const t = clamp((n - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  function randomSource(seed) {
    return () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function createWinter() {
    const random = randomSource(251226);
    const data = [];
    const counts = {};
    const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    const green = [0.13, 0.45, 0.27];
    const gold = [1.0, 0.70, 0.27];
    const ivory = [1.0, 0.91, 0.66];
    const red = [0.83, 0.18, 0.12];
    // position(3), color(3), kind, size, seed, glyph; ten floats per point.
    const point = (x, y, z, color, kind, size = 5, glyph = -1) => {
      const seed = random();
      data.push(x, y, z, ...color, kind, size, seed, glyph < 0 ? Math.floor(random() * 12) : glyph);
      counts[kind] = (counts[kind] || 0) + 1;
    };

    // Layered, individually needled branches — a living fir silhouette, not a cone.
    for (let tier = 0; tier < 9; tier++) {
      const radius = 1.70 * (1 - tier / 9) + 0.025;
      const base = -1.73 + tier * 0.47;
      const branches = 18 - tier;
      for (let branch = 0; branch < branches; branch++) {
        const direction = branch / branches * TAU + tier * 2.399;
        const length = radius * (0.87 + random() * 0.17);
        for (let step = 1; step <= 37; step++) {
          const along = step / 37;
          for (let needle = 0; needle < 3; needle++) {
            const r = along * length + (random() - 0.5) * 0.045;
            const fan = (random() - 0.5) * (0.29 * (1 - along) + 0.06);
            const a = direction + fan;
            const side = (random() - 0.5) * (0.13 * (1 - along) + 0.025);
            const x = Math.cos(a) * r + Math.sin(a) * side;
            const z = Math.sin(a) * r - Math.cos(a) * side;
            const y = base + 0.39 * (1 - along) - Math.sin(along * Math.PI) * 0.10 + (random() - 0.5) * 0.065;
            const illumination = 0.42 + random() * 0.62 + Math.max(0, Math.cos(a - 0.7)) * 0.25;
            let color = green.map(v => v * illumination);
            if (random() > 0.91) color = mix(color, [0.44, 0.64, 0.33], 0.45);
            if (along > 0.94) color = mix(color, [0.61, 0.70, 0.43], random() * 0.38);
            point(x, y, z, color, 0, 5.1 + random() * 1.3);
          }
        }
        if (tier < 8) point(Math.cos(direction) * length, base + 0.015, Math.sin(direction) * length, ivory, 2, 7.8, 12);
      }
    }
    for (let i = 0; i < 330; i++) {
      const t = random(), angle = random() * TAU, radius = (1 - t) * 0.14 * random();
      point(Math.cos(angle) * radius, 2.08 + t * 0.43, Math.sin(angle) * radius, mix(green, ivory, t * 0.25), 0, 5.4);
    }
    // Trunk, visible between the bottom branches and the snow.
    for (let i = 0; i < 260; i++) {
      const a = random() * TAU;
      point(Math.cos(a) * 0.095, -2.16 + random() * 0.6, Math.sin(a) * 0.095, [0.34, 0.22, 0.10], 0, 5);
    }
    // Two fine threads in a continuous golden garland.
    for (let i = 0; i < 2350; i++) {
      const t = i / 2350;
      const angle = t * TAU * 4.8 + 0.7;
      const radius = 1.73 * (1 - t) + 0.06;
      const thread = i % 2 === 0 ? 0.024 : -0.024;
      const y = -1.65 + t * 4.12 - Math.abs(Math.sin(angle * 1.5)) * 0.105;
      point(Math.cos(angle) * (radius + thread), y + (random() - 0.5) * 0.026, Math.sin(angle) * (radius + thread), mix(gold, ivory, random() * 0.55), 1, 5.7 + random(), 6 + Math.floor(random() * 6));
    }
    // Baubles are small three-dimensional shells with a soft highlight.
    for (let ornament = 0; ornament < 48; ornament++) {
      const t = 0.035 + random() * 0.89;
      const a = ornament * 2.399 + random() * 0.6;
      const radius = 1.61 * (1 - t) + 0.05;
      const y = -1.67 + t * 4.12;
      const orb = (0.07 + random() * 0.06) * (1 - t * 0.35);
      const baseColor = ornament % 3 === 0 ? gold : ornament % 7 === 0 ? ivory : red;
      for (let i = 0; i < 46; i++) {
        const v = 1 - 2 * (i + 0.5) / 46;
        const az = i * 2.399;
        const r = Math.sqrt(1 - v * v);
        const light = 0.45 + 0.5 * Math.max(0, r * Math.cos(az - 0.4)) + random() * 0.14;
        point(Math.cos(a) * radius + Math.cos(az) * r * orb, y + v * orb, Math.sin(a) * radius + Math.sin(az) * r * orb, baseColor.map(c => c * light), 3, 5.8, 7 + Math.floor(random() * 5));
      }
      point(Math.cos(a) * radius, y + orb * 1.1, Math.sin(a) * radius, gold, 1, 5.3, 8);
    }
    // Filled five-pointed star; kept facing the viewer as the tree turns.
    const star = [];
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU - Math.PI / 2;
      const r = i % 2 === 0 ? 0.255 : 0.112;
      star.push([Math.cos(a) * r, -Math.sin(a) * r]);
    }
    for (let i = 0; i < 520; i++) {
      const side = Math.floor(random() * 10);
      let a = random(), b = random();
      if (a + b > 1) { a = 1 - a; b = 1 - b; }
      const p = star[side], q = star[(side + 1) % 10];
      point(p[0] * a + q[0] * b, 2.69 + p[1] * a + q[1] * b, (random() - 0.5) * 0.055, mix(gold, ivory, 0.65 + random() * 0.35), 4, 6, 8 + Math.floor(random() * 5));
    }
    // Small presents; six sampled faces, with crossed champagne ribbons.
    const gifts = [
      [-1.34, -2.12, 0.55, 0.43, 0.48, 0.42, red],
      [-0.89, -2.12, 0.98, 0.34, 0.28, 0.35, [0.25, 0.43, 0.35]],
      [0.72, -2.12, 1.05, 0.54, 0.36, 0.4, [0.72, 0.54, 0.31]],
      [1.25, -2.12, 0.45, 0.34, 0.48, 0.32, [0.5, 0.14, 0.13]],
      [0.15, -2.12, 1.35, 0.27, 0.23, 0.3, [0.25, 0.43, 0.35]],
    ];
    for (const [x, y, z, w, h, d, baseColor] of gifts) {
      for (let face = 0; face < 5; face++) {
        for (let i = 0; i < 13; i++) for (let j = 0; j < 11; j++) {
          const u = i / 12, v = j / 10;
          let px, py, pz;
          if (face < 2) { px = (u - 0.5) * w; py = v * h; pz = (face === 0 ? -0.5 : 0.5) * d; }
          else if (face < 4) { px = (face === 2 ? -0.5 : 0.5) * w; py = v * h; pz = (u - 0.5) * d; }
          else { px = (u - 0.5) * w; py = h; pz = (v - 0.5) * d; }
          const ribbon = Math.abs(u - 0.5) < 0.07 || (face === 4 && Math.abs(v - 0.5) < 0.08);
          const color = ribbon ? ivory.map(c => c * 0.85) : baseColor.map(c => c * (0.5 + random() * 0.4));
          point(x + px, y + py, z + pz, color, 7, 5.0, ribbon ? 10 : 4 + Math.floor(random() * 7));
        }
      }
      for (let i = 0; i < 90; i++) {
        const a = i / 90 * TAU;
        point(x + Math.sin(a) * w * 0.3, y + h + Math.abs(Math.sin(a * 2)) * 0.08, z + Math.sin(a * 2) * d * 0.22, gold, 7, 4.5, 6);
      }
    }
    // A field of frost with faint concentric orbits.
    for (let i = 0; i < 4100; i++) {
      const a = random() * TAU, r = 0.25 + Math.sqrt(random()) * 6.4;
      const fade = 1 - smooth(1.9, 6.7, r);
      point(Math.cos(a) * r, -2.19 + random() * 0.018, Math.sin(a) * r, [0.23 * fade, 0.32 * fade, 0.27 * fade], 5, 2.2 + random() * 1.8, random() > 0.94 ? 4 : 0);
    }
    for (const r of [2.0, 2.45, 3.2]) {
      for (let i = 0; i < 460; i++) {
        const a = i / 460 * TAU;
        point(Math.cos(a) * r, -2.18, Math.sin(a) * r, [0.21, 0.21, 0.14], 5, 2.1, 0);
      }
    }
    // Snow is simulated in the vertex shader; far particles stay deliberately quiet.
    for (let i = 0; i < 1200; i++) {
      const near = random();
      const b = 0.25 + random() * 0.5;
      point((random() - 0.5) * 19, (random() - 0.5) * 12, -7 + near * 11, [b * 0.77, b * 0.87, b * 0.8], 6, 1.6 + near * 2.1 + random() * 1.6, random() > 0.82 ? 12 : 0);
    }
    return { vertices: new Float32Array(data), count: data.length / 10, counts };
  }

  const VERTEX = `
    precision highp float;
    attribute vec3 aPosition;
    attribute vec3 aColor;
    attribute vec4 aInfo;
    uniform float uTime, uRotation, uPitch, uZoom, uDpr, uPointScale, uFormation, uBurst, uHeart, uPalette;
    uniform mediump float uMode;
    uniform vec2 uResolution, uCenter;
    varying vec3 vColor;
    varying float vAlpha, vGlyph, vKind, vTwinkle;
    const float PI = 3.14159265359;
    void main() {
      float kind = aInfo.x;
      float seed = aInfo.z;
      vec3 p = aPosition;
      vec3 color = aColor;
      float alpha = 1.0;
      float twinkle = 0.87 + 0.13 * sin(uTime * (1.0 + seed * 1.8) + seed * 70.0);
      if (kind < 4.5 || kind > 6.5) {
        float delay = clamp((p.y + 2.2) / 5.2, 0.0, 1.0) * 0.66;
        float growth = smoothstep(delay, delay + 0.31, uFormation);
        float angle = seed * 100.0 + (1.0 - growth) * 5.0;
        vec3 origin = vec3(cos(angle) * (1.0 + seed * 2.5), -2.15, sin(angle) * (1.0 + seed * 2.5));
        p = mix(origin, p, growth);
        alpha *= smoothstep(0.0, 0.22, growth);
        vec3 direction = normalize(vec3(sin(seed * 123.0), cos(seed * 213.1) * 0.8 + 0.3, cos(seed * 377.7)));
        p += direction * uBurst * (1.2 + seed * 3.7);
        float t = seed * PI * 2.0;
        float shell = 0.82 + fract(seed * 1347.3) * 0.18;
        vec3 heart = vec3(16.0 * pow(sin(t), 3.0), 13.0 * cos(t) - 5.0 * cos(2.0*t) - 2.0 * cos(3.0*t) - cos(4.0*t), 0.0);
        heart.xy = heart.xy * 0.127 * shell + vec2(0.0, 0.45);
        heart.z = sin(seed * 452.9) * 0.35;
        p = mix(p, heart, uHeart);
        alpha *= 1.0 - uHeart * 0.52;
      }
      if (kind > 5.5 && kind < 6.5) {
        p.y = mod(p.y + 6.0 - uTime * (0.12 + seed * 0.16), 12.0) - 6.0;
        p.x += sin(uTime * 0.17 + seed * 100.0) * 0.18;
        alpha *= 0.25 + 0.24 * seed;
      }
      float rot = uRotation * (1.0 - uHeart);
      float c = cos(rot), s = sin(rot);
      p.xz = mat2(c, -s, s, c) * p.xz;
      if (kind > 3.5 && kind < 4.5 && uHeart < 0.01 && uBurst < 0.01 && uFormation > 0.99) p = aPosition;
      float cp = cos(uPitch), sp = sin(uPitch);
      p.yz = mat2(cp, sp, -sp, cp) * p.yz;
      float depth = 8.8 - p.z;
      float perspective = 2.21 * uZoom / max(1.0, depth);
      vec2 screen = p.xy * perspective * vec2(uResolution.y / uResolution.x, 1.0) + uCenter;
      gl_Position = vec4(screen, 0.0, 1.0);
      float size = aInfo.y * uDpr * uPointScale * (8.0 / max(2.0, depth)) * sqrt(uZoom);
      if (uMode > 0.5) size *= kind > 0.5 && kind < 4.5 ? 0.8 : 0.62;
      gl_PointSize = clamp(size, 1.0, 48.0 * uDpr);
      float light = 0.7 + 0.3 * smoothstep(-2.2, 2.0, p.z);
      if (kind < 0.5) color *= light;
      if (uPalette > 0.5 && uPalette < 1.5 && kind < 5.0) {
        float l = max(color.r, max(color.g, color.b));
        if (kind < 0.5) color = vec3(0.62, 0.49, 0.27) * l * 1.35;
        else if (kind > 2.5 && kind < 3.5) color = vec3(0.86, 0.67, 0.41) * l;
        else color = mix(color, vec3(1.0, 0.9, 0.65) * l, 0.8);
      }
      if (uPalette > 1.5 && kind < 5.0) {
        float l = max(color.r, max(color.g, color.b));
        if (kind < 0.5) color = mix(vec3(0.14, 0.66, 0.62), vec3(0.39, 0.38, 0.77), smoothstep(-1.7, 2.4, aPosition.y)) * l * 1.55;
        else if (kind > 2.5 && kind < 3.5) color = vec3(0.9, 0.4, 0.56) * l;
        else color = vec3(0.65, 0.86, 1.0) * l;
      }
      if (kind < 4.5 || kind > 6.5) color = mix(color, mix(vec3(1.0, 0.39, 0.3), vec3(1.0, 0.8, 0.46), seed) * (0.45 + seed * 0.7), uHeart);
      if (kind > 0.5 && kind < 2.5) { color *= 1.15; alpha *= twinkle; }
      if (kind > 3.5 && kind < 4.5) color *= 1.15;
      if (kind > 4.5 && kind < 5.5) alpha *= 0.55;
      vColor = color;
      vAlpha = alpha * (0.8 + 0.2 * twinkle);
      vGlyph = aInfo.w;
      vKind = kind;
      vTwinkle = twinkle;
    }
  `;

  const FRAGMENT = `
    precision mediump float;
    uniform sampler2D uAtlas;
    uniform float uMode;
    varying vec3 vColor;
    varying float vAlpha, vGlyph, vKind, vTwinkle;
    void main() {
      vec2 uv = gl_PointCoord;
      float a;
      if (uMode > 0.5 || vKind > 4.5) {
        float d = length(uv - 0.5) * 2.0;
        a = exp(-d * d * 4.5) * (1.0 - smoothstep(0.65, 1.0, d));
        if (vKind > 5.5 && vGlyph > 11.5) {
          float cross = exp(-abs(uv.x - 0.5) * 24.0) + exp(-abs(uv.y - 0.5) * 24.0);
          a = max(a, cross * 0.22 * (1.0 - smoothstep(0.25, 0.55, length(uv - 0.5))));
        }
      } else {
        vec2 atlasUv = vec2((vGlyph + uv.x) / 16.0, 1.0 - uv.y);
        a = texture2D(uAtlas, atlasUv).a;
      }
      if (a < 0.015) discard;
      gl_FragColor = vec4(vColor, a * vAlpha);
    }
  `;

  const QUAD_VERTEX = `attribute vec2 aPosition; varying vec2 vUv; void main() { vUv = aPosition * 0.5 + 0.5; gl_Position = vec4(aPosition, 0.0, 1.0); }`;
  const BLUR_FRAGMENT = `
    precision mediump float;
    uniform sampler2D uTexture;
    uniform vec2 uDirection;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(uTexture, vUv).rgb * 0.227027;
      c += texture2D(uTexture, vUv + uDirection * 1.384615).rgb * 0.316216;
      c += texture2D(uTexture, vUv - uDirection * 1.384615).rgb * 0.316216;
      c += texture2D(uTexture, vUv + uDirection * 3.230769).rgb * 0.070270;
      c += texture2D(uTexture, vUv - uDirection * 3.230769).rgb * 0.070270;
      gl_FragColor = vec4(c, 1.0);
    }
  `;
  const COMPOSITE_FRAGMENT = `
    precision mediump float;
    uniform sampler2D uScene, uBloom;
    uniform vec2 uResolution, uCenter;
    uniform float uPalette, uHeart;
    varying vec2 vUv;
    void main() {
      vec2 center = uCenter * 0.5 + 0.5;
      vec2 p = vUv - center;
      p.x *= uResolution.x / uResolution.y;
      float halo = exp(-dot(p, p) * 6.0);
      vec3 base = vec3(0.018, 0.032, 0.026);
      vec3 atmosphere = vec3(0.022, 0.047, 0.027);
      if (uPalette > 0.5 && uPalette < 1.5) atmosphere = vec3(0.050, 0.036, 0.018);
      if (uPalette > 1.5) atmosphere = vec3(0.023, 0.030, 0.065);
      base += atmosphere * halo;
      base += vec3(0.035, 0.013, 0.005) * halo * uHeart;
      vec3 scene = texture2D(uScene, vUv).rgb;
      vec3 bloom = texture2D(uBloom, vUv).rgb;
      vec3 col = base + scene * 1.12 + bloom * 0.92;
      col = 1.0 - exp(-col * 1.25);
      float vignette = 1.0 - smoothstep(0.25, 1.1, length((vUv - 0.5) * vec2(1.05, 0.85))) * 0.48;
      col *= vignette;
      float noise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      col += (noise - 0.5) / 255.0;
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  class WinterScene {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.options = options;
      this.geometry = createWinter();
      this.rotation = 0.4;
      this.targetRotation = 0.4;
      this.pitch = 0.055;
      this.targetPitch = 0.055;
      this.zoom = 1;
      this.targetZoom = 1;
      this.palette = 0;
      this.mode = 0;
      this.time = 0;
      this.formation = options.reducedMotion ? 1 : 0;
      this.paused = !!options.reducedMotion;
      this.reducedMotion = !!options.reducedMotion;
      this.visible = !document.hidden;
      this.ready = false;
      this.lost = false;
      this.dirty = true;
      this.burstStart = -100;
      this.heartStart = -100;
      this.heartValue = 0;
      this.burstValue = 0;
      this.staticHeart = false;
      this.heartHold = false;
      this.letterPresentation = false;
      this.dragging = false;
      this.dpr = 1;
      this.raf = 0;
      this.lastFrame = 0;
      this.eventController = new AbortController();
      const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
      if (!gl) throw new Error('이 브라우저에서 WebGL을 사용할 수 없습니다.');
      this.gl = gl;
      this.initialize();
      this.bindEvents();
      this.resize();
      this.frame = this.frame.bind(this);
      this.raf = requestAnimationFrame(this.frame);
    }

    program(vertexSource, fragmentSource) {
      const gl = this.gl;
      const compile = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          const message = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(message);
        }
        return shader;
      };
      const vertex = compile(gl.VERTEX_SHADER, vertexSource);
      const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
      const handle = gl.createProgram();
      gl.attachShader(handle, vertex); gl.attachShader(handle, fragment); gl.linkProgram(handle);
      gl.deleteShader(vertex); gl.deleteShader(fragment);
      if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(handle));
      const uniforms = {};
      for (let i = 0; i < gl.getProgramParameter(handle, gl.ACTIVE_UNIFORMS); i++) {
        const { name } = gl.getActiveUniform(handle, i);
        uniforms[name] = gl.getUniformLocation(handle, name);
      }
      return { handle, uniforms };
    }

    initialize() {
      const gl = this.gl;
      this.points = this.program(VERTEX, FRAGMENT);
      this.blur = this.program(QUAD_VERTEX, BLUR_FRAGMENT);
      this.composite = this.program(QUAD_VERTEX, COMPOSITE_FRAGMENT);
      this.vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.geometry.vertices, gl.STATIC_DRAW);
      this.quadBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
      this.atlas = this.createAtlas();
      this.targets = [];
      this.lost = false;
      this.dirty = true;
    }

    createAtlas() {
      const gl = this.gl;
      const atlas = document.createElement('canvas');
      atlas.width = 1024; atlas.height = 64;
      const context = atlas.getContext('2d');
      context.fillStyle = '#fff';
      context.font = '500 46px "Courier New", monospace';
      context.textAlign = 'center'; context.textBaseline = 'middle';
      const glyphs = ['·', '.', ':', ',', '+', '-', '=', '*', 'x', '%', '#', '@', '✦', 'o', '/', '&'];
      glyphs.forEach((glyph, i) => context.fillText(glyph, i * 64 + 32, 34));
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
      return texture;
    }

    createTarget(width, height) {
      const gl = this.gl;
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('빛 효과를 준비하지 못했습니다.');
      return { texture, framebuffer, width, height };
    }

    resize() {
      if (this.lost) return;
      const bounds = this.canvas.getBoundingClientRect();
      this.width = bounds.width; this.height = bounds.height;
      this.mobile = this.width <= 760;
      this.dpr = Math.min(window.devicePixelRatio || 1, this.mobile ? 1.75 : 1.75);
      const max = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);
      const width = Math.min(max, Math.max(1, Math.round(bounds.width * this.dpr)));
      const height = Math.min(max, Math.max(1, Math.round(bounds.height * this.dpr)));
      const gl = this.gl;
      if (this.canvas.width !== width || this.canvas.height !== height || !this.targets.length) {
        // Reparenting also notifies ResizeObserver. Avoid clearing an already
        // rendered, paused heart when that second notification has the same size.
        this.canvas.width = width; this.canvas.height = height;
        for (const target of this.targets) { gl.deleteTexture(target.texture); gl.deleteFramebuffer(target.framebuffer); }
        this.targets = [this.createTarget(width, height), this.createTarget(Math.max(1, Math.round(width / 4)), Math.max(1, Math.round(height / 4))), this.createTarget(Math.max(1, Math.round(width / 4)), Math.max(1, Math.round(height / 4)))];
      }
      this.center = this.mobile ? [0, -0.04] : [this.width <= 1100 ? 0.26 : 0.25, 0.035];
      this.sceneScale = this.mobile ? Math.min(0.65, this.width / this.height * 1.20) : 0.92;
      if (this.mobile && this.height <= 740) { this.sceneScale *= 0.9; this.center[1] = 0; }
      if (!this.mobile && window.innerHeight <= 500) { this.sceneScale = 0.82; this.center[1] = 0.12; }
      if (this.letterPresentation) {
        // Fit the actual particle heart into the mobile letter's visible stage.
        // Reuse this canvas/context; no second renderer or decorative substitute.
        this.center = [0, -0.025];
        this.sceneScale = Math.min(1.5, (this.width / this.height) * 1.5);
      }
      this.dirty = true;
    }

    setLetterPresentation(compact) {
      this.letterPresentation = !!compact;
      this.resize();
    }

    bindEvents() {
      const { signal } = this.eventController;
      const canvas = this.canvas;
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
      document.addEventListener('visibilitychange', () => { this.visible = !document.hidden; this.lastFrame = 0; this.dirty = true; }, { signal });
      canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault(); this.lost = true; this.options.onError?.('빛이 잠시 꺼졌어요. 그래픽 연결을 기다리고 있습니다.');
      }, { signal });
      canvas.addEventListener('webglcontextrestored', () => {
        try { this.initialize(); this.resize(); this.options.onRestore?.(); }
        catch (error) { this.options.onError?.(error.message); }
      }, { signal });
      const pointers = new Map();
      canvas.addEventListener('pointerdown', event => {
        if (event.button > 0) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        this.dragging = true;
        this.pointerId = event.pointerId;
        this.pointerX = event.clientX; this.pointerY = event.clientY;
        canvas.setPointerCapture(event.pointerId);
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          this.pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
          this.pinchZoom = this.targetZoom;
        }
        canvas.focus({ preventScroll: true });
        this.options.onInteract?.();
      }, { signal });
      canvas.addEventListener('pointermove', event => {
        if (!this.dragging || !pointers.has(event.pointerId)) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size >= 2 && this.pinchDistance > 0) {
          const [a, b] = [...pointers.values()];
          this.targetZoom = clamp(this.pinchZoom * Math.hypot(a.x - b.x, a.y - b.y) / this.pinchDistance, 0.72, 1.4);
          this.dirty = true;
          return;
        }
        this.targetRotation += (event.clientX - this.pointerX) * 0.008;
        this.targetPitch = clamp(this.targetPitch + (event.clientY - this.pointerY) * 0.0018, -0.22, 0.37);
        this.pointerX = event.clientX; this.pointerY = event.clientY;
        this.dirty = true;
      }, { signal });
      const release = event => {
        pointers.delete(event.pointerId);
        this.dragging = pointers.size > 0;
        this.pinchDistance = 0;
        if (pointers.size === 1) {
          const [id, point] = [...pointers.entries()][0];
          this.pointerId = id; this.pointerX = point.x; this.pointerY = point.y;
        }
      };
      canvas.addEventListener('pointerup', release, { signal });
      canvas.addEventListener('pointercancel', release, { signal });
      canvas.addEventListener('lostpointercapture', release, { signal });
      canvas.addEventListener('wheel', event => {
        event.preventDefault(); this.adjustZoom(-event.deltaY * 0.00065); this.options.onInteract?.();
      }, { passive: false, signal });
    }

    setPalette(value) { this.palette = clamp(value, 0, 2); this.dirty = true; }
    setMode(value) { this.mode = value ? 1 : 0; this.dirty = true; }
    setPaused(value) {
      this.paused = !!value;
      if (this.paused) this.targetRotation = this.rotation;
      this.dirty = true;
      return this.paused;
    }
    adjustZoom(delta) { this.targetZoom = clamp(this.targetZoom + delta, 0.72, 1.4); this.dirty = true; }
    rotate(delta) { this.targetRotation += delta; this.dirty = true; }
    replay() {
      this.heartStart = -100; this.burstStart = -100; this.staticHeart = false;
      this.formation = this.reducedMotion ? 1 : 0;
      this.dirty = true;
      if (!this.reducedMotion) this.paused = false;
    }
    burst() {
      this.burstStart = this.time;
      if (this.reducedMotion || this.paused) {
        this.burstStart = -100;
        this.burstValue = 0.6; this.dirty = true;
        clearTimeout(this.burstTimer);
        this.burstTimer = setTimeout(() => { this.burstValue = 0; this.dirty = true; }, 1200);
      }
    }
    wish() {
      this.heartHold = false;
      this.formation = 1;
      this.burstStart = -100;
      this.heartStart = this.time;
      if (this.reducedMotion || this.paused) {
        this.staticHeart = true; this.dirty = true;
        clearTimeout(this.heartTimer);
        this.heartTimer = setTimeout(() => { this.staticHeart = false; this.heartStart = -100; this.dirty = true; }, 11000);
      }
    }
    love() {
      this.formation = 1; this.heartStart = this.time; this.heartHold = true;
      this.staticHeart = this.paused || this.reducedMotion;
      this.dirty = true; clearTimeout(this.heartTimer);
    }
    endLove() {
      this.heartHold = false; this.staticHeart = false;
      this.heartStart = this.paused ? -100 : this.time - 9.5; this.dirty = true;
    }
    cancelWish() { this.heartHold = false; this.staticHeart = false; this.heartStart = -100; clearTimeout(this.heartTimer); this.dirty = true; }

    frame(now) {
      this.raf = requestAnimationFrame(this.frame);
      if (!this.visible || this.lost) { this.lastFrame = 0; return; }
      const delta = this.lastFrame ? Math.min((now - this.lastFrame) / 1000, 0.05) : 0;
      this.lastFrame = now;
      const settling = Math.abs(this.targetRotation - this.rotation) > 0.0001 || Math.abs(this.targetZoom - this.zoom) > 0.0001 || Math.abs(this.targetPitch - this.pitch) > 0.0001;
      if (this.paused && !this.dirty && !settling) return;
      if (!this.paused) {
        this.time += delta;
        this.formation = Math.min(1, this.formation + delta / 5.1);
        if (!this.dragging && this.heartValue < 0.1) this.targetRotation += delta * 0.105;
        const burstProgress = clamp((this.time - this.burstStart) / 4.8, 0, 1);
        this.burstValue = Math.pow(Math.sin(burstProgress * Math.PI), 1.45);
      }
      const ease = this.reducedMotion ? 1 : 1 - Math.exp(-delta * 8);
      this.rotation += (this.targetRotation - this.rotation) * ease;
      this.pitch += (this.targetPitch - this.pitch) * ease;
      this.zoom += (this.targetZoom - this.zoom) * ease;
      const heartTime = this.time - this.heartStart;
      this.heartValue = this.staticHeart ? 1 : smooth(0, 2.8, heartTime) * (this.heartHold ? 1 : 1 - smooth(9.5, 13, heartTime));
      this.draw();
      this.dirty = false;
      if (!this.ready) { this.ready = true; this.options.onReady?.(); }
    }

    bindQuad(program) {
      const gl = this.gl;
      // WebGL 1 shares vertex attribute enablement between programs.
      for (let i = 0; i < 3; i++) gl.disableVertexAttribArray(i);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      const location = gl.getAttribLocation(program.handle, 'aPosition');
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    }

    draw() {
      if (this.lost || !this.targets.length) return;
      const gl = this.gl;
      const [scene, horizontal, vertical] = this.targets;
      const { handle, uniforms: u } = this.points;
      gl.bindFramebuffer(gl.FRAMEBUFFER, scene.framebuffer);
      gl.viewport(0, 0, scene.width, scene.height);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(handle);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.disable(gl.DEPTH_TEST);
      for (let i = 0; i < 3; i++) gl.disableVertexAttribArray(i);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
      for (const [name, size, offset] of [['aPosition', 3, 0], ['aColor', 3, 12], ['aInfo', 4, 24]]) {
        const location = gl.getAttribLocation(handle, name);
        gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, 40, offset);
      }
      gl.uniform1f(u.uTime, this.time);
      gl.uniform1f(u.uRotation, this.rotation);
      gl.uniform1f(u.uPitch, this.letterPresentation ? 0 : this.pitch);
      gl.uniform1f(u.uZoom, (this.letterPresentation ? 1 : this.zoom) * this.sceneScale);
      gl.uniform1f(u.uDpr, this.dpr);
      gl.uniform1f(u.uPointScale, this.letterPresentation ? 0.46 : 1);
      gl.uniform1f(u.uFormation, this.formation);
      gl.uniform1f(u.uBurst, this.burstValue);
      gl.uniform1f(u.uHeart, this.heartValue);
      gl.uniform1f(u.uPalette, this.palette);
      gl.uniform1f(u.uMode, this.mode);
      gl.uniform2f(u.uResolution, this.width, this.height);
      gl.uniform2fv(u.uCenter, this.center);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.atlas); gl.uniform1i(u.uAtlas, 0);
      gl.drawArrays(gl.POINTS, 0, this.geometry.count);
      gl.disable(gl.BLEND);

      gl.useProgram(this.blur.handle); this.bindQuad(this.blur);
      gl.bindFramebuffer(gl.FRAMEBUFFER, horizontal.framebuffer);
      gl.viewport(0, 0, horizontal.width, horizontal.height);
      gl.bindTexture(gl.TEXTURE_2D, scene.texture);
      gl.uniform1i(this.blur.uniforms.uTexture, 0);
      gl.uniform2f(this.blur.uniforms.uDirection, 2.2 / scene.width, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindFramebuffer(gl.FRAMEBUFFER, vertical.framebuffer);
      gl.bindTexture(gl.TEXTURE_2D, horizontal.texture);
      gl.uniform2f(this.blur.uniforms.uDirection, 0, 1.2 / horizontal.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.useProgram(this.composite.handle); this.bindQuad(this.composite);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scene.texture); gl.uniform1i(this.composite.uniforms.uScene, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, vertical.texture); gl.uniform1i(this.composite.uniforms.uBloom, 1);
      gl.uniform2f(this.composite.uniforms.uResolution, this.width, this.height);
      gl.uniform2fv(this.composite.uniforms.uCenter, this.center);
      gl.uniform1f(this.composite.uniforms.uPalette, this.palette);
      gl.uniform1f(this.composite.uniforms.uHeart, this.heartValue);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.activeTexture(gl.TEXTURE0);
    }

    getState() {
      return { ready: this.ready, contextLost: this.lost, points: this.geometry.count, paused: this.paused, reducedMotion: this.reducedMotion, palette: this.palette, mode: this.mode, rotation: this.rotation, zoom: this.zoom, formation: this.formation, heart: this.heartValue, burst: this.burstValue, letterPresentation: this.letterPresentation, width: this.width, height: this.height, dpr: this.dpr };
    }

    destroy() {
      cancelAnimationFrame(this.raf); clearTimeout(this.burstTimer); clearTimeout(this.heartTimer);
      this.resizeObserver?.disconnect(); this.eventController.abort();
      const gl = this.gl;
      for (const target of this.targets) { gl.deleteTexture(target.texture); gl.deleteFramebuffer(target.framebuffer); }
      for (const program of [this.points, this.blur, this.composite]) gl.deleteProgram(program.handle);
      gl.deleteBuffer(this.vertexBuffer); gl.deleteBuffer(this.quadBuffer); gl.deleteTexture(this.atlas);
    }
  }
  window.WinterScene = WinterScene;
})();
