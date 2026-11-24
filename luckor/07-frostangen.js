// Lucka 7: Frostängen
// En frostig äng i gryningsljus, sedd uppifrån. Hon går med fingertopparna, ett steg i
// taget. Varje steg knastrar i frosten och lämnar ett mörkgrönt fotspår, vänster och
// höger om vartannat i den riktning hon går. Spåren frostar långsamt igen.
// Ett minne av hennes önskan om en medveten promenad, fast i miniatyr.
// Sätter hon ner två fingrar på en gång blir det ett jämfotahopp: två spår sida vid sida
// och en mjuk duns i gräset. Stegen, hoppen och vinterbrisen är riktiga inspelningar.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { brusKalla } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { mjuk, slump, rumsLjud, slinga, fingrar, stangning, brusstot } from '../lib/scen.js';
import { skapaMatta, skapaLjudbank } from '../lib/inspelning.js';

// Stegen i inspelningen av frusen gräs: fem gångsteg och fem löpsteg, [start, längd]
const GANG = [[0.0, 0.55], [1.07, 0.55], [2.16, 0.5], [3.13, 0.5], [4.11, 0.55]];
const SPRING = [[5.70, 0.42], [6.60, 0.36], [7.43, 0.4], [8.32, 0.4], [9.18, 0.42]];
// Sekunder mellan stegen. Går det fortare än SPRING_IN springer hon, och hon går igen
// först när det blir långsammare än SPRING_UT, så att ljudet inte fladdrar mellan dem.
const SPRING_IN = 0.34, SPRING_UT = 0.42;

const FW = 128, FH = 256;     // frostens rutnät
const ATERFROST = 55;         // sekunder tills ett spår har frostat igen
const STEG_L = 0.11;          // fotens längd i skärmbredder

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform sampler2D u_frost;
uniform float u_tid;
uniform float u_synlig;
uniform vec4 u_hare;      // haren: x, y, riktning, skuttets fas
uniform vec2 u_hareA;     // harens synlighet, och hur mycket den sitter upp
${BRUS}

// En skogshare i grå höstpäls, sedd uppifrån. Kroppen är päronformad och bredast över
// bakdelen, huvudet smalt, och öronen ligger bakåt över skuldrorna med svarta spetsar
// när den skuttar. Sitter den står öronen upp och syns bara som korta ovaler. På marken
// ligger de långa baktassarna längs bakdelens sidor, i luften sträcks de ut bakåt.
// Returnerar färg och täckning.
float oval(vec2 q, vec2 c, vec2 r) { return smoothstep(1.0, 0.8, length((q - c) / r)); }
vec4 hare(vec2 p, vec4 h, float sitt) {
  float S = 0.05;
  vec2 d = p - h.xy;
  vec2 fw = vec2(cos(h.z), sin(h.z)), sd = vec2(-fw.y, fw.x);
  vec2 q = vec2(dot(d, sd), dot(d, fw)) / S;
  float ph = fract(h.w);
  float str = (ph < 0.5 ? sin(ph * 6.2832) : 0.0) * (1.0 - sitt);
  // Kroppen: päronform, längre och smalare i luften
  float ly = 0.58 + 0.16 * str;
  float yy = (q.y + 0.05) / ly;
  float bredd = mix(0.36, 0.22, smoothstep(-0.6, 0.8, yy)) * (1.0 - 0.12 * str);
  float kropp = smoothstep(1.0, 0.85, length(vec2(q.x / bredd, yy)));
  // Huvudet med en smal nos framåt
  float hy = 0.68 + 0.12 * str - 0.04 * sitt;
  float huvud = max(oval(q, vec2(0.0, hy), vec2(0.16, 0.2)), oval(q, vec2(0.0, hy + 0.15), vec2(0.09, 0.12)));
  // Öronen
  float ora = 0.0, spets = 0.0;
  for (int i = 0; i < 2; i++) {
    float sg = i == 0 ? -1.0 : 1.0;
    vec2 oc = mix(vec2(sg * 0.075, hy - 0.3), vec2(sg * 0.07, hy - 0.08), sitt);
    vec2 orad = mix(vec2(0.055, 0.28), vec2(0.06, 0.1), sitt);
    vec2 oq = q - oc;
    oq.x -= sg * (oq.y + orad.y) * 0.15 * (1.0 - sitt);
    vec2 on = oq / orad;
    float o = smoothstep(1.0, 0.75, length(on));
    ora = max(ora, o);
    spets = max(spets, o * mix(smoothstep(-0.45, -0.7, on.y), smoothstep(0.4, 0.8, length(on)), sitt));
  }
  // Baktassarna: längs bakdelen på marken, utsträckta bakåt i luften
  float ben = 0.0;
  for (int i = 0; i < 2; i++) {
    float sg = i == 0 ? -1.0 : 1.0;
    vec2 bc = mix(vec2(sg * 0.31, -0.32), vec2(sg * 0.13, -0.85), str);
    vec2 br = mix(vec2(0.07, 0.22), vec2(0.06, 0.26), str);
    ben = max(ben, oval(q, bc, br));
  }
  float svans = oval(q, vec2(0.0, -0.62 - 0.12 * str), vec2(0.08, 0.07));
  float a = max(max(kropp, huvud), max(ora, max(ben, svans)));
  if (a <= 0.0) return vec4(0.0);
  // Pälsen: gråbrun och sprängd på ryggen, ljusare mot sidorna
  float pals = 0.82 + 0.3 * fbm(q * 9.0) + 0.08 * (hash(floor(q * 40.0)) - 0.5);
  vec3 col = mix(vec3(0.38, 0.32, 0.25), vec3(0.58, 0.53, 0.45), smoothstep(0.05, 0.3, abs(q.x)));
  col *= 1.0 - 0.15 * exp(-q.x * q.x * 60.0);
  col = mix(col, vec3(0.5, 0.42, 0.32), huvud * (1.0 - kropp));
  col = mix(col, vec3(0.55, 0.49, 0.41), ben * (1.0 - kropp));
  col = mix(col, vec3(0.5, 0.44, 0.37), ora);
  col = mix(col, vec3(0.07, 0.06, 0.06), spets);
  col = mix(col, vec3(0.86, 0.86, 0.83), svans * (1.0 - kropp * 0.7));
  col *= pals;
  // Ögonen sitter högt på huvudets sidor
  for (int i = 0; i < 2; i++) {
    float sg = i == 0 ? -1.0 : 1.0;
    col = mix(col, vec3(0.05), smoothstep(0.04, 0.015, length(q - vec2(sg * 0.13, hy + 0.04))));
  }
  return vec4(col, a);
}

// Grässtrån: brus som sträcks ut längs ett mjukt slingrande riktningsfält,
// så att stråna ligger åt olika håll utan några skarvar
float stra(vec2 p) {
  float v = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float a = (fbm3(p * 2.0 + fi * 5.0) - 0.5) * 2.2 + fi * 1.05;
    vec2 r = vec2(cos(a), sin(a));
    vec2 q = p * (30.0 + fi * 9.0);
    vec2 s = vec2(dot(q, r), dot(q, vec2(-r.y, r.x)));
    float b = brus(vec2(s.x * 0.8, s.y * 6.5));
    v += pow(b, 3.0) * (0.75 - fi * 0.18);
  }
  return clamp(v * 1.7, 0.0, 1.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 tc = vec2(uv.x, 1.0 - uv.y);
  float asp = u_res.y / u_res.x;
  vec2 p = vec2(uv.x, uv.y * asp);

  float f = texture(u_frost, tc).r;
  // Frostkanten blir lite fransig, som när rimfrosten sitter kvar på enstaka strån
  float kant = fbm(p * 60.0);
  float frost = smoothstep(0.25, 0.75, f + (kant - 0.5) * 0.35);

  // Gräset: mörkt grönt med inslag av höstbrunt och vissna strån
  float s = stra(p * 2.2);
  float flack = fbm(p * 2.5);
  vec3 gras = mix(vec3(0.14, 0.22, 0.09), vec3(0.34, 0.45, 0.17), s);
  gras = mix(gras, vec3(0.40, 0.34, 0.18), smoothstep(0.55, 0.8, flack) * 0.55);
  gras *= 0.75 + 0.35 * s;

  // Smält frost lämnar gräset vått, mörkgrönt och lite glansigt
  vec3 vatt = gras * vec3(0.72, 0.85, 0.72) + vec3(0.02, 0.05, 0.03) + s * s * 0.08;

  // Rimfrosten: vit på strånas toppar, glittrande kristaller här och där
  vec3 rim = mix(gras * 0.9 + vec3(0.12, 0.14, 0.16), vec3(0.97, 0.97, 1.0), smoothstep(0.12, 0.65, s));
  rim = mix(rim, vec3(0.82, 0.86, 0.92), 0.35);
  vec2 kc = floor(gl_FragCoord.xy * 0.55);
  float kristall = step(0.992, hash(kc)) * (0.4 + 0.6 * sin(u_tid * 1.4 + hash(kc + 3.0) * 30.0));
  rim += vec3(1.0, 0.96, 0.92) * max(kristall, 0.0) * 0.6;

  vec3 c = mix(vatt, rim, frost * (0.8 + 0.2 * s));

  // Haren och dess skugga, som faller bort från gryningsljuset
  if (u_hareA.x > 0.0) {
    vec4 skugga = hare(p + vec2(0.005, 0.004), u_hare, u_hareA.y);
    c *= 1.0 - 0.3 * skugga.a * u_hareA.x;
    vec4 hr = hare(p, u_hare, u_hareA.y);
    c = mix(c, hr.rgb, hr.a * u_hareA.x);
  }

  // Gryningsljus: varmt rosa-gult från ena hörnet, svalare blått i skuggan
  vec3 sol = vec3(1.0, 0.84, 0.74);
  float ljus = 0.72 + 0.4 * smoothstep(1.5, 0.0, length(p - vec2(1.1, asp * 1.05)));
  c *= mix(vec3(0.82, 0.87, 1.0), sol, smoothstep(0.75, 1.05, ljus)) * ljus;
  // En tunn dimma som driver långsamt
  float dimma = fbm(p * 1.4 + vec2(u_tid * 0.015, u_tid * 0.006));
  c = mix(c, vec3(0.85, 0.80, 0.82), smoothstep(0.45, 0.85, dimma) * 0.22);

  c *= 1.0 - 0.3 * pow(length(uv - 0.5) * 1.3, 2.5);
  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, u_tid), 1.0);
}`;

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, ['u_res', 'u_frost', 'u_tid', 'u_synlig', 'u_hare', 'u_hareA']);

    // ---------- Frosten ----------
    const frost = new Float32Array(FW * FH).fill(1);
    const takt = new Float32Array(FW * FH);
    for (let i = 0; i < takt.length; i++) takt[i] = slump(0.7, 1.3);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, FW, FH, 0, gl.RED, gl.FLOAT, frost);
    gl.uniform1i(u.u_frost, 0);

    // Ett fotspår: en sula och en häl, vriden i gångriktningen. Allt i skärmbredder.
    function fotspar(x, y, rx, ry, hoger) {
      const asp = duk.clientHeight / duk.clientWidth;
      const nx = -ry, ny = rx;
      const sida = hoger ? 1 : -1;
      const cx = x + nx * STEG_L * 0.28 * sida, cy = y + ny * STEG_L * 0.28 * sida;
      const R = STEG_L * 0.75;
      const x0 = Math.max(0, Math.floor((cx - R) * FW)), x1 = Math.min(FW - 1, Math.ceil((cx + R) * FW));
      const y0 = Math.max(0, Math.floor(((cy - R) / asp) * FH)), y1 = Math.min(FH - 1, Math.ceil(((cy + R) / asp) * FH));
      for (let gy = y0; gy <= y1; gy++) {
        for (let gx = x0; gx <= x1; gx++) {
          const px = (gx + 0.5) / FW - cx, py = ((gy + 0.5) / FH) * asp - cy;
          // Längs och tvärs foten
          const l = (px * rx + py * ry) / STEG_L, t = (px * nx + py * ny) / STEG_L;
          // Sulan framtill är bredare, hälen baktill smalare, med ett smalt valv emellan.
          // Sulan och valvet är vända så att skon ser ut att sitta på rätt fot.
          const sula = Math.hypot((l - 0.18) / 0.32, (t + 0.04 * sida) / 0.19);
          const hal = Math.hypot((l + 0.3) / 0.2, t / 0.15);
          const valv = Math.hypot(l / 0.3, (t - 0.06 * sida) / 0.1);
          const d = Math.min(sula, hal, valv);
          if (d < 1.15) {
            const i = gy * FW + gx;
            const djup = 1 - mjuk(0.75, 1.15, d);
            frost[i] = Math.min(frost[i], 1 - djup * slump(0.85, 1));
          }
        }
      }
    }

    // Ett litet avtryck i frosten: en ellips längs riktningen r. Allt i skärmbredder.
    function trampa(cx, cy, rx, ry, langd, bredd, styrka) {
      const asp = duk.clientHeight / duk.clientWidth;
      const nx = -ry, ny = rx, R = Math.max(langd, bredd) * 1.3;
      const x0 = Math.max(0, Math.floor((cx - R) * FW)), x1 = Math.min(FW - 1, Math.ceil((cx + R) * FW));
      const y0 = Math.max(0, Math.floor(((cy - R) / asp) * FH)), y1 = Math.min(FH - 1, Math.ceil(((cy + R) / asp) * FH));
      for (let gy = y0; gy <= y1; gy++) {
        for (let gx = x0; gx <= x1; gx++) {
          const px = (gx + 0.5) / FW - cx, py = ((gy + 0.5) / FH) * asp - cy;
          const d = Math.hypot((px * rx + py * ry) / langd, (px * nx + py * ny) / bredd);
          if (d < 1.2) {
            const i = gy * FW + gx;
            frost[i] = Math.min(frost[i], 1 - (1 - mjuk(0.7, 1.2, d)) * styrka * slump(0.85, 1));
          }
        }
      }
    }

    // ---------- Haren ----------
    // Står hon stilla en stund, ungefär tolv sekunder, skuttar en hare över ängen. Den sätter sig en stund
    // på vägen med öronen uppe, och varje skutt lämnar harspår i frosten: två små
    // framtassar efter varandra, och de stora baktassarna framför, sida vid sida.
    const HOPP_L = 0.13, HOPP_T = 0.5;
    let hareObj = null, stilla = 0, sedanHare = 45;
    function nyHare() {
      const asp = duk.clientHeight / duk.clientWidth;
      const vanster = Math.random() < 0.5;
      const ya = slump(0.3, asp - 0.3), yb = Math.min(asp - 0.25, Math.max(0.25, ya + slump(-0.35, 0.35)));
      const A = [vanster ? -0.12 : 1.12, ya], B = [vanster ? 1.12 : -0.12, yb];
      const dist = Math.hypot(B[0] - A[0], B[1] - A[1]);
      const hopp = Math.ceil(dist / HOPP_L);
      hareObj = { A, B, rx: (B[0] - A[0]) / dist, ry: (B[1] - A[1]) / dist, hopp, n: 0, fas: 0.5, sitt: 0, sittKvar: 0, sittVid: Math.floor(hopp * slump(0.35, 0.6)), satt: false };
    }
    function hareSpar(x, y, rx, ry) {
      const nx = -ry, ny = rx;
      trampa(x + rx * 0.03 + nx * 0.013, y + ry * 0.03 + ny * 0.013, rx, ry, 0.017, 0.009, 0.75);
      trampa(x + rx * 0.03 - nx * 0.013, y + ry * 0.03 - ny * 0.013, rx, ry, 0.017, 0.009, 0.75);
      trampa(x - rx * 0.012, y - ry * 0.012, rx, ry, 0.009, 0.008, 0.65);
      trampa(x - rx * 0.034 + nx * 0.003, y - ry * 0.034 + ny * 0.003, rx, ry, 0.009, 0.008, 0.65);
    }
    function harLage(H) {
      const ph = H.fas % 1;
      const f = H.n + (ph < 0.5 ? mjuk(0, 0.5, ph) : 1);
      return [H.A[0] + H.rx * f * HOPP_L, H.A[1] + H.ry * f * HOPP_L];
    }
    function harenRor(dt) {
      stilla += dt;
      sedanHare += dt;
      if (!hareObj && stilla > 12 && sedanHare > 45) nyHare();
      const H = hareObj;
      if (!H) return;
      if (H.sittKvar > 0) {
        H.sittKvar -= dt;
        H.sitt = Math.min(1, H.sitt + dt * 3);
      } else {
        H.sitt = Math.max(0, H.sitt - dt * 4);
        const fore = H.fas;
        H.fas += dt / HOPP_T;
        // Landar den lämnar den spår
        if (fore < 0.5 && H.fas >= 0.5) {
          const [x, y] = harLage(H);
          hareSpar(x, y, H.rx, H.ry);
        }
        if (H.fas >= 1) {
          H.fas -= 1;
          H.n++;
          if (H.n === H.sittVid && !H.satt) { H.satt = true; H.sittKvar = slump(1.8, 3); }
        }
      }
      if (H.n > H.hopp + 1) { hareObj = null; sedanHare = 0; }
    }

    // ---------- Ljud ----------
    const l = rumsLjud(1.25, 1.5);
    const { ctx, ut } = l;
    // Vinterbrisen: en mjuk vind vid en skogskant, där snö faller på bruna löv
    const vindMatta = skapaMatta(ctx, ut, 'ljud/frost-vind.mp3', { niva: 0.012, bit: [10, 20], over: 4, hp: 120, tonhojd: 0.02, jamna: 0.4 });
    l.kallor.push(vindMatta);
    vindMatta.klar.catch(() => {
      const vind = brusKalla('rosa');
      const vindF = ctx.createBiquadFilter();
      vindF.type = 'lowpass'; vindF.frequency.value = 320;
      const vindG = ctx.createGain(); vindG.gain.value = 0.03;
      const vindLfo = ctx.createOscillator(); vindLfo.frequency.value = 0.05;
      const vindDjup = ctx.createGain(); vindDjup.gain.value = 0.015;
      vindLfo.connect(vindDjup).connect(vindG.gain);
      vind.connect(vindF).connect(vindG).connect(ut);
      vindLfo.start();
      l.kallor.push(vind, vindLfo);
    });
    // Stegen i frosten, gående och springande, och landningen efter ett hopp
    const gangBank = skapaLjudbank(ctx, ut, 'ljud/frost-steg.mp3', GANG, { maxTopp: 0.12, hp: 80 });
    const springBank = skapaLjudbank(ctx, ut, 'ljud/frost-steg.mp3', SPRING, { maxTopp: 0.12, hp: 80 });
    const landBank = skapaLjudbank(ctx, ut, 'ljud/frost-landning.mp3', [[0.12, 0.85]], { maxTopp: 0.14, hp: 50 });
    l.kallor.push(gangBank, springBank, landBank);

    // Det framräknade knastret används bara om inspelningarna inte går att ladda.
    // Knastret i frosten: en mängd små klick på bråkdelen av en sekund, och en mjuk dov ton
    function knaster() {
      let t = ctx.currentTime;
      const n = Math.floor(slump(35, 70));
      const ljus = slump(0.85, 1.2);
      for (let i = 0; i < n; i++) {
        brusstot(ctx, ut, {
          frekvens: slump(1800, 6500) * ljus, q: slump(0.7, 2.2),
          styrka: slump(0.04, 0.16) * (1 - i / n * 0.6), langd: slump(0.0005, 0.0018), nar: t,
        });
        t += -Math.log(1 - Math.random()) * 0.0035;
      }
      const s = brusKalla('rosa');
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = slump(700, 1000); f.Q.value = 0.7;
      const g = ctx.createGain();
      const t0 = ctx.currentTime;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.06, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      s.connect(f).connect(g).connect(ut);
      s.stop(t0 + 0.25);
      brusstot(ctx, ut, { frekvens: 160, q: 1, styrka: 0.25, langd: 0.01, nar: t0 });
    }

    // ---------- Stegen ----------
    let forra = null;
    let hoger = false;
    const tillVarld = (x, y) => [x / duk.clientWidth, y / duk.clientWidth];
    // Ett steg väntar ett ögonblick, så att ett andra finger som landar nästan samtidigt
    // kan göra det till ett jämfotahopp
    let vantande = null;
    function riktning(wx, wy) {
      let rx = 0, ry = -1;
      if (forra) {
        const dx = wx - forra.x, dy = wy - forra.y, d = Math.hypot(dx, dy);
        if (d > 0.01) { rx = dx / d; ry = dy / d; }
        else { rx = forra.rx; ry = forra.ry; }
        // Mjuk sväng, så att gången blir jämn även om fingrarna hamnar lite snett
        const bx = forra.rx * 0.35 + rx * 0.65, by = forra.ry * 0.35 + ry * 0.65;
        const bl = Math.hypot(bx, by) || 1;
        rx = bx / bl; ry = by / bl;
      }
      return [rx, ry];
    }
    // Stegtakten: ett mjukt medel av tiden mellan de senaste stegen
    let sistaSteg = 0, stegTakt = 0, springer = false;
    function ettSteg(wx, wy) {
      const [rx, ry] = riktning(wx, wy);
      hoger = !hoger;
      fotspar(wx, wy, rx, ry, hoger);
      const nu = performance.now() / 1000, mellan = nu - sistaSteg;
      sistaSteg = nu;
      stegTakt = mellan > 1.5 ? 0 : stegTakt ? stegTakt * 0.5 + mellan * 0.5 : mellan;
      springer = stegTakt > 0 && stegTakt < (springer ? SPRING_UT : SPRING_IN);
      const bank = springer ? springBank : gangBank;
      if (!bank.spela({ styrka: slump(0.7, 1), tonhojd: 0.07 })) knaster();
      forra = { x: wx, y: wy, rx, ry };
    }
    function hopp(ax, ay, bx, by) {
      // Fötterna landar mitt emellan fingrarna, sida vid sida längs linjen mellan dem.
      // Framåt är vinkelrätt mot den linjen, åt det håll som ligger närmast hur hon gick,
      // eller uppåt på skärmen om hon inte har gått än.
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const tx = bx - ax, ty = by - ay, tl = Math.hypot(tx, ty) || 1;
      let rx = ty / tl, ry = -tx / tl;
      const fx = forra ? forra.rx : 0, fy = forra ? forra.ry : -1;
      if (rx * fx + ry * fy < 0) { rx = -rx; ry = -ry; }
      fotspar(mx, my, rx, ry, true);
      fotspar(mx, my, rx, ry, false);
      if (!landBank.spela({ styrka: 1, tonhojd: 0.05 })) { knaster(); knaster(); }
      forra = { x: mx, y: my, rx, ry };
    }
    fingrar(duk, {
      ner: (x, y) => {
        const [wx, wy] = tillVarld(x, y);
        stilla = 0;
        if (vantande) {
          clearTimeout(vantande.timer);
          const v = vantande; vantande = null;
          hopp(v.x, v.y, wx, wy);
          return;
        }
        vantande = { x: wx, y: wy, timer: setTimeout(() => { const v = vantande; vantande = null; if (v) ettSteg(v.x, v.y); }, 90) };
      },
    });

    // ---------- Ritslinga ----------
    const stoppa = slinga((tid, dt) => {
      // Frosten växer långsamt tillbaka, lite olika fort på olika ställen
      const v = dt / ATERFROST;
      for (let i = 0; i < frost.length; i++) if (frost[i] < 1) frost[i] = Math.min(1, frost[i] + v * takt[i]);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, FW, FH, gl.RED, gl.FLOAT, frost);

      anpassa(gl, duk, 0.75);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_synlig, mjuk(0, 3, tid));
      harenRor(dt);
      if (hareObj) {
        const [hx, hy] = harLage(hareObj);
        const asp = duk.clientHeight / duk.clientWidth;
        gl.uniform4f(u.u_hare, hx, asp - hy, Math.atan2(-hareObj.ry, hareObj.rx), hareObj.sittKvar > 0 ? 0.75 : hareObj.fas);
        gl.uniform2f(u.u_hareA, 1, hareObj.sitt);
      } else gl.uniform2f(u.u_hareA, 0, 0);
      ritaHelskarm(gl);
    });

    return stangning({ ljud: l, stoppa, gl });
  },
};
