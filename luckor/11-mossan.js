// Lucka 11: Mossan
// En granitsten i skogen, sedd uppifrån, med lite mossa och lav i skrevorna. Där hon
// håller fingret blir stenen fuktig, och mossa och lav växer långsamt ut därifrån.
// Mönstren räknas fram med reaktion-diffusion (Gray-Scott): två ämnen som sprids och
// reagerar med varandra. Fukten styr var det växer, och ett brusfält väljer om det
// blir mjuk mossa i slingor eller lav i fläckar.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { brusKalla } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { mjuk, slump, rumsLjud, slinga, fingrar, stangning, bubbla } from '../lib/scen.js';

const RW = 160, RH = 320;
const ITER = 4;           // reaktionssteg per bildruta, styr hur fort det växer

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform sampler2D u_vaxt;   // r: ämne V (växten), g: fukt, b: sort (0 mossa, 1 lav)
uniform vec2 u_rut;
uniform float u_tid;
uniform float u_synlig;
${BRUS}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 tc = vec2(uv.x, 1.0 - uv.y);
  float asp = u_res.y / u_res.x;
  vec2 p = vec2(uv.x, uv.y * asp);

  vec4 t = texture(u_vaxt, tc);
  vec2 e = 1.0 / u_rut;
  float vx = texture(u_vaxt, tc + vec2(e.x, 0.0)).r - texture(u_vaxt, tc - vec2(e.x, 0.0)).r;
  float vy = texture(u_vaxt, tc + vec2(0.0, e.y)).r - texture(u_vaxt, tc - vec2(0.0, e.y)).r;

  // Granit: grått med korn av svart, vitt och rosa fältspat, och mjuka buckor
  float korn = hash(floor(gl_FragCoord.xy * 0.7));
  vec3 sten = vec3(0.46, 0.45, 0.43) * (0.85 + 0.25 * fbm(p * 6.0));
  sten = mix(sten, vec3(0.16, 0.16, 0.17), step(0.86, korn) * 0.8);
  sten = mix(sten, vec3(0.75, 0.72, 0.68), step(0.95, hash(floor(gl_FragCoord.xy * 0.5) + 3.0)) * 0.6);
  sten = mix(sten, vec3(0.62, 0.48, 0.44), smoothstep(0.62, 0.8, fbm(p * 14.0)) * 0.4);
  float bucka = fbm(p * 2.2);
  vec3 sn = normalize(vec3(-(fbm(p * 2.2 + vec2(0.01, 0.0)) - bucka) * 25.0, (fbm(p * 2.2 + vec2(0.0, 0.01)) - bucka) * 25.0, 1.0));
  vec3 L = normalize(vec3(-0.5, 0.6, 0.6));
  sten *= 0.65 + 0.5 * max(dot(sn, L), 0.0);
  // Fukt mörkar stenen
  sten *= 1.0 - 0.14 * smoothstep(0.3, 0.9, t.g);

  // Växten: tjockare där V är högt, belyst som en mjuk kudde, med luddiga kanter
  float ludd = brus(gl_FragCoord.xy * 0.45) * 0.6 + brus(gl_FragCoord.xy * 1.1) * 0.4;
  float tjock = smoothstep(0.05 + 0.12 * ludd, 0.28, t.r);
  vec3 vn = normalize(vec3(-vx * 9.0, vy * 9.0, 1.0));
  float ljus = 0.55 + 0.6 * max(dot(vn, L), 0.0);
  // Mossans yta är full av små skott: ljusa toppar och mörka glipor emellan
  float skott = pow(brus(gl_FragCoord.xy * 0.7), 2.0);
  float topp = step(0.82, hash(floor(gl_FragCoord.xy * 0.5) + 5.0));
  vec3 mossa = mix(vec3(0.06, 0.14, 0.04), vec3(0.34, 0.50, 0.13), smoothstep(0.12, 0.42, t.r));
  mossa = mix(mossa, vec3(0.20, 0.36, 0.08), smoothstep(0.5, 0.75, fbm(p * 8.0)) * 0.5);
  mossa *= 0.6 + 0.6 * skott;
  mossa += vec3(0.25, 0.35, 0.08) * topp * tjock * 0.5;
  float fin = ludd;
  // Laven är platt och matt, med sträv yta och ljusare kant
  vec3 lav = mix(vec3(0.58, 0.64, 0.52), vec3(0.74, 0.78, 0.64), smoothstep(0.15, 0.4, t.r));
  lav = mix(lav, vec3(0.80, 0.56, 0.22), smoothstep(0.6, 0.8, fbm(p * 5.0 + 7.0)) * 0.8);
  lav *= 0.72 + 0.4 * brus(gl_FragCoord.xy * 0.9) * brus(gl_FragCoord.xy * 0.23 + 4.0);
  lav *= 1.0 + 0.15 * (1.0 - smoothstep(0.1, 0.25, t.r));
  float lavLjus = 0.85 + 0.2 * max(dot(vn, L), 0.0);
  vec3 vaxt = mix(mossa * ljus, lav * lavLjus * (0.8 + 0.25 * max(dot(sn, L), 0.0)), t.b);
  vec3 c = mix(sten, vaxt, tjock);
  // Daggdroppar som glittrar på mossan där det är fuktigt
  float dagg = step(0.994, hash(floor(gl_FragCoord.xy * 0.4) + 11.0)) * tjock * smoothstep(0.4, 0.8, t.g);
  c += vec3(0.9, 0.95, 1.0) * dagg * (0.5 + 0.5 * sin(u_tid * 1.5 + korn * 30.0));

  // Ljus genom träden: mjuka fläckar av sol som driver långsamt
  float sol = smoothstep(0.45, 0.75, fbm(p * 1.5 + vec2(u_tid * 0.01, u_tid * 0.004)));
  c *= 0.78 + 0.35 * sol;
  c *= 1.0 - 0.35 * pow(length(uv - 0.5) * 1.3, 2.2);
  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, u_tid), 1.0);
}`;

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, ['u_res', 'u_vaxt', 'u_rut', 'u_tid', 'u_synlig']);

    // ---------- Reaktion-diffusion ----------
    const N = RW * RH;
    let U = new Float32Array(N).fill(1), V = new Float32Array(N);
    let U2 = new Float32Array(N), V2 = new Float32Array(N);
    const fukt = new Float32Array(N), grundFukt = new Float32Array(N);
    const sort = new Float32Array(N);
    const F = new Float32Array(N), K = new Float32Array(N);

    // Mjukt brus i JavaScript, för fukt och sort
    const fro = Array.from({ length: 6 }, () => [slump(0, 6.28), slump(0.6, 1.4)]);
    const mjuktBrus = (x, y) => {
      let v = 0;
      fro.forEach(([f, s], i) => { v += Math.sin(x * 0.04 * s * (i + 1) + f) * Math.cos(y * 0.035 * s * (i + 1) - f * 1.3) / (i + 1); });
      return v;
    };
    for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
      const i = y * RW + x;
      // Skrevor där fukten samlas
      grundFukt[i] = mjuk(0.1, 0.75, mjuktBrus(x, y) * 0.6 + 0.3);
      fukt[i] = grundFukt[i];
      sort[i] = mjuk(0.15, 0.6, mjuktBrus(x + 300, y + 170));
    }
    // Några små fläckar att börja med
    function sa(cx, cy, r, styrka = 1) {
      for (let y = Math.max(1, Math.floor(cy - r)); y < Math.min(RH - 1, cy + r); y++) {
        for (let x = Math.max(1, Math.floor(cx - r)); x < Math.min(RW - 1, cx + r); x++) {
          const d = Math.hypot(x - cx, y - cy);
          if (d < r && Math.random() < 0.6) { V[y * RW + x] = Math.min(1, V[y * RW + x] + 0.5 * styrka); U[y * RW + x] = 0.5; }
        }
      }
    }
    for (let k = 0; k < 7; k++) {
      let best = null;
      for (let f = 0; f < 20; f++) {
        const x = slump(10, RW - 10), y = slump(10, RH - 10);
        if (!best || grundFukt[Math.floor(y) * RW + Math.floor(x)] > best.f) best = { x, y, f: grundFukt[Math.floor(y) * RW + Math.floor(x)] };
      }
      sa(best.x, best.y, slump(2, 4));
    }

    // Mossa (korallika slingor) och lav (fläckar) har olika matning och nedbrytning.
    // I torra områden är matningen så låg att växten tynar bort.
    function parametrar() {
      for (let i = 0; i < N; i++) {
        const fm = 0.0545, km = 0.062;      // slingor
        const fl = 0.0367, kl = 0.0649;     // fläckar
        const f = fm + (fl - fm) * sort[i], k = km + (kl - km) * sort[i];
        const m = mjuk(0.15, 0.6, fukt[i]);
        F[i] = 0.012 + (f - 0.012) * m;
        K[i] = k + (1 - m) * 0.006;
      }
    }
    parametrar();

    function reagera() {
      for (let y = 1; y < RH - 1; y++) {
        const r = y * RW;
        for (let x = 1; x < RW - 1; x++) {
          const i = r + x;
          const u0 = U[i], v0 = V[i];
          const lu = (U[i - 1] + U[i + 1] + U[i - RW] + U[i + RW]) * 0.2 +
            (U[i - RW - 1] + U[i - RW + 1] + U[i + RW - 1] + U[i + RW + 1]) * 0.05 - u0;
          const lv = (V[i - 1] + V[i + 1] + V[i - RW] + V[i + RW]) * 0.2 +
            (V[i - RW - 1] + V[i - RW + 1] + V[i + RW - 1] + V[i + RW + 1]) * 0.05 - v0;
          const uvv = u0 * v0 * v0;
          U2[i] = u0 + (1.0 * lu - uvv + F[i] * (1 - u0));
          V2[i] = v0 + (0.5 * lv + uvv - (F[i] + K[i]) * v0);
        }
      }
      let t = U; U = U2; U2 = t;
      t = V; V = V2; V2 = t;
    }
    // Låt växten hinna forma sig innan rummet visas
    for (let k = 0; k < 500; k++) reagera();

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const texData = new Float32Array(N * 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, RW, RH, 0, gl.RGBA, gl.FLOAT, texData);
    gl.uniform1i(u.u_vaxt, 0);
    gl.uniform2f(u.u_rut, RW, RH);

    // ---------- Ljud ----------
    const l = rumsLjud(1.25, 1.5);
    const { ctx, ut } = l;
    const skog = brusKalla('rosa');
    const skF = ctx.createBiquadFilter(); skF.type = 'bandpass'; skF.frequency.value = 650; skF.Q.value = 0.4;
    const skG = ctx.createGain(); skG.gain.value = 0.02;
    const skLfo = ctx.createOscillator(); skLfo.frequency.value = 0.045;
    const skDjup = ctx.createGain(); skDjup.gain.value = 0.014;
    skLfo.connect(skDjup).connect(skG.gain);
    skog.connect(skF).connect(skG).connect(ut);
    skLfo.start();
    const mull = brusKalla('rosa');
    const muF = ctx.createBiquadFilter(); muF.type = 'lowpass'; muF.frequency.value = 160;
    const muG = ctx.createGain(); muG.gain.value = 0.025;
    mull.connect(muF).connect(muG).connect(ut);
    const prassel = brusKalla('korn');
    const prF = ctx.createBiquadFilter(); prF.type = 'bandpass'; prF.frequency.value = 3200; prF.Q.value = 0.8;
    const prG = ctx.createGain(); prG.gain.value = 0;
    prassel.connect(prF).connect(prG).connect(ut);
    l.kallor.push(skog, skLfo, mull, prassel);

    // ---------- Fingret ----------
    const finger = { x: 0, y: 0, nere: false, fart: 0 };
    const tillRut = (x, y) => [(x / duk.clientWidth) * RW, (y / duk.clientHeight) * RH];
    fingrar(duk, {
      ner: (x, y) => { [finger.x, finger.y] = tillRut(x, y); finger.nere = true; },
      drag: (x, y) => {
        const [nx, ny] = tillRut(x, y);
        finger.fart = Math.min(1, finger.fart + Math.hypot(nx - finger.x, ny - finger.y) * 0.05);
        finger.x = nx; finger.y = ny;
      },
      upp: () => { finger.nere = false; },
    });

    // ---------- Ritslinga ----------
    let droppTid = slump(2, 6);
    let paramTid = 0;
    const stoppa = slinga((tid, dt) => {
      // Fingret fuktar stenen och sår lite växt, fukten torkar sakta tillbaka
      if (finger.nere) {
        const R = 14;
        for (let y = Math.max(1, Math.floor(finger.y - R)); y < Math.min(RH - 1, finger.y + R); y++) {
          for (let x = Math.max(1, Math.floor(finger.x - R)); x < Math.min(RW - 1, finger.x + R); x++) {
            const d = Math.hypot(x - finger.x, y - finger.y);
            if (d < R) {
              const i = y * RW + x;
              fukt[i] = Math.min(1, fukt[i] + dt * 0.9 * (1 - d / R));
              if (d < 4 && Math.random() < dt * 6) { V[i] = Math.min(1, V[i] + 0.45); U[i] = 0.5; }
            }
          }
        }
      }
      const torka = Math.min(1, dt * 0.02);
      for (let i = 0; i < N; i++) fukt[i] += (grundFukt[i] - fukt[i]) * torka;
      paramTid -= dt;
      if (paramTid <= 0) { parametrar(); paramTid = 0.25; }
      for (let k = 0; k < ITER; k++) reagera();

      // Ljud: prassel när fingret rör sig, enstaka droppar från träden
      finger.fart *= Math.exp(-dt * 4);
      const t = ctx.currentTime;
      prG.gain.setTargetAtTime(0.02 * finger.fart + (finger.nere ? 0.004 : 0), t, 0.08);
      droppTid -= dt;
      if (droppTid <= 0) {
        bubbla(ctx, ut, slump(1200, 2400), slump(0.01, 0.025), t);
        droppTid = slump(3, 11);
      }

      for (let i = 0; i < N; i++) {
        texData[i * 4] = V[i]; texData[i * 4 + 1] = fukt[i]; texData[i * 4 + 2] = sort[i];
      }
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, RW, RH, gl.RGBA, gl.FLOAT, texData);
      anpassa(gl, duk, 0.75);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_synlig, mjuk(0, 3, tid));
      ritaHelskarm(gl);
    });

    return stangning({ ljud: l, stoppa, gl });
  },
};
