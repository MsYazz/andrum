// Lucka 8: Isfönstret
// En fönsterruta en vinterkväll. Isblommor växer långsamt in från kanterna, med
// fjäderlika grenar. Bakom glaset syns granar och en stuga med varma fönster.
// Håller hon fingret mot rutan smälter ett titthål som växer, och drar hon fingret
// torkar hon en strimma. Frosten kryper sedan långsamt tillbaka.
// Frosten växer som kristaller: celler bredvid frost fryser, oftast vid spetsarna.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { brusKalla } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { mjuk, slump, rumsLjud, slinga, fingrar, stangning, brusstot } from '../lib/scen.js';

const FW = 240, FH = 480;

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform sampler2D u_frost;
uniform vec2 u_rut;
uniform vec3 u_varme;   // fingrets värme: x, y (0..1, y nedåt), styrka
uniform float u_tid;
uniform float u_synlig;
${BRUS}

// Utsikten genom fönstret: kvällshimmel, snöiga kullar, granar och en stuga
vec3 utsikt(vec2 p, float suddig) {
  vec3 c = mix(vec3(0.03, 0.05, 0.12), vec3(0.10, 0.14, 0.26), smoothstep(0.2, 1.6, p.y));
  // Kullarna med snö, svagt blåa i kvällsljuset
  float kulle = 0.42 + 0.06 * sin(p.x * 3.1 + 1.0) + 0.04 * sin(p.x * 7.3);
  if (p.y < kulle) c = mix(vec3(0.20, 0.24, 0.34), vec3(0.34, 0.38, 0.50), smoothstep(0.0, kulle, p.y));
  // Granar
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float gx = fract(fi * 0.381 + 0.13) * 1.1 - 0.05;
    float gh = 0.18 + 0.12 * hash(vec2(fi, 2.0));
    float bas = kulle - 0.02 - 0.03 * hash(vec2(fi, 5.0));
    float rel = (p.y - bas) / gh;
    if (rel > 0.0 && rel < 1.0) {
      float bredd = (1.0 - rel) * gh * 0.32 * (0.85 + 0.25 * sin(rel * 40.0 + fi));
      if (abs(p.x - gx) < bredd) c = vec3(0.025, 0.04, 0.05) + vec3(0.1, 0.12, 0.16) * step(0.6, fract(rel * 6.0)) * 0.4;
    }
  }
  // Stugan med två varma fönster
  vec2 s = p - vec2(0.62, 0.36);
  if (abs(s.x) < 0.09 && s.y > 0.0 && s.y < 0.07) c = vec3(0.12, 0.06, 0.05);
  if (s.y > 0.07 && s.y < 0.07 + (0.1 - abs(s.x)) * 0.7 && abs(s.x) < 0.1) c = vec3(0.55, 0.6, 0.72);
  vec2 f1 = s - vec2(-0.045, 0.035), f2 = s - vec2(0.04, 0.035);
  float fonster = step(abs(f1.x), 0.014) * step(abs(f1.y), 0.012) + step(abs(f2.x), 0.014) * step(abs(f2.y), 0.012);
  vec3 varm = vec3(1.0, 0.72, 0.38);
  c = mix(c, varm, min(fonster, 1.0));
  // Skenet från fönstren, bredare när glaset är frostat
  float sken = exp(-dot(f1, f1) / (0.002 + suddig * 0.02)) + exp(-dot(f2, f2) / (0.002 + suddig * 0.02));
  c += varm * sken * (0.25 + suddig * 0.5);
  // Några få snöflingor som faller långsamt
  for (int i = 0; i < 2; i++) {
    float sk = 20.0 + float(i) * 14.0;
    vec2 q = p * sk + vec2(0.0, u_tid * (0.35 + float(i) * 0.2));
    q.x += sin(q.y * 0.4 + float(i)) * 0.4;
    vec2 cell = floor(q), fr = fract(q) - 0.5;
    float h = hash(cell);
    if (h > 0.9) {
      vec2 o = (hash2(cell) - 0.5) * 0.6;
      c += vec3(0.8, 0.85, 0.95) * smoothstep(0.08, 0.0, length(fr - o)) * 0.35 * (1.0 - suddig);
    }
  }
  return c;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 tc = vec2(uv.x, 1.0 - uv.y);
  float asp = u_res.y / u_res.x;
  vec2 p = vec2(uv.x, uv.y * asp);

  // Frostens täthet och riktning (från lutningen i fältet)
  vec2 e = 1.5 / u_rut;
  float F = texture(u_frost, tc).r;
  float Fx = texture(u_frost, tc + vec2(e.x, 0.0)).r - texture(u_frost, tc - vec2(e.x, 0.0)).r;
  float Fy = texture(u_frost, tc + vec2(0.0, e.y)).r - texture(u_frost, tc - vec2(0.0, e.y)).r;
  vec2 g = vec2(Fx, Fy * asp);
  vec2 rikt = length(g) > 1e-4 ? normalize(g) : vec2(0.0, 1.0);
  vec2 tvars = vec2(-rikt.y, rikt.x);

  // Fjäderlika ränder tvärs växtriktningen syns bara i kanterna där frosten växer.
  // Den täta frosten får en jämn yta av små kristaller.
  float iKant = smoothstep(0.02, 0.12, length(g));
  float fjader = brus(vec2(dot(p, tvars) * 160.0, dot(p, rikt) * 20.0));
  float yta = fbm(p * 90.0) * 0.6 + brus(p * 320.0) * 0.4;
  float tathet = smoothstep(0.08, 0.85, F);
  float kristall = tathet * (0.5 + mix(0.45 * yta, 0.5 * fjader, iKant));

  vec3 c = utsikt(p, tathet);

  // Frosten sprider ljuset, vitblå med varmt skimmer från stugan
  vec3 isFarg = mix(vec3(0.55, 0.65, 0.80), vec3(0.88, 0.92, 0.98), kristall);
  float stugljus = exp(-dot(p - vec2(0.62, 0.40), p - vec2(0.62, 0.40)) * 6.0);
  isFarg += vec3(0.6, 0.38, 0.18) * stugljus * 0.35;
  c = mix(c, isFarg * 0.75, clamp(kristall * 1.1, 0.0, 0.92));
  // Glittrande kristaller
  vec2 kc = floor(gl_FragCoord.xy * 0.5);
  float glitter = step(0.996, hash(kc)) * tathet * (0.5 + 0.5 * sin(u_tid * 1.3 + hash(kc + 9.0) * 25.0));
  c += vec3(0.9, 0.95, 1.0) * max(glitter, 0.0) * 0.5;

  // Imma där fingret värmer, och små droppar i kanten av titthålet
  vec2 vd = (tc - u_varme.xy) * vec2(1.0, asp);
  float imma = exp(-dot(vd, vd) * 90.0) * u_varme.z;
  c = mix(c, vec3(0.55, 0.6, 0.68), imma * 0.25);
  float kantSmalt = smoothstep(0.05, 0.25, F) * (1.0 - smoothstep(0.25, 0.5, F));
  vec2 dc = floor(gl_FragCoord.xy * 0.25);
  c += vec3(0.7, 0.75, 0.85) * step(0.93, hash(dc + 4.0)) * kantSmalt * 0.25;

  // Fönsterkarmen: mörkt målat trä runt kanten
  float karm = max(smoothstep(0.035, 0.02, min(uv.x, 1.0 - uv.x)), smoothstep(0.03, 0.017, min(uv.y, 1.0 - uv.y)));
  karm = max(karm, smoothstep(0.012, 0.004, abs(uv.y - 0.5)));
  c = mix(c, vec3(0.16, 0.12, 0.10) * (0.8 + 0.2 * fbm(p * vec2(4.0, 40.0))), karm);

  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, u_tid), 1.0);
}`;

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, ['u_res', 'u_frost', 'u_rut', 'u_varme', 'u_tid', 'u_synlig']);

    // ---------- Frosten ----------
    const N = FW * FH;
    const F = new Float32Array(N);
    // Hur gärna en cell fryser. Kristallerna växer helst längs smala kanaler i en
    // riktning som varierar över rutan, och det är det som gör grenarna fjäderlika.
    const vilja = new Float32Array(N);
    const fr1 = slump(0, 10), fr2 = slump(0, 10);
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      const i = y * FW + x;
      const a = Math.sin(x * 0.021 + fr1) * 1.6 + Math.cos(y * 0.017 + fr2) * 1.6 + Math.sin((x + y) * 0.009) * 2;
      const kanal = 0.5 + 0.5 * Math.sin((x * Math.cos(a) + y * Math.sin(a)) * 0.85 + Math.sin(y * 0.05 + x * 0.03) * 2);
      vilja[i] = (0.2 + 0.8 * Math.pow(kanal, 3)) * (0.7 + 0.3 * Math.random());
      // Kanterna är frostade från början, tjockast nertill
      const kant = Math.min(x, FW - 1 - x, y, FH - 1 - y);
      const nedre = y > FH * 0.85 ? 4 : 0;
      if (kant < 2 + nedre + Math.random() * 2) F[i] = 1;
      // Mittspröjsen
      if (Math.abs(y + 0.5 - FH * 0.5) < 1.2) F[i] = 1;
    }
    // Några frön längs kanterna där isblommor börjar
    for (let k = 0; k < 60; k++) {
      const sida = Math.floor(Math.random() * 4);
      const x = sida < 2 ? Math.floor(Math.random() * FW) : sida === 2 ? 3 : FW - 4;
      const y = sida >= 2 ? Math.floor(Math.random() * FH) : sida === 0 ? 3 : FH - 4;
      F[y * FW + x] = 1;
    }

    // Kristallväxt: en tom cell bredvid frost kan frysa, gärna vid spetsar (få grannar)
    function vaxa(antal) {
      let vaxt = 0;
      for (let k = 0; k < antal; k++) {
        const x = 1 + Math.floor(Math.random() * (FW - 2));
        const y = 1 + Math.floor(Math.random() * (FH - 2));
        const i = y * FW + x;
        if (F[i] >= 0.99 || skydd[i] > 0) continue;
        let n = 0;
        if (F[i - 1] > 0.5) n++; if (F[i + 1] > 0.5) n++;
        if (F[i - FW] > 0.5) n++; if (F[i + FW] > 0.5) n++;
        if (F[i - FW - 1] > 0.5) n++; if (F[i - FW + 1] > 0.5) n++;
        if (F[i + FW - 1] > 0.5) n++; if (F[i + FW + 1] > 0.5) n++;
        if (n === 0) continue;
        const spets = n <= 2 ? 1 : n <= 4 ? 0.25 : 0.6;
        if (Math.random() < 0.55 * spets * vilja[i]) { F[i] = 1; vaxt++; }
        else if (n >= 5) F[i] = Math.min(1, F[i] + 0.05);
      }
      return vaxt;
    }
    const skydd = new Float32Array(N);
    for (let k = 0; k < 600; k++) vaxa(12000);

    // Frosten mjukas upp lite innan den ritas, så att rutnätet inte syns
    const Fm = new Float32Array(N);
    function utjamna() {
      for (let y = 1; y < FH - 1; y++) {
        const r = y * FW;
        for (let x = 1; x < FW - 1; x++) {
          const i = r + x;
          Fm[i] = F[i] * 0.4 + (F[i - 1] + F[i + 1] + F[i - FW] + F[i + FW]) * 0.11 +
            (F[i - FW - 1] + F[i - FW + 1] + F[i + FW - 1] + F[i + FW + 1]) * 0.04;
        }
      }
    }

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, FW, FH, 0, gl.RED, gl.FLOAT, F);
    gl.uniform1i(u.u_frost, 0);
    gl.uniform2f(u.u_rut, FW, FH);

    // ---------- Fingret ----------
    const finger = { x: 0, y: 0, nere: false, varme: 0, radie: 0 };
    const tillRut = (x, y) => [x / duk.clientWidth, y / duk.clientHeight];
    fingrar(duk, {
      ner: (x, y) => { [finger.x, finger.y] = tillRut(x, y); finger.nere = true; finger.radie = 0.02; },
      drag: (x, y) => { [finger.x, finger.y] = tillRut(x, y); },
      upp: () => { finger.nere = false; },
    });

    function smalt(dt) {
      if (!finger.nere) return 0;
      finger.radie = Math.min(0.1, finger.radie + dt * 0.03);
      const asp = duk.clientHeight / duk.clientWidth;
      const R = finger.radie;
      const cx = finger.x * FW, cy = finger.y * FH;
      const rx = R * FW, ry = (R / asp) * FH;
      const x0 = Math.max(1, Math.floor(cx - rx - 2)), x1 = Math.min(FW - 2, Math.ceil(cx + rx + 2));
      const y0 = Math.max(1, Math.floor(cy - ry - 2)), y1 = Math.min(FH - 2, Math.ceil(cy + ry + 2));
      let smalte = 0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        const d = Math.hypot(dx, dy);
        if (d < 1.25) {
          const i = y * FW + x;
          const mal = mjuk(0.75, 1.25, d);
          if (F[i] > mal) { smalte += F[i] - mal; F[i] += (mal - F[i]) * Math.min(1, dt * 4); }
          skydd[i] = 4;
        }
      }
      return smalte;
    }

    // ---------- Ljud ----------
    const l = rumsLjud(1.25, 1.5);
    const { ctx, ut } = l;
    const rumston = brusKalla('rosa');
    const rumF = ctx.createBiquadFilter(); rumF.type = 'lowpass'; rumF.frequency.value = 160;
    const rumG = ctx.createGain(); rumG.gain.value = 0.04;
    rumston.connect(rumF).connect(rumG).connect(ut);
    // Vinden utanför, dämpad av glaset
    const vind = brusKalla('rosa');
    const vindF = ctx.createBiquadFilter(); vindF.type = 'bandpass'; vindF.frequency.value = 500; vindF.Q.value = 0.6;
    const vindG = ctx.createGain(); vindG.gain.value = 0.015;
    const vindLfo = ctx.createOscillator(); vindLfo.frequency.value = 0.07;
    const vindDjup = ctx.createGain(); vindDjup.gain.value = 0.012;
    vindLfo.connect(vindDjup).connect(vindG.gain);
    vind.connect(vindF).connect(vindG).connect(ut);
    vindLfo.start();
    // Värmen från fingret: ett mjukt sus
    const andning = brusKalla('rosa');
    const andF = ctx.createBiquadFilter(); andF.type = 'bandpass'; andF.frequency.value = 900; andF.Q.value = 0.5;
    const andG = ctx.createGain(); andG.gain.value = 0;
    andning.connect(andF).connect(andG).connect(ut);
    l.kallor.push(rumston, vind, vindLfo, andning);

    // ---------- Ritslinga ----------
    let knasterTid = 1;
    const stoppa = slinga((tid, dt) => {
      for (let i = 0; i < N; i++) if (skydd[i] > 0) skydd[i] -= dt;
      const vaxt = vaxa(Math.floor(15000 * Math.min(2, dt * 60)));
      const smalte = smalt(dt);
      finger.varme += ((finger.nere ? 1 : 0) - finger.varme) * Math.min(1, dt * 2.5);

      // Ett svagt knaster när frosten växer, och ett sus när fingret värmer
      const t = ctx.currentTime;
      knasterTid -= dt * (0.3 + vaxt / 60);
      if (knasterTid <= 0) {
        brusstot(ctx, ut, { frekvens: slump(4000, 9000), q: 2, styrka: slump(0.02, 0.06), langd: 0.0006, nar: t });
        knasterTid = slump(0.2, 1.4);
      }
      andG.gain.setTargetAtTime(0.03 * finger.varme + Math.min(0.02, smalte * 0.002), t, 0.15);

      utjamna();
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, FW, FH, gl.RED, gl.FLOAT, Fm);
      anpassa(gl, duk, 0.75);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform3f(u.u_varme, finger.x, finger.y, finger.varme);
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_synlig, mjuk(0, 3, tid));
      ritaHelskarm(gl);
    });

    return stangning({ ljud: l, stoppa, gl });
  },
};
