// Lucka 3: Lavalampan
// Vaxklumpar i en mörk vätska. Vätskan är varm nertill och sval upptill, och vaxet
// närmar sig vätskans temperatur långsamt (termisk tröghet). En klump som värms i
// botten stiger, hinner skjuta över mot toppen innan den svalnar, och sjunker sedan
// tillbaka. Varje klump har sin egen tröghet och därför sin egen rytm.
// I botten ligger en pöl av vax. Klumpar som stiger ur den drar ut en hals som brister,
// och klumpar som sjunker flyter ihop med den. Fingret värmer vaxet där det ligger.
// Lutar man telefonen stiger vaxet fortfarande uppåt i världen.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, slappGL, utanGL } from '../lib/gl.js';
import { ljud, brusKalla, sov } from '../lib/ljud.js';
import { lyssnaLutning } from '../lib/rorelse.js';

const KLUMPAR = 6;
const DELAR = 3;         // kulor per klump, ger droppform och svans
const POL = 8;           // kulor i pölen i botten
const N = KLUMPAR * DELAR + POL;
const DRAG = 0.09;       // vätskans motstånd
const LYFT = 0.05;       // hur starkt varmt vax vill uppåt
const TOPP_T = 0.15;     // vätskans temperatur högst upp
const BOTTEN_T = 1.1;    // vätskans temperatur vid lampan
const DIMNING = 10 * 60; // sekunder tills lampan har dämpats lite
// Snabbspolning för att prova, till exempel ?fart=4
const TIDSSKALA = Math.min(8, Number(new URLSearchParams(location.search).get('fart')) || 1);

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform vec4 u_vax[${N}];  // x, y (y uppåt, kortsidan = 1), radie, temperatur
uniform vec3 u_finger;
uniform float u_tid;
uniform float u_ljus;
uniform float u_synlig;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

const float TROSKEL = 0.32;

void main() {
  float s = min(u_res.x, u_res.y);
  vec2 p = gl_FragCoord.xy / s;
  vec2 uv = gl_FragCoord.xy / u_res;

  // Metabollar: varje kula bidrar till ett fält, vaxet är där fältet är starkt
  float F = 0.0;
  vec2 grad = vec2(0.0);
  float Tsum = 0.0;
  for (int i = 0; i < ${N}; i++) {
    vec4 v = u_vax[i];
    float R = v.z * 2.0;
    vec2 d = p - v.xy;
    float q = dot(d, d) / (R * R);
    if (q >= 1.0) continue;
    float k = 1.0 - q;
    float f = k * k * k;
    F += f;
    grad += -6.0 * k * k * d / (R * R);
    Tsum += f * v.w;
  }
  float T = Tsum / max(F, 1e-4);

  vec3 kall = vec3(0.92, 0.32, 0.24);
  vec3 varm = vec3(1.00, 0.64, 0.28);
  vec3 vaxFarg = mix(kall, varm, smoothstep(0.25, 0.85, T));

  // Vätskan: djupt blåviolett, med en varm glöd nere vid lampan
  vec3 topp = vec3(0.028, 0.022, 0.075);
  vec3 botten = vec3(0.17, 0.065, 0.22);
  vec3 c = mix(botten, topp, smoothstep(0.0, 0.85, uv.y));
  c += vec3(0.95, 0.42, 0.22) * exp(-pow(uv.y * 4.5, 2.0)) * 0.2 * (0.6 + 0.4 * cos((uv.x - 0.5) * 3.0));
  c += vaxFarg * smoothstep(0.08, TROSKEL, F) * 0.05;
  c *= u_ljus;

  // Vaxet: mjukt lyst underifrån, ljusast där det är tjockt, med en svag glans
  float kant = fwidth(F);
  float inne = smoothstep(TROSKEL - kant, TROSKEL + kant, F);
  vec3 n = normalize(vec3(-grad * 0.06, 1.0));
  float tjock = smoothstep(TROSKEL, TROSKEL + 0.8, F);
  float lyst = max(dot(n, normalize(vec3(0.0, -0.6, 0.8))), 0.0);
  float naraLampan = exp(-p.y * 0.8);
  vec3 vax = vaxFarg * (0.58 + 0.34 * tjock) * (0.72 + 0.42 * lyst) * (0.68 + 0.45 * naraLampan);
  vax *= 0.86 + 0.14 * n.z;
  vax += vec3(1.0, 0.9, 0.8) * pow(max(dot(n, normalize(vec3(-0.4, 0.5, 0.77))), 0.0), 26.0) * 0.16;
  c = mix(c, vax * u_ljus, inne);

  // Fingrets värme syns som ett svagt sken
  float fd = length(p - u_finger.xy);
  c += varm * exp(-fd * fd * 40.0) * 0.07 * u_finger.z;

  // Glaset: mörkare mot kanterna som en cylinder, och ett par stråk av reflex
  float cyl = sin(uv.x * 3.14159);
  c *= 0.5 + 0.5 * pow(cyl, 0.6);
  float strak = exp(-pow((uv.x - 0.17) / 0.018, 2.0)) * 0.06 + exp(-pow((uv.x - 0.86) / 0.01, 2.0)) * 0.025;
  c += vec3(1.0, 0.92, 0.88) * strak * (0.4 + 0.6 * uv.y);

  c *= u_synlig;
  c += (hash(gl_FragCoord.xy + fract(u_tid) * 61.0) - 0.5) * (2.0 / 255.0);
  frag = vec4(c, 1.0);
}`;

const slump = (a, b) => a + Math.random() * (b - a);
const mjuk = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, ['u_res', 'u_vax', 'u_finger', 'u_tid', 'u_ljus', 'u_synlig']);

    // ---------- Världen ----------
    // Kortsidan är 1 enhet, y uppåt, origo nere till vänster.
    const varld = () => {
      const s = Math.min(duk.clientWidth, duk.clientHeight);
      return { s, B: duk.clientWidth / s, H: duk.clientHeight / s };
    };
    let { B, H } = varld();

    // Klumparna. Större klumpar har mer tröghet och rör sig i långsammare takt.
    // Två klumpar är redan på väg, resten ligger i pölen och väntar på värmen.
    const klumpar = [];
    for (let i = 0; i < KLUMPAR; i++) {
      const r = slump(0.065, 0.13);
      const iRorelse = i < 2;
      klumpar.push({
        x: slump(0.2, B - 0.2),
        y: iRorelse ? slump(0.5, H - 0.5) : r * 0.3,
        vx: 0,
        vy: iRorelse ? (i === 0 ? 0.12 : -0.1) : 0,
        r,
        T: iRorelse ? (i === 0 ? 0.75 : 0.3) : slump(0.2, 0.45),
        troghet: 12 + r * 190 + slump(-4, 4),
        fas: slump(0, 100),
        iPol: !iRorelse,
      });
    }

    // Tyngdkraftens riktning på skärmen. Ligger telefonen platt gäller skärmens nederkant.
    let tyngd = { x: 0, y: -1 };
    let malTyngd = { x: 0, y: -1 };
    const slutaLuta = lyssnaLutning((beta, gamma) => {
      const b = (beta * Math.PI) / 180, g = (gamma * Math.PI) / 180;
      const gx = Math.cos(b) * Math.sin(g), gy = -Math.sin(b);
      const m = Math.hypot(gx, gy);
      const v = mjuk(0.15, 0.45, m);
      const nx = m > 1e-6 ? gx / m : 0, ny = m > 1e-6 ? gy / m : -1;
      const x = nx * v, y = ny * v - (1 - v);
      const l = Math.hypot(x, y) || 1;
      malTyngd = { x: x / l, y: y / l };
    });

    const finger = { x: 0, y: 0, s: 0, mal: 0 };
    const flytta = (e) => {
      const { s } = varld();
      finger.x = e.clientX / s;
      finger.y = (duk.clientHeight - e.clientY) / s;
    };
    let nere = false;
    duk.addEventListener('pointerdown', (e) => {
      nere = true; finger.mal = 1; flytta(e);
      try { duk.setPointerCapture(e.pointerId); } catch {}
    });
    duk.addEventListener('pointermove', (e) => { if (nere) flytta(e); });
    const slapp = () => { nere = false; finger.mal = 0; };
    duk.addEventListener('pointerup', slapp);
    duk.addEventListener('pointercancel', slapp);

    // ---------- Fysiken ----------
    function steg(dt, lampa) {
      const gx = tyngd.x, gy = tyngd.y;
      for (const k of klumpar) {
        // Vaxet närmar sig långsamt temperaturen i vätskan där det befinner sig
        const vatska = TOPP_T + (BOTTEN_T - TOPP_T) * Math.max(0, 1 - k.y / H) * lampa;
        k.T += ((vatska - k.T) / k.troghet) * dt;
        if (finger.s > 0.01) {
          const d = Math.hypot(k.x - finger.x, k.y - finger.y);
          if (d < k.r + 0.2) k.T += (1 - k.T) * 0.35 * finger.s * (1 - d / (k.r + 0.2)) * dt;
        }
        const lyft = (k.T - 0.5) * LYFT;
        k.vx -= gx * lyft * dt;
        k.vy -= gy * lyft * dt;
        // En svag, långsam vandring i sidled, som strömmar i vätskan
        k.fas += dt;
        k.vx += Math.sin(k.fas * 0.13) * Math.cos(k.fas * 0.071) * 0.004 * dt;
      }
      // Klumpar som möts glider mjukt isär, men får flyta ihop en stund på vägen
      for (let i = 0; i < KLUMPAR; i++) {
        for (let j = i + 1; j < KLUMPAR; j++) {
          const a = klumpar[i], b = klumpar[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 1e-6;
          const narhet = (a.r + b.r) * 0.9 - d;
          if (narhet <= 0 || (a.iPol && b.iPol)) continue;
          const f = narhet * 0.25;
          a.vx -= (dx / d) * f * dt; a.vy -= (dy / d) * f * dt;
          b.vx += (dx / d) * f * dt; b.vy += (dy / d) * f * dt;
        }
      }
      const damp = Math.exp(-DRAG * dt);
      for (const k of klumpar) {
        k.vx *= damp; k.vy *= damp;
        k.x += k.vx * dt; k.y += k.vy * dt;
        // Botten är pölen, där sjunker klumpen nästan helt in. Taket plattar till den lite.
        if (k.x < k.r) { k.x = k.r; k.vx *= -0.3; }
        if (k.x > B - k.r) { k.x = B - k.r; k.vx *= -0.3; }
        if (k.y < k.r * 0.2) { k.y = k.r * 0.2; k.vy *= -0.1; }
        if (k.y > H - k.r * 0.8) { k.y = H - k.r * 0.8; k.vy *= -0.1; }
      }
    }

    // ---------- Ljud ----------
    const { ctx, master } = ljud();
    const ut = ctx.createGain();
    ut.gain.value = 0;
    ut.connect(master);
    ut.gain.setTargetAtTime(1.2, ctx.currentTime, 1.5);
    const kallor = [];

    // Dovt sus, som att höra vätskan inifrån
    const sus = brusKalla('rosa');
    const susFilter = ctx.createBiquadFilter();
    susFilter.type = 'lowpass';
    susFilter.frequency.value = 240;
    susFilter.Q.value = 0.5;
    const susGain = ctx.createGain();
    susGain.gain.value = 0.11;
    const susLfo = ctx.createOscillator();
    susLfo.frequency.value = 0.045;
    const susDjup = ctx.createGain();
    susDjup.gain.value = 60;
    susLfo.connect(susDjup).connect(susFilter.frequency);
    sus.connect(susFilter).connect(susGain).connect(ut);
    susLfo.start();
    kallor.push(sus, susLfo);

    // Ett mjukt blubb när en klump lossnar från pölen eller flyter ihop med den
    let senastBlubb = 0;
    function blubb(uppat) {
      const nu = performance.now();
      if (nu - senastBlubb < 1500) return;
      senastBlubb = nu;
      const t = ctx.currentTime;
      const f0 = uppat ? slump(210, 260) : slump(150, 190);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * 1.5, t + 0.14);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.045, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(lp).connect(g).connect(ut);
      o.start(t);
      o.stop(t + 0.35);
    }

    // ---------- Ritslinga ----------
    const t0 = performance.now();
    let forra = t0;
    let ack = 0;
    let raf = 0;
    let stoppad = false;
    const data = new Float32Array(N * 4);

    function packa(tid) {
      let i = 0;
      const satt = (x, y, r, T) => {
        data[i * 4] = x; data[i * 4 + 1] = y; data[i * 4 + 2] = r; data[i * 4 + 3] = T;
        i++;
      };
      for (const k of klumpar) {
        // Droppform: rund topp och en svans bakom rörelsen som sträcks ut med farten
        const fart = Math.hypot(k.vx, k.vy);
        const dx = fart > 1e-4 ? k.vx / fart : 0, dy = fart > 1e-4 ? k.vy / fart : 1;
        const strack = mjuk(0, 0.25, fart);
        const gung = Math.sin(tid * 0.6 + k.fas) * k.r * 0.12;
        satt(k.x, k.y, k.r, k.T);
        satt(k.x - dx * k.r * (0.35 + 0.6 * strack) - dy * gung, k.y - dy * k.r * (0.35 + 0.6 * strack) + dx * gung,
          k.r * 0.72, k.T);
        satt(k.x - dx * k.r * (0.6 + 1.1 * strack) + dy * gung, k.y - dy * k.r * (0.6 + 1.1 * strack) - dx * gung,
          k.r * 0.45, k.T);
      }
      // Pölen i botten gungar långsamt
      for (let p = 0; p < POL; p++) {
        const x = ((p + 0.5) * B) / POL + Math.sin(tid * 0.11 + p * 1.7) * 0.02;
        const y = 0.01 + Math.sin(tid * 0.17 + p * 2.3) * 0.014;
        satt(x, y, (B / POL) * 1.05, 0.85);
      }
    }

    function rita(nu) {
      if (stoppad) return;
      const tid = ((nu - t0) / 1000) * TIDSSKALA;
      ({ B, H } = varld());

      tyngd.x += (malTyngd.x - tyngd.x) * 0.05;
      tyngd.y += (malTyngd.y - tyngd.y) * 0.05;
      const l = Math.hypot(tyngd.x, tyngd.y) || 1;
      tyngd.x /= l; tyngd.y /= l;
      finger.s += (finger.mal - finger.s) * 0.06;

      // Lampan värms upp de första sekunderna och dämpas långsamt efter en lång stund
      const lampa = mjuk(0, 8, tid) * (1 - 0.3 * mjuk(0, DIMNING, tid));
      ack += Math.min(0.1, (nu - forra) / 1000) * TIDSSKALA;
      forra = nu;
      let n = 0;
      while (ack >= 1 / 120 && n < 12 * TIDSSKALA) { steg(1 / 120, lampa); ack -= 1 / 120; n++; }
      if (n >= 12 * TIDSSKALA) ack = 0;

      // Blubb när en klump lossnar från pölen eller sjunker ner i den
      for (const k of klumpar) {
        const iPol = k.y < k.r * 1.1;
        if (iPol !== k.iPol && tid > 4) blubb(!iPol);
        k.iPol = iPol;
      }

      packa(tid);
      anpassa(gl, duk, 0.75);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform4fv(u.u_vax, data);
      gl.uniform3f(u.u_finger, finger.x, finger.y, finger.s);
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_ljus, 0.75 + 0.25 * lampa);
      gl.uniform1f(u.u_synlig, mjuk(0, 3, tid));
      ritaHelskarm(gl);
      raf = requestAnimationFrame(rita);
    }
    raf = requestAnimationFrame(rita);

    return async () => {
      ut.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      await sov(1300);
      stoppad = true;
      cancelAnimationFrame(raf);
      slutaLuta();
      kallor.forEach((k) => { try { k.stop(); } catch {} });
      ut.disconnect();
      slappGL(gl);
    };
  },
};
