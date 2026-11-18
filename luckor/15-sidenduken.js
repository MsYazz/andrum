// Lucka 15: Sidenduken
// En duk av skiftande siden som hänger från en trästång och böljar i en mjuk vind.
// Hon kan ta tag i duken var som helst och dra i den, och den faller tillbaka när hon
// släpper. Tyget räknas i 3D med Verlet-integration: punkter som hålls ihop av trådar.
// Sidenet skiftar från rosa till guld beroende på hur det vänder sig mot ljuset.

import { program, platser, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { brusKalla } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { mjuk, rumsLjud, slinga, fastaSteg, fingrar, stangning } from '../lib/scen.js';

const NX = 24, NY = 34;
const BREDD = 0.72;          // dukens bredd i skärmbredder
const ITER = 10;

const BAK_FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform float u_tid;
uniform float u_synlig;
uniform float u_stang;
${BRUS}
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  // Ett skumt rum med mjukt kvällsljus från ena sidan
  vec3 c = mix(vec3(0.05, 0.04, 0.06), vec3(0.20, 0.14, 0.13), smoothstep(1.2, 0.0, length(uv - vec2(0.85, 0.75))));
  c *= 0.92 + 0.08 * fbm(uv * vec2(3.0, 5.0));
  // Trästången som duken hänger i
  float stang = smoothstep(0.009, 0.005, abs(uv.y - u_stang)) * step(abs(uv.x - 0.5), 0.42);
  vec3 tra = vec3(0.32, 0.18, 0.09) * (0.6 + 0.6 * smoothstep(0.009, 0.0, abs(uv.y - u_stang - 0.003)));
  c = mix(c, tra, stang);
  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, u_tid), 1.0);
}`;

const TYG_VS = `#version 300 es
in vec3 a_pos;
in vec3 a_norm;
in vec2 a_uv;
uniform vec2 u_skala;
out vec3 v_norm;
out vec2 v_uv;
out float v_z;
void main() {
  v_norm = a_norm;
  v_uv = a_uv;
  v_z = a_pos.z;
  gl_Position = vec4(a_pos.x * u_skala.x, a_pos.y * u_skala.y - 1.0, -a_pos.z * 0.5, 1.0);
}`;

const TYG_FS = `#version 300 es
precision highp float;
in vec3 v_norm;
in vec2 v_uv;
in float v_z;
out vec4 frag;
uniform float u_synlig;
void main() {
  vec3 n = normalize(v_norm);
  if (!gl_FrontFacing) n = -n;
  vec3 L = normalize(vec3(0.55, 0.45, 0.7));
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 H = normalize(L + V);
  float dif = max(dot(n, L), 0.0);
  float ndv = abs(dot(n, V));
  // Skiftande siden: färgen glider mot guld där tyget vänder sig bort
  vec3 bas = mix(vec3(0.55, 0.16, 0.25), vec3(0.72, 0.52, 0.22), pow(1.0 - ndv, 1.6));
  float glans = pow(max(dot(n, H), 0.0), 28.0) * 0.55 + pow(max(dot(n, H), 0.0), 6.0) * 0.12;
  vec3 c = bas * (0.18 + 0.95 * dif) + vec3(1.0, 0.88, 0.75) * glans;
  // Fållen nertill och i kanterna är lite mörkare
  float kant = min(min(v_uv.x, 1.0 - v_uv.x), v_uv.y);
  c *= 0.82 + 0.18 * smoothstep(0.0, 0.03, kant);
  frag = vec4(c * u_synlig, 1.0);
}`;

export default {
  start(duk, scen) {
    const gl = duk.getContext('webgl2', { antialias: true, alpha: false, depth: true, premultipliedAlpha: false });
    if (!gl) return utanGL(scen);
    const bak = program(gl, HELSKARM, BAK_FS);
    const ub = platser(gl, bak, ['u_res', 'u_tid', 'u_synlig', 'u_stang']);
    const bakVao = gl.createVertexArray();
    const tyg = program(gl, TYG_VS, TYG_FS);
    const ut2 = platser(gl, tyg, ['u_skala', 'u_synlig']);

    // ---------- Tyget ----------
    const N = NX * NY;
    const asp = () => duk.clientHeight / duk.clientWidth;
    const H = asp();
    const stangY = H * 0.86;
    const steg = BREDD / (NX - 1);
    const P = new Float32Array(N * 3), PP = new Float32Array(N * 3), fast = new Uint8Array(N);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      P[k * 3] = -BREDD / 2 + i * steg;
      P[k * 3 + 1] = stangY - j * steg;
      P[k * 3 + 2] = Math.sin(i * 0.5) * 0.004;
      if (j === 0) fast[k] = 1;
    }
    // Trådar: raka, diagonala och böjtrådar två steg bort. Längderna mäts innan duken
    // fästs hopdragen på stången, så att den faller i mjuka veck.
    const tradar = [];
    const lagg = (a, b, styv) => {
      const dx = P[a * 3] - P[b * 3], dy = P[a * 3 + 1] - P[b * 3 + 1], dz = P[a * 3 + 2] - P[b * 3 + 2];
      tradar.push([a, b, Math.hypot(dx, dy, dz), styv]);
    };
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      if (i < NX - 1) lagg(k, k + 1, 1);
      if (j < NY - 1) lagg(k, k + NX, 1);
      if (i < NX - 1 && j < NY - 1) { lagg(k, k + NX + 1, 0.5); lagg(k + 1, k + NX, 0.5); }
      if (i < NX - 2) lagg(k, k + 2, 0.15);
      if (j < NY - 2) lagg(k, k + 2 * NX, 0.15);
    }
    for (let k = 0; k < N; k++) {
      P[k * 3] *= 0.84;
      P[k * 3 + 2] = Math.sin((k % NX) * 1.1) * 0.012;
    }
    PP.set(P);

    let grepp = -1;
    const greppPos = [0, 0];
    let vindTid = 0;
    let rorelse = 0;

    function fysik(dt) {
      vindTid += dt;
      const g = -1.4;
      // En mjuk, ojämn vind som kommer och går
      const pust = 0.5 + 0.5 * Math.sin(vindTid * 0.31) * Math.sin(vindTid * 0.17 + 1);
      let energi = 0;
      for (let k = 0; k < N; k++) {
        if (fast[k] || k === grepp) continue;
        const i3 = k * 3;
        const x = P[i3], y = P[i3 + 1], z = P[i3 + 2];
        const vx = (x - PP[i3]) * 0.985, vy = (y - PP[i3 + 1]) * 0.985, vz = (z - PP[i3 + 2]) * 0.985;
        energi += vx * vx + vy * vy + vz * vz;
        const kol = k % NX, rad = (k / NX) | 0;
        const vind = (0.25 + 0.55 * pust) * (0.6 + 0.4 * Math.sin(kol * 0.35 + vindTid * 1.3 + rad * 0.12));
        PP[i3] = x; PP[i3 + 1] = y; PP[i3 + 2] = z;
        P[i3] = x + vx + (vind * 0.25) * dt * dt;
        P[i3 + 1] = y + vy + g * dt * dt;
        P[i3 + 2] = z + vz + vind * 1.5 * dt * dt;
      }
      rorelse += (Math.sqrt(energi / N) / dt - rorelse) * 0.05;
      for (let it = 0; it < ITER; it++) {
        for (const [a, b, l0, styv] of tradar) {
          const a3 = a * 3, b3 = b * 3;
          const dx = P[b3] - P[a3], dy = P[b3 + 1] - P[a3 + 1], dz = P[b3 + 2] - P[a3 + 2];
          const d = Math.hypot(dx, dy, dz) || 1e-6;
          const diff = ((d - l0) / d) * 0.5 * styv;
          const la = fast[a] || a === grepp ? 0 : 1, lb = fast[b] || b === grepp ? 0 : 1;
          const s = la + lb;
          if (!s) continue;
          const ka = (la / s) * 2, kb = (lb / s) * 2;
          P[a3] += dx * diff * ka; P[a3 + 1] += dy * diff * ka; P[a3 + 2] += dz * diff * ka;
          P[b3] -= dx * diff * kb; P[b3 + 1] -= dy * diff * kb; P[b3 + 2] -= dz * diff * kb;
        }
        if (grepp >= 0) { P[grepp * 3] = greppPos[0]; P[grepp * 3 + 1] = greppPos[1]; }
      }
    }

    // ---------- Rutnätet att rita ----------
    const NORM = new Float32Array(N * 3), UV = new Float32Array(N * 2);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { UV[(j * NX + i) * 2] = i / (NX - 1); UV[(j * NX + i) * 2 + 1] = 1 - j / (NY - 1); }
    const index = [];
    for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
      const k = j * NX + i;
      index.push(k, k + NX, k + 1, k + 1, k + NX, k + NX + 1);
    }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = (data, plats, storlek) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      const loc = gl.getAttribLocation(tyg, plats);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, storlek, gl.FLOAT, false, 0, 0);
      return b;
    };
    const posBuf = buf(P, 'a_pos', 3), normBuf = buf(NORM, 'a_norm', 3);
    buf(UV, 'a_uv', 2);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(index), gl.STATIC_DRAW);

    function normaler() {
      NORM.fill(0);
      for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
        const a = j * NX + i, b = a + NX, c = a + 1;
        const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
        const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        for (const k of [a, b, c, b + 1]) { NORM[k * 3] += nx; NORM[k * 3 + 1] += ny; NORM[k * 3 + 2] += nz; }
      }
    }

    // ---------- Fingret ----------
    const tillVarld = (x, y) => [x / duk.clientWidth - 0.5, (duk.clientHeight - y) / duk.clientWidth];
    fingrar(duk, {
      ner: (x, y) => {
        const [wx, wy] = tillVarld(x, y);
        let bast = -1, bd = 0.09;
        for (let k = 0; k < N; k++) {
          if (fast[k]) continue;
          const d = Math.hypot(P[k * 3] - wx, P[k * 3 + 1] - wy);
          if (d < bd) { bd = d; bast = k; }
        }
        grepp = bast;
        greppPos[0] = wx; greppPos[1] = wy;
      },
      drag: (x, y) => { const [wx, wy] = tillVarld(x, y); greppPos[0] = wx; greppPos[1] = wy; },
      upp: () => { grepp = -1; },
    });

    // ---------- Ljud ----------
    const l = rumsLjud(1.2, 1.6);
    const { ctx, ut } = l;
    const prassel = brusKalla('rosa');
    const prF = ctx.createBiquadFilter(); prF.type = 'bandpass'; prF.frequency.value = 2200; prF.Q.value = 0.6;
    const prG = ctx.createGain(); prG.gain.value = 0;
    prassel.connect(prF).connect(prG).connect(ut);
    const vind = brusKalla('rosa');
    const viF = ctx.createBiquadFilter(); viF.type = 'lowpass'; viF.frequency.value = 350;
    const viG = ctx.createGain(); viG.gain.value = 0.03;
    vind.connect(viF).connect(viG).connect(ut);
    l.kallor.push(prassel, vind);

    // ---------- Ritslinga ----------
    const fasta = fastaSteg(1 / 90, 6);
    const stoppa = slinga((tid, dt) => {
      fasta(dt, fysik);
      normaler();

      const t = ctx.currentTime;
      const r = Math.min(1, rorelse * 2.5);
      prG.gain.setTargetAtTime(0.004 + 0.05 * r * r, t, 0.08);
      prF.frequency.setTargetAtTime(1600 + 1600 * r, t, 0.1);
      viG.gain.setTargetAtTime(0.02 + 0.025 * (0.5 + 0.5 * Math.sin(tid * 0.31) * Math.sin(tid * 0.17 + 1)), t, 0.5);

      const dpr = Math.min(window.devicePixelRatio || 1, 2) * 0.8;
      const bw = Math.round(duk.clientWidth * dpr), bh = Math.round(duk.clientHeight * dpr);
      if (duk.width !== bw || duk.height !== bh) { duk.width = bw; duk.height = bh; }
      gl.viewport(0, 0, bw, bh);
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(bak);
      gl.bindVertexArray(bakVao);
      gl.uniform2f(ub.u_res, bw, bh);
      gl.uniform1f(ub.u_tid, tid);
      gl.uniform1f(ub.u_synlig, mjuk(0, 2.5, tid));
      gl.uniform1f(ub.u_stang, (stangY + 0.006) / asp());
      ritaHelskarm(gl);

      gl.enable(gl.DEPTH_TEST);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(tyg);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, P);
      gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, NORM);
      gl.uniform2f(ut2.u_skala, 2, 2 / asp());
      gl.uniform1f(ut2.u_synlig, mjuk(0, 2.5, tid));
      gl.drawElements(gl.TRIANGLES, index.length, gl.UNSIGNED_SHORT, 0);
    });

    return stangning({ ljud: l, stoppa, gl });
  },
};
