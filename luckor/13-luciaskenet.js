// Lucka 13: Luciaskenet
// Ett vitt stearinljus i en mässingsstake på ett träbord, i ett mörkt rum. Lågan
// fladdrar och lyser upp väggen och bordet. För hon fingret nära lågan lutar den sig
// undan som för ett drag och svajar tillbaka. Håller hon fingret länge mitt på lågan
// kvävs den nästan helt, och växer sakta upp igen när hon släpper. Ljuset brinner
// sakta ner, och stearinet rinner i tydliga spår längs de ojämna sidorna. Långt bort
// spelar en speldosa Sankta Lucia, då och då.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { brusKalla, rum } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { mjuk, slump, klamp, rumsLjud, slinga, fingrar, stangning, brusstot } from '../lib/scen.js';

const DROPPAR = 8;

// Sankta Lucia (Teodoro Cottrau 1849), i A-dur en oktav ner: [halvtoner från A4, åttondelar]
const E = -5, Fis = -3, Gis = -1, A = 0, H = 2, Cis = 4, D = -7, Dis = -6, Ess = -6;
const LUCIA = [
  [E, 2], [E, 3], [A, 1], [A, 1], [Gis, 1], [Gis, 4], [D, 2], [D, 3], [Fis, 1], [Fis, 1], [E, 1], [E, 4],
  [Cis - 12, 2], [Fis, 2], [E, 2], [E, 1], [Ess, 1], [D, 4], [D, 2], [Cis - 12, 2], [H - 12, 2], [Fis, 2], [E, 4],
];
const OMKVAD = (slut) => [
  [Cis, 2], [H, 2], [A, 2], [Gis, 1], [Fis, 1], [H, 4], [H, 2], [A, 2], [Fis, 2], [Dis, 1], [E, 1], [A, 4],
  [Cis, 1], [A, 1], [A, 1], [E, 1], [E, 1], [Cis - 12, 1], [D, 1], [H, 1], [H, 4], ...slut,
];
const MELODI = [
  ...LUCIA,
  ...OMKVAD([[H, 2], [Fis, 3], [Gis, 1], [H, 2], [A, 4]]),
  ...OMKVAD([[H, 2], [Cis, 3], [H, 1], [H, 2], [A, 4]]),
];

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform float u_tid;
uniform float u_luta;       // lågans lutning
uniform float u_flamma;     // fladder, 0..1
uniform float u_ljus;       // hur starkt ljuset är just nu
uniform float u_kvav;       // 0 brinner fritt, 1 nästan slocknad
uniform vec4 u_dropp[${DROPPAR}];  // vinkel runt ljuset, var den började, längd, bredd
uniform float u_topp;       // hur högt ljuset är nu, det brinner sakta ner
uniform float u_synlig;
uniform vec2 u_ring;        // rökringen: tid sedan den släpptes, synlighet
${BRUS}

const float LJ_B = 0.07;     // halva ljusets bredd
const float BORD = 0.0;      // bordsskivan
#define TOPP u_topp

float laga(vec2 p, out float karna, out float bas) {
  // p relativt veken, y uppåt
  float H = 0.13 * (0.9 + 0.1 * sin(u_tid * 9.0) * u_flamma) * (1.0 - 0.15 * abs(u_luta)) * (1.0 - 0.82 * u_kvav);
  float yn = p.y / H;
  // Lutning och ett svagt svaj, mer högt upp
  float x = p.x - u_luta * 0.06 * pow(max(yn, 0.0), 1.4);
  x -= sin(u_tid * 6.0 + yn * 4.0) * 0.006 * u_flamma * max(yn, 0.0);
  float w = 0.024 * (1.0 - 0.45 * u_kvav) * pow(clamp(1.0 - yn, 0.0, 1.0), 0.65) * smoothstep(-0.3, 0.12, yn);
  float f = smoothstep(w, w * 0.25, abs(x)) * step(-0.3, yn) * step(yn, 1.0);
  karna = smoothstep(w * 0.55, 0.0, abs(x)) * smoothstep(0.75, 0.15, yn) * smoothstep(-0.05, 0.12, yn) * (1.0 - u_kvav);
  // En kvävd låga blir liten och mest blå
  bas = smoothstep(0.18 + 0.6 * u_kvav, -0.05, yn) * f;
  return f;
}

void main() {
  float s = u_res.x;
  vec2 p = (gl_FragCoord.xy - vec2(0.5 * u_res.x, 0.3 * u_res.y)) / s;
  float t = u_tid;
  vec2 veke = vec2(0.0, TOPP + 0.025);
  float L = u_ljus;

  // Väggen i mörkret, varm där ljuset når
  float dv = length((p - veke) * vec2(1.0, 0.8));
  vec3 c = vec3(0.018, 0.012, 0.012) + vec3(0.42, 0.24, 0.12) * exp(-dv * dv * 2.6) * L;
  c *= 0.9 + 0.1 * fbm(p * 3.0);

  // Bordet: mörkt trä, upplyst närmast ljuset, med en spegling av lågan
  if (p.y < BORD) {
    float ad = fbm(vec2(p.x * 2.0, p.y * 30.0)) * 0.7 + brus(vec2(p.x * 9.0, p.y * 80.0)) * 0.3;
    vec3 tra = mix(vec3(0.10, 0.05, 0.025), vec3(0.22, 0.12, 0.06), ad);
    float nara = exp(-p.x * p.x * 6.0) * exp(p.y * 4.0);
    c = tra * (0.15 + 1.3 * nara * L);
    vec2 sp = vec2(p.x, -p.y * 1.6) - veke * vec2(1.0, 0.25);
    c += vec3(1.0, 0.6, 0.25) * exp(-dot(sp, sp) * 220.0) * 0.12 * L;
  }

  // Staken: en mässingsfat med ljusa reflexer
  vec2 st = (p - vec2(0.0, 0.015)) / vec2(0.2, 0.035);
  if (length(st) < 1.0 && p.y > -0.03) {
    float z = sqrt(1.0 - dot(st, st));
    float naraLjus = exp(-st.x * st.x * 3.0);
    vec3 massing = mix(vec3(0.12, 0.07, 0.025), vec3(0.48, 0.33, 0.13), z * naraLjus);
    massing *= 0.7 + 0.3 * fbm(st * 6.0);
    // Glansen på kanten närmast betraktaren
    massing += vec3(1.0, 0.78, 0.45) * smoothstep(0.75, 0.97, length(st)) * step(st.y, 0.0) * naraLjus * 0.35 * L;
    c = massing * (0.3 + 0.7 * L);
  }

  // Ljuset: vitt stearin som lyser inifrån nära lågan. Sidorna är lite ojämna, och
  // stelnade rinnspår ligger som upphöjda strängar med en kula längst ner. Spåren följer
  // ljusets rundning och blir smalare ut mot kanterna. Rinner de över kanten buktar
  // siluetten ut.
  float ojamn = 1.0 + 0.04 * (brus(vec2(p.y * 34.0, 2.0)) - 0.5) * 2.0 + 0.03 * (brus(vec2(p.y * 7.0, 5.0)) - 0.5) * 2.0;
  float kantY = TOPP + 0.008 * (brus(vec2(p.x * 40.0, 7.0)) - 0.5) + 0.004 * sin(p.x * 60.0 + 1.0);
  float spar = 0.0, sparLjus = 0.0, buk = 0.0;
  for (int i = 0; i < ${DROPPAR}; i++) {
    vec4 d = u_dropp[i];
    if (d.z <= 0.0) continue;
    float xs = sin(d.x), cosv = cos(d.x);
    float start = min(d.y, TOPP), slut = d.y - d.z;
    if (slut > TOPP) continue;
    float ned = start - p.y;
    float vag = xs + 0.025 * sin(p.y * 70.0 + d.x * 9.0) * cosv;
    float b = d.w * cosv * (0.75 + 0.25 * smoothstep(0.0, 0.03, ned));
    float u = (p.x / LJ_B - vag) / max(b, 0.01);
    float langs = step(slut, p.y) * step(p.y, start + 0.004);
    float rygg = sqrt(max(0.0, 1.0 - u * u)) * langs;
    float kula = (p.y - slut) / (b * LJ_B * 1.4);
    vec2 kd = vec2((p.x / LJ_B - vag) / (b * 1.35), kula * 1.1);
    rygg = max(rygg, sqrt(max(0.0, 1.0 - dot(kd, kd))));
    if (rygg > spar) { spar = rygg; sparLjus = -u * 0.6 + 0.4; }
    // Spår ute vid kanten buktar ut siluetten
    buk = max(buk, rygg * smoothstep(0.75, 0.98, abs(xs)) * step(0.0, p.x * xs));
    // Där spåret började har stearinet runnit över kanten och gjort ett hack
    kantY -= 0.006 * exp(-pow((p.x / LJ_B - xs) / 0.15, 2.0)) * step(TOPP - 0.002, d.y) * cosv;
  }
  float bw = LJ_B * ojamn + LJ_B * 0.08 * buk;
  if (abs(p.x) < bw && p.y > 0.02 && p.y < kantY) {
    float cyl = sqrt(max(0.0, 1.0 - pow(p.x / bw, 2.0)));
    float glod = exp(-(TOPP - p.y) * 9.0);
    vec3 vax = vec3(0.86, 0.82, 0.74) * (0.2 + 0.55 * cyl) * L + vec3(1.0, 0.7, 0.4) * glod * 0.55 * L;
    vax *= 0.95 + 0.1 * fbm(p * vec2(60.0, 20.0));
    // Rinnspåren: ljusare och blankare, med en ljus sida och en skuggad
    vec3 sparFarg = vax * (1.05 + 0.3 * sparLjus) + vec3(1.0, 0.85, 0.6) * pow(max(sparLjus, 0.0), 3.0) * 0.12 * L;
    vax = mix(vax, sparFarg, smoothstep(0.0, 0.35, spar));
    vax *= 1.0 - 0.25 * smoothstep(0.35, 0.0, spar) * step(0.001, spar);
    c = vax;
  }
  // Ljusets topp: en grund smält grop som glänser, med en ojämn kant
  vec2 tp = (p - vec2(0.0, TOPP)) / vec2(LJ_B * ojamn, 0.014);
  if (length(tp) < 1.0 && p.y < kantY + 0.008) {
    c = vec3(0.95, 0.85, 0.65) * (0.6 + 0.4 * (1.0 - length(tp))) * L + vec3(1.0, 0.7, 0.35) * 0.25 * L;
  }
  // Veken
  if (abs(p.x) < 0.0025 && p.y > TOPP - 0.002 && p.y < veke.y) c = vec3(0.05, 0.03, 0.02);

  // Lågan och dess sken
  float karna, bas;
  float f = laga(p - veke, karna, bas);
  vec3 lagfarg = mix(vec3(1.0, 0.55, 0.15), vec3(1.0, 0.85, 0.55), karna);
  lagfarg = mix(lagfarg, vec3(0.35, 0.45, 1.0), bas * 0.7);
  c = mix(c, lagfarg * 1.25, f * (1.0 - bas * 0.5));
  c += vec3(1.0, 0.95, 0.85) * karna * 0.6;
  vec2 hd = (p - veke - vec2(-u_luta * 0.02, 0.05)) * vec2(1.0, 0.7);
  c += vec3(1.0, 0.6, 0.25) * exp(-dot(hd, hd) * 60.0) * 0.18 * L;
  // Veken glöder rött när lågan nästan slocknat
  vec2 vk = (p - veke + vec2(0.0, 0.006)) / vec2(0.004, 0.006);
  c += vec3(1.0, 0.3, 0.08) * exp(-dot(vk, vk)) * 0.6 * smoothstep(0.4, 0.9, u_kvav);
  // En tunn rökslinga stiger när den kvävs
  if (u_kvav > 0.05) {
    float hojd = p.y - veke.y - 0.01;
    float slinga = sin(hojd * 28.0 - t * 1.6) * 0.012 * hojd * 4.0 + (fbm(vec2(hojd * 6.0, t * 0.2)) - 0.5) * 0.03 * hojd * 3.0;
    float rok = exp(-pow((p.x - slinga) / (0.003 + hojd * 0.025), 2.0)) * smoothstep(0.0, 0.03, hojd) * exp(-hojd * 5.0);
    c += vec3(0.32, 0.3, 0.3) * rok * smoothstep(0.2, 0.8, u_kvav) * 0.5;
  }
  // Släpper hon en nästan kvävd låga stiger en rökring från veken. Den ses lite snett
  // från sidan, vidgas sakta medan den stiger, och löses upp.
  if (u_ring.y > 0.0) {
    float rt = u_ring.x;
    vec2 rc = veke + vec2(sin(rt * 0.7) * 0.006, 0.07 + 0.2 * (1.0 - exp(-rt * 0.4)));
    vec2 rr = vec2(0.011 + 0.007 * rt, (0.011 + 0.007 * rt) * 0.32);
    vec2 q = p - rc;
    float f = length(q / rr) - 1.0;
    vec2 g = q / (rr * rr) / max(length(q / rr), 1e-4);
    float avst = f / max(length(g), 1e-4);
    float tjock = 0.0035 + 0.002 * rt;
    float vinkel = atan(q.y / rr.y, q.x / rr.x);
    float rok = exp(-pow(avst / tjock, 2.0)) * (0.5 + 0.5 * fbm(vec2(vinkel * 1.6 + rt * 0.3, rt * 0.4)));
    // Bortre halvan av ringen skymtar svagare
    rok *= q.y > 0.0 ? 0.6 : 1.0;
    // En tunn stjälk av rök från veken upp till ringen i början
    float stjalk = exp(-pow((p.x - veke.x - sin((p.y - veke.y) * 60.0 - rt * 3.0) * 0.003) / 0.0018, 2.0))
                 * step(veke.y + 0.008, p.y) * step(p.y, rc.y - rr.y) * exp(-rt * 1.5);
    c += vec3(0.3, 0.29, 0.29) * (rok + stjalk * 0.5) * u_ring.y * 0.32;
  }

  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, t), 1.0);
}`;

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, ['u_res', 'u_tid', 'u_luta', 'u_flamma', 'u_ljus', 'u_kvav', 'u_dropp', 'u_synlig', 'u_ring', 'u_topp']);

    // Världen: x i bredder från mitten, y uppåt från bordet
    const varld = (cx, cy) => [(cx - duk.clientWidth / 2) / duk.clientWidth, (duk.clientHeight * 0.7 - cy) / duk.clientWidth];
    // Ljuset brinner sakta ner, ungefär en tiondel av sin höjd var tredje minut
    let topp = 0.42;
    const VEKE = [0, topp + 0.025];

    // ---------- Lågan ----------
    let luta = 0, lutaFart = 0, flamma = 0.2, malLuta = 0;
    // Håller hon fingret länge mitt på lågan kvävs den sakta, nästan helt. Släpper hon
    // växer den långsamt upp igen. Den slocknar aldrig helt.
    let kvav = 0;
    const finger = { x: 0, y: 0, nere: false, fart: 0, forra: null };
    fingrar(duk, {
      ner: (x, y) => { finger.nere = true; [finger.x, finger.y] = varld(x, y); finger.forra = { x, y, t: performance.now() }; },
      drag: (x, y) => {
        const nu = performance.now();
        if (finger.forra) {
          const v = Math.hypot(x - finger.forra.x, y - finger.forra.y) / Math.max(8, nu - finger.forra.t);
          finger.fart = Math.min(1.5, finger.fart + v * 0.5);
        }
        finger.forra = { x, y, t: nu };
        [finger.x, finger.y] = varld(x, y);
      },
      upp: () => {
        finger.nere = false;
        // Var lågan nästan kvävd stiger en rökring när hon släpper
        if (kvav > 0.6 && ring.t > 4) ring = { t: 0 };
      },
    }, { ett: true });
    let ring = { t: 99 };

    // Rinnspår längs ljuset: några stelnade från början, och nya som rinner medan det
    // brinner. Varje spår har en vinkel runt ljuset, en höjd där det började, en längd
    // och en bredd.
    const droppar = Array.from({ length: DROPPAR }, (_, i) => i < 4
      ? { v: slump(-1.3, 1.3), y: topp - slump(0, 0.02), langd: slump(0.05, 0.25), bredd: slump(0.09, 0.15), mal: 0, rinner: false }
      : { v: 0, y: 0, langd: 0, bredd: 0, mal: 0, rinner: false });
    const droppData = new Float32Array(DROPPAR * 4);
    let nastaDroppe = slump(8, 18), aldsta = 4;
    function nyDroppe() {
      const d = droppar[aldsta % DROPPAR];
      aldsta++;
      Object.assign(d, { v: slump(-1.35, 1.35), y: topp, langd: 0.002, bredd: slump(0.08, 0.15), mal: slump(0.06, Math.min(0.35, topp - 0.03)), rinner: true });
    }

    // ---------- Ljud ----------
    const l = rumsLjud(1.2, 1.6);
    const { ctx, ut } = l;
    const rumston = brusKalla('rosa');
    const rF = ctx.createBiquadFilter(); rF.type = 'lowpass'; rF.frequency.value = 180;
    const rG = ctx.createGain(); rG.gain.value = 0.03;
    rumston.connect(rF).connect(rG).connect(ut);
    const fladder = brusKalla('rosa');
    const fF = ctx.createBiquadFilter(); fF.type = 'bandpass'; fF.frequency.value = 280; fF.Q.value = 0.7;
    const fG = ctx.createGain(); fG.gain.value = 0;
    fladder.connect(fF).connect(fG).connect(ut);
    // Sankta Lucia, svagt och långt bort, som en speldosa i ett annat rum. Den spelar en
    // gång, och efter en lång stunds tystnad igen.
    const musik = ctx.createGain(); musik.gain.value = 1;
    const musikF = ctx.createBiquadFilter(); musikF.type = 'lowpass'; musikF.frequency.value = 2400;
    const musikEko = rum(3.5);
    const ekoG = ctx.createGain(); ekoG.gain.value = 0.55;
    musik.connect(musikF).connect(ut);
    musikF.connect(musikEko).connect(ekoG).connect(ut);
    function ton(f, t, styrka) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(styrka, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
      for (const [k, a] of [[1, 1], [2, 0.22], [3, 0.06], [4.2, 0.025]]) {
        const o = ctx.createOscillator();
        o.frequency.value = f * k;
        const og = ctx.createGain(); og.gain.value = a;
        o.connect(og).connect(g);
        o.start(t); o.stop(t + 2.3);
      }
      g.connect(musik);
    }
    const ATTONDEL = 0.3;
    let musikTimer = 0;
    function spelaLucia() {
      let t = ctx.currentTime + 0.3;
      for (const [halvton, langd] of MELODI) {
        ton(440 * Math.pow(2, halvton / 12), t, 0.014 * slump(0.85, 1));
        t += langd * ATTONDEL * slump(0.97, 1.03);
      }
      const sek = t - ctx.currentTime;
      musikTimer = setTimeout(spelaLucia, (sek + slump(40, 70)) * 1000);
    }
    musikTimer = setTimeout(spelaLucia, slump(4, 8) * 1000);
    l.kallor.push(rumston, fladder, { stop: () => clearTimeout(musikTimer) });

    // ---------- Ritslinga ----------
    let knappTid = slump(3, 9);
    const stoppa = slinga((tid, dt) => {
      // Draget: lågan lutar bort från ett finger i närheten, mer ju närmare det är
      malLuta = 0;
      if (finger.nere) {
        const dx = finger.x - VEKE[0], dy = finger.y - VEKE[1];
        const d = Math.hypot(dx, dy);
        const nara = mjuk(0.35, 0.05, d);
        malLuta = -Math.sign(dx || 0.0001) * nara * (0.6 + 0.4 * Math.min(1, Math.abs(dx) / 0.08));
        flamma = Math.min(1, flamma + nara * dt * 1.5);
      }
      flamma = Math.min(1, flamma + finger.fart * dt * 2);
      const paLagan = finger.nere && Math.hypot(finger.x - VEKE[0], (finger.y - VEKE[1] - 0.05) * 0.8) < 0.07;
      if (paLagan) kvav += (0.94 - kvav) * dt * 0.35 * (0.4 + kvav);
      else kvav += (0 - kvav) * dt * 0.25;
      // Mitt på lågan lutar den inte undan, den krymper
      if (paLagan) malLuta *= 1 - kvav;
      finger.fart *= Math.exp(-dt * 3);
      // Lutningen svajar som en fjäder mot sitt mål
      lutaFart += ((malLuta - luta) * 18 - lutaFart * 4.5) * dt;
      luta = klamp(luta + lutaFart * dt, -1.2, 1.2);
      flamma += (0.15 + 0.1 * Math.sin(tid * 0.4) - flamma) * Math.min(1, dt * 0.7);
      const flimmer = 0.92 + 0.05 * Math.sin(tid * 7.1) * Math.sin(tid * 3.3) + 0.06 * flamma * Math.sin(tid * 17.0);

      // Droppar: ibland börjar en ny rinna, långsamt
      // Ljuset brinner sakta ner, och ibland rinner stearin över kanten och nedför sidan
      topp = Math.max(0.14, topp - dt * 0.00025 * (1 - 0.8 * kvav));
      VEKE[1] = topp + 0.025;
      nastaDroppe -= dt * (1 - kvav);
      if (nastaDroppe <= 0) { nyDroppe(); nastaDroppe = slump(18, 40); }
      for (const d of droppar) {
        if (!d.rinner) continue;
        d.langd += dt * 0.012 * Math.max(0.08, 1 - d.langd / d.mal);
        if (d.langd > d.mal * 0.98) d.rinner = false;
      }
      droppar.forEach((d, i) => droppData.set([d.v, d.y, d.langd, d.bredd], i * 4));

      // Ljud: fladder i draget, och ett litet knäpp från veken ibland
      const t = ctx.currentTime;
      fG.gain.setTargetAtTime((0.06 * Math.max(0, flamma - 0.2) + 0.02 * Math.abs(lutaFart) * 0.1) * (1 - kvav), t, 0.06);
      knappTid -= dt;
      if (knappTid <= 0 && kvav < 0.3) {
        brusstot(ctx, ut, { frekvens: slump(2500, 6000), q: 1.5, styrka: slump(0.03, 0.08), langd: 0.0007, nar: t });
        knappTid = slump(4, 14);
      }

      anpassa(gl, duk, 0.75);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_luta, luta);
      gl.uniform1f(u.u_flamma, flamma);
      gl.uniform1f(u.u_ljus, flimmer * (1 - 0.15 * Math.abs(luta)) * (1 - 0.9 * kvav));
      gl.uniform1f(u.u_kvav, kvav);
      gl.uniform4fv(u.u_dropp, droppData);
      gl.uniform1f(u.u_topp, topp);
      gl.uniform1f(u.u_synlig, mjuk(0, 3, tid));
      ring.t += dt;
      gl.uniform2f(u.u_ring, ring.t, ring.t > 7 ? 0 : mjuk(0.1, 0.8, ring.t) * (1 - mjuk(2.5, 6.5, ring.t)));
      ritaHelskarm(gl);
    });

    return stangning({ ljud: l, stoppa, gl });
  },
};
