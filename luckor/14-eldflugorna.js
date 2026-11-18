// Lucka 14: Eldflugorna
// En sommarkvällsäng i skymningen. Ett sextiotal eldflugor svävar runt och blinkar var
// för sig. Håller hon fingret stilla dras de långsamt dit, samlas runt det och börjar
// blinka i takt, tills svärmen pulserar tillsammans. Släpper hon sprids de igen.
// Takten räknas med Kuramotos modell: varje fluga har en egen inre klocka som dras mot
// grannarnas, starkare ju tätare de är.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { brusKalla, rum, klocka } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { mjuk, slump, rumsLjud, slinga, fingrar, stangning } from '../lib/scen.js';

const N = 60;
const VARV = Math.PI * 2;

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform vec4 u_fluga[${N}];   // x, y (skärmbredder, y uppåt), ljus, djup
uniform float u_tid;
uniform float u_synlig;
${BRUS}

void main() {
  float s = u_res.x;
  vec2 p = gl_FragCoord.xy / s;
  vec2 uv = gl_FragCoord.xy / u_res;
  float t = u_tid;

  // Skymningshimmel: djupblå uppåt, en svag ljus rand kvar vid horisonten
  vec3 c = mix(vec3(0.16, 0.14, 0.26), vec3(0.02, 0.03, 0.08), smoothstep(0.15, 0.9, uv.y));
  c += vec3(0.25, 0.14, 0.12) * exp(-pow((uv.y - 0.22) * 9.0, 2.0)) * 0.5;
  vec2 sc = floor(gl_FragCoord.xy / u_res.x * 150.0);
  c += vec3(0.8, 0.85, 1.0) * step(0.994, hash(sc)) * smoothstep(0.4, 0.8, uv.y) * (0.6 + 0.4 * sin(t + hash(sc) * 30.0)) * 0.6;

  // Trädranden långt bort: runda lövkronor i två lager och några granar
  float asp = u_res.y / u_res.x;
  float trad = 0.0;
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    float tx = uv.x * (13.0 + fk * 6.0) + fk * 0.37;
    float ti = floor(tx), tf = fract(tx) - 0.5;
    float kr = 0.45 + 0.35 * hash(vec2(ti, fk + 1.0));
    float bula = sqrt(max(0.0, 1.0 - pow(tf / kr, 2.0))) * (0.022 + 0.018 * hash(vec2(ti, fk + 3.0))) / asp * 2.0;
    trad = max(trad, 0.2 - fk * 0.01 + bula);
  }
  trad += (fbm(vec2(uv.x * 50.0, 0.0)) - 0.5) * 0.006;
  float gx2 = uv.x * 9.0, gi2 = floor(gx2), gf2 = fract(gx2) - 0.5;
  float granH = (0.05 + 0.04 * hash(vec2(gi2, 5.0))) * step(0.5, hash(vec2(gi2, 6.0)));
  float granRel = (uv.y - 0.2) / max(granH, 1e-4);
  bool gran = granRel > 0.0 && granRel < 1.0 && abs(gf2) < (1.0 - granRel) * 0.4 * (0.75 + 0.35 * fract(granRel * 5.0)) * asp * 0.45;
  if (uv.y < trad || gran) c = vec3(0.025, 0.03, 0.05);

  // Eldflugorna bakom gräset (de längre bort)
  vec3 glod = vec3(0.0);
  for (int i = 0; i < ${N}; i++) {
    vec4 f = u_fluga[i];
    vec2 d = p - f.xy;
    float r = 0.005 + 0.004 * f.w;
    float l2 = dot(d, d);
    glod += vec3(0.75, 1.0, 0.35) * f.z * (exp(-l2 / (r * r)) * 1.2 + exp(-l2 / (r * r * 40.0)) * 0.12);
  }

  // Gräset i förgrunden: strån som svajar, och några ängsblommor
  float gx = uv.x * 140.0;
  float gi = floor(gx);
  float gh = 0.06 + 0.07 * hash(vec2(gi, 1.0)) + 0.04 * brus(vec2(gi * 0.1, 0.0));
  float sv = sin(t * 0.7 + gi * 0.37) * 0.25 * (uv.y / gh);
  float gfr = fract(gx + sv) - 0.5;
  bool stra = uv.y < gh && abs(gfr) < 0.28 * (1.0 - uv.y / gh);
  vec2 bl = vec2(fract(uv.x * 23.0 + sin(t * 0.6 + floor(uv.x * 23.0)) * 0.05) - 0.5, uv.y - (0.13 + 0.05 * hash(vec2(floor(uv.x * 23.0), 4.0))));
  bool blomma = hash(vec2(floor(uv.x * 23.0), 9.0)) > 0.6 && length(bl * vec2(1.0, 4.0)) < 0.18;
  bool stjalk = hash(vec2(floor(uv.x * 23.0), 9.0)) > 0.6 && abs(bl.x) < 0.02 && bl.y < 0.0;
  if (stra || blomma || stjalk || uv.y < 0.035) c = vec3(0.012, 0.018, 0.022) + glod * 0.08;
  else c += glod;

  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, t), 1.0);
}`;

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, ['u_res', 'u_fluga', 'u_tid', 'u_synlig']);

    const Hh = () => duk.clientHeight / duk.clientWidth;

    // ---------- Flugorna ----------
    const flugor = Array.from({ length: N }, () => ({
      x: slump(0.05, 0.95), y: slump(0.08, Hh() * 0.75),
      vx: slump(-0.02, 0.02), vy: slump(-0.02, 0.02),
      fas: slump(0, VARV), takt: slump(0.4, 0.7) * VARV, ljus: 0, djup: Math.random(), vandring: slump(0, 100),
    }));
    const finger = { x: 0, y: 0, nere: false, still: 0 };
    fingrar(duk, {
      ner: (x, y) => { finger.nere = true; finger.x = x / duk.clientWidth; finger.y = (duk.clientHeight - y) / duk.clientWidth; finger.still = 0; },
      drag: (x, y) => {
        const nx = x / duk.clientWidth, ny = (duk.clientHeight - y) / duk.clientWidth;
        if (Math.hypot(nx - finger.x, ny - finger.y) > 0.01) finger.still = 0;
        finger.x = nx; finger.y = ny;
      },
      upp: () => { finger.nere = false; },
    });

    // ---------- Ljud ----------
    const l = rumsLjud(1.2, 1.6);
    const { ctx, ut } = l;
    const eko = rum(3.5);
    const ekoUt = ctx.createGain(); ekoUt.gain.value = 0.5;
    eko.connect(ekoUt).connect(ut);
    const kvall = brusKalla('rosa');
    const kF = ctx.createBiquadFilter(); kF.type = 'lowpass'; kF.frequency.value = 260;
    const kG = ctx.createGain(); kG.gain.value = 0.025;
    kvall.connect(kF).connect(kG).connect(ut);
    const ton = ctx.createGain(); ton.gain.value = 0;
    const tonF = ctx.createBiquadFilter(); tonF.type = 'lowpass'; tonF.frequency.value = 600;
    [[174.61, 0.5], [261.63, 0.3], [349.23, 0.15]].forEach(([f, g], i) => {
      const o = ctx.createOscillator(); o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = g;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.04 + i * 0.02;
      const lg = ctx.createGain(); lg.gain.value = g * 0.4;
      lfo.connect(lg).connect(og.gain);
      o.connect(og).connect(tonF); o.start(); lfo.start();
      l.kallor.push(o, lfo);
    });
    tonF.connect(ton).connect(ut);
    ton.gain.setTargetAtTime(0.03, ctx.currentTime + 0.5, 2);
    l.kallor.push(kvall);

    // Syrsor långt bort: korta toner i små serier
    function syrsa() {
      const t = ctx.currentTime;
      const f = slump(4200, 5200);
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const o = ctx.createOscillator(); o.frequency.value = f;
        const g = ctx.createGain();
        const t0 = t + i * 0.06;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.006, t0 + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035);
        o.connect(g).connect(ut);
        o.start(t0); o.stop(t0 + 0.05);
      }
    }

    // ---------- Ritslinga ----------
    const data = new Float32Array(N * 4);
    let syrsTid = slump(1, 3);
    let senastKlang = 0;
    const TONER = [523.25, 587.33, 659.25, 783.99, 880];
    const stoppa = slinga((tid, dt) => {
      const H = Hh();
      if (finger.nere) finger.still += dt;
      let samlade = 0;
      for (const f of flugor) {
        // Vandring: en mjuk, slumpvis drift
        f.vandring += dt * 0.3;
        f.vx += Math.sin(f.vandring * 1.3) * 0.012 * dt;
        f.vy += Math.cos(f.vandring * 1.1 + 2) * 0.012 * dt;
        // Dras mot fingret, mjukt, och stannar en bit ifrån i en lös svärm
        if (finger.nere) {
          const dx = finger.x - f.x, dy = finger.y - f.y, d = Math.hypot(dx, dy) + 1e-4;
          const drag = (d > 0.07 ? 0.05 : -0.02) * Math.min(1, 0.3 + finger.still * 0.4);
          f.vx += (dx / d) * drag * dt;
          f.vy += (dy / d) * drag * dt;
          if (d < 0.16) samlade++;
        }
        // Håll sig inom ängen
        if (f.x < 0.03) f.vx += 0.03 * dt; if (f.x > 0.97) f.vx -= 0.03 * dt;
        if (f.y < 0.05) f.vy += 0.03 * dt; if (f.y > H * 0.85) f.vy -= 0.03 * dt;
        const fart = Math.hypot(f.vx, f.vy), max = 0.05;
        if (fart > max) { f.vx *= max / fart; f.vy *= max / fart; }
        f.vx *= Math.exp(-dt * 0.4); f.vy *= Math.exp(-dt * 0.4);
        f.x += f.vx * dt; f.y += f.vy * dt;
      }
      // Kuramoto: varje fluga dras mot grannarnas takt, starkare när de är samlade
      const koppling = finger.nere ? 0.4 + Math.min(1.6, finger.still * 0.25) : 0.05;
      let blinkar = 0;
      for (const f of flugor) {
        let sum = 0, n = 0;
        for (const g of flugor) {
          if (g === f) continue;
          const d = Math.hypot(g.x - f.x, g.y - f.y);
          if (d < 0.2) { sum += Math.sin(g.fas - f.fas); n++; }
        }
        const fore = f.fas;
        f.fas += (f.takt + (n ? (koppling * sum) / n : 0)) * dt;
        if (Math.floor(fore / VARV) !== Math.floor(f.fas / VARV)) { f.ljus = 1; blinkar++; }
        f.ljus *= Math.exp(-dt * 2.6);
      }
      // När många blinkar på en gång hörs en mjuk klang
      const t = ctx.currentTime;
      if (blinkar >= 12 && samlade >= 15 && tid - senastKlang > 1.2) {
        klocka(TONER[Math.floor(Math.random() * TONER.length)], { till: ut, eko, styrka: 0.02, ansats: 0.05, langd: 3 });
        senastKlang = tid;
      }
      syrsTid -= dt;
      if (syrsTid <= 0) { syrsa(); syrsTid = slump(0.6, 2.5); }

      flugor.forEach((f, i) => data.set([f.x, f.y, 0.05 + f.ljus, f.djup], i * 4));
      anpassa(gl, duk, 0.6);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform4fv(u.u_fluga, data);
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_synlig, mjuk(0, 3, tid));
      ritaHelskarm(gl);
    });

    return stangning({ ljud: l, stoppa, gl });
  },
};
