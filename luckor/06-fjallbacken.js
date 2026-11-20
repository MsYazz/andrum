// Lucka 6: Fjällbäcken
// En grund fjällbäck sedd uppifrån. Klart vatten strömmar över en botten av rundade
// stenar, och solkatter dansar på botten. Några större stenar sticker upp och vattnet
// delar sig runt dem. Fingret blir en sten: vattnet porlar och skummar runt det.
// Strömningen räknas fram som en vätska (Stable Fluids), och vattenytan ritas med
// en flödeskarta som flyttar ytans mönster med strömmen.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { BRUS } from '../lib/glsl.js';
import { skapaVatska } from '../lib/vatska.js';
import { skapaPorl } from '../lib/porl.js';
import { skapaMatta } from '../lib/inspelning.js';
import { mjuk, slump, rumsLjud, slinga, fastaSteg, fingrar, stangning } from '../lib/scen.js';

const W = 40, H = 80;      // vätskans rutnät
const V0 = 14;             // strömmens fart i celler per sekund
const LOV = 5;
const FINGER_R = 3.2;      // fingerstenens radie i celler

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform sampler2D u_flode;   // hastighet (celler/s), skum, fast
uniform vec2 u_rut;
uniform vec4 u_sten[4];      // x, y (0..1, y nedåt), radie (andel av bredden), frö
uniform int u_antal;
uniform vec4 u_lov[${LOV}];  // x, y, vinkel, storlek
uniform float u_tid;
uniform float u_synlig;
${BRUS}

// Cellmönster: avstånd till närmaste och näst närmaste punkt, och cellens id
vec3 celler(vec2 p, out vec2 id) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = hash2(i + g) * 0.8 + 0.1;
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; id = i + g; } else if (d < d2) d2 = d;
  }
  return vec3(d1, d2, 0.0);
}

vec3 stenFarg(vec2 id) {
  float h = hash(id * 1.7);
  vec3 c = vec3(0.50, 0.48, 0.44);
  if (h < 0.2) c = vec3(0.56, 0.46, 0.34);
  else if (h < 0.38) c = vec3(0.38, 0.40, 0.38);
  else if (h < 0.52) c = vec3(0.62, 0.58, 0.50);
  else if (h < 0.64) c = vec3(0.45, 0.33, 0.27);
  else if (h < 0.76) c = vec3(0.36, 0.42, 0.36);
  return c * (0.85 + 0.3 * hash(id + 3.1));
}

// Rundslipade stenar: en avlång, vriden ellips i varje cell. Glipan emellan är sand.
// Returnerar färg i rgb och täckning i a, och stenens höjd i h.
vec4 rullsten(vec2 p, out float h) {
  vec2 i = floor(p), f = fract(p);
  vec4 bast = vec4(0.0);
  h = -1.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 id = i + g;
    vec2 c = g + hash2(id) * 0.6 + 0.2 - f;
    float ang = hash(id * 3.1) * 6.283;
    float el = 1.0 + hash(id + 7.0) * 0.7;
    float rr = 0.3 + 0.2 * hash(id + 1.3);
    vec2 cr = vec2(c.x * cos(ang) - c.y * sin(ang), c.x * sin(ang) + c.y * cos(ang));
    cr.x /= el;
    float d = length(cr) / rr;
    if (d < 1.0) {
      float z = sqrt(1.0 - d * d);
      if (z > h) {
        h = z;
        float sida = dot(normalize(-c + 1e-4), normalize(vec2(-0.6, -0.8))) * (1.0 - z);
        vec3 fc = stenFarg(id) * (0.55 + 0.45 * z + 0.3 * sida);
        bast = vec4(fc, smoothstep(1.0, 0.9, d));
      }
    }
  }
  return bast;
}

float solkatter(vec2 p) {
  float a = brus(p);
  float b = brus(p * 1.7 + 9.0);
  return pow(1.0 - abs(a - b), 9.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 tc = vec2(uv.x, 1.0 - uv.y);
  float asp = u_res.y / u_res.x;
  vec2 sc = vec2(tc.x, tc.y * asp);        // skärmbredden = 1

  vec4 f = texture(u_flode, tc);
  vec2 vel = vec2(f.x / u_rut.x, f.y / u_rut.y * asp);
  float fart = length(f.xy) / ${V0}.0;

  // Flödeskarta: två lager av ytmönster som flyttas med strömmen och tonas om varandra
  float T = 1.6;
  float ph0 = fract(u_tid / T), ph1 = fract(u_tid / T + 0.5);
  float w0 = 1.0 - abs(2.0 * ph0 - 1.0);
  vec2 q = sc * 6.0;
  vec2 q0 = q - vel * 6.0 * ph0 * T;
  vec2 q1 = q - vel * 6.0 * ph1 * T + 0.37;
  float yta = fbm(q0 * 1.4) * w0 + fbm(q1 * 1.4) * (1.0 - w0);
  float krus = 0.3 + 0.6 * clamp(fart, 0.0, 1.5);
  vec2 lut = vec2(dFdx(yta), dFdy(yta)) * krus * 16.0;
  vec3 n = normalize(vec3(-lut, 1.0));

  // Botten: rundade stenar sedda genom vattnet, lite förskjutna av ytans brytning
  vec2 b = sc * 6.0 + n.xy * 0.12;
  float hs, hg;
  vec4 sten = rullsten(b, hs);
  vec4 grus = rullsten(b * 3.3 + 11.0, hg);
  vec3 sand = vec3(0.60, 0.54, 0.44) * (0.8 + 0.25 * brus(b * 14.0));
  vec3 botten = mix(sand * 0.78, grus.rgb * 0.9, grus.a * 0.85);
  // Skugga runt stenarna där de ligger an mot sanden
  botten *= 0.82 + 0.18 * smoothstep(0.0, 0.25, 1.0 - sten.a);
  botten = mix(botten, sten.rgb * (0.92 + 0.12 * fbm(b * 5.0)), sten.a);

  // Solkatter som rör sig med strömmen
  float sk = solkatter(q0 * 1.3) * w0 + solkatter(q1 * 1.3) * (1.0 - w0);
  botten += vec3(1.0, 0.97, 0.85) * sk * 0.22;

  // Vattnets egen färg, en svag himmelsreflex och enstaka glimtar
  vec3 vatten = botten * vec3(0.80, 0.90, 0.86) + vec3(0.015, 0.04, 0.04);
  vec3 L = normalize(vec3(-0.4, 0.5, 0.75));
  vec3 Hv = normalize(L + vec3(0.0, 0.0, 1.0));
  float glans = pow(max(dot(n, Hv), 0.0), 220.0);
  vatten += vec3(1.0, 0.98, 0.92) * glans * 0.35;
  vatten += vec3(0.55, 0.65, 0.72) * (1.0 - n.z) * 0.25;

  // Skum där vattnet trycks runt stenarna
  float skumBrus = fbm(q0 * 3.0) * w0 + fbm(q1 * 3.0) * (1.0 - w0);
  float skum = smoothstep(0.25, 0.8, f.z * (0.45 + skumBrus));
  vatten = mix(vatten, vec3(0.92, 0.95, 0.95), skum * 0.75);

  vec3 c = vatten;

  // Löv som flyter med strömmen, med en svag skugga på botten
  for (int i = 0; i < ${LOV}; i++) {
    vec4 l = u_lov[i];
    vec2 d = sc - vec2(l.x, l.y * asp);
    for (int s = 0; s < 2; s++) {
      vec2 dd = s == 0 ? d - vec2(0.012, -0.016) : d;
      float ca = cos(l.z), sa = sin(l.z);
      vec2 r = vec2(dd.x * ca - dd.y * sa, dd.x * sa + dd.y * ca) / l.w;
      float blad = length(vec2(r.x * 0.55, r.y * 1.0 + 0.25 * r.x * r.x)) ;
      float inne = smoothstep(0.5, 0.44, blad);
      if (s == 0) c *= 1.0 - inne * 0.25;
      else {
        vec3 lf = mix(vec3(0.95, 0.74, 0.22), vec3(0.85, 0.48, 0.16), hash(vec2(float(i), 3.0)));
        lf *= 0.85 + 0.2 * (1.0 - abs(r.y) * 2.0);
        lf *= 1.0 - 0.3 * smoothstep(0.03, 0.0, abs(r.y)) * step(abs(r.x), 0.9);
        c = mix(c, lf, inne);
      }
    }
  }

  // Stenar som sticker upp ur vattnet, våta och mörka med ljusa kanter
  for (int i = 0; i < 4; i++) {
    if (i >= u_antal) break;
    vec4 s = u_sten[i];
    vec2 d = sc - vec2(s.x, s.y * asp);
    float a = atan(d.y, d.x);
    float r = s.z * (1.0 + 0.08 * sin(3.0 * a + s.w) + 0.05 * sin(5.0 * a + 2.0 * s.w));
    float dl = length(d);
    if (dl < r * 1.25) {
      float vat = smoothstep(r * 1.25, r, dl);
      c *= 1.0 - vat * 0.25;
    }
    if (dl < r) {
      float z = sqrt(max(0.0, 1.0 - pow(dl / r, 2.0)));
      vec3 sn = normalize(vec3(d.x / r, -d.y / r, z * 1.2));
      vec3 bas = mix(vec3(0.22, 0.22, 0.21), vec3(0.36, 0.34, 0.31), fbm(d * 40.0 + s.w));
      float lj = max(dot(sn, L), 0.0);
      float glans2 = pow(max(dot(sn, Hv), 0.0), 40.0) * 0.4;
      vec3 stc = bas * (0.35 + 0.8 * lj) + vec3(1.0) * glans2;
      stc = mix(stc, stc * 0.75, smoothstep(r * 0.65, r, dl));
      c = mix(c, stc, smoothstep(r, r * 0.94, dl));
    }
  }

  c *= 1.0 - 0.35 * pow(abs(uv.x - 0.5) * 2.0, 3.0);
  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, u_tid), 1.0);
}`;

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, ['u_res', 'u_flode', 'u_rut', 'u_sten', 'u_antal', 'u_lov', 'u_tid', 'u_synlig']);

    // ---------- Vätskan ----------
    const vatska = skapaVatska(W, H, { iterationer: 24 });
    const { u: vu, v: vv, fast } = vatska;
    const skum = new Float32Array(W * H), skum2 = new Float32Array(W * H);
    const asp = () => duk.clientHeight / duk.clientWidth;

    // Stenar som sticker upp, på nya platser varje gång
    const stenar = [];
    const antal = 2 + Math.floor(Math.random() * 3);
    for (let k = 0; k < antal; k++) {
      for (let f = 0; f < 40; f++) {
        const r = slump(2.4, 4.4);
        const x = slump(r + 4, W - r - 4), y = slump(H * 0.22, H * 0.85);
        if (stenar.some((s) => Math.hypot(s.x - x, s.y - y) < s.r + r + 7)) continue;
        stenar.push({ x, y, r, fro: slump(0, 10) });
        break;
      }
    }
    const stenFast = new Uint8Array(W * H);
    for (const s of stenar) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (Math.hypot(x + 0.5 - s.x, (y + 0.5 - s.y)) < s.r * 0.95) stenFast[y * W + x] = 1;
      }
    }
    // Startflöde: rakt nedåt överallt
    for (let i = 0; i < W * H; i++) vv[i] = stenFast[i] ? 0 : V0;

    const finger = { x: -100, y: -100, nere: false };
    let turbulens = 0;

    function steg(dt, tid) {
      // Hinder: stenarna och fingret
      for (let i = 0; i < W * H; i++) fast[i] = stenFast[i];
      if (finger.nere) {
        const x0 = Math.max(0, Math.floor(finger.x - FINGER_R - 1)), x1 = Math.min(W - 1, Math.ceil(finger.x + FINGER_R + 1));
        const y0 = Math.max(0, Math.floor(finger.y - FINGER_R - 1)), y1 = Math.min(H - 1, Math.ceil(finger.y + FINGER_R + 1));
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          if (Math.hypot(x + 0.5 - finger.x, y + 0.5 - finger.y) < FINGER_R) fast[y * W + x] = 1;
        }
      }
      // Inflöde uppifrån som slingrar sig lite, utflöde nertill
      for (let y = 0; y < 2; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        vv[i] = V0 * (1 + 0.25 * Math.sin((x / W) * Math.PI * 2 + tid * 0.3));
        vu[i] = V0 * 0.12 * Math.sin(tid * 0.21 + x * 0.1);
      }
      for (let x = 0; x < W; x++) {
        vv[(H - 1) * W + x] = vv[(H - 2) * W + x];
        vu[(H - 1) * W + x] = vu[(H - 2) * W + x];
      }
      // Sidorna är stränder som vattnet inte går igenom
      for (let y = 0; y < H; y++) { vu[y * W] = Math.max(0, vu[y * W]); vu[y * W + W - 1] = Math.min(0, vu[y * W + W - 1]); }
      vatska.steg(dt, { virvlar: 0.3 });

      // Skummet bildas där vattnet virvlar och trycks runt hinder, flyter med och löses upp
      let bildat = 0;
      const { virvel } = vatska;
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (fast[i]) continue;
        const naraHinder = fast[i - 1] || fast[i + 1] || fast[i - W] || fast[i + W];
        const sp = Math.hypot(vu[i], vv[i]) / V0;
        const g = Math.max(0, Math.abs(virvel[i]) - 5) * 0.02 + (naraHinder ? sp * 0.8 : 0);
        skum[i] = Math.min(1, skum[i] + g * dt);
        bildat += g;
      }
      vatska.advektera(skum2, skum, dt);
      const d = Math.exp(-dt * 1.1);
      for (let i = 0; i < W * H; i++) skum[i] = skum2[i] * d;
      turbulens += (bildat / 40 - turbulens) * 0.05;
    }

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const texData = new Float32Array(W * H * 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, W, H, 0, gl.RGBA, gl.FLOAT, texData);
    gl.uniform1i(u.u_flode, 0);
    gl.uniform2f(u.u_rut, W, H);
    gl.uniform1i(u.u_antal, stenar.length);
    const stenData = new Float32Array(16);
    stenar.forEach((s, i) => stenData.set([s.x / W, s.y / H, s.r / W, s.fro], i * 4));
    gl.uniform4fv(u.u_sten, stenData);

    // Löven börjar utspridda och kommer tillbaka uppifrån när de flutit förbi
    const lov = Array.from({ length: LOV }, () => ({
      x: slump(4, W - 4), y: slump(0, H), vinkel: slump(0, 6.28), storlek: slump(0.035, 0.05), spinn: 0,
    }));
    const lovData = new Float32Array(LOV * 4);

    // ---------- Ljud ----------
    const l = rumsLjud(1.2, 1.6);
    const { ctx, ut } = l;
    // Porlet: en inspelning av en liten bäck på svenska landsbygden. Där vattnet
    // virvlar, till exempel runt fingret, blir porlet starkare och ljusare.
    const backBuss = ctx.createGain(); backBuss.gain.value = 0.7;
    const ljusF = ctx.createBiquadFilter(); ljusF.type = 'lowpass'; ljusF.frequency.value = 4000; ljusF.Q.value = 0.6;
    backBuss.connect(ljusF).connect(ut);
    const backMatta = skapaMatta(ctx, backBuss, 'ljud/fjallback.mp3', {
      avsnitt: [[0.1, 15.5]], niva: 0.05, bit: [4, 8], over: 1.5, hp: 90, tonhojd: 0.03,
    });
    l.kallor.push(backMatta);
    let porl = null;
    backMatta.klar.catch(() => {
      // Gick inspelningen inte att ladda tar det framräknade porlet över
      porl = skapaPorl(ctx, ut);
      l.kallor.push(...porl.kallor);
    });

    // ---------- Fingret ----------
    const tillRut = (x, y) => [(x / duk.clientWidth) * W, (y / duk.clientHeight) * H];
    fingrar(duk, {
      ner: (x, y) => { [finger.x, finger.y] = tillRut(x, y); finger.nere = true; },
      drag: (x, y) => { [finger.x, finger.y] = tillRut(x, y); },
      upp: () => { finger.nere = false; },
    }, { ett: true });

    // ---------- Ritslinga ----------
    const fysik = fastaSteg(1 / 60, 4);
    const stoppa = slinga((tid, dt) => {
      fysik(dt, (h) => steg(h, tid));

      // Löven följer strömmen och snurrar med virvlarna
      for (const b of lov) {
        const vx = vatska.las(vu, b.x, b.y), vy = vatska.las(vv, b.x, b.y);
        const w = vatska.las(vatska.virvel, b.x, b.y);
        b.x += vx * dt * 0.9;
        b.y += vy * dt * 0.9;
        b.spinn += (w * 0.5 - b.spinn) * 0.05;
        b.vinkel += b.spinn * dt;
        // Fastnar ett löv mot en sten glider det långsamt runt
        for (const s of stenar) {
          const dx = b.x - s.x, dy = b.y - s.y, d = Math.hypot(dx, dy);
          if (d < s.r + 0.8) { b.x = s.x + (dx / d) * (s.r + 0.8); b.y = s.y + (dy / d) * (s.r + 0.8); }
        }
        if (b.y > H + 3 || b.x < -3 || b.x > W + 3) { b.y = -3; b.x = slump(4, W - 4); }
      }
      lov.forEach((b, i) => lovData.set([b.x / W, b.y / H, b.vinkel, b.storlek], i * 4));

      for (let i = 0; i < W * H; i++) {
        texData[i * 4] = vu[i]; texData[i * 4 + 1] = vv[i]; texData[i * 4 + 2] = skum[i]; texData[i * 4 + 3] = fast[i];
      }
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RGBA, gl.FLOAT, texData);

      // Porlet blir livligare där vattnet virvlar, till exempel runt fingret
      const liv = Math.min(1, 0.15 + turbulens * 0.8);
      if (porl && tid > 0.8) porl.uppdatera(dt, liv);
      backBuss.gain.setTargetAtTime(0.6 + 0.55 * liv, ctx.currentTime, 0.25);
      ljusF.frequency.setTargetAtTime(2800 + 7000 * liv, ctx.currentTime, 0.25);

      anpassa(gl, duk, 0.6);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform4fv(u.u_lov, lovData);
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_synlig, mjuk(0, 2.5, tid));
      ritaHelskarm(gl);
      void asp;
    });

    return stangning({ ljud: l, stoppa, gl });
  },
};
