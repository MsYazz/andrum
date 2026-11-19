// Lucka 5: Glöden
// En brasa som har brunnit ner till glöd. Fingret fläktar elden: håller eller rör man
// fingret över brasan tar lågorna fart, ett snabbt svep uppåt blåser upp gnistor,
// och ett tryck i glöden rör om. Utan fläkt sjunker elden långsamt tillbaka till glöd.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { skapaMatta, skapaLjudbank } from '../lib/inspelning.js';

// Elden i inspelningen knäpper till ordentligt vid de här tiderna, [start, längd]
const KNAPP = [[1.41, 0.35], [3.89, 0.4], [15.70, 0.4], [17.27, 0.4], [18.03, 0.4], [22.65, 0.35], [22.91, 0.35], [24.46, 0.3], [28.36, 0.4], [32.89, 0.3]];
import { brusKalla } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { mjuk, slump, klamp, rumsLjud, slinga, fingrar, stangning, brusstot } from '../lib/scen.js';

const GNISTOR = 32;
const GRUND = 0.3;   // elden när ingen fläktar

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform float u_tid;
uniform float u_eld;
uniform float u_flimmer;
uniform vec4 u_gnista[${GNISTOR}];
uniform float u_synlig;
${BRUS}

// Avstånd till en kapsel (ett vedträ)
float kapsel(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

// Avstånd till närmaste kant i ett cellmönster, ger sprickor i glöden
float sprickor(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = hash2(i + g);
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return d2 - d1;
}

vec3 eldFarg(float v) {
  vec3 c = mix(vec3(0.0), vec3(0.55, 0.06, 0.02), smoothstep(0.0, 0.25, v));
  c = mix(c, vec3(1.0, 0.36, 0.06), smoothstep(0.2, 0.5, v));
  c = mix(c, vec3(1.0, 0.72, 0.25), smoothstep(0.45, 0.8, v));
  c = mix(c, vec3(1.0, 0.93, 0.75), smoothstep(0.8, 1.0, v));
  return c;
}

void main() {
  float s = u_res.x;
  vec2 p = (gl_FragCoord.xy - vec2(0.5 * u_res.x, 0.24 * u_res.y)) / s;
  float t = u_tid;
  float I = u_eld;

  // Mörkret runt elden, upplyst av den
  float ljus = I * (0.75 + 0.25 * u_flimmer);
  vec3 c = vec3(0.025, 0.018, 0.02);
  c += vec3(0.55, 0.22, 0.08) * exp(-dot(p - vec2(0.0, 0.12), p - vec2(0.0, 0.12)) * 4.0) * (0.25 + 0.9 * ljus);
  // Marken: aska och sten, varmast nära glöden
  if (p.y < 0.02) {
    float aska = fbm(p * 9.0) * 0.6 + brus(p * 40.0) * 0.2;
    vec3 mark = mix(vec3(0.07, 0.06, 0.06), vec3(0.22, 0.2, 0.19), aska);
    float nara = exp(-p.x * p.x * 6.0) * exp(p.y * 8.0);
    c = mark * (0.25 + 1.2 * ljus * nara) + vec3(0.4, 0.12, 0.03) * nara * ljus * 0.4;
  }

  // Glödbädden
  float baddTopp = 0.07 + 0.03 * brus(vec2(p.x * 6.0, 0.0)) - 0.5 * p.x * p.x;
  if (p.y < baddTopp && p.y > -0.03 && abs(p.x) < 0.46) {
    // En hög av små kolbitar med glödande springor emellan
    vec2 q = p + vec2(fbm3(p * 9.0), fbm3(p * 9.0 + 4.0)) * 0.03;
    float kr = sprickor(q * vec2(38.0, 48.0));
    float springa = (1.0 - smoothstep(0.0, 0.1, kr)) * smoothstep(0.25, 0.6, brus(q * 11.0));
    float pul = 0.65 + 0.35 * sin(t * 0.6 + brus(p * 3.0) * 6.0);
    float inre = brus(q * 20.0 + vec2(0.0, t * 0.15));
    float glod = (springa * 0.9 + inre * 0.45 * smoothstep(0.35, 0.85, brus(q * 6.0))) * pul;
    vec3 kol = mix(vec3(0.06, 0.03, 0.025), vec3(0.18, 0.07, 0.035), brus(q * 45.0));
    float v = glod * (0.3 + 0.8 * I) * smoothstep(-0.03, 0.03, baddTopp - p.y + 0.02);
    c = kol * (0.5 + ljus) + eldFarg(v * 0.8) * 1.15;
  }

  // Två vedträn med glödande sprickor
  float d1 = kapsel(p, vec2(-0.36, 0.09), vec2(0.30, 0.17), 0.055);
  float d2 = kapsel(p, vec2(0.37, 0.08), vec2(-0.22, 0.22), 0.048);
  float dv = min(d1, d2);
  if (dv < 0.0) {
    // Förkolnad yta: mörka sprickor överallt, glöd bara här och där och mest på undersidan
    bool forsta = d1 < d2;
    vec2 a = forsta ? vec2(-0.36, 0.09) : vec2(0.37, 0.08);
    vec2 b = forsta ? vec2(0.30, 0.17) : vec2(-0.22, 0.22);
    vec2 ax = normalize(b - a);
    vec2 lq = vec2(dot(p - a, ax), dot(p - a, vec2(-ax.y, ax.x))) + (forsta ? 0.0 : 3.1);
    float bark = fbm(lq * vec2(14.0, 40.0));
    vec3 vedC = mix(vec3(0.03, 0.02, 0.018), vec3(0.13, 0.075, 0.045), bark);
    float kr = sprickor(lq * vec2(26.0, 52.0) + vec2(fbm3(lq * 20.0) * 0.6, 0.0));
    float spricka = 1.0 - smoothstep(0.0, 0.06, kr);
    vedC *= 1.0 - spricka * 0.35;
    float undersida = clamp(-dot(p - a, vec2(-ax.y, ax.x)) / 0.05 * 0.5 + 0.5, 0.0, 1.0);
    float glod = spricka * smoothstep(0.58, 0.76, brus(lq * vec2(5.0, 9.0) + t * 0.12)) * (0.2 + 0.8 * undersida);
    glod *= 0.3 + 0.8 * I;
    c = vedC * (0.35 + 1.3 * ljus * (0.6 + 0.4 * undersida)) + eldFarg(glod * 0.85) * 1.1;
    c *= smoothstep(0.0, -0.006, dv) * 0.3 + 0.7;
  }

  // Lågorna
  float bas = 0.11 - 0.35 * p.x * p.x;
  float h = p.y - bas;
  if (h > -0.05) {
    float hojd = 0.08 + 0.5 * I;
    float x2 = p.x + (fbm(vec2(p.x * 2.2, h * 2.5 - t * 0.9)) - 0.5) * 0.22 * max(h, 0.0) * 3.0;
    float turb = fbm(vec2(x2 * 5.0, h * 3.4 - t * 2.4));
    float tunga = fbm(vec2(x2 * 9.0 + 3.0, h * 6.0 - t * 3.3));
    float bredd = smoothstep(0.42, 0.12, abs(x2)) * (0.75 + 0.25 * I);
    float v = (1.0 - h / hojd) * 1.1 + (turb - 0.5) * 1.1 + (tunga - 0.5) * 0.45;
    v *= bredd * smoothstep(-0.05, 0.02, h);
    v = clamp(v, 0.0, 1.0);
    vec3 eld = eldFarg(v);
    c = c * (1.0 - v * 0.6) + eld * v * 1.25;
  }

  // Gnistor
  for (int i = 0; i < ${GNISTOR}; i++) {
    vec4 g = u_gnista[i];
    // Hoppar över allt som inte är ett giltigt, positivt tal
    if (!(g.z > 0.0) || !(g.w > 0.0)) continue;
    vec2 dd = p - g.xy;
    float r = g.w;
    float v = exp(-dot(dd, dd) / (r * r)) * g.z;
    c += vec3(1.0, 0.55, 0.18) * v * 1.4;
  }

  // Ingen glans i hörnen
  vec2 uv = gl_FragCoord.xy / u_res;
  c *= 1.0 - 0.55 * pow(length(uv - vec2(0.5, 0.35)) * 1.2, 2.0);
  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, t), 1.0);
}`;

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, ['u_res', 'u_tid', 'u_eld', 'u_flimmer', 'u_gnista', 'u_synlig']);

    // Världen: x i bredder från mitten, y uppåt från glödbädden
    const tillVarld = (cx, cy) => [
      (cx - duk.clientWidth / 2) / duk.clientWidth,
      (duk.clientHeight * 0.76 - cy) / duk.clientWidth,
    ];

    // ---------- Elden ----------
    let eld = 0.2;
    let flakt = 0;
    const gnistor = Array.from({ length: GNISTOR }, () => ({ x: 0, y: 0, vx: 0, vy: 0, liv: 0, r: 0.004, fas: slump(0, 6.28) }));
    let nasta = 0;
    function gnista(x, y, kraft = 1) {
      const g = gnistor[nasta];
      nasta = (nasta + 1) % GNISTOR;
      g.x = x + slump(-0.02, 0.02);
      g.y = y;
      g.vx = slump(-0.05, 0.05) * kraft;
      g.vy = slump(0.12, 0.32) * kraft;
      g.liv = slump(0.7, 1);
      g.r = slump(0.0025, 0.0055);
      g.fas = slump(0, 10);
    }

    // ---------- Ljud ----------
    const l = rumsLjud(1.25, 1.5);
    const { ctx, ut } = l;
    const sus = brusKalla('rosa');
    const susF = ctx.createBiquadFilter();
    susF.type = 'lowpass'; susF.frequency.value = 400; susF.Q.value = 0.4;
    const susG = ctx.createGain(); susG.gain.value = 0;
    sus.connect(susF).connect(susG).connect(ut);
    const vas = brusKalla('rosa');
    const vasF = ctx.createBiquadFilter();
    vasF.type = 'highpass'; vasF.frequency.value = 3500;
    const vasG = ctx.createGain(); vasG.gain.value = 0;
    vas.connect(vasF).connect(vasG).connect(ut);
    l.kallor.push(sus, vas);
    // Elden: en inspelning av en livlig lägereld. Den följer hur mycket hon fläktar:
    // svag och dov som glöd, starkare och ljusare när lågorna tar fart.
    const eldBuss = ctx.createGain(); eldBuss.gain.value = 0.5;
    const eldLjus = ctx.createBiquadFilter(); eldLjus.type = 'lowpass'; eldLjus.frequency.value = 3000; eldLjus.Q.value = 0.6;
    eldBuss.connect(eldLjus).connect(ut);
    const eldMatta = skapaMatta(ctx, eldBuss, 'ljud/glod-eld.mp3', { niva: 0.035, bit: [6, 12], over: 2, hp: 100, tonhojd: 0.04 });
    const knappBank = skapaLjudbank(ctx, eldBuss, 'ljud/glod-eld.mp3', KNAPP, { maxTopp: 0.1, hp: 150 });
    l.kallor.push(eldMatta, knappBank);
    let inspelad = false;
    eldMatta.klar.then(() => { inspelad = true; }, () => {});

    function knaster(kraft = 1) {
      const t = ctx.currentTime;
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        brusstot(ctx, ut, {
          frekvens: slump(1500, 5500), q: slump(0.6, 1.5),
          styrka: slump(0.12, 0.35) * kraft, langd: slump(0.0008, 0.0025), nar: t + i * slump(0.008, 0.03),
        });
      }
    }
    function small() {
      const t = ctx.currentTime;
      brusstot(ctx, ut, { frekvens: slump(700, 1400), q: 0.8, styrka: 0.4, langd: 0.004, nar: t });
      brusstot(ctx, ut, { frekvens: slump(2500, 4000), q: 1, styrka: 0.2, langd: 0.002, nar: t + 0.01 });
    }

    // ---------- Fingret ----------
    let nere = false;
    let forra = null;
    fingrar(duk, {
      ner: (x, y) => { nere = true; forra = { x, y, t: performance.now() }; },
      drag: (x, y) => {
        const nu = performance.now();
        if (forra) {
          const dt = Math.max(8, nu - forra.t);
          const v = Math.hypot(x - forra.x, y - forra.y) / dt;
          flakt = Math.min(0.75, flakt + v * 0.02);
          // Snabbt svep uppåt: en pust som blåser upp gnistor
          if ((forra.y - y) / dt > 1.4) {
            for (let i = 0; i < 4; i++) gnista(slump(-0.25, 0.25), slump(0.08, 0.18), 1.4);
            flakt = Math.min(0.75, flakt + 0.06);
          }
        }
        forra = { x, y, t: nu };
      },
      upp: (x, y, id, { tryck }) => {
        nere = false;
        forra = null;
        if (tryck) {
          // Rör om i glöden
          const [wx, wy] = tillVarld(x, y);
          const gx = klamp(wx, -0.4, 0.4), gy = Math.max(0.04, Math.min(0.2, wy));
          for (let i = 0; i < 10; i++) gnista(gx, gy, 1.1);
          flakt = Math.min(0.75, flakt + 0.12);
          if (!knappBank.spela({ styrka: 1, tonhojd: 0.06 })) { small(); knaster(1.2); }
        }
      },
    });

    // ---------- Ritslinga ----------
    const data = new Float32Array(GNISTOR * 4);
    let knasterTid = 0;
    let smallTid = slump(6, 14);
    const stoppa = slinga((tid, dt) => {
      // Fläkten byggs upp av fingret och klingar av på några sekunder
      if (nere) flakt = Math.min(0.75, flakt + 0.22 * dt);
      flakt *= Math.exp(-dt / 5);
      const mal = GRUND + flakt;
      eld += (mal - eld) * (1 - Math.exp(-dt / (mal > eld ? 0.8 : 3.5)));
      const flimmer = 0.5 + 0.5 * Math.sin(tid * 7.3) * Math.sin(tid * 3.1 + 1.3) * Math.sin(tid * 11.7);

      // Gnistor stiger, vinglar och slocknar
      if (Math.random() < dt * (0.4 + eld * 4)) gnista(slump(-0.3, 0.3), slump(0.1, 0.2), 0.6 + eld);
      for (const g of gnistor) {
        if (g.liv <= 0) continue;
        g.vx += Math.sin(tid * 2.1 + g.fas) * 0.12 * dt;
        g.vy += 0.05 * dt;
        g.vx *= Math.exp(-dt * 0.8); g.vy *= Math.exp(-dt * 0.6);
        g.x += g.vx * dt; g.y += g.vy * dt;
        g.liv -= dt * 0.55;
      }
      gnistor.forEach((g, i) => {
        data[i * 4] = g.x; data[i * 4 + 1] = g.y;
        // En gnista som inte lyser skickar alltid 0, aldrig ett ogiltigt tal
        data[i * 4 + 2] = g.liv > 0 ? g.liv * (0.7 + 0.3 * Math.sin(tid * 20 + g.fas * 5)) : 0;
        data[i * 4 + 3] = g.r;
      });

      // Ljudet följer elden
      const t = ctx.currentTime;
      susG.gain.setTargetAtTime(0.025 + 0.09 * eld * eld, t, 0.3);
      susF.frequency.setTargetAtTime(300 + 700 * eld, t, 0.3);
      vasG.gain.setTargetAtTime(inspelad ? 0 : 0.004 + 0.012 * eld, t, 0.3);
      eldBuss.gain.setTargetAtTime(0.4 + 0.9 * eld, t, 0.3);
      eldLjus.frequency.setTargetAtTime(2200 + 9000 * eld, t, 0.3);
      knasterTid -= dt;
      if (!inspelad && knasterTid <= 0 && tid > 1.5) {
        knaster(0.6 + eld * 0.6);
        knasterTid = slump(0.08, 0.6) / (0.4 + eld * 1.6);
      }
      smallTid -= dt;
      if (smallTid <= 0) { if (!knappBank.spela({ styrka: 0.8, tonhojd: 0.06 })) small(); smallTid = slump(8, 20); }

      anpassa(gl, duk, 0.6);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_eld, eld);
      gl.uniform1f(u.u_flimmer, flimmer);
      gl.uniform4fv(u.u_gnista, data);
      gl.uniform1f(u.u_synlig, mjuk(0, 3, tid));
      ritaHelskarm(gl);
    });

    return stangning({ ljud: l, stoppa, gl });
  },
};
