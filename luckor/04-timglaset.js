// Lucka 4: Timglaset
// Ett timglas i en träställning. Sanden rinner korn för korn genom halsen och lägger sig
// i en kon i botten. Tryck på glaset, eller vänd telefonen, så vänds timglaset.
// Sanden är en cellautomat: varje korn faller rakt ner eller glider snett när det är fritt.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { brusKalla, rum } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { lyssnaLutning } from '../lib/rorelse.js';
import { mjuk, rumsLjud, slinga, fingrar, stangning, brusstot } from '../lib/scen.js';

const GW = 150, GH = 300;   // sandens rutnät inne i glaset
const MITT = GH / 2;
const NACKE = 1.1;          // halva halsens bredd i celler
const BULB = 66;            // halva bredden där glaset är som vidast
const GENOM = 0.45;         // sannolikhet att ett korn passerar halsen per steg
const VAND_TID = 2.2;       // sekunder för att vända glaset

// Glasets profil, samma formel i JavaScript och i shadern.
const radie = (y) => {
  const t = Math.abs(y + 0.5 - MITT) / MITT;
  return NACKE + (BULB - NACKE) * mjuk(0.02, 0.55, t) * (1 - 0.33 * mjuk(0.78, 1, t));
};

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

const float GW = ${GW}.0, GH = ${GH}.0, MITT = ${MITT}.0;
const float NACKE = ${NACKE}, BULB = ${BULB}.0;

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
  float ad = fbm(vec2(p.x * 0.06, p.y * 0.9)) * 0.6 + brus(vec2(p.x * 0.5, p.y * 6.0)) * 0.15;
  vec3 c = mix(vec3(0.30, 0.17, 0.09), vec3(0.50, 0.31, 0.17), ad);
  return c * ljus;
}

void main() {
  vec2 mid = u_res * 0.5;
  vec2 d = gl_FragCoord.xy - mid;
  float cs = cos(-u_vinkel), sn = sin(-u_vinkel);
  d = vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs);

  // Lokala koordinater i celler: x från vänster kant av rutnätet, y nedåt från glasets topp
  vec2 g = vec2(d.x / u_cell + GW * 0.5, GH * 0.5 - d.y / u_cell);

  // Bakgrund: varmt mörker med ett mjukt ljus bakom glaset
  vec2 uv = gl_FragCoord.xy / u_res;
  vec3 c = mix(vec3(0.05, 0.035, 0.04), vec3(0.16, 0.10, 0.08), exp(-dot(d / u_res.y, d / u_res.y) * 5.0));
  c *= 0.9 + 0.1 * fbm(uv * 3.0);

  float dx = g.x - GW * 0.5;
  float r = radie(clamp(g.y, 0.0, GH));
  float vagg = 2.2;

  // Ställningen: plattor över och under, och två svarvade stolpar
  float plattaB = BULB * 1.32;
  bool ovan = g.y < -1.0 && g.y > -13.0;
  bool under = g.y > GH + 1.0 && g.y < GH + 13.0;
  float stolpeX = BULB * 1.16;
  float sx = abs(abs(dx) - stolpeX);
  float stolpeR = 3.2 + 0.9 * sin(g.y * 0.09) * sin(g.y * 0.021);
  bool stolpe = g.y > -1.0 && g.y < GH + 1.0 && sx < stolpeR;
  // Bakre stolpen syns svagt genom glaset
  bool bakre = g.y > -1.0 && g.y < GH + 1.0 && abs(dx) < stolpeR * 0.9;

  if (bakre) {
    float cyl = sqrt(max(0.0, 1.0 - pow(dx / (stolpeR * 0.9), 2.0)));
    c = mix(c, tra(g + 40.0, 0.35 + 0.35 * cyl), 0.55);
  }

  // Glaset
  float kant = abs(dx) - r;
  if (g.y > 0.0 && g.y < GH && kant < vagg) {
    // Sanden
    if (kant < 0.0) {
      ivec2 ci = ivec2(floor(g));
      float k = texelFetch(u_sand, ci, 0).r * 255.0;
      if (k > 0.5) {
        vec3 s = sandFarg(k);
        float ovanTom = texelFetch(u_sand, ci + ivec2(0, -1), 0).r < 0.002 ? 1.0 : 0.0;
        float vTom = texelFetch(u_sand, ci + ivec2(-1, -1), 0).r < 0.002 ? 1.0 : 0.0;
        s *= 0.82 + 0.14 * hash(vec2(ci)) + 0.12 * ovanTom + 0.06 * vTom;
        // mjukt ljus från vänster och lite skugga mot kanterna
        s *= 0.85 + 0.2 * (0.5 - dx / (r * 2.0 + 1.0));
        s *= 1.0 - 0.25 * ss(0.6, 1.0, abs(dx) / max(r, 1.0));
        c = s;
      }
    }
    // Glasets egen ton, tjockare mot kanterna
    float tjock = ss(-r * 0.6, vagg, kant);
    c = mix(c, c * vec3(0.92, 0.96, 1.0) + vec3(0.03, 0.035, 0.04), 0.4 + 0.4 * tjock);
    // Reflexer
    float rel = dx / max(r, 2.0);
    float glans = exp(-pow((rel + 0.55) / 0.08, 2.0)) * 0.22 + exp(-pow((rel - 0.72) / 0.04, 2.0)) * 0.12;
    glans *= 0.6 + 0.4 * ss(0.1, 0.5, abs(g.y - MITT) / MITT);
    c += vec3(1.0, 0.97, 0.92) * glans;
    // Kanten
    c += vec3(0.9, 0.85, 0.8) * exp(-pow((kant - vagg * 0.4) / 0.9, 2.0)) * 0.18;
  }

  if (stolpe) {
    float cyl = sqrt(max(0.0, 1.0 - pow(sx / stolpeR, 2.0)));
    float sida = sign(abs(dx) - stolpeX) * sign(dx);
    c = tra(g, 0.35 + 0.65 * cyl * (0.8 - 0.2 * sida));
  }
  if (ovan || under) {
    float py = ovan ? (g.y + 13.0) / 12.0 : (g.y - GH - 1.0) / 12.0;
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
    const mask = new Uint8Array(GW * GH);
    const sand = new Uint8Array(GW * GH);
    for (let y = 0; y < GH; y++) {
      const r = radie(y);
      for (let x = 0; x < GW; x++) if (Math.abs(x + 0.5 - GW / 2) < r) mask[y * GW + x] = 1;
    }
    // Fyll övre halvan, men låt sanden börja som en liten kon på väg ner
    const farg = () => { const v = Math.random(); return v < 0.35 ? 1 : v < 0.6 ? 2 : v < 0.8 ? 3 : v < 0.95 ? 4 : 5; };
    for (let y = Math.floor(GH * 0.2); y < MITT - 1; y++) {
      for (let x = 0; x < GW; x++) if (mask[y * GW + x]) sand[y * GW + x] = farg();
    }
    // Lite sand i botten redan, som om det har runnit en stund
    for (let y = GH - 1; y > GH - 22; y--) {
      for (let x = 0; x < GW; x++) {
        const i = y * GW + x;
        const kon = GH - 1 - y < 20 - Math.abs(x - GW / 2) * 0.55;
        if (mask[i] && kon) sand[i] = farg();
      }
    }

    let flode = 0;
    function steg() {
      let genom = 0;
      for (let y = GH - 2; y >= 0; y--) {
        const vanster = Math.random() < 0.5;
        for (let n = 0; n < GW; n++) {
          const x = vanster ? n : GW - 1 - n;
          const i = y * GW + x;
          const k = sand[i];
          if (!k) continue;
          const j = i + GW;
          const iHalsen = Math.abs(y + 1 - MITT) < 2;
          if (iHalsen && Math.random() > GENOM) continue;
          if (mask[j] && !sand[j]) {
            sand[j] = k; sand[i] = 0;
            if (y + 1 === MITT) genom++;
            continue;
          }
          // Glid snett ner, men inte alltid, så att konen blir lagom brant
          if (Math.random() < 0.35) continue;
          const forst = Math.random() < 0.5 ? -1 : 1;
          for (const s of [forst, -forst]) {
            const xx = x + s;
            if (xx < 0 || xx >= GW) continue;
            const jj = j + s;
            if (mask[jj] && !sand[jj] && !sand[i + s]) { sand[jj] = k; sand[i] = 0; break; }
          }
        }
      }
      return genom;
    }

    // Vänd: rotera hela sandfältet 180 grader, så blir det som att glaset vänts
    function vandSanden() {
      sand.reverse();
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

    // Ett tunt porlande av korn genom halsen, och ett mjukt sus där de landar
    const strale = brusKalla('korn');
    const straleF = ctx.createBiquadFilter();
    straleF.type = 'bandpass'; straleF.frequency.value = 4200; straleF.Q.value = 1.1;
    const straleG = ctx.createGain(); straleG.gain.value = 0;
    strale.connect(straleF).connect(straleG).connect(ut);
    const hog = brusKalla('rosa');
    const hogF = ctx.createBiquadFilter();
    hogF.type = 'bandpass'; hogF.frequency.value = 1700; hogF.Q.value = 0.8;
    const hogG = ctx.createGain(); hogG.gain.value = 0;
    hog.connect(hogF).connect(hogG).connect(ut);
    // Rummet: knappt hörbart
    const rumston = brusKalla('rosa');
    const rumF = ctx.createBiquadFilter(); rumF.type = 'lowpass'; rumF.frequency.value = 220;
    const rumG = ctx.createGain(); rumG.gain.value = 0.02;
    rumston.connect(rumF).connect(rumG).connect(ut);
    l.kallor.push(strale, hog, rumston);

    function vandLjud() {
      const t = ctx.currentTime;
      brusstot(ctx, ut, { frekvens: 320, q: 2, styrka: 0.5, langd: 0.012, nar: t });
      brusstot(ctx, eko, { frekvens: 280, q: 2, styrka: 0.3, langd: 0.012, nar: t });
      // sanden som flyttar sig när glaset vänds
      const s = brusKalla('korn');
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 0.7;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.09, t + 0.8);
      g.gain.linearRampToValueAtTime(0, t + VAND_TID);
      s.connect(f).connect(g).connect(ut);
      s.stop(t + VAND_TID + 0.1);
      brusstot(ctx, ut, { frekvens: 300, q: 2, styrka: 0.4, langd: 0.012, nar: t + VAND_TID });
    }

    // ---------- Att vända ----------
    let vander = null;
    function vand() {
      if (vander) return;
      vander = { start: null };
      vandLjud();
    }
    fingrar(duk, { upp: (x, y, id, { tryck }) => { if (tryck) vand(); } });
    let upponer = false;
    // Hålls telefonen upp och ner vänds glaset, men bara en gång per vändning
    const slutaLuta = lyssnaLutning((beta) => {
      const nu = Math.sin((beta * Math.PI) / 180) < -0.55;
      if (nu && !upponer) vand();
      upponer = nu;
    });

    // ---------- Ritslinga ----------
    let vinkel = 0;
    let stegAck = 0;
    const stoppa = slinga((tid, dt) => {
      if (vander) {
        if (vander.start === null) vander.start = tid;
        const p = Math.min(1, (tid - vander.start) / VAND_TID);
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        vinkel = Math.PI * e;
        if (p >= 1) { vandSanden(); vinkel = 0; vander = null; }
      } else {
        // Två steg per bildruta vid 60 bilder per sekund
        stegAck += dt * 120;
        let genom = 0, n = 0;
        while (stegAck >= 1 && n < 8) { genom += steg(); stegAck -= 1; n++; }
        flode += (genom / Math.max(dt, 1e-3) / 100 - flode) * 0.08;
      }
      const t = ctx.currentTime;
      const f = vander ? 0 : Math.min(1, flode);
      straleG.gain.setTargetAtTime(0.07 * f, t, 0.15);
      hogG.gain.setTargetAtTime(0.035 * f, t, 0.2);

      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, GW, GH, gl.RED, gl.UNSIGNED_BYTE, sand);
      const dpr = anpassa(gl, duk, 1);
      const hojd = Math.min(duk.clientHeight * 0.66, duk.clientWidth * 1.45);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform1f(u.u_vinkel, vinkel);
      // Under vändningen krymper glaset lite, så att det ryms på skärmen när det ligger ner
      gl.uniform1f(u.u_cell, ((hojd * dpr) / GH) * (1 - 0.42 * Math.sin(vinkel)));
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_synlig, mjuk(0, 2.5, tid));
      ritaHelskarm(gl);
    });

    return stangning({ ljud: l, stoppa, gl, extra: [slutaLuta] });
  },
};
