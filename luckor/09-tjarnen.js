// Lucka 9: Tjärnen
// En skogstjärn i blå timmen, sedd uppifrån. Ytan speglar kvällshimlen, månen och
// granarna runt stranden. Ett tryck släpper en droppe, och ringarna sprider sig,
// möts och klingar ut. Drar hon fingret blir det ett kölvatten. Näckrosbladen guppar.
// Ytan räknas fram med vågekvationen på ett rutnät.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { brusKalla, rum } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { mjuk, slump, rumsLjud, slinga, fastaSteg, fingrar, stangning, brusstot } from '../lib/scen.js';

const VW = 128, VH = 256;
const BLAD = 4;

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform sampler2D u_yta;
uniform vec2 u_rut;
uniform vec4 u_blad[${BLAD}];   // x, y (0..1, y nedåt), radie (andel av bredden), vinkel
uniform vec2 u_mane;
uniform float u_tid;
uniform float u_synlig;
${BRUS}

// Spegelbilden: kvällshimmel, månen och granarnas siluetter runt stranden
vec3 spegel(vec2 p, float asp) {
  vec2 m = p - vec2(0.5, 0.5 * asp);
  float r = length(m / vec2(0.5, 0.5 * asp));
  vec3 c = mix(vec3(0.22, 0.20, 0.42), vec3(0.05, 0.06, 0.16), smoothstep(0.0, 1.1, r));
  // Ett varmt sken från där solen gått ner
  c += vec3(0.55, 0.30, 0.25) * exp(-dot(p - vec2(0.85, 0.15 * asp), p - vec2(0.85, 0.15 * asp)) * 3.0) * 0.45;
  // Stjärnor som speglas
  vec2 sc = floor(p * 70.0);
  float stjarna = step(0.993, hash(sc)) * smoothstep(0.9, 0.3, r);
  c += vec3(0.7, 0.72, 0.85) * stjarna * 0.5 * smoothstep(0.35, 0.0, length(fract(p * 70.0) - 0.5));
  // Månen, mild och lite dämpad av vattnet
  vec2 md = p - u_mane;
  float mane = smoothstep(0.024, 0.02, length(md));
  c += vec3(0.85, 0.84, 0.78) * mane * 0.85;
  c += vec3(0.5, 0.52, 0.62) * exp(-dot(md, md) * 140.0) * 0.3;
  // Granarna runt stranden speglas och pekar in mot mitten, olika höga, med luckor emellan
  float a = atan(m.y, m.x);
  float n = 26.0;
  float sektor = fract(a / 6.2832 * n);
  float id = floor(a / 6.2832 * n);
  float finns = step(0.18, hash(vec2(id, 7.0)));
  float hojd = (0.1 + 0.3 * pow(hash(vec2(id, 1.0)), 1.4)) * finns;
  float spets = 1.0 - hojd;
  float inne = r - spets;
  vec3 gran = vec3(0.02, 0.028, 0.05);
  if (inne > 0.0 && hojd > 0.0) {
    float rel = inne / hojd;
    // Grenvåningar: bredare längst ner i varje våning
    float vaning = fract(rel * (5.0 + 3.0 * hash(vec2(id, 4.0))));
    float bredd = rel * 0.38 * (0.75 + 0.35 * vaning) * (0.8 + 0.4 * hash(vec2(id, 3.0)));
    bredd += (brus(vec2(inne * 90.0, id)) - 0.5) * 0.05;
    float kant = abs(sektor - 0.5 - (hash(vec2(id, 9.0)) - 0.5) * 0.3);
    c = mix(c, gran, smoothstep(bredd + 0.03, bredd - 0.01, kant));
  }
  // Strandkanten längst ut, med lite dis
  c = mix(c, vec3(0.02, 0.025, 0.045), smoothstep(0.9, 1.0, r));
  return c;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 tc = vec2(uv.x, 1.0 - uv.y);
  float asp = u_res.y / u_res.x;
  vec2 p = vec2(uv.x, uv.y * asp);

  vec2 e = 1.0 / u_rut;
  float hx = texture(u_yta, tc + vec2(e.x, 0.0)).r - texture(u_yta, tc - vec2(e.x, 0.0)).r;
  float hy = texture(u_yta, tc + vec2(0.0, e.y)).r - texture(u_yta, tc - vec2(0.0, e.y)).r;
  vec3 n = normalize(vec3(-hx * 7.0, hy * 7.0, 1.0));

  // Spegelbilden förskjuts av vågorna, och lite djup syns där vattnet lutar
  vec3 c = spegel(p + n.xy * 0.09, asp);
  vec3 djup = vec3(0.02, 0.05, 0.05);
  c = mix(c, djup, 0.18 * (1.0 - n.z) * 6.0);
  // Ljuskanter på vågkammarna
  vec3 L = normalize(vec3(u_mane - p, 0.6));
  float glans = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 80.0);
  c += vec3(0.8, 0.82, 0.9) * glans * 0.25;

  // Näckrosblad med ett snitt in mot mitten, och en svag skugga
  for (int i = 0; i < ${BLAD}; i++) {
    vec4 b = u_blad[i];
    vec2 d = p - vec2(b.x, b.y * asp);
    float ca = cos(b.w), sa = sin(b.w);
    vec2 r = vec2(d.x * ca - d.y * sa, d.x * sa + d.y * ca);
    float dl = length(r);
    float ang = atan(r.y, r.x);
    float snitt = smoothstep(0.12, 0.05, abs(ang)) * step(0.0, r.x);
    float inne = smoothstep(b.z, b.z * 0.96, dl) * (1.0 - snitt);
    float skugga = smoothstep(b.z * 1.15, b.z * 0.9, length(d - vec2(0.006, -0.008))) * (1.0 - snitt);
    c *= 1.0 - skugga * 0.3;
    vec3 blad = mix(vec3(0.10, 0.22, 0.12), vec3(0.20, 0.36, 0.18), fbm(r * 40.0 + float(i)));
    blad *= 0.8 + 0.3 * smoothstep(0.0, b.z, dl);
    blad += vec3(0.04, 0.06, 0.04) * smoothstep(0.004, 0.0, abs(fract(ang * 2.5) - 0.5) * dl);
    c = mix(c, blad * 0.75, inne);
  }

  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, u_tid), 1.0);
}`;

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, ['u_res', 'u_yta', 'u_rut', 'u_blad', 'u_mane', 'u_tid', 'u_synlig']);

    // ---------- Vattenytan ----------
    const N = VW * VH;
    const h = new Float32Array(N), v = new Float32Array(N);
    function vagor(dt) {
      const k = 900 * dt * dt;           // hur fort vågorna går
      const damp = Math.exp(-dt * 0.55); // hur fort de klingar av
      for (let y = 1; y < VH - 1; y++) {
        const r = y * VW;
        for (let x = 1; x < VW - 1; x++) {
          const i = r + x;
          const lap = h[i - 1] + h[i + 1] + h[i - VW] + h[i + VW] - 4 * h[i];
          v[i] = (v[i] + lap * k) * damp;
        }
      }
      for (let i = 0; i < N; i++) h[i] += v[i];
    }
    // En droppe: en liten mjuk grop i ytan
    const asp = () => duk.clientHeight / duk.clientWidth;
    function droppe(x, y, kraft = 1, radie = 2.2) {
      const cx = x * VW, cy = y * VH;
      const ry = radie / (asp() * VW / VH);
      const x0 = Math.max(1, Math.floor(cx - radie * 3)), x1 = Math.min(VW - 2, Math.ceil(cx + radie * 3));
      const y0 = Math.max(1, Math.floor(cy - ry * 3)), y1 = Math.min(VH - 2, Math.ceil(cy + ry * 3));
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
        const dx = (xx - cx) / radie, dy = (yy - cy) / ry;
        h[yy * VW + xx] -= kraft * 0.6 * Math.exp(-(dx * dx + dy * dy));
      }
    }

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, VW, VH, 0, gl.RED, gl.FLOAT, h);
    gl.uniform1i(u.u_yta, 0);
    gl.uniform2f(u.u_rut, VW, VH);
    const A = duk.clientHeight / duk.clientWidth;
    gl.uniform2f(u.u_mane, slump(0.25, 0.4), A * slump(0.62, 0.75));

    // Näckrosblad på olika ställen varje gång
    const blad = [];
    for (let k = 0; k < BLAD; k++) {
      for (let f = 0; f < 30; f++) {
        const b = { x: slump(0.18, 0.82), y: slump(0.18, 0.82), r: slump(0.045, 0.075), v: slump(0, 6.28), dx: 0, dy: 0 };
        if (blad.some((o) => Math.hypot(o.x - b.x, (o.y - b.y) * A) < o.r + b.r + 0.08)) continue;
        blad.push(b);
        break;
      }
    }
    const bladData = new Float32Array(BLAD * 4);

    // ---------- Ljud ----------
    const l = rumsLjud(1.25, 1.5);
    const { ctx, ut } = l;
    const eko = rum(2.4);
    const ekoUt = ctx.createGain();
    ekoUt.gain.value = 0.35;
    eko.connect(ekoUt).connect(ut);
    const skvalp = brusKalla('rosa');
    const skF = ctx.createBiquadFilter(); skF.type = 'lowpass'; skF.frequency.value = 380;
    const skG = ctx.createGain(); skG.gain.value = 0.02;
    const skLfo = ctx.createOscillator(); skLfo.frequency.value = 0.11;
    const skDjup = ctx.createGain(); skDjup.gain.value = 0.012;
    skLfo.connect(skDjup).connect(skG.gain);
    skvalp.connect(skF).connect(skG).connect(ut);
    skLfo.start();
    const vind = brusKalla('rosa');
    const viF = ctx.createBiquadFilter(); viF.type = 'bandpass'; viF.frequency.value = 700; viF.Q.value = 0.4;
    const viG = ctx.createGain(); viG.gain.value = 0.012;
    vind.connect(viF).connect(viG).connect(ut);
    l.kallor.push(skvalp, skLfo, vind);

    // Ett plipp: en kort ton som stiger snabbt, som när en droppe slår i vatten
    function plipp(kraft = 1) {
      const t = ctx.currentTime;
      const f = slump(700, 1500) / Math.sqrt(kraft);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * slump(2, 3), t + 0.06);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05 * Math.min(1.5, kraft), t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(g);
      g.connect(ut);
      g.connect(eko);
      o.start(t);
      o.stop(t + 0.12);
      brusstot(ctx, ut, { frekvens: slump(2500, 5000), q: 0.8, styrka: 0.08 * kraft, langd: 0.003, nar: t });
    }
    // Ett mjukt drag i vattnet när fingret rör sig
    const drag = brusKalla('rosa');
    const drF = ctx.createBiquadFilter(); drF.type = 'bandpass'; drF.frequency.value = 900; drF.Q.value = 0.6;
    const drG = ctx.createGain(); drG.gain.value = 0;
    drag.connect(drF).connect(drG).connect(ut);
    l.kallor.push(drag);

    // ---------- Fingret ----------
    let forra = null;
    let dragFart = 0;
    const tillRut = (x, y) => [x / duk.clientWidth, y / duk.clientHeight];
    fingrar(duk, {
      ner: (x, y) => {
        const [rx, ry] = tillRut(x, y);
        droppe(rx, ry, 1);
        plipp(1);
        forra = { x: rx, y: ry };
      },
      drag: (x, y) => {
        const [rx, ry] = tillRut(x, y);
        if (forra) {
          const d = Math.hypot(rx - forra.x, (ry - forra.y) * asp());
          const steg = Math.ceil(d / 0.01);
          for (let s = 1; s <= steg; s++) {
            droppe(forra.x + ((rx - forra.x) * s) / steg, forra.y + ((ry - forra.y) * s) / steg, 0.12, 1.8);
          }
          dragFart = Math.min(1, dragFart + d * 8);
        }
        forra = { x: rx, y: ry };
      },
      upp: () => { forra = null; },
    });

    // ---------- Ritslinga ----------
    const fysik = fastaSteg(1 / 120, 8);
    let naturligt = slump(3, 7);
    const stoppa = slinga((tid, dt) => {
      fysik(dt, vagor);

      // Då och då faller en droppe från en gren, eller så vakar en fisk
      naturligt -= dt;
      if (naturligt <= 0 && tid > 2) {
        const fisk = Math.random() < 0.25;
        droppe(slump(0.15, 0.85), slump(0.15, 0.85), fisk ? 1.6 : 0.55, fisk ? 3.2 : 1.6);
        plipp(fisk ? 1.4 : 0.5);
        naturligt = slump(4, 12);
      }

      // Bladen guppar och glider lite med vågorna
      for (const b of blad) {
        const gx = Math.min(VW - 2, Math.max(1, Math.round(b.x * VW))), gy = Math.min(VH - 2, Math.max(1, Math.round(b.y * VH)));
        const i = gy * VW + gx;
        b.dx += ((h[i + 1] - h[i - 1]) * 0.0012 - b.dx) * 0.05;
        b.dy += ((h[i + VW] - h[i - VW]) * 0.0012 - b.dy) * 0.05;
        b.x = Math.min(0.88, Math.max(0.12, b.x - b.dx * dt * 6));
        b.y = Math.min(0.88, Math.max(0.12, b.y - b.dy * dt * 6));
        b.v += (h[i + 1] - h[i - 1]) * 0.002;
      }
      blad.forEach((b, i) => bladData.set([b.x, b.y, b.r, b.v], i * 4));

      dragFart *= Math.exp(-dt * 4);
      drG.gain.setTargetAtTime(0.03 * dragFart, ctx.currentTime, 0.08);

      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, VW, VH, gl.RED, gl.FLOAT, h);
      anpassa(gl, duk, 0.75);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform4fv(u.u_blad, bladData);
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_synlig, mjuk(0, 3, tid));
      ritaHelskarm(gl);
    });

    return stangning({ ljud: l, stoppa, gl });
  },
};
