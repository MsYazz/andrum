// Lucka 8: Isfönstret
// En fönsterruta en vinterkväll. Isblommor växer långsamt in från kanterna, med
// fjäderlika grenar. Bakom glaset syns granar och en stuga med varma fönster.
// Håller hon fingret mot rutan smälter ett titthål som växer, och drar hon fingret
// torkar hon en strimma. Frosten kryper sedan långsamt tillbaka.
// Frosten växer som kristaller: celler bredvid frost fryser, oftast vid spetsarna.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { brusKalla } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { mjuk, slump, rumsLjud, slinga, fingrar, stangning, brusstot } from '../lib/scen.js';
import { skapaVind } from '../lib/vind.js';

const FW = 240, FH = 480;

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform sampler2D u_frost;
uniform vec2 u_rut;
uniform vec3 u_varme;   // fingrets värme: x, y (0..1, y nedåt), styrka
uniform float u_tid;
uniform float u_synlig;
uniform vec4 u_alg;      // älgen: x, riktning (1 eller -1), gångens fas, synlighet
uniform vec2 u_algSpar;  // hennes spår i snön: från x, till x
${BRUS}

// En kapsel: avstånd till en sträcka med radie som går från ra till rb
float kap(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}
float ell(vec2 p, vec2 c, vec2 r) { return (length((p - c) / r) - 1.0) * min(r.x, r.y); }

// En älgtjur från sidan i skymningen: hög manke, långt huvud med tung mule, en liten
// klocka under halsen, breda skovelhorn med taggar och långa ben med ljusa underben. Hon går i fyrtakt, och
// baklänges knäleder (hasorna) pekar bakåt. Allt i mankhöjder. Returnerar täckning
// för kroppen (x) och de ljusa underbenen (y).
const float ALG_MARK = 0.2;   // snöfältet framför stugan där hon går, på jämn höjd
const float ALG_H = 0.16;     // mankhöjden
vec2 alg(vec2 p, vec4 a) {
  float H = ALG_H;
  vec2 q = (p - vec2(a.x, ALG_MARK)) / H;
  q.x *= a.y;
  float ph = a.z * 6.2832;
  float gung = 0.012 * sin(ph * 2.0);
  vec2 g = q - vec2(0.0, gung);
  float d = ell(g, vec2(-0.02, 0.71), vec2(0.4, 0.145));
  d = min(d, ell(g, vec2(0.2, 0.83), vec2(0.21, 0.13)));     // manken
  d = min(d, ell(g, vec2(-0.3, 0.74), vec2(0.15, 0.125)));     // korset
  d = min(d, kap(g, vec2(0.33, 0.85), vec2(0.55, 0.83), 0.1, 0.07)); // halsen
  float nick = 0.02 * sin(ph * 2.0 + 0.6);
  vec2 hb = vec2(0.55, 0.85 + nick), hs = vec2(0.8, 0.68 + nick);
  d = min(d, kap(g, hb, hs, 0.085, 0.07));                    // huvudet
  d = min(d, ell(g, hs + vec2(0.01, -0.012), vec2(0.09, 0.075)));  // mulen
  d = min(d, ell(g, vec2(0.52, 0.99 + nick), vec2(0.035, 0.075)));  // öronen
  d = min(d, ell(g, vec2(0.48, 0.98 + nick), vec2(0.03, 0.07)));
  d = min(d, kap(g, vec2(0.6, 0.73 + nick), vec2(0.6, 0.63 + nick), 0.022, 0.01)); // klockan
  d = min(d, ell(g, vec2(-0.44, 0.73), vec2(0.035, 0.045)));   // svansen
  // Hornen: en kort stång från huvudet ut i en bred skovel som lutar bakåt och uppåt,
  // med taggar längs den övre kanten och en tagg framåt. Den bortre skoveln syns
  // strax bakom och lite högre.
  float horn = 1e9;
  for (int k = 0; k < 2; k++) {
    vec2 o = k == 0 ? vec2(0.0) : vec2(0.06, 0.03);
    vec2 bas = vec2(0.5, 0.98 + nick) + o;
    horn = min(horn, kap(g, bas, bas + vec2(-0.03, 0.06), 0.028, 0.03));
    horn = min(horn, kap(g, bas + vec2(-0.02, 0.07), bas + vec2(-0.24, 0.17), 0.045, 0.07));
    for (int t = 0; t < 4; t++) {
      float ft = float(t);
      vec2 rot = bas + vec2(-0.04 - ft * 0.065, 0.11 + ft * 0.045);
      horn = min(horn, kap(g, rot, rot + vec2(-0.01 - ft * 0.012, 0.1 - ft * 0.01), 0.018, 0.007));
    }
    horn = min(horn, kap(g, bas + vec2(0.0, 0.05), bas + vec2(0.11, 0.1), 0.018, 0.007));
  }
  // Benen: fyrtakt, vänster bak, vänster fram, höger bak, höger fram
  float ljus = 1e9;
  for (int i = 0; i < 4; i++) {
    bool fram = i == 1 || i == 3;
    float fas = ph + float(i) * 1.5708;
    vec2 hoft = fram ? vec2(0.24 + (i == 3 ? 0.03 : 0.0), 0.63) : vec2(-0.3 + (i == 2 ? 0.03 : 0.0), 0.65);
    float sving = sin(fas) * 0.32;
    float lyft = max(0.0, cos(fas));
    float a1 = sving + (fram ? 0.0 : -0.28);
    vec2 kna = hoft + vec2(sin(a1), -cos(a1)) * 0.3;
    float a2 = fram ? sving - 0.75 * lyft : sving + 0.32 + 0.4 * lyft;
    vec2 hov = kna + vec2(sin(a2), -cos(a2)) * (fram ? 0.34 : 0.37);
    hov.y = max(hov.y, 0.0);
    d = min(d, kap(g, hoft, kna, fram ? 0.06 : 0.075, 0.035));
    ljus = min(ljus, kap(g, kna, hov, 0.03, 0.022));
  }
  // Hornen är ljusare, gråbruna, och ritas med de ljusa underbenen
  ljus = min(ljus, horn);
  float kant = 0.012;
  float kropp = smoothstep(kant, -kant, d);
  float ben = smoothstep(kant, -kant, ljus) * (1.0 - kropp);
  return vec2(kropp, ben) * a.w;
}

// Utsikten genom fönstret: kvällshimmel, snöiga kullar, granar och en stuga
vec3 utsikt(vec2 p, float suddig) {
  vec3 c = mix(vec3(0.03, 0.05, 0.12), vec3(0.10, 0.14, 0.26), smoothstep(0.2, 1.6, p.y));
  // En månskära högt upp, med ett svagt sken runt
  vec2 mc = vec2(0.27, 1.62);
  float mane = smoothstep(0.052, 0.048, length(p - mc)) * smoothstep(0.042, 0.047, length(p - mc - vec2(0.022, 0.012)));
  c += vec3(0.95, 0.92, 0.80) * mane;
  c += vec3(0.35, 0.40, 0.55) * exp(-dot(p - mc, p - mc) * 60.0) * 0.22;
  // Kullarna med snö, svagt blåa i kvällsljuset
  float kulle = 0.42 + 0.06 * sin(p.x * 3.1 + 1.0) + 0.04 * sin(p.x * 7.3);
  if (p.y < kulle) c = mix(vec3(0.20, 0.24, 0.34), vec3(0.34, 0.38, 0.50), smoothstep(0.0, kulle, p.y));
  // Granar
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float gx = fract(fi * 0.381 + 0.13) * 1.1 - 0.05;
    float gh = 0.18 + 0.12 * hash(vec2(fi, 2.0));
    float bas = kulle - 0.02 - 0.03 * hash(vec2(fi, 5.0));
    float rel = (p.y - bas) / gh;
    if (rel > 0.0 && rel < 1.0) {
      float bredd = (1.0 - rel) * gh * 0.32 * (0.85 + 0.25 * sin(rel * 40.0 + fi));
      if (abs(p.x - gx) < bredd) c = vec3(0.025, 0.04, 0.05) + vec3(0.1, 0.12, 0.16) * step(0.6, fract(rel * 6.0)) * 0.4;
    }
  }
  // Stugan med två varma fönster
  vec2 s = p - vec2(0.62, 0.36);
  if (abs(s.x) < 0.09 && s.y > 0.0 && s.y < 0.07) c = vec3(0.12, 0.06, 0.05);
  if (s.y > 0.07 && s.y < 0.07 + (0.1 - abs(s.x)) * 0.7 && abs(s.x) < 0.1) c = vec3(0.55, 0.6, 0.72);
  vec2 f1 = s - vec2(-0.045, 0.035), f2 = s - vec2(0.04, 0.035);
  float fonster = step(abs(f1.x), 0.014) * step(abs(f1.y), 0.012) + step(abs(f2.x), 0.014) * step(abs(f2.y), 0.012);
  vec3 varm = vec3(1.0, 0.72, 0.38);
  c = mix(c, varm, min(fonster, 1.0));
  // Skenet från fönstren, bredare när glaset är frostat
  float sken = exp(-dot(f1, f1) / (0.002 + suddig * 0.02)) + exp(-dot(f2, f2) / (0.002 + suddig * 0.02));
  c += varm * sken * (0.25 + suddig * 0.5);
  // Älgens spår i snön: två rader hovavtryck, där bakhovarna sätts i framhovarnas spår
  if (u_algSpar.y != u_algSpar.x) {
    float a0 = min(u_algSpar.x, u_algSpar.y), a1 = max(u_algSpar.x, u_algSpar.y);
    float steg = 0.13;
    for (int rad = 0; rad < 2; rad++) {
      float ry = ALG_MARK + (rad == 0 ? -0.009 : 0.007);
      float rx = p.x + (rad == 0 ? 0.0 : steg * 0.5);
      float cx = (floor(rx / steg) + 0.5) * steg - (rad == 0 ? 0.0 : steg * 0.5);
      if (cx > a0 && cx < a1) {
        // Djupa hovavtryck i snön: mörk blå skugga i botten och en upptrampad ljus kant
        vec2 hd = (p - vec2(cx, ry)) / vec2(0.015, 0.006);
        float hov = smoothstep(1.0, 0.55, length(hd));
        float halo = smoothstep(1.9, 1.0, length(hd)) * (1.0 - hov);
        c = mix(c, vec3(0.07, 0.09, 0.17), hov * (rad == 0 ? 0.92 : 0.75));
        c = mix(c, c * 0.8, halo * step(hd.y, 0.0) * 0.6);
        c += vec3(0.12, 0.13, 0.17) * halo * step(0.0, hd.y);
      }
    }
  }
  // Älgen, på snöfältet framför stugan
  if (u_alg.w > 0.0) {
    vec2 al = alg(p, u_alg);
    c = mix(c, vec3(0.045, 0.035, 0.03), al.x);
    c = mix(c, vec3(0.2, 0.2, 0.22), al.y);
  }
  // Några få snöflingor som faller långsamt
  for (int i = 0; i < 2; i++) {
    float sk = 20.0 + float(i) * 14.0;
    vec2 q = p * sk + vec2(0.0, u_tid * (0.35 + float(i) * 0.2));
    q.x += sin(q.y * 0.4 + float(i)) * 0.4;
    vec2 cell = floor(q), fr = fract(q) - 0.5;
    float h = hash(cell);
    if (h > 0.9) {
      vec2 o = (hash2(cell) - 0.5) * 0.6;
      c += vec3(0.8, 0.85, 0.95) * smoothstep(0.08, 0.0, length(fr - o)) * 0.35 * (1.0 - suddig);
    }
  }
  return c;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 tc = vec2(uv.x, 1.0 - uv.y);
  float asp = u_res.y / u_res.x;
  vec2 p = vec2(uv.x, uv.y * asp);

  // Frostens täthet och riktning (från lutningen i fältet)
  vec2 e = 1.5 / u_rut;
  float F = texture(u_frost, tc).r;
  float Fx = texture(u_frost, tc + vec2(e.x, 0.0)).r - texture(u_frost, tc - vec2(e.x, 0.0)).r;
  float Fy = texture(u_frost, tc + vec2(0.0, e.y)).r - texture(u_frost, tc - vec2(0.0, e.y)).r;
  vec2 g = vec2(Fx, Fy * asp);
  vec2 rikt = length(g) > 1e-4 ? normalize(g) : vec2(0.0, 1.0);
  vec2 tvars = vec2(-rikt.y, rikt.x);

  // Fjäderlika ränder tvärs växtriktningen syns bara i kanterna där frosten växer.
  // Den täta frosten får en jämn yta av små kristaller.
  float iKant = smoothstep(0.02, 0.12, length(g));
  float fjader = brus(vec2(dot(p, tvars) * 160.0, dot(p, rikt) * 20.0));
  float yta = fbm(p * 90.0) * 0.6 + brus(p * 320.0) * 0.4;
  float tathet = smoothstep(0.08, 0.85, F);
  float kristall = tathet * (0.5 + mix(0.45 * yta, 0.5 * fjader, iKant));

  vec3 c = utsikt(p, tathet);

  // Frosten sprider ljuset, vitblå med varmt skimmer från stugan
  vec3 isFarg = mix(vec3(0.55, 0.65, 0.80), vec3(0.88, 0.92, 0.98), kristall);
  float stugljus = exp(-dot(p - vec2(0.62, 0.40), p - vec2(0.62, 0.40)) * 6.0);
  isFarg += vec3(0.6, 0.38, 0.18) * stugljus * 0.35;
  c = mix(c, isFarg * 0.75, clamp(kristall * 1.1, 0.0, 0.92));
  // Glittrande kristaller
  vec2 kc = floor(gl_FragCoord.xy * 0.5);
  float glitter = step(0.996, hash(kc)) * tathet * (0.5 + 0.5 * sin(u_tid * 1.3 + hash(kc + 9.0) * 25.0));
  c += vec3(0.9, 0.95, 1.0) * max(glitter, 0.0) * 0.5;

  // Imma där fingret värmer, och små droppar i kanten av titthålet
  vec2 vd = (tc - u_varme.xy) * vec2(1.0, asp);
  float imma = exp(-dot(vd, vd) * 90.0) * u_varme.z;
  c = mix(c, vec3(0.55, 0.6, 0.68), imma * 0.25);
  float kantSmalt = smoothstep(0.05, 0.25, F) * (1.0 - smoothstep(0.25, 0.5, F));
  vec2 dc = floor(gl_FragCoord.xy * 0.25);
  c += vec3(0.7, 0.75, 0.85) * step(0.93, hash(dc + 4.0)) * kantSmalt * 0.25;

  // Fönsterkarmen: mörkt målat trä runt kanten
  float karm = max(smoothstep(0.035, 0.02, min(uv.x, 1.0 - uv.x)), smoothstep(0.03, 0.017, min(uv.y, 1.0 - uv.y)));
  karm = max(karm, smoothstep(0.012, 0.004, abs(uv.y - 0.5)));
  c = mix(c, vec3(0.16, 0.12, 0.10) * (0.8 + 0.2 * fbm(p * vec2(4.0, 40.0))), karm);

  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, u_tid), 1.0);
}`;

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, ['u_res', 'u_frost', 'u_rut', 'u_varme', 'u_tid', 'u_synlig', 'u_alg', 'u_algSpar']);

    // ---------- Frosten ----------
    const N = FW * FH;
    const F = new Float32Array(N);
    // Hur gärna en cell fryser. Kristallerna växer helst längs smala kanaler i en
    // riktning som varierar över rutan, och det är det som gör grenarna fjäderlika.
    const vilja = new Float32Array(N);
    const fr1 = slump(0, 10), fr2 = slump(0, 10);
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      const i = y * FW + x;
      const a = Math.sin(x * 0.021 + fr1) * 1.6 + Math.cos(y * 0.017 + fr2) * 1.6 + Math.sin((x + y) * 0.009) * 2;
      const kanal = 0.5 + 0.5 * Math.sin((x * Math.cos(a) + y * Math.sin(a)) * 0.85 + Math.sin(y * 0.05 + x * 0.03) * 2);
      vilja[i] = (0.2 + 0.8 * Math.pow(kanal, 3)) * (0.7 + 0.3 * Math.random());
      // Från början bara en smal frostkant längs karmen och spröjsen
      const kant = Math.min(x, FW - 1 - x, y, FH - 1 - y);
      if (kant < 1 + Math.random() * 1.5) F[i] = 1;
      if (Math.abs(y + 0.5 - FH * 0.5) < 1.5 + Math.random()) F[i] = 1;
    }
    // Några frön längs kanterna där isblommor börjar
    for (let k = 0; k < 30; k++) {
      const sida = Math.floor(Math.random() * 4);
      const x = sida < 2 ? Math.floor(Math.random() * FW) : sida === 2 ? 3 : FW - 4;
      const y = sida >= 2 ? Math.floor(Math.random() * FH) : sida === 0 ? 3 : FH - 4;
      F[y * FW + x] = 1;
    }

    // Kristallväxt: en tom cell bredvid frost kan frysa, gärna vid spetsar (få grannar)
    function vaxa(antal) {
      let vaxt = 0;
      for (let k = 0; k < antal; k++) {
        const x = 1 + Math.floor(Math.random() * (FW - 2));
        const y = 1 + Math.floor(Math.random() * (FH - 2));
        const i = y * FW + x;
        if (F[i] >= 0.99 || skydd[i] > 0) continue;
        let n = 0;
        if (F[i - 1] > 0.5) n++; if (F[i + 1] > 0.5) n++;
        if (F[i - FW] > 0.5) n++; if (F[i + FW] > 0.5) n++;
        if (F[i - FW - 1] > 0.5) n++; if (F[i - FW + 1] > 0.5) n++;
        if (F[i + FW - 1] > 0.5) n++; if (F[i + FW + 1] > 0.5) n++;
        if (n === 0) continue;
        const spets = n <= 2 ? 1 : n <= 4 ? 0.25 : 0.6;
        if (Math.random() < 0.55 * spets * vilja[i]) { F[i] = 1; vaxt++; }
        else if (n >= 5) F[i] = Math.min(1, F[i] + 0.05);
      }
      return vaxt;
    }
    const skydd = new Float32Array(N);
    for (let k = 0; k < 40; k++) vaxa(8000);

    // Frosten mjukas upp lite innan den ritas, så att rutnätet inte syns
    const Fm = new Float32Array(N);
    function utjamna() {
      for (let y = 1; y < FH - 1; y++) {
        const r = y * FW;
        for (let x = 1; x < FW - 1; x++) {
          const i = r + x;
          Fm[i] = F[i] * 0.4 + (F[i - 1] + F[i + 1] + F[i - FW] + F[i + FW]) * 0.11 +
            (F[i - FW - 1] + F[i - FW + 1] + F[i + FW - 1] + F[i + FW + 1]) * 0.04;
        }
      }
    }

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, FW, FH, 0, gl.RED, gl.FLOAT, F);
    gl.uniform1i(u.u_frost, 0);
    gl.uniform2f(u.u_rut, FW, FH);

    // ---------- Fingret ----------
    const finger = { x: 0, y: 0, nere: false, varme: 0, radie: 0, fart: 0, t: 0 };
    const tillRut = (x, y) => [x / duk.clientWidth, y / duk.clientHeight];
    fingrar(duk, {
      ner: (x, y, id, e) => { [finger.x, finger.y] = tillRut(x, y); finger.nere = true; finger.radie = 0.02; finger.t = e.timeStamp; },
      drag: (x, y, id, e) => {
        // Hur fort fingret gnider mot rutan, i skärmbredder per sekund
        const [nx, ny] = tillRut(x, y);
        const d = Math.hypot(nx - finger.x, (ny - finger.y) * (duk.clientHeight / duk.clientWidth));
        const dt = Math.max(8, e.timeStamp - finger.t) / 1000;
        finger.fart = Math.min(3, finger.fart + d / dt * 0.25);
        finger.t = e.timeStamp;
        finger.x = nx; finger.y = ny;
      },
      upp: () => { finger.nere = false; },
    }, { ett: true });

    function smalt(dt) {
      if (!finger.nere) return 0;
      finger.radie = Math.min(0.1, finger.radie + dt * 0.03);
      const asp = duk.clientHeight / duk.clientWidth;
      const R = finger.radie;
      const cx = finger.x * FW, cy = finger.y * FH;
      const rx = R * FW, ry = (R / asp) * FH;
      const x0 = Math.max(1, Math.floor(cx - rx - 2)), x1 = Math.min(FW - 2, Math.ceil(cx + rx + 2));
      const y0 = Math.max(1, Math.floor(cy - ry - 2)), y1 = Math.min(FH - 2, Math.ceil(cy + ry + 2));
      let smalte = 0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        const d = Math.hypot(dx, dy);
        if (d < 1.25) {
          const i = y * FW + x;
          const mal = mjuk(0.75, 1.25, d);
          if (F[i] > mal) { smalte += F[i] - mal; F[i] += (mal - F[i]) * Math.min(1, dt * 4); }
          skydd[i] = 4;
        }
      }
      return smalte;
    }

    // ---------- Ljud ----------
    const l = rumsLjud(1.25, 1.5);
    const { ctx, ut } = l;
    const rumston = brusKalla('rosa');
    const rumF = ctx.createBiquadFilter(); rumF.type = 'lowpass'; rumF.frequency.value = 160;
    const rumG = ctx.createGain(); rumG.gain.value = 0.04;
    rumston.connect(rumF).connect(rumG).connect(ut);
    // Vinden som viner utanför fönstret
    const vind = skapaVind(ctx, ut, { styrka: 1 });
    // Värmen från fingret: ett mjukt sus
    // Fingret som gnider mot glaset: ett torrt, kornigt skrap och ett svagt gnissel
    // som bara hörs när fingret rör sig, och stiger i ton med farten
    const gnid = brusKalla('korn');
    const gnF = ctx.createBiquadFilter(); gnF.type = 'bandpass'; gnF.frequency.value = 1800; gnF.Q.value = 2.5;
    const gnHp = ctx.createBiquadFilter(); gnHp.type = 'highpass'; gnHp.frequency.value = 700;
    const gnG = ctx.createGain(); gnG.gain.value = 0;
    gnid.connect(gnF).connect(gnHp).connect(gnG).connect(ut);
    const gnissel = brusKalla('rosa');
    const giF = ctx.createBiquadFilter(); giF.type = 'bandpass'; giF.frequency.value = 1100; giF.Q.value = 22;
    const giG = ctx.createGain(); giG.gain.value = 0;
    gnissel.connect(giF).connect(giG).connect(ut);
    l.kallor.push(rumston, gnid, gnissel, ...vind.kallor);

    // ---------- Älgen ----------
    // När rutan har frostat igen kommer en älgtjur långsamt gående över snöfältet framför
    // stugan. Genom frosten skymtar man honom bara, så man får smälta ett titthål för att
    // se honom. Han lämnar spår i snön och stannar ungefär två tredjedelar in på rutan.
    // När hon har smält fram honom står han kvar en stund, och går sedan sakta vidare ut
    // ur bilden. Under det här besöket kommer han inte tillbaka.
    let algSpar = [0, 0];
    let alg = null, tillAlg = 45, tackning = 0, tackTid = 0, algKlar = false;
    const ALG_FART = 0.018;
    // Är frosten bortsmält där älgen står, så att hon kan se honom?
    function algSyns() {
      const asp = duk.clientHeight / duk.clientWidth;
      let sum = 0, n = 0;
      for (let k = 0; k < 5; k++) for (let j = 0; j < 4; j++) {
        const x = alg.x + (k - 2) * 0.04, y = 0.2 + 0.03 + j * 0.035;
        const gx = Math.round(x * FW), gy = Math.round((1 - y / asp) * FH);
        if (gx < 0 || gx >= FW || gy < 0 || gy >= FH) continue;
        sum += Math.min(1, F[gy * FW + gx]); n++;
      }
      return n > 0 && sum / n < 0.35;
    }
    function algRor(dt) {
      tackTid -= dt;
      if (tackTid <= 0) {
        let sum = 0, n = 0;
        for (let i = 0; i < N; i += 37) { sum += Math.min(1, F[i]); n++; }
        tackning = sum / n;
        tackTid = 0.5;
        if (alg && !alg.sedd && algSyns()) { alg.sedd = true; alg.gaVidare = slump(3, 6); }
      }
      if (!alg) {
        if (algKlar) return;
        tillAlg -= dt;
        if (tillAlg <= 0 && tackning > 0.62) {
          const hoger = Math.random() < 0.5;
          const x = hoger ? -0.2 : 1.2;
          alg = { x, rikt: hoger ? 1 : -1, fas: 0, stopp: hoger ? 0.67 : 0.33, startX: x, gatt: false, sedd: false, gaVidare: 0 };
        }
        return;
      }
      // Har hon sett honom står han kvar en stund och går sedan vidare
      if (alg.sedd && !alg.gatt) {
        alg.gaVidare -= dt;
        if (alg.gaVidare <= 0) alg.gatt = true;
      }
      const star = !alg.gatt && Math.abs(alg.x - alg.stopp) < 0.005;
      if (star) return;
      alg.x += alg.rikt * ALG_FART * dt;
      if (!alg.gatt && (alg.x - alg.stopp) * alg.rikt > 0) alg.x = alg.stopp;
      alg.fas += ALG_FART * dt / 0.13;
      if (alg.x < -0.3 || alg.x > 1.3) { alg = null; algKlar = true; }
    }

    // ---------- Ritslinga ----------
    let knasterTid = 1;
    const stoppa = slinga((tid, dt) => {
      for (let i = 0; i < N; i++) if (skydd[i] > 0) skydd[i] -= dt;
      // Frosten växer långsamt, så att man kan se den kräla fram under flera minuter
      const vaxt = vaxa(Math.floor(2200 * Math.min(2, dt * 60)));
      smalt(dt);
      finger.varme += ((finger.nere ? 1 : 0) - finger.varme) * Math.min(1, dt * 2.5);

      // Ett svagt knaster när frosten växer, och ett sus när fingret värmer
      const t = ctx.currentTime;
      knasterTid -= dt * (0.3 + vaxt / 60);
      if (knasterTid <= 0) {
        brusstot(ctx, ut, { frekvens: slump(4000, 9000), q: 2, styrka: slump(0.02, 0.06), langd: 0.0006, nar: t });
        knasterTid = slump(0.2, 1.4);
      }
      vind.uppdatera(dt);
      finger.fart *= Math.exp(-dt * 8);
      const gf = finger.nere ? Math.min(1, finger.fart) : 0;
      gnG.gain.setTargetAtTime(0.07 * gf, t, 0.03);
      gnF.frequency.setTargetAtTime(1400 + 1400 * gf, t, 0.05);
      // Gnisslet hackar lite, som när huden fastnar och släpper mot glaset
      giG.gain.setTargetAtTime(0.025 * gf * (0.4 + 0.6 * Math.random()), t, 0.02);
      giF.frequency.setTargetAtTime(900 + 700 * gf, t, 0.08);

      utjamna();
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, FW, FH, gl.RED, gl.FLOAT, Fm);
      anpassa(gl, duk, 0.75);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform3f(u.u_varme, finger.x, finger.y, finger.varme);
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_synlig, mjuk(0, 3, tid));
      algRor(dt);
      gl.uniform4f(u.u_alg, alg ? alg.x : 0, alg ? alg.rikt : 1, alg ? alg.fas : 0, alg ? 1 : 0);
      if (alg) algSpar = [alg.startX, alg.x - alg.rikt * 0.04];
      gl.uniform2f(u.u_algSpar, algSpar[0], algSpar[1]);
      ritaHelskarm(gl);
    });

    return stangning({ ljud: l, stoppa, gl });
  },
};
