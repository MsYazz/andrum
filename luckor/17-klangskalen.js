// Lucka 17: Klangskålen
// En hamrad bronsskål på en mörkröd kudde, sedd uppifrån och fylld med vatten.
// Ett tryck slår an skålen och tonen klingar ut länge. För hon fingret i en cirkel runt
// kanten växer tonen och sjunger så länge hon fortsätter. Vattnet visar svängningen.
// Klangen är modalsyntes: deltoner i skålens egna förhållanden, var och en som två
// svagt förstämda toner, vilket ger det svävande wah-wah som klangskålar har.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { rum } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { mjuk, slump, klamp, rumsLjud, slinga, fingrar, stangning } from '../lib/scen.js';

const GRUND = slump(196, 233);
const DELAR = [
  // förhållande, styrka vid slag, avklingning (s), styrka vid gnidning, svävning (Hz)
  [1.0, 1.0, 26, 1.0, 0.9],
  [2.71, 0.55, 14, 0.35, 1.4],
  [5.15, 0.3, 8, 0.08, 2.1],
  [8.4, 0.16, 4.5, 0.02, 2.8],
  [12.3, 0.08, 2.5, 0.0, 3.5],
];

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform float u_tid;
uniform float u_sang;      // hur starkt skålen sjunger just nu
uniform vec4 u_slag;       // x, y (relativt skålen), tid sedan slaget, styrka
uniform float u_vinkel;    // var fingret gnider
uniform float u_synlig;
${BRUS}

void main() {
  float s = u_res.x;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / s;
  float r = length(p);
  float a = atan(p.y, p.x);
  float R = 0.36;           // skålens ytterkant
  float Ri = 0.305;         // vattnets kant

  // Mörk matta i bakgrunden
  vec3 c = vec3(0.06, 0.04, 0.035) * (0.85 + 0.25 * fbm(p * 8.0));
  c *= 1.0 - 0.6 * smoothstep(0.3, 1.1, r);

  // Kudden: mörkröd sammet med veck
  float kudde = 0.47 + 0.015 * sin(a * 7.0);
  if (r < kudde) {
    float veck = 0.5 + 0.5 * sin(a * 14.0 + fbm(p * 6.0) * 3.0);
    vec3 sammet = vec3(0.32, 0.05, 0.07) * (0.6 + 0.35 * veck) * (0.85 + 0.2 * fbm(p * 30.0));
    sammet *= 0.6 + 0.6 * smoothstep(kudde, R, r);
    c = mix(c, sammet, smoothstep(kudde, kudde - 0.01, r));
  }
  // Skuggan under skålen
  c *= 1.0 - 0.5 * smoothstep(R + 0.05, R - 0.02, length(p - vec2(0.012, -0.018)));

  // Skålen: brons med hamrade gropar, ljus kant och mörkare insida
  if (r < R) {
    float grop = fbm(p * 38.0);
    float kantR = R - 0.014;
    // Innerväggen välver sig ner mot vattnet och mörknar, kanten är smal och ljus
    vec3 vagg = mix(vec3(0.16, 0.09, 0.04), vec3(0.55, 0.37, 0.18), pow(smoothstep(Ri, kantR, r), 1.6));
    vagg *= 0.8 + 0.3 * grop;
    float vaggLjus = pow(max(0.0, cos(a + 0.85)), 3.0) * smoothstep(Ri, kantR, r);
    vagg += vec3(0.9, 0.65, 0.35) * vaggLjus * 0.25;
    vec3 kant = vec3(0.78, 0.58, 0.32) * (0.85 + 0.25 * grop);
    kant += vec3(1.0, 0.88, 0.65) * pow(max(0.0, cos(a - 2.3)), 5.0) * 0.6;
    vec3 brons = mix(vagg, kant, smoothstep(kantR - 0.002, kantR + 0.002, r));
    brons *= mix(1.0, 0.75, smoothstep(R - 0.004, R, r));
    c = brons;
    // Kanten glöder varmt där fingret gnider
    float gnid = exp(-pow(mod(a - u_vinkel + 3.14159, 6.2832) - 3.14159, 2.0) * 6.0) * u_sang;
    c += vec3(1.0, 0.7, 0.4) * gnid * smoothstep(R - 0.04, R - 0.01, r) * 0.25;
  }
  // Vattnet i skålen
  if (r < Ri) {
    float rn = r / Ri;
    // Stående våg med fyra bukar, som skålens grundton
    float t = u_tid;
    float ring = cos(a * 2.0) * sin(rn * 3.14159 * 1.0) * rn;
    float hojd = ring * u_sang * sin(t * 40.0) * 0.12;
    hojd += cos(a * 2.0 + 1.57) * sin(rn * 9.42) * u_sang * 0.05 * sin(t * 33.0);
    // Ringar från slaget
    vec2 sd = p - u_slag.xy;
    float sl = length(sd);
    float front = u_slag.z * 0.18;
    hojd += sin((sl - front) * 80.0) * exp(-pow((sl - front) * 22.0, 2.0)) * u_slag.w * exp(-u_slag.z * 0.8) * 0.18;
    // Ljuset bryts i krusningarna
    float dh = dFdx(hojd) + dFdy(hojd);
    // Mörkt, blankt vatten där skålens glans speglas, och krusningar som fångar ljuset
    vec3 vatten = mix(vec3(0.05, 0.035, 0.025), vec3(0.13, 0.085, 0.05), rn);
    vatten += vec3(0.75, 0.55, 0.3) * pow(max(0.0, cos(a - 2.3)), 6.0) * smoothstep(0.7, 1.0, rn) * 0.35;
    vatten += vec3(1.0, 0.92, 0.8) * clamp(dh * 70.0, 0.0, 1.0) * 0.45;
    vatten += vec3(0.8, 0.7, 0.55) * clamp(-dh * 70.0, 0.0, 1.0) * 0.08;
    vatten += vec3(0.9, 0.8, 0.7) * exp(-pow((r - 0.11) * 18.0, 2.0)) * pow(max(0.0, cos(a - 2.3)), 10.0) * 0.18;
    c = mix(c, vatten, smoothstep(Ri, Ri - 0.004, r));
  }

  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, u_tid), 1.0);
}`;

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, ['u_res', 'u_tid', 'u_sang', 'u_slag', 'u_vinkel', 'u_synlig']);

    // ---------- Klangen ----------
    const l = rumsLjud(0.95, 0.6);
    const { ctx, ut } = l;
    const eko = rum(4);
    const ekoUt = ctx.createGain(); ekoUt.gain.value = 0.35;
    eko.connect(ekoUt).connect(ut);
    const delar = DELAR.map(([k, , , , sv]) => {
      const g = ctx.createGain(); g.gain.value = 0;
      g.connect(ut); g.connect(eko);
      for (const d of [-sv / 2, sv / 2]) {
        const o = ctx.createOscillator();
        o.frequency.value = GRUND * k + d;
        const og = ctx.createGain(); og.gain.value = 0.5;
        o.connect(og).connect(g);
        o.start();
        l.kallor.push(o);
      }
      return g;
    });
    const slagNiva = DELAR.map(() => 0);
    let sang = 0;
    const NIVA = 0.07;

    function sla(styrka) {
      DELAR.forEach(([, a], i) => { slagNiva[i] = Math.min(1, slagNiva[i] + a * styrka); });
    }

    // ---------- Fingret ----------
    const centrum = () => [duk.clientWidth / 2, duk.clientHeight / 2];
    const Rpx = () => duk.clientWidth * 0.36;
    let gnider = false;
    let forraVinkel = null;
    let vinkelFart = 0;
    let fingerVinkel = 0;
    let slag = { x: 0, y: 0, t: 99, s: 0 };
    fingrar(duk, {
      ner: (x, y) => {
        const [cx, cy] = centrum();
        const d = Math.hypot(x - cx, y - cy);
        gnider = Math.abs(d - Rpx()) < Rpx() * 0.25;
        forraVinkel = Math.atan2(cy - y, x - cx);
      },
      drag: (x, y, id, e) => {
        const [cx, cy] = centrum();
        const d = Math.hypot(x - cx, y - cy);
        const a = Math.atan2(cy - y, x - cx);
        fingerVinkel = a;
        gnider = Math.abs(d - Rpx()) < Rpx() * 0.3;
        if (forraVinkel !== null && gnider) {
          let da = a - forraVinkel;
          if (da > Math.PI) da -= Math.PI * 2;
          if (da < -Math.PI) da += Math.PI * 2;
          vinkelFart += Math.abs(da) * 1.2;
        }
        forraVinkel = a;
        void e;
      },
      upp: (x, y, id, { tryck }) => {
        gnider = false;
        forraVinkel = null;
        if (tryck) {
          const [cx, cy] = centrum();
          const d = Math.hypot(x - cx, y - cy);
          if (d < Rpx() * 1.25) {
            const s = duk.clientWidth;
            slag = { x: (x - cx) / s, y: (cy - y) / s, t: 0, s: 1 };
            sla(d > Rpx() * 0.8 ? 1 : 0.7);
          }
        }
      },
    });

    // ---------- Ritslinga ----------
    const stoppa = slinga((tid, dt) => {
      // Gnidningen: lagom fart runt kanten bygger upp sången, som en fingertopp mot brons
      const fart = vinkelFart / Math.max(dt, 1e-3);
      vinkelFart = 0;
      const lagom = gnider ? mjuk(0.5, 2.5, fart) * (1 - 0.4 * mjuk(8, 14, fart)) : 0;
      sang += (lagom * 1.0 - sang) * Math.min(1, dt * (lagom > sang ? 0.7 : 0.25));
      slag.t += dt;

      const t = ctx.currentTime;
      DELAR.forEach(([, , avk, gnid], i) => {
        slagNiva[i] *= Math.exp(-dt / avk);
        const mal = (slagNiva[i] + sang * gnid) * NIVA;
        delar[i].gain.setTargetAtTime(mal, t, 0.03);
      });

      const synlig = Math.max(sang, slagNiva[0] * 0.8);
      anpassa(gl, duk, 0.75);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_sang, klamp(synlig, 0, 1));
      gl.uniform4f(u.u_slag, slag.x, slag.y, slag.t, slag.s);
      gl.uniform1f(u.u_vinkel, fingerVinkel);
      gl.uniform1f(u.u_synlig, mjuk(0, 2.5, tid));
      ritaHelskarm(gl);
    });

    return stangning({ ljud: l, stoppa, gl });
  },
};
