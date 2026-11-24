// Lucka 19: Vindspelet
// Ett vindspel med sex metallrör, en kläpp och ett segel som hänger från en takbjälke
// mot en skymningshimmel. En svag bris rör det hela tiden lite. Ett svep ger en vindby,
// och att luta telefonen blåser åt det hållet, även mot eller från en. När kläppen slår mot ett rör klingar det,
// och ett tryck på ett rör slår an det direkt.
// Rören och kläppen är pendlar som svänger i två riktningar och stöter mot varandra.
// Klangen har ett metallrörs egna deltoner och rören är stämda pentatoniskt.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { rum } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { lyssnaLutning } from '../lib/rorelse.js';
import { skapaVind } from '../lib/vind.js';
import { skapaMatta } from '../lib/inspelning.js';
import { mjuk, slump, klamp, rumsLjud, slinga, fastaSteg, fingrar, stangning, klang } from '../lib/scen.js';

const ROR = 6;
const TONER = [392.0, 440.0, 523.25, 587.33, 659.25, 783.99];
const DELTONER = [[1, 1, 5.5], [2.756, 0.45, 2.6], [5.404, 0.2, 1.3], [8.933, 0.08, 0.7]];
const RING = 0.155;         // radien där rören sitter, i skärmbredder
const ROR_R = 0.021;
const KLAPP_R = 0.068;
const KLAPP_L = 0.31;       // kläppens avstånd under skivan
const SEGEL_L = 0.52;       // seglets avstånd under skivan

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform vec4 u_ror[${ROR}];    // x, y för fästet, vinkel, längd
uniform vec4 u_ror2[${ROR}];   // djup, klang (ljusare när det ringer), -, -
uniform vec4 u_klapp;          // x, y, vinkel, -
uniform vec4 u_segel;          // x, y, vinkel, -
uniform vec2 u_skiva;          // skivans mitt
uniform float u_tid;
uniform float u_synlig;
uniform vec4 u_fagel;          // talgoxen: x, y (fötterna), riktning (1 höger, -1 vänster), stjärtvipp
uniform vec4 u_fagel2;         // synlighet, vingslagens fas, flyger (0..1), -
${BRUS}

float kapsel(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

// Avstånd till en vriden ellips, ungefärligt
float ellips(vec2 p, vec2 c, vec2 r, float v) {
  vec2 d = p - c;
  float cv = cos(v), sv = sin(v);
  d = vec2(cv * d.x + sv * d.y, -sv * d.x + cv * d.y);
  return (length(d / r) - 1.0) * min(r.x, r.y);
}

// En talgoxe från sidan: svart huvud med vit kind, gult bröst, olivgrön rygg, blågrå
// vingar med ett vitt vingband och en lång, smal stjärt. Sitter den är kroppen lätt
// upprätt: bröstet och huvudet högt, ryggen sluttar bakåt och stjärten hänger ner bakom
// fötterna. Flyger den syns vingarna utbredda och slår. Allt i kroppslängder, med
// fötterna i origo. Returnerar färg och täckning.
vec4 talgoxe(vec2 p, vec4 f, vec4 f2) {
  float B = 0.074;
  vec2 q = (p - f.xy) / B;
  q.x *= f.z;
  float flyg = f2.z;
  q.y -= 0.15 * flyg;
  float kant = 0.03;
  float lut = mix(0.55, -0.05, flyg);
  vec2 kc = mix(vec2(0.0, 0.5), vec2(0.0, 0.55), flyg);
  float kropp = ellips(q, kc, mix(vec2(0.5, 0.32), vec2(0.62, 0.4), flyg), lut);
  vec2 hc = mix(vec2(0.4, 0.9), vec2(0.68, 0.75), flyg);
  float huvud = length(q - hc) - 0.23;
  float nabb = kapsel(q, hc + vec2(0.2, -0.01), hc + vec2(0.33, -0.04), 0.035);
  float stv = f.w * 0.5 * (1.0 - flyg);
  vec2 stA = mix(vec2(-0.34, 0.3), vec2(-0.5, 0.48), flyg);
  vec2 stB = stA + vec2(-cos(0.8 + stv), -sin(0.8 + stv)) * 0.6;
  stB = mix(stB, vec2(-1.25, 0.6), flyg);
  float stjart = kapsel(q, stA, stB, 0.075);
  // Vingen: ihopfälld längs sidan när den sitter, utbredd och slående i flykten
  float slag = sin(f2.y);
  float vinge = mix(
    ellips(q, vec2(-0.1, 0.5), vec2(0.38, 0.14), 0.62),
    ellips(q, vec2(0.0, 0.75 + 0.55 * slag), vec2(0.35, 0.5 + 0.3 * abs(slag)), 0.0),
    flyg);
  float ben = min(kapsel(q, vec2(0.02, 0.26), vec2(-0.02, 0.0), 0.028), kapsel(q, vec2(0.14, 0.26), vec2(0.15, 0.0), 0.028));
  ben = mix(ben, 9.0, flyg);
  float d = min(min(kropp, huvud), min(min(nabb, stjart), min(vinge, ben)));
  float a = smoothstep(kant, -kant, d);
  if (a <= 0.0) return vec4(0.0);
  // Färgerna: olivgrön rygg, gult bröst och buk framtill och nedtill
  vec3 col = vec3(0.4, 0.44, 0.22);
  float brost = smoothstep(0.12, -0.08, ellips(q, kc + vec2(0.16, -0.1), vec2(0.44, 0.26), lut));
  col = mix(col, vec3(0.93, 0.8, 0.22), brost);
  // Den svarta strimman längs bröstets mitt syns i framkanten, från haklappen och nedåt
  float framkant = smoothstep(-0.09, -0.03, kropp) * step(0.12, q.x) * step(q.y, 0.85);
  col = mix(col, vec3(0.05), framkant * brost);
  // Huvudet: svart hätta och haklapp, med en stor vit kind som går bakåt
  float hd = smoothstep(kant, -kant, huvud);
  col = mix(col, vec3(0.04, 0.04, 0.05), hd);
  col = mix(col, vec3(0.04, 0.04, 0.05), smoothstep(0.02, -0.02, ellips(q, hc + vec2(0.08, -0.25), vec2(0.14, 0.11), 0.5)));
  float kind = smoothstep(0.02, -0.02, ellips(q, hc + vec2(-0.03, -0.06), vec2(0.18, 0.1), -0.15));
  col = mix(col, vec3(0.94, 0.94, 0.9), kind * hd * (1.0 - flyg * 0.4));
  // Vingen: blågrå med ett vitt vingband, och stjärten blågrå
  float vg = smoothstep(kant, -kant, vinge);
  col = mix(col, vec3(0.38, 0.43, 0.52), vg);
  col = mix(col, vec3(0.92, 0.93, 0.92), smoothstep(0.045, 0.02, abs(q.x - 0.06 + (q.y - 0.55) * 0.7)) * vg * (1.0 - flyg));
  col = mix(col, vec3(0.3, 0.34, 0.42), smoothstep(kant, -kant, stjart) * (1.0 - smoothstep(kant, -kant, kropp)));
  col = mix(col, vec3(0.2, 0.2, 0.22), smoothstep(kant, -kant, nabb));
  col = mix(col, vec3(0.3, 0.3, 0.33), smoothstep(kant, -kant, ben));
  // Ögat glimmar i den svarta hättan
  col += vec3(0.7) * smoothstep(0.045, 0.0, length(q - hc - vec2(0.11, 0.07))) * (1.0 - flyg);
  // Skymningen: lite mörkare, varmt ljus underifrån
  col *= 0.72 + 0.15 * smoothstep(1.2, 0.0, q.y);
  return vec4(col, a * f2.x);
}

void main() {
  float s = u_res.x;
  vec2 p = gl_FragCoord.xy / s;
  vec2 uv = gl_FragCoord.xy / u_res;
  float H = u_res.y / u_res.x;

  // Skymning: varmt nertill, djupare blått upptill, med långsamma moln
  vec3 c = mix(vec3(0.95, 0.62, 0.45), vec3(0.18, 0.2, 0.38), smoothstep(0.0, 0.95, uv.y));
  c = mix(c, vec3(0.55, 0.35, 0.45), smoothstep(0.3, 0.6, uv.y) * smoothstep(0.9, 0.6, uv.y) * 0.4);
  float moln = fbm(vec2(p.x * 2.0 + u_tid * 0.01, p.y * 5.0));
  c = mix(c, c * 1.15 + vec3(0.08, 0.04, 0.05), smoothstep(0.55, 0.8, moln) * 0.5);

  // Takbjälken högst upp och snöret ner till skivan
  float balk = H - 0.06;
  if (p.y > balk) c = vec3(0.12, 0.07, 0.04) * (0.8 + 0.3 * fbm(vec2(p.x * 30.0, p.y * 4.0)));
  vec3 snore = vec3(0.12, 0.1, 0.09);
  c = mix(c, snore, smoothstep(0.0025, 0.001, kapsel(p, vec2(0.5, balk), u_skiva, 0.0)));

  // Rören bakom kläppen först (efter djup), sedan kläppen, sedan rören framför
  for (int pass = 0; pass < 2; pass++) {
    for (int i = 0; i < ${ROR}; i++) {
      vec4 r = u_ror[i];
      vec4 r2 = u_ror2[i];
      bool fram = r2.x > 0.0;
      if ((pass == 0) == fram) continue;
      vec2 fast = r.xy;
      vec2 rikt = vec2(sin(r.z), -cos(r.z));
      vec2 topp = fast + rikt * 0.04;
      vec2 botten = topp + rikt * r.w;
      // Snöret från skivan till röret
      c = mix(c, snore, smoothstep(0.002, 0.0008, kapsel(p, fast, topp, 0.0)));
      float d = kapsel(p, topp, botten, ${ROR_R});
      if (d < 0.0) {
        // Metallrör: ljus reflex längs ena sidan och himlen speglad
        vec2 tv = vec2(rikt.y, -rikt.x);
        float tvar = dot(p - topp, tv) / ${ROR_R};
        float cyl = sqrt(max(0.0, 1.0 - tvar * tvar));
        float langs = dot(p - topp, rikt) / r.w;
        vec3 him = mix(vec3(0.9, 0.62, 0.48), vec3(0.3, 0.32, 0.5), langs);
        vec3 metall = mix(vec3(0.25, 0.25, 0.28), him, 0.5 + 0.5 * tvar) * (0.5 + 0.6 * cyl);
        metall += vec3(1.0, 0.95, 0.88) * smoothstep(0.25, 0.0, abs(tvar + 0.45)) * 0.6;
        metall *= 0.8 + 0.25 * r2.x;
        metall += vec3(1.0, 0.85, 0.6) * r2.y * 0.25;
        c = mix(c, metall, smoothstep(0.0, -0.002, d));
      }
    }
    if (pass == 0) {
      // Kläppen: en träskiva i snöret mitt i
      vec2 kd = p - u_klapp.xy;
      float kc = cos(u_klapp.z), ks = sin(u_klapp.z);
      vec2 kr = vec2(kd.x * kc + kd.y * ks, -kd.x * ks + kd.y * kc);
      c = mix(c, snore, smoothstep(0.002, 0.0008, kapsel(p, u_skiva, u_segel.xy, 0.0)));
      // Närmare blir kläppen lite större och ljusare, längre bort lite mindre och mörkare
      float kz = 1.0 + 0.22 * u_klapp.w;
      if (abs(kr.x) < ${KLAPP_R} * kz && abs(kr.y) < 0.012 * kz) {
        vec3 tra = mix(vec3(0.35, 0.2, 0.1), vec3(0.55, 0.34, 0.18), fbm(kr * vec2(30.0, 150.0)));
        c = tra * (0.75 + 0.3 * smoothstep(-0.012, 0.012, kr.y)) * (0.88 + 0.18 * u_klapp.w);
      }
      // Seglet: ett tunt trälöv längst ner
      vec2 sd = p - u_segel.xy;
      float sc = cos(u_segel.z), ss = sin(u_segel.z);
      vec2 sr = vec2(sd.x * sc + sd.y * ss, -sd.x * ss + sd.y * sc);
      float blad = length(vec2(sr.x / 0.045, (sr.y + 0.07) / 0.09));
      if (blad < 1.0) c = mix(vec3(0.28, 0.16, 0.08), vec3(0.5, 0.31, 0.16), fbm(sr * 45.0)) * (0.8 + 0.25 * sr.x / 0.045);
    }
  }
  // Skivan överst
  vec2 sk = (p - u_skiva) / vec2(${(RING * 1.35).toFixed(4)}, 0.024);
  if (length(sk) < 1.0) c = mix(vec3(0.3, 0.18, 0.09), vec3(0.52, 0.32, 0.17), 0.5 + 0.5 * sk.y) * (0.8 + 0.25 * fbm(sk * 8.0));

  // Talgoxen som ibland sätter sig på skivan
  if (u_fagel2.x > 0.0) {
    vec4 tg = talgoxe(p, u_fagel, u_fagel2);
    c = mix(c, tg.rgb, tg.a);
  }

  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, u_tid), 1.0);
}`;

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, ['u_res', 'u_ror', 'u_ror2', 'u_klapp', 'u_segel', 'u_skiva', 'u_tid', 'u_synlig', 'u_fagel', 'u_fagel2']);

    const H = () => duk.clientHeight / duk.clientWidth;
    const skivaY = () => H() * 0.8;

    // ---------- Pendlarna ----------
    // Läget p är förskjutningen i horisontalplanet (x i bild, z i djupled).
    const ny = (L) => ({ px: 0, pz: 0, vx: 0, vz: 0, L, w2: 9.8 / (L * 4.5) });
    const ror = TONER.map((_, i) => {
      const a = (i / ROR) * Math.PI * 2 + 0.3;
      return { ...ny(0.5 - i * 0.042), ax: Math.cos(a) * RING, az: Math.sin(a) * RING, klang: 0 };
    });
    const klapp = ny(KLAPP_L);
    let byTid = slump(3, 8);
    const segel = { vinkel: 0 };

    let vindX = 0, vindZ = 0, by = 0, lutning = 0, lutningZ = 0;
    // Lutningen drar kläppen åt det håll hon lutar, likadant åt alla håll, ungefär som
    // tyngdkraften gör. Lutar hon och håller kvar lägger sig kläppen mot rören på den
    // sidan och vilar där tyst. Utgångsläget är hur hon håller telefonen, och det följer
    // mycket långsamt med om hon byter ställning.
    // Lutningen räknas som tyngdkraftens riktning i skärmens plan, inte som vinklar.
    // Vinklarna slår om från +90 till -90 grader när telefonen lutas helt åt sidan eller
    // hålls upprätt, och då blev varje liten darrning en ny vindby.
    let nollX = null, nollY = null;
    let tyngdX = 0, tyngdY = 0;
    const RAD = Math.PI / 180;
    const slutaLuta = lyssnaLutning((beta, gamma) => {
      tyngdX = Math.cos(beta * RAD) * Math.sin(gamma * RAD);
      tyngdY = Math.sin(beta * RAD);
      if (nollX === null) { nollX = tyngdX; nollY = tyngdY; }
      nollX += (tyngdX - nollX) * 0.001;
      nollY += (tyngdY - nollY) * 0.001;
      lutning = klamp((tyngdX - nollX) / 0.5, -1, 1);
      lutningZ = klamp((tyngdY - nollY) / 0.5, -1, 1);
    });

    // ---------- Ljud ----------
    const l = rumsLjud(1.25, 1.5);
    const { ctx, ut } = l;
    const eko = rum(3.5);
    const ekoUt = ctx.createGain(); ekoUt.gain.value = 0.5;
    eko.connect(ekoUt).connect(ut);
    // Vinden: samma inspelade ökenvind som i Sandlådan, jämnad, och lite starkare
    // i byarna som sätter spelet i rörelse. Går den inte att ladda räknas den fram.
    const vindBuss = ctx.createGain(); vindBuss.gain.value = 0.7;
    vindBuss.connect(ut);
    const vindMatta = skapaMatta(ctx, vindBuss, 'ljud/sandlada-vind.mp3', {
      avsnitt: [[0.5, 15.9], [17.0, 72.4]], niva: 0.012, bit: [10, 20], over: 4, hp: 70, tonhojd: 0.03, jamna: 0.6,
    });
    l.kallor.push(vindMatta);
    let vind = null;
    vindMatta.klar.catch(() => {
      vind = skapaVind(ctx, ut, { styrka: 0.8, ljus: 0.8 });
      l.kallor.push(...vind.kallor);
    });
    const senastSlag = TONER.map(() => 0);
    function slaRor(i, kraft) {
      // Vilar kläppen bara mot röret, eller nuddar det knappt, hörs ingenting
      if (kraft < 0.06) return;
      const nu = performance.now();
      if (nu - senastSlag[i] < 70) return;
      senastSlag[i] = nu;
      const k = klamp(kraft, 0.08, 1);
      klang(ctx, ut, TONER[i] * slump(0.998, 1.002), DELTONER, { styrka: 0.05 * k, ansats: 0.002, eko });
      ror[i].klang = Math.min(1, ror[i].klang + k);
    }

    function fysik(dt) {
      // Bris som kommer och går, plus byar och lutning
      const t = performance.now() / 1000;
      const bris = 0.25 * Math.sin(t * 0.23) * Math.sin(t * 0.11 + 1) + 0.1 * Math.sin(t * 0.7);
      // Då och då kommer en naturlig vindby
      byTid -= dt;
      if (byTid <= 0) { by += slump(0.35, 0.8) * (Math.random() < 0.5 ? -1 : 1); byTid = slump(6, 15); }
      vindX = bris + by;
      vindZ = 0.12 * Math.sin(t * 0.31 + 2) + by * 0.4 * Math.sin(t * 3.1);
      by *= Math.exp(-dt * 1.2);
      const alla = [...ror, klapp];
      for (const q of alla) {
        const yta = q === klapp ? 1.8 : 0.5;  // kläppen har seglet och tar mer vind
        q.vx += (-q.w2 * q.px - 0.5 * q.vx + vindX * yta * 0.35) * dt;
        q.vz += (-q.w2 * q.pz - 0.5 * q.vz + vindZ * yta * 0.35) * dt;
        // Lutningen drar kläppen dit, lika mycket åt sidorna som framåt och bakåt
        if (q === klapp) { q.vx += lutning * 0.9 * dt; q.vz += lutningZ * 0.9 * dt; }
        q.px += q.vx * dt; q.pz += q.vz * dt;
      }
      // Kläppen mot rören, i höjd med kläppen
      for (let i = 0; i < ROR; i++) {
        const r = ror[i];
        const f = 0.62;   // hur långt ner på röret kläppen sitter
        const rx = r.ax + r.px * f, rz = r.az + r.pz * f;
        const dx = rx - klapp.px, dz = rz - klapp.pz;
        const d = Math.hypot(dx, dz);
        const min = KLAPP_R + ROR_R;
        if (d < min) {
          const nx = dx / d, nz = dz / d;
          const rel = (klapp.vx - r.vx * f) * nx + (klapp.vz - r.vz * f) * nz;
          if (rel > 0) {
            klapp.vx -= rel * nx * 0.9; klapp.vz -= rel * nz * 0.9;
            r.vx += rel * nx * 1.1; r.vz += rel * nz * 1.1;
            slaRor(i, rel * 2.2);
          }
          const tryck = (min - d) * 0.5;
          klapp.px -= nx * tryck; klapp.pz -= nz * tryck;
        }
      }
      segel.vinkel += ((klapp.vx * 0.8 + vindX * 0.6) - segel.vinkel) * Math.min(1, dt * 3);
    }

    // ---------- Talgoxen ----------
    // Har ingen rört skärmen eller telefonen på en lång stund flyger en talgoxe in, i
    // mesens studsande flykt, och sätter sig på skivan. Där vänder den sig ibland och
    // vippar på stjärten. Rör hon skärmen eller lutar telefonen tydligt flyger den, men
    // små darrningar i handen skrämmer den inte, och inte heller vindspelets egna byar.
    const LUGN = 12;          // sekunder i stillhet innan talgoxen kommer
    const SKRAMS = 0.17;      // ungefär tio graders vridning skrämmer den
    let lugn = 0, fagel = null, fagelVila = 0, ref = null;
    function stord() { lugn = 0; if (fagel && fagel.lage !== 'flyr') fagelFlyr(); }
    function fagelFlyr() {
      Object.assign(fagel, { lage: 'flyr', t: 0, fx: fagel.x, fy: fagel.y, tx: fagel.x + fagel.rikt * slump(0.6, 0.9), ty: fagel.y + slump(0.4, 0.7) });
    }
    function fagelRor(dt, sy) {
      lugn += dt;
      fagelVila -= dt;
      // Utgångsläget följer sakta med, så att långsam glidning i handen inte räknas
      if (!ref) ref = { x: tyngdX, y: tyngdY };
      if (Math.abs(tyngdX - ref.x) > SKRAMS || Math.abs(tyngdY - ref.y) > SKRAMS) { ref = { x: tyngdX, y: tyngdY }; stord(); }
      const kf = Math.min(1, dt * 0.25);
      ref.x += (tyngdX - ref.x) * kf; ref.y += (tyngdY - ref.y) * kf;
      if (!fagel) {
        if (lugn > LUGN && fagelVila <= 0) {
          const fran = Math.random() < 0.5 ? -1 : 1;
          const tx = 0.5 + slump(-0.12, 0.12);
          fagel = { lage: 'kommer', t: 0, fx: fran < 0 ? -0.15 : 1.15, fy: sy + slump(0.25, 0.45), tx, ty: sy + 0.022, rikt: -fran, x: 0, y: 0, vipp: 0, vippT: slump(2, 5), vand: slump(4, 9), fas: 0 };
        }
        return null;
      }
      const F = fagel;
      F.fas += dt * 30;
      if (F.lage === 'kommer' || F.lage === 'flyr') {
        const T = F.lage === 'kommer' ? 2.2 : 1.4;
        F.t = Math.min(1, F.t + dt / T);
        const e = F.lage === 'kommer' ? 1 - Math.pow(1 - F.t, 2) : F.t * F.t;
        // Mesar flyger i bågar: några vingslag uppåt, sedan ett kort glid med fällda vingar
        const bage = Math.sin(F.t * Math.PI * 4) * 0.025 * (1 - F.t);
        F.x = F.fx + (F.tx - F.fx) * e;
        F.y = F.fy + (F.ty - F.fy) * e + bage + (F.lage === 'kommer' ? Math.sin(F.t * Math.PI) * 0.05 : 0);
        if (F.lage === 'kommer' && F.t >= 1) { F.lage = 'sitter'; F.x = F.tx; F.y = F.ty; }
        if (F.lage === 'flyr' && F.t >= 1) { fagel = null; fagelVila = 30; return null; }
        const glid = Math.sin(F.t * Math.PI * 4) < -0.3;
        return [F.x, F.y, F.rikt, 0, 1, glid ? 1.2 : F.fas, 1];
      }
      // Sitter: vippar på stjärten och vänder sig ibland med ett litet hopp
      F.vippT -= dt;
      if (F.vippT <= 0) { F.vipp = 1; F.vippT = slump(2, 6); }
      F.vipp *= Math.exp(-dt * 6);
      F.vand -= dt;
      let hopp = 0;
      if (F.vand <= 0) { F.rikt = -F.rikt; F.vand = slump(4, 10); F.hoppT = 0.25; }
      if (F.hoppT > 0) { F.hoppT -= dt; hopp = Math.sin(Math.max(0, F.hoppT) / 0.25 * Math.PI) * 0.012; }
      return [F.x, F.y + hopp, F.rikt, F.vipp, 1, 0, 0];
    }

    // ---------- Fingret ----------
    let forra = null;
    fingrar(duk, {
      ner: (x, y, id, e) => { forra = { x, t: e.timeStamp }; stord(); },
      drag: (x, y, id, e) => {
        if (forra) {
          const v = (x - forra.x) / duk.clientWidth / Math.max(0.008, (e.timeStamp - forra.t) / 1000);
          by = klamp(by + v * 0.05, -1.4, 1.4);
        }
        forra = { x, t: e.timeStamp };
      },
      upp: (x, y, id, { tryck }) => {
        forra = null;
        if (!tryck) return;
        // Ett tryck på ett rör slår an det
        const px = x / duk.clientWidth, py = (duk.clientHeight - y) / duk.clientWidth;
        ror.forEach((r, i) => {
          const fx = 0.5 + r.ax + r.px * 0.1, fy = skivaY();
          const vinkel = Math.atan2(r.px, r.L * 4);
          const bx = fx + Math.sin(vinkel) * (r.L + 0.04), by2 = fy - Math.cos(vinkel) * (r.L + 0.04);
          const t = klamp(((px - fx) * (bx - fx) + (py - fy) * (by2 - fy)) / ((bx - fx) ** 2 + (by2 - fy) ** 2), 0, 1);
          if (Math.hypot(px - (fx + (bx - fx) * t), py - (fy + (by2 - fy) * t)) < 0.035) {
            slaRor(i, 0.7);
            r.vx += slump(-0.15, 0.15);
          }
        });
      },
    }, { ett: true });

    // ---------- Ritslinga ----------
    const fasta = fastaSteg(1 / 120, 8);
    const d1 = new Float32Array(ROR * 4), d2 = new Float32Array(ROR * 4);
    const stoppa = slinga((tid, dt) => {
      fasta(dt, fysik);
      if (vind) vind.uppdatera(dt, Math.min(1, Math.abs(by)));
      vindBuss.gain.setTargetAtTime(0.6 + 0.7 * Math.min(1, Math.abs(by)), ctx.currentTime, 0.4);
      const sy = skivaY();
      ror.forEach((r, i) => {
        r.klang *= Math.exp(-dt * 1.5);
        const vinkel = Math.atan2(r.px, r.L * 4);
        d1.set([0.5 + r.ax, sy - 0.01, vinkel, r.L], i * 4);
        d2.set([r.az / RING, r.klang, 0, 0], i * 4);
      });
      const kv = Math.atan2(klapp.px, klapp.L * 4);
      const kx = 0.5 + Math.sin(kv) * KLAPP_L, ky = sy - Math.cos(kv) * KLAPP_L;
      const sx = 0.5 + Math.sin(kv) * SEGEL_L, syy = sy - Math.cos(kv) * SEGEL_L;

      anpassa(gl, duk, 0.75);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform4fv(u.u_ror, d1);
      gl.uniform4fv(u.u_ror2, d2);
      gl.uniform4f(u.u_klapp, kx, ky, kv, klamp(klapp.pz / RING, -1, 1));
      gl.uniform4f(u.u_segel, sx, syy, kv + segel.vinkel * 0.6, 0);
      gl.uniform2f(u.u_skiva, 0.5, sy);
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_synlig, mjuk(0, 2.5, tid));
      const fg = fagelRor(dt, sy);
      if (fg) {
        gl.uniform4f(u.u_fagel, fg[0], fg[1], fg[2], fg[3]);
        gl.uniform4f(u.u_fagel2, fg[4], fg[5], fg[6], 0);
      } else gl.uniform4f(u.u_fagel2, 0, 0, 0, 0);
      ritaHelskarm(gl);
    });

    return stangning({ ljud: l, stoppa, gl, extra: [slutaLuta] });
  },
};
