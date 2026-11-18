// Lucka 23: Degen
// Bakdag. En mjuk, gyllene saffransdeg till lussebullar ligger på ett mjölat bakbord.
// Hon trycker i den med fingret, och degen ger efter och väller upp runt fingret.
// Drar hon fingret knådas och sträcks degen. Mjölet på ytan smetas ut där hon tar,
// så att den blanka degen syns under. När hon släpper fylls groparna sakta igen
// medan degen jäser och blir rundare och större. Ett tryck på bordet strör lite mjöl.
//
// Degen är ett höjdfält. Det som trycks undan läggs i en vall runt fingret, så att
// degen känns som en sammanhängande massa.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { brusKalla } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { mjuk, slump, klamp, rumsLjud, slinga, fingrar, stangning } from '../lib/scen.js';

const GW = 150, GH = 324;

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform sampler2D u_deg;    // r: höjd, g: mjöl
uniform vec2 u_rut;
uniform float u_tid;
uniform float u_synlig;
${BRUS}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 tc = vec2(uv.x, 1.0 - uv.y);
  float asp = u_res.y / u_res.x;
  vec2 p = vec2(uv.x, uv.y * asp);
  vec4 t = texture(u_deg, tc);
  float h = t.r;
  vec2 e = 1.0 / u_rut;
  float hx = texture(u_deg, tc + vec2(e.x, 0.0)).r - texture(u_deg, tc - vec2(e.x, 0.0)).r;
  float hy = texture(u_deg, tc + vec2(0.0, e.y)).r - texture(u_deg, tc - vec2(0.0, e.y)).r;
  vec3 n = normalize(vec3(-hx * 26.0, hy * 26.0, 1.0));
  vec3 L = normalize(vec3(-0.45, 0.55, 0.7));
  float lj = max(dot(n, L), 0.0);

  // Bakbordet: ljust trä med lite mjöl utspritt
  float ad = fbm(vec2(p.x * 3.0, p.y * 26.0)) * 0.7 + brus(vec2(p.x * 10.0, p.y * 90.0)) * 0.3;
  vec3 c = mix(vec3(0.55, 0.38, 0.22), vec3(0.72, 0.53, 0.33), ad);
  c *= 0.75 + 0.3 * exp(-dot(p - vec2(0.45, asp * 0.6), p - vec2(0.45, asp * 0.6)) * 0.8);
  float bordMjol = smoothstep(0.6, 0.85, fbm(p * 14.0 + 3.0)) * 0.35 * smoothstep(0.3, 0.7, fbm(p * 3.0 + 9.0)) + t.g * 0.6;
  c = mix(c, vec3(0.93, 0.9, 0.84), clamp(bordMjol, 0.0, 0.85) * step(h, 0.004));
  // Degens mjuka skugga på bordet
  float skugga = texture(u_deg, tc + vec2(0.018, -0.012)).r;
  c *= 1.0 - smoothstep(0.0, 0.15, skugga) * 0.45 * (1.0 - smoothstep(0.004, 0.02, h));

  // Degen: gyllene av saffranet, mjukt upplyst inifrån, med en svag fukt-glans
  float deg = smoothstep(0.002, 0.012, h);
  if (deg > 0.0) {
    vec3 gul = mix(vec3(0.85, 0.64, 0.3), vec3(1.0, 0.87, 0.56), lj);
    gul *= 0.5 + 0.62 * lj;
    // Mörkare nertill mot bordet, där ljuset inte når
    gul *= 0.7 + 0.3 * smoothstep(0.0, 0.15, h);
    gul += vec3(0.25, 0.12, 0.02) * (1.0 - lj) * 0.4;
    // Små bubblor och ojämnheter i degen
    gul *= 0.98 + 0.03 * fbm(p * 30.0);
    float glans = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 22.0);
    float mjol = clamp(t.g, 0.0, 1.0);
    gul += vec3(1.0, 0.95, 0.85) * glans * 0.07 * (1.0 - mjol);
    // Mjölet ligger som ett matt, ojämnt damm ovanpå
    float damm = mjol * smoothstep(0.3, 0.8, fbm(p * 9.0 + 2.0) + mjol * 0.3);
    vec3 mjolF = vec3(0.95, 0.93, 0.88) * (0.75 + 0.3 * lj);
    gul = mix(gul, mjolF, clamp(damm, 0.0, 0.9));
    c = mix(c, gul, deg);
  }

  c *= 1.0 - 0.25 * pow(length(uv - 0.5) * 1.3, 2.5);
  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, u_tid), 1.0);
}`;

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, ['u_res', 'u_deg', 'u_rut', 'u_tid', 'u_synlig']);

    // ---------- Degen ----------
    const N = GW * GH;
    const h = new Float32Array(N), mjol = new Float32Array(N), tmp = new Float32Array(N);
    const vila = new Float32Array(N);    // den runda formen degen söker sig mot
    const CX = GW / 2, CY = GH * 0.55, RAD = GW * 0.36;
    const TOPP = 0.3;
    function vilaForm(jas) {
      const r0 = RAD * (1 + 0.18 * jas), t0 = TOPP * (1 + 0.12 * jas);
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
        const d = Math.hypot(x - CX, (y - CY) * 1.02) / r0;
        vila[y * GW + x] = d < 1 ? t0 * Math.pow(1 - d * d, 0.5) : 0;
      }
    }
    vilaForm(0);
    for (let i = 0; i < N; i++) {
      h[i] = vila[i];
      mjol[i] = h[i] > 0 ? 0.35 + 0.3 * Math.random() * Math.random() : 0;
    }
    let jas = 0;

    // Ett tryck: degen sjunker under fingret och det undanträngda väller upp runt om
    function tryck(cx, cy, styrka) {
      const R = 7, VALL = 6;
      let bort = 0;
      for (let y = Math.max(1, Math.floor(cy - R)); y <= Math.min(GH - 2, Math.ceil(cy + R)); y++) {
        for (let x = Math.max(1, Math.floor(cx - R)); x <= Math.min(GW - 2, Math.ceil(cx + R)); x++) {
          const d = Math.hypot(x - cx, y - cy) / R;
          if (d >= 1) continue;
          const i = y * GW + x;
          if (h[i] <= 0.002) continue;
          const mal = h[i] * (0.35 + 0.65 * d * d);
          const ta = (h[i] - mal) * styrka * (1 - d * d);
          h[i] -= ta;
          bort += ta;
          // Där fingret tar fastnar mjölet på fingret och den blanka degen syns
          mjol[i] *= 1 - 0.25 * styrka * (1 - d);
        }
      }
      if (bort <= 0) return;
      // Lägg det undanträngda i en ring runt fingret, där det finns deg
      let vikt = 0;
      const ring = [];
      for (let y = Math.max(1, Math.floor(cy - R - VALL)); y <= Math.min(GH - 2, Math.ceil(cy + R + VALL)); y++) {
        for (let x = Math.max(1, Math.floor(cx - R - VALL)); x <= Math.min(GW - 2, Math.ceil(cx + R + VALL)); x++) {
          const d = Math.hypot(x - cx, y - cy);
          if (d < R || d > R + VALL) continue;
          const i = y * GW + x;
          if (h[i] <= 0.002 && vila[i] <= 0) continue;
          const w = 1 - Math.abs(d - R - VALL * 0.35) / VALL;
          if (w <= 0) continue;
          ring.push(i, w);
          vikt += w;
        }
      }
      for (let k = 0; k < ring.length; k += 2) h[ring[k]] += (bort * ring[k + 1]) / vikt;
    }

    // Knåda: degen dras med fingret och sträcks
    function knada(cx, cy, dx, dy) {
      const R = 10;
      const x0 = Math.max(1, Math.floor(cx - R)), x1 = Math.min(GW - 2, Math.ceil(cx + R));
      const y0 = Math.max(1, Math.floor(cy - R)), y1 = Math.min(GH - 2, Math.ceil(cy + R));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tmp[y * GW + x] = h[y * GW + x];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy) / R;
        if (d >= 1) continue;
        const w = (1 - d * d) * 0.85;
        const sx = klamp(x - dx * w, 1, GW - 2), sy = klamp(y - dy * w, 1, GH - 2);
        const ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
        const a = (ix2, iy2) => (ix2 >= x0 && ix2 <= x1 && iy2 >= y0 && iy2 <= y1 ? tmp[iy2 * GW + ix2] : h[iy2 * GW + ix2]);
        const v = (a(ix, iy) * (1 - fx) + a(ix + 1, iy) * fx) * (1 - fy) + (a(ix, iy + 1) * (1 - fx) + a(ix + 1, iy + 1) * fx) * fy;
        h[y * GW + x] = v;
        mjol[y * GW + x] *= 1 - 0.05 * (1 - d);
      }
    }

    // Strö mjöl
    function stro(cx, cy) {
      for (let k = 0; k < 260; k++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 16;
        const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
        if (x < 0 || x >= GW || y < 0 || y >= GH) continue;
        mjol[y * GW + x] = Math.min(1, mjol[y * GW + x] + 0.12 * (1 - r / 16));
      }
    }

    // ---------- Ljud ----------
    const l = rumsLjud(1.5, 2);
    const { ctx, ut } = l;
    // Degen: ett mjukt, fuktigt ljud när den trycks och knådas
    const kladd = brusKalla('rosa');
    const klF = ctx.createBiquadFilter(); klF.type = 'lowpass'; klF.frequency.value = 400; klF.Q.value = 2.5;
    const klG = ctx.createGain(); klG.gain.value = 0;
    kladd.connect(klF).connect(klG).connect(ut);
    // Mjölet som prasslar när det strös
    const prassel = brusKalla('korn');
    const prF = ctx.createBiquadFilter(); prF.type = 'bandpass'; prF.frequency.value = 3500; prF.Q.value = 0.6;
    const prG = ctx.createGain(); prG.gain.value = 0;
    prassel.connect(prF).connect(prG).connect(ut);
    // Köket: en varm ugn som brummar svagt
    const ugn = brusKalla('rosa');
    const ugF = ctx.createBiquadFilter(); ugF.type = 'lowpass'; ugF.frequency.value = 160;
    const ugG = ctx.createGain(); ugG.gain.value = 0.035;
    ugn.connect(ugF).connect(ugG).connect(ut);
    l.kallor.push(kladd, prassel, ugn);
    let kladdNiva = 0, prasselNiva = 0;

    // ---------- Fingret ----------
    const tillRut = (x, y) => [(x / duk.clientWidth) * GW, (y / duk.clientHeight) * GH];
    const pek = new Map();
    fingrar(duk, {
      ner: (x, y, id) => {
        const [gx, gy] = tillRut(x, y);
        pek.set(id, { x: gx, y: gy, hall: 0 });
        tryck(gx, gy, 0.35);
        kladdNiva = Math.min(1, kladdNiva + 0.4);
      },
      drag: (x, y, id) => {
        const p = pek.get(id);
        if (!p) return;
        const [gx, gy] = tillRut(x, y);
        const dx = gx - p.x, dy = gy - p.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.3) {
          const n = Math.ceil(d / 2);
          for (let s = 1; s <= n; s++) knada(p.x + (dx * s) / n, p.y + (dy * s) / n, dx / n, dy / n);
          p.x = gx; p.y = gy;
          kladdNiva = Math.min(1, kladdNiva + d * 0.03);
        }
      },
      upp: (x, y, id, { tryck: kort }) => {
        const p = pek.get(id);
        pek.delete(id);
        if (!p || !kort) return;
        // Ett kort tryck utanför degen strör mjöl
        const i = Math.round(p.y) * GW + Math.round(p.x);
        if (!(h[i] > 0.01)) { stro(p.x, p.y); prasselNiva = 1; }
      },
    });

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const data = new Float32Array(N * 2);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, GW, GH, 0, gl.RG, gl.FLOAT, data);
    gl.uniform1i(u.u_deg, 0);
    gl.uniform2f(u.u_rut, GW, GH);

    // ---------- Ritslinga ----------
    let formTid = 0;
    const stoppa = slinga((tid, dt) => {
      // Fingrar som vilar i degen sjunker sakta djupare
      for (const p of pek.values()) { p.hall += dt; tryck(p.x, p.y, Math.min(0.12, dt * 1.2)); }

      // Degen jäser sakta och blir större, och vilformen följer med
      jas = Math.min(1, jas + dt / 240);
      formTid += dt;
      if (formTid > 1) { vilaForm(jas); formTid = 0; }
      // Groparna jämnas ut: en mjuk utjämning, och en långsam dragning mot den runda
      // formen. Det som rörs just nu får vara i fred.
      const jamn = Math.min(1, dt * 1.4), form = Math.min(1, dt * 0.05);
      for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) {
        const i = y * GW + x;
        const snitt = (h[i - 1] + h[i + 1] + h[i - GW] + h[i + GW]) * 0.25;
        tmp[i] = h[i] + ((h[i] > 0.003 ? snitt : Math.min(h[i], snitt)) - h[i]) * jamn * 0.5 + (vila[i] - h[i]) * form;
      }
      for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) {
        const i = y * GW + x;
        h[i] = Math.max(0, tmp[i]);
      }
      // Mjölet på bordet bleknar inte, men det på degen tunnas sakta ut när den jäser
      for (let i = 0; i < N; i++) {
        if (h[i] > 0.01) mjol[i] = Math.max(0.15 * (1 - jas), mjol[i] - dt * 0.002);
        data[i * 2] = h[i];
        data[i * 2 + 1] = mjol[i];
      }

      const t = ctx.currentTime;
      kladdNiva *= Math.exp(-dt * 4);
      prasselNiva *= Math.exp(-dt * 3);
      klG.gain.setTargetAtTime(0.1 * kladdNiva, t, 0.05);
      klF.frequency.setTargetAtTime(250 + 350 * kladdNiva, t, 0.08);
      prG.gain.setTargetAtTime(0.04 * prasselNiva, t, 0.05);

      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, GW, GH, gl.RG, gl.FLOAT, data);
      anpassa(gl, duk, 0.75);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_synlig, mjuk(0, 2.5, tid));
      ritaHelskarm(gl);
    });

    return stangning({ ljud: l, stoppa, gl });
  },
};
