// Lucka 16: Tuschpenseln
// Ett ark gräddvitt rispapper. Fingret är en tuschpensel: långsamma drag blir breda och
// mättade, snabba drag tunna och torra med strimmor där penselhåren delar sig. Bläcket
// tar slut under draget och fylls på vid nästa. Det våta bläcket flyter ut i fibrerna
// och torkar med mörkare kanter, som riktigt tusch.
// Papperet är ett rutnät av vatten, bläck i vattnet och bläck som fastnat i fibrerna.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { brusKalla, rum } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { mjuk, slump, klamp, rumsLjud, slinga, fastaSteg, fingrar, stangning, brusstot } from '../lib/scen.js';
import { mottagare } from '../lib/mottagare.js';

const PW = 180, PH = 390;

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform sampler2D u_ark;   // r: bläck i fibrerna, g: bläck i vattnet, b: vatten
uniform vec2 u_rut;
uniform float u_tid;
uniform float u_synlig;
uniform sampler2D u_hanko;  // namnstämpeln: röd med vita inristade tecken
uniform vec4 u_hankoLage;   // mitt x, y (som arket, y nedåt), storlek (skärmbredder), vinkel
uniform float u_hankoA;     // hur mycket som syns av stämpeln
${BRUS}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 tc = vec2(uv.x, 1.0 - uv.y);
  float asp = u_res.y / u_res.x;
  vec2 p = vec2(uv.x, uv.y * asp);

  // Rispapper: gräddvitt med långa fibrer och små flagor
  float fiber = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float a = fi * 1.9 + 0.4;
    vec2 r = vec2(cos(a), sin(a));
    vec2 q = p * (14.0 + fi * 6.0);
    fiber += pow(brus(vec2(dot(q, r) * 0.25, dot(q, vec2(-r.y, r.x)) * 6.0)), 6.0) * 0.6;
  }
  vec3 papper = vec3(0.93, 0.90, 0.82) * (0.96 + 0.05 * fbm(p * 6.0));
  papper += vec3(0.05, 0.05, 0.04) * fiber;
  papper *= 1.0 - 0.06 * step(0.997, hash(floor(gl_FragCoord.xy * 0.4)));

  vec4 a = texture(u_ark, tc);
  // Bläcket kornar sig lite i fibrerna
  float korn = 0.85 + 0.3 * brus(gl_FragCoord.xy * 0.5) + fiber * 0.4;
  float black = a.r * korn + a.g * 0.8;
  vec3 tusch = vec3(0.07, 0.07, 0.10);
  vec3 c = mix(papper, tusch, 1.0 - exp(-black * 1.9));
  // Vått bläck glänser svagt och är lite mörkare
  c *= 1.0 - 0.08 * smoothstep(0.1, 0.6, a.b);

  // Namnstämpeln i hörnet, med ojämnt tryck och papperets fibrer igenom färgen
  if (u_hankoA > 0.0) {
    vec2 d = (tc - u_hankoLage.xy) * vec2(1.0, asp);
    float cv = cos(u_hankoLage.w), sv = sin(u_hankoLage.w);
    d = vec2(cv * d.x + sv * d.y, -sv * d.x + cv * d.y) / u_hankoLage.z + 0.5;
    if (d.x > 0.0 && d.x < 1.0 && d.y > 0.0 && d.y < 1.0) {
      float farg = texture(u_hanko, d).a;
      float tryck = 0.72 + 0.28 * brus(gl_FragCoord.xy * 0.35) - fiber * 0.25;
      tryck *= 0.85 + 0.15 * brus(d * 9.0);
      vec3 cinnober = vec3(0.78, 0.16, 0.1);
      c = mix(c, c * cinnober * 1.15, clamp(farg * tryck, 0.0, 1.0) * u_hankoA);
    }
  }

  c *= 1.0 - 0.2 * pow(length(uv - 0.5) * 1.3, 2.5);
  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, u_tid), 1.0);
}`;

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, ['u_hanko', 'u_hankoLage', 'u_hankoA', 'u_res', 'u_ark', 'u_rut', 'u_tid', 'u_synlig']);

    // ---------- Papperet ----------
    const N = PW * PH;
    const fast = new Float32Array(N), los = new Float32Array(N), vatten = new Float32Array(N);
    const los2 = new Float32Array(N), vatten2 = new Float32Array(N);
    const ledning = new Float32Array(N);   // hur lätt vatten sprids i fibrerna här
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
      const f = Math.sin(x * 0.7 + Math.sin(y * 0.11) * 3) * Math.sin(y * 0.23 + x * 0.05);
      ledning[y * PW + x] = 0.35 + 0.65 * Math.pow(Math.random(), 0.5) * (0.6 + 0.4 * f * f);
    }

    function sprid() {
      // Vatten och bläck i vattnet rinner ut i fibrerna, vatten avdunstar, bläck fastnar
      for (let y = 1; y < PH - 1; y++) {
        const r = y * PW;
        for (let x = 1; x < PW - 1; x++) {
          const i = r + x;
          const w = vatten[i];
          let nyW = w, nyL = los[i];
          const grannar = [i - 1, i + 1, i - PW, i + PW];
          for (const j of grannar) {
            const fl = (vatten[j] - w) * 0.11 * ledning[i] * ledning[j];
            nyW += fl;
            // Bläcket följer med vattnet, från den som har mer vatten
            nyL += fl > 0 ? fl * (los[j] / Math.max(vatten[j], 1e-3)) : fl * (los[i] / Math.max(w, 1e-3));
          }
          vatten2[i] = Math.max(0, nyW - 0.0012);
          los2[i] = Math.max(0, nyL);
        }
      }
      for (let i = 0; i < N; i++) {
        vatten[i] = vatten2[i];
        // Där vattnet torkar fastnar bläcket, mest i kanterna där det är lite vatten kvar
        const torr = 1 - Math.min(1, vatten[i] * 4);
        const fastnar = los2[i] * (0.004 + 0.06 * torr);
        fast[i] += fastnar;
        los[i] = los2[i] - fastnar;
      }
    }

    // ---------- Penseln ----------
    let blackMangd = 1;
    let forra = null;
    let svisch = 0;
    function stampla(x, y, radie, dx, dy, torrhet) {
      const nx = -dy, ny = dx;
      const R = Math.ceil(radie + 1);
      for (let yy = Math.max(1, Math.floor(y - R)); yy <= Math.min(PH - 2, Math.ceil(y + R)); yy++) {
        for (let xx = Math.max(1, Math.floor(x - R)); xx <= Math.min(PW - 2, Math.ceil(x + R)); xx++) {
          const rx = xx - x, ry = yy - y;
          const d = Math.hypot(rx, ry) / radie;
          if (d > 1) continue;
          // Torra drag får strimmor där penselhåren delar sig
          const har = Math.floor((rx * nx + ry * ny) * 1.4 + 50);
          const slumpHar = Math.abs(Math.sin(har * 12.9898 + 4.1) * 43758.5) % 1;
          const strimma = torrhet > 0 && slumpHar < torrhet ? 0.08 : 1;
          const i = yy * PW + xx;
          const m = (1 - d * d) * strimma;
          vatten[i] = Math.min(1.1, vatten[i] + 0.26 * m * blackMangd);
          los[i] = Math.min(1.8, los[i] + 0.3 * m * blackMangd);
        }
      }
    }
    const tillRut = (x, y) => [(x / duk.clientWidth) * PW, (y / duk.clientHeight) * PH];
    fingrar(duk, {
      ner: (x, y) => {
        blackMangd = 1;
        const [gx, gy] = tillRut(x, y);
        forra = { x: gx, y: gy, t: performance.now(), dx: 0, dy: 1, langd: 0 };
        stampla(gx, gy, 2.2, 0, 1, 0);
        drag = [[gx, gy]];
      },
      drag: (x, y) => {
        if (!forra) return;
        const nu = performance.now();
        const [gx, gy] = tillRut(x, y);
        const d = Math.hypot(gx - forra.x, gy - forra.y);
        if (d < 0.3) return;
        const fart = (d / Math.max(8, nu - forra.t)) * 1000 / PW;   // arkbredder per sekund
        const dx = (gx - forra.x) / d, dy = (gy - forra.y) / d;
        const steg = Math.ceil(d / 0.6);
        // Långsamt är brett, fort är smalt och torrt
        // Penseln trycks ner i början av draget, så strecket sväller upp från en spets
        const tryck = mjuk(0, 14, forra.langd) * 0.65 + 0.35;
        const radie = klamp(6.5 - fart * 4.5, 1.4, 6.5) * (0.5 + 0.5 * blackMangd) * tryck;
        const torrhet = klamp((fart - 0.6) * 0.5 + (1 - blackMangd) * 0.7, 0, 0.6);
        for (let s = 1; s <= steg; s++) {
          stampla(forra.x + (gx - forra.x) * s / steg, forra.y + (gy - forra.y) * s / steg, radie, dx, dy, torrhet);
        }
        blackMangd = Math.max(0.15, blackMangd - d * 0.0016);
        svisch = Math.min(1, svisch + fart * 0.2);
        forra = { x: gx, y: gy, t: nu, dx, dy, langd: forra.langd + d };
        drag.push([gx, gy]);
      },
      upp: () => {
        forra = null;
        if (!hanko.satt && arEnso(drag)) { hanko.satt = true; hanko.vantar = 0.9; }
        drag = [];
      },
    }, { ett: true });

    // ---------- Namnstämpeln ----------
    // Målar hon en sluten cirkel i ett enda drag, en ensō, trycks en röd namnstämpel i
    // hörnet, som på en riktig tuschmålning. Till Vivan står hennes namn i katakana,
    // annars Andrum. Tecknen står i två lodräta kolumner som läses från höger.
    const NAMN = mottagare === 'vivan' ? ['ヴ', 'ィ', 'ヴ', 'ァ', 'ン'] : ['ア', 'ン', 'ド', 'ル', 'ム'];
    const SMA = new Set(['ィ', 'ァ']);
    function ritaHanko() {
      const S = 256;
      const cv = document.createElement('canvas');
      cv.width = cv.height = S;
      const g = cv.getContext('2d');
      // Ett rött block med lite ojämna kanter, och tecknen inristade så att papperet syns
      g.fillStyle = '#000';
      g.beginPath();
      const n = 40;
      for (let i = 0; i < n * 4; i++) {
        const sida = Math.floor(i / n), t = (i % n) / n;
        const ojamn = (Math.random() - 0.5) * 3;
        const m = 14, L = S - 2 * m;
        const pts = [[m + L * t, m + ojamn], [S - m + ojamn, m + L * t], [S - m - L * t, S - m + ojamn], [m + ojamn, S - m - L * t]];
        const [x, y] = pts[sida];
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath();
      g.fill();
      g.globalCompositeOperation = 'destination-out';
      // En smal inre ram, som på många stämplar
      g.lineWidth = 5;
      g.strokeRect(30, 30, S - 60, S - 60);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const kolumner = [NAMN.slice(0, 3), NAMN.slice(3)];
      kolumner.forEach((kol, k) => {
        const x = k === 0 ? S * 0.665 : S * 0.335;
        const steg = (S - 84) / 3;
        const y0 = k === 0 ? 42 + steg / 2 : 42 + steg;
        kol.forEach((tecken, j) => {
          const liten = SMA.has(tecken);
          g.font = `900 ${liten ? 58 : 84}px "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", "Noto Sans CJK JP", serif`;
          g.fillText(tecken, x + (liten ? 8 : 0), y0 + j * steg - (liten ? 6 : 0));
          // Lite tjockare streck, som när tecknen är skurna i sten
          g.lineWidth = liten ? 2 : 3;
          g.strokeText(tecken, x + (liten ? 8 : 0), y0 + j * steg - (liten ? 6 : 0));
        });
      });
      return cv;
    }
    const hankoTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, hankoTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ritaHanko());
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(u.u_hanko, 1);
    const hanko = { a: 0, mal: 0, vantar: 0, satt: false };
    let drag = [];
    // Är draget en ensō? Ungefär lika långt från mitten hela vägen, nästan ett helt varv,
    // och slutet nära början
    function arEnso(pts) {
      if (pts.length < 20) return false;
      let cx = 0, cy = 0;
      for (const [x, y] of pts) { cx += x; cy += y; }
      cx /= pts.length; cy /= pts.length;
      const r = pts.map(([x, y]) => Math.hypot(x - cx, y - cy));
      const R = r.reduce((a, b) => a + b, 0) / r.length;
      if (R < PW * 0.1) return false;
      const sd = Math.sqrt(r.reduce((a, b) => a + (b - R) ** 2, 0) / r.length);
      if (sd / R > 0.2) return false;
      let varv = 0;
      for (let i = 1; i < pts.length; i++) {
        let da = Math.atan2(pts[i][1] - cy, pts[i][0] - cx) - Math.atan2(pts[i - 1][1] - cy, pts[i - 1][0] - cx);
        if (da > Math.PI) da -= 2 * Math.PI;
        if (da < -Math.PI) da += 2 * Math.PI;
        varv += da;
      }
      if (Math.abs(varv) < Math.PI * 2 * 0.85) return false;
      const [x0, y0] = pts[0], [x1, y1] = pts[pts.length - 1];
      return Math.hypot(x1 - x0, y1 - y0) < R * 0.5;
    }

    // ---------- Nytt ark ----------
    let nyttArk = 0;
    const knapp = document.createElement('button');
    knapp.className = 'lucka-ui slata';
    knapp.style.color = 'rgba(60, 50, 40, 0.42)';
    knapp.textContent = 'nytt ark';
    knapp.addEventListener('click', () => { nyttArk = 1; });
    scen.append(knapp);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const data = new Float32Array(N * 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, PW, PH, 0, gl.RGBA, gl.FLOAT, data);
    gl.uniform1i(u.u_ark, 0);
    gl.uniform2f(u.u_rut, PW, PH);

    // ---------- Ljud ----------
    const l = rumsLjud(1.25, 1.5);
    const { ctx, ut } = l;
    const eko = rum(2.5);
    const ekoUt = ctx.createGain(); ekoUt.gain.value = 0.3;
    eko.connect(ekoUt).connect(ut);
    const rumston = brusKalla('rosa');
    const rF = ctx.createBiquadFilter(); rF.type = 'lowpass'; rF.frequency.value = 160;
    const rG = ctx.createGain(); rG.gain.value = 0.025;
    rumston.connect(rF).connect(rG).connect(ut);
    const pensel = brusKalla('rosa');
    const pF = ctx.createBiquadFilter(); pF.type = 'bandpass'; pF.frequency.value = 2400; pF.Q.value = 0.7;
    const pG = ctx.createGain(); pG.gain.value = 0;
    pensel.connect(pF).connect(pG).connect(ut);
    l.kallor.push(rumston, pensel);
    // En bambufontän långt borta: vatten som rinner i, och ett klonk när röret slår i stenen
    function bambu() {
      const t = ctx.currentTime;
      brusstot(ctx, ut, { frekvens: 520, q: 6, styrka: 0.35, langd: 0.02, nar: t });
      brusstot(ctx, eko, { frekvens: 500, q: 6, styrka: 0.3, langd: 0.02, nar: t });
      brusstot(ctx, ut, { frekvens: 900, q: 4, styrka: 0.12, langd: 0.01, nar: t + 0.01 });
    }

    // ---------- Ritslinga ----------
    const fasta = fastaSteg(1 / 40, 3);
    let bambuTid = slump(15, 30);
    const stoppa = slinga((tid, dt) => {
      fasta(dt, sprid);
      if (nyttArk > 0) {
        // Det gamla arket bleknar bort och ett nytt kommer fram
        const k = Math.exp(-dt * 3);
        for (let i = 0; i < N; i++) { fast[i] *= k; los[i] *= k; vatten[i] *= k; }
        nyttArk -= dt * 0.8;
        if (nyttArk <= 0) { fast.fill(0); los.fill(0); vatten.fill(0); nyttArk = 0; }
        // Stämpeln följer med det gamla arket
        hanko.a *= k; hanko.mal = 0; hanko.satt = false; hanko.vantar = 0;
      }
      svisch *= Math.exp(-dt * 5);
      const t = ctx.currentTime;
      pG.gain.setTargetAtTime(0.045 * svisch, t, 0.04);
      bambuTid -= dt;
      if (bambuTid <= 0) { bambu(); bambuTid = slump(35, 70); }

      for (let i = 0; i < N; i++) { data[i * 4] = fast[i]; data[i * 4 + 1] = los[i]; data[i * 4 + 2] = vatten[i]; }
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, PW, PH, gl.RGBA, gl.FLOAT, data);
      anpassa(gl, duk, 0.75);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_synlig, mjuk(0, 2.5, tid));
      // Stämpeln trycks dit en liten stund efter cirkeln, med ett dovt tock
      if (hanko.vantar > 0) {
        hanko.vantar -= dt;
        if (hanko.vantar <= 0) {
          hanko.mal = 1;
          hanko.lage = [slump(0.8, 0.86), slump(0.86, 0.9), 0.13, slump(-0.06, 0.06)];
          brusstot(ctx, ut, { frekvens: 180, q: 1.2, styrka: 0.12, langd: 0.012, nar: ctx.currentTime });
        }
      }
      hanko.a += (hanko.mal - hanko.a) * Math.min(1, dt * 9);
      if (hanko.lage) gl.uniform4f(u.u_hankoLage, ...hanko.lage);
      gl.uniform1f(u.u_hankoA, hanko.a);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, hankoTex);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      ritaHelskarm(gl);
    });

    return stangning({ ljud: l, stoppa, gl });
  },
};
