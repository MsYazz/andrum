// Lucka 11: Garnnystanet
// Ett nystan av mjuk ull på ett varmt trägolv i lampljus. En bit tråd ligger redan ute.
// Hon tar tag och drar, och tråden rullas av medan nystanet snurrar. Släpper hon lindas
// tråden efter en stund sakta upp igen och ringlar sig tillbaka in i nystanet.
// Tråden är en kedja av punkter (Verlet) med friktion mot golvet. Nystanet är ett klot
// med lindade trådvarv åt olika håll, som vrids när tråden rullas av eller upp.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { brusKalla } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { mjuk, slump, rumsLjud, slinga, fastaSteg, fingrar, stangning, brusstot } from '../lib/scen.js';

const L = 7;            // länkens längd i css-pixlar
const MAX = 420;        // längsta tråden
const UPP_FART = 45;    // pixlar per sekund när tråden lindas upp

const FARGER = [
  [0.83, 0.64, 0.24], [0.72, 0.36, 0.22], [0.56, 0.66, 0.51],
  [0.79, 0.56, 0.56], [0.91, 0.86, 0.75], [0.54, 0.35, 0.48],
];

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform vec3 u_boll;      // x, y (pixlar, y uppåt), radie
uniform mat3 u_vrid;
uniform vec3 u_farg;
uniform float u_tid;
uniform float u_synlig;
${BRUS}

void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 uv = px / u_res;
  float s = u_res.x;
  // Trägolv med långa plankor och ett varmt lampljus
  vec2 g = px / s;
  float planka = floor(g.x * 5.0);
  float ad = fbm(vec2(g.x * 40.0 + planka * 7.0, g.y * 2.5 + planka * 3.0)) * 0.7 + brus(vec2(g.x * 120.0, g.y * 6.0)) * 0.3;
  vec3 tra = mix(vec3(0.30, 0.18, 0.10), vec3(0.50, 0.32, 0.18), ad) * (0.85 + 0.25 * hash(vec2(planka, 2.0)));
  tra *= 1.0 - 0.5 * smoothstep(0.004, 0.0, abs(fract(g.x * 5.0) - 0.002));
  float lampa = exp(-dot(uv - vec2(0.42, 0.6), uv - vec2(0.42, 0.6)) * 2.2);
  vec3 c = tra * (0.35 + 0.9 * lampa);

  // Skugga under nystanet
  vec2 d = px - u_boll.xy;
  float r = u_boll.z;
  vec2 sd = d - vec2(r * 0.18, -r * 0.22);
  c *= 1.0 - 0.45 * smoothstep(r * 1.25, r * 0.6, length(sd * vec2(1.0, 1.1)));

  // Nystanet
  float dl = length(d) / r;
  // Ullens ludd i kanten
  float ludd = brus(vec2(atan(d.y, d.x) * 30.0, u_tid * 0.2)) * 0.05;
  if (dl < 1.0 + ludd) {
    float z = sqrt(max(0.0, 1.0 - dl * dl));
    vec3 n = normalize(vec3(d / r, z));
    vec3 m = u_vrid * n;
    // Trådvarv lindade runt tre axlar som korsar varandra, med mjuka övergångar
    float tub = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec3 axel = normalize(vec3(sin(fi * 2.1 + 0.4), cos(fi * 1.7 + 0.9), sin(fi * 3.3 + 1.7)));
      float vikt = smoothstep(0.3, 0.7, fbm3(m.xy * 1.4 + m.z + fi * 5.0));
      float varv = fract(dot(m, axel) * 24.0 + brus(m.xy * 6.0 + fi) * 0.25);
      tub = max(tub, (1.0 - pow(abs(varv - 0.5) * 2.0, 2.0)) * (0.55 + 0.45 * vikt));
    }
    vec3 L = normalize(vec3(-0.45, 0.6, 0.65));
    float lj = max(dot(n, L), 0.0);
    vec3 ull = u_farg * (0.55 + 0.45 * tub) * (0.3 + 0.85 * lj);
    ull *= 0.92 + 0.12 * brus(px * 0.7);
    // Ludd som fångar ljuset i kanten
    ull += u_farg * pow(1.0 - z, 3.0) * 0.25 * lj;
    c = mix(c, ull * (0.6 + 0.6 * lampa), smoothstep(1.0 + ludd, 0.97 + ludd, dl));
  }

  c *= 1.0 - 0.35 * pow(length(uv - 0.5) * 1.3, 2.5);
  c *= u_synlig;
  frag = vec4(dither(c, px, u_tid), 1.0);
}`;

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, ['u_res', 'u_boll', 'u_vrid', 'u_farg', 'u_tid', 'u_synlig']);

    // Tråden ritas på en egen yta ovanpå
    const tradDuk = document.createElement('canvas');
    tradDuk.className = 'lucka-ui';
    tradDuk.style.cssText = 'left:0;top:0;width:100%;height:100%;pointer-events:none;';
    scen.append(tradDuk);
    const c2 = tradDuk.getContext('2d');

    const farg = FARGER[Math.floor(Math.random() * FARGER.length)];
    const rgb = (f, k = 1) => `rgb(${Math.round(Math.min(1, f[0] * k) * 255)},${Math.round(Math.min(1, f[1] * k) * 255)},${Math.round(Math.min(1, f[2] * k) * 255)})`;
    gl.uniform3f(u.u_farg, ...farg);

    // ---------- Nystanet och tråden ----------
    const W = () => duk.clientWidth, H = () => duk.clientHeight;
    const hem = { x: W() * 0.5, y: H() * 0.42 };
    const boll = { x: hem.x, y: hem.y, vx: 0, vy: 0, r: W() * 0.16 };
    // Vridningen som en 3x3-matris, uppdaterad med små vridningar
    let vrid = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    function vrida(ax, ay, az, vinkel) {
      const c = Math.cos(vinkel), s = Math.sin(vinkel), t = 1 - c;
      const R = [
        t * ax * ax + c, t * ax * ay - s * az, t * ax * az + s * ay,
        t * ax * ay + s * az, t * ay * ay + c, t * ay * az - s * ax,
        t * ax * az - s * ay, t * ay * az + s * ax, t * az * az + c,
      ];
      const M = vrid, ny = new Array(9);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        ny[i * 3 + j] = M[i * 3] * R[j] + M[i * 3 + 1] * R[3 + j] + M[i * 3 + 2] * R[6 + j];
      }
      vrid = ny;
    }

    // Tråden börjar som en lös slinga på golvet
    const p = [];
    {
      const a0 = slump(0, Math.PI * 2);
      let x = boll.x + Math.cos(a0) * (boll.r + 2), y = boll.y + Math.sin(a0) * (boll.r + 2);
      let rikt = a0 + 0.3;
      for (let i = 0; i < 46; i++) {
        p.push({ x, y, px: x, py: y });
        rikt += Math.sin(i * 0.22) * 0.18 + 0.05;
        x += Math.cos(rikt) * L; y += Math.sin(rikt) * L;
      }
    }

    let greppad = false;
    const finger = { x: 0, y: 0 };
    let stilla = 0;
    let avrullat = 0;   // pixlar tråd som rullats av eller upp den här bildrutan

    function fastpunkt() {
      // Tråden lämnar nystanet där den pekar mot nästa punkt
      const n = p[1] ?? p[0];
      const a = Math.atan2(n.y - boll.y, n.x - boll.x);
      return [boll.x + Math.cos(a) * (boll.r + 1), boll.y + Math.sin(a) * (boll.r + 1), a];
    }

    function fysik(dt) {
      // Punkterna glider med lite fart och bromsas hårt av golvet
      for (let i = 1; i < p.length; i++) {
        const q = p[i];
        const vx = (q.x - q.px) * 0.82, vy = (q.y - q.py) * 0.82;
        q.px = q.x; q.py = q.y;
        q.x += vx; q.y += vy;
      }
      const sist = p[p.length - 1];
      if (greppad) { sist.x = finger.x; sist.y = finger.y; }

      // Rulla av när tråden spänns vid nystanet
      const [fx, fy] = fastpunkt();
      p[0].x = fx; p[0].y = fy;
      if (greppad && p.length < MAX) {
        const direkt = Math.hypot(sist.x - fx, sist.y - fy);
        if (direkt > (p.length - 1) * L * 0.92 || Math.hypot(p[1].x - fx, p[1].y - fy) > L * 1.6) {
          p.splice(1, 0, { x: fx + (p[1].x - fx) * 0.3, y: fy + (p[1].y - fy) * 0.3, px: fx, py: fy });
          avrullat += L;
          // Nystanet snurrar runt en axel tvärs dragriktningen och rullar en aning
          const a = Math.atan2(p[2].y - fy, p[2].x - fx);
          vrida(-Math.sin(a), Math.cos(a), 0, -L / boll.r);
          boll.vx += Math.cos(a) * 6; boll.vy += Math.sin(a) * 6;
        }
      }
      // Lindas upp av sig själv när ingen håller i tråden
      if (!greppad && stilla > 1.5 && p.length > 3) {
        const q = p[1];
        const d = Math.hypot(q.x - fx, q.y - fy);
        const drag = UPP_FART * dt;
        if (d < drag + 1) {
          p.splice(1, 1);
          avrullat -= L;
          const a = Math.atan2((p[1] ?? q).y - fy, (p[1] ?? q).x - fx);
          vrida(-Math.sin(a), Math.cos(a), 0, L / boll.r);
        } else {
          q.x += ((fx - q.x) / d) * drag; q.y += ((fy - q.y) / d) * drag;
        }
      }
      // Länkarna håller ihop, och tråden kan inte gå igenom nystanet
      for (let it = 0; it < 8; it++) {
        for (let i = 0; i < p.length - 1; i++) {
          const a = p[i], b = p[i + 1];
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6;
          const f = (d - L) / d;
          const la = i === 0 ? 0 : 0.5, lb = i + 1 === p.length - 1 && greppad ? 0 : 0.5;
          const s = la + lb || 1;
          a.x += dx * f * (la / s); a.y += dy * f * (la / s);
          b.x -= dx * f * (lb / s); b.y -= dy * f * (lb / s);
        }
        const bw = W(), bh = H();
        for (let i = 2; i < p.length; i++) {
          const q = p[i];
          const dx = q.x - boll.x, dy = q.y - boll.y, d = Math.hypot(dx, dy);
          if (d < boll.r + 3) { q.x = boll.x + (dx / d) * (boll.r + 3); q.y = boll.y + (dy / d) * (boll.r + 3); }
          // Tråden stannar på golvet inom skärmen
          q.x = Math.min(bw - 8, Math.max(8, q.x));
          q.y = Math.min(bh - 8, Math.max(8, q.y));
        }
      }
      // Nystanet glider tillbaka mot sin plats
      boll.vx += (hem.x - boll.x) * 2 * dt; boll.vy += (hem.y - boll.y) * 2 * dt;
      boll.vx *= Math.exp(-dt * 4); boll.vy *= Math.exp(-dt * 4);
      boll.x += boll.vx * dt; boll.y += boll.vy * dt;
    }

    // ---------- Fingret ----------
    fingrar(duk, {
      ner: (x, y) => {
        finger.x = x; finger.y = y;
        greppad = true;
        stilla = 0;
        // Ta tag i trådens ände, och flytta den mjukt till fingret
        const sist = p[p.length - 1];
        sist.x = x; sist.y = y;
      },
      drag: (x, y) => { finger.x = x; finger.y = y; stilla = 0; },
      upp: () => { greppad = false; stilla = 0; },
    });

    // ---------- Ljud ----------
    const l = rumsLjud(1.25, 1.5);
    const { ctx, ut } = l;
    const rumston = brusKalla('rosa');
    const rF = ctx.createBiquadFilter(); rF.type = 'lowpass'; rF.frequency.value = 170;
    const rG = ctx.createGain(); rG.gain.value = 0.03;
    rumston.connect(rF).connect(rG).connect(ut);
    const ull = brusKalla('rosa');
    const uF = ctx.createBiquadFilter(); uF.type = 'bandpass'; uF.frequency.value = 750; uF.Q.value = 0.8;
    const uG = ctx.createGain(); uG.gain.value = 0;
    ull.connect(uF).connect(uG).connect(ut);
    l.kallor.push(rumston, ull);

    // ---------- Ritslinga ----------
    const fasta = fastaSteg(1 / 60, 4);
    let rull = 0;
    let knaster = slump(2, 6);
    const stoppa = slinga((tid, dt) => {
      stilla += dt;
      avrullat = 0;
      fasta(dt, fysik);
      rull += (Math.abs(avrullat) / Math.max(dt, 1e-3) - rull) * 0.15;

      const t = ctx.currentTime;
      const r = Math.min(1, rull / 220);
      uG.gain.setTargetAtTime(0.06 * r, t, 0.06);
      uF.frequency.setTargetAtTime(600 + 500 * r, t, 0.1);
      knaster -= dt;
      if (knaster <= 0) {
        brusstot(ctx, ut, { frekvens: slump(1500, 4000), q: 1, styrka: slump(0.02, 0.05), langd: 0.0012, nar: t });
        knaster = slump(0.4, 3);
      }

      // Golvet och nystanet
      const dpr = anpassa(gl, duk, 0.8);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform3f(u.u_boll, boll.x * dpr, (H() - boll.y) * dpr, boll.r * dpr);
      gl.uniformMatrix3fv(u.u_vrid, false, vrid);
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_synlig, mjuk(0, 2.5, tid));
      ritaHelskarm(gl);

      // Tråden: skugga, ull och en ljusare tvinning
      const kdpr = Math.min(window.devicePixelRatio || 1, 2);
      if (tradDuk.width !== Math.round(W() * kdpr)) { tradDuk.width = Math.round(W() * kdpr); tradDuk.height = Math.round(H() * kdpr); }
      c2.setTransform(kdpr, 0, 0, kdpr, 0, 0);
      c2.clearRect(0, 0, W(), H());
      c2.globalAlpha = mjuk(0, 2.5, tid);
      const banan = (dx, dy) => {
        c2.beginPath();
        c2.moveTo(p[0].x + dx, p[0].y + dy);
        for (let i = 1; i < p.length - 1; i++) {
          const mx = (p[i].x + p[i + 1].x) / 2, my = (p[i].y + p[i + 1].y) / 2;
          c2.quadraticCurveTo(p[i].x + dx, p[i].y + dy, mx + dx, my + dy);
        }
        const s = p[p.length - 1];
        c2.lineTo(s.x + dx, s.y + dy);
      };
      c2.lineCap = 'round'; c2.lineJoin = 'round';
      banan(2, 3);
      c2.strokeStyle = 'rgba(0,0,0,0.22)'; c2.lineWidth = 8; c2.setLineDash([]); c2.stroke();
      banan(0, 0);
      c2.strokeStyle = rgb(farg, 0.72); c2.lineWidth = 7.5; c2.stroke();
      c2.strokeStyle = rgb(farg, 0.95); c2.lineWidth = 5; c2.stroke();
      c2.strokeStyle = rgb(farg, 1.06); c2.lineWidth = 2.6; c2.setLineDash([5, 4]); c2.lineDashOffset = -avrullat; c2.stroke();
      c2.setLineDash([]);
      // Den lösa änden
      const s = p[p.length - 1];
      c2.fillStyle = rgb(farg, 0.95);
      c2.beginPath(); c2.arc(s.x, s.y, 4.2, 0, Math.PI * 2); c2.fill();
    });

    return stangning({ ljud: l, stoppa, gl });
  },
};
