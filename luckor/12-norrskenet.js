// Lucka 12: Norrskenet
// En vinternatt över snöiga fjäll. Gröna slöjor med rosa underkant och violett topp
// böljar långsamt över himlen i flera lager, och ljuset speglas svagt i snön.
// Drar hon fingret över himlen följer slöjorna med, håller hon fingret stilla tar skenet
// sakta fart. Lutar hon telefonen glider slöjorna åt det hållet.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { brusKalla, rum } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { lyssnaLutning } from '../lib/rorelse.js';
import { mjuk, rumsLjud, slinga, fingrar, stangning } from '../lib/scen.js';

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform float u_tid;
uniform float u_glid;       // hur långt slöjorna har glidit i sidled
uniform float u_styrka;     // hur starkt skenet är
uniform vec3 u_finger;      // x, y (0..1, y uppåt), styrka
uniform float u_synlig;
${BRUS}

// Ett lager av norrsken: ett band som slingrar sig, med strålar som hänger uppåt
vec3 slojor(vec2 p, float lager, float t) {
  float sk = 1.0 + lager * 0.45;
  float x = p.x * sk + lager * 3.7 + u_glid * (0.6 + lager * 0.3);
  // Fingret får slöjan att bölja där det är
  vec2 fd = p - u_finger.xy;
  float nara = exp(-dot(fd, fd) * 14.0) * u_finger.z;
  x += sin(p.y * 18.0 + t * 1.5) * 0.04 * nara;
  float band = 0.44 + lager * 0.06 + 0.06 * sin(x * 1.6 + t * 0.07) + 0.03 * sin(x * 4.1 - t * 0.05 + lager);
  band -= nara * 0.03;
  float h = p.y - band;
  // Strålarna: brus som är utdraget lodrätt, böjt i mjuka veck, och vandrar långsamt i sidled
  float xr = x + 0.1 * sin(x * 2.3 + t * 0.05 + h * 5.0) + 0.05 * sin(x * 5.0 - h * 9.0 + t * 0.08);
  float stralar = fbm3(vec2(xr * 7.0 + fbm3(vec2(xr * 1.3, t * 0.05)) * 2.0, t * 0.12 + lager));
  stralar = pow(smoothstep(0.25, 0.85, stralar), 1.6);
  float fin = brus(vec2(xr * 60.0, t * 0.4 + lager * 9.0));
  stralar *= 0.75 + 0.5 * fin;
  // Skarp underkant, mjukt avklingande uppåt
  float hojd = 0.26 + 0.16 * brus(vec2(x * 2.0, t * 0.05));
  float profil = smoothstep(-0.012, 0.01, h) * exp(-max(h, 0.0) / hojd);
  vec3 gron = vec3(0.25, 1.0, 0.55);
  vec3 rosa = vec3(1.0, 0.35, 0.55);
  vec3 violett = vec3(0.55, 0.3, 1.0);
  vec3 farg = mix(gron, violett, smoothstep(0.05, 0.3, h));
  farg = mix(rosa, farg, smoothstep(-0.01, 0.025, h) * 0.85 + 0.15);
  return farg * stralar * profil * (1.0 - lager * 0.3) * (1.0 + nara * 0.8);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = uv;
  float t = u_tid;

  // Himlen: djupblå, ljusare mot horisonten
  vec3 c = mix(vec3(0.03, 0.06, 0.12), vec3(0.005, 0.01, 0.035), smoothstep(0.25, 1.0, uv.y));
  // Stjärnor som tindrar
  vec2 sc = floor(gl_FragCoord.xy / u_res.x * 180.0);
  float st = step(0.992, hash(sc));
  float tindra = 0.5 + 0.5 * sin(t * (1.0 + hash(sc + 2.0) * 2.0) + hash(sc) * 40.0);
  c += vec3(0.8, 0.85, 1.0) * st * tindra * 0.6 * smoothstep(0.3, 0.6, uv.y);

  vec3 sken = vec3(0.0);
  for (int l = 0; l < 3; l++) sken += slojor(p, float(l), t);
  sken *= u_styrka;
  c += sken * 0.9;

  // Fjällen långt bort, snöiga och svagt upplysta av skenet
  float fjall = 0.3 + 0.06 * sin(uv.x * 3.0 + 1.2) + 0.035 * sin(uv.x * 7.7 + 0.3) + 0.015 * fbm(vec2(uv.x * 12.0, 0.0));
  if (uv.y < fjall) {
    vec3 sno = mix(vec3(0.10, 0.13, 0.2), vec3(0.2, 0.25, 0.35), smoothstep(fjall - 0.1, fjall, uv.y));
    c = sno + vec3(0.1, 0.35, 0.2) * u_styrka * 0.35;
  }
  // Granar på närmaste krönet
  float kron = 0.2 + 0.03 * sin(uv.x * 4.0) + 0.02 * sin(uv.x * 11.0);
  float gx = uv.x * 20.0;
  float gid = floor(gx);
  float gh = 0.035 + 0.05 * hash(vec2(gid, 1.0));
  float gfr = (fract(gx) - 0.5 - (hash(vec2(gid, 2.0)) - 0.5) * 0.3) / 20.0 * (u_res.x / u_res.y);
  float rel = (uv.y - kron) / gh;
  float grenar = 0.7 + 0.4 * fract(rel * (4.0 + 2.0 * hash(vec2(gid, 4.0))));
  bool gran = hash(vec2(gid, 3.0)) > 0.25 && rel > 0.0 && rel < 1.0 &&
              abs(gfr) < (1.0 - rel) * gh * 0.32 * grenar;
  if (uv.y < kron || gran) c = vec3(0.012, 0.018, 0.03);
  // Snöfältet närmast, med ett svagt grönt sken och glitter
  float snofalt = 0.12 + 0.015 * sin(uv.x * 5.0);
  if (uv.y < snofalt) {
    vec3 sno = mix(vec3(0.16, 0.2, 0.3), vec3(0.08, 0.1, 0.17), smoothstep(snofalt, 0.0, uv.y));
    sno += vec3(0.12, 0.4, 0.25) * u_styrka * 0.3 * smoothstep(0.0, snofalt, uv.y);
    float glitter = step(0.996, hash(floor(gl_FragCoord.xy * 0.5))) * (0.5 + 0.5 * sin(t * 2.0 + hash(floor(gl_FragCoord.xy)) * 30.0));
    c = sno + vec3(0.7, 0.9, 1.0) * glitter * 0.5;
  }

  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, t), 1.0);
}`;

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, ['u_res', 'u_tid', 'u_glid', 'u_styrka', 'u_finger', 'u_synlig']);

    // ---------- Fingret och lutningen ----------
    const finger = { x: 0.5, y: 0.6, s: 0, nere: false, vx: 0 };
    let glid = 0, glidFart = 0.012;
    let lutning = 0;
    fingrar(duk, {
      ner: (x, y) => { finger.nere = true; finger.x = x / duk.clientWidth; finger.y = 1 - y / duk.clientHeight; },
      drag: (x, y) => {
        const nx = x / duk.clientWidth;
        finger.vx += (nx - finger.x) * 0.6;
        finger.x = nx; finger.y = 1 - y / duk.clientHeight;
      },
      upp: () => { finger.nere = false; },
    });
    const slutaLuta = lyssnaLutning((beta, gamma) => { lutning = Math.max(-1, Math.min(1, gamma / 35)); });

    // ---------- Ljud ----------
    const l = rumsLjud(1.25, 2);
    const { ctx, ut } = l;
    const eko = rum(5);
    const ekoUt = ctx.createGain(); ekoUt.gain.value = 0.45;
    eko.connect(ekoUt).connect(ut);
    const ton = ctx.createGain(); ton.gain.value = 0;
    const tonF = ctx.createBiquadFilter(); tonF.type = 'lowpass'; tonF.frequency.value = 700;
    tonF.connect(ton); ton.connect(ut); ton.connect(eko);
    [[110, 0.5], [164.81, 0.3], [220.2, 0.22], [329.4, 0.08], [440.5, 0.04]].forEach(([f, g], i) => {
      const o = ctx.createOscillator(); o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = g;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.03 + i * 0.017;
      const lg = ctx.createGain(); lg.gain.value = g * 0.4;
      lfo.connect(lg).connect(og.gain);
      o.connect(og).connect(tonF);
      o.start(); lfo.start();
      l.kallor.push(o, lfo);
    });
    const skimmer = brusKalla('rosa');
    const skF = ctx.createBiquadFilter(); skF.type = 'bandpass'; skF.frequency.value = 2600; skF.Q.value = 3;
    const skG = ctx.createGain(); skG.gain.value = 0;
    skimmer.connect(skF).connect(skG); skG.connect(ut); skG.connect(eko);
    const vind = brusKalla('rosa');
    const viF = ctx.createBiquadFilter(); viF.type = 'lowpass'; viF.frequency.value = 300;
    const viG = ctx.createGain(); viG.gain.value = 0.025;
    vind.connect(viF).connect(viG).connect(ut);
    l.kallor.push(skimmer, vind);

    // ---------- Ritslinga ----------
    let styrka = 0.55;
    const stoppa = slinga((tid, dt) => {
      // Fingret: drar man böljar och glider slöjorna, håller man stilla växer skenet
      finger.s += ((finger.nere ? 1 : 0) - finger.s) * Math.min(1, dt * 2);
      const mal = 0.55 + 0.25 * Math.sin(tid * 0.05) + (finger.nere ? 0.35 : 0);
      styrka += (mal - styrka) * Math.min(1, dt * 0.4);
      glidFart += (0.012 + lutning * 0.08 + finger.vx - glidFart) * Math.min(1, dt * 0.8);
      finger.vx *= Math.exp(-dt * 2);
      glid += glidFart * dt;

      const t = ctx.currentTime;
      ton.gain.setTargetAtTime(0.05 + 0.05 * styrka, t, 0.5);
      tonF.frequency.setTargetAtTime(500 + 500 * styrka, t, 0.5);
      skG.gain.setTargetAtTime(0.006 + 0.014 * styrka * (0.6 + 0.4 * Math.sin(tid * 0.3)), t, 0.4);
      skF.frequency.setTargetAtTime(2200 + 900 * Math.sin(tid * 0.07), t, 0.5);

      anpassa(gl, duk, 0.6);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_glid, glid);
      gl.uniform1f(u.u_styrka, styrka);
      gl.uniform3f(u.u_finger, finger.x, finger.y, finger.s);
      gl.uniform1f(u.u_synlig, mjuk(0, 4, tid));
      ritaHelskarm(gl);
    });

    return stangning({ ljud: l, stoppa, gl, extra: [slutaLuta] });
  },
};
