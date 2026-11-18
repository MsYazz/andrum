// Lucka 2: Sandlådan
// En zenträdgård sedd uppifrån. Fingret är en kratta med fem pinnar.
// Sanden är ett höjdfält som belyses av en låg sol. Branta kanter rasar mjukt.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, slappGL, utanGL } from '../lib/gl.js';
import { ljud, brusKalla, sov } from '../lib/ljud.js';

const CELL = 2;          // css-pixlar per sandcell
const BAS = 0.5;         // sandens grundhöjd
const A = 0.1;           // räfflornas djup
const AVST = 7;          // avstånd mellan krattans pinnar, i celler
const PINNAR = 5;
const HALV = (AVST * PINNAR) / 2;
const RASVINKEL = 0.085; // brantare än så rasar sanden
const VARV = Math.PI * 2;
const KVALL = 12 * 60;   // sekunder tills solen står lågt

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform sampler2D u_h;
uniform vec2 u_res;
uniform vec2 u_rut;
uniform vec4 u_sten[3];
uniform float u_tid;
uniform float u_kvall;
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
float hojd(vec2 tc) { return texture(u_h, tc).r; }

float stenRadie(vec4 s, vec2 g) {
  vec2 d = g - s.xy;
  float a = atan(d.y, d.x);
  return s.z * (1.0 + 0.07 * sin(3.0 * a + s.w) + 0.04 * sin(5.0 * a + 2.3 * s.w));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 tc = vec2(uv.x, 1.0 - uv.y);
  vec2 g = tc * u_rut;
  vec2 e = 1.0 / u_rut;

  float h = hojd(tc);
  float hx = hojd(tc + vec2(e.x, 0.0)) - hojd(tc - vec2(e.x, 0.0));
  float hy = hojd(tc + vec2(0.0, e.y)) - hojd(tc - vec2(0.0, e.y));

  // Korn: varje pixel lutar lite åt sitt eget håll
  vec2 px = floor(gl_FragCoord.xy);
  float k1 = hash(px);
  float k2 = hash(px + 17.0);
  vec3 n = normalize(vec3(-hx * 3.4 + (k1 - 0.5) * 0.09, hy * 3.4 + (k2 - 0.5) * 0.09, 1.0));

  vec3 L = normalize(vec3(-0.55, 0.55, 0.5));
  vec3 sol = mix(vec3(1.0, 0.95, 0.88), vec3(1.0, 0.78, 0.58), u_kvall);
  vec3 himmel = mix(vec3(0.55, 0.60, 0.74), vec3(0.42, 0.40, 0.58), u_kvall);

  vec3 sand = vec3(0.96, 0.87, 0.73) * (0.95 + 0.09 * k1);
  sand *= 0.95 + 0.07 * brus(g * 0.045);
  float dif = max(dot(n, L), 0.0);

  // Stenar och deras skuggor
  vec2 motLjus = normalize(vec2(L.x, -L.y));
  float skugga = 1.0;
  float narhet = 0.0;
  float paSten = 0.0;
  vec3 stenFarg = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    vec4 s = u_sten[i];
    if (s.z <= 0.0) continue;
    float r = stenRadie(s, g);
    vec2 d = g - s.xy;
    float dl = length(d);
    if (dl < r + 1.0) {
      float z = sqrt(max(r * r - dl * dl, 0.0)) * 0.55;
      vec3 sn = normalize(vec3(d.x, -d.y, z / 0.3025));
      float m = brus(g * 0.35 + s.w * 10.0) * 0.6 + brus(g * 1.4) * 0.4;
      vec3 bas = mix(vec3(0.29, 0.29, 0.28), vec3(0.43, 0.42, 0.39), m);
      float mossa = smoothstep(0.55, 0.8, brus(g * 0.5 + s.w)) * smoothstep(0.3, -0.5, sn.x + sn.y);
      bas = mix(bas, vec3(0.32, 0.37, 0.26), mossa * 0.7);
      float sd = max(dot(sn, L), 0.0);
      vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
      float glans = pow(max(dot(sn, H), 0.0), 28.0) * 0.14;
      stenFarg = bas * (sol * sd * 1.15 + himmel * 0.28) + glans * sol;
      paSten = max(paSten, smoothstep(r, r - 1.3, dl));
    }
    // Kastad skugga åt motsatt håll från solen
    float langd = s.z * 1.3;
    vec2 ab = motLjus * langd;
    float tt = clamp(dot(s.xy - g, ab) / dot(ab, ab), 0.0, 1.0);
    float sd2 = length(g + ab * tt - s.xy);
    float rr = s.z * 0.95;
    float sk = smoothstep(rr + 3.0 + tt * 5.0, rr - 2.0, sd2) * (1.0 - tt * 0.55);
    skugga = min(skugga, 1.0 - 0.62 * sk);
    narhet = max(narhet, smoothstep(r + 5.0, r, dl));
  }

  float ao = clamp(0.88 + 1.3 * (h - 0.5), 0.72, 1.06) * (1.0 - narhet * 0.18);
  vec3 c = sand * (sol * dif * skugga * 1.2 + himmel * 0.3) * ao;

  // Enstaka korn som glimtar till i solen
  vec2 kp = floor(gl_FragCoord.xy * 0.5);
  float glimt = step(0.9972, hash(kp + 3.1)) * smoothstep(0.55, 0.9, dif) * skugga;
  float blink = 0.5 + 0.5 * sin(u_tid * 1.2 + hash(kp) * 40.0);
  c += sol * glimt * blink * 0.3;

  c = mix(c, stenFarg, paSten);

  vec2 q = uv - 0.5;
  c *= 1.0 - dot(q, q) * 0.5;
  c *= mix(1.0, 0.84, u_kvall);
  c *= u_synlig;
  c += (hash(gl_FragCoord.xy + fract(u_tid) * 77.0) - 0.5) * (2.0 / 255.0);
  frag = vec4(c, 1.0);
}`;

const mjuk = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, ['u_h', 'u_res', 'u_rut', 'u_sten', 'u_tid', 'u_kvall', 'u_synlig']);

    // ---------- Sandens höjdfält ----------
    const bredd = duk.clientWidth, hojd = duk.clientHeight;
    const W = Math.ceil(bredd / CELL), H = Math.ceil(hojd / CELL);
    const h = new Float32Array(W * H);
    const mask = new Uint8Array(W * H);
    const m = Math.min(W, H);

    const stenar = bredd < hojd
      ? [
        { x: W * 0.3, y: H * 0.27, r: m * 0.085, f: 1.3 },
        { x: W * 0.7, y: H * 0.58, r: m * 0.06, f: 4.1 },
        { x: W * 0.36, y: H * 0.8, r: m * 0.04, f: 2.7 },
      ]
      : [
        { x: W * 0.26, y: H * 0.42, r: m * 0.12, f: 1.3 },
        { x: W * 0.62, y: H * 0.64, r: m * 0.085, f: 4.1 },
        { x: W * 0.8, y: H * 0.3, r: m * 0.055, f: 2.7 },
      ];

    // Startmönster: raka linjer, och ringar runt varje sten
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let v = BAS - A * Math.cos((VARV * y) / AVST);
        for (const s of stenar) {
          const d = Math.hypot(x - s.x, y - s.y);
          if (d < s.r * 1.12) mask[i] = 1;
          const inre = s.r * 1.15;
          const yttre = inre + AVST * 4;
          if (d < yttre + 2) {
            const ring = BAS + A * Math.cos((VARV * (d - inre)) / AVST);
            v += (ring - v) * mjuk(yttre + 2, yttre - 2, d);
          }
        }
        h[i] = v;
      }
    }

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, W, H, 0, gl.RED, gl.FLOAT, h);

    gl.uniform1i(u.u_h, 0);
    gl.uniform2f(u.u_rut, W, H);
    gl.uniform4fv(u.u_sten, new Float32Array(stenar.flatMap((s) => [s.x, s.y, s.r, s.f])));

    let smutsig = false;
    let rasar = 0;

    // Krattan trycker sanden mot en räfflad profil tvärs rörelseriktningen
    function kratta(px, py, dx, dy) {
      const nx = -dy, ny = dx;
      const R = HALV + 2;
      const x0 = Math.max(0, Math.floor(px - R)), x1 = Math.min(W - 1, Math.ceil(px + R));
      const y0 = Math.max(0, Math.floor(py - R)), y1 = Math.min(H - 1, Math.ceil(py + R));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const rx = x - px, ry = y - py;
          const langs = rx * dx + ry * dy;
          if (langs < -1.5 || langs > 1.5) continue;
          const tvars = rx * nx + ry * ny;
          const at = Math.abs(tvars);
          if (at > HALV + 1.5) continue;
          const i = y * W + x;
          if (mask[i]) continue;
          const w = 0.5 * (1 -mjuk(HALV - 1, HALV + 1.5, at)) * (1 - Math.abs(langs) / 1.5);
          const mal = BAS - A * Math.cos((VARV * tvars) / AVST);
          h[i] += (mal - h[i]) * w;
        }
      }
      smutsig = true;
      rasar = 60;
    }

    // För branta kanter rasar mjukt ihop (sandens rasvinkel)
    function rasa() {
      for (let y = 0; y < H; y++) {
        const rad = y * W;
        for (let x = 0; x < W - 1; x++) {
          const i = rad + x;
          if (mask[i] || mask[i + 1]) continue;
          const d = h[i] - h[i + 1];
          if (d > RASVINKEL) { const f = (d - RASVINKEL) * 0.25; h[i] -= f; h[i + 1] += f; }
          else if (d < -RASVINKEL) { const f = (-d - RASVINKEL) * 0.25; h[i] += f; h[i + 1] -= f; }
        }
      }
      for (let y = 0; y < H - 1; y++) {
        const rad = y * W;
        for (let x = 0; x < W; x++) {
          const i = rad + x, j = i + W;
          if (mask[i] || mask[j]) continue;
          const d = h[i] - h[j];
          if (d > RASVINKEL) { const f = (d - RASVINKEL) * 0.25; h[i] -= f; h[j] += f; }
          else if (d < -RASVINKEL) { const f = (-d - RASVINKEL) * 0.25; h[i] += f; h[j] -= f; }
        }
      }
    }

    // ---------- Ljud ----------
    const { ctx, master } = ljud();
    const ut = ctx.createGain();
    ut.gain.value = 0;
    ut.connect(master);
    ut.gain.setTargetAtTime(1.2, ctx.currentTime, 1.2);
    const kallor = [];

    // Svag vind
    const vind = brusKalla('rosa');
    const vindFilter = ctx.createBiquadFilter();
    vindFilter.type = 'lowpass';
    vindFilter.frequency.value = 380;
    const vindGain = ctx.createGain();
    vindGain.gain.value = 0.045;
    const vindLfo = ctx.createOscillator();
    vindLfo.frequency.value = 0.06;
    const vindDjup = ctx.createGain();
    vindDjup.gain.value = 0.02;
    vindLfo.connect(vindDjup).connect(vindGain.gain);
    const filterLfo = ctx.createOscillator();
    filterLfo.frequency.value = 0.037;
    const filterDjup = ctx.createGain();
    filterDjup.gain.value = 140;
    filterLfo.connect(filterDjup).connect(vindFilter.frequency);
    vind.connect(vindFilter).connect(vindGain).connect(ut);
    vindLfo.start();
    filterLfo.start();
    kallor.push(vind, vindLfo, filterLfo);

    // Krattans skrap: korn genom ett bandpassfilter, plus ett mjukt sus
    const korn = brusKalla('korn');
    const kornFilter = ctx.createBiquadFilter();
    kornFilter.type = 'bandpass';
    kornFilter.frequency.value = 2000;
    kornFilter.Q.value = 0.7;
    const kornHp = ctx.createBiquadFilter();
    kornHp.type = 'highpass';
    kornHp.frequency.value = 500;
    const kornGain = ctx.createGain();
    kornGain.gain.value = 0;
    korn.connect(kornFilter).connect(kornHp).connect(kornGain).connect(ut);
    const hyss = brusKalla('rosa');
    const hyssFilter = ctx.createBiquadFilter();
    hyssFilter.type = 'lowpass';
    hyssFilter.frequency.value = 900;
    const hyssGain = ctx.createGain();
    hyssGain.gain.value = 0;
    hyss.connect(hyssFilter).connect(hyssGain).connect(ut);
    kallor.push(korn, hyss);

    // Brädan som slätar ut
    const sop = brusKalla('korn');
    const sopFilter = ctx.createBiquadFilter();
    sopFilter.type = 'bandpass';
    sopFilter.frequency.value = 1100;
    sopFilter.Q.value = 0.5;
    const sopGain = ctx.createGain();
    sopGain.gain.value = 0;
    sop.connect(sopFilter).connect(sopGain).connect(ut);
    kallor.push(sop);

    // ---------- Fingrar ----------
    const pekare = new Map();
    let fart = 0;

    function tillRut(e) { return [e.clientX / CELL, e.clientY / CELL]; }

    function drag(p, nx, ny, tidpunkt) {
      const vx = nx - p.x, vy = ny - p.y;
      const len = Math.hypot(vx, vy);
      if (len < 0.4) return;
      if (!p.riktad) {
        // Vänta tills fingret rört sig lite, så att krattan vet åt vilket håll den drar
        if (Math.hypot(nx - p.sx, ny - p.sy) < 3) return;
        p.dx = (nx - p.sx) / Math.hypot(nx - p.sx, ny - p.sy);
        p.dy = (ny - p.sy) / Math.hypot(nx - p.sx, ny - p.sy);
        p.riktad = true;
        p.x = p.sx; p.y = p.sy;
      }
      const steg = Math.max(1, Math.ceil(Math.hypot(nx - p.x, ny - p.y) / 0.5));
      const sx = (nx - p.x) / steg, sy = (ny - p.y) / steg;
      const ux = sx / Math.hypot(sx, sy), uy = sy / Math.hypot(sx, sy);
      for (let k = 0; k < steg; k++) {
        // Mjuk sväng, krattan vrider sig inte tvärt
        p.dx = p.dx * 0.9 + ux * 0.1;
        p.dy = p.dy * 0.9 + uy * 0.1;
        const l = Math.hypot(p.dx, p.dy) || 1;
        p.dx /= l; p.dy /= l;
        p.x += sx; p.y += sy;
        kratta(p.x, p.y, p.dx, p.dy);
      }
      const dt = Math.max(8, tidpunkt - p.t);
      fart = Math.max(fart, Math.min(1, (len * CELL) / dt / 1.1));
      p.t = tidpunkt;
    }

    duk.addEventListener('pointerdown', (e) => {
      const [x, y] = tillRut(e);
      pekare.set(e.pointerId, { x, y, sx: x, sy: y, dx: 1, dy: 0, riktad: false, t: e.timeStamp });
      try { duk.setPointerCapture(e.pointerId); } catch {}
    });
    duk.addEventListener('pointermove', (e) => {
      const p = pekare.get(e.pointerId);
      if (!p) return;
      const handelser = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const h2 of (handelser.length ? handelser : [e])) {
        const [x, y] = tillRut(h2);
        drag(p, x, y, h2.timeStamp);
      }
    });
    const slapp = (e) => pekare.delete(e.pointerId);
    duk.addEventListener('pointerup', slapp);
    duk.addEventListener('pointercancel', slapp);

    // ---------- Släta ut ----------
    let sopning = null;
    const knapp = document.createElement('button');
    knapp.className = 'lucka-ui slata';
    knapp.textContent = 'släta ut';
    knapp.addEventListener('click', () => {
      if (sopning) return;
      sopning = { start: performance.now(), y: -15 };
      const t = ctx.currentTime;
      sopGain.gain.cancelScheduledValues(t);
      sopGain.gain.setValueAtTime(sopGain.gain.value, t);
      sopGain.gain.linearRampToValueAtTime(0.16, t + 0.6);
      sopGain.gain.linearRampToValueAtTime(0.11, t + 2.0);
      sopGain.gain.linearRampToValueAtTime(0, t + 2.9);
    });
    scen.append(knapp);

    // Brädan dras uppifrån och ner. Rader som brädan redan passerat slätas klart,
    // även om telefonen hoppar över bildrutor.
    function sopa(nu) {
      const p = Math.min(1, (nu - sopning.start) / 2600);
      const y = p * (H + 30) - 15;
      const fran = Math.max(0, Math.floor(sopning.y - 12));
      const till = Math.min(H, Math.ceil(y + 2));
      for (let r = fran; r < till; r++) {
        const w = r < y - 12 ? 0.92 : 0.45;
        for (let x = 0; x < W; x++) {
          const i = r * W + x;
          if (!mask[i]) h[i] += (BAS - h[i]) * w;
        }
      }
      sopning.y = Math.max(sopning.y, y);
      smutsig = true;
      if (p >= 1) sopning = null;
    }

    // ---------- Ritslinga ----------
    const t0 = performance.now();
    let raf = 0;
    let stoppad = false;

    function rita(nu) {
      if (stoppad) return;
      const tid = (nu - t0) / 1000;

      if (sopning) sopa(nu);
      if (rasar > 0) { rasa(); rasar--; smutsig = true; }
      if (smutsig) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RED, gl.FLOAT, h);
        smutsig = false;
      }

      fart *= 0.86;
      if (fart < 0.002) fart = 0;
      const t = ctx.currentTime;
      kornGain.gain.setTargetAtTime(fart * 0.3, t, 0.04);
      kornFilter.frequency.setTargetAtTime(1500 + 1700 * fart, t, 0.08);
      hyssGain.gain.setTargetAtTime(fart * 0.07, t, 0.06);

      anpassa(gl, duk, 1);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_kvall, mjuk(0, KVALL, tid));
      gl.uniform1f(u.u_synlig, mjuk(0, 2.5, tid));
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
