// Lucka 4: Timglaset
// Ett timglas i en träställning med fin sand som rinner genom halsen.
// Tyngdkraften följer telefonens lutning hela tiden: sandytan lägger sig vågrätt i
// verkligheten och sanden glider åt det håll man lutar. Ett tryck vänder glaset, och
// sanden rasar och rinner under själva vändningen.
// Sanden är en cellautomat med ungefär ett korn per pixel. Fallande korn får fart, så
// strålen blir sammanhängande, och lite slump i hur kornen glider gör flödet levande.
//
// Ljudet byggs av korn (lib/korn-processor.js): varje korn som landar blir ett litet,
// mjukt knäpp. Simuleringen berättar hur många som landar, hur långt de har fallit
// och om de träffar glaset eller sanden, och hur mycket som rasar nedför högen. Den
// nedre kupan klingar svagt och ihåligt, och klangen stiger när den fylls, som när
// man fyller en flaska.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { brusKalla, rum } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { lyssnaLutning } from '../lib/rorelse.js';
import { mjuk, rumsLjud, slinga, fingrar, stangning, brusstot } from '../lib/scen.js';

const GW = 210, GH = 420;   // sandens rutnät inne i glaset
const MITT = GH / 2;
const S = GH / 300;         // skala för ställningens mått
const NACKE = 2.0;          // halva halsens bredd i celler
const BULB = 92;            // halva bredden där glaset är som vidast
const GENOM = 0.45;         // sannolikhet att ett korn tar sig in i halsen per steg
const FRIKTION = 0.28;      // sannolikhet att ett stoppat korn blir liggande en stund
const VAND_TID = 2.6;       // sekunder för att vända glaset

// Glasets profil, samma formel i JavaScript och i shadern
const radie = (y) => {
  const t = Math.abs(y + 0.5 - MITT) / MITT;
  return NACKE + (BULB - NACKE) * mjuk(0.02, 0.55, t) * (1 - 0.33 * mjuk(0.78, 1, t));
};

// De åtta riktningarna, vinkel k * 45 grader i rutnätet (y nedåt)
const RX = [1, 1, 0, -1, -1, -1, 0, 1];
const RY = [0, 1, 1, 1, 0, -1, -1, -1];

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform sampler2D u_sand;
uniform float u_vinkel;
uniform float u_cell;      // pixlar per sandcell
uniform float u_tid;
uniform float u_synlig;
${BRUS}

const float GW = ${GW}.0, GH = ${GH}.0, MITT = ${MITT}.0, S = ${S.toFixed(4)};
const float NACKE = ${NACKE.toFixed(3)}, BULB = ${BULB}.0;

float ss(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
float radie(float y) {
  float t = abs(y - MITT) / MITT;
  return NACKE + (BULB - NACKE) * ss(0.02, 0.55, t) * (1.0 - 0.33 * ss(0.78, 1.0, t));
}

vec3 sandFarg(float k) {
  if (k < 1.5) return vec3(0.90, 0.80, 0.62);
  if (k < 2.5) return vec3(0.84, 0.71, 0.52);
  if (k < 3.5) return vec3(0.95, 0.88, 0.74);
  if (k < 4.5) return vec3(0.76, 0.62, 0.45);
  return vec3(0.98, 0.94, 0.86);
}

vec3 tra(vec2 p, float ljus) {
  float ad = fbm(vec2(p.x * 0.045, p.y * 0.65)) * 0.6 + brus(vec2(p.x * 0.35, p.y * 4.5)) * 0.15;
  vec3 c = mix(vec3(0.30, 0.17, 0.09), vec3(0.50, 0.31, 0.17), ad);
  return c * ljus;
}

float tom(ivec2 c) { return texelFetch(u_sand, c, 0).r < 0.002 ? 1.0 : 0.0; }

void main() {
  vec2 mid = u_res * 0.5;
  vec2 d = gl_FragCoord.xy - mid;
  float cs = cos(-u_vinkel), sn = sin(-u_vinkel);
  d = vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs);
  vec2 g = vec2(d.x / u_cell + GW * 0.5, GH * 0.5 - d.y / u_cell);

  // Bakgrund: varmt mörker med ett mjukt ljus bakom glaset
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 dn = (gl_FragCoord.xy - mid) / u_res.y;
  vec3 c = mix(vec3(0.05, 0.035, 0.04), vec3(0.16, 0.10, 0.08), exp(-dot(dn, dn) * 5.0));
  c *= 0.9 + 0.1 * fbm(uv * 3.0);

  float dx = g.x - GW * 0.5;
  float r = radie(clamp(g.y, 0.0, GH));
  float vagg = 2.2 * S;

  float plattaH = 12.0 * S;
  float plattaB = BULB * 1.32;
  bool ovan = g.y < -1.0 && g.y > -1.0 - plattaH;
  bool under = g.y > GH + 1.0 && g.y < GH + 1.0 + plattaH;
  float stolpeX = BULB * 1.16;
  float sx = abs(abs(dx) - stolpeX);
  float stolpeR = (3.2 + 0.9 * sin(g.y / S * 0.09) * sin(g.y / S * 0.021)) * S;
  bool stolpe = g.y > -1.0 && g.y < GH + 1.0 && sx < stolpeR;
  bool bakre = g.y > -1.0 && g.y < GH + 1.0 && abs(dx) < stolpeR * 0.9;

  if (bakre) {
    float cyl = sqrt(max(0.0, 1.0 - pow(dx / (stolpeR * 0.9), 2.0)));
    c = mix(c, tra(g + 40.0, 0.35 + 0.35 * cyl), 0.55);
  }

  float kant = abs(dx) - r;
  if (g.y > 0.0 && g.y < GH && kant < vagg) {
    if (kant < 0.0) {
      ivec2 ci = ivec2(floor(g));
      float k = texelFetch(u_sand, ci, 0).r * 255.0;
      if (k > 0.5) {
        vec3 s = sandFarg(k);
        // Korn i ytan fångar ljuset, korn inne i högen ligger i skugga
        float ytan = tom(ci + ivec2(0, -1)) + tom(ci + ivec2(-1, 0)) * 0.6 + tom(ci + ivec2(1, 0)) * 0.3 + tom(ci + ivec2(0, 1)) * 0.2;
        s *= 0.8 + 0.16 * hash(vec2(ci)) + 0.1 * min(ytan, 1.5);
        s *= 0.86 + 0.18 * (0.5 - dx / (r * 2.0 + 1.0));
        s *= 1.0 - 0.25 * ss(0.6, 1.0, abs(dx) / max(r, 1.0));
        c = s;
      }
    }
    float tjock = ss(-r * 0.6, vagg, kant);
    c = mix(c, c * vec3(0.92, 0.96, 1.0) + vec3(0.03, 0.035, 0.04), 0.4 + 0.4 * tjock);
    float rel = dx / max(r, 2.0);
    float glans = exp(-pow((rel + 0.55) / 0.08, 2.0)) * 0.22 + exp(-pow((rel - 0.72) / 0.04, 2.0)) * 0.12;
    glans *= 0.6 + 0.4 * ss(0.1, 0.5, abs(g.y - MITT) / MITT);
    c += vec3(1.0, 0.97, 0.92) * glans;
    c += vec3(0.9, 0.85, 0.8) * exp(-pow((kant - vagg * 0.4) / (0.9 * S), 2.0)) * 0.18;
  }

  if (stolpe) {
    float cyl = sqrt(max(0.0, 1.0 - pow(sx / stolpeR, 2.0)));
    float sida = sign(abs(dx) - stolpeX) * sign(dx);
    c = tra(g, 0.35 + 0.65 * cyl * (0.8 - 0.2 * sida));
  }
  if (ovan || under) {
    float py = ovan ? (g.y + 1.0 + plattaH) / plattaH : (g.y - GH - 1.0) / plattaH;
    float rundning = 1.0 - pow(abs(py - 0.5) * 2.0, 6.0);
    if (abs(dx) < plattaB * (0.97 + 0.03 * rundning)) {
      float kantljus = ovan ? (1.0 - py) : py;
      c = tra(vec2(g.y * 3.0, g.x * 0.3), 0.45 + 0.4 * rundning + 0.15 * kantljus);
    }
  }

  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, u_tid), 1.0);
}`;

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, ['u_res', 'u_sand', 'u_vinkel', 'u_cell', 'u_tid', 'u_synlig']);

    // ---------- Sanden ----------
    const N = GW * GH;
    const mask = new Uint8Array(N);
    const nacke = new Uint8Array(N);
    const sand = new Uint8Array(N);
    const fart = new Uint8Array(N);
    const flyttad = new Uint32Array(N);
    for (let y = 0; y < GH; y++) {
      const r = radie(y);
      for (let x = 0; x < GW; x++) {
        if (Math.abs(x + 0.5 - GW / 2) < r) {
          mask[y * GW + x] = 1;
          if (Math.abs(y + 0.5 - MITT) < 3) nacke[y * GW + x] = 1;
        }
      }
    }
    const farg = () => { const v = Math.random(); return v < 0.35 ? 1 : v < 0.6 ? 2 : v < 0.8 ? 3 : v < 0.95 ? 4 : 5; };
    for (let y = Math.floor(GH * 0.2); y < MITT - 3; y++) {
      for (let x = 0; x < GW; x++) if (mask[y * GW + x]) sand[y * GW + x] = farg();
    }
    for (let y = GH - 1; y > GH - 30; y--) {
      for (let x = 0; x < GW; x++) {
        const i = y * GW + x;
        if (mask[i] && GH - 1 - y < 28 - Math.abs(x - GW / 2) * 0.55) sand[i] = farg();
      }
    }

    let stampel = 1;
    let genom = 0;
    let nedslag = 0, nedslagFart = 0, nedslagGlas = 0, glid = 0;
    let tarEmot = true;   // true när den nedre halvan av rutnätet är kupan som tar emot sanden

    // Flytta ett korn. k0 och fr väljer huvudriktningen nära tyngdkraften.
    function korn(x, y, k0, fr) {
      const i = y * GW + x;
      const k = sand[i];
      if (!k || flyttad[i] === stampel) return;
      const pd = Math.random() < 1 - fr ? k0 : (k0 + 1) & 7;
      const dx = RX[pd], dy = RY[pd];
      // Fallande korn får fart och kan ta flera steg på en gång
      const max = 1 + (fart[i] >> 2);
      let cx = x, cy = y, j = i, n = 0;
      while (n < max) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || nx >= GW || ny < 0 || ny >= GH) break;
        const nj = ny * GW + nx;
        if (!mask[nj] || sand[nj]) break;
        if (nacke[nj] && !nacke[j] && Math.random() > GENOM) break;
        if (dx && dy && sand[cy * GW + nx] && sand[ny * GW + cx]) break;
        cx = nx; cy = ny; j = nj; n++;
      }
      if (n > 0) {
        sand[j] = k; sand[i] = 0;
        fart[j] = Math.min(7, fart[i] + 1); fart[i] = 0;
        flyttad[j] = stampel;
        if ((y < MITT) !== (cy < MITT)) genom++;
        return;
      }
      // Ett korn som föll och nu har stannat har landat: på glaset eller på sanden
      if (fart[i] >= 3 && (y >= MITT) === tarEmot) {
        nedslag++;
        nedslagFart += fart[i];
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= GW || ny < 0 || ny >= GH || !mask[ny * GW + nx]) nedslagGlas++;
      }
      fart[i] = 0;
      if (Math.random() < FRIKTION) return;
      // Stoppat: glid åt något annat håll som går nedförsbacke räknat mot tyngdkraften.
      // Lika bra riktningar provas i slumpad ordning, så att sanden inte drar åt ena sidan.
      for (let gi = 0; gi < grupper.length; gi++) {
        const grupp = grupper[gi];
        const vand = grupp.length === 2 && Math.random() < 0.5;
        for (let s = 0; s < grupp.length; s++) {
          const sd = grupp[vand ? 1 - s : s];
          if (sd === pd) continue;
          const sx = RX[sd], sy = RY[sd];
          const nx = x + sx, ny = y + sy;
          if (nx < 0 || nx >= GW || ny < 0 || ny >= GH) continue;
          const nj = ny * GW + nx;
          if (!mask[nj] || sand[nj]) continue;
          if (nacke[nj] && !nacke[i] && Math.random() > GENOM) continue;
          if (sx && sy && sand[y * GW + nx] && sand[ny * GW + x]) continue;
          sand[nj] = k; sand[i] = 0;
          flyttad[nj] = stampel;
          if ((y < MITT) !== (ny < MITT)) genom++;
          if ((y >= MITT) === tarEmot) glid++;
          return;
        }
      }
    }

    // Riktningar som går nedförsbacke, grupperade så att nästan lika bra hamnar ihop
    let grupper = [];
    function nedforsbacke(gx, gy) {
      const l = Math.hypot(gx, gy) || 1;
      const lista = [];
      for (let d = 0; d < 8; d++) {
        const dl = Math.hypot(RX[d], RY[d]);
        const p = (RX[d] * gx + RY[d] * gy) / (dl * l);
        if (p > 0.3) lista.push({ d, p });
      }
      lista.sort((a, b) => b.p - a.p);
      grupper = [];
      for (let n = 0; n < lista.length; n++) {
        if (n + 1 < lista.length && Math.abs(lista[n].p - lista[n + 1].p) < 0.06) {
          grupper.push([lista[n].d, lista[n + 1].d]);
          n++;
        } else {
          grupper.push([lista[n].d]);
        }
      }
    }

    // Ett steg för hela sanden. Kornen längst fram i tyngdkraftens riktning flyttas först.
    function steg(gx, gy) {
      stampel++;
      tarEmot = gy > 0;
      nedforsbacke(gx, gy);
      let a = Math.atan2(gy, gx) / (Math.PI / 4);
      if (a < 0) a += 8;
      const k0 = Math.floor(a) & 7, fr = a - Math.floor(a);
      const yFram = gy > 0, xFram = gx > 0;
      if (Math.abs(gy) >= Math.abs(gx)) {
        for (let n = 0; n < GH; n++) {
          const y = yFram ? GH - 1 - n : n;
          const motX = Math.abs(gx) < 0.1 ? Math.random() < 0.5 : xFram;
          for (let m = 0; m < GW; m++) korn(motX ? GW - 1 - m : m, y, k0, fr);
        }
      } else {
        for (let m = 0; m < GW; m++) {
          const x = xFram ? GW - 1 - m : m;
          for (let n = 0; n < GH; n++) korn(x, yFram ? GH - 1 - n : n, k0, fr);
        }
      }
    }

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, GW, GH, 0, gl.RED, gl.UNSIGNED_BYTE, sand);
    gl.uniform1i(u.u_sand, 0);

    // ---------- Ljud ----------
    const l = rumsLjud(1.2, 1.5);
    const { ctx, ut } = l;
    const eko = rum(1.6);
    const ekoUt = ctx.createGain();
    ekoUt.gain.value = 0.25;
    eko.connect(ekoUt).connect(ut);
    // Kornen, och den nedre kupans ihåliga klang
    const kupa = ctx.createBiquadFilter();
    kupa.type = 'bandpass'; kupa.frequency.value = 800; kupa.Q.value = 1.8;
    const kupaG = ctx.createGain(); kupaG.gain.value = 0.45;
    kupa.connect(kupaG).connect(ut);
    const kupaEko = ctx.createGain(); kupaEko.gain.value = 0.5;
    kupaG.connect(kupaEko).connect(eko);
    let kornNod = null;
    let reserv = null;
    (async () => {
      try {
        await ctx.audioWorklet.addModule(new URL('../lib/korn-processor.js', import.meta.url));
        kornNod = new AudioWorkletNode(ctx, 'andrum-korn', { outputChannelCount: [2] });
        kornNod.connect(ut);
        kornNod.connect(kupa);
        l.kallor.push({ stop: () => { try { kornNod.disconnect(); } catch {} } });
      } catch {
        // Utan ljudtråd: det gamla, enklare suset, men svagare
        const strale = brusKalla('korn');
        const straleF = ctx.createBiquadFilter();
        straleF.type = 'bandpass'; straleF.frequency.value = 3600; straleF.Q.value = 0.7;
        const straleG = ctx.createGain(); straleG.gain.value = 0;
        strale.connect(straleF).connect(straleG).connect(ut);
        l.kallor.push(strale);
        reserv = straleG;
      }
    })();
    const rumston = brusKalla('rosa');
    const rumF = ctx.createBiquadFilter(); rumF.type = 'lowpass'; rumF.frequency.value = 220;
    const rumG = ctx.createGain(); rumG.gain.value = 0.015;
    rumston.connect(rumF).connect(rumG).connect(ut);
    l.kallor.push(rumston);

    function knack(nar) {
      brusstot(ctx, ut, { frekvens: 320, q: 2, styrka: 0.45, langd: 0.012, nar });
      brusstot(ctx, eko, { frekvens: 280, q: 2, styrka: 0.25, langd: 0.012, nar });
    }

    // ---------- Tyngdkraften och vändningen ----------
    let varldG = { x: 0, y: -1 };   // skärmens riktningar, y uppåt
    let malG = { x: 0, y: -1 };
    const slutaLuta = lyssnaLutning((beta, gamma) => {
      const b = (beta * Math.PI) / 180, g = (gamma * Math.PI) / 180;
      const gx = Math.cos(b) * Math.sin(g), gy = -Math.sin(b);
      const m = Math.hypot(gx, gy);
      // Ligger telefonen platt gäller skärmens nederkant
      const v = mjuk(0.12, 0.4, m);
      const x = (m > 1e-6 ? gx / m : 0) * v, y = (m > 1e-6 ? gy / m : -1) * v - (1 - v);
      const l2 = Math.hypot(x, y) || 1;
      malG = { x: x / l2, y: y / l2 };
    });

    let vinkel = 0;
    let vandning = null;
    fingrar(duk, {
      upp: (x, y, id, { tryck }) => {
        if (!tryck || vandning) return;
        vandning = { fran: vinkel, start: null };
        knack(ctx.currentTime);
      },
    });

    // ---------- Ritslinga ----------
    let stegAck = 0;
    let flode = 0;
    let ljusN = 0.5, glasN = 0, rasN = 0, tathetN = 0, fyllN = 0.5, fyllTid = 0;
    const stoppa = slinga((tid, dt) => {
      if (vandning) {
        if (vandning.start === null) vandning.start = tid;
        const p = Math.min(1, (tid - vandning.start) / VAND_TID);
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        vinkel = vandning.fran + Math.PI * e;
        if (p >= 1) {
          vinkel %= Math.PI * 2;
          vandning = null;
          knack(ctx.currentTime);
        }
      }
      varldG.x += (malG.x - varldG.x) * 0.08;
      varldG.y += (malG.y - varldG.y) * 0.08;

      // Tyngdkraften sedd från glaset: vrid med glasets vinkel, och vänd y till rutnätets håll
      const c = Math.cos(vinkel), s = Math.sin(vinkel);
      const lx = varldG.x * c + varldG.y * s;
      const ly = -varldG.x * s + varldG.y * c;

      genom = 0;
      nedslag = 0; nedslagFart = 0; nedslagGlas = 0; glid = 0;
      stegAck += dt * 120;
      let n = 0;
      while (stegAck >= 1 && n < 6) { steg(lx, -ly); stegAck -= 1; n++; }
      if (n >= 6) stegAck = 0;
      flode += (genom / Math.max(dt, 1e-3) / 110 - flode) * 0.08;

      const t = ctx.currentTime;
      const f = Math.min(1, flode);
      const ds = Math.max(dt, 1e-3);
      // Hur långt kornen har fallit, och hur många som träffar glaset
      if (nedslag > 0) {
        ljusN += (Math.min(1, Math.max(0, (nedslagFart / nedslag - 3) / 4)) - ljusN) * 0.1;
        glasN += (nedslagGlas / nedslag - glasN) * 0.1;
      }
      // Korn som landar per sekund, och korn som rasar nedför högen
      tathetN += (Math.min(6500, nedslag / ds * 2.5) - tathetN) * 0.35;
      rasN += (Math.min(1500, glid / ds * 0.12) - rasN) * 0.35;
      // Hur full den nedre kupan är, alltså den som kornen faller ner i
      fyllTid -= dt;
      if (fyllTid <= 0) {
        fyllTid = 0.25;
        const nedreHalvan = -ly > 0;
        let i = 0, alla = 0;
        for (let p = 0; p < N; p++) {
          if (!sand[p]) continue;
          alla++;
          if (((p / GW) | 0) >= MITT === nedreHalvan) i++;
        }
        fyllN = alla ? i / alla : 0.5;
      }
      if (kornNod) {
        const P = kornNod.parameters;
        P.get('tathet').setTargetAtTime(tathetN, t, 0.05);
        P.get('ljus').setTargetAtTime(ljusN, t, 0.1);
        P.get('glas').setTargetAtTime(glasN, t, 0.1);
        P.get('ras').setTargetAtTime(rasN, t, 0.08);
      } else if (reserv) {
        reserv.gain.setTargetAtTime(0.03 * f, t, 0.15);
      }
      // Kupan klingar högre ju mindre luft som är kvar i den
      kupa.frequency.setTargetAtTime(650 / Math.sqrt(Math.max(0.18, 1 - fyllN)), t, 0.5);

      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, GW, GH, gl.RED, gl.UNSIGNED_BYTE, sand);
      const dpr = anpassa(gl, duk, 0.75);
      const hojd = Math.min(duk.clientHeight * 0.66, duk.clientWidth * 1.45);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform1f(u.u_vinkel, vinkel);
      // Under vändningen krymper glaset lite, så att det ryms på skärmen när det ligger ner
      gl.uniform1f(u.u_cell, ((hojd * dpr) / GH) * (1 - 0.42 * Math.abs(Math.sin(vinkel))));
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_synlig, mjuk(0, 2.5, tid));
      ritaHelskarm(gl);
    });

    return stangning({ ljud: l, stoppa, gl, extra: [slutaLuta] });
  },
};
