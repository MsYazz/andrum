// Lucka 1: Andetaget
// En glödande dimma som vidgas och drar ihop sig i tio lugna andetag.
// Fingret får dimman att virvla och värmas. Varje andetag tänder en liten prick.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, slappGL, utanGL } from '../lib/gl.js';
import { ljud, brusKalla, rum, klocka, sov } from '../lib/ljud.js';

// Resonansandning: 6 andetag per minut, 4 sekunder in och 6 sekunder ut.
// Den längre utandningen lugnar nervsystemet. Inga pauser där andan hålls,
// eftersom det kan kännas pressande för den som redan är utmattad.
const IN = 4;
const UT = 6;
const CYKEL = IN + UT;
const ANTAL = 10;
const INTRO = 5;

// Pentatonisk skala uppåt, en ton per andetag.
const TONER = [220, 246.94, 277.18, 329.63, 369.99, 440, 493.88, 554.37, 659.25, 739.99];

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform float u_tid;
uniform float u_and;
uniform float u_klar;
uniform vec3 u_finger;
uniform float u_antal;
uniform float u_synlig;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float brus(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * brus(p); p = m * p; a *= 0.5; }
  return v;
}

void main() {
  float s = min(u_res.x, u_res.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / s;
  p.y -= 0.05;

  // Fingret vrider dimman runt sig
  vec2 f = (u_finger.xy - 0.5 * u_res) / s;
  f.y -= 0.05;
  vec2 d = p - f;
  float infl = u_finger.z * exp(-dot(d, d) * 14.0);
  float vinkel = infl * 1.6;
  mat2 rot = mat2(cos(vinkel), -sin(vinkel), sin(vinkel), cos(vinkel));
  vec2 q = f + rot * d;

  float t = u_tid * 0.045;
  float r = mix(0.16, 0.33, u_and) * mix(1.0, 0.42, u_klar);
  vec2 w = vec2(fbm(q * 2.1 + vec2(t, -t * 0.7)), fbm(q * 2.1 + vec2(-t * 0.8, t) + 5.2));
  float n = fbm(q * 2.6 + w * 2.4 + t * 0.6);
  // Kanten slingrar sig: avståndet förvrängs av bruset
  float avst = length(q + (w - 0.5) * r * 0.9) / r;
  float kropp = exp(-avst * avst * 1.3);
  float dimma = smoothstep(0.06, 1.1, kropp * (0.3 + 1.35 * n));

  vec3 natt1 = vec3(0.030, 0.026, 0.060);
  vec3 natt2 = vec3(0.085, 0.058, 0.120);
  vec3 bg = mix(natt2, natt1, smoothstep(0.0, 0.95, length(p)));

  vec3 karn = vec3(1.0, 0.74, 0.52);
  vec3 kant = vec3(0.58, 0.48, 0.88);
  vec3 farg = mix(kant, karn, exp(-avst * avst * 2.4));
  float styrka = (0.55 + 0.45 * u_and) * mix(1.0, 0.8, u_klar);

  vec3 c = farg * dimma * styrka;
  c += karn * infl * 0.07;

  // Tio prickar, en per andetag
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    vec2 c0 = vec2((fi - 4.5) * 0.052, -0.44 - pow(fi - 4.5, 2.0) * 0.0016);
    vec2 dd = p - c0;
    float l2 = dot(dd, dd);
    float tand = clamp(u_antal - fi, 0.0, 1.0);
    float glod = exp(-l2 * 7000.0) * (0.10 + 0.70 * tand) + exp(-l2 * 500.0) * 0.08 * tand;
    c += mix(vec3(0.45, 0.40, 0.65), karn, tand) * glod;
  }

  c = bg + c * u_synlig;
  // Lite brus mot bandning i mörka toner
  c += (hash(gl_FragCoord.xy + fract(u_tid) * 91.0) - 0.5) * (2.0 / 255.0);
  frag = vec4(c, 1.0);
}`;

// Mjuk kurva som vänder utan ryck i båda ändarna.
function andning(c) {
  if (c < IN) return 0.5 - 0.5 * Math.cos((Math.PI * c) / IN);
  return 0.5 + 0.5 * Math.cos((Math.PI * (c - IN)) / UT);
}

const mjuk = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, [
      'u_res', 'u_tid', 'u_and', 'u_klar', 'u_finger', 'u_antal', 'u_synlig',
    ]);

    // ---------- Ljud ----------
    const { ctx, master } = ljud();
    const ut = ctx.createGain();
    ut.gain.value = 1.3;
    ut.connect(master);
    const eko = rum(4.5);
    const ekoUt = ctx.createGain();
    ekoUt.gain.value = 0.45;
    eko.connect(ekoUt).connect(ut);
    const kallor = [];

    // Varm bordunton som andas med
    const bordun = ctx.createGain();
    bordun.gain.value = 0;
    const bordunFilter = ctx.createBiquadFilter();
    bordunFilter.type = 'lowpass';
    bordunFilter.frequency.value = 500;
    bordunFilter.Q.value = 0.4;
    bordunFilter.connect(bordun);
    bordun.connect(ut);
    bordun.connect(eko);
    [[110, 0.5], [164.81, 0.32], [220.3, 0.2], [329.9, 0.07]].forEach(([f, g], i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = g;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.023;
      const lg = ctx.createGain();
      lg.gain.value = g * 0.35;
      lfo.connect(lg).connect(og.gain);
      o.connect(og).connect(bordunFilter);
      o.start();
      lfo.start();
      kallor.push(o, lfo);
    });
    bordun.gain.setTargetAtTime(0.1, ctx.currentTime, 2.0);

    // Andetagets sus, som en våg som rullar in och ut
    const sus = brusKalla('rosa');
    const susFilter = ctx.createBiquadFilter();
    susFilter.type = 'lowpass';
    susFilter.frequency.value = 220;
    susFilter.Q.value = 0.6;
    const susGain = ctx.createGain();
    susGain.gain.value = 0;
    sus.connect(susFilter).connect(susGain).connect(ut);
    kallor.push(sus);

    // ---------- Ledtext under de två första andetagen ----------
    const led = document.createElement('div');
    led.className = 'lucka-ui ledtext';
    scen.append(led);
    let ledfas = '';
    function ledtext(nr, c) {
      // Texten tonar ut strax innan andningen vänder, så att den aldrig byts medan den syns.
      let fas = '';
      if (nr < 2) {
        if (c < IN - 0.8) fas = 'andas in';
        else if (c >= IN && c < IN + UT - 1) fas = 'andas ut';
      }
      if (fas === ledfas) return;
      ledfas = fas;
      if (fas) {
        led.textContent = fas;
        led.classList.add('syns');
      } else {
        led.classList.remove('syns');
      }
    }

    // ---------- Fingret ----------
    let fx = 0, fy = 0, fMal = 0, fStyrka = 0, nere = false;
    const flytta = (e) => { fx = e.clientX; fy = e.clientY; };
    duk.addEventListener('pointerdown', (e) => {
      nere = true; fMal = 1; flytta(e);
      try { duk.setPointerCapture(e.pointerId); } catch {}
    });
    duk.addEventListener('pointermove', (e) => { if (nere) flytta(e); });
    const slapp = () => { nere = false; fMal = 0; };
    duk.addEventListener('pointerup', slapp);
    duk.addEventListener('pointercancel', slapp);

    // ---------- Avslut ----------
    let avslutat = false;
    function avsluta() {
      const t = ctx.currentTime;
      susGain.gain.setTargetAtTime(0, t, 1.5);
      bordun.gain.setTargetAtTime(0.045, t + 2, 8);
      // Ett varmt ackord som långsamt tonar fram
      [220, 277.18, 329.63, 440].forEach((f, i) => {
        klocka(f, { till: ut, eko, styrka: 0.028, ansats: 1.6, langd: 12, nar: t + 1 + i * 0.5 });
      });
    }

    // ---------- Ritslinga ----------
    const t0 = performance.now();
    let raf = 0;
    let stoppad = false;
    let senastKlang = -1;

    function rita(nu) {
      if (stoppad) return;
      const tid = (nu - t0) / 1000;
      const dpr = anpassa(gl, duk, 0.5);
      const bt = tid - INTRO;
      let and = 0, antal = 0, klar = 0;

      if (bt >= 0) {
        const nr = Math.floor(bt / CYKEL);
        // En ton för varje fullbordat andetag
        const klara = Math.min(ANTAL, nr);
        while (senastKlang < klara - 1) {
          senastKlang++;
          klocka(TONER[senastKlang], { till: ut, eko, styrka: 0.04 });
        }
        if (nr < ANTAL) {
          const c = bt - nr * CYKEL;
          and = andning(c);
          antal = nr + c / CYKEL;
          ledtext(nr, c);
        } else {
          antal = ANTAL;
          const efter = bt - ANTAL * CYKEL;
          klar = mjuk(0, 10, efter);
          and = 0.07 * (0.5 - 0.5 * Math.cos(efter * 0.45));
          ledtext(ANTAL, 0);
          if (!avslutat) { avslutat = true; avsluta(); }
        }
      }

      fStyrka += (fMal - fStyrka) * 0.035;

      const t = ctx.currentTime;
      if (!avslutat) {
        susFilter.frequency.setTargetAtTime(220 + 1300 * and * and, t, 0.1);
        susGain.gain.setTargetAtTime(bt < 0 ? 0 : 0.03 + 0.16 * and, t, 0.12);
      }
      bordunFilter.frequency.setTargetAtTime(420 + 480 * and + 350 * fStyrka, t, 0.2);

      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_and, and);
      gl.uniform1f(u.u_klar, klar);
      gl.uniform3f(u.u_finger, fx * dpr, (duk.clientHeight - fy) * dpr, fStyrka);
      gl.uniform1f(u.u_antal, antal);
      gl.uniform1f(u.u_synlig, mjuk(0, INTRO, tid));
      ritaHelskarm(gl);
      raf = requestAnimationFrame(rita);
    }
    raf = requestAnimationFrame(rita);

    return async () => {
      ut.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      await sov(1300);
      stoppad = true;
      cancelAnimationFrame(raf);
      kallor.forEach((k) => { try { k.stop(); } catch {} });
      ut.disconnect();
      slappGL(gl);
    };
  },
};
