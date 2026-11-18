// Lucka 21: Längsta natten
// Vintersolståndet. En stjärnklar natt över ett snötäckt landskap med granar och en
// liten stuga med ett varmt fönster. Hon drar med fingret från stjärna till stjärna
// och gör egna stjärnbilder. Varje stjärna hon når klingar som en liten glasklocka,
// och när hon släpper spelar stjärnbilden sina toner en gång till, sakta.
// Lutar hon telefonen förskjuts himlen och skogen lite mot varandra, som när man
// vrider på huvudet. Ibland glider ett stjärnfall förbi, långsamt och svagt.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { rum } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { mjuk, slump, klamp, rumsLjud, slinga, fingrar, stangning, klang } from '../lib/scen.js';
import { lyssnaLutning } from '../lib/rorelse.js';
import { skapaVind } from '../lib/vind.js';

const ANTAL = 44;        // stjärnor man kan dra mellan
const LINJER = 40;       // högst så här många streck på himlen
const HORISONT = 0.5;    // horisontens höjd, i skärmbredder från nederkanten

// Moll-pentatonisk skala, högre upp på himlen klingar ljusare
const TONER = [293.66, 349.23, 392.0, 440.0, 523.25, 587.33, 698.46, 783.99, 880.0, 1046.5, 1174.66];

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform float u_tid;
uniform vec2 u_skift;             // himlens förskjutning av lutningen
uniform vec4 u_fall;              // stjärnfall: x, y, vinkel, förlopp (0..1, negativt = inget)
uniform float u_synlig;
${BRUS}

float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

float kulle(float x) {
  return ${HORISONT.toFixed(2)} + 0.025 * sin(x * 3.1 + 0.6) + 0.015 * sin(x * 7.3 + 2.0) + 0.008 * sin(x * 17.0);
}

void main() {
  float s = u_res.x;
  vec2 p = gl_FragCoord.xy / s;
  vec2 uv = gl_FragCoord.xy / u_res;
  float H = u_res.y / s;
  vec2 hp = p + u_skift;           // himlen, förskjuten

  // Himlen: nästan svart upptill, ett svagt blått sken mot horisonten
  float hojd = clamp((p.y - ${HORISONT.toFixed(2)}) / (H - ${HORISONT.toFixed(2)}), 0.0, 1.0);
  vec3 c = mix(vec3(0.1, 0.13, 0.25), vec3(0.02, 0.028, 0.07), pow(hojd, 0.55));

  // Vintergatan: ett svagt, molnigt band snett över himlen
  vec2 vg = hp - vec2(0.5, H * 0.62);
  float band = dot(vg, normalize(vec2(0.55, -1.0)));
  float tat = fbm(hp * 3.0 + 4.0) * 0.7 + fbm(hp * 9.0) * 0.3;
  float vintergata = exp(-band * band * 18.0) * smoothstep(0.35, 0.75, tat);
  c += vec3(0.12, 0.13, 0.18) * vintergata;
  c -= vec3(0.02) * exp(-band * band * 60.0) * smoothstep(0.55, 0.8, fbm(hp * 14.0 + 1.0));

  // Ett hav av små stjärnor i bakgrunden, som tindrar
  vec2 g = hp * 70.0;
  vec2 cell = floor(g);
  vec2 f = fract(g) - 0.5;
  float r = hash(cell);
  if (r > 0.82) {
    vec2 o = (hash2(cell + 7.0) - 0.5) * 0.7;
    float d = length(f - o);
    float tind = 0.65 + 0.35 * sin(u_tid * (1.0 + r * 3.0) + r * 40.0);
    float ljus = pow((r - 0.82) / 0.18, 2.0) * tind * (0.4 + 0.6 * vintergata + 0.4);
    c += vec3(0.75, 0.8, 1.0) * smoothstep(0.14, 0.0, d) * ljus * 0.9;
  }

  // Ett stjärnfall: en tunn ljusstrimma som glider och slocknar
  if (u_fall.w > 0.0 && u_fall.w < 1.0) {
    vec2 rikt = vec2(cos(u_fall.z), sin(u_fall.z));
    vec2 huvud = u_fall.xy + rikt * u_fall.w * 0.35;
    vec2 svans = huvud - rikt * 0.09;
    float d = segment(hp, svans, huvud);
    float langs = clamp(dot(hp - svans, rikt) / 0.09, 0.0, 1.0);
    float styrka = sin(u_fall.w * 3.14159);
    c += vec3(0.85, 0.9, 1.0) * smoothstep(0.0018, 0.0, d) * langs * langs * styrka * 0.6;
  }

  // Landskapet: snöiga kullar, en skog av granar, och en stuga med varmt fönster.
  // Det ligger närmare än himlen och förskjuts lite mer av lutningen.
  vec2 lp = p - u_skift * 2.5;
  float k = kulle(lp.x);
  // Granarna längs krönet: staplade trianglar, olika höga
  float skog = 0.0;
  for (int lag = 0; lag < 2; lag++) {
    float tat2 = lag == 0 ? 22.0 : 13.0;
    float x = lp.x * tat2 + float(lag) * 0.37;
    float id = floor(x);
    float fx = fract(x) - 0.5;
    float hgt = (lag == 0 ? 0.04 : 0.065) * (0.6 + 0.8 * hash(vec2(id, float(lag))));
    float bas = kulle((id + 0.5) / tat2) - 0.004 - float(lag) * 0.01;
    float yy = (lp.y - bas) / hgt;
    if (yy > 0.0 && yy < 1.0 && hash(vec2(id, 3.0 + float(lag))) > 0.25) {
      // Grenvåningar: varje våning bredast nertill, som en gran
      float vaning = fract(yy * 4.0 + 0.2);
      float vidd = (1.0 - yy) * (0.32 + 0.22 * (1.0 - vaning)) * 1.4;
      if (abs(fx) < vidd) skog = 1.0;
    }
  }
  if (lp.y < k || skog > 0.0) {
    // Snön lyser svagt blå av stjärnljuset
    float snoH = clamp((k - lp.y) * 3.0, 0.0, 1.0);
    vec3 sno = mix(vec3(0.3, 0.34, 0.47), vec3(0.15, 0.17, 0.26), snoH);
    sno *= 0.92 + 0.12 * fbm(lp * vec2(14.0, 40.0));
    // Mjuka drivor: ljusare krön mot himlen, skugga i svackorna
    float driva = fbm(vec2(lp.x * 1.6 + sin(lp.y * 9.0) * 0.3, lp.y * 18.0) + 3.0);
    sno *= 0.93 + 0.14 * smoothstep(0.35, 0.65, driva);
    // Snön glittrar svagt i stjärnljuset
    vec2 gc = floor(lp * vec2(260.0, 520.0));
    float gr = hash(gc);
    if (gr > 0.985) sno += vec3(0.6, 0.7, 0.9) * (0.5 + 0.5 * sin(u_tid * (1.5 + gr * 4.0) + gr * 80.0)) * 0.35 * (1.0 - snoH * 0.5);
    c = skog > 0.0 && lp.y > k - 0.01 ? vec3(0.025, 0.035, 0.05) : sno;
  }
  // Stugan vid kullens fot, med ett varmt fönster och lite rök
  vec2 st = lp - vec2(0.72, kulle(0.72) - 0.035);
  if (st.x > -0.035 && st.x < 0.035 && st.y > 0.0 && st.y < 0.03 + 0.025 * (1.0 - abs(st.x) / 0.035)) {
    c = vec3(0.02, 0.018, 0.025);
    // Snö på taket
    if (st.y > 0.026 + 0.025 * (1.0 - abs(st.x) / 0.035)) c = vec3(0.2, 0.22, 0.3);
    vec2 fo = st - vec2(0.012, 0.012);
    if (abs(fo.x) < 0.006 && abs(fo.y) < 0.006) {
      float flimmer = 0.9 + 0.1 * sin(u_tid * 2.3) * sin(u_tid * 1.1);
      c = vec3(1.0, 0.62, 0.26) * flimmer;
      if (abs(fo.x) < 0.0007 || abs(fo.y) < 0.0007) c *= 0.4;
    }
  }
  vec2 sken = lp - vec2(0.732, kulle(0.72) - 0.023);
  c += vec3(1.0, 0.55, 0.2) * exp(-dot(sken, sken) * 3500.0) * 0.2;

  c *= 1.0 - 0.3 * pow(length(uv - 0.5) * 1.2, 2.5);
  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, u_tid), 1.0);
}`;

// Stjärnorna och strecken ritas som små ytor ovanpå himlen, i stället för att varje
// pixel ska räkna på alla. Det gör rummet lätt att rita även på en äldre telefon.
const LJUS_VS = `#version 300 es
precision highp float;
precision highp int;
uniform vec4 u_stj[${ANTAL}];     // x, y, storlek, glöd när den nåtts
uniform vec4 u_lin[${LINJER}];    // från x, y, till x, y
uniform float u_linL[${LINJER}];  // hur långt strecket ritats (0..1) gånger ljusstyrka
uniform vec4 u_drag;              // strecket som följer fingret
uniform float u_dragL;
uniform int u_typ;                // 0 stjärnor, 1 streck
uniform vec2 u_skift;
uniform float u_H;
out vec2 v_lok;
out vec4 v_data;
out float v_l;
void main() {
  vec2 h = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  vec2 p;
  v_l = 0.0;
  if (u_typ == 0) {
    vec4 S = u_stj[gl_InstanceID];
    float r = 0.05 * (1.0 + S.w * 0.4);
    p = S.xy + h * r;
    v_lok = h * r;
    v_data = S;
  } else {
    vec4 L;
    float l;
    if (gl_InstanceID < ${LINJER}) { L = u_lin[gl_InstanceID]; l = u_linL[gl_InstanceID]; }
    else { L = u_drag; l = -u_dragL; }
    if (l == 0.0) { gl_Position = vec4(2.0, 2.0, 0.0, 1.0); return; }
    vec2 a = L.xy;
    vec2 b = l > 0.0 ? mix(a, L.zw, min(1.0, l)) : L.zw;
    vec2 dir = b - a;
    float len = length(dir);
    vec2 t = len > 1e-5 ? dir / len : vec2(1.0, 0.0);
    vec2 n = vec2(-t.y, t.x);
    float w = 0.012;
    float langs = (h.x * 0.5 + 0.5) * len + h.x * w;
    p = a + t * langs + n * h.y * w;
    v_lok = vec2(langs, h.y * w);
    v_data = vec4(len, 0.0, 0.0, 0.0);
    v_l = l;
  }
  p -= u_skift;
  gl_Position = vec4(p.x * 2.0 - 1.0, p.y / u_H * 2.0 - 1.0, 0.0, 1.0);
}`;

const LJUS_FS = `#version 300 es
precision highp float;
precision highp int;
in vec2 v_lok;
in vec4 v_data;
in float v_l;
out vec4 frag;
uniform int u_typ;
uniform float u_tid;
uniform float u_synlig;
void main() {
  vec3 c;
  if (u_typ == 0) {
    vec4 S = v_data;
    vec2 d = v_lok;
    float r2 = dot(d, d);
    float tind = 0.8 + 0.2 * sin(u_tid * (0.7 + fract(S.x * 13.0) * 1.6) + S.y * 30.0);
    float k = S.z * tind;
    vec3 farg = mix(vec3(0.8, 0.86, 1.0), vec3(1.0, 0.86, 0.6), fract(S.x * 7.0 + S.y * 3.0) * 0.6 + S.w * 0.5);
    c = farg * (exp(-r2 / (0.000012 * k)) * 1.2 + exp(-r2 / (0.0004 * k)) * 0.06 * k) * (1.0 + S.w * 1.3);
    // Svaga strålar i kors
    float stral = exp(-abs(d.x) * 900.0) * exp(-abs(d.y) * 90.0) + exp(-abs(d.y) * 900.0) * exp(-abs(d.x) * 90.0);
    c += farg * stral * 0.12 * k * (1.0 + S.w * 2.0);
    // Tona ut mot kanten av ytan
    c *= smoothstep(1.0, 0.7, length(d) / (0.05 * (1.0 + S.w * 0.4)));
  } else {
    float len = v_data.x;
    float dx = max(0.0, max(-v_lok.x, v_lok.x - len));
    float d = length(vec2(dx, v_lok.y));
    if (v_l > 0.0) {
      float styrka = min(1.0, v_l);
      c = vec3(1.0, 0.82, 0.5) * (smoothstep(0.0026, 0.0006, d) * 0.45 + exp(-d * d / 0.00004) * 0.12) * styrka;
    } else {
      c = vec3(1.0, 0.85, 0.55) * smoothstep(0.0022, 0.0005, d) * 0.28 * -v_l;
    }
  }
  frag = vec4(c * u_synlig, 1.0);
}`;

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, ['u_res', 'u_tid', 'u_skift', 'u_fall', 'u_synlig']);
    const ljusProg = program(gl, LJUS_VS, LJUS_FS);
    const v = platser(gl, ljusProg, ['u_stj', 'u_lin', 'u_linL', 'u_drag', 'u_dragL', 'u_typ', 'u_skift', 'u_H', 'u_tid', 'u_synlig']);

    // ---------- Stjärnorna ----------
    // Utspridda så att ingen ligger för nära en annan, alla ovanför skogen
    const H = () => duk.clientHeight / duk.clientWidth;
    const stjarnor = [];
    const hogst = H() - 0.12, lagst = HORISONT + 0.14;
    let forsok = 0;
    while (stjarnor.length < ANTAL && forsok++ < 4000) {
      const x = slump(0.06, 0.94), y = slump(lagst, hogst);
      if (stjarnor.some((s) => Math.hypot(s.x - x, s.y - y) < 0.1)) continue;
      const ljus = Math.random() < 0.25 ? slump(1.4, 2.2) : slump(0.6, 1.3);
      stjarnor.push({ x, y, ljus, glod: 0 });
    }
    const tonFor = (s) => TONER[klamp(Math.round(((s.y - lagst) / (hogst - lagst)) * (TONER.length - 1)), 0, TONER.length - 1)];

    const linjer = [];   // { a, b, l (0..1 hur långt ritat), ljus }
    let aktuell = -1;    // stjärnan strecket utgår från
    let kedja = [];      // stjärnorna i den stjärnbild hon ritar just nu
    const finger = { x: 0, y: 0, nere: false };
    let dragL = 0;

    // ---------- Lutningen ----------
    const skift = [0, 0], malSkift = [0, 0];
    let noll = null;
    const slutaLuta = lyssnaLutning((beta, gamma) => {
      if (noll === null) noll = beta;
      noll += (beta - noll) * 0.002;
      malSkift[0] = klamp(gamma / 45, -1, 1) * 0.012;
      malSkift[1] = klamp((beta - noll) / 30, -1, 1) * 0.01;
    });

    // ---------- Ljud ----------
    const l = rumsLjud(1.3, 2);
    const { ctx, ut } = l;
    const eko = rum(4.5);
    const ekoUt = ctx.createGain(); ekoUt.gain.value = 0.55;
    eko.connect(ekoUt).connect(ut);
    const vind = skapaVind(ctx, ut, { styrka: 0.35, ljus: 0.4 });
    l.kallor.push(...vind.kallor);
    // En glasklocka: grundton, en ljus delton och en svag hög
    const GLAS = [[1, 1, 3.5], [2.76, 0.28, 1.6], [5.4, 0.08, 0.7], [8.93, 0.03, 0.35]];
    function klinga(s, styrka = 1, nar) {
      klang(ctx, ut, tonFor(s), GLAS, { styrka: 0.022 * styrka, ansats: 0.006, eko, nar });
      s.glod = 1;
    }

    // ---------- Fingret ----------
    const tillVarld = (x, y) => [x / duk.clientWidth + skift[0], (duk.clientHeight - y) / duk.clientWidth + skift[1]];
    function narmast(x, y, radie, utom = -1) {
      let bast = -1, bd = radie;
      stjarnor.forEach((s, i) => {
        if (i === utom) return;
        const d = Math.hypot(s.x - x, s.y - y);
        if (d < bd) { bd = d; bast = i; }
      });
      return bast;
    }
    function koppla(a, b) {
      if (linjer.some((L) => (L.a === a && L.b === b) || (L.a === b && L.b === a))) return;
      if (linjer.length >= LINJER) {
        // Den äldsta stjärnbilden tonar bort för att ge plats
        const aldst = linjer.find((L) => !L.bort);
        if (aldst) aldst.bort = true;
      }
      linjer.push({ a, b, l: 0, ljus: 1, bort: false });
    }
    fingrar(duk, {
      ner: (x, y) => {
        [finger.x, finger.y] = tillVarld(x, y);
        finger.nere = true;
        aktuell = narmast(finger.x, finger.y, 0.07);
        kedja = aktuell >= 0 ? [aktuell] : [];
        if (aktuell >= 0) klinga(stjarnor[aktuell]);
      },
      drag: (x, y) => {
        [finger.x, finger.y] = tillVarld(x, y);
        if (aktuell < 0) {
          // Började hon bredvid en stjärna kan strecket ändå börja när hon når en
          aktuell = narmast(finger.x, finger.y, 0.045);
          if (aktuell >= 0) { kedja = [aktuell]; klinga(stjarnor[aktuell]); }
          return;
        }
        const ny = narmast(finger.x, finger.y, 0.045, aktuell);
        if (ny >= 0) {
          koppla(aktuell, ny);
          klinga(stjarnor[ny]);
          aktuell = ny;
          kedja.push(ny);
        }
      },
      upp: () => {
        finger.nere = false;
        // Stjärnbilden spelar sina toner en gång till, sakta, som ett eko på himlen
        if (kedja.length >= 3) {
          const t = ctx.currentTime + 0.9;
          kedja.forEach((i, n) => {
            const s = stjarnor[i];
            klang(ctx, ut, tonFor(s), GLAS, { styrka: 0.014, ansats: 0.02, eko, nar: t + n * 0.42 });
            setTimeout(() => { s.glod = Math.max(s.glod, 0.7); }, (0.9 + n * 0.42) * 1000);
          });
        }
        aktuell = -1;
        kedja = [];
      },
    });

    // ---------- Stjärnfall ----------
    let fall = { x: 0, y: 0, v: 0, t: -1 };
    let nastaFall = slump(25, 45);

    // ---------- Ritslinga ----------
    const dS = new Float32Array(ANTAL * 4), dL = new Float32Array(LINJER * 4), dLL = new Float32Array(LINJER);
    const stoppa = slinga((tid, dt) => {
      skift[0] += (malSkift[0] - skift[0]) * Math.min(1, dt * 2);
      skift[1] += (malSkift[1] - skift[1]) * Math.min(1, dt * 2);

      for (let i = linjer.length - 1; i >= 0; i--) {
        const L = linjer[i];
        L.l = Math.min(1, L.l + dt * 4);
        if (L.bort) { L.ljus -= dt * 0.25; if (L.ljus <= 0) linjer.splice(i, 1); }
      }
      dL.fill(0); dLL.fill(0);
      linjer.forEach((L, i) => {
        const a = stjarnor[L.a], b = stjarnor[L.b];
        dL.set([a.x, a.y, b.x, b.y], i * 4);
        // Strecken andas svagt, så att stjärnbilderna lever
        dLL[i] = L.l * L.ljus * (0.85 + 0.15 * Math.sin(tid * 0.5 + i * 0.7));
      });
      stjarnor.forEach((s, i) => {
        s.glod *= Math.exp(-dt * 1.2);
        dS.set([s.x, s.y, s.ljus, s.glod], i * 4);
      });
      dragL += ((finger.nere && aktuell >= 0 ? 1 : 0) - dragL) * Math.min(1, dt * 8);
      const fran = aktuell >= 0 ? stjarnor[aktuell] : null;

      nastaFall -= dt;
      if (nastaFall <= 0) {
        fall = { x: slump(0.15, 0.85), y: slump(H() * 0.55, H() - 0.15), v: slump(-2.7, -2.2) + (Math.random() < 0.5 ? 0 : 1.3), t: 0 };
        nastaFall = slump(35, 80);
      }
      if (fall.t >= 0) { fall.t += dt / 1.6; if (fall.t > 1) fall.t = -1; }

      anpassa(gl, duk, 0.75);
      // Himlen och landskapet
      gl.useProgram(prog);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform1f(u.u_tid, tid);
      gl.uniform2f(u.u_skift, skift[0], skift[1]);
      gl.uniform4f(u.u_fall, fall.x, fall.y, fall.v, fall.t);
      const synlig = mjuk(0, 3, tid);
      gl.uniform1f(u.u_synlig, synlig);
      ritaHelskarm(gl);
      // Stjärnorna och strecken läggs ovanpå som ljus
      gl.useProgram(ljusProg);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.uniform4fv(v.u_stj, dS);
      gl.uniform4fv(v.u_lin, dL);
      gl.uniform1fv(v.u_linL, dLL);
      if (fran) gl.uniform4f(v.u_drag, fran.x, fran.y, finger.x, finger.y);
      gl.uniform1f(v.u_dragL, fran ? dragL : 0);
      gl.uniform2f(v.u_skift, skift[0], skift[1]);
      gl.uniform1f(v.u_H, duk.clientHeight / duk.clientWidth);
      gl.uniform1f(v.u_tid, tid);
      gl.uniform1f(v.u_synlig, synlig);
      gl.uniform1i(v.u_typ, 1);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, LINJER + 1);
      gl.uniform1i(v.u_typ, 0);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, ANTAL);
      gl.disable(gl.BLEND);
      vind.uppdatera(dt, 0);
    });

    return stangning({ ljud: l, stoppa, gl, extra: [slutaLuta] });
  },
};
