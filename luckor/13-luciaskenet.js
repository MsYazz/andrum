// Lucka 13: Luciaskenet
// Ett vitt stearinljus i en mässingsstake på ett träbord, i ett mörkt rum. Lågan
// fladdrar och lyser upp väggen och bordet. För hon fingret nära lågan lutar den sig
// undan som för ett drag och svajar tillbaka. Håller hon fingret länge mitt på lågan
// kvävs den nästan helt, och växer sakta upp igen när hon släpper. Stearinet rinner långsamt i droppar.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { brusKalla } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { mjuk, slump, klamp, rumsLjud, slinga, fingrar, stangning, brusstot } from '../lib/scen.js';

const DROPPAR = 4;

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform float u_tid;
uniform float u_luta;       // lågans lutning
uniform float u_flamma;     // fladder, 0..1
uniform float u_ljus;       // hur starkt ljuset är just nu
uniform float u_kvav;       // 0 brinner fritt, 1 nästan slocknad
uniform vec4 u_dropp[${DROPPAR}];  // x på ljuset (-1..1), längd, bredd, -
uniform float u_synlig;
${BRUS}

const float LJ_B = 0.07;     // halva ljusets bredd
const float BORD = 0.0;      // bordsskivan
const float TOPP = 0.42;     // ljusets topp

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

  // Ljuset: vitt stearin som lyser inifrån nära lågan
  if (abs(p.x) < LJ_B && p.y > 0.02 && p.y < TOPP) {
    float cyl = sqrt(1.0 - pow(p.x / LJ_B, 2.0));
    float glod = exp(-(TOPP - p.y) * 9.0);
    vec3 vax = vec3(0.86, 0.82, 0.74) * (0.2 + 0.55 * cyl) * L + vec3(1.0, 0.7, 0.4) * glod * 0.55 * L;
    // Stelnade droppar som runnit längs sidan
    for (int i = 0; i < ${DROPPAR}; i++) {
      vec4 d = u_dropp[i];
      float dx = (p.x / LJ_B - d.x);
      float ned = TOPP - p.y;
      float bredd = d.z * (1.0 - smoothstep(d.y * 0.6, d.y, ned) * 0.6);
      float inne = smoothstep(bredd, bredd * 0.4, abs(dx)) * step(ned, d.y) * smoothstep(d.y + 0.004, d.y - 0.01, ned);
      float rund = smoothstep(0.012, 0.0, abs(ned - d.y + 0.006)) * smoothstep(bredd * 1.6, 0.0, abs(dx));
      vax = mix(vax, vax * 1.18 + vec3(0.05, 0.04, 0.02) * L, max(inne, rund) * 0.8);
    }
    c = vax;
  }
  // Ljusets topp: en grund smält grop som glänser
  vec2 tp = (p - vec2(0.0, TOPP)) / vec2(LJ_B, 0.014);
  if (length(tp) < 1.0) {
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

  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, t), 1.0);
}`;

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, ['u_res', 'u_tid', 'u_luta', 'u_flamma', 'u_ljus', 'u_kvav', 'u_dropp', 'u_synlig']);

    // Världen: x i bredder från mitten, y uppåt från bordet
    const varld = (cx, cy) => [(cx - duk.clientWidth / 2) / duk.clientWidth, (duk.clientHeight * 0.7 - cy) / duk.clientWidth];
    const VEKE = [0, 0.445];

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
      upp: () => { finger.nere = false; },
    });

    // Stelnade droppar längs ljuset, och en som ibland rinner
    const droppar = Array.from({ length: DROPPAR }, (_, i) => ({
      x: slump(-0.8, 0.8), langd: i < 2 ? slump(0.03, 0.12) : 0, bredd: slump(0.08, 0.16), rinner: false,
    }));
    const droppData = new Float32Array(DROPPAR * 4);
    let nastaDroppe = slump(15, 35);

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
    // En nästan ohörbar varm ton, som stillhet i rummet
    const ton = ctx.createGain(); ton.gain.value = 0;
    [196, 293.66, 392].forEach((f, i) => {
      const o = ctx.createOscillator(); o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = [0.5, 0.3, 0.15][i];
      o.connect(g).connect(ton); o.start(); l.kallor.push(o);
    });
    const tonF = ctx.createBiquadFilter(); tonF.type = 'lowpass'; tonF.frequency.value = 500;
    ton.connect(tonF).connect(ut);
    ton.gain.setTargetAtTime(0.018, ctx.currentTime + 1, 3);
    l.kallor.push(rumston, fladder);

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
      nastaDroppe -= dt;
      if (nastaDroppe <= 0) {
        const d = droppar.find((x) => !x.rinner && x.langd === 0) ?? droppar[Math.floor(Math.random() * DROPPAR)];
        Object.assign(d, { x: slump(-0.85, 0.85), langd: 0.004, bredd: slump(0.08, 0.15), rinner: true, mal: slump(0.06, 0.2) });
        nastaDroppe = slump(25, 50);
      }
      for (const d of droppar) {
        if (!d.rinner) continue;
        d.langd += dt * 0.004 * (1 - d.langd / d.mal);
        if (d.langd > d.mal * 0.97) d.rinner = false;
      }
      droppar.forEach((d, i) => droppData.set([d.x, d.langd, d.bredd, 0], i * 4));

      // Ljud: fladder i draget, och ett litet knäpp från veken ibland
      const t = ctx.currentTime;
      fG.gain.setTargetAtTime((0.06 * Math.max(0, flamma - 0.2) + 0.02 * Math.abs(lutaFart) * 0.1) * (1 - kvav), t, 0.06);
      ton.gain.setTargetAtTime(0.018 * (1 - 0.6 * kvav), t, 0.5);
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
      gl.uniform1f(u.u_synlig, mjuk(0, 3, tid));
      ritaHelskarm(gl);
    });

    return stangning({ ljud: l, stoppa, gl });
  },
};
