// Lucka 22: Snögloben
// En snöglob på ett bord i ett varmt, dunkelt rum. Inuti står en liten röd stuga med
// tänt fönster och en gran med ljus. Skakar hon telefonen, lutar den eller sveper över
// kulan virvlar snön upp, och sedan singlar den sakta ner och lägger sig igen. Ett tryck
// på foten drar upp speldosan, som spelar en lugn vaggvisa och saktar in när fjädern
// går ut.
//
// Snöflingorna följer ett flöde av mjuka virvlar som klingar av, och faller långsamt
// som i trögt vatten. Tyngdkraften kommer från telefonens egen lutning.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { brusKalla, rum } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { mjuk, slump, klamp, rumsLjud, slinga, fingrar, stangning, klang, brusstot } from '../lib/scen.js';
import { lyssnaSkak } from '../lib/rorelse.js';
import { laddaInspelning } from '../lib/inspelning.js';

const FLINGOR = 480;
const R = 0.38;              // kulans radie i skärmbredder

// Markens höjd inne i kulan, i kulans egna koordinater (enhetscirkel)
const MARK = (x) => -0.42 + 0.06 * Math.cos(x * 2.2);

const BAK_FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform float u_tid;
uniform vec2 u_mitt;
uniform float u_spel;        // speldosan spelar (0..1)
uniform float u_synlig;
${BRUS}

float mark(float x) { return -0.42 + 0.06 * cos(x * 2.2); }

void main() {
  float s = u_res.x;
  vec2 p = gl_FragCoord.xy / s;
  vec2 uv = gl_FragCoord.xy / u_res;
  float R = ${R.toFixed(3)};
  vec2 L = (p - u_mitt) / R;
  float r = length(L);

  // Rummet: en varm vägg i lampsken, och ett mörkt träbord
  vec3 c = mix(vec3(0.16, 0.1, 0.07), vec3(0.05, 0.035, 0.03), uv.y);
  c += vec3(0.35, 0.2, 0.1) * exp(-dot(L - vec2(0.2, 0.9), L - vec2(0.2, 0.9)) * 0.5) * 0.25;
  float bord = u_mitt.y - R * 1.18;
  if (p.y < bord) {
    float ad = fbm(vec2(p.x * 2.0, p.y * 25.0)) * 0.7 + brus(vec2(p.x * 8.0, p.y * 70.0)) * 0.3;
    c = mix(vec3(0.12, 0.065, 0.035), vec3(0.24, 0.13, 0.065), ad) * (0.5 + 0.5 * exp(-pow(p.x - 0.5, 2.0) * 4.0));
    // Kulans spegling och skugga i bordsskivan
    c *= 1.0 - 0.4 * exp(-pow((p.x - 0.5) / 0.45, 2.0)) * smoothstep(bord - 0.15, bord, p.y);
  }

  // Foten: rundsvarvat trä med en mässingsring och en liten nyckel till speldosan
  vec2 f = vec2((p.x - 0.5) / (R * 0.95), (p.y - (u_mitt.y - R * 1.02)) / (R * 0.2));
  if (abs(f.x) < 1.0 - 0.15 * max(f.y, 0.0) * max(f.y, 0.0) && f.y > -1.0 && f.y < 0.9) {
    float rund = sqrt(max(0.0, 1.0 - f.x * f.x));
    vec3 tra = mix(vec3(0.22, 0.11, 0.05), vec3(0.45, 0.25, 0.12), fbm(vec2(f.x * 3.0, f.y * 20.0)));
    tra *= 0.45 + 0.65 * rund;
    tra += vec3(0.5, 0.3, 0.15) * pow(rund, 6.0) * 0.15;
    if (abs(f.y - 0.55) < 0.12) tra = mix(vec3(0.35, 0.25, 0.08), vec3(0.85, 0.66, 0.3), rund) * (0.6 + 0.4 * rund);
    c = tra;
  }
  // Nyckeln på sidan, som vrider sig lite när speldosan spelar
  vec2 k = p - vec2(0.5 + R * 0.98, u_mitt.y - R * 1.0);
  float kv = u_tid * 1.2 * u_spel;
  vec2 kr = vec2(k.x, k.y * cos(kv) + 0.0);
  if (length(kr - vec2(0.018, 0.0)) < 0.013 && abs(k.y) < 0.013 * abs(cos(kv)) + 0.003) c = vec3(0.75, 0.58, 0.28);
  if (k.x > 0.0 && k.x < 0.012 && abs(k.y) < 0.003) c = vec3(0.6, 0.45, 0.2);

  // Inne i kulan: en vinternatt i miniatyr
  if (r < 1.0) {
    vec2 q = L;
    vec3 in_ = mix(vec3(0.1, 0.16, 0.3), vec3(0.03, 0.05, 0.12), clamp(q.y * 0.6 + 0.5, 0.0, 1.0));
    float gy = mark(q.x);
    // Granen med små ljus och en stjärna i toppen
    vec2 g = (q - vec2(0.36, gy + 0.01)) / 1.45;
    float gran = 0.0;
    for (int i = 0; i < 3; i++) {
      float bas = float(i) * 0.15;
      float topp = bas + 0.24;
      float bredd = 0.2 - float(i) * 0.05;
      float yy = (g.y - bas) / (topp - bas);
      if (yy > 0.0 && yy < 1.0 && abs(g.x) < bredd * (1.0 - yy)) gran = 1.0;
    }
    if (gran > 0.0) {
      in_ = vec3(0.05, 0.16, 0.1) * (0.8 + 0.4 * fbm(g * 30.0));
      vec2 lc = floor(g * 26.0);
      float lh = hash(lc);
      if (lh > 0.82) {
        vec2 lf = fract(g * 26.0) - 0.5;
        vec3 lf3 = lh > 0.94 ? vec3(1.0, 0.85, 0.4) : lh > 0.88 ? vec3(1.0, 0.35, 0.25) : vec3(0.5, 0.7, 1.0);
        in_ += lf3 * smoothstep(0.3, 0.0, length(lf)) * (0.6 + 0.4 * sin(u_tid * 2.0 + lh * 50.0));
      }
    }
    vec2 st = g - vec2(0.0, 0.54);
    float stjarna = smoothstep(0.03, 0.0, abs(st.x) + abs(st.y) * 0.6) + smoothstep(0.03, 0.0, abs(st.y) + abs(st.x) * 0.6);
    in_ += vec3(1.0, 0.85, 0.4) * clamp(stjarna, 0.0, 1.0);
    in_ += vec3(1.0, 0.8, 0.4) * exp(-dot(st, st) * 300.0) * 0.3;
    // Stugan: röd med vita knutar, snö på taket och ett varmt fönster
    vec2 h = (q - vec2(-0.27, gy + 0.005)) / 1.45;
    if (abs(h.x) < 0.16 && h.y > -0.02 && h.y < 0.17) {
      in_ = vec3(0.5, 0.1, 0.07) * (0.85 + 0.2 * fbm(h * vec2(10.0, 60.0)));
      if (abs(abs(h.x) - 0.155) < 0.01) in_ = vec3(0.85);
      vec2 fo = h - vec2(0.06, 0.08);
      if (abs(fo.x) < 0.035 && abs(fo.y) < 0.035) {
        in_ = vec3(1.0, 0.7, 0.35) * (0.9 + 0.1 * sin(u_tid * 3.0));
        if (abs(fo.x) < 0.004 || abs(fo.y) < 0.004) in_ = vec3(0.85);
      }
      vec2 dr = h - vec2(-0.07, 0.04);
      if (abs(dr.x) < 0.028 && dr.y < 0.05 && dr.y > -0.06) in_ = vec3(0.3, 0.06, 0.04);
    }
    float tak = 0.17 + 0.13 * (1.0 - abs(h.x) / 0.2);
    if (abs(h.x) < 0.2 && h.y >= 0.17 && h.y < tak) in_ = h.y > tak - 0.035 ? vec3(0.9, 0.93, 1.0) : vec3(0.15, 0.08, 0.06);
    // Ljuset från fönstret på snön
    vec2 sk = q - vec2(-0.18, gy);
    in_ += vec3(1.0, 0.6, 0.25) * exp(-dot(sk * vec2(1.0, 3.0), sk * vec2(1.0, 3.0)) * 30.0) * 0.25;
    // Snön på marken
    if (q.y < gy) {
      float djup = gy - q.y;
      in_ = mix(vec3(0.85, 0.9, 1.0), vec3(0.45, 0.52, 0.7), smoothstep(0.0, 0.5, djup));
      // Mjuka gupp i snön, och ett svagt glitter
      in_ *= 0.92 + 0.12 * fbm(q * vec2(6.0, 14.0));
      if (hash(floor(q * 120.0)) > 0.985) in_ += vec3(0.4) * (0.5 + 0.5 * sin(u_tid * 2.0 + hash(floor(q * 120.0) + 1.0) * 30.0));
      in_ += vec3(1.0, 0.65, 0.3) * exp(-dot(sk * vec2(1.0, 2.0), sk * vec2(1.0, 2.0)) * 20.0) * 0.2;
    }
    // Ett svagt sken när speldosan spelar
    in_ *= 1.0 + 0.08 * u_spel;
    // Glaset mörknar och blir blankt mot kanten
    in_ *= mix(1.0, 0.55, smoothstep(0.75, 1.0, r));
    c = mix(c, in_, smoothstep(1.0, 0.985, r));
  }

  c *= 1.0 - 0.3 * pow(length(uv - vec2(0.5, 0.55)) * 1.3, 2.5);
  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, u_tid), 1.0);
}`;

// Snöflingorna, som små mjuka prickar inne i kulan
const FLINGA_VS = `#version 300 es
precision highp float;
in vec4 a_f;        // x, y, storlek, ljus
uniform float u_H;
out vec2 v_lok;
out float v_ljus;
out vec2 v_p;
void main() {
  vec2 h = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  vec2 p = a_f.xy + h * a_f.z;
  v_lok = h;
  v_ljus = a_f.w;
  v_p = p;
  gl_Position = vec4(p.x * 2.0 - 1.0, p.y / u_H * 2.0 - 1.0, 0.0, 1.0);
}`;

const FLINGA_FS = `#version 300 es
precision highp float;
in vec2 v_lok;
in float v_ljus;
in vec2 v_p;
out vec4 frag;
uniform vec2 u_mitt;
uniform float u_synlig;
void main() {
  if (length(v_p - u_mitt) > ${(R * 0.985).toFixed(4)}) discard;
  float a = smoothstep(1.0, 0.25, length(v_lok)) * v_ljus * u_synlig;
  frag = vec4(vec3(0.95, 0.97, 1.0) * a, a);
}`;

// Glaset ovanpå: reflexer från rummet och en ljus kant
const GLAS_FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform vec2 u_mitt;
uniform float u_synlig;
void main() {
  vec2 p = gl_FragCoord.xy / u_res.x;
  vec2 L = (p - u_mitt) / ${R.toFixed(3)};
  float r = length(L);
  if (r > 1.0) discard;
  float a = 0.0;
  vec3 c = vec3(0.0);
  // En mjuk reflex av fönstret uppe till vänster
  vec2 f = (L - vec2(-0.45, 0.5)) * mat2(0.8, -0.6, 0.6, 0.8);
  float fonster = smoothstep(0.2, 0.0, abs(f.x) - 0.06) * smoothstep(0.25, 0.0, abs(f.y) - 0.12);
  c += vec3(0.9, 0.85, 0.75) * fonster * 0.22;
  // En smal ljus båge längs kanten, och en svag varm reflex från lampan
  float kant = smoothstep(0.88, 0.99, r) * smoothstep(1.0, 0.985, r);
  c += vec3(0.8, 0.75, 0.7) * kant * 0.25 * (0.5 + 0.5 * smoothstep(-0.5, 0.8, L.y - L.x));
  vec2 lp = L - vec2(0.55, 0.45);
  c += vec3(1.0, 0.75, 0.45) * exp(-dot(lp, lp) * 60.0) * 0.35;
  a = clamp(max(max(c.r, c.g), c.b), 0.0, 1.0);
  frag = vec4(c * u_synlig, a * 0.5 * u_synlig);
}`;

// Vaggvisan i speldosan: en egen, enkel melodi i D-dur, tre slag i varje takt
const MELODI = [
  [69, 74, 78], [81, 78, 74], [76, 78, 76], [74, 71, 69],
  [71, 74, 76], [78, 81, 78], [76, 74, 76], [74, 0, 0],
];
const BAS = [62, 62, 57, 62, 55, 62, 57, 62];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const bak = program(gl, HELSKARM, BAK_FS);
    const bu = platser(gl, bak, ['u_res', 'u_tid', 'u_mitt', 'u_spel', 'u_synlig']);
    const flingProg = program(gl, FLINGA_VS, FLINGA_FS);
    const fu = platser(gl, flingProg, ['u_H', 'u_mitt', 'u_synlig']);
    const glas = program(gl, HELSKARM, GLAS_FS);
    const gu = platser(gl, glas, ['u_res', 'u_mitt', 'u_synlig']);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const data = new Float32Array(FLINGOR * 4);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
    const aF = gl.getAttribLocation(flingProg, 'a_f');
    gl.enableVertexAttribArray(aF);
    gl.vertexAttribPointer(aF, 4, gl.FLOAT, false, 16, 0);
    gl.vertexAttribDivisor(aF, 1);
    const tom = gl.createVertexArray();

    // ---------- Kulan och snön ----------
    const H = () => duk.clientHeight / duk.clientWidth;
    const mitt = { x: 0.5, y: H() * 0.55 };
    // Snön börjar uppvirvlad, så att det första man ser är hur den singlar ner
    const flingor = Array.from({ length: FLINGOR }, () => {
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * 0.9;
      return {
        x: Math.cos(a) * rr, y: Math.sin(a) * rr, vx: 0, vy: 0, vila: false,
        storlek: slump(0.003, 0.0075), ljus: slump(0.45, 1), fall: slump(0.05, 0.11),
        // Djupet i kulan (-1 främst, 1 längst bak) och en egen långsam drift
        z: slump(-1, 1), wx: 0, wy: 0,
      };
    });
    // Flödet: vattnet i kulan beskrivs med en strömfunktion, så att det aldrig kan
    // tryckas ihop och aldrig strömmar in i glaset. Allt som rör sig i mitten måste
    // vända och komma tillbaka längs kanten. Virvlarna klingar av, och kulans eget
    // snurr är starkast en bit in och står nästan still mot glaset, som riktigt vatten.
    // Ovanpå det finns mjuka, långsamt skiftande strömvirvlar som blir starkare när
    // kulan skakas. Vattnet strömmar olika på olika djup, så snön blir ett moln som
    // virvlar i stället för trådar som följer samma strömlinje.
    const virvlar = [];
    let svepX = 0, svepY = 0, rotation = 0;
    let klocka = 0, oro = 0.6;          // snön börjar uppvirvlad, och vattnet är fortfarande oroligt
    const VAGOR = [[3.1, 2.2, 0.37, 0.3], [-2.6, 3.4, -0.45, 1.7], [4.0, -1.3, 0.52, 4.1], [-1.7, -3.9, -0.31, 2.6]];
    function virvla(x, y, styrka) {
      if (virvlar.length > 7) virvlar.shift();
      virvlar.push({ x, y, s: styrka, r: slump(0.25, 0.5) });
    }
    function strom(x, y, medVirvlar, z = 0) {
      // Vattnets vägg ligger precis där flingorna möter glaset
      const r2 = (x * x + y * y) / 0.9409;
      const vagg = Math.max(0, 1 - r2 * r2);
      // Närmast det främre och bakre glaset rör sig vattnet trögare
      const djup = 1 - 0.5 * z * z;
      // Snurret: farten runt kulan blir 1,3·rotation·r·(1 - r⁴)
      const p = -djup * rotation * 0.65 * (r2 - r2 * r2 * r2 / 3);
      // Svepet: en ström tvärs genom mitten som vänder tillbaka längs glaset
      let q = (svepX * y - svepY * x) * djup;
      if (medVirvlar) {
        for (const v of virvlar) {
          const dx = x - v.x, dy = y - v.y;
          q += djup * v.s * v.r * 0.5 * Math.exp(-(dx * dx + dy * dy) / (v.r * v.r));
        }
      }
      // De mjuka strömvirvlarna
      let t = 0;
      for (const w of VAGOR) t += Math.sin(w[0] * x + w[1] * y + 0.75 * w[0] * z + w[2] * klocka + w[3]);
      q += t * (0.15 + oro) * 0.03;
      return p + q * vagg;
    }
    const E = 0.01;
    const gauss = () => Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(Math.PI * 2 * Math.random());
    function flode(x, y, medVirvlar = true, z = 0) {
      return [
        (strom(x, y + E, medVirvlar, z) - strom(x, y - E, medVirvlar, z)) / (2 * E),
        -(strom(x + E, y, medVirvlar, z) - strom(x - E, y, medVirvlar, z)) / (2 * E),
      ];
    }
    function skaka(styrka, rx = 0, ry = 0) {
      for (let i = 0; i < 3; i++) virvla(slump(-0.7, 0.7), slump(-0.6, 0.6), slump(-1.5, 1.5) * styrka);
      rotation += slump(-1, 1) * styrka * 0.8;
      oro = Math.min(1, oro + styrka * 0.3);
      svepX += rx; svepY += ry;
      skvalp = Math.min(1, skvalp + styrka * 0.6);
      // En skakning river upp snön från marken, mer ju hårdare
      for (const f of flingor) {
        if (f.vila && Math.random() < styrka * 0.7) {
          f.vila = false;
          f.vy = slump(1.2, 3.3) * styrka;
          f.vx = slump(-0.9, 0.9) * styrka;
        }
      }
    }
    // Tyngdkraften i skärmens riktning, från telefonens lutning
    let tyngd = [0, -1];
    let skvalp = 0;

    const slutaSkak = lyssnaSkak((ax, ay) => {
      const a = Math.hypot(ax, ay);
      // Vattnet släpar efter när kulan rycks, så snön far åt andra hållet
      if (a > 2.5) skaka(Math.min(1.2, (a - 2.5) * 0.12), -ax * 0.004, -ay * 0.004);
    });
    let tecken = 0;
    const lutning = (e) => {
      const g = e.accelerationIncludingGravity;
      if (!g || g.x == null) return;
      // iPhone och Android anger tyngden med olika tecken. Utgå från att telefonen
      // hålls någorlunda upprätt första gången, så att nedåt blir nedåt.
      if (!tecken && Math.abs(g.y) > 3) tecken = g.y < 0 ? 1 : -1;
      if (!tecken) return;
      const gx = g.x * tecken, gy = g.y * tecken;
      const m = Math.hypot(gx, gy);
      const andel = klamp(m / 9.8, 0, 1);
      const nx = (gx / (m || 1)) * andel, ny = (gy / (m || 1)) * andel + (1 - andel) * -1;
      const n = Math.hypot(nx, ny) || 1;
      tyngd = [nx / n, ny / n];
    };
    window.addEventListener('devicemotion', lutning);

    // ---------- Speldosan ----------
    const l = rumsLjud(1.3, 2);
    const { ctx, ut } = l;
    const eko = rum(2.2);
    const ekoUt = ctx.createGain(); ekoUt.gain.value = 0.35;
    eko.connect(ekoUt).connect(ut);
    const TAND = [[1, 1, 2.4], [2.0, 0.16, 1.0], [5.04, 0.07, 0.35], [9.3, 0.025, 0.12]];
    let spel = null;         // { start, varv, slag }
    let spelNiva = 0;
    // Speldosan: en inspelning av en riktig speldosa som spelar "What Child is This".
    // Den spelas en gång varje gång nyckeln dras upp, aldrig i loop. Diskanten är
    // dämpad så att den inte skär. Går den inte att ladda spelas den framräknade visan.
    const dosaTyst = ctx.createGain(); dosaTyst.gain.value = 1;
    const dosaDiskant = ctx.createBiquadFilter(); dosaDiskant.type = 'highshelf'; dosaDiskant.frequency.value = 3000; dosaDiskant.gain.value = -8;
    const dosaLp = ctx.createBiquadFilter(); dosaLp.type = 'lowpass'; dosaLp.frequency.value = 7000; dosaLp.Q.value = 0.6;
    const dosaNiva = ctx.createGain(); dosaNiva.gain.value = 0;
    dosaNiva.connect(dosaDiskant).connect(dosaLp).connect(dosaTyst).connect(ut);
    const dosaEko = ctx.createGain(); dosaEko.gain.value = 0.3;
    dosaTyst.connect(dosaEko).connect(eko);
    let dosa = null, dosaKalla = null, tyst = false, dosaLage = 'laddar', vantarPaDosa = false;
    laddaInspelning(ctx, 'ljud/snoglob-speldosa.mp3').then((b) => {
      // Nivån efter inspelningens starkaste topp
      let topp = 0;
      for (let k = 0; k < b.numberOfChannels; k++) { const d = b.getChannelData(k); for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > topp) topp = v; } }
      dosaNiva.gain.value = Math.min(4, 0.11 / Math.max(topp, 1e-4));
      dosa = b;
      dosaLage = 'klar';
      if (vantarPaDosa) { vantarPaDosa = false; starta(); }
    }, () => {
      dosaLage = 'fel';
      if (vantarPaDosa) { vantarPaDosa = false; starta(); }
    });
    function dra() {
      // Nyckeln knäpper när den dras upp, och sedan börjar visan
      const t = ctx.currentTime;
      for (let i = 0; i < 5; i++) brusstot(ctx, ut, { frekvens: slump(2200, 3200), q: 3, styrka: 0.035, langd: 0.0012, nar: t + i * 0.11 });
      // Drar hon upp nyckeln vill hon höra den, så ljudet slås på igen
      if (tyst) satTyst(false);
      if (spel) return;   // spelar redan: melodin fortsätter
      // Är inspelningen inte laddad än börjar visan så fort den är det
      if (dosaLage === 'laddar') { vantarPaDosa = true; return; }
      starta();
    }
    function starta() {
      if (spel || tyst) return;
      const t = ctx.currentTime;
      if (dosa) {
        const k = ctx.createBufferSource();
        k.buffer = dosa;
        k.connect(dosaNiva);
        k.start(t + 0.8);
        dosaKalla = k;
        spel = { inspelning: true, slut: t + 0.8 + dosa.duration };
        k.onended = () => { if (dosaKalla === k) { dosaKalla = null; spel = null; } };
        return;
      }
      spel = { nasta: t + 0.8, steg: 0, total: MELODI.length * 3 * 2 };
    }
    // Ljudknappen: stänger av och slår på speldosan
    const knapp = document.createElement('button');
    knapp.className = 'lucka-ui';
    knapp.style.cssText = 'top:calc(env(safe-area-inset-top) + 8px);right:8px;width:48px;height:48px;border:0;background:none;color:rgba(255,255,255,0.35);display:grid;place-items:center;cursor:pointer;';
    const IKON_PA = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9h3l5-4v14l-5-4H4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 010 7M18 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    const IKON_AV = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9h3l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    function satTyst(av) {
      tyst = av;
      const t = ctx.currentTime;
      dosaTyst.gain.cancelScheduledValues(t);
      dosaTyst.gain.setTargetAtTime(av ? 0 : 1, t, 0.15);
      if (av) {
        // Stoppa visan när den har tonat ut
        const k = dosaKalla; dosaKalla = null; spel = null;
        if (k) setTimeout(() => { try { k.stop(); } catch {} }, 700);
      }
      knapp.innerHTML = av ? IKON_AV : IKON_PA;
      knapp.setAttribute('aria-label', av ? 'Slå på speldosan' : 'Stäng av speldosan');
    }
    knapp.addEventListener('click', () => satTyst(!tyst));
    satTyst(false);
    scen.append(knapp);
    l.kallor.push({ stop: () => { try { dosaKalla && dosaKalla.stop(); } catch {} } });
    function spelaVidare() {
      if (!spel) return;
      const t = ctx.currentTime;
      if (spel.inspelning) { if (t > spel.slut + 0.2) spel = null; return; }
      while (spel && spel.nasta < t + 0.25) {
        const kvar = 1 - spel.steg / spel.total;
        // Fjädern går ut: tempot saktar in under sista varvet
        const slag = 0.52 * (1 + 0.9 * Math.pow(Math.max(0, 0.5 - kvar) * 2, 2));
        const takt = Math.floor(spel.steg / 3) % MELODI.length, slagI = spel.steg % 3;
        const ton = MELODI[takt][slagI];
        if (ton) klang(ctx, ut, hz(ton) * slump(0.999, 1.001), TAND, { styrka: 0.03 * (0.85 + 0.15 * Math.random()), ansats: 0.002, eko, nar: spel.nasta });
        if (slagI === 0) klang(ctx, ut, hz(BAS[takt]), TAND, { styrka: 0.018, ansats: 0.002, eko, nar: spel.nasta });
        spel.nasta += slag;
        spel.steg++;
        if (spel.steg >= spel.total) spel = null;
      }
    }
    // Speldosan spelar en gång av sig själv när rummet öppnas
    setTimeout(() => { if (!spel && !tyst) dra(); }, 2200);

    // Vattnet som skvalpar när kulan skakas
    const vatten = brusKalla('rosa');
    const vaF = ctx.createBiquadFilter(); vaF.type = 'lowpass'; vaF.frequency.value = 500;
    const vaG = ctx.createGain(); vaG.gain.value = 0;
    vatten.connect(vaF).connect(vaG).connect(ut);
    // Rummets stillhet
    const rumston = brusKalla('rosa');
    const rF = ctx.createBiquadFilter(); rF.type = 'lowpass'; rF.frequency.value = 200;
    const rG = ctx.createGain(); rG.gain.value = 0.02;
    rumston.connect(rF).connect(rG).connect(ut);
    l.kallor.push(vatten, rumston);

    // ---------- Fingret ----------
    const tillVarld = (x, y) => [x / duk.clientWidth, (duk.clientHeight - y) / duk.clientWidth];
    const tillKula = (wx, wy) => [(wx - mitt.x) / R, (wy - mitt.y) / R];
    let forra = null;
    fingrar(duk, {
      ner: (x, y, id, e) => { const [wx, wy] = tillVarld(x, y); forra = { x: wx, y: wy, t: e.timeStamp }; },
      drag: (x, y, id, e) => {
        const [wx, wy] = tillVarld(x, y);
        if (forra) {
          const dtt = Math.max(0.008, (e.timeStamp - forra.t) / 1000);
          const vx = (wx - forra.x) / dtt, vy = (wy - forra.y) / dtt;
          const [kx, ky] = tillKula(wx, wy);
          if (Math.hypot(kx, ky) < 1.2) {
            // Vattnet i en sluten kula kan bara cirkulera, så svepet sätter det i rörelse
            // runt kulan och lämnar virvlar efter sig. En liten knuff åt svepets håll
            // klingar av nästan direkt.
            svepX = klamp(svepX + vx * 0.01, -0.25, 0.25);
            svepY = klamp(svepY + vy * 0.01, -0.25, 0.25);
            const fart = Math.hypot(vx, vy);
            // Virveln snurrar åt det håll svepet går runt kulans mitt
            const runt = Math.sign(kx * vy - ky * vx) || 1;
            if (Math.random() < 0.5) virvla(kx + slump(-0.2, 0.2), ky - 0.2, klamp(fart * 0.3, 0, 0.8) * runt);
            rotation = klamp(rotation + runt * fart * 0.03, -1.2, 1.2);
            skvalp = Math.min(1, skvalp + fart * 0.01);
            oro = Math.min(1, oro + fart * 0.01);
          }
        }
        forra = { x: wx, y: wy, t: e.timeStamp };
      },
      upp: (x, y, id, { tryck }) => {
        forra = null;
        if (!tryck) return;
        const [wx, wy] = tillVarld(x, y);
        const [kx, ky] = tillKula(wx, wy);
        // Foten och nyckeln drar upp speldosan, ett tryck på kulan ger en liten skakning
        if (ky < -0.92 && ky > -1.45 && Math.abs(kx) < 1.25) dra();
        else if (Math.hypot(kx, ky) < 1) skaka(0.5);
      },
    }, { ett: true });

    // ---------- Ritslinga ----------
    const stoppa = slinga((tid, dt) => {
      const avkl = Math.exp(-dt / 3.5);
      for (const v of virvlar) {
        v.s *= avkl;
        // Virvlarna följer med kulans snurr och svep och glider sakta runt
        const [vx, vy] = flode(v.x, v.y, false);
        v.x += vx * dt; v.y += vy * dt;
        const vr = Math.hypot(v.x, v.y);
        if (vr > 0.85) { v.x *= 0.85 / vr; v.y *= 0.85 / vr; }
      }
      rotation *= Math.exp(-dt / 2.5);
      klocka += dt;
      oro *= Math.exp(-dt / 5);
      // Flingornas egen drift ändras mjukt, aldrig ryckigt
      const driftK = Math.sqrt(2 * Math.max(0, dt) / 1.2) * (0.02 + 0.1 * oro);
      const driftA = Math.exp(-Math.max(0, dt) / 1.2);
      svepX *= Math.exp(-dt / 0.35); svepY *= Math.exp(-dt / 0.35);
      skvalp *= Math.exp(-dt * 1.5);

      flingor.forEach((f, i) => {
        const [ux, uy] = flode(f.x, f.y, true, f.z);
        const flodesFart = Math.hypot(ux, uy);
        if (f.vila) {
          if (flodesFart > 0.12 + 0.1 * (i % 3)) {
            // Strömmen river upp snön från marken
            f.vila = false;
            f.vy = flodesFart * slump(0.3, 0.9);
            f.vx += slump(-0.1, 0.1);
          }
          else return set(i, f);
        }
        // Flingan är så lätt att den bärs av vattnet nästan exakt. Det egna farten
        // (från en skakning) bromsas snabbt av vattnet, och sedan sjunker den bara
        // långsamt åt tyngdens håll. Vattnets fart tas i mittpunkten av steget, så att
        // flingor som snurrar runt inte glider utåt av räknefel.
        const broms = Math.exp(-dt / 0.5);
        f.vx *= broms; f.vy *= broms;
        const [mx, my] = flode(f.x + ux * dt * 0.5, f.y + uy * dt * 0.5, true, f.z);
        f.wx = f.wx * driftA + gauss() * driftK;
        f.wy = f.wy * driftA + gauss() * driftK;
        f.x += (mx + f.vx + f.wx + tyngd[0] * f.fall) * dt;
        f.y += (my + f.vy + f.wy + tyngd[1] * f.fall) * dt;
        // Glasväggen: vattnet strömmar bara längs glaset, så flingan glider av
        const rr = Math.hypot(f.x, f.y);
        if (rr > 0.97) {
          const nx = f.x / rr, ny = f.y / rr;
          f.x = nx * 0.97; f.y = ny * 0.97;
          const vn = f.vx * nx + f.vy * ny;
          if (vn > 0) { f.vx -= vn * nx; f.vy -= vn * ny; }
        }
        // Marken: flingan lägger sig när den når snön och vattnet är lugnt
        const gy = MARK(f.x);
        if (f.y < gy) {
          f.y = gy;
          if (flodesFart < 0.1 && tyngd[1] < -0.5) { f.vila = true; f.vx = 0; f.vy = 0; }
        }
        set(i, f);
      });
      function set(i, f) {
        data[i * 4] = mitt.x + f.x * R;
        data[i * 4 + 1] = mitt.y + f.y * R;
        data[i * 4 + 2] = f.storlek;
        // Flingor längre bak i kulan syns lite svagare
        data[i * 4 + 3] = f.ljus * (0.85 - 0.15 * f.z) * (f.vila ? 0.55 : 1);
      }

      spelaVidare();
      spelNiva += ((spel ? 1 : 0) - spelNiva) * Math.min(1, dt * 1.5);
      const t = ctx.currentTime;
      vaG.gain.setTargetAtTime(0.06 * skvalp, t, 0.1);
      vaF.frequency.setTargetAtTime(300 + 500 * skvalp, t, 0.15);

      anpassa(gl, duk, 0.75);
      gl.viewport(0, 0, duk.width, duk.height);
      const synlig = mjuk(0, 2.5, tid);
      gl.useProgram(bak);
      gl.bindVertexArray(tom);
      gl.uniform2f(bu.u_res, duk.width, duk.height);
      gl.uniform1f(bu.u_tid, tid);
      gl.uniform2f(bu.u_mitt, mitt.x, mitt.y);
      gl.uniform1f(bu.u_spel, spelNiva);
      gl.uniform1f(bu.u_synlig, synlig);
      ritaHelskarm(gl);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(flingProg);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
      gl.uniform1f(fu.u_H, duk.clientHeight / duk.clientWidth);
      gl.uniform2f(fu.u_mitt, mitt.x, mitt.y);
      gl.uniform1f(fu.u_synlig, synlig);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, FLINGOR);

      gl.useProgram(glas);
      gl.bindVertexArray(tom);
      gl.uniform2f(gu.u_res, duk.width, duk.height);
      gl.uniform2f(gu.u_mitt, mitt.x, mitt.y);
      gl.uniform1f(gu.u_synlig, synlig);
      ritaHelskarm(gl);
      gl.disable(gl.BLEND);
    });

    return stangning({ ljud: l, stoppa, gl, extra: [slutaSkak, () => window.removeEventListener('devicemotion', lutning)] });
  },
};
