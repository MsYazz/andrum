// Lucka 2: Sandlådan
// En zenträdgård sedd uppifrån. Fingret drar en kratta med fem pinnar.
// Sanden är ett höjdfält som belyses av en låg sol. Branta kanter rasar mjukt.
// Stenarna slumpas fram varje gång man kliver in i rummet.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, slappGL, utanGL } from '../lib/gl.js';
import { ljud, brusKalla, sov } from '../lib/ljud.js';
import { skapaMatta } from '../lib/inspelning.js';

const CELL = 2;          // css-pixlar per sandcell
const BAS = 0.5;         // sandens grundhöjd
const A = 0.1;           // räfflornas djup
const AVST = 7;          // avstånd mellan krattans pinnar, i celler
const PINNAR = 5;
const HALV = (AVST * PINNAR) / 2;
const SLAP = 9;          // hur långt krattans huvud släpar efter fingret, i celler
const RASVINKEL = 0.085; // brantare än så rasar sanden
const VARV = Math.PI * 2;
const KVALL = 12 * 60;   // sekunder tills solen står lågt
const MAX_STENAR = 5;

const STENFARGER = [
  [0.24, 0.24, 0.25], // basalt
  [0.44, 0.41, 0.37], // granit
  [0.31, 0.34, 0.37], // skiffer
  [0.41, 0.31, 0.25], // rostig
  [0.57, 0.54, 0.49], // ljus kalksten
  [0.30, 0.32, 0.27], // grönaktig
];

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform sampler2D u_h;
uniform vec2 u_res;
uniform vec2 u_rut;
uniform vec4 u_sten[5];   // x, y, radie, frö
uniform vec4 u_form[5];   // förlängning, vinkel, h3, h5
uniform vec4 u_farg[5];   // r, g, b, platthet
uniform int u_antal;
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

// Ungefärligt avstånd till stenens kant i celler (negativt inuti).
// Samma formel finns i JavaScript, så att krattan och ritningen är överens.
float stenKant(int i, vec2 g, out vec2 lq, out float rad) {
  vec4 s = u_sten[i];
  vec4 f = u_form[i];
  vec2 d = g - s.xy;
  float c = cos(-f.y), si = sin(-f.y);
  vec2 l = vec2(d.x * c - d.y * si, d.x * si + d.y * c);
  l.x /= f.x;
  float a = atan(l.y, l.x);
  rad = s.z * (1.0 + f.z * sin(3.0 * a + s.w) + f.w * sin(5.0 * a + 2.3 * s.w));
  lq = l;
  float ca = cos(a), sa = sin(a);
  return (length(l) - rad) * sqrt(f.x * f.x * ca * ca + sa * sa);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 tc = vec2(uv.x, 1.0 - uv.y);
  vec2 g = tc * u_rut;
  vec2 e = 1.0 / u_rut;

  float h = hojd(tc);
  float hx = hojd(tc + vec2(e.x, 0.0)) - hojd(tc - vec2(e.x, 0.0));
  float hy = hojd(tc + vec2(0.0, e.y)) - hojd(tc - vec2(0.0, e.y));

  vec2 px = floor(gl_FragCoord.xy);
  float k1 = hash(px);
  float k2 = hash(px + 17.0);
  vec3 n = normalize(vec3(-hx * 3.4 + (k1 - 0.5) * 0.09, hy * 3.4 + (k2 - 0.5) * 0.09, 1.0));

  vec3 L = normalize(vec3(-0.55, 0.55, 0.5));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  vec3 sol = mix(vec3(1.0, 0.95, 0.88), vec3(1.0, 0.78, 0.58), u_kvall);
  vec3 himmel = mix(vec3(0.55, 0.60, 0.74), vec3(0.42, 0.40, 0.58), u_kvall);

  vec3 sand = vec3(0.96, 0.87, 0.73) * (0.95 + 0.09 * k1);
  sand *= 0.95 + 0.07 * brus(g * 0.045);
  float dif = max(dot(n, L), 0.0);

  vec2 motLjus = normalize(vec2(L.x, -L.y));
  float skugga = 1.0;
  float narhet = 0.0;
  float paSten = 0.0;
  vec3 stenFarg = vec3(0.0);

  for (int i = 0; i < 5; i++) {
    if (i >= u_antal) break;
    vec4 s = u_sten[i];
    vec4 f = u_form[i];
    vec4 fa = u_farg[i];

    // Kastad skugga, stenen räknas som en cirkel
    float rs = s.z * (1.0 + f.x) * 0.5;
    vec2 ab = motLjus * rs * 1.3;
    float tt = clamp(dot(s.xy - g, ab) / dot(ab, ab), 0.0, 1.0);
    float sd2 = length(g + ab * tt - s.xy);
    float sk = smoothstep(rs * 0.95 + 3.0 + tt * 5.0, rs * 0.95 - 2.0, sd2) * (1.0 - tt * 0.55);
    skugga = min(skugga, 1.0 - 0.62 * sk);

    float rMax = s.z * f.x * 1.2;
    if (length(g - s.xy) > rMax + 6.0) continue;

    vec2 lq;
    float rad;
    float kant = stenKant(i, g, lq, rad);
    narhet = max(narhet, smoothstep(5.0, 0.0, kant));
    if (kant < 1.0) {
      vec2 q = lq / rad;
      float ql = min(length(q), 1.0);
      float z = sqrt(max(1.0 - ql * ql, 0.0));
      vec2 nl = vec2(q.x / f.x, q.y);
      float c = cos(f.y), si = sin(f.y);
      vec2 ng = vec2(nl.x * c - nl.y * si, nl.x * si + nl.y * c);
      vec3 sn = normalize(vec3(ng.x, -ng.y, z / fa.w));

      float m = brus(g * 0.35 + s.w * 10.0) * 0.6 + brus(g * 1.4 + s.w) * 0.4;
      vec3 bas = fa.rgb * (0.8 + 0.4 * m);
      // Korn i stenen, mer i vissa stenar (granit)
      float kornighet = fract(s.w * 7.31);
      vec2 kc = floor(g * 2.5) + s.w;
      float prick = step(1.0 - kornighet * 0.22, hash(kc));
      bas = mix(bas, bas * (hash(kc + 1.7) > 0.5 ? 1.45 : 0.6), prick);
      // Lite mossa på skuggsidan av en del stenar
      float mossa = step(0.55, fract(s.w * 3.17)) * smoothstep(0.55, 0.8, brus(g * 0.5 + s.w))
                  * smoothstep(0.3, -0.5, sn.x + sn.y);
      bas = mix(bas, vec3(0.32, 0.38, 0.25), mossa * 0.7);

      float ljus = max(dot(sn, L), 0.0);
      float glans = pow(max(dot(sn, H), 0.0), 28.0) * 0.14;
      stenFarg = bas * (sol * ljus * 1.15 + himmel * 0.28) + glans * sol;
      paSten = max(paSten, smoothstep(0.6, -0.9, kant));
    }
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
const slump = (a, b) => a + Math.random() * (b - a);

// Samma formel som stenKant i shadern.
function stenKant(s, x, y) {
  const dx = x - s.x, dy = y - s.y;
  const c = Math.cos(-s.vinkel), si = Math.sin(-s.vinkel);
  const lx = (dx * c - dy * si) / s.lang;
  const ly = dx * si + dy * c;
  const a = Math.atan2(ly, lx);
  const rad = s.r * (1 + s.h3 * Math.sin(3 * a + s.fro) + s.h5 * Math.sin(5 * a + 2.3 * s.fro));
  const ca = Math.cos(a), sa = Math.sin(a);
  return (Math.hypot(lx, ly) - rad) * Math.sqrt(s.lang * s.lang * ca * ca + sa * sa);
}

// Två till fem stenar med olika form, färg och antal ringar. Ringzonerna överlappar aldrig.
function slumpaStenar(W, H) {
  const m = Math.min(W, H);
  const antal = [2, 3, 3, 3, 4, 4, 5][Math.floor(Math.random() * 7)];
  const farger = [...STENFARGER].sort(() => Math.random() - 0.5);
  const ut = [];
  for (let n = 0; n < antal; n++) {
    const stor = n === 0;
    for (let forsok = 0; forsok < 80; forsok++) {
      const r = m * (stor ? slump(0.08, 0.12) : slump(0.03, 0.07));
      const lang = slump(1, stor ? 1.45 : 1.7);
      const ringar = r > m * 0.05 ? 2 + Math.floor(Math.random() * 4) : 2 + Math.floor(Math.random() * 2);
      const rMax = r * lang * 1.2;
      const zon = rMax + 1.5 + AVST * ringar;
      const x = slump(rMax + 6, W - rMax - 6);
      const y = slump(rMax + 6, H - rMax - 6);
      if (x < 36 && y < 42) continue;                          // tillbaka-knappen
      if (y > H - 34 && Math.abs(x - W / 2) < 46) continue;    // släta ut
      if (ut.some((o) => Math.hypot(o.x - x, o.y - y) < o.zon + zon + AVST)) continue;
      const farg = farger[n % farger.length].map((v) => v * slump(0.9, 1.1));
      ut.push({
        x, y, r, lang, ringar, zon, rMax,
        vinkel: slump(0, Math.PI),
        h3: slump(0.02, 0.09),
        h5: slump(0.01, 0.05),
        fro: slump(0, 10),
        farg,
        platt: slump(0.4, 0.8),
      });
      break;
    }
  }
  return ut;
}

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, [
      'u_h', 'u_res', 'u_rut', 'u_sten', 'u_form', 'u_farg', 'u_antal', 'u_tid', 'u_kvall', 'u_synlig',
    ]);

    // ---------- Sandens höjdfält ----------
    const W = Math.ceil(duk.clientWidth / CELL), H = Math.ceil(duk.clientHeight / CELL);
    const h = new Float32Array(W * H);
    const mask = new Uint8Array(W * H);
    const stenar = slumpaStenar(W, H);

    // Startmönster: raka linjer, och ringar som följer varje stens form
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let v = BAS - A * Math.cos((VARV * y) / AVST);
        for (const s of stenar) {
          if (Math.hypot(x - s.x, y - s.y) > s.zon + 4) continue;
          const d = stenKant(s, x, y);
          if (d < 0.5) mask[i] = 1;
          const inre = 1.5;
          const yttre = inre + AVST * s.ringar;
          const ring = BAS + A * Math.cos((VARV * (d - inre)) / AVST);
          v += (ring - v) * mjuk(yttre + 2, yttre - 2, d);
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

    const fyll = (f) => {
      const a = new Float32Array(MAX_STENAR * 4);
      stenar.forEach((s, i) => a.set(f(s), i * 4));
      return a;
    };
    gl.uniform1i(u.u_h, 0);
    gl.uniform2f(u.u_rut, W, H);
    gl.uniform1i(u.u_antal, stenar.length);
    gl.uniform4fv(u.u_sten, fyll((s) => [s.x, s.y, s.r, s.fro]));
    gl.uniform4fv(u.u_form, fyll((s) => [s.lang, s.vinkel, s.h3, s.h5]));
    gl.uniform4fv(u.u_farg, fyll((s) => [...s.farg, s.platt]));

    let smutsig = false;
    let rasar = 0;

    // Krattan trycker sanden mot en räfflad profil tvärs rörelseriktningen.
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
          const w = 0.5 * (1 - mjuk(HALV - 1, HALV + 1.5, at)) * (1 - Math.abs(langs) / 1.5);
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

    // Svag ökenvind: en inspelning från den mexikanska öknen, där ett kort missljud
    // hoppas över. Går den inte att ladda räknas vinden fram som förut.
    // Byarna jämnas ut, så att vinden ligger lugnt och jämnt i bakgrunden
    const vindMatta = skapaMatta(ctx, ut, 'ljud/sandlada-vind.mp3', {
      avsnitt: [[0.5, 15.9], [17.0, 72.4]], niva: 0.008, bit: [10, 20], over: 4, hp: 70, tonhojd: 0.02, jamna: 0.65,
    });
    kallor.push(vindMatta);
    vindMatta.klar.catch(framraknadVind);
    function framraknadVind() {
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
    }

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
    // Fingrets punkter jämnas ut till mjuka kurvor (kvadratiska bezier genom mittpunkterna).
    // Krattans huvud släpar efter fingret som i ett snöre, så den svänger som en riktig kratta.
    const pekare = new Map();
    let fart = 0;

    function nyttDrag(x, y, t) {
      return {
        r1x: x, r1y: y, m0x: x, m0y: y,  // senaste råpunkt och senaste mittpunkt
        sx: x, sy: y,                    // startpunkt
        hx: x, hy: y,                    // krattans huvud
        dx: 1, dy: 0, riktad: false,
        fast: false,
        t,
      };
    }

    // Alla pinner sitter på samma tvärslå. Om en pinne tar i en sten fastnar hela
    // krattan där, och den står still resten av draget.
    function steg(p, x, y) {
      if (p.fast) return;
      const nx = -p.dy, ny = p.dx;
      for (const s of stenar) {
        if (Math.hypot(x - s.x, y - s.y) > s.rMax + HALV + AVST) continue;
        for (let k = -2; k <= 2; k++) {
          if (stenKant(s, x + nx * k * AVST, y + ny * k * AVST) < AVST * 0.55) {
            p.fast = true;
            tock();
            return;
          }
        }
      }
      kratta(x, y, p.dx, p.dy);
    }

    // Ett torrt klick när bambukrattan slår i en sten, utan tonhöjd.
    // En kort brusstöt och ett svagare efterklick när krattan studsar till.
    const klickBuffer = (() => {
      const n = Math.floor(ctx.sampleRate * 0.03);
      const b = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.0025));
      return b;
    })();
    function klick(nar, styrka) {
      const k = ctx.createBufferSource();
      k.buffer = klickBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2600 + Math.random() * 900;
      bp.Q.value = 0.9;
      const g = ctx.createGain();
      g.gain.value = styrka;
      k.connect(bp).connect(g).connect(ut);
      k.start(nar);
    }
    function tock() {
      const t = ctx.currentTime;
      klick(t, 0.5);
      klick(t + 0.022 + Math.random() * 0.01, 0.18);
    }

    function stampla(p, x, y) {
      if (!p.riktad) {
        const d = Math.hypot(x - p.sx, y - p.sy);
        if (d < SLAP) return;
        // Nu vet vi riktningen. Kratta i efterhand från startpunkten.
        p.dx = (x - p.sx) / d;
        p.dy = (y - p.sy) / d;
        p.hx = x - p.dx * SLAP;
        p.hy = y - p.dy * SLAP;
        p.riktad = true;
        const n = Math.ceil(d / 0.5);
        for (let k = 0; k <= n; k++) steg(p, p.sx + ((x - p.sx) * k) / n, p.sy + ((y - p.sy) * k) / n);
        return;
      }
      const vx = x - p.hx, vy = y - p.hy;
      const d = Math.hypot(vx, vy);
      if (d < 1e-6) return;
      if (d > SLAP) {
        p.hx = x - (vx / d) * SLAP;
        p.hy = y - (vy / d) * SLAP;
      }
      p.dx = vx / d;
      p.dy = vy / d;
      steg(p, x, y);
    }

    function kurva(p, ax, ay, bx, by, cx, cy) {
      const len = Math.hypot(bx - ax, by - ay) + Math.hypot(cx - bx, cy - by);
      const n = Math.max(1, Math.ceil(len / 0.5));
      for (let i = 1; i <= n; i++) {
        const t = i / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
        stampla(p, a * ax + b * bx + c * cx, a * ay + b * by + c * cy);
      }
    }

    function flytta(p, x, y, t) {
      const steglangd = Math.hypot(x - p.r1x, y - p.r1y);
      if (steglangd < 0.25) return;
      const m1x = (p.r1x + x) / 2, m1y = (p.r1y + y) / 2;
      kurva(p, p.m0x, p.m0y, p.r1x, p.r1y, m1x, m1y);
      const dt = Math.max(8, t - p.t);
      // Skrapljudet hörs bara när krattan faktiskt drar i sanden
      if (!p.fast) fart = Math.max(fart, Math.min(1, (steglangd * CELL) / dt / 1.1));
      p.m0x = m1x; p.m0y = m1y;
      p.r1x = x; p.r1y = y;
      p.t = t;
    }

    duk.addEventListener('pointerdown', (e) => {
      pekare.set(e.pointerId, nyttDrag(e.clientX / CELL, e.clientY / CELL, e.timeStamp));
      try { duk.setPointerCapture(e.pointerId); } catch {}
    });
    duk.addEventListener('pointermove', (e) => {
      const p = pekare.get(e.pointerId);
      if (!p) return;
      const lista = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      for (const h2 of (lista.length ? lista : [e])) flytta(p, h2.clientX / CELL, h2.clientY / CELL, h2.timeStamp);
    });
    const slapp = (e) => {
      const p = pekare.get(e.pointerId);
      if (p) kurva(p, p.m0x, p.m0y, p.r1x, p.r1y, p.r1x, p.r1y);
      pekare.delete(e.pointerId);
    };
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
