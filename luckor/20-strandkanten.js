// Lucka 20: Strandkanten
// En sandstrand sedd uppifrån, med havet högst upp. Hon skriver eller ritar i den våta
// sanden med fingret, som med en pinne. Med ojämna mellanrum sköljer en våg upp, olika långt varje gång,
// och där vattnet når slätas fårorna sakta ut. Det är meningen att det ska försvinna.
// Sanden är ett höjdfält. Vågens framkant följer samma formel i JavaScript och shadern.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { brusKalla } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { mjuk, slump, rumsLjud, slinga, fingrar, stangning } from '../lib/scen.js';

const SW = 192, SH = 420;
const BAS = 0.5;

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform sampler2D u_sand;   // r: höjd, g: väta
uniform vec2 u_rut;
uniform vec3 u_vag;         // framkantens läge (0 uppe, 1 nere), frö, hur mycket vatten som är kvar
uniform float u_tid;
uniform float u_synlig;
${BRUS}

float framkant(float x, float vag, float fro) {
  return vag + 0.018 * sin(x * 7.0 + fro) + 0.012 * sin(x * 15.0 + fro * 1.7) + 0.007 * sin(x * 31.0 + fro * 2.3);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 tc = vec2(uv.x, 1.0 - uv.y);
  float asp = u_res.y / u_res.x;
  vec2 p = vec2(uv.x, uv.y * asp);

  vec4 t = texture(u_sand, tc);
  vec2 e = 1.0 / u_rut;
  float hx = texture(u_sand, tc + vec2(e.x, 0.0)).r - texture(u_sand, tc - vec2(e.x, 0.0)).r;
  float hy = texture(u_sand, tc + vec2(0.0, e.y)).r - texture(u_sand, tc - vec2(0.0, e.y)).r;
  vec3 n = normalize(vec3(-hx * 7.0, hy * 7.0, 1.0));
  vec3 L = normalize(vec3(-0.5, 0.55, 0.65));
  float lj = max(dot(n, L), 0.0);
  // Botten av en fåra ligger i skugga, toppen av vallarna fångar ljuset
  float grop = clamp((${BAS.toFixed(2)} - t.r) * 9.0, 0.0, 0.5);
  float topp = clamp((t.r - ${BAS.toFixed(2)}) * 10.0, 0.0, 0.3);

  // Sanden: ljus och torr längst ner, mörk och blank där den är våt
  float korn = hash(floor(gl_FragCoord.xy));
  vec3 torr = vec3(0.88, 0.80, 0.64) * (0.94 + 0.1 * korn) * (0.95 + 0.08 * fbm(p * 5.0));
  vec3 vat = vec3(0.56, 0.48, 0.37) * (0.95 + 0.08 * korn);
  // Vätan suddas ut och får en oregelbunden kant, så att den inte syns som rutor
  vec2 skaka = (vec2(fbm(p * 9.0), fbm(p * 9.0 + 7.3)) - 0.5) * e * 6.0;
  float vata = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 o = vec2(float(i & 1) - 0.5, float(i >> 1) - 0.5) * e * 3.0;
    vata += texture(u_sand, tc + skaka + o).g * 0.25;
  }
  vata = smoothstep(0.05, 0.95, vata);
  vec3 sand = mix(torr, vat, vata) * (0.55 + 0.6 * lj) * (1.0 - grop) * (1.0 + topp * 0.4);
  // Våt sand speglar himlen
  float glans = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 30.0);
  sand += vec3(0.75, 0.8, 0.85) * glans * vata * 0.25;
  sand += vec3(0.35, 0.45, 0.55) * vata * 0.06;
  // Några snäckor och småstenar
  vec2 sc = floor(p * 11.0);
  vec2 so = (fract(p * 11.0) - 0.5 - (hash2(sc) - 0.5) * 0.6) * vec2(1.0, 1.4 + hash(sc + 9.0));
  if (hash(sc + 3.0) > 0.93) {
    float sk = smoothstep(0.075, 0.055, length(so));
    vec3 snacka = mix(vec3(0.86, 0.8, 0.74), vec3(0.55, 0.47, 0.42), hash(sc + 5.0));
    sand = mix(sand, snacka * (0.6 + 0.5 * dot(normalize(vec3(-so, 0.06)), L)), sk);
  }
  vec3 c = sand;

  // Vattnet som sköljer upp, med skum i framkanten
  float y = tc.y;
  // Kanten får en liten oregelbundenhet till som bara syns, utan att påverka sanden
  float fram = framkant(uv.x, u_vag.x, u_vag.y) + (fbm(vec2(uv.x * 14.0, u_vag.y)) - 0.5) * 0.012;
  float under = fram - y;
  if (under > 0.0 && u_vag.z > 0.0) {
    // Svallet är grunt och genomskinligt längst fram och djupnar uppåt mot havet
    float djup = smoothstep(0.0, 0.45, under);
    vec2 rorelse = vec2(0.0, u_tid * 0.05);
    float krus = fbm(vec2(p.x * 7.0, p.y * 12.0) + rorelse);
    vec3 grunt = vec3(0.45, 0.62, 0.6);
    vec3 djupt = vec3(0.07, 0.3, 0.4);
    vec3 hav = mix(grunt, djupt, djup) + vec3(0.06, 0.08, 0.08) * (krus - 0.5);
    float tackning = (0.25 + 0.65 * djup) * u_vag.z;
    // Sanden under vattnet syns mörkare och lite förskjuten av ytan
    c = mix(c * vec3(0.82, 0.88, 0.9), hav, tackning);
    // Himlens reflex i krusningarna
    c += vec3(0.8, 0.85, 0.9) * smoothstep(0.62, 0.8, krus) * 0.08 * u_vag.z;
    // Skummet: en vit spets i framkanten som spricker upp i spets bakåt
    float spets = smoothstep(0.012, 0.0, under) * (0.75 + 0.25 * brus(vec2(uv.x * 80.0, u_tid)));
    float lager = smoothstep(0.08, 0.0, under);
    vec2 sp = vec2(uv.x * 26.0, y * 46.0) + vec2(0.0, u_tid * 0.15);
    float nat = abs(fbm(sp) - 0.5) * 2.0;
    float spetsar = smoothstep(0.12, 0.0, nat) * lager;
    float skum = clamp(spets + spetsar * 0.7, 0.0, 1.0);
    c = mix(c, vec3(0.94, 0.96, 0.95), skum * 0.85 * u_vag.z);
  }
  // Det öppna havet högst upp, med bränningar
  float havKant = 0.12 + 0.01 * sin(uv.x * 7.0 + u_tid * 0.3);
  if (y < havKant) {
    vec3 hav = vec3(0.06, 0.28, 0.38) + vec3(0.06, 0.08, 0.08) * fbm(vec2(p.x * 6.0, p.y * 10.0 + u_tid * 0.5));
    float vagband = smoothstep(0.6, 0.9, sin(y * 90.0 - u_tid * 1.5 + fbm(p * 4.0) * 3.0));
    hav = mix(hav, vec3(0.85, 0.9, 0.9), vagband * 0.35);
    c = hav;
  }

  c *= 1.0 - 0.25 * pow(length(uv - 0.5) * 1.3, 2.5);
  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, u_tid), 1.0);
}`;

const framkant = (x, vag, fro) => vag + 0.018 * Math.sin(x * 7 + fro) + 0.012 * Math.sin(x * 15 + fro * 1.7) + 0.007 * Math.sin(x * 31 + fro * 2.3);

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, ['u_res', 'u_sand', 'u_rut', 'u_vag', 'u_tid', 'u_synlig']);

    // ---------- Sanden ----------
    const N = SW * SH;
    const h = new Float32Array(N).fill(BAS), vata = new Float32Array(N);
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      // Lite mjuka vågmönster i sanden efter tidigare vågor
      h[y * SW + x] = BAS + 0.005 * Math.sin(y * 0.21 + 2 * Math.sin(x * 0.031) + 0.7 * Math.sin(x * 0.09 + y * 0.02));
      vata[y * SW + x] = y < SH * 0.55 ? 1 - y / (SH * 0.55) * 0.4 : Math.max(0, 0.6 - (y - SH * 0.55) / (SH * 0.2));
    }

    // Vi minns hur långt ner hon har skrivit, så att en våg förr eller senare når ända dit.
    let lagst = 0, skrevs = 0, klocka = 0;
    // Pinnen ritar en smal, skarp fåra med V-form. Sanden den tränger undan läggs som
    // små vallar längs kanterna, och djupet skiftar lite som när en kvist darrar i handen.
    let pinnTid = 0;
    function grav(cx, cy) {
      if (cy / SH > lagst) { lagst = cy / SH; skrevs = klocka; }
      pinnTid += 0.13;
      const R = 1.5;
      const djup = 0.075 * (0.85 + 0.15 * Math.sin(pinnTid * 1.7) * Math.sin(pinnTid * 0.6 + 1));
      const VALL = 1.8;
      for (let y = Math.max(1, Math.floor(cy - R - VALL)); y <= Math.min(SH - 2, Math.ceil(cy + R + VALL)); y++) {
        for (let x = Math.max(1, Math.floor(cx - R - VALL)); x <= Math.min(SW - 2, Math.ceil(cx + R + VALL)); x++) {
          const d = Math.hypot(x - cx, y - cy);
          const i = y * SW + x;
          if (d < R) {
            const mal = BAS - djup * (1 - d / R);
            if (h[i] > mal) h[i] += (mal - h[i]) * 0.6;
          } else if (d < R + VALL) {
            const mal = BAS + 0.03 * (1 - (d - R) / VALL);
            if (h[i] < mal) h[i] += (mal - h[i]) * 0.25;
          }
        }
      }
      // Ibland lossnar ett litet sandkorn och hamnar bredvid fåran
      if (Math.random() < 0.12) {
        const a = Math.random() * Math.PI * 2, r = R + VALL + Math.random() * 1.5;
        const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
        if (x > 0 && x < SW - 1 && y > 0 && y < SH - 1) h[y * SW + x] += 0.035;
      }
    }

    // ---------- Vågorna ----------
    // En våg: sköljer upp, stannar ett ögonblick och drar sig tillbaka
    let vag = { start: -10, nar: 0.45, langd: 7, fro: 0 };
    let nastaVag = 2;
    let vagLage = 0;
    let vatten = 0;
    function vaglage(tid) {
      const t = (tid - vag.start) / vag.langd;
      if (t < 0 || t > 1) return { y: 0.1, kvar: 0 };
      const upp = t < 0.4 ? 1 - Math.pow(1 - t / 0.4, 2) : 1 - Math.pow((t - 0.4) / 0.6, 1.4);
      return { y: 0.12 + (vag.nar - 0.12) * upp, kvar: t < 0.9 ? 1 : 1 - (t - 0.9) / 0.1 };
    }

    // ---------- Ljud ----------
    const l = rumsLjud(1.6, 1.5);
    const { ctx, ut } = l;
    const branning = brusKalla('rosa');
    const brF = ctx.createBiquadFilter(); brF.type = 'lowpass'; brF.frequency.value = 300;
    const brG = ctx.createGain(); brG.gain.value = 0.05;
    const brLfo = ctx.createOscillator(); brLfo.frequency.value = 0.08;
    const brDjup = ctx.createGain(); brDjup.gain.value = 0.015;
    brLfo.connect(brDjup).connect(brG.gain);
    branning.connect(brF).connect(brG).connect(ut);
    brLfo.start();
    const svall = brusKalla('rosa');
    const svF = ctx.createBiquadFilter(); svF.type = 'bandpass'; svF.frequency.value = 700; svF.Q.value = 0.5;
    const svG = ctx.createGain(); svG.gain.value = 0;
    svall.connect(svF).connect(svG).connect(ut);
    const fras = brusKalla('korn');
    const frF = ctx.createBiquadFilter(); frF.type = 'highpass'; frF.frequency.value = 3000;
    const frG = ctx.createGain(); frG.gain.value = 0;
    fras.connect(frF).connect(frG).connect(ut);
    const skrap = brusKalla('korn');
    const skF = ctx.createBiquadFilter(); skF.type = 'bandpass'; skF.frequency.value = 2300; skF.Q.value = 1.1;
    const skG = ctx.createGain(); skG.gain.value = 0;
    skrap.connect(skF).connect(skG).connect(ut);
    l.kallor.push(branning, brLfo, svall, fras, skrap);

    // ---------- Fingret ----------
    let forra = null;
    let skrapFart = 0;
    const tillRut = (x, y) => [(x / duk.clientWidth) * SW, (y / duk.clientHeight) * SH];
    fingrar(duk, {
      ner: (x, y) => { const [gx, gy] = tillRut(x, y); forra = [gx, gy]; grav(gx, gy); },
      drag: (x, y) => {
        const [gx, gy] = tillRut(x, y);
        if (forra) {
          const d = Math.hypot(gx - forra[0], gy - forra[1]);
          const n = Math.ceil(d / 0.6);
          for (let s = 1; s <= n; s++) grav(forra[0] + (gx - forra[0]) * s / n, forra[1] + (gy - forra[1]) * s / n);
          skrapFart = Math.min(1, skrapFart + d * 0.04);
        }
        forra = [gx, gy];
      },
      upp: () => { forra = null; },
    });

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const data = new Float32Array(N * 2);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, SW, SH, 0, gl.RG, gl.FLOAT, data);
    gl.uniform1i(u.u_sand, 0);
    gl.uniform2f(u.u_rut, SW, SH);

    // ---------- Ritslinga ----------
    const stoppa = slinga((tid, dt) => {
      klocka += dt;
      nastaVag -= dt;
      if (nastaVag <= 0) {
        let nar = slump(0.3, 0.72);
        // Det hon skrivit får ligga kvar en stund innan en våg söker sig ända dit
        if (lagst > nar && klocka - skrevs > 25 && Math.random() < 0.6) nar = Math.min(0.9, lagst + 0.05);
        if (nar >= lagst) lagst = 0;
        vag = { start: tid, nar, langd: slump(6, 9) * (0.8 + nar * 0.4), fro: slump(0, 50) };
        nastaVag = vag.langd + slump(2, 8);
      }
      const forraLage = vagLage;
      const lage = vaglage(tid);
      vagLage = lage.y;
      vatten = lage.kvar;

      // Där vattnet står slätas sanden ut och blir våt. Vid tillbakadragningen slätar det mest.
      const drar = vagLage < forraLage;
      for (let x = 0; x < SW; x++) {
        const fram = framkant(x / SW, vagLage, vag.fro) * SH;
        const tot = Math.min(SH, Math.floor(fram));
        for (let y = 0; y < tot; y++) {
          const i = y * SW + x;
          const k = Math.min(1, dt * (drar ? 1.6 : 0.8) * vatten);
          h[i] += (BAS - h[i]) * k;
          vata[i] = Math.min(1, vata[i] + dt * 3 * vatten);
        }
      }
      // Sanden torkar sakta
      for (let i = 0; i < N; i++) if (vata[i] > 0) vata[i] = Math.max(0, vata[i] - dt * 0.012);

      // Vågens ljud: brus när den sköljer upp, fräs när den drar sig tillbaka
      const t = ctx.currentTime;
      const fart = Math.abs(vagLage - forraLage) / Math.max(dt, 1e-3);
      svG.gain.setTargetAtTime(drar ? 0.02 * vatten : 0.09 * Math.min(1, fart * 6) * vatten, t, 0.15);
      svF.frequency.setTargetAtTime(500 + 900 * Math.min(1, fart * 5), t, 0.2);
      frG.gain.setTargetAtTime(drar ? 0.03 * Math.min(1, fart * 8) * vatten : 0.004, t, 0.2);
      skrapFart *= Math.exp(-dt * 5);
      skG.gain.setTargetAtTime(0.04 * skrapFart, t, 0.04);

      for (let i = 0; i < N; i++) { data[i * 2] = h[i]; data[i * 2 + 1] = vata[i]; }
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, SW, SH, gl.RG, gl.FLOAT, data);
      anpassa(gl, duk, 0.75);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform3f(u.u_vag, vagLage, vag.fro, vatten);
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_synlig, mjuk(0, 2.5, tid));
      ritaHelskarm(gl);
    });

    return stangning({ ljud: l, stoppa, gl });
  },
};
