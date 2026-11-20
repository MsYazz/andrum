// Lucka 10: Bläckdroppen
// Ett högt glas med klart vatten, sett från sidan. Ett tryck släpper en droppe bläck som
// sjunker och blommar ut i virvlande plymer. Drar hon fingret rör hon om.
// Färgerna växlar mellan indigo, kricka, karmin och ockra, och vattnet klarnar långsamt.
// Vätskan räknas på ett grovt rutnät, och bläcket flyttas med strömmen i dubbel upplösning.
// Bläcket ritas som ljus som tas upp i vattnet, så att färgerna blandas som riktigt bläck.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { brusKalla } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { skapaVatska } from '../lib/vatska.js';
import { mjuk, slump, rumsLjud, slinga, fastaSteg, fingrar, stangning, bubbla, brusstot } from '../lib/scen.js';

const W = 56, H = 112;          // vätskans rutnät
const DW = W * 2, DH = H * 2;   // bläckets rutnät
const YTA = 0.07;               // vattenytans höjd uppifrån, andel av höjden
const TYNGD = 22;               // hur tungt bläcket är
const KLARNAR = 0.011;          // hur fort vattnet klarnar

// Hur mycket av rött, grönt och blått ljus varje bläck tar upp
const BLACK = [
  [0.95, 0.78, 0.25],   // indigo
  [0.95, 0.38, 0.48],   // kricka
  [0.22, 0.92, 0.66],   // karmin
  [0.22, 0.46, 0.95],   // ockra
];

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform sampler2D u_black;
uniform float u_tid;
uniform float u_synlig;
${BRUS}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 tc = vec2(uv.x, 1.0 - uv.y);

  // Ljus bakgrund som lyser genom glaset, ljusast högt upp
  vec3 bak = mix(vec3(0.86, 0.84, 0.80), vec3(0.97, 0.96, 0.93), smoothstep(0.0, 0.9, uv.y));
  bak *= 0.94 + 0.06 * fbm(uv * vec2(2.0, 4.0));

  vec3 c = bak;
  float yta = ${(1 - YTA).toFixed(3)};
  if (uv.y < yta) {
    vec3 a = texture(u_black, tc).rgb;
    // Ljuset som tas upp av bläcket, så att färgerna blandas som riktigt bläck
    vec3 genom = exp(-a * 2.2);
    c = bak * vec3(0.97, 0.99, 1.0) * genom;
    // Lite ljusare kanter där bläcket är tunt
    c += (1.0 - genom) * 0.04;
    // Vattenytan: en tunn ljus linje och en svag menisk
    c = mix(c, vec3(1.0), smoothstep(0.004, 0.0, abs(uv.y - yta + 0.003)) * 0.5);
    c *= 1.0 - smoothstep(0.012, 0.0, yta - uv.y) * 0.08;
  } else {
    c *= 0.98;
  }

  // Glaset: mörkare mot kanterna och ett par smala reflexer
  float kant = min(uv.x, 1.0 - uv.x);
  c *= 0.78 + 0.22 * smoothstep(0.0, 0.09, kant);
  c += vec3(1.0) * exp(-pow((uv.x - 0.07) / 0.008, 2.0)) * 0.25;
  c += vec3(1.0) * exp(-pow((uv.x - 0.92) / 0.004, 2.0)) * 0.12;
  // Glasbotten
  c *= 1.0 - smoothstep(0.035, 0.0, uv.y) * 0.35;

  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, u_tid), 1.0);
}`;

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, ['u_res', 'u_black', 'u_tid', 'u_synlig']);

    // ---------- Vätskan och bläcket ----------
    const vatska = skapaVatska(W, H, { iterationer: 22, stangd: true });
    const { u: vu, v: vv } = vatska;
    const ND = DW * DH;
    const ar = new Float32Array(ND), ag = new Float32Array(ND), ab = new Float32Array(ND);
    const br = new Float32Array(ND), bg = new Float32Array(ND), bb = new Float32Array(ND);
    const ytRad = Math.ceil(YTA * DH);

    function steg(dt) {
      // Bläcket är tyngre än vattnet och drar strömmen med sig nedåt
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const j = (y * 2) * DW + x * 2;
        const tathet = (ar[j] + ag[j] + ab[j] + ar[j + 1] + ag[j + 1] + ab[j + 1]) / 6;
        vv[y * W + x] += TYNGD * tathet * dt;
      }
      vatska.steg(dt, { virvlar: 0.9 });
      // Strömmen i bläckets upplösning
      for (let y = 0; y < DH; y++) for (let x = 0; x < DW; x++) {
        const i = y * DW + x;
        VX[i] = vatska.las(vu, x * 0.5, y * 0.5) * 2;
        VY[i] = vatska.las(vv, x * 0.5, y * 0.5) * 2;
      }
      const d = Math.exp(-dt * KLARNAR);
      flyttaBlack(ar, br, dt, d);
      flyttaBlack(ag, bg, dt, d);
      flyttaBlack(ab, bb, dt, d);
    }

    // Flytta bläcket med strömmen, framåt och bakåt, och rätta felet (MacCormack).
    // Det håller trådarna i bläcket skarpa i stället för att sudda ut dem.
    const VX = new Float32Array(ND), VY = new Float32Array(ND);
    const t1 = new Float32Array(ND), t2 = new Float32Array(ND), mn = new Float32Array(ND), mx = new Float32Array(ND);
    function flytta(ut, inn, dt, s, grans) {
      for (let y = ytRad; y < DH; y++) for (let x = 0; x < DW; x++) {
        const i = y * DW + x;
        let sx = x - s * VX[i] * dt, sy = y - s * VY[i] * dt;
        sx = Math.max(0, Math.min(DW - 1.001, sx));
        sy = Math.max(ytRad, Math.min(DH - 1.001, sy));
        const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0, j = y0 * DW + x0;
        const a = inn[j], b = inn[j + 1], c = inn[j + DW], e = inn[j + DW + 1];
        ut[i] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy;
        if (grans) { mn[i] = Math.min(a, b, c, e); mx[i] = Math.max(a, b, c, e); }
      }
    }
    function flyttaBlack(f, tmp, dt, d) {
      flytta(t1, f, dt, 1, true);
      flytta(t2, t1, dt, -1, false);
      for (let i = ytRad * DW; i < ND; i++) {
        const r = t1[i] + 0.5 * (f[i] - t2[i]);
        tmp[i] = Math.min(mx[i], Math.max(mn[i], r)) * d;
      }
      f.set(tmp);
    }

    let fargNr = Math.floor(Math.random() * BLACK.length);
    function droppe(x, y) {
      const farg = BLACK[fargNr];
      fargNr = (fargNr + 1 + Math.floor(Math.random() * 2)) % BLACK.length;
      const cx = x * DW, cy = Math.max(ytRad + 4, y * DH);
      const R = 3.2;
      for (let yy = Math.max(ytRad, Math.floor(cy - R * 3)); yy < Math.min(DH, cy + R * 3); yy++) {
        for (let xx = Math.max(0, Math.floor(cx - R * 3)); xx < Math.min(DW, cx + R * 3); xx++) {
          const g = Math.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (R * R)) * 4.5;
          const i = yy * DW + xx;
          ar[i] += farg[0] * g; ag[i] += farg[1] * g; ab[i] += farg[2] * g;
        }
      }
      // Droppen kommer med lite fart nedåt
      const vx0 = Math.round(cx / 2), vy0 = Math.round(cy / 2);
      for (let yy = vy0 - 2; yy <= vy0 + 2; yy++) for (let xx = vx0 - 2; xx <= vx0 + 2; xx++) {
        if (xx > 0 && xx < W - 1 && yy > 0 && yy < H - 1) vv[yy * W + xx] += 28;
      }
    }

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const texData = new Float32Array(ND * 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, DW, DH, 0, gl.RGBA, gl.FLOAT, texData);
    gl.uniform1i(u.u_black, 0);

    // ---------- Ljud ----------
    const l = rumsLjud(1.25, 1.5);
    const { ctx, ut } = l;
    const sus = brusKalla('rosa');
    const susF = ctx.createBiquadFilter(); susF.type = 'lowpass'; susF.frequency.value = 140;
    const susG = ctx.createGain(); susG.gain.value = 0.035;
    sus.connect(susF).connect(susG).connect(ut);
    const rora = brusKalla('rosa');
    const roF = ctx.createBiquadFilter(); roF.type = 'bandpass'; roF.frequency.value = 600; roF.Q.value = 0.6;
    const roG = ctx.createGain(); roG.gain.value = 0;
    rora.connect(roF).connect(roG).connect(ut);
    l.kallor.push(sus, rora);

    function plopp() {
      const t = ctx.currentTime;
      bubbla(ctx, ut, slump(170, 240), 0.07, t);
      bubbla(ctx, ut, slump(500, 800), 0.02, t + slump(0.04, 0.09));
      brusstot(ctx, ut, { frekvens: 300, q: 1, styrka: 0.2, langd: 0.008, nar: t });
    }

    // ---------- Fingret ----------
    // Varje finger minns sin egen förra plats, så att två fingrar kan röra om var för sig
    const forra = new Map();
    let roFart = 0;
    fingrar(duk, {
      ner: (x, y, id) => { forra.set(id, { x, y, t: performance.now(), rort: false }); },
      drag: (x, y, id) => {
        const f = forra.get(id);
        if (!f) return;
        const nu = performance.now();
        const dx = x - f.x, dy = y - f.y;
        const dt = Math.max(8, nu - f.t) / 1000;
        if (Math.hypot(dx, dy) > 4) f.rort = true;
        // Rör om: strömmen följer fingret
        const gx = (x / duk.clientWidth) * W, gy = (y / duk.clientHeight) * H;
        const fx = (dx / duk.clientWidth) * W / dt, fy = (dy / duk.clientHeight) * H / dt;
        for (let yy = Math.floor(gy - 3); yy <= gy + 3; yy++) for (let xx = Math.floor(gx - 3); xx <= gx + 3; xx++) {
          if (xx < 1 || xx >= W - 1 || yy < 1 || yy >= H - 1) continue;
          const w = Math.exp(-((xx - gx) ** 2 + (yy - gy) ** 2) / 4) * 0.2;
          vu[yy * W + xx] += (fx - vu[yy * W + xx]) * w;
          vv[yy * W + xx] += (fy - vv[yy * W + xx]) * w;
        }
        roFart = Math.min(1, roFart + Math.hypot(dx, dy) * 0.01);
        forra.set(id, { x, y, t: nu, rort: f.rort });
      },
      upp: (x, y, id) => {
        const f = forra.get(id);
        if (f && !f.rort) { droppe(x / duk.clientWidth, y / duk.clientHeight); plopp(); }
        forra.delete(id);
      },
    });

    // ---------- Ritslinga ----------
    const fysik = fastaSteg(1 / 40, 3);
    let forsta = true;
    const stoppa = slinga((tid, dt) => {
      // En första droppe av sig själv, så att glaset inte är tomt
      if (forsta && tid > 1.2) { droppe(slump(0.4, 0.6), YTA + 0.03); plopp(); forsta = false; }
      fysik(dt, steg);
      roFart *= Math.exp(-dt * 3);
      roG.gain.setTargetAtTime(0.035 * roFart, ctx.currentTime, 0.08);

      for (let i = 0; i < ND; i++) {
        texData[i * 4] = ar[i]; texData[i * 4 + 1] = ag[i]; texData[i * 4 + 2] = ab[i];
      }
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, DW, DH, gl.RGBA, gl.FLOAT, texData);
      anpassa(gl, duk, 0.75);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_synlig, mjuk(0, 2.5, tid));
      ritaHelskarm(gl);
    });

    return stangning({ ljud: l, stoppa, gl });
  },
};
