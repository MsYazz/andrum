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
import { LUCIA_SPAR, LUCIA_TEMPO } from './13-lucia-noter.js';

const DROPPAR = 8;

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
uniform vec4 u_torn[5];     // stearintorn: vinkel runt ljuset, bredd (vinkel), toppens höjd, hur mjuk toppen är
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

  // Stearintorn ("winding sheets"): runnet stearin som har stelnat till tunna, ojämna
  // fenor längs ljusets sidor. De står kvar när ljuset sjunker och sticker upp högre
  // än toppen och veken. Ute vid kanterna syns de från sidan som smala fenor, framtill
  // som breda, halvgenomskinliga skivor som lågan lyser igenom. Bakre torn skyms av lågan.
  for (int i = 0; i < 5; i++) {
    vec4 tn = u_torn[i];
    if (tn.z <= 0.0) continue;
    float bw = LJ_B * ojamn;
    float xa = sin(tn.x - tn.y * 0.5) * bw, xb = sin(tn.x + tn.y * 0.5) * bw;
    float x0 = min(xa, xb), x1 = max(xa, xb);
    // Från sidan blir fenan smal, men aldrig tunnare än ett par millimeter
    float mitt = (x0 + x1) * 0.5, halv = max((x1 - x0) * 0.5, 0.0035);
    float u = (p.x - mitt) / halv;
    if (abs(u) > 1.0 || p.y < TOPP - 0.01) continue;
    // Toppen är ojämn och spetsig, och rundas och sjunker ihop när den mjuknar
    float ojamnt = brus(vec2(u * 2.2 + tn.x * 13.0, 4.0)) - 0.5;
    float form = mix(1.0 - 0.45 * u * u + 0.35 * ojamnt - 0.25 * smoothstep(0.5, 1.0, abs(u)), 1.0 - 0.8 * u * u, tn.w);
    float hojd = (tn.z - TOPP) * form + 0.006;
    if (p.y > TOPP + hojd) continue;
    float fram = cos(tn.x);
    float genom = exp(-length((p - veke) * vec2(1.0, 0.6)) * 10.0);
    vec3 tf = vec3(0.86, 0.8, 0.7) * (0.3 + 0.45 * L) + vec3(1.0, 0.6, 0.26) * genom * 1.3 * L;
    tf *= 0.85 + 0.25 * brus(vec2(p.x * 120.0 + float(i) * 9.0, p.y * 35.0));
    // Kanten överst är tunnast och lyser mest, och en mjuk topp glöder lite extra
    tf += vec3(1.0, 0.7, 0.35) * smoothstep(0.006, 0.0, TOPP + hojd - p.y) * (0.2 + 0.3 * tn.w) * L;
    float tack = smoothstep(TOPP + hojd, TOPP + hojd - 0.0025, p.y) * smoothstep(1.0, 0.8, abs(u));
    // Framtill är fenan halvgenomskinlig, baktill skyms den av lågan
    tack *= fram > 0.0 ? mix(0.9, 0.6, fram) : 0.9 * (1.0 - f);
    c = mix(c, tf, tack);
  }
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
    const u = platser(gl, prog, ['u_res', 'u_tid', 'u_luta', 'u_flamma', 'u_ljus', 'u_kvav', 'u_dropp', 'u_synlig', 'u_ring', 'u_topp', 'u_torn']);

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
    function nyDroppe(v = slump(-1.35, 1.35), y = topp) {
      const d = droppar[aldsta % DROPPAR];
      aldsta++;
      Object.assign(d, { v, y, langd: 0.002, bredd: slump(0.08, 0.15), mal: slump(0.06, Math.min(0.35, topp - 0.03)), rinner: true, torn: Math.random() < 0.4 });
    }

    // Stearintornen: stelnat stearin som står kvar som fenor längs sidorna. Deras toppar
    // stannar där de är medan ljuset sjunker, så de sticker upp allt högre. Blir ett torn
    // för högt mjuknar toppen, sjunker ihop och skickar en ny droppe nedför utsidan. Där
    // en droppe har stelnat kan ett nytt torn börja växa.
    const tornen = [];
    const nyttTorn = (v, ovan) => tornen.push({ v, b: slump(0.3, 0.7), y: topp + ovan, max: slump(0.05, 0.085), mjuk: 0, smalter: 0 });
    nyttTorn(slump(0.95, 1.35), slump(0.035, 0.055));
    nyttTorn(-slump(0.95, 1.35), slump(0.03, 0.05));
    if (Math.random() < 0.6) nyttTorn(slump(-0.5, 0.5), slump(0.012, 0.022));
    const tornData = new Float32Array(20);
    function tornRor(dt) {
      for (const t of tornen) {
        const over = t.y - topp;
        if (!t.smalter && over > t.max) {
          // Toppen mjuknar och sjunker ihop, och smältan rinner ner längs utsidan
          t.smalter = over * slump(0.35, 0.6);
          nyDroppe(t.v + slump(-0.1, 0.1), t.y);
        }
        if (t.smalter) {
          const steg = Math.min(t.smalter, dt * 0.005);
          t.y -= steg; t.smalter -= steg;
          t.mjuk = Math.min(1, t.mjuk + dt * 0.8);
          if (t.smalter <= 1e-4) { t.smalter = 0; t.max = slump(0.05, 0.085); }
        } else t.mjuk = Math.max(0, t.mjuk - dt * 0.05);
      }
      tornen.forEach((t, i) => { if (i < 5) tornData.set([t.v, t.b, t.y, t.mjuk], i * 4); });
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
    // Sankta Lucia, svagt och långt bort, i ett arrangemang för oboe, fiol, altfiol och
    // gitarr (noterna från Wikimedia Commons, CC0), lite långsammare än originalet. Varje
    // stämma får en egen mjuk klang. Bara långa melodtoner får vibrato, och först efter en
    // stund. Stycket spelas en gång, och efter en lång stunds tystnad igen.
    const musik = ctx.createGain(); musik.gain.value = 1;
    const musikF = ctx.createBiquadFilter(); musikF.type = 'lowpass'; musikF.frequency.value = 3200;
    const musikEko = rum(3.5);
    const ekoG = ctx.createGain(); ekoG.gain.value = 0.55;
    musik.connect(musikF).connect(ut);
    musikF.connect(musikEko).connect(ekoG).connect(ut);
    const FART = 0.82;
    const ATTONDEL = 60 / (LUCIA_TEMPO * FART) / 8;   // sekunder per trettiotvåondel
    // Klangen för varje stämma: vågform, filter, ansats, avklingning och styrka
    const KLANG = {
      oboe: { vag: 'sawtooth', lp: 2600, topp: 1300, ansats: 0.05, slapp: 0.14, niva: 0.013, vib: true },
      fiol: { vag: 'sawtooth', lp: 2800, topp: 2400, ansats: 0.09, slapp: 0.2, niva: 0.009, vib: true },
      altfiol: { vag: 'sawtooth', lp: 1000, topp: 500, ansats: 0.16, slapp: 0.3, niva: 0.0035, vib: false },
      gitarr: { vag: 'triangle', lp: 2200, topp: 0, ansats: 0.004, slapp: 0, niva: 0.012, vib: false, knapp: 0.9 },
    };
    const stammor = LUCIA_SPAR.map(({ instrument, noter }) => {
      const k = KLANG[instrument];
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = k.lp; lp.Q.value = 0.7;
      let in_ = lp;
      if (k.topp) {
        const tp = ctx.createBiquadFilter(); tp.type = 'peaking'; tp.frequency.value = k.topp; tp.Q.value = 1.4; tp.gain.value = 4;
        tp.connect(lp); in_ = tp;
      }
      lp.connect(musik);
      const lista = noter.split(' ').map((n) => n.split('.').map((v) => parseInt(v, 36)));
      return { k, in_, lista };
    });
    function spelaTon(st, start, langd, not, t) {
      const { k, in_ } = st;
      const f = 440 * Math.pow(2, (not - 69) / 12);
      const o = ctx.createOscillator(); o.type = k.vag; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      if (k.knapp) {
        // Gitarren knäpps: snabb ansats och en avklingning som en sträng
        g.gain.linearRampToValueAtTime(k.niva, t + k.ansats);
        g.gain.setTargetAtTime(0, t + k.ansats, k.knapp * 0.35);
        o.start(t); o.stop(t + k.knapp * 3);
      } else {
        g.gain.linearRampToValueAtTime(k.niva, t + k.ansats);
        g.gain.setValueAtTime(k.niva, t + Math.max(k.ansats, langd - k.slapp * 0.5));
        g.gain.linearRampToValueAtTime(0, t + langd + k.slapp);
        o.start(t); o.stop(t + langd + k.slapp + 0.05);
        // Vibrato bara på långa melodtoner, och först efter en stund
        if (k.vib && langd > 0.75) {
          const v = ctx.createOscillator(); v.frequency.value = slump(5, 5.6);
          const vd = ctx.createGain(); vd.gain.value = 0;
          vd.gain.setValueAtTime(0, t + 0.45);
          vd.gain.linearRampToValueAtTime(12, t + Math.min(langd, 1.1));
          v.connect(vd).connect(o.detune);
          v.start(t); v.stop(t + langd + k.slapp + 0.05);
        }
      }
      o.connect(g).connect(in_);
    }
    // Tonerna läggs i ljudmotorns kö lite i taget, så att det aldrig blir för många på en gång
    let musikTimer = 0, kofTimer = 0;
    function spelaLucia() {
      const t0 = ctx.currentTime + 0.5;
      const handelser = [];
      stammor.forEach((st) => st.lista.forEach(([start, langd, not]) => handelser.push([start * ATTONDEL, langd * ATTONDEL, not, st])));
      handelser.sort((a, b) => a[0] - b[0]);
      const slut = Math.max(...handelser.map((h) => h[0] + h[1]));
      let i = 0;
      const fyll = () => {
        const fram = ctx.currentTime - t0 + 1.5;
        while (i < handelser.length && handelser[i][0] < fram) {
          const [start, langd, not, st] = handelser[i++];
          spelaTon(st, start, langd, not, t0 + start);
        }
        if (i < handelser.length) kofTimer = setTimeout(fyll, 400);
      };
      fyll();
      musikTimer = setTimeout(spelaLucia, (slut + 0.5 + slump(60, 110)) * 1000);
    }
    musikTimer = setTimeout(spelaLucia, slump(4, 8) * 1000);
    l.kallor.push(rumston, fladder, { stop: () => { clearTimeout(musikTimer); clearTimeout(kofTimer); } });

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
        if (d.langd > d.mal * 0.98) {
          d.rinner = false;
          // Där droppen har stelnat kan ett nytt torn börja växa, om det finns plats
          if (d.torn && tornen.length < 5 && tornen.every((t) => Math.abs(t.v - d.v) > 0.5)) nyttTorn(d.v, 0.004);
        }
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
      tornRor(dt);
      gl.uniform4fv(u.u_torn, tornData);
      gl.uniform1f(u.u_synlig, mjuk(0, 3, tid));
      ring.t += dt;
      gl.uniform2f(u.u_ring, ring.t, ring.t > 7 ? 0 : mjuk(0.1, 0.8, ring.t) * (1 - mjuk(2.5, 6.5, ring.t)));
      ritaHelskarm(gl);
    });

    return stangning({ ljud: l, stoppa, gl });
  },
};
