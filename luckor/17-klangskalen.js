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
uniform float u_dans;      // hur mycket vattnet dansar när skålen sjungit starkt en stund
uniform vec4 u_dropp[16];  // dropparna som hoppar: x, y, höjd, synlighet
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
    // När skålen sjungit starkt en stund börjar vattnet dansa vid kanten, där väggen
    // svänger mest: ett fint rutmönster av små stående vågor, som i en riktig klangskål
    float buk = (0.35 + 0.65 * pow(abs(cos(a * 2.0)), 1.5)) * smoothstep(Ri - 0.07, Ri - 0.008, r);
    // Rutorna följer kanten: en riktning in mot mitten och en längs kanten, lite ojämna
    vec2 lok = vec2(r, a * Ri) + (vec2(brus(p * 60.0), brus(p * 60.0 + 7.0)) - 0.5) * 0.006;
    float rutor = sin(lok.x * 430.0) * sin(lok.y * 430.0) * sin(t * 52.0);
    rutor += 0.5 * sin(lok.x * 610.0 + 1.0) * sin(lok.y * 560.0) * sin(t * 47.0 + 1.0);
    hojd += rutor * buk * u_dans * 0.0035;
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
  // Dropparna som hoppar upp ur vattnet: en blank pärla och dess skugga på ytan, som
  // hamnar längre bort ju högre droppen är
  for (int i = 0; i < 16; i++) {
    vec4 d = u_dropp[i];
    if (d.w <= 0.0) continue;
    vec2 skugga = d.xy + vec2(0.55, -0.8) * d.z * 0.6;
    c *= 1.0 - 0.35 * d.w * exp(-dot(p - skugga, p - skugga) / 0.000012);
    float rd = 0.0036 * (1.0 + d.z * 12.0);
    vec2 q = (p - d.xy) / rd;
    float parla = smoothstep(1.0, 0.75, length(q));
    vec3 farg = vec3(0.14, 0.1, 0.07) + vec3(1.0, 0.92, 0.8) * exp(-dot(q - vec2(-0.35, 0.35), q - vec2(-0.35, 0.35)) * 6.0) * 0.9;
    c = mix(c, farg, parla * d.w);
  }

  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, u_tid), 1.0);
}`;

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, ['u_res', 'u_tid', 'u_sang', 'u_slag', 'u_vinkel', 'u_synlig', 'u_dans', 'u_dropp']);

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
    let sang = 0;
    const NIVA = 0.07;

    // Ett kort pling, som när en nagel nuddar brons: hård ansats och kort klang, där de
    // ljusa deltonerna hörs mest och dör ut fortast. Själva sången kommer först när hon
    // gnider, och den tar en stund att sätta i rörelse.
    const NAGEL = [[0.35, 0.3], [0.5, 0.16], [0.42, 0.09], [0.25, 0.055], [0.12, 0.035]];
    // Ligger fingret kvar på skålen efter plinget dämpar det klangen snabbt, som när man
    // lägger fingret mot en riktig skål. Släpper hon direkt klingar plinget ut fritt.
    let pling = [], plingTimer = 0, fingerNere = false;
    function dampaPling() {
      const t = ctx.currentTime;
      for (const g of pling) {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.setTargetAtTime(0.0001, t, 0.035);
      }
      pling = [];
    }
    // Plinget går till efterklangen genom ett filter och med lägre nivå, så att den hårda
    // ansatsen aldrig blir en brusig smäll i efterklangen
    const nagelEko = ctx.createGain(); nagelEko.gain.value = 0.35;
    const nagelEkoF = ctx.createBiquadFilter(); nagelEkoF.type = 'lowpass'; nagelEkoF.frequency.value = 1600;
    nagelEko.connect(nagelEkoF).connect(eko);
    function nagel(styrka) {
      const t = ctx.currentTime;
      pling = [];
      clearTimeout(plingTimer);
      plingTimer = setTimeout(() => { if (fingerNere) dampaPling(); }, 120);
      DELAR.forEach(([k], i) => {
        const [a, tau] = NAGEL[i];
        const o = ctx.createOscillator();
        o.frequency.value = GRUND * k;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(a * styrka * NIVA * 0.65, t + 0.003);
        g.gain.setTargetAtTime(0.0001, t + 0.003, tau);
        o.connect(g); g.connect(ut); g.connect(nagelEko);
        o.start(t); o.stop(t + tau * 8 + 0.05);
        pling.push(g);
      });
    }

    // ---------- Fingret ----------
    const centrum = () => [duk.clientWidth / 2, duk.clientHeight / 2];
    const Rpx = () => duk.clientWidth * 0.36;
    let gnider = false;
    let forraVinkel = null;
    let vinkelFart = 0, gnidFart = 0;
    let fingerVinkel = 0;
    let slag = { x: 0, y: 0, t: 99, s: 0 };
    fingrar(duk, {
      ner: (x, y) => {
        const [cx, cy] = centrum();
        const d = Math.hypot(x - cx, y - cy);
        gnider = Math.abs(d - Rpx()) < Rpx() * 0.25;
        forraVinkel = Math.atan2(cy - y, x - cx);
        // Skålen plingar till kort så fort hon nuddar den, så att det hörs vad det är.
        // Tydligast på kanten, och lite mjukare inne i vattnet.
        if (d < Rpx() * 1.25) {
          const s = duk.clientWidth;
          slag = { x: (x - cx) / s, y: (cy - y) / s, t: 0, s: 0.35 };
          fingerNere = true;
          nagel(d > Rpx() * 0.8 ? 1 : 0.7);
        }
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
      upp: () => {
        gnider = false;
        forraVinkel = null;
        fingerNere = false;
      },
    }, { ett: true });

    // ---------- Det dansande vattnet ----------
    // Sjunger skålen starkt i några sekunder börjar vattnet dansa, och droppar hoppar upp
    // från de fyra ställen vid kanten där väggen svänger mest
    const DROPP = 16;
    const dropp = Array.from({ length: DROPP }, () => ({ t: 0, T: 0 }));
    const droppData = new Float32Array(DROPP * 4);
    let dans = 0, droppAck = 0;
    function hoppa() {
      const d = dropp.find((q) => q.t >= q.T);
      if (!d) return;
      // Runt hela kanten, med en svag tyngdpunkt vid de fyra ställen där väggen svänger mest
      const v = Math.floor(Math.random() * 4) * Math.PI / 2 + (Math.random() + Math.random() - 1) * 1.3;
      const r0 = 0.305 - slump(0.006, 0.016);
      const inat = slump(0.012, 0.05), sida = slump(-0.015, 0.015);
      Object.assign(d, {
        x: Math.cos(v) * r0, y: Math.sin(v) * r0,
        vx: -Math.cos(v) * inat - Math.sin(v) * sida, vy: -Math.sin(v) * inat + Math.cos(v) * sida,
        hmax: slump(0.008, 0.03), t: 0, T: slump(0.28, 0.55),
      });
    }
    function dansa(dt) {
      dans = klamp(dans + (sang > 0.72 ? dt / 4 : -dt / 1.5), 0, 1);
      droppAck += dt * 22 * dans * dans;
      while (droppAck >= 1) { droppAck -= 1; hoppa(); }
      dropp.forEach((d, i) => {
        if (d.t >= d.T) { droppData[i * 4 + 3] = 0; return; }
        d.t += dt;
        const f = Math.min(1, d.t / d.T);
        droppData.set([d.x + d.vx * f, d.y + d.vy * f, 4 * d.hmax * f * (1 - f), 1 - mjuk(0.85, 1, f)], i * 4);
      });
    }

    // ---------- Ritslinga ----------
    const stoppa = slinga((tid, dt) => {
      // Gnidningen: lagom fart runt kanten bygger upp sången, som en fingertopp mot brons
      // Farten jämnas ut över en kort stund, eftersom skärmen kan rita fler bilder än
      // fingret hinner rapportera rörelser (till exempel 120 Hz-skärmar)
      gnidFart += (vinkelFart / Math.max(dt, 1e-3) - gnidFart) * Math.min(1, dt * 7);
      const fart = gnidFart;
      vinkelFart = 0;
      const lagom = gnider ? mjuk(0.5, 2.5, fart) * (1 - 0.4 * mjuk(8, 14, fart)) : 0;
      sang += (lagom * 1.0 - sang) * Math.min(1, dt * (lagom > sang ? 0.4 : 0.25));
      slag.t += dt;

      const t = ctx.currentTime;
      DELAR.forEach(([, , , gnid], i) => {
        const mal = sang * gnid * NIVA;
        delar[i].gain.setTargetAtTime(mal, t, 0.03);
      });

      const synlig = sang;
      anpassa(gl, duk, 0.75);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_sang, klamp(synlig, 0, 1));
      gl.uniform4f(u.u_slag, slag.x, slag.y, slag.t, slag.s);
      gl.uniform1f(u.u_vinkel, fingerVinkel);
      gl.uniform1f(u.u_synlig, mjuk(0, 2.5, tid));
      dansa(dt);
      gl.uniform1f(u.u_dans, dans);
      gl.uniform4fv(u.u_dropp, droppData);
      ritaHelskarm(gl);
    });

    return stangning({ ljud: l, stoppa, gl, extra: [() => clearTimeout(plingTimer)] });
  },
};
