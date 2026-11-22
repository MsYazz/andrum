// Lucka 11: Tomteblosset
// Ett tomtebloss som brinner i vintermörkret medan snön faller. Hon håller det med
// fingret och ritar i luften, och ljuset lämnar spår som dröjer kvar, som efterbilder
// på näthinnan. Spåren bleknar sakta från vitt över guld och orange till en svag glöd.
// Gnistorna sprakar mjukt och delar sig i små grenar, som på ett riktigt tomtebloss.
// Hon håller i handtaget, och glöden kryper sakta ner längs satsen. När bara handtaget
// är kvar slocknar blosset, och ett nytt, otänt glider upp i nederkanten. Tar hon det
// tänds det av sig självt.
//
// Ljusspåren ritas i en bild som aldrig töms, bara bleknar lite för varje bildruta.
// Blått bleknar fortast och rött långsammast, så att spåren svalnar i färg.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { brusKalla, rum } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { mjuk, slump, klamp, rumsLjud, slinga, fingrar, stangning } from '../lib/scen.js';
import { skapaMatta, spelaKorn } from '../lib/inspelning.js';

const GNISTOR = 220;

// Bleknar spåren och lägger till blossets glöd längs sträckan det rört sig sedan förra bilden
const SPAR_FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform sampler2D u_forra;
uniform vec2 u_res;
uniform vec4 u_drag;      // blossets topp: förra läget x, y, nya läget x, y (skärmbredder)
uniform float u_glod;     // hur starkt blosset brinner
uniform vec3 u_blekna;    // hur mycket som finns kvar av rött, grönt och blått
uniform float u_golv;     // minsta steg nedåt, så att inget fastnar i en svag ton

float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec3 c = texture(u_forra, uv).rgb;
  c = max(c * u_blekna - u_golv, 0.0);
  vec2 p = gl_FragCoord.xy / u_res.x;
  float d = segment(p, u_drag.xy, u_drag.zw);
  // En het, vit kärna med lite varmt runt omkring
  c += vec3(1.0, 0.92, 0.75) * exp(-d * d / 0.0000035) * 0.55 * u_glod;
  c += vec3(1.0, 0.55, 0.2) * exp(-d * d / 0.00004) * 0.06 * u_glod;
  frag = vec4(c, 1.0);
}`;

// Gnistorna: korta streck som läggs i spårbilden med additiv blandning
const GNISTA_VS = `#version 300 es
precision highp float;
in vec4 a_seg;      // från x, y, till x, y
in float a_ljus;
uniform float u_H;
out vec2 v_lok;
out float v_len;
out float v_ljus;
void main() {
  vec2 h = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  vec2 a = a_seg.xy, b = a_seg.zw;
  vec2 dir = b - a;
  float len = length(dir);
  vec2 t = len > 1e-6 ? dir / len : vec2(1.0, 0.0);
  vec2 n = vec2(-t.y, t.x);
  float w = 0.004;
  float langs = (h.x * 0.5 + 0.5) * len + h.x * w;
  vec2 p = a + t * langs + n * h.y * w;
  v_lok = vec2(langs, h.y * w);
  v_len = len;
  v_ljus = a_ljus;
  gl_Position = a_ljus > 0.0 ? vec4(p.x * 2.0 - 1.0, p.y / u_H * 2.0 - 1.0, 0.0, 1.0) : vec4(2.0, 2.0, 0.0, 1.0);
}`;

const GNISTA_FS = `#version 300 es
precision highp float;
in vec2 v_lok;
in float v_len;
in float v_ljus;
out vec4 frag;
void main() {
  float dx = max(0.0, max(-v_lok.x, v_lok.x - v_len));
  float d = length(vec2(dx, v_lok.y));
  // Ljusast i gnistans främre ände
  float fram = clamp(v_lok.x / max(v_len, 1e-5), 0.0, 1.0);
  float k = exp(-d * d / 0.0000016) * (0.35 + 0.65 * fram) * v_ljus;
  frag = vec4(vec3(1.0, 0.85, 0.55) * k * 0.22, 1.0);
}`;

// Det man ser: natten, snön, blossets ståltråd och ljusspåren med ett mjukt sken
const VISA_FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform sampler2D u_spar;
uniform vec2 u_res;
uniform float u_tid;
uniform vec4 u_bloss;     // blossets nedre ände x, y och övre ände x, y
uniform float u_brand;    // hur långt ner glöden har kommit (1 längst upp, 0,4 vid handtaget)
uniform vec4 u_nytt;      // ett nytt, otänt bloss i nederkanten: nedre och övre ände
uniform float u_nyttA;    // hur synligt det nya blosset är
uniform vec2 u_punkt;     // var glöden sitter
uniform float u_glod;
uniform float u_synlig;
uniform float u_stuga;    // ljuset i stugan: 0 när de sover, 1 när de har vaknat
${BRUS}

float segment(vec2 p, vec2 a, vec2 b, out float h) {
  vec2 pa = p - a, ba = b - a;
  h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
  return length(pa - ba * h);
}

// Är p inuti fyrhörningen a, b, c, d (konvex, moturs)? Med d = c blir det en triangel.
float kant(vec2 p, vec2 a, vec2 b) { return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x); }
bool inuti(vec2 p, vec2 a, vec2 b, vec2 c, vec2 d) {
  return kant(p, a, b) >= 0.0 && kant(p, b, c) >= 0.0 && kant(p, c, d) >= 0.0 && kant(p, d, a) >= 0.0;
}
// En punkt på stugans gavel flyttad bakåt längs långsidan, mot en flyktpunkt till höger
// i ögonhöjd. Det som är under ögonhöjden stiger bakåt och det ovanför sjunker.
vec2 bakat(vec2 q, float m0) {
  float horisont = m0 + 0.06;
  return vec2(q.x + 0.065, q.y + (horisont - q.y) * 0.16);
}

// Ett tomtebloss: blank ståltråd som handtag, svart sats ovanför, och ovanför glöden
// den utbrända tråden som är het närmast glöden och sedan svalnar till grå aska.
vec3 stav(vec3 c, vec2 p, vec2 B, vec2 T, float brand, float glod, float alfa) {
  float h;
  float d = segment(p, B, T, h);
  if (d > 0.006) return c;
  vec3 f;
  float w;
  // Handtaget är långt, nästan halva blosset, så att glöden aldrig kommer nära handen
  if (h < 0.4) {
    w = 0.0016;
    f = vec3(0.55, 0.57, 0.6) + vec3(0.35) * smoothstep(0.0012, 0.0, d);
  } else if (h < brand) {
    w = 0.0034;
    f = vec3(0.16, 0.16, 0.18) * (0.8 + 0.4 * hash(floor(p * 900.0)));
    // En smal ljusreflex längs satsen, så att blosset syns mot mörkret
    f += vec3(0.45, 0.47, 0.55) * smoothstep(0.0016, 0.0, abs(d - 0.0012)) * 0.35;
    // Ett otänt bloss glimmar långsamt, som för att locka
    f += vec3(0.6, 0.6, 0.7) * exp(-pow((h - fract(u_tid * 0.15) * 1.4 + 0.2) * 9.0, 2.0)) * 0.25 * (1.0 - step(0.001, glod)) * step(0.999, brand);
  } else {
    w = 0.0014;
    float het = exp(-(h - brand) * 40.0) * glod;
    f = mix(vec3(0.3, 0.27, 0.25), vec3(1.0, 0.55, 0.2), het);
  }
  // Glöden lyser upp satsen strax under sig
  f += vec3(1.0, 0.6, 0.25) * exp(-abs(h - brand) * 25.0) * 0.5 * glod;
  return mix(c, f, smoothstep(w, w * 0.4, d) * alfa);
}

void main() {
  float s = u_res.x;
  vec2 p = gl_FragCoord.xy / s;
  vec2 uv = gl_FragCoord.xy / u_res;
  float H = u_res.y / s;

  // Vintermörker, lite ljusare mot marken där snön ligger
  vec3 c = mix(vec3(0.03, 0.035, 0.06), vec3(0.008, 0.01, 0.02), uv.y);
  // En liten stuga långt bort, med gaveln mot oss och långsidan som löper snett bakåt åt
  // höger. Fasaden är faluröd med lodräta bräder och vita knutar, och taket har snö. I
  // mörkret syns den nästan inte, men blossets sken lyser upp den ytterst svagt. Marken
  // är plan där stugan står, och snön ligger en bit upp mot väggarna.
  float m0 = 0.22 + 0.015 * sin(2.0) + 0.01 * sin(2.6);
  float mark = 0.22 + 0.015 * sin(p.x * 5.0 + 1.0) + 0.01 * sin(p.x * 13.0);
  mark = mix(mark, m0 + 0.002, smoothstep(0.05, 0.11, p.x) * smoothstep(0.37, 0.31, p.x));
  if (p.y < mark) c = vec3(0.07, 0.08, 0.11) * (0.85 + 0.2 * fbm(p * vec2(8.0, 30.0)));

  float yb = m0 - 0.008, ye = m0 + 0.085, x0 = 0.13, x1 = 0.245;
  vec2 L0 = vec2(x0, yb), R0 = vec2(x1, yb), Re = vec2(x1, ye), Le = vec2(x0, ye);
  vec2 A = vec2((x0 + x1) * 0.5, m0 + 0.145);
  vec2 lutA = normalize(Re - A);
  vec2 Ro = Re + lutA * 0.009, Lo = Le + vec2(-lutA.x, lutA.y) * 0.009;
  vec2 B0 = bakat(R0, m0), B1 = bakat(Re, m0), BRo = bakat(Ro, m0), BA = bakat(A, m0);
  float stugLjus = exp(-dot(p - u_punkt, p - u_punkt) * 1.2) * 0.09 * u_glod;
  if (p.y >= mark) {
    float hh;
    bool gavel = inuti(p, L0, R0, Re, Le) || inuti(p, Le, Re, A, A);
    bool langsida = inuti(p, R0, B0, B1, Re);
    bool tak = inuti(p, A, Ro, BRo, BA);
    // Snökanten längs gavelns vänstra takfall
    bool takkant = segment(p, Lo, A, hh) < 0.0035;
    if (gavel) {
      float fog = smoothstep(0.1, 0.0, abs(fract(p.x * 160.0) - 0.5) - 0.38);
      vec3 farg = vec3(0.45, 0.12, 0.09) * (1.0 - 0.45 * fog) * (0.9 + 0.2 * hash(vec2(floor(p.x * 160.0), 3.0)));
      float knut = step(p.x, x0 + 0.004) + step(x1 - 0.004, p.x) + step(segment(p, Le, A, hh), 0.0025) + step(segment(p, A, Re, hh), 0.0025);
      farg = mix(farg, vec3(0.75, 0.74, 0.7), min(knut, 1.0));
      c = vec3(0.018, 0.016, 0.022) + farg * stugLjus;
    }
    if (langsida) {
      float t = (p.x - x1) / (B0.x - x1);
      float fog = smoothstep(0.1, 0.0, abs(fract(t * 6.0) - 0.5) - 0.36);
      vec3 farg = vec3(0.45, 0.12, 0.09) * 0.7 * (1.0 - 0.45 * fog);
      farg = mix(farg, vec3(0.7, 0.69, 0.66) * 0.75, step(0.96, t));
      c = vec3(0.013, 0.012, 0.017) + farg * stugLjus;
    }
    if (tak || takkant) c = vec3(0.04, 0.045, 0.06) + vec3(0.7, 0.75, 0.85) * stugLjus * 0.8;
  }

  // Stugans fönster, mitt på gaveln. De som bor där sover och fönstret är mörkt, tills
  // hon rör vid stugan. Då tänds en lampa därinne, och ljuset faller ut på snön.
  vec2 fc = vec2((x0 + x1) * 0.5, m0 + 0.045);
  vec2 fo = (p - fc) / vec2(0.016, 0.02);
  if (max(abs(fo.x), abs(fo.y)) < 1.0) {
    float sprojs = (abs(fo.x) < 0.08 || abs(fo.y) < 0.08) ? 0.4 : 1.0;
    vec3 morkt = vec3(0.012, 0.014, 0.022) + vec3(0.25, 0.2, 0.15) * stugLjus * 0.3;
    c = mix(morkt * (sprojs < 1.0 ? 1.6 : 1.0), vec3(0.5, 0.3, 0.12) * sprojs, u_stuga);
  }
  c += vec3(0.4, 0.22, 0.08) * exp(-dot(p - fc, p - fc) * 300.0) * 0.15 * u_stuga;
  // Ljuset från fönstret på snön framför stugan
  if (p.y < mark) c += vec3(0.5, 0.3, 0.12) * exp(-pow((p.x - fc.x) / 0.03, 2.0) - pow((mark - p.y) / 0.012, 2.0)) * 0.12 * u_stuga;

  // Blossets sken lyser upp omgivningen
  vec2 tp = u_punkt;
  float dl = length(p - tp);
  vec3 sken = vec3(1.0, 0.6, 0.25) * exp(-dl * dl * 9.0) * 0.12 * u_glod;
  c += sken;
  if (p.y < mark) c += vec3(1.0, 0.6, 0.3) * exp(-pow(length((p - vec2(tp.x, mark)) * vec2(1.0, 3.0)), 2.0) * 6.0) * 0.1 * u_glod;

  // Snöflingor som faller sakta, upplysta nära blosset
  for (int lag = 0; lag < 3; lag++) {
    float sk = 9.0 + float(lag) * 7.0;
    vec2 q = p * sk + vec2(sin(u_tid * 0.2 + float(lag)) * 0.6, u_tid * (0.35 + float(lag) * 0.12));
    vec2 id = floor(q);
    vec2 f = fract(q) - 0.5 - (hash2(id + float(lag) * 9.0) - 0.5) * 0.6;
    if (hash(id + 3.0 + float(lag)) > 0.55) {
      float r = 0.03 + 0.03 * hash(id + 5.0);
      float flinga = smoothstep(r, r * 0.3, length(f));
      vec2 fp = (id + 0.5) / sk;
      c += vec3(0.6, 0.65, 0.8) * flinga * (0.12 + 0.9 * exp(-dl * dl * 20.0) * u_glod) * (0.5 + float(lag) * 0.25);
    }
  }

  // Blosset hon håller, och ett nytt i nederkanten när det gamla har brunnit ut
  c = stav(c, p, u_bloss.xy, u_bloss.zw, u_brand, u_glod, 1.0);
  if (u_nyttA > 0.0) c = stav(c, p, u_nytt.xy, u_nytt.zw, 1.0, 0.0, u_nyttA);

  // Ljusspåren, mjukt mappade så att de aldrig bränner ut, med ett sken runt sig
  vec3 spar = texture(u_spar, uv).rgb;
  vec3 glod = vec3(0.0);
  vec2 px = 1.0 / u_res;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785;
    glod += texture(u_spar, uv + vec2(cos(a), sin(a)) * px * 5.0).rgb;
    glod += texture(u_spar, uv + vec2(cos(a + 0.39), sin(a + 0.39)) * px * 11.0).rgb * 0.6;
  }
  glod /= 12.8;
  vec3 ljus = spar + glod * 0.9;
  c += vec3(1.0) - exp(-ljus * 1.6);

  // Blossets glödande topp
  c += vec3(1.0, 0.9, 0.7) * exp(-dl * dl / 0.00002) * 0.8 * u_glod;

  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, u_tid), 1.0);
}`;

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const flyt = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');

    const sparProg = program(gl, HELSKARM, SPAR_FS);
    const su = platser(gl, sparProg, ['u_forra', 'u_res', 'u_drag', 'u_glod', 'u_blekna', 'u_golv']);
    const gnistProg = program(gl, GNISTA_VS, GNISTA_FS);
    const gu = platser(gl, gnistProg, ['u_H']);
    const visaProg = program(gl, HELSKARM, VISA_FS);
    const vu = platser(gl, visaProg, ['u_spar', 'u_res', 'u_tid', 'u_bloss', 'u_brand', 'u_nytt', 'u_nyttA', 'u_punkt', 'u_glod', 'u_synlig', 'u_stuga']);

    // ---------- Spårbilderna, två som turas om ----------
    let bredd = 0, hojd = 0;
    const bilder = [0, 1].map(() => ({ tex: gl.createTexture(), fb: gl.createFramebuffer() }));
    function byggBilder(b, h) {
      bredd = b; hojd = h;
      for (const bild of bilder) {
        gl.bindTexture(gl.TEXTURE_2D, bild.tex);
        if (flyt) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, b, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
        else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, b, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindFramebuffer(gl.FRAMEBUFFER, bild.fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, bild.tex, 0);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    let nu = 0;

    // ---------- Gnistornas buffert ----------
    const gnistVao = gl.createVertexArray();
    gl.bindVertexArray(gnistVao);
    const gnistData = new Float32Array(GNISTOR * 5);
    const gnistBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gnistBuf);
    gl.bufferData(gl.ARRAY_BUFFER, gnistData.byteLength, gl.DYNAMIC_DRAW);
    const aSeg = gl.getAttribLocation(gnistProg, 'a_seg'), aLjus = gl.getAttribLocation(gnistProg, 'a_ljus');
    gl.enableVertexAttribArray(aSeg);
    gl.vertexAttribPointer(aSeg, 4, gl.FLOAT, false, 20, 0);
    gl.vertexAttribDivisor(aSeg, 1);
    gl.enableVertexAttribArray(aLjus);
    gl.vertexAttribPointer(aLjus, 1, gl.FLOAT, false, 20, 16);
    gl.vertexAttribDivisor(aLjus, 1);
    const tomVao = gl.createVertexArray();

    // ---------- Blosset ----------
    // Hon håller i handtaget. Glöden sitter högst upp och kryper sakta nedåt längs
    // satsen. När bara handtaget är kvar slocknar det, och ett nytt, otänt bloss glider
    // upp i nederkanten. Tar hon det tänds det av sig självt.
    const H = () => duk.clientHeight / duk.clientWidth;
    const LANGD = 0.52;
    const HANDTAG = 0.4;                    // handtagets del av blosset, där glöden slocknar
    const BRINNTID = 35;                    // sekunder från toppen till handtaget
    // Fingret håller längst ner på handtaget, en bra bit från där glöden slocknar
    const GREPP = 0.012;                    // från handtagets ände till fingret
    const grepp = { x: 0.58, y: H() * 0.3 }; // där handen håller
    const mal = { ...grepp };
    let vinkel = 1.78;                       // blosset lutar lite åt vänster
    let brand = 1;                           // glödens plats längs blosset, 1 = toppen
    let tand = 1;                            // 1 brinner, 0 slocknat
    let tander = 0;                          // ett nytt bloss håller på att tändas
    let tandSpelat = true;
    let fart = 0;
    let rorTid = 0;
    let nytt = null;                         // det otända blosset i nederkanten
    const punkt = { x: 0, y: 0 };
    let forraPunkt = null;
    const stavEnd = () => {
      const ux = Math.cos(vinkel), uy = Math.sin(vinkel);
      const Bx = grepp.x - ux * GREPP, By = grepp.y - uy * GREPP;
      return { Bx, By, Tx: Bx + ux * LANGD, Ty: By + uy * LANGD, ux, uy };
    };
    const NYTT_V = 0.32;
    const nyttLage = (synlig) => {
      // Det nya blosset ligger snett i nederkanten och glider upp när det dyker upp
      const ux = Math.cos(NYTT_V), uy = Math.sin(NYTT_V);
      const Bx = 0.2, By = -0.05 + 0.1 * synlig;
      return { Bx, By, Tx: Bx + ux * LANGD, Ty: By + uy * LANGD };
    };
    // Handtaget och nedersta delen av satsen, där det känns naturligt att hålla
    let halls = null;
    const narSkaftet = (x, y) => {
      const S = stavEnd();
      const kort = { Bx: S.Bx - S.ux * 0.02, By: S.By - S.uy * 0.02, Tx: S.Bx + S.ux * LANGD * HANDTAG, Ty: S.By + S.uy * LANGD * HANDTAG };
      return narStav(x, y, kort) < 0.075;
    };
    const narStav = (x, y, S) => {
      const ax = S.Tx - S.Bx, ay = S.Ty - S.By;
      const t = klamp(((x - S.Bx) * ax + (y - S.By) * ay) / (ax * ax + ay * ay), 0, 1);
      return Math.hypot(x - (S.Bx + ax * t), y - (S.By + ay * t));
    };

    // Gnistorna: korta, snabba, och ibland delar de sig
    const gnistor = Array.from({ length: GNISTOR }, () => ({ liv: 0 }));
    function spruta(x, y, vx, vy, liv, gren) {
      const g = gnistor.find((q) => q.liv <= 0);
      if (!g) return;
      Object.assign(g, { x, y, px: x, py: y, vx, vy, liv, max: liv, gren, delad: false });
    }

    const tillVarld = (x, y) => [x / duk.clientWidth, (duk.clientHeight - y) / duk.clientWidth];
    // Stugan i bakgrunden, i samma mått som i shadern
    const STUG_MARK = 0.22 + 0.015 * Math.sin(2.0) + 0.01 * Math.sin(2.6);
    const paStugan = (x, y) => x > 0.12 && x < 0.32 && y > STUG_MARK - 0.02 && y < STUG_MARK + 0.155;
    const stuga = { ljus: 0, mal: 0, vantar: null };
    fingrar(duk, {
      ner: (x, y) => {
        const [wx, wy] = tillVarld(x, y);
        // Ligger ett nytt bloss i nederkanten och hon tar i det, byts blossen
        if (nytt && nytt.synlig > 0.5 && narStav(wx, wy, nyttLage(nytt.synlig)) < 0.07) {
          const N = nyttLage(nytt.synlig);
          vinkel = NYTT_V;
          grepp.x = N.Bx + Math.cos(NYTT_V) * GREPP; grepp.y = N.By + Math.sin(NYTT_V) * GREPP;
          mal.x = grepp.x; mal.y = grepp.y;
          nytt = null;
          brand = 1; tand = 0; tander = 0.0001; tandSpelat = false;
          forraPunkt = null;
          halls = { dx: grepp.x - wx, dy: grepp.y - wy, fx: wx, fy: wy };
          return;
        }
        // Blosset följer bara med när hon tar tag om skaftet. Då glider handtaget mjukt
        // in under fingret, så att hon alltid håller längst ner och aldrig nära glöden.
        // Tryck någon annanstans lämnar det där det är.
        if (narSkaftet(wx, wy)) halls = { dx: mal.x - wx, dy: mal.y - wy };
        if (halls) Object.assign(halls, { fx: wx, fy: wy });
      },
      drag: (x, y) => {
        if (!halls) return;
        const [wx, wy] = tillVarld(x, y);
        halls.fx = wx; halls.fy = wy;
      },
      upp: (x, y, id, { tryck }) => {
        halls = null;
        // Ett tryck på stugan väcker dem som bor där. Efter ett litet tag tänds lampan,
        // och ett nytt tryck en stund senare får dem att somna om.
        const [wx, wy] = tillVarld(x, y);
        if (!tryck || stuga.vantar || !paStugan(wx, wy)) return;
        stuga.vantar = setTimeout(() => { stuga.mal = stuga.mal ? 0 : 1; stuga.vantar = null; }, slump(900, 1600));
      },
    }, { ett: true });

    // ---------- Ljud ----------
    const l = rumsLjud(1.8, 2);
    const { ctx, ut } = l;
    const eko = rum(2.5);
    const ekoUt = ctx.createGain(); ekoUt.gain.value = 0.25;
    eko.connect(ekoUt).connect(ut);
    // Ett mjukt, tätt sprak: glest knaster genom ett band i mellanregistret
    const sprak = brusKalla('korn');
    const spF = ctx.createBiquadFilter(); spF.type = 'bandpass'; spF.frequency.value = 2600; spF.Q.value = 0.7;
    const spL = ctx.createBiquadFilter(); spL.type = 'lowpass'; spL.frequency.value = 5000;
    const spG = ctx.createGain(); spG.gain.value = 0;
    sprak.connect(spF).connect(spL).connect(spG).connect(ut);
    spG.connect(eko);
    // Ett svagt fräs från själva glöden
    const frus = brusKalla('rosa');
    const frF = ctx.createBiquadFilter(); frF.type = 'bandpass'; frF.frequency.value = 1800; frF.Q.value = 0.5;
    const frG = ctx.createGain(); frG.gain.value = 0;
    frus.connect(frF).connect(frG).connect(ut);
    // Luften när blosset svingas
    const sus = brusKalla('rosa');
    const suF = ctx.createBiquadFilter(); suF.type = 'bandpass'; suF.frequency.value = 500; suF.Q.value = 0.8;
    const suG = ctx.createGain(); suG.gain.value = 0;
    sus.connect(suF).connect(suG).connect(ut);
    // Vinternatten omkring
    const natt = brusKalla('rosa');
    const naF = ctx.createBiquadFilter(); naF.type = 'lowpass'; naF.frequency.value = 250;
    const naG = ctx.createGain(); naG.gain.value = 0.02;
    natt.connect(naF).connect(naG).connect(ut);
    l.kallor.push(sprak, frus, sus, natt);
    // Blossets fräs: en inspelning av ett riktigt tomtebloss. Den följer glöden, och
    // när ett nytt bloss tänds spelas den riktiga tändningen ur inspelningen. Går den
    // inte att ladda räknas fräset fram som förut.
    const blossBuss = ctx.createGain(); blossBuss.gain.value = 0;
    blossBuss.connect(ut);
    const blossEko = ctx.createGain(); blossEko.gain.value = 0.3;
    blossBuss.connect(blossEko).connect(eko);
    const blossMatta = skapaMatta(ctx, blossBuss, 'ljud/tomtebloss.mp3', {
      avsnitt: [[3.0, 29.5]], niva: 0.03, bit: [5, 10], over: 1.5, hp: 250, tonhojd: 0.03,
    });
    l.kallor.push(blossMatta);
    let blossInspelning = null;
    blossMatta.klar.then((b) => { blossInspelning = b; }, () => {});
    // Tändningen ligger mellan 1,5 och 3 sekunder i inspelningen
    const tandLjud = () => {
      if (!blossInspelning) return false;
      spelaKorn(ctx, blossMatta.ing, blossInspelning, [1.53], { langd: 1.6, styrka: 1, tonhojd: 0.03 });
      return true;
    };
    // Ett mjukt fräs när ett bloss tar eld eller slocknar
    function fras(styrka, langd) {
      const t = ctx.currentTime;
      const k = brusKalla('rosa');
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 0.6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(styrka, t + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, t + langd);
      k.connect(f).connect(g).connect(ut);
      setTimeout(() => { try { k.stop(); } catch {} }, (langd + 0.2) * 1000);
    }

    // ---------- Ritslinga ----------
    const stoppa = slinga((tid, dt) => {
      // Blosset brinner sakta ner och slocknar när bara handtaget är kvar
      if (tander > 0) {
        tander += dt / 0.6;
        tand = Math.min(1, tander);
        if (tander >= 1) tander = 0;
      }
      if (tand > 0 && tander === 0) {
        brand -= (dt * (1 - HANDTAG)) / BRINNTID;
        if (brand <= HANDTAG) { brand = HANDTAG; tand = 0; fras(0.02, 0.8); nytt = { synlig: 0 }; }
      }
      if (nytt) nytt.synlig = Math.min(1, nytt.synlig + dt / 1.8);
      const glod = mjuk(0.5, 2.5, tid) * tand;

      // Handen följer fingret mjukt och svajar lite av sig själv
      rorTid += dt;
      const svaj = 0.004 * Math.sin(rorTid * 1.3) + 0.002 * Math.sin(rorTid * 3.1);
      if (halls) {
        // Avståndet mellan fingret och handtagets grepp krymper till noll på en halv sekund
        const kh = Math.min(1, dt * 6);
        halls.dx -= halls.dx * kh; halls.dy -= halls.dy * kh;
        mal.x = halls.fx + halls.dx; mal.y = halls.fy + halls.dy;
      }
      const k = Math.min(1, dt * 22);
      const gx0 = grepp.x;
      grepp.x += (mal.x + svaj - grepp.x) * k;
      grepp.y += (mal.y + svaj * 0.5 - grepp.y) * k;
      // Blosset reser sig mot en lätt lutning och svänger lite efter när handen rör sig
      const malVinkel = 1.78 - klamp((grepp.x - gx0) / Math.max(dt, 1e-3), -2, 2) * 0.08;
      vinkel += (malVinkel - vinkel) * Math.min(1, dt * 4);
      const S = stavEnd();
      punkt.x = S.Bx + S.ux * LANGD * brand;
      punkt.y = S.By + S.uy * LANGD * brand;
      if (!forraPunkt) forraPunkt = { ...punkt };
      const forraTopp = forraPunkt;
      const topp = { ...punkt };
      forraPunkt = { ...punkt };
      const steg = Math.hypot(topp.x - forraTopp.x, topp.y - forraTopp.y);
      fart += (steg / Math.max(dt, 1e-3) - fart) * Math.min(1, dt * 8);
      // Ett nytt bloss flammar upp när det tänds
      if (tander > 0 && tander < 0.3) {
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * Math.PI * 2, v = slump(0.2, 0.6);
          spruta(topp.x, topp.y, Math.cos(a) * v, Math.sin(a) * v, slump(0.1, 0.3), 0);
        }
        // Tändljudet spelas en gång per bloss
        if (!tandSpelat) { tandSpelat = true; if (!tandLjud()) fras(0.035, 0.5); }
      }

      // Nya gnistor från toppen, åt alla håll. Gnistor som flyger ner mot handen dör
      // innan de hinner halvvägs dit, så att det aldrig känns som att hon bränner sig.
      const tillHand = Math.atan2(grepp.y - topp.y, grepp.x - topp.x);
      const tillHandAvst = Math.hypot(grepp.y - topp.y, grepp.x - topp.x);
      const antal = Math.round(slump(3, 7) * glod);
      for (let i = 0; i < antal; i++) {
        const a = Math.random() * Math.PI * 2, v = slump(0.25, 0.75);
        let liv = slump(0.08, 0.28);
        const motHand = Math.cos(a - tillHand);
        if (motHand > 0) liv = Math.min(liv, (tillHandAvst * 0.45) / (v * motHand));
        spruta(topp.x, topp.y, Math.cos(a) * v, Math.sin(a) * v, liv, 0);
      }
      let n = 0;
      for (const g of gnistor) {
        if (g.liv <= 0) { gnistData[n * 5 + 4] = 0; n++; continue; }
        g.px = g.x; g.py = g.y;
        g.vy -= 0.4 * dt;
        g.vx *= Math.exp(-dt * 3); g.vy *= Math.exp(-dt * 3);
        g.x += g.vx * dt; g.y += g.vy * dt;
        g.liv -= dt;
        // Mitt i livet delar sig en del gnistor i två eller tre små grenar
        if (!g.delad && g.gren < 2 && g.liv < g.max * 0.5 && Math.random() < 0.35) {
          g.delad = true;
          const grenar = Math.random() < 0.5 ? 2 : 3;
          for (let b = 0; b < grenar; b++) {
            const a = Math.atan2(g.vy, g.vx) + slump(-1.1, 1.1), v = Math.hypot(g.vx, g.vy) * slump(0.6, 1.1);
            spruta(g.x, g.y, Math.cos(a) * v, Math.sin(a) * v, g.liv * slump(0.6, 1), g.gren + 1);
          }
        }
        const ljus = Math.max(0, g.liv / g.max) * (g.gren ? 0.7 : 1);
        gnistData.set([g.px, g.py, g.x, g.y, ljus], n * 5);
        n++;
      }

      // ---------- Ritning ----------
      anpassa(gl, duk, 0.75);
      if (duk.width !== bredd || duk.height !== hojd) byggBilder(duk.width, duk.height);
      const fran = bilder[nu], till = bilder[1 - nu];
      // 1. Bleka förra spårbilden och lägg till blossets väg
      gl.bindFramebuffer(gl.FRAMEBUFFER, till.fb);
      gl.viewport(0, 0, bredd, hojd);
      gl.useProgram(sparProg);
      gl.bindVertexArray(tomVao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fran.tex);
      gl.uniform1i(su.u_forra, 0);
      gl.uniform2f(su.u_res, bredd, hojd);
      gl.uniform4f(su.u_drag, forraTopp.x, forraTopp.y, topp.x, topp.y);
      // Spåret ritas i takt med rörelsen, så att ett bloss som står still inte blir en klump
      gl.uniform1f(su.u_glod, glod * (0.1 + 0.9 * Math.min(1, steg / 0.004)));
      // Halveringstider ungefär 2,5 s för rött, 1,2 s för grönt och 0,5 s för blått
      gl.uniform3f(su.u_blekna, Math.exp(-dt * 0.28), Math.exp(-dt * 0.58), Math.exp(-dt * 1.4));
      gl.uniform1f(su.u_golv, flyt ? dt * 0.002 : 1.5 / 255);
      ritaHelskarm(gl);
      // 2. Gnistorna ovanpå, som ljus
      gl.useProgram(gnistProg);
      gl.bindVertexArray(gnistVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, gnistBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, gnistData);
      gl.uniform1f(gu.u_H, hojd / bredd);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, GNISTOR);
      gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      nu = 1 - nu;
      // 3. Visa allt
      gl.viewport(0, 0, duk.width, duk.height);
      gl.useProgram(visaProg);
      gl.bindVertexArray(tomVao);
      gl.bindTexture(gl.TEXTURE_2D, till.tex);
      gl.uniform1i(vu.u_spar, 0);
      gl.uniform2f(vu.u_res, duk.width, duk.height);
      gl.uniform1f(vu.u_tid, tid);
      gl.uniform4f(vu.u_bloss, S.Bx, S.By, S.Tx, S.Ty);
      gl.uniform1f(vu.u_brand, brand);
      gl.uniform2f(vu.u_punkt, punkt.x, punkt.y);
      if (nytt) { const N = nyttLage(nytt.synlig); gl.uniform4f(vu.u_nytt, N.Bx, N.By, N.Tx, N.Ty); }
      gl.uniform1f(vu.u_nyttA, nytt ? mjuk(0, 0.4, nytt.synlig) : 0);
      gl.uniform1f(vu.u_glod, glod * (0.92 + 0.08 * Math.sin(tid * 23) * Math.sin(tid * 7)));
      gl.uniform1f(vu.u_synlig, mjuk(0, 2.5, tid));
      // Lampan tänds och släcks mjukt, som en glödlampa bakom en gardin
      stuga.ljus += (stuga.mal - stuga.ljus) * Math.min(1, dt * 1.2);
      gl.uniform1f(vu.u_stuga, stuga.ljus);
      ritaHelskarm(gl);

      // ---------- Ljud ----------
      const t = ctx.currentTime;
      const sving = klamp(fart / 2.5, 0, 1);
      const inspelad = !!blossInspelning;
      spG.gain.setTargetAtTime(inspelad ? 0 : 0.08 * glod * (0.75 + 0.25 * Math.random()), t, 0.03);
      frG.gain.setTargetAtTime(inspelad ? 0 : 0.025 * glod, t, 0.2);
      blossBuss.gain.setTargetAtTime(glod, t, glod > 0.05 ? 0.15 : 0.25);
      suG.gain.setTargetAtTime(0.05 * sving, t, 0.08);
      suF.frequency.setTargetAtTime(400 + 600 * sving, t, 0.1);
    });

    return stangning({ ljud: l, stoppa, gl, extra: [() => clearTimeout(stuga.vantar)] });
  },
};
