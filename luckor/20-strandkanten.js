// Lucka 20: Strandkanten
// En sandstrand sedd uppifrån, med havet högst upp. Hon skriver eller ritar i den våta
// sanden med fingret, som med en pinne. Med ojämna mellanrum sköljer en våg upp, olika långt varje gång,
// och där vattnet når slätas fårorna sakta ut. Det är meningen att det ska försvinna.
// Sanden är ett höjdfält. Vågens framkant följer samma formel i JavaScript och shadern.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { brusKalla } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { mjuk, slump, rumsLjud, slinga, fingrar, stangning, brusstot } from '../lib/scen.js';
import { skapaMatta, skapaLjudbank } from '../lib/inspelning.js';

// De enskilda vågorna i inspelningen av mjuka vågor på sand, [start, längd]
const VAGOR = [[0.1, 2.2], [2.35, 2.0], [4.3, 2.0], [6.5, 1.7], [8.1, 2.3], [10.3, 2.0], [13.3, 2.5], [16.1, 1.8], [18.2, 2.0], [20.1, 1.6]];

const SW = 192, SH = 420;
const BAS = 0.5;

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform sampler2D u_sand;   // r: höjd, g: väta
uniform vec2 u_rut;
uniform vec3 u_vag;         // framkantens läge (0 uppe, 1 nere), frö, hur mycket vatten som är kvar
uniform float u_tid;
uniform float u_synlig;
uniform vec2 u_pp[5];       // pinnen: från spetsen och bakåt mot handen
uniform vec4 u_kvist;       // en liten avbruten sidokvist: från, till
uniform float u_pa;         // hur synlig pinnen är
uniform float u_lyft;       // 1 när kvisten svävar över sanden, 0 när spetsen ristar
uniform vec4 u_avtryck;     // fingeravtrycket där man håller: x, y, riktning, synlighet
uniform vec4 u_tumlare;     // tumlaren: x, y (som sanden, y nedåt), rullningens fas (0..1), riktning
uniform float u_tumlareA;   // synlig när den är i ytan
uniform vec4 u_fynd[4];     // sådant vågen lämnat: x, y (som sanden, y nedåt), sort + vinkel, synlighet
${BRUS}

// Avstånd till en sträcka, och var längs sträckan närmaste punkten ligger
float strDist(vec2 p, vec2 a, vec2 b, out float h, out float sida) {
  vec2 ab = b - a, ap = p - a;
  h = clamp(dot(ap, ab) / dot(ab, ab), 0.0, 1.0);
  vec2 d = ap - ab * h;
  vec2 t = normalize(ab);
  sida = dot(d, vec2(-t.y, t.x));
  return length(d);
}
// Pinnen är smal vid spetsen och grövre bakåt, och lite knölig
float pinnRadie(float s) {
  return mix(0.0032, 0.0095, smoothstep(0.0, 0.9, s)) * (1.0 + 0.12 * sin(s * 47.0) + 0.08 * sin(s * 113.0));
}

float framkant(float x, float vag, float fro) {
  return vag + 0.018 * sin(x * 7.0 + fro) + 0.012 * sin(x * 15.0 + fro * 1.7) + 0.007 * sin(x * 31.0 + fro * 2.3);
}

// Sådant som vågen lämnar kvar, sett uppifrån. q är i skärmbredder, vriden.
// Ett hjärtmusselskal: rundat med strålande ribbor och tillväxtringar
vec4 hjartmussla(vec2 q) {
  vec2 r = q / 0.017;
  r.y += 0.25 * r.x * r.x;
  float d = length(r * vec2(1.0, 1.08));
  float a = smoothstep(1.0, 0.85, d);
  if (a <= 0.0) return vec4(0.0);
  float v = atan(r.x, -(r.y - 0.9));
  float ribba = 0.5 + 0.5 * cos(v * 22.0);
  vec3 col = mix(vec3(0.86, 0.8, 0.7), vec3(0.95, 0.91, 0.84), ribba);
  col *= 0.94 + 0.06 * sin(length(r - vec2(0.0, 0.9)) * 22.0);
  col = mix(col, vec3(0.62, 0.5, 0.4), smoothstep(0.35, 0.0, length(r - vec2(0.0, 0.85))) * 0.6);
  return vec4(col * (0.8 + 0.25 * (1.0 - d)), a);
}
// Ett blåmusselskal: avlångt, blåsvart och blankt, med en brun kant
vec4 blamussla(vec2 q) {
  vec2 r = q / vec2(0.012, 0.024);
  float w = 1.0 - 0.35 * smoothstep(-1.0, 1.0, r.y);
  float d = length(vec2(r.x / w, r.y));
  float a = smoothstep(1.0, 0.85, d);
  if (a <= 0.0) return vec4(0.0);
  vec3 col = mix(vec3(0.06, 0.07, 0.12), vec3(0.18, 0.2, 0.3), smoothstep(0.8, 0.2, abs(r.x / w - 0.25)));
  col = mix(col, vec3(0.35, 0.25, 0.15), smoothstep(0.75, 0.98, d));
  col += vec3(0.5, 0.55, 0.65) * smoothstep(0.25, 0.0, abs(r.x / w + 0.3)) * smoothstep(0.9, 0.0, abs(r.y)) * 0.35;
  return vec4(col, a);
}
// En liten vanlig sjöstjärna: fem lätt böjda armar, orange med ljusa knottror
vec4 sjostjarna(vec2 q) {
  float R = 0.026;
  float v = atan(q.y, q.x);
  float r = length(q) / R;
  float arm = pow(0.5 + 0.5 * cos(5.0 * v + 0.35 * sin(r * 3.0)), 1.5);
  float gr = 0.34 + 0.66 * arm;
  float a = smoothstep(gr, gr - 0.08, r);
  if (a <= 0.0) return vec4(0.0);
  vec3 col = mix(vec3(0.72, 0.28, 0.12), vec3(0.88, 0.48, 0.22), arm * (1.0 - r));
  vec2 kc = floor(q * 600.0);
  col = mix(col, vec3(0.95, 0.8, 0.6), step(0.82, hash(kc)) * 0.6);
  col *= 0.75 + 0.35 * smoothstep(gr, 0.0, r);
  return vec4(col, a);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 tc = vec2(uv.x, 1.0 - uv.y);
  float asp = u_res.y / u_res.x;
  vec2 p = vec2(uv.x, uv.y * asp);

  vec4 t = texture(u_sand, tc);
  vec2 e = 1.0 / u_rut;
  float hx = texture(u_sand, tc + vec2(e.x, 0.0)).r - texture(u_sand, tc - vec2(e.x, 0.0)).r;
  float hy = texture(u_sand, tc + vec2(0.0, e.y)).r - texture(u_sand, tc - vec2(0.0, e.y)).r;
  vec3 n = normalize(vec3(-hx * 7.0, hy * 7.0, 1.0));
  vec3 L = normalize(vec3(-0.5, 0.55, 0.65));
  float lj = max(dot(n, L), 0.0);
  // Botten av en fåra ligger i skugga, toppen av vallarna fångar ljuset
  float grop = clamp((${BAS.toFixed(2)} - t.r) * 9.0, 0.0, 0.5);
  float topp = clamp((t.r - ${BAS.toFixed(2)}) * 10.0, 0.0, 0.3);

  // Sanden: ljus och torr längst ner, mörk och blank där den är våt
  float korn = hash(floor(gl_FragCoord.xy));
  vec3 torr = vec3(0.88, 0.80, 0.64) * (0.94 + 0.1 * korn) * (0.95 + 0.08 * fbm(p * 5.0));
  vec3 vat = vec3(0.56, 0.48, 0.37) * (0.95 + 0.08 * korn);
  // Vätan suddas ut och får en oregelbunden kant, så att den inte syns som rutor
  vec2 skaka = (vec2(fbm(p * 9.0), fbm(p * 9.0 + 7.3)) - 0.5) * e * 6.0;
  float vata = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 o = vec2(float(i & 1) - 0.5, float(i >> 1) - 0.5) * e * 3.0;
    vata += texture(u_sand, tc + skaka + o).g * 0.25;
  }
  vata = smoothstep(0.05, 0.95, vata);
  vec3 sand = mix(torr, vat, vata) * (0.55 + 0.6 * lj) * (1.0 - grop) * (1.0 + topp * 0.4);
  // Våt sand speglar himlen
  float glans = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 30.0);
  sand += vec3(0.75, 0.8, 0.85) * glans * vata * 0.25;
  sand += vec3(0.35, 0.45, 0.55) * vata * 0.06;
  // Några snäckor och småstenar
  vec2 sc = floor(p * 11.0);
  vec2 so = (fract(p * 11.0) - 0.5 - (hash2(sc) - 0.5) * 0.6) * vec2(1.0, 1.4 + hash(sc + 9.0));
  if (hash(sc + 3.0) > 0.93) {
    float sk = smoothstep(0.075, 0.055, length(so));
    vec3 snacka = mix(vec3(0.86, 0.8, 0.74), vec3(0.55, 0.47, 0.42), hash(sc + 5.0));
    sand = mix(sand, snacka * (0.6 + 0.5 * dot(normalize(vec3(-so, 0.06)), L)), sk);
  }
  vec3 c = sand;

  // Snäckor och sjöstjärnor som vågen lämnat, med en liten skugga och lite blänk av väta
  for (int i = 0; i < 4; i++) {
    vec4 f = u_fynd[i];
    if (f.w <= 0.0) continue;
    vec2 d = (tc - f.xy) * vec2(1.0, asp);
    d.y = -d.y;
    float sort = floor(f.z);
    float v = fract(f.z) * 6.2832;
    float cv = cos(v), sv = sin(v);
    vec2 q = vec2(cv * d.x + sv * d.y, -sv * d.x + cv * d.y);
    vec2 qs = q - vec2(cv * 0.003 + sv * 0.003, -sv * 0.003 + cv * 0.003);
    vec4 fy = sort < 0.5 ? hjartmussla(q) : sort < 1.5 ? blamussla(q) : sjostjarna(q);
    vec4 sk = sort < 0.5 ? hjartmussla(qs) : sort < 1.5 ? blamussla(qs) : sjostjarna(qs);
    c *= 1.0 - 0.3 * sk.a * f.w;
    c = mix(c, fy.rgb * (0.95 + 0.1 * vata), fy.a * f.w);
  }

  // Vattnet som sköljer upp, med skum i framkanten
  float y = tc.y;
  // Kanten får en liten oregelbundenhet till som bara syns, utan att påverka sanden
  float fram = framkant(uv.x, u_vag.x, u_vag.y) + (fbm(vec2(uv.x * 14.0, u_vag.y)) - 0.5) * 0.012;
  float under = fram - y;
  if (under > 0.0 && u_vag.z > 0.0) {
    // Svallet är grunt och genomskinligt längst fram och djupnar uppåt mot havet
    float djup = smoothstep(0.0, 0.45, under);
    vec2 rorelse = vec2(0.0, u_tid * 0.05);
    float krus = fbm(vec2(p.x * 7.0, p.y * 12.0) + rorelse);
    vec3 grunt = vec3(0.45, 0.62, 0.6);
    vec3 djupt = vec3(0.07, 0.3, 0.4);
    vec3 hav = mix(grunt, djupt, djup) + vec3(0.06, 0.08, 0.08) * (krus - 0.5);
    float tackning = (0.25 + 0.65 * djup) * u_vag.z;
    // Sanden under vattnet syns mörkare och lite förskjuten av ytan
    c = mix(c * vec3(0.82, 0.88, 0.9), hav, tackning);
    // Himlens reflex i krusningarna
    c += vec3(0.8, 0.85, 0.9) * smoothstep(0.62, 0.8, krus) * 0.08 * u_vag.z;
    // Skummet: en vit spets i framkanten som spricker upp i spets bakåt
    float spets = smoothstep(0.012, 0.0, under) * (0.75 + 0.25 * brus(vec2(uv.x * 80.0, u_tid)));
    float lager = smoothstep(0.08, 0.0, under);
    vec2 sp = vec2(uv.x * 26.0, y * 46.0) + vec2(0.0, u_tid * 0.15);
    float nat = abs(fbm(sp) - 0.5) * 2.0;
    float spetsar = smoothstep(0.12, 0.0, nat) * lager;
    float skum = clamp(spets + spetsar * 0.7, 0.0, 1.0);
    c = mix(c, vec3(0.94, 0.96, 0.95), skum * 0.85 * u_vag.z);
  }
  // Det öppna havet högst upp, med bränningar
  float havKant = 0.12 + 0.01 * sin(uv.x * 7.0 + u_tid * 0.3);
  if (y < havKant) {
    vec3 hav = vec3(0.06, 0.28, 0.38) + vec3(0.06, 0.08, 0.08) * fbm(vec2(p.x * 6.0, p.y * 10.0 + u_tid * 0.5));
    float vagband = smoothstep(0.6, 0.9, sin(y * 90.0 - u_tid * 1.5 + fbm(p * 4.0) * 3.0));
    hav = mix(hav, vec3(0.85, 0.9, 0.9), vagband * 0.35);
    // En tumlare som rullar i ytan: först välver sig ryggen upp, sedan syns den låga,
    // rundade ryggfenan, och så sjunker den igen. Lite skum runt där den bryter ytan.
    if (u_tumlareA > 0.0) {
      float r = u_tumlare.z;
      vec2 d = (tc - u_tumlare.xy) * vec2(1.0, asp);
      d.x *= u_tumlare.w;
      float L = 0.11;
      float synl = sin(3.1416 * clamp(r, 0.0, 1.0));
      // Ryggen: den del som är över ytan flyttar sig framåt medan den rullar
      float mitt = (r - 0.5) * L * 0.9;
      float halv = L * 0.5 * synl;
      // Bara den del av ryggen som är ovanför vattenlinjen syns, som en välvd båge
      float rygg = smoothstep(1.0, 0.85, length(vec2((d.x - mitt) / max(halv, 1e-4), d.y / (0.017 * synl + 1e-4)))) * step(d.y, 0.0015);
      // Fenan: låg, rundad och bakåtlutad, mitt på ryggen
      float fr = clamp((r - 0.25) / 0.55, 0.0, 1.0);
      float fh = 0.034 * sin(3.1416 * fr);
      vec2 fq = vec2(d.x - mitt + 0.006, -d.y - 0.004 * synl);
      float fy = fq.y / max(fh, 1e-4);
      float fbredd = 0.019 * (1.0 - fy) * (0.6 + 0.4 * (1.0 - fy)) + 0.0015;
      float fena = step(0.0, fq.y) * step(fy, 1.0) * smoothstep(fbredd, fbredd - 0.002, abs(fq.x + fq.y * 0.55 - 0.004));
      vec3 gra = vec3(0.11, 0.13, 0.15);
      vec3 hud = gra + vec3(0.22, 0.25, 0.28) * smoothstep(0.006, -0.002, d.y + 0.01 * synl) * rygg;
      float tack = max(rygg, fena) * u_tumlareA;
      hav = mix(hav, hud, tack);
      // Skum längs vattenlinjen där ryggen bryter ytan
      float linje = exp(-pow(d.y / 0.004, 2.0)) * smoothstep(halv + 0.025, halv, abs(d.x - mitt)) * (0.4 + 0.6 * brus(gl_FragCoord.xy * 0.35 + u_tid * 3.0));
      hav = mix(hav, vec3(0.88, 0.92, 0.92), linje * synl * 0.75 * u_tumlareA);
    }
    c = hav;
  }

  // ---- Pinnen hon skriver med ----
  if (u_pa > 0.0) {
    float px = 1.0 / u_res.x;
    // Skuggan: pinnen lyfter från sanden bakåt, och skuggan hamnar snett nedåt höger
    vec2 sDir = vec2(0.5, -0.55) / 0.65;
    float skugga = 0.0;
    for (int i = 0; i < 4; i++) {
      float h0 = float(i) / 4.0, h1 = float(i + 1) / 4.0;
      vec2 a = u_pp[i] + sDir * (0.025 * u_lyft + 0.07 * h0 * h0), b = u_pp[i + 1] + sDir * (0.025 * u_lyft + 0.07 * h1 * h1);
      float hh, sd;
      float d = strDist(p, a, b, hh, sd);
      float s0 = (float(i) + hh) / 4.0;
      float r = pinnRadie(s0);
      float sudd = 0.002 + 0.02 * s0 + 0.006 * u_lyft;
      skugga = max(skugga, smoothstep(r + sudd, r - sudd * 0.5, d) * (0.42 - 0.22 * s0));
    }
    c *= 1.0 - skugga * u_pa;

    // Själva pinnen: solblekt drivved
    float bast = 1e9, bs = 0.0, bsida = 0.0, br = 1.0, kvist = 0.0;
    for (int i = 0; i < 4; i++) {
      float hh, sd;
      float d = strDist(p, u_pp[i], u_pp[i + 1], hh, sd);
      float s0 = (float(i) + hh) / 4.0;
      float r = pinnRadie(s0);
      if (d - r < bast) { bast = d - r; bs = s0; bsida = sd / r; br = r; kvist = 0.0; }
    }
    {
      float hh, sd;
      float d = strDist(p, u_kvist.xy, u_kvist.zw, hh, sd);
      float r = mix(0.0042, 0.0022, hh);
      if (d - r < bast) { bast = d - r; bs = 0.5 + hh * 0.1; bsida = sd / r; br = r; kvist = 1.0 - hh; }
    }
    float tack = smoothstep(px * 1.2, -px * 0.6, bast);
    if (tack > 0.0) {
      float tv = clamp(bsida, -1.0, 1.0);
      vec3 nn = normalize(vec3(-tv * 0.9, tv * 0.4, sqrt(max(0.0, 1.0 - tv * tv)) + 0.1));
      float lp = max(dot(nn, L), 0.0);
      // Ådring längs pinnen, några mörka kvistfästen och en sandig spets
      float adr = 0.86 + 0.14 * sin(bs * 520.0 + tv * 2.5 + fbm(vec2(bs * 30.0, tv * 2.0)) * 4.0);
      vec3 tra = vec3(0.64, 0.58, 0.49) * adr;
      tra = mix(tra, vec3(0.33, 0.27, 0.21), smoothstep(0.03, 0.0, abs(bs - 0.36)) * smoothstep(0.9, 0.2, abs(tv)) * 0.8);
      tra = mix(tra, vec3(0.30, 0.25, 0.19), smoothstep(0.025, 0.0, abs(bs - 0.71)) * smoothstep(0.8, 0.1, abs(tv)) * 0.7);
      tra = mix(tra, vec3(0.78, 0.71, 0.57), smoothstep(0.06, 0.0, bs) * (1.0 - kvist));
      tra *= 0.45 + 0.75 * lp;
      tra += vec3(1.0, 0.97, 0.9) * pow(max(dot(reflect(-L, nn), vec3(0.0, 0.0, 1.0)), 0.0), 12.0) * 0.12;
      c = mix(c, tra, tack * u_pa);
    }
    // Ett diskret fingeravtryck där man håller i kvisten, tills hon har tagit i den
    if (u_avtryck.w > 0.0) {
      vec2 q = p - u_avtryck.xy;
      float ca = cos(u_avtryck.z), sa = sin(u_avtryck.z);
      q = vec2(ca * q.x + sa * q.y, -sa * q.x + ca * q.y);
      float e = length(q / vec2(0.07, 0.05));
      float linjer = smoothstep(0.34, 0.0, abs(fract(e * 6.0 + 0.25 * fbm(q * 160.0)) - 0.5));
      float yta = smoothstep(1.0, 0.7, e);
      // En svag, matt fläck och tunna linjer, som ett avtryck i damm
      c = mix(c, c * 0.84 + vec3(0.02), yta * 0.6 * u_avtryck.w);
      c = mix(c, c * 0.6 + vec3(0.03), linjer * yta * 0.7 * u_avtryck.w);
    }
  }

  c *= 1.0 - 0.25 * pow(length(uv - 0.5) * 1.3, 2.5);
  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, u_tid), 1.0);
}`;

const framkant = (x, vag, fro) => vag + 0.018 * Math.sin(x * 7 + fro) + 0.012 * Math.sin(x * 15 + fro * 1.7) + 0.007 * Math.sin(x * 31 + fro * 2.3);

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, ['u_res', 'u_sand', 'u_rut', 'u_vag', 'u_tid', 'u_synlig', 'u_pp', 'u_kvist', 'u_pa', 'u_lyft', 'u_avtryck', 'u_fynd', 'u_tumlare', 'u_tumlareA']);

    // ---------- Sanden ----------
    const N = SW * SH;
    const h = new Float32Array(N).fill(BAS), vata = new Float32Array(N);
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      // Lite mjuka vågmönster i sanden efter tidigare vågor
      h[y * SW + x] = BAS + 0.005 * Math.sin(y * 0.21 + 2 * Math.sin(x * 0.031) + 0.7 * Math.sin(x * 0.09 + y * 0.02));
      vata[y * SW + x] = y < SH * 0.55 ? 1 - y / (SH * 0.55) * 0.4 : Math.max(0, 0.6 - (y - SH * 0.55) / (SH * 0.2));
    }

    // Vi minns hur långt ner hon har skrivit, så att en våg förr eller senare når ända dit.
    let lagst = 0, skrevs = 0, klocka = 0;
    // Pinnen ritar en smal, skarp fåra med V-form. Sanden den tränger undan läggs som
    // små vallar längs kanterna, och djupet skiftar lite som när en kvist darrar i handen.
    let pinnTid = 0;
    function grav(cx, cy) {
      if (cy / SH > lagst) { lagst = cy / SH; skrevs = klocka; }
      pinnTid += 0.13;
      const R = 1.5;
      const djup = 0.075 * (0.85 + 0.15 * Math.sin(pinnTid * 1.7) * Math.sin(pinnTid * 0.6 + 1));
      const VALL = 1.8;
      for (let y = Math.max(1, Math.floor(cy - R - VALL)); y <= Math.min(SH - 2, Math.ceil(cy + R + VALL)); y++) {
        for (let x = Math.max(1, Math.floor(cx - R - VALL)); x <= Math.min(SW - 2, Math.ceil(cx + R + VALL)); x++) {
          const d = Math.hypot(x - cx, y - cy);
          const i = y * SW + x;
          if (d < R) {
            const mal = BAS - djup * (1 - d / R);
            if (h[i] > mal) h[i] += (mal - h[i]) * 0.6;
          } else if (d < R + VALL) {
            const mal = BAS + 0.03 * (1 - (d - R) / VALL);
            if (h[i] < mal) h[i] += (mal - h[i]) * 0.25;
          }
        }
      }
      // Ibland lossnar ett litet sandkorn och hamnar bredvid fåran
      if (Math.random() < 0.12) {
        const a = Math.random() * Math.PI * 2, r = R + VALL + Math.random() * 1.5;
        const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
        if (x > 0 && x < SW - 1 && y > 0 && y < SH - 1) h[y * SW + x] += 0.035;
      }
    }

    // ---------- Vågorna ----------
    // En våg: sköljer upp, stannar ett ögonblick och drar sig tillbaka
    let vag = { start: -10, nar: 0.45, langd: 7, fro: 0 };
    let nastaVag = 2;
    let vagLage = 0;
    let vatten = 0;
    function vaglage(tid) {
      const t = (tid - vag.start) / vag.langd;
      if (t < 0 || t > 1) return { y: 0.1, kvar: 0 };
      const upp = t < 0.4 ? 1 - Math.pow(1 - t / 0.4, 2) : 1 - Math.pow((t - 0.4) / 0.6, 1.4);
      return { y: 0.12 + (vag.nar - 0.12) * upp, kvar: t < 0.9 ? 1 : 1 - (t - 0.9) / 0.1 };
    }

    // ---------- Tumlaren ----------
    // Rör hon vid det djupa havet längst upp dyker en tumlare upp en stund efteråt och
    // rullar i ytan två eller tre gånger på väg förbi, med ett mjukt pustande andetag
    // varje gång den bryter ytan.
    let tumlare = null, tumlareVila = 0;
    function lockaTumlare(x) {
      if (tumlare || tumlareVila > 0) return;
      const rikt = x < 0.5 ? 1 : -1;
      tumlare = { x: Math.min(0.85, Math.max(0.15, x + slump(-0.15, 0.15))), y: slump(0.045, 0.075), rikt, kvar: Math.random() < 0.5 ? 2 : 3, t: -slump(1.2, 2.4), pustat: false };
      tumlareVila = 20;
    }
    function pust() {
      const t = ctx.currentTime;
      brusstot(ctx, ut, { frekvens: 900, q: 0.6, styrka: 0.06, langd: 0.09, nar: t });
      brusstot(ctx, ut, { frekvens: 500, q: 0.8, styrka: 0.04, langd: 0.14, nar: t + 0.03 });
    }
    function tumlareRor(dt) {
      tumlareVila -= dt;
      const T = tumlare;
      if (!T) return [0, 0, 0, 1, 0];
      T.t += dt;
      const RULL = 1.6, PAUS = 0.9;
      if (T.t < 0) return [0, 0, 0, 1, 0];
      const r = T.t / RULL;
      if (r <= 1) {
        if (!T.pustat && r > 0.3) { T.pustat = true; pust(); }
        return [T.x, T.y, r, T.rikt, 1];
      }
      // Under ytan en stund, och lite längre fram
      if (T.t > RULL + PAUS) {
        T.kvar--;
        if (T.kvar <= 0) { tumlare = null; return [0, 0, 0, 1, 0]; }
        T.t = 0; T.pustat = false;
        T.x += T.rikt * slump(0.12, 0.18);
        T.y += slump(-0.008, 0.008);
      }
      return [T.x, T.y, 0, T.rikt, 0];
    }

    // ---------- Fynd ----------
    // När en våg drar sig tillbaka lämnar den ibland en snäcka eller en liten sjöstjärna
    // vid sin högsta linje, där sådant hamnar på en riktig strand. En senare våg som når
    // dit kan skölja bort den igen.
    const fynd = Array.from({ length: 4 }, () => ({ x: 0, y: 0, z: 0, a: 0, mal: 0 }));
    const fyndData = new Float32Array(16);
    let vagVande = false;
    function lamnaFynd() {
      if (Math.random() > 0.4) return;
      const f = fynd.find((q) => q.mal === 0 && q.a < 0.01) ?? fynd[Math.floor(Math.random() * 4)];
      const r = Math.random();
      const x = slump(0.12, 0.88);
      Object.assign(f, {
        x, y: framkant(x, vag.nar, vag.fro) - slump(0.01, 0.04),
        z: (r < 0.45 ? 0 : r < 0.8 ? 1 : 2) + Math.random() * 0.999, mal: 1,
      });
    }
    function fyndRor(dt, drar) {
      // Vågen har nått sin högsta punkt och vänder
      if (drar && !vagVande && vatten > 0.9) { vagVande = true; lamnaFynd(); }
      if (!drar) vagVande = false;
      fynd.forEach((f, i) => {
        // Sköljer en våg över fyndet följer det ibland med ut
        if (f.mal > 0 && !drar && vatten > 0.9 && framkant(f.x, vagLage, vag.fro) > f.y + 0.02 && Math.random() < dt * 0.4) f.mal = 0;
        f.a += (f.mal - f.a) * Math.min(1, dt * (f.mal ? 2 : 0.8));
        fyndData.set([f.x, f.y, f.z, f.a], i * 4);
      });
    }

    // ---------- Ljud ----------
    const l = rumsLjud(1.6, 1.5);
    const { ctx, ut } = l;
    const branning = brusKalla('rosa');
    const brF = ctx.createBiquadFilter(); brF.type = 'lowpass'; brF.frequency.value = 300;
    const brG = ctx.createGain(); brG.gain.value = 0.05;
    const brLfo = ctx.createOscillator(); brLfo.frequency.value = 0.08;
    const brDjup = ctx.createGain(); brDjup.gain.value = 0.015;
    brLfo.connect(brDjup).connect(brG.gain);
    branning.connect(brF).connect(brG).connect(ut);
    brLfo.start();
    const svall = brusKalla('rosa');
    const svF = ctx.createBiquadFilter(); svF.type = 'bandpass'; svF.frequency.value = 700; svF.Q.value = 0.5;
    const svG = ctx.createGain(); svG.gain.value = 0;
    svall.connect(svF).connect(svG).connect(ut);
    const skrap = brusKalla('korn');
    const skF = ctx.createBiquadFilter(); skF.type = 'bandpass'; skF.frequency.value = 2300; skF.Q.value = 1.1;
    const skG = ctx.createGain(); skG.gain.value = 0;
    skrap.connect(skF).connect(skG).connect(ut);
    l.kallor.push(branning, brLfo, svall, skrap);
    // Havet: ett lugnt hav i bakgrunden, och en riktig våg som sköljer upp varje gång en
    // våg syns på skärmen. Går inspelningarna inte att ladda räknas ljuden fram.
    const havMatta = skapaMatta(ctx, ut, 'ljud/strand-hav.mp3', { niva: 0.02, bit: [10, 20], over: 4, hp: 80, tonhojd: 0.02, jamna: 0.3 });
    const vagBank = skapaLjudbank(ctx, ut, 'ljud/strand-vag.mp3', VAGOR, { maxTopp: 0.12, hp: 60 });
    l.kallor.push(havMatta, vagBank);
    let havInspelat = false, vagInspelad = false;
    havMatta.klar.then(() => { havInspelat = true; brG.gain.cancelScheduledValues(ctx.currentTime); brG.gain.setTargetAtTime(0, ctx.currentTime, 1); brDjup.gain.value = 0; }, () => {});
    vagBank.klar.then(() => { vagInspelad = true; }, () => {});

    // ---------- Fingret och pinnen ----------
    // En krokig kvist svävar en bit över sanden. Ett diskret fingeravtryck visar var man
    // håller i den, strax bakom den lilla sidokvisten, på handens sida. Tar hon där sänks kvisten ner
    // och sitter fast i fingret, och spetsen, en bit framför fingret, ristar i sanden
    // ända tills hon släpper. Tar hon på kvisten någon annanstans lyfter hon den i
    // stället och kan flytta den. Fri sand gör ingenting. Släpper hon svävar kvisten kvar.
    // Flyttar hon kvisten nära en kant vrider den sig själv så
    // att spetsen når ut mot kanten och skaftet hamnar inåt.
    // Kvistens form: vinklar och längder för varje del, från spetsen bakåt mot handen
    const FORM = [[0, 0.12], [0.2, 0.15], [-0.14, 0.14], [0.1, 0.13]];
    const GREPP = 0.36;               // från spetsen till fingret, längs kvisten, bakom sidokvisten
    // Kvistens lutning räknas från lodrätt, från bakänden mot spetsen, med spetsen åt höger
    // som plus. I vila lutar den lite åt vänster, och vid kanterna vrider den sig högst
    // MAX_LUTNING åt vardera hållet.
    const VILO_LUTNING = -5 * Math.PI / 180;
    const MAX_LUTNING = 25 * Math.PI / 180;
    const BAS_VINKEL = (() => {
      const v0 = Math.atan2(-0.89, 0.45);
      let x = 0, y = 0, v = v0;
      for (const [dv, l] of FORM) { v += dv; x += Math.cos(v) * l; y += Math.sin(v) * l; }
      // Vrids kvisten moturs minskar lutningen lika mycket
      return v0 + (Math.atan2(-x, -y) - VILO_LUTNING);
    })();
    // Lutningen blir VILO_LUTNING - kant, och den får inte gå utanför ±MAX_LUTNING
    const KANT_MIN = VILO_LUTNING - MAX_LUTNING, KANT_MAX = VILO_LUTNING + MAX_LUTNING;
    const asp = () => duk.clientHeight / duk.clientWidth;
    // Greppets läge (där fingret håller), och var den ska vara
    const pinne = { x: 0.6, y: 0.3 * asp(), mx: 0.6, my: 0.3 * asp(), nere: false, lage: 'ingen', ox: 0, oy: 0, lyft: 1, kant: 0, kantMal: 0, avtryck: 1 };
    const pp = new Float32Array(10), kvistData = new Float32Array(4), avtryckData = new Float32Array(4);
    let forra = null;
    let skrapFart = 0;
    // Räknar ut kvistens punkter så att greppet hamnar där pinne.x, pinne.y är
    function pinnPunkter() {
      const vinkel = BAS_VINKEL + pinne.kant;
      const lok = [[0, 0]];
      let x = 0, y = 0, v = vinkel, kvist = null;
      FORM.forEach(([dv, l], i) => {
        v += dv;
        x += Math.cos(v) * l; y += Math.sin(v) * l;
        lok.push([x, y]);
        // Sidokvisten sitter vid andra böjen och grenar sig framåt, mot spetsen
        if (i === 1) { const kv = v + Math.PI + 0.55; kvist = [x, y, x + Math.cos(kv) * 0.04, y + Math.sin(kv) * 0.04]; }
      });
      // Greppet ligger GREPP in längs kvisten från spetsen
      let kvar = GREPP, gx = 0, gy = 0, gv = vinkel;
      for (let i = 0; i < FORM.length; i++) {
        const l = FORM[i][1];
        if (kvar <= l) {
          const t = kvar / l;
          gx = lok[i][0] + (lok[i + 1][0] - lok[i][0]) * t; gy = lok[i][1] + (lok[i + 1][1] - lok[i][1]) * t;
          gv = Math.atan2(lok[i + 1][1] - lok[i][1], lok[i + 1][0] - lok[i][0]);
          break;
        }
        kvar -= l;
      }
      const dx = pinne.x - gx, dy = pinne.y - gy;
      lok.forEach(([a, b], i) => { pp[i * 2] = a + dx; pp[i * 2 + 1] = b + dy; });
      kvistData[0] = kvist[0] + dx; kvistData[1] = kvist[1] + dy; kvistData[2] = kvist[2] + dx; kvistData[3] = kvist[3] + dy;
      avtryckData[0] = pinne.x; avtryckData[1] = pinne.y; avtryckData[2] = gv;
    }
    // Spetsen i sandens rutnät
    function spetsRut() {
      pinnPunkter();
      return [Math.max(0, Math.min(1, pp[0])) * SW, ((asp() - pp[1]) / asp()) * SH];
    }
    function ristaTill() {
      const [gx, gy] = spetsRut();
      if (forra) {
        const d = Math.hypot(gx - forra[0], gy - forra[1]);
        // Står spetsen still gräver den inte djupare
        if (d < 0.3) return;
        const n = Math.ceil(d / 0.6);
        for (let k = 1; k <= n; k++) grav(forra[0] + (gx - forra[0]) * k / n, forra[1] + (gy - forra[1]) * k / n);
        skrapFart = Math.min(1, skrapFart + d * 0.04);
      } else grav(gx, gy);
      forra = [gx, gy];
    }
    const fingerTill = (x, y) => { pinne.mx = x / duk.clientWidth; pinne.my = (duk.clientHeight - y) / duk.clientWidth; };
    // Hur nära fingret är kvisten, utom vid greppet
    function avstandTillKvist(fx, fy) {
      pinnPunkter();
      const str = (ax, ay, bx, by) => {
        const vx = bx - ax, vy = by - ay;
        const t = Math.max(0, Math.min(1, ((fx - ax) * vx + (fy - ay) * vy) / (vx * vx + vy * vy)));
        return Math.hypot(fx - ax - vx * t, fy - ay - vy * t);
      };
      let d = str(kvistData[0], kvistData[1], kvistData[2], kvistData[3]);
      for (let i = 0; i < 4; i++) d = Math.min(d, str(pp[i * 2], pp[i * 2 + 1], pp[i * 2 + 2], pp[i * 2 + 3]));
      return d;
    }
    // Kvisten följer fingret direkt, med samma avstånd som där hon tog i den. Både greppet
    // och spetsen stannar på skärmen, så att spetsen kan rista ända ut till kanten.
    function hallInne(x, y) {
      pinnPunkter();
      const bx = pp[0] - pinne.x, by = pp[1] - pinne.y;
      const klamp = (v, a, b) => Math.max(a, Math.min(b, v));
      pinne.x = klamp(klamp(x, 0.03, 0.97), 0.005 - bx, 0.995 - bx);
      pinne.y = klamp(klamp(y, 0.03, asp() - 0.03), 0.005 - by, asp() - 0.005 - by);
    }
    const foljFingret = () => hallInne(pinne.mx + pinne.ox, pinne.my + pinne.oy);
    // Nära en kant vill spetsen peka ut mot kanten. Räknar ut hur mycket kvisten ska vridas
    // för det, utifrån var greppet är.
    function kantVinkel() {
      const narhet = (d) => 1 - mjuk(0.05, 0.45, d);
      const ex = narhet(pinne.x) * -1 + narhet(1 - pinne.x);
      const ey = narhet(pinne.y) * -1 + narhet(asp() - pinne.y);
      if (Math.abs(ex) + Math.abs(ey) < 1e-3) return 0;
      const kant = pinne.kant;
      pinne.kant = 0;
      pinnPunkter();
      pinne.kant = kant;
      const bx = pp[0] - pinne.x, by = pp[1] - pinne.y, bl = Math.hypot(bx, by) || 1;
      const vx = bx / bl + ex * 1.6, vy = by / bl + ey * 1.6;
      const v = Math.atan2(vy, vx) - Math.atan2(by, bx);
      return Math.max(KANT_MIN, Math.min(KANT_MAX, Math.atan2(Math.sin(v), Math.cos(v))));
    }
    fingrar(duk, {
      ner: (x, y) => {
        // Ett tryck i det djupa havet längst upp lockar fram tumlaren
        if (y / duk.clientHeight < 0.11) lockaTumlare(x / duk.clientWidth);
        if (pinne.nere) return;
        fingerTill(x, y);
        forra = null;
        if (Math.hypot(pinne.mx - pinne.x, pinne.my - pinne.y) < 0.085) pinne.lage = 'rista';
        else if (avstandTillKvist(pinne.mx, pinne.my) < 0.035) pinne.lage = 'flytta';
        else { pinne.lage = 'ingen'; return; }
        pinne.nere = true;
        pinne.ox = pinne.x - pinne.mx; pinne.oy = pinne.y - pinne.my;
        // Ristningen börjar direkt där spetsen är
        if (pinne.lage === 'rista') ristaTill();
      },
      drag: (x, y) => {
        if (!pinne.nere) return;
        fingerTill(x, y);
        foljFingret();
        // Ristar hela tiden så länge hon håller i avtrycket, för varje rörelse
        if (pinne.lage === 'rista') ristaTill();
      },
      upp: () => { pinne.nere = false; pinne.lage = 'ingen'; forra = null; },
    }, { ett: true });

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const data = new Float32Array(N * 2);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, SW, SH, 0, gl.RG, gl.FLOAT, data);
    gl.uniform1i(u.u_sand, 0);
    gl.uniform2f(u.u_rut, SW, SH);

    // ---------- Ritslinga ----------
    const stoppa = slinga((tid, dt) => {
      klocka += dt;
      nastaVag -= dt;
      if (nastaVag <= 0) {
        let nar = slump(0.3, 0.72);
        // Det hon skrivit får ligga kvar en stund innan en våg söker sig ända dit
        if (lagst > nar && klocka - skrevs > 25 && Math.random() < 0.6) nar = Math.min(0.9, lagst + 0.05);
        if (nar >= lagst) lagst = 0;
        vag = { start: tid, nar, langd: slump(6, 9) * (0.8 + nar * 0.4), fro: slump(0, 50) };
        // Vågor som når längre upp låter starkare och lite längre
        vagBank.spela({ styrka: 0.5 + 0.6 * nar, tonhojd: 0.04, ansats: 0.25 });
        nastaVag = vag.langd + slump(2, 8);
      }
      const forraLage = vagLage;
      const lage = vaglage(tid);
      vagLage = lage.y;
      vatten = lage.kvar;

      // Där vattnet står slätas sanden ut och blir våt. Vid tillbakadragningen slätar det mest.
      const drar = vagLage < forraLage;
      for (let x = 0; x < SW; x++) {
        const fram = framkant(x / SW, vagLage, vag.fro) * SH;
        const tot = Math.min(SH, Math.floor(fram));
        for (let y = 0; y < tot; y++) {
          const i = y * SW + x;
          const k = Math.min(1, dt * (drar ? 1.6 : 0.8) * vatten);
          h[i] += (BAS - h[i]) * k;
          vata[i] = Math.min(1, vata[i] + dt * 3 * vatten);
        }
      }
      fyndRor(dt, drar);
      // Sanden torkar sakta
      for (let i = 0; i < N; i++) if (vata[i] > 0) vata[i] = Math.max(0, vata[i] - dt * 0.012);

      // Vågens ljud när den sköljer upp. När den drar sig tillbaka är det tyst.
      const t = ctx.currentTime;
      const fart = Math.abs(vagLage - forraLage) / Math.max(dt, 1e-3);
      svG.gain.setTargetAtTime(vagInspelad ? 0 : drar ? 0.02 * vatten : 0.09 * Math.min(1, fart * 6) * vatten, t, 0.15);
      svF.frequency.setTargetAtTime(500 + 900 * Math.min(1, fart * 5), t, 0.2);
      skrapFart = Number.isFinite(skrapFart) ? skrapFart * Math.exp(-dt * 5) : 0;
      skG.gain.setTargetAtTime(0.04 * skrapFart, t, 0.04);

      for (let i = 0; i < N; i++) { data[i * 2] = h[i]; data[i * 2 + 1] = vata[i]; }
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, SW, SH, gl.RG, gl.FLOAT, data);
      anpassa(gl, duk, 0.75);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform3f(u.u_vag, vagLage, vag.fro, vatten);
      gl.uniform4fv(u.u_fynd, fyndData);
      const tm = tumlareRor(dt);
      gl.uniform4f(u.u_tumlare, tm[0], tm[1], tm[2], tm[3]);
      gl.uniform1f(u.u_tumlareA, tm[4]);
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_synlig, mjuk(0, 2.5, tid));
      // Kvisten glider snabbt in under fingret och sänks
      // ner till sanden. Den ristar först när den ligger rätt i handen.
      const rista = pinne.nere && pinne.lage === 'rista';
      // Medan hon flyttar kvisten vrider den sig mjukt mot närmaste kant. När den ristar
      // står vinkeln still, så att spetsen inte hoppar.
      if (pinne.nere && pinne.lage === 'flytta') pinne.kantMal = kantVinkel();
      if (!rista) {
        pinne.kant += (pinne.kantMal - pinne.kant) * Math.min(1, dt * 3);
        hallInne(pinne.x, pinne.y);
      }
      // Kvisten sänks bara när den ristar. Lyfter hon den för att flytta den höjs den lite extra.
      const malLyft = rista ? 0 : pinne.nere ? 1.3 : 1;
      pinne.lyft += (malLyft - pinne.lyft) * Math.min(1, dt * (rista ? 14 : 5));
      // Avtrycket syns alltid i vila och döljs bara medan fingret håller i greppet
      pinne.avtryck += ((rista ? 0 : 1) - pinne.avtryck) * Math.min(1, dt * 3);
      pinnPunkter();
      avtryckData[3] = pinne.avtryck;
      gl.uniform2fv(u.u_pp, pp);
      gl.uniform4fv(u.u_kvist, kvistData);
      gl.uniform1f(u.u_pa, 1);
      gl.uniform1f(u.u_lyft, pinne.lyft);
      gl.uniform4fv(u.u_avtryck, avtryckData);
      ritaHelskarm(gl);
    });

    return stangning({ ljud: l, stoppa, gl });
  },
};
