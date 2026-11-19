// Lucka 24: Grottan
// Julafton. Ett varmt grottrum där mycket från de tidigare rummen möts: en glöd som
// brinner, en bäck som porlar förbi och eldflugor som svävar i dunklet. Genom grottans
// öppning syns en snöig vinternatt med en ensam, klar stjärna. Här finns ingenting att
// göra och inget att hinna. Det är en plats att vila på utan dåligt samvete.
//
// Håller hon fingret stilla samlas eldflugorna runt det och börjar blinka i takt. Ett
// tryck i elden får gnistor att stiga, och ett tryck i bäcken ger ringar på vattnet.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { brusKalla, rum } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { mjuk, slump, klamp, rumsLjud, slinga, fingrar, stangning, brusstot, bubbla, klang } from '../lib/scen.js';
import { skapaPorl } from '../lib/porl.js';
import { skapaVind } from '../lib/vind.js';
import { skapaMatta, spelaKorn } from '../lib/inspelning.js';
import { tillVivan } from '../lib/mottagare.js';

// Ställen i eldinspelningen där det knäpper till ordentligt (halvsekunder)
const KNAPP = [0.5, 3.6, 4.6, 5.6, 6.6, 9.7, 11.2, 11.7, 17.4, 18.9];

const FLUGOR = 18, GNISTOR = 70, RINGAR = 6;
const LJUS = FLUGOR + GNISTOR;

const BAK_FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform float u_tid;
uniform vec2 u_eld;          // eldens plats
uniform float u_flamma;      // hur livlig elden är just nu
uniform vec4 u_ring[${RINGAR}];  // ringar på vattnet: x, y, ålder, styrka
uniform float u_synlig;
${BRUS}

float baeck(float x) { return 0.17 + 0.09 * x + 0.015 * sin(x * 7.0); }

float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  float s = u_res.x;
  vec2 p = gl_FragCoord.xy / s;
  vec2 uv = gl_FragCoord.xy / u_res;
  float H = u_res.y / s;
  float t = u_tid;
  vec2 F = u_eld;
  float flimmer = 0.85 + 0.1 * sin(t * 7.3) * sin(t * 3.1) + 0.05 * sin(t * 17.0) * u_flamma;
  vec2 fd = (p - F - vec2(0.0, 0.05)) * vec2(1.0, 0.8);
  float eldljus = flimmer * (exp(-dot(fd, fd) * 2.0) * 0.9 + exp(-dot(fd, fd) * 12.0) * 0.6) * (0.8 + 0.4 * u_flamma);

  // Grottans öppning, med en ojämn klippkant
  vec2 M = vec2(0.6, H * 0.56);
  vec2 mq = (p - M) / vec2(0.3, 0.6);
  float ang = atan(mq.y, mq.x);
  float kant = 1.0 + 0.16 * (fbm(vec2(ang * 1.8, 3.0)) - 0.5) + 0.05 * (brus(vec2(ang * 9.0, 1.0)) - 0.5);
  float mr = length(mq);
  vec3 c;
  if (mr < kant) {
    // Utanför: en snöig vinternatt med en ensam, klar stjärna
    float hy = clamp((p.y - H * 0.36) / 0.9, 0.0, 1.0);
    c = mix(vec3(0.09, 0.12, 0.24), vec3(0.02, 0.03, 0.08), hy);
    vec2 g = p * 60.0;
    vec2 id = floor(g);
    float r = hash(id);
    if (r > 0.9) c += vec3(0.7, 0.75, 0.95) * smoothstep(0.14, 0.0, length(fract(g) - 0.5 - (hash2(id) - 0.5) * 0.6)) * (0.6 + 0.4 * sin(t * (1.0 + r * 3.0) + r * 30.0)) * 0.7;
    vec2 js = p - (M + vec2(-0.08, 0.38));
    c += vec3(1.0, 0.95, 0.85) * (exp(-dot(js, js) * 9000.0) * 1.2 + exp(-dot(js, js) * 300.0) * 0.12);
    c += vec3(1.0, 0.95, 0.85) * (exp(-abs(js.x) * 600.0) * exp(-abs(js.y) * 30.0) + exp(-abs(js.y) * 600.0) * exp(-abs(js.x) * 30.0)) * 0.25;
    // Snöiga kullar och granar längre bort
    float kulle = H * 0.36 + 0.03 * sin(p.x * 6.0 + 1.0) + 0.015 * sin(p.x * 15.0);
    float x2 = p.x * 30.0;
    float tid2 = floor(x2);
    float hg = 0.03 + 0.05 * hash(vec2(tid2, 2.0));
    float yy = (p.y - kulle + 0.005) / hg;
    float gran = (yy > 0.0 && yy < 1.0 && abs(fract(x2) - 0.5) < (1.0 - yy) * 0.4 && hash(vec2(tid2, 5.0)) > 0.35) ? 1.0 : 0.0;
    if (p.y < kulle) c = mix(vec3(0.3, 0.34, 0.48), vec3(0.18, 0.2, 0.3), clamp((kulle - p.y) * 6.0, 0.0, 1.0));
    if (gran > 0.0) c = vec3(0.03, 0.04, 0.07);
    // Snö som faller där ute
    for (int i = 0; i < 2; i++) {
      float sk = 14.0 + float(i) * 9.0;
      vec2 q = p * sk + vec2(sin(t * 0.3 + float(i)) * 0.5, t * (0.5 + float(i) * 0.2));
      vec2 fid = floor(q);
      if (hash(fid + float(i) * 7.0) > 0.6) {
        vec2 f = fract(q) - 0.5 - (hash2(fid) - 0.5) * 0.6;
        c += vec3(0.8, 0.85, 0.95) * smoothstep(0.06, 0.0, length(f)) * 0.5;
      }
    }
  } else {
    // Klippan: mörk sten, varmt upplyst av elden och kallt av natten vid öppningen
    float sten = fbm(p * 5.0) * 0.55 + fbm(p * 17.0 + 4.0) * 0.3 + fbm(p * 38.0 + 9.0) * 0.15;
    sten = smoothstep(0.25, 0.8, sten);
    vec3 berg = mix(vec3(0.13, 0.1, 0.08), vec3(0.4, 0.31, 0.24), sten);
    // Skrevor i berget
    berg *= 0.8 + 0.25 * smoothstep(0.35, 0.55, fbm(p * vec2(4.0, 9.0) + 7.0));
    c = berg * (0.06 + 1.6 * eldljus) + vec3(0.03, 0.015, 0.005);
    float vidKant = exp(-pow(max(mr - kant, 0.0), 2.0) * 25.0);
    c += vec3(0.1, 0.12, 0.2) * vidKant * 0.25 * sten;
    // Snö som har blåst in på klippkanten nertill i öppningen
    if (mq.y < -0.5 && mr < kant + 0.08) c = mix(c, vec3(0.5, 0.55, 0.68) * (0.4 + 0.6 * eldljus + 0.2), smoothstep(kant + 0.08, kant + 0.01, mr) * smoothstep(-0.5, -0.8, mq.y) * 0.6);
  }

  // Golvet: stenig mark som ljuset från elden faller på
  float golv = H * 0.27 + 0.02 * sin(p.x * 5.0) + 0.012 * fbm(vec2(p.x * 10.0, 0.0));
  if (p.y < golv) {
    float sten = fbm(p * vec2(8.0, 14.0)) * 0.7 + fbm(p * vec2(26.0, 40.0)) * 0.3;
    vec3 mark = mix(vec3(0.12, 0.1, 0.08), vec3(0.32, 0.26, 0.2), smoothstep(0.2, 0.8, sten));
    c = mark * (0.05 + 1.7 * eldljus) + vec3(0.02, 0.01, 0.004);
    // Bäcken som rinner över golvet
    float by = baeck(p.x);
    float bw = 0.05 + 0.01 * sin(p.x * 3.0 + 1.0);
    float i_ = abs(p.y - by) / bw;
    if (i_ < 1.0) {
      vec2 fl = vec2(p.x * 18.0 - t * 0.6, (p.y - by) * 50.0);
      float krus = fbm(fl) * 0.7 + fbm(fl * 2.3 + 5.0) * 0.3;
      // Ringar där hon tryckt
      float ringar = 0.0;
      for (int r = 0; r < ${RINGAR}; r++) {
        vec4 R = u_ring[r];
        if (R.w <= 0.0) continue;
        float d = length((p - R.xy) * vec2(1.0, 1.6));
        float fr = R.z * 0.09;
        ringar += sin((d - fr) * 150.0) * exp(-pow((d - fr) * 30.0, 2.0)) * exp(-R.z * 1.1) * R.w;
      }
      // Mörkt, klart vatten med ljusa strömstrimmor som rör sig nedströms
      vec3 vatten = mix(vec3(0.02, 0.04, 0.05), vec3(0.07, 0.11, 0.12), krus);
      float strimma = smoothstep(0.62, 0.72, fbm(vec2(p.x * 9.0 - t * 0.9, (p.y - by) * 90.0)));
      vatten += vec3(0.35, 0.4, 0.42) * strimma * 0.12;
      // Eldens spegling i strömmen, som darrar
      float spegel = exp(-pow((p.x - F.x - (krus - 0.5) * 0.03) * 14.0, 2.0));
      vatten += vec3(1.0, 0.55, 0.2) * spegel * (0.1 + 0.6 * smoothstep(0.5, 0.75, krus)) * flimmer * 0.35;
      vatten += vec3(1.0, 0.6, 0.3) * eldljus * 0.12;
      vatten += vec3(0.9, 0.7, 0.45) * max(ringar, 0.0) * 0.25 * (0.3 + eldljus);
      vatten += vec3(0.7, 0.75, 0.85) * smoothstep(0.78, 0.9, krus) * 0.08;
      // Våta, mörka stenar längs kanterna
      float strand = smoothstep(0.75, 1.0, i_);
      vatten = mix(vatten, mark * (0.03 + 1.2 * eldljus) * 0.6, strand * smoothstep(0.4, 0.6, fbm(p * 40.0)));
      c = mix(c, vatten, smoothstep(1.0, 0.85, i_));
    }
  }

  // Stenarna runt elden
  for (int i = 0; i < 7; i++) {
    float a = float(i) / 7.0 * 6.2832 + 0.3;
    vec2 sp = F + vec2(cos(a) * 0.12, sin(a) * 0.04 - 0.016);
    vec2 d = (p - sp) / vec2(0.03, 0.019);
    float rr = dot(d, d);
    if (rr < 1.0) {
      vec3 stn = vec3(0.25, 0.22, 0.2) * (0.5 + 0.5 * (1.0 - rr)) * (0.2 + 1.4 * flimmer);
      c = stn + vec3(0.3, 0.15, 0.05) * max(0.0, d.y) * flimmer;
    }
  }
  // Veden: två kubbar i kors, med glödande sprickor
  float ved = min(segment(p, F + vec2(-0.08, -0.016), F + vec2(0.07, 0.012)), segment(p, F + vec2(-0.07, 0.012), F + vec2(0.08, -0.014)));
  if (ved < 0.016) {
    vec3 tra = vec3(0.12, 0.07, 0.04) * (0.6 + 0.4 * fbm(p * 80.0));
    float spricka = smoothstep(0.08, 0.0, abs(fbm(p * 60.0 + 3.0) - 0.5));
    tra += vec3(1.0, 0.4, 0.1) * spricka * (0.5 + 0.5 * sin(t * 1.7 + p.x * 40.0)) * flimmer * 0.8;
    c = tra;
  }
  // Glödbädden under veden
  vec2 gb = (p - F - vec2(0.0, -0.02)) / vec2(0.085, 0.022);
  if (dot(gb, gb) < 1.0) {
    vec2 cid = floor(p * 140.0);
    float glod = pow(hash(cid), 3.0) * (0.6 + 0.4 * sin(t * (0.8 + hash(cid + 1.0) * 2.0) + hash(cid) * 20.0));
    c = mix(c, vec3(1.0, 0.35, 0.08) * (0.4 + glod * 1.4) * flimmer, 0.85 * (1.0 - dot(gb, gb)));
  }
  // Lågorna: några tungor som dansar
  float lagor = 0.0, karna = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 q = p - F - vec2((fi - 1.0) * 0.032, 0.0);
    float hojd = (0.13 + 0.05 * sin(t * (2.1 + fi) + fi * 2.0)) * (0.8 + 0.35 * u_flamma) * (i == 1 ? 1.25 : 0.9);
    float yn = q.y / hojd;
    float x = q.x + sin(t * 6.0 + yn * 5.0 + fi * 2.0) * 0.006 * yn + (fbm(vec2(q.x * 30.0, q.y * 18.0 - t * 3.0)) - 0.5) * 0.014 * yn;
    float w = 0.029 * pow(clamp(1.0 - yn, 0.0, 1.0), 0.7) * smoothstep(-0.1, 0.15, yn);
    float f = smoothstep(w, w * 0.25, abs(x)) * step(0.0, yn) * step(yn, 1.0);
    lagor = max(lagor, f);
    karna = max(karna, smoothstep(w * 0.5, 0.0, abs(x)) * smoothstep(0.7, 0.1, yn) * f);
  }
  vec3 lagfarg = mix(vec3(1.0, 0.38, 0.08), vec3(1.0, 0.82, 0.45), karna);
  c = mix(c, lagfarg * 1.2, lagor * 0.9);
  c += vec3(1.0, 0.55, 0.2) * exp(-dot(p - F - vec2(0.0, 0.07), p - F - vec2(0.0, 0.07)) * 45.0) * 0.22 * flimmer;

  c *= 1.0 - 0.3 * pow(length(uv - 0.5) * 1.2, 2.5);
  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, t), 1.0);
}`;

// Eldflugorna och gnistorna: små ljus som läggs ovanpå
const LJUS_VS = `#version 300 es
precision highp float;
in vec4 a_p;      // x, y, storlek, ljus
in vec3 a_f;      // färg
uniform float u_H;
out vec2 v_lok;
out float v_ljus;
out vec3 v_f;
void main() {
  vec2 h = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  vec2 p = a_p.xy + h * a_p.z;
  v_lok = h;
  v_ljus = a_p.w;
  v_f = a_f;
  gl_Position = a_p.w > 0.0 ? vec4(p.x * 2.0 - 1.0, p.y / u_H * 2.0 - 1.0, 0.0, 1.0) : vec4(2.0, 2.0, 0.0, 1.0);
}`;

const LJUS_FS = `#version 300 es
precision highp float;
in vec2 v_lok;
in float v_ljus;
in vec3 v_f;
out vec4 frag;
uniform float u_synlig;
void main() {
  float r2 = dot(v_lok, v_lok);
  float k = (exp(-r2 * 40.0) * 1.2 + exp(-r2 * 5.0) * 0.2) * v_ljus * smoothstep(1.0, 0.8, r2);
  frag = vec4(v_f * k * u_synlig, 1.0);
}`;

// Kortets stil följer med rummet, så att den alltid passar ihop med koden
const KORT_STIL = `
.grottkort {
  inset: 0;
  display: grid;
  place-items: center;
  padding: calc(env(safe-area-inset-top) + 70px) 22px calc(env(safe-area-inset-bottom) + 24px);
  background: radial-gradient(100% 70% at 50% 45%, rgba(10, 6, 8, 0.35), rgba(6, 4, 8, 0.75));
  opacity: 0;
  transition: opacity 1.2s ease;
  overflow-y: auto;
  touch-action: pan-y;
}
.grottkort.syns { opacity: 1; }
.grottkort .kort { width: 100%; max-width: 340px; text-align: center; }
.grottkort .text p {
  margin: 0 0 0.9rem;
  line-height: 1.55;
  font-size: min(1.05rem, 4.2vw);
  color: #3a2618;
}
.grottkort .text { margin-bottom: 1.3rem; }
`;
const KORT_NYCKEL = 'andrum.julkort';
const KORT_TEXT = [
  'Jag hoppas att din julafton blir fin och stämningsfull.',
  'Men om den ger för många intryck, så är du alltid välkommen att göra reträtt hit, in i din grotta. Här är det lugnt, och här behöver du ingenting.',
];

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const bak = program(gl, HELSKARM, BAK_FS);
    const bu = platser(gl, bak, ['u_res', 'u_tid', 'u_eld', 'u_flamma', 'u_ring', 'u_synlig']);
    const ljusProg = program(gl, LJUS_VS, LJUS_FS);
    const lu = platser(gl, ljusProg, ['u_H', 'u_synlig']);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const data = new Float32Array(LJUS * 7);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
    const aP = gl.getAttribLocation(ljusProg, 'a_p'), aF = gl.getAttribLocation(ljusProg, 'a_f');
    gl.enableVertexAttribArray(aP);
    gl.vertexAttribPointer(aP, 4, gl.FLOAT, false, 28, 0);
    gl.vertexAttribDivisor(aP, 1);
    gl.enableVertexAttribArray(aF);
    gl.vertexAttribPointer(aF, 3, gl.FLOAT, false, 28, 16);
    gl.vertexAttribDivisor(aF, 1);
    const tom = gl.createVertexArray();

    const H = () => duk.clientHeight / duk.clientWidth;
    const eld = { x: 0.33, y: H() * 0.2 };
    let flamma = 0.3;
    const baeck = (x) => 0.17 + 0.09 * x + 0.015 * Math.sin(x * 7);

    // ---------- Eldflugorna ----------
    const VARV = Math.PI * 2;
    const flugor = Array.from({ length: FLUGOR }, () => ({
      x: slump(0.1, 0.9), y: slump(H() * 0.32, H() * 0.6), vx: 0, vy: 0,
      fas: slump(0, VARV), takt: slump(0.45, 0.7) * VARV, ljus: 0, vandring: slump(0, 100),
    }));
    const finger = { x: 0, y: 0, nere: false, still: 0 };

    // ---------- Gnistorna ----------
    const gnistor = Array.from({ length: GNISTOR }, () => ({ liv: 0 }));
    function gnista(antal, fart = 1) {
      for (let i = 0; i < antal; i++) {
        const g = gnistor.find((q) => q.liv <= 0);
        if (!g) return;
        Object.assign(g, { x: eld.x + slump(-0.04, 0.04), y: eld.y + 0.06, vx: slump(-0.04, 0.04), vy: slump(0.12, 0.3) * fart, liv: slump(1, 2.6), max: 0 });
        g.max = g.liv;
      }
    }

    // ---------- Ringar på vattnet ----------
    const ringar = Array.from({ length: RINGAR }, () => ({ x: 0, y: 0, alder: 0, styrka: 0 }));
    let nastaRing = 0;

    // ---------- Ljud ----------
    const l = rumsLjud(1.2, 3);
    const { ctx, ut } = l;
    const eko = rum(3.5);
    const ekoUt = ctx.createGain(); ekoUt.gain.value = 0.4;
    eko.connect(ekoUt).connect(ut);
    const vind = skapaVind(ctx, ut, { styrka: 0.07, ljus: 0.25 });
    l.kallor.push(...vind.kallor);
    // Bäcken: en inspelning av en liten, lugn bäck, som också ekar svagt i grottan.
    // Inspelningen är tyst och har mycket sus i diskanten, så den filtreras mjukt
    // ovanifrån och läggs lågt, som ett porl en bit bort.
    const backBuss = ctx.createGain();
    const backEko = ctx.createGain(); backEko.gain.value = 0.35;
    backBuss.connect(ut); backBuss.connect(backEko).connect(eko);
    const backMatta = skapaMatta(ctx, backBuss, 'ljud/grotta-back.mp3', { niva: 0.02, bit: [8, 16], over: 3, hp: 150, lp: 3800, tonhojd: 0.02 });
    l.kallor.push(backMatta);
    let porl = null;
    backMatta.klar.catch(() => {
      // Gick inspelningen inte att ladda tar den framräknade bäcken över
      porl = skapaPorl(ctx, ut, { styrka: 0.55, ljus: 0.7 });
      l.kallor.push(...porl.kallor);
    });
    // Elden: en inspelning av en lugn lägereld sent på natten. Den låga brummande
    // delen av inspelningen filtreras bort, och ett mjukt framräknat brus ger värmen.
    const eldBuss = ctx.createGain();
    const eldEko = ctx.createGain(); eldEko.gain.value = 0.15;
    eldBuss.connect(ut); eldBuss.connect(eldEko).connect(eko);
    const eldMatta = skapaMatta(ctx, eldBuss, 'ljud/grotta-eld.mp3', { niva: 0.03, bit: [5, 10], over: 2, hp: 150, lp: 9000, tonhojd: 0.04 });
    l.kallor.push(eldMatta);
    let eldInspelning = null, eldFramraknad = false;
    eldMatta.klar.then((b) => { eldInspelning = b; }, () => { eldFramraknad = true; });
    const brus = brusKalla('rosa');
    const bF = ctx.createBiquadFilter(); bF.type = 'lowpass'; bF.frequency.value = 160;
    const bG = ctx.createGain(); bG.gain.value = 0.03;
    brus.connect(bF).connect(bG).connect(ut);
    l.kallor.push(brus);
    function knaster(kraft = 1) {
      const t = ctx.currentTime;
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        brusstot(ctx, ut, { frekvens: slump(1500, 5000), q: slump(0.6, 1.5), styrka: slump(0.06, 0.18) * kraft, langd: slump(0.0008, 0.0022), nar: t + i * slump(0.008, 0.03) });
      }
    }
    let knasterTid = 0;
    const KLOCKA = [[1, 1, 3], [2.76, 0.25, 1.4], [5.4, 0.06, 0.6]];
    let senastKlang = 0;

    // ---------- Fingret ----------
    const tillVarld = (x, y) => [x / duk.clientWidth, (duk.clientHeight - y) / duk.clientWidth];
    fingrar(duk, {
      ner: (x, y) => { [finger.x, finger.y] = tillVarld(x, y); finger.nere = true; finger.still = 0; },
      drag: (x, y) => {
        const [wx, wy] = tillVarld(x, y);
        if (Math.hypot(wx - finger.x, wy - finger.y) > 0.01) finger.still = 0;
        finger.x = wx; finger.y = wy;
      },
      upp: (x, y, id, { tryck }) => {
        finger.nere = false;
        if (!tryck) return;
        const [wx, wy] = tillVarld(x, y);
        if (Math.hypot(wx - eld.x, (wy - eld.y - 0.05) * 0.8) < 0.12) {
          // Ett tryck i elden: gnistor stiger och det knastrar till
          gnista(14, 1.3);
          flamma = 1;
          if (eldInspelning) spelaKorn(ctx, eldMatta.ing, eldInspelning, KNAPP, { langd: 0.55, styrka: 1 });
          else knaster(1.3);
        } else if (Math.abs(wy - baeck(wx)) < 0.065) {
          // Ett tryck i bäcken: en droppe, och ringar sprids på vattnet
          const r = ringar[nastaRing++ % RINGAR];
          Object.assign(r, { x: wx, y: wy, alder: 0, styrka: 1 });
          bubbla(ctx, ut, slump(500, 800), 0.05);
        }
      },
    });

    // ---------- Ritslinga ----------
    const dRing = new Float32Array(RINGAR * 4);
    const stoppa = slinga((tid, dt) => {
      flamma += (0.3 + 0.1 * Math.sin(tid * 0.3) - flamma) * Math.min(1, dt * 0.8);
      if (finger.nere) finger.still += dt;

      // Eldflugorna vandrar i dunklet. Ett stilla finger lockar dem till sig, och de
      // som är nära varandra drar sig mot samma takt.
      const koppling = finger.nere ? 0.4 + Math.min(1.6, finger.still * 0.25) : 0.05;
      let blinkar = 0, samlade = 0;
      for (const f of flugor) {
        f.vandring += dt * 0.3;
        let ax = Math.sin(f.vandring * 1.3) * 0.02, ay = Math.cos(f.vandring * 0.9) * 0.015;
        if (finger.nere) {
          const dx = finger.x - f.x, dy = finger.y - f.y, d = Math.hypot(dx, dy) || 1;
          const drag = Math.min(1, finger.still * 0.5 + 0.2);
          const malD = 0.06 + 0.04 * Math.sin(f.vandring * 2);
          ax += (dx / d) * (d - malD) * 0.6 * drag;
          ay += (dy / d) * (d - malD) * 0.6 * drag;
          if (d < 0.15) samlade++;
        }
        // Håll dem inne i grottan, borta från elden och ovanför golvet
        if (f.y < H() * 0.3) ay += 0.03;
        if (f.y > H() * 0.92) ay -= 0.03;
        if (f.x < 0.05) ax += 0.03;
        if (f.x > 0.95) ax -= 0.03;
        const de = Math.hypot(f.x - eld.x, f.y - eld.y);
        if (de < 0.17) { ax += (f.x - eld.x) / de * 0.03; ay += (f.y - eld.y) / de * 0.03; }
        f.vx += (ax - f.vx * 0.8) * dt; f.vy += (ay - f.vy * 0.8) * dt;
        f.x += f.vx * dt; f.y += f.vy * dt;
        let sum = 0, n = 0;
        for (const g of flugor) {
          if (g === f) continue;
          const d = Math.hypot(g.x - f.x, g.y - f.y);
          if (d < 0.2) { sum += Math.sin(g.fas - f.fas); n++; }
        }
        const fore = f.fas;
        f.fas += (f.takt + (n ? (koppling * sum) / n : 0)) * dt;
        if (Math.floor(fore / VARV) !== Math.floor(f.fas / VARV)) { f.ljus = 1; blinkar++; }
        f.ljus *= Math.exp(-dt * 2.2);
      }
      // När många blinkar på en gång hörs en mjuk klang som ekar i grottan
      if (blinkar >= 8 && samlade >= 10 && tid - senastKlang > 1.5) {
        senastKlang = tid;
        [587.33, 739.99, 880].forEach((fr, i) => klang(ctx, ut, fr, KLOCKA, { styrka: 0.012, ansats: 0.03, eko, nar: ctx.currentTime + i * 0.05 }));
      }

      // Gnistor stiger då och då ur elden
      if (Math.random() < dt * 1.2 * (0.5 + flamma)) gnista(1);
      for (const g of gnistor) {
        if (g.liv <= 0) continue;
        g.liv -= dt;
        g.vx += Math.sin(tid * 2 + g.y * 20) * 0.02 * dt;
        g.vy *= Math.exp(-dt * 0.6);
        g.x += g.vx * dt; g.y += g.vy * dt;
      }
      let n = 0;
      for (const f of flugor) {
        const glod = 0.12 + f.ljus * 0.9;
        data.set([f.x, f.y, 0.035, glod, 0.75, 1.0, 0.35], n * 7);
        n++;
      }
      for (const g of gnistor) {
        const ljus = g.liv > 0 ? (g.liv / g.max) * (0.6 + 0.4 * Math.sin(tid * 20 + g.x * 50)) : 0;
        data.set([g.x, g.y, 0.012, ljus, 1.0, 0.55, 0.2], n * 7);
        n++;
      }
      ringar.forEach((r, i) => {
        r.alder += dt;
        if (r.alder > 4) r.styrka = 0;
        dRing.set([r.x, r.y, r.alder, r.styrka], i * 4);
      });

      // Ljud
      if (porl) porl.uppdatera(dt, 0.25);
      vind.uppdatera(dt, 0);
      knasterTid -= dt;
      // Den inspelade elden knastrar av sig själv. Bara om den saknas räknas knastret fram.
      if (eldFramraknad && knasterTid <= 0) { knaster(0.6 + flamma * 0.5); knasterTid = slump(0.08, 0.6) / (0.5 + flamma); }
      eldBuss.gain.setTargetAtTime(0.8 + 0.2 * flamma, ctx.currentTime, 0.3);
      bG.gain.setTargetAtTime(0.02 + 0.02 * flamma, ctx.currentTime, 0.3);

      anpassa(gl, duk, 0.75);
      gl.viewport(0, 0, duk.width, duk.height);
      const synlig = mjuk(0, 3, tid);
      gl.useProgram(bak);
      gl.bindVertexArray(tom);
      gl.uniform2f(bu.u_res, duk.width, duk.height);
      gl.uniform1f(bu.u_tid, tid);
      gl.uniform2f(bu.u_eld, eld.x, eld.y);
      gl.uniform1f(bu.u_flamma, flamma);
      gl.uniform4fv(bu.u_ring, dRing);
      gl.uniform1f(bu.u_synlig, synlig);
      ritaHelskarm(gl);

      gl.useProgram(ljusProg);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
      gl.uniform1f(lu.u_H, duk.clientHeight / duk.clientWidth);
      gl.uniform1f(lu.u_synlig, synlig);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, LJUS);
      gl.disable(gl.BLEND);
    });

    // Julkortet: första gången grottan öppnas hänger ett kort framför den, medan
    // grottan sakta tonar fram bakom. Ett tryck på knappen lägger undan det.
    let kortVisat = false;
    try { kortVisat = localStorage.getItem(KORT_NYCKEL) === 'sett'; } catch {}
    // Kortet är bara till Vivan
    if (!kortVisat && tillVivan) {
      const kort = document.createElement('div');
      kort.className = 'lucka-ui grottkort';
      kort.innerHTML = `
        <div class="kort">
          <div class="tagg">
            <div class="snore" aria-hidden="true"></div>
            <p class="till">Till Vivan</p>
            <div class="text">${KORT_TEXT.map((r) => `<p>${r}</p>`).join('')}</div>
            <p class="halsning">God jul, Vivan!<br><span>från Ella</span></p>
          </div>
          <button class="intro-knapp">Gå in i grottan</button>
        </div>`;
      const stil = document.createElement('style');
      stil.className = 'lucka-ui';
      stil.textContent = KORT_STIL;
      scen.append(stil, kort);
      setTimeout(() => kort.classList.add('syns'), 1400);
      kort.querySelector('button').addEventListener('click', () => {
        try { localStorage.setItem(KORT_NYCKEL, 'sett'); } catch {}
        kort.classList.remove('syns');
        kort.style.pointerEvents = 'none';
        setTimeout(() => kort.remove(), 1300);
      });
    }

    return stangning({ ljud: l, stoppa, gl });
  },
};
