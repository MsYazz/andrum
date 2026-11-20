// Lucka 23: Ljusstöpningen
// Dan före dopparedan, i köket på kvällen. På vedspisen står en emaljerad kastrull med
// smält stearin, och ovanför hänger en bomullsveke från en pinne. Så fort hon rör vid
// skärmen tar hon tag i pinnen, och sedan styr hon hela doppet själv, även i sidled.
// Varje dopp lägger ett tunt, varmt lager som rinner nedåt medan det svalnar och
// stelnar längre ner. Ljuset blir därför smalt upptill, avsmalnar långsamt och får
// knölar och en droppspets, som riktiga hemstöpta ljus. Nydoppat är stearinet blankt
// och gulaktigt, och det svalnar till matt vitt. Doppar hon medan det fortfarande är
// varmt smälter det nya lagret bort, så det lönar sig att vänta lite mellan doppen.
// Det kan aldrig bli fel, bara långsammare.
//
// Bredvid kastrullen ligger en sax. När hon tycker att ljuset är klart klipper hon av
// veken med den. Saxen lyser svagt när ljuset har fått en lagom tjocklek.
//
// När ljuset är färdigt tänds det och ställs i fönstret, och en ny veke hänger där.
// Ljusen hon har gjort står kvar i fönstret och lyser upp köket nästa gång också.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { brusKalla, rum, klocka } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { mjuk, slump, klamp, rumsLjud, slinga, fingrar, stangning, bubbla, brusstot, klang } from '../lib/scen.js';

const N = 96;                 // punkter längs ljuset
const LANGD = 0.42;           // ljusets längd, i skärmbredder
const VEKE = 0.0016;          // vekens tjocklek
const LAGER = 0.0017;         // ett svalt dopp
const KLAR = 0.025;           // ljusets färdiga radie, i snitt
const KYL = 2.6;              // sekunder för stearinet att svalna
const YV = 0.6;               // stearinets yta
const SIMS = 1.02;            // fönsterbänken
const FONSTER_X = [0.29, 0.71, 0.21, 0.79, 0.13, 0.87, 0.42, 0.58];
const NYCKEL = 'andrum.stopta';
const FORM_NYCKEL = 'andrum.stopta.former';
const FN = 48;                // punkter i en sparad form
const SKALA = 0.4;            // ljusen i fönstret är mindre än det som doppas
const V0 = 0.1;               // den tunna halsen närmast pinnen klipps bort
const SAX = [0.835, 0.352];  // saxens led, där den ligger på spisen
const MAXR = 0.05;            // tjockare än så växer ljuset knappt
const MINDOPP = 8;            // så många dopp innan ljuset går att klippa loss

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform float u_tid;
uniform float u_synlig;
uniform sampler2D u_prof;   // r: radie åt vänster, g: radie åt höger, b: värme
uniform vec4 u_ljus;        // x, överkant, längd, vinkel
uniform vec3 u_spets;       // stelnad spets, droppens radie, droppens värme
uniform vec2 u_snitt;       // där ljuset går genom ytan: x, radie (0 om det inte är nere)
uniform float u_alfa;       // det hängande ljusets synlighet
uniform vec4 u_ring[4];     // x, ålder, styrka
uniform vec3 u_dr[6];       // fallande droppar: x, y, radie
uniform vec4 u_fonster[8];  // ljusen i fönstret: x, höjd, tid sedan tändning, synlig
uniform sampler2D u_former; // varje fönsterljus form: r vänster, g höger, en rad per ljus
uniform float u_varme;      // hur många ljus som brinner i fönstret
uniform float u_rors;       // hur mycket stearinet rörs om
uniform vec2 u_sax;         // hur öppen saxen är, och hur mycket den lyser
uniform vec3 u_saxL;        // saxens led och riktning: x, y, vinkel
uniform vec2 u_klipp;       // där veken klipptes, räknat från pinnen, och hur långt ljuset har fallit
${BRUS}

const float YV = ${YV.toFixed(3)};
const float SIMS = ${SIMS.toFixed(3)};

// En levande låga: rund nertill, spetsig upptill, med blå bas och vit kärna
vec4 laga(vec2 p, vec2 bas, float t, float fro, float styrka) {
  float fl = brus(vec2(t * 3.1 + fro * 7.3, fro));
  float fl2 = brus(vec2(t * 7.7 + fro * 3.1, fro + 5.0));
  vec2 q = p - bas;
  float h = 0.02 * styrka * (0.88 + 0.22 * fl);
  float w = 0.0058 * styrka;
  q.x -= (fl2 - 0.5) * 0.0035 * clamp(q.y / max(h, 1e-4), 0.0, 1.0);
  float yy = q.y - h * 0.32;
  float sy = yy > 0.0 ? yy / (h * 0.68) : yy / (h * 0.32);
  float sx = q.x / (w * (1.0 - 0.78 * clamp(sy, 0.0, 1.0)));
  float d = length(vec2(sx, sy));
  float kropp = smoothstep(1.0, 0.72, d);
  float karna = smoothstep(0.65, 0.1, length(vec2(sx * 1.4, sy + 0.3)));
  vec3 f = mix(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.82, 0.45), smoothstep(0.95, 0.35, d));
  f = mix(f, vec3(1.0, 0.97, 0.88), karna);
  f = mix(f, vec3(0.3, 0.42, 1.0), smoothstep(-0.3, -0.95, sy) * 0.55);
  return vec4(f * 1.4, kropp * styrka);
}

// Ljuset i rummet: spisens glöd nerifrån och ljusen i fönstret
vec3 rumsljus(vec2 p, float t, float H) {
  float flim = 0.85 + 0.15 * brus(vec2(t * 2.3, 1.7));
  vec3 lys = vec3(0.2, 0.18, 0.2) + vec3(1.0, 0.5, 0.24) * exp(-max(p.y - 0.25, 0.0) * 2.6) * 0.75 * flim;
  // En varm lampa ovanför arbetsbänken, utanför bild
  vec2 dl = (p - vec2(0.5, H + 0.15)) * vec2(1.0, 0.55);
  lys += vec3(1.0, 0.88, 0.72) * 0.75 / (1.0 + dot(dl, dl) * 2.2);
  for (int i = 0; i < 8; i++) {
    vec4 L = u_fonster[i];
    if (L.w <= 0.0 || L.z <= 0.0) continue;
    vec2 d = p - vec2(L.x, SIMS + 0.06 + L.y);
    lys += vec3(1.0, 0.62, 0.3) * L.w * min(1.0, L.z) * 0.004 / (0.012 + dot(d, d));
  }
  return lys;
}

void main() {
  float s = u_res.x;
  vec2 p = gl_FragCoord.xy / s;
  float H = u_res.y / s;
  float t = u_tid;
  float px = 1.0 / s;
  vec3 lys = rumsljus(p, t, H);

  // ---- Väggen: mörk panel av breda bräder ----
  float bx = p.x * 7.0;
  float bradd = fract(bx);
  vec3 c = vec3(0.17, 0.1, 0.062) * (0.75 + 0.4 * fbm3(vec2(floor(bx) * 3.1, p.y * 5.0)));
  c *= 0.85 + 0.25 * brus(vec2(bx * 0.6, p.y * 55.0 + floor(bx) * 13.0));
  c *= 0.55 + 0.45 * min(smoothstep(0.0, 0.05, bradd), smoothstep(1.0, 0.95, bradd));
  c *= lys;

  // ---- Fönstret med vinternatten ----
  vec2 fa = vec2(0.07, SIMS + 0.035), fb = vec2(0.93, H - 0.1);
  vec2 fm = (fa + fb) * 0.5;
  bool iRam = p.x > fa.x - 0.03 && p.x < fb.x + 0.03 && p.y > fa.y - 0.03 && p.y < fb.y + 0.03;
  if (iRam) {
    vec3 ram = vec3(0.62, 0.58, 0.52) * (lys * 0.9 + 0.08);
    c = ram;
    bool glas = p.x > fa.x && p.x < fb.x && p.y > fa.y && p.y < fb.y
             && abs(p.x - mix(fa.x, fb.x, 1.0 / 3.0)) > 0.008 && abs(p.x - mix(fa.x, fb.x, 2.0 / 3.0)) > 0.008
             && abs(p.y - fm.y) > 0.008;
    if (glas) {
      float g = (p.y - fa.y) / (fb.y - fa.y);
      vec3 n = mix(vec3(0.06, 0.08, 0.17), vec3(0.012, 0.018, 0.055), g);
      float mark = fa.y + 0.07 + 0.018 * sin(p.x * 7.0 + 1.0);
      float gran = 0.0;
      for (int k = 0; k < 7; k++) {
        float fk = float(k);
        float gx = 0.1 + fk * 0.135 + 0.03 * sin(fk * 5.3);
        float gh = 0.16 + 0.1 * hash(vec2(fk, 2.0));
        float hy = (p.y - mark) / gh;
        float bredd = (1.0 - hy) * 0.045 * (0.85 + 0.15 * sin(hy * 40.0));
        if (hy > 0.0 && hy < 1.0 && abs(p.x - gx) < bredd) gran = 1.0;
      }
      n = mix(n, vec3(0.012, 0.02, 0.028), gran);
      if (p.y < mark) n = vec3(0.16, 0.18, 0.26) * (0.85 + 0.15 * brus(p * 40.0));
      for (int k = 0; k < 2; k++) {
        float fk = float(k);
        float sk = 20.0 + fk * 16.0;
        vec2 sp = p * sk + vec2(sin(t * 0.3 + fk) * 0.5, t * (0.5 + 0.3 * fk));
        vec2 id = floor(sp);
        vec2 f = fract(sp) - 0.5 - (hash2(id) - 0.5) * 0.6;
        float fl = smoothstep(0.09 - 0.025 * fk, 0.0, length(f)) * step(0.55, hash(id + 3.0));
        n += vec3(0.55, 0.6, 0.72) * fl * (1.0 - 0.45 * fk);
      }
      // Rummets värme speglas svagt i rutan
      n += lys * 0.025;
      c = n;
    }
  }

  // ---- Fönsterbänken ----
  if (p.y < SIMS + 0.035 && p.y > SIMS - 0.03 && p.x > 0.025 && p.x < 0.975) {
    c = p.y > SIMS ? vec3(0.66, 0.6, 0.52) * (lys * 0.85 + 0.1) : vec3(0.42, 0.37, 0.31) * (lys * 0.7 + 0.05);
  }

  // ---- Ljusen hon har gjort, i fönstret ----
  for (int i = 0; i < 8; i++) {
    vec4 L = u_fonster[i];
    if (L.w <= 0.0) continue;
    float bas = SIMS + 0.035;
    float fro = float(i);
    // Ljuset, med samma ojämna form som när det stöptes: halsen upptill, där lågan
    // sitter, och den tjockare, droppiga änden nere i ljusstaken
    float topp = bas + 0.02 + L.y;
    float lx = p.x - L.x;
    if (p.y > bas + 0.015 && p.y < topp + 0.003 && abs(lx) < 0.03) {
      float v = clamp((topp - p.y) / L.y, 0.0, 1.0);
      vec2 fu = vec2(v * (1.0 - 1.0 / ${FN}.0) + 0.5 / ${FN}.0, (fro + 0.5) / 8.0);
      vec4 fo = texture(u_former, fu);
      float sida = smoothstep(-0.001, 0.001, lx);
      float rx = mix(fo.r, fo.g, sida) * ${SKALA.toFixed(2)};
      // Toppen är avrundad där lågan har smält en liten grop
      rx *= mix(0.55, 1.0, sqrt(clamp((topp - p.y) / 0.005, 0.0, 1.0)));
      float kant = smoothstep(rx, rx - px * 1.5, abs(lx));
      // Knölarna fångar ljuset
      vec4 fa2 = texture(u_former, fu - vec2(1.5 / ${FN}.0, 0.0));
      vec4 fb2 = texture(u_former, fu + vec2(1.5 / ${FN}.0, 0.0));
      float lut = (mix(fb2.r, fb2.g, sida) - mix(fa2.r, fa2.g, sida)) * ${SKALA.toFixed(2)} / (3.0 / ${FN}.0 * L.y);
      float nx = clamp(lx / max(rx, 1e-4), -1.0, 1.0);
      float dif = 0.35 + 0.5 * (0.55 - 0.45 * nx) - clamp(lut, -0.6, 0.6) * 0.25;
      vec3 lc = vec3(0.97, 0.95, 0.9) * dif * (lys * 0.45 + 0.4);
      float tand = clamp(L.z, 0.0, 1.0);
      lc += vec3(1.0, 0.72, 0.4) * smoothstep(topp - 0.04, topp, p.y) * 0.45 * tand;
      c = mix(c, lc, kant * L.w);
    }
    // En liten ljusstake av mässing, framför ljusets nedersta del
    vec2 dk = p - vec2(L.x, bas + 0.01);
    float stake = step(abs(dk.y), 0.01) * step(abs(dk.x), 0.02 - dk.y * 0.6);
    vec3 massing = vec3(0.6, 0.43, 0.18) * (lys * 0.7 + 0.25) * (0.75 + 0.5 * smoothstep(0.02, -0.01, dk.x));
    c = mix(c, massing, stake * L.w);
    // Veken
    if (abs(lx) < 0.0009 && p.y > topp && p.y < topp + 0.006) c = mix(c, vec3(0.08, 0.06, 0.05), L.w);
    // Lågan och dess sken
    if (L.z > 0.0) {
      float tand = smoothstep(0.0, 1.0, L.z);
      vec4 fl = laga(p, vec2(L.x, topp + 0.003), t, fro, tand);
      c = mix(c, fl.rgb, fl.a * L.w);
      vec2 d = p - vec2(L.x, topp + 0.012);
      c += vec3(1.0, 0.6, 0.26) * (exp(-dot(d, d) / 0.0009) * 0.3 + exp(-dot(d, d) / 0.02) * 0.06) * tand * L.w;
    }
  }

  // ---- Vedspisen ----
  if (p.y < 0.315) {
    vec3 j = vec3(0.045, 0.045, 0.05) * (0.7 + 0.3 * fbm3(p * 30.0));
    if (p.y > 0.29) j = vec3(0.09, 0.09, 0.1) + vec3(0.3, 0.17, 0.08) * smoothstep(0.29, 0.315, p.y) * 0.4;
    vec2 d = abs(p - vec2(0.5, 0.15)) - vec2(0.17, 0.075);
    float lucka = max(d.x, d.y);
    float eld = 0.55 + 0.45 * brus(vec2(p.x * 10.0, t * 2.6));
    if (lucka < 0.0) {
      j = vec3(0.06, 0.055, 0.05);
      float springa = smoothstep(0.35, 0.5, fract(p.y * 34.0)) * smoothstep(0.65, 0.5, fract(p.y * 34.0));
      springa *= step(abs(p.x - 0.5), 0.125) * step(abs(p.y - 0.15), 0.045);
      j += vec3(1.0, 0.42, 0.1) * springa * eld * 1.3;
    } else if (lucka < 0.008) {
      j = vec3(0.16, 0.14, 0.12);
    }
    // Värmen från luckan lyser på spisens front
    j += vec3(0.5, 0.2, 0.06) * exp(-length(p - vec2(0.5, 0.15)) * 9.0) * 0.25 * eld;
    c = j;
  }

  // ---- Kastrullen: baksidan och insidan ----
  vec2 kc = vec2(0.5, 0.645);
  vec2 kr = vec2(0.26, 0.065);
  float ke = length((p - kc) / kr);
  vec2 vr = vec2(0.236, 0.058);
  float ve = length((p - vec2(0.5, YV)) / vr);
  float ljusX = u_ljus.x;
  float ljusBotten = u_ljus.y - u_ljus.z;
  if (ke < 1.0) {
    // Insidan av vit emalj, med stearin som stelnat längs kanten
    vec3 in_ = vec3(0.62, 0.62, 0.6) * (0.45 + 0.35 * smoothstep(YV, kc.y + kr.y, p.y)) * (lys * 0.8 + 0.1);
    c = in_;
    if (ve < 1.0) {
      // Det smälta stearinet: varmt elfenben, blankt, med ringar där något doppats
      vec2 q = (p - vec2(0.5, YV)) / vr;
      float hojd = 0.0, dhx = 0.0;
      for (int i = 0; i < 4; i++) {
        vec4 R = u_ring[i];
        if (R.z <= 0.0) continue;
        vec2 dq = vec2(p.x - R.x, (p.y - YV) * vr.x / vr.y);
        float dist = length(dq);
        float fas = dist * 140.0 - R.y * 9.0;
        float amp = R.z * exp(-R.y * 1.6) * smoothstep(R.y * 0.08 + 0.02, 0.0, abs(dist - R.y * 0.06));
        hojd += sin(fas) * amp;
        dhx += cos(fas) * amp * (dq.y / max(dist, 1e-4));
      }
      // Omrörningen ger långsamma virvlar i ytan
      float virv = fbm3(vec2(q.x * 2.0 + t * 0.05, q.y * 2.0 - t * 0.04) + u_rors * vec2(sin(t), cos(t)) * 0.3);
      vec3 vax = vec3(0.96, 0.91, 0.78) * (0.66 + 0.3 * virv) * (lys * 0.4 + 0.5);
      // Blänk av fönstret och rummets ljus längs bakkanten
      float blank = smoothstep(-0.2, 0.9, q.y) * (0.18 + 0.12 * u_varme);
      vax += vec3(1.0, 0.85, 0.65) * (blank + dhx * 0.35 + hojd * 0.15) * 0.6;
      vax *= 1.0 - 0.25 * smoothstep(0.8, 1.0, ve);
      // Menisken runt ljuset där det står nere i stearinet
      if (u_snitt.y > 0.0) {
        vec2 dm = vec2(p.x - u_snitt.x, (p.y - YV) * vr.x / vr.y);
        vax += vec3(1.0, 0.9, 0.7) * smoothstep(u_snitt.y + 0.01, u_snitt.y, length(dm)) * 0.25;
      }
      c = mix(c, vax, smoothstep(1.0, 0.97, ve));
    }
  }

  // ---- Ånga som stiger från stearinet ----
  {
    float a = fbm(vec2(p.x * 5.0, p.y * 3.0 - t * 0.22));
    float mask = smoothstep(0.24, 0.0, abs(p.x - 0.5)) * smoothstep(YV + 0.02, YV + 0.08, p.y) * smoothstep(YV + 0.55, YV + 0.1, p.y);
    c += vec3(0.55, 0.5, 0.44) * smoothstep(0.55, 0.85, a) * mask * 0.06 * (lys.r * 0.6 + 0.4);
  }

  // ---- Ljuset som doppas, veken och pinnen ----
  if (u_alfa > 0.0) {
    float Lh = u_ljus.z;
    vec2 hp = vec2(ljusX, u_ljus.y + 0.07);
    float ca = cos(u_ljus.w), sa = sin(u_ljus.w);
    vec2 d0 = p - hp;
    vec2 q = vec2(ca * d0.x + sa * d0.y, -sa * d0.x + ca * d0.y) + hp;
    // När veken är klippt faller ljuset, och allt nedanför klippet, en bit nedåt
    float klipp = u_klipp.x;
    vec2 qv = q;
    q.y += u_klipp.y;
    float v = (u_ljus.y - q.y) / Lh;
    float dx = q.x - ljusX;
    // Profilen: egen radie åt vänster och höger, så att ljuset blir knöligt
    float vt = clamp(v, 0.0, 1.0);
    vec3 pr = texture(u_prof, vec2(vt * (1.0 - 1.0 / ${N}.0) + 0.5 / ${N}.0, 0.5)).rgb;
    float sida = smoothstep(-0.0015, 0.0015, dx);
    float r = max(mix(pr.r, pr.g, sida), 1e-4), hv = pr.b;
    // Lutningen längs ljuset ger knölarna ljus och skugga
    float dv = 1.5 / ${N}.0;
    vec3 pa = texture(u_prof, vec2(clamp(vt - dv, 0.0, 1.0) * (1.0 - 1.0 / ${N}.0) + 0.5 / ${N}.0, 0.5)).rgb;
    vec3 pb = texture(u_prof, vec2(clamp(vt + dv, 0.0, 1.0) * (1.0 - 1.0 / ${N}.0) + 0.5 / ${N}.0, 0.5)).rgb;
    float lut = (mix(pb.r, pb.g, sida) - mix(pa.r, pa.g, sida)) / (2.0 * dv * Lh);
    float inne = 0.0;
    float ny = 0.0;
    if (v >= 0.0 && v <= 1.0) {
      inne = smoothstep(r, r - px * 1.3, abs(dx));
      ny = -clamp(lut * 3.0, -0.8, 0.8);
    } else if (v < 0.0) {
      // Den smala halsen upptill, där veken går in
      float capH = r * 0.7;
      float e = length(vec2(dx / r, (q.y - u_ljus.y) / max(capH, 1e-4)));
      inne = smoothstep(1.0, 1.0 - px * 1.3 / r, e);
      ny = clamp((q.y - u_ljus.y) / max(capH, 1e-4), 0.0, 1.0) * 0.8;
    } else {
      // Spetsen: dropparna har stelnat till en avsmalnande, lite spetsig ände
      float capH = r * 0.9 + u_spets.x;
      float yy = clamp((ljusBotten - q.y) / max(capH, 1e-4), 0.0, 1.0);
      float w = r * pow(max(0.0, 1.0 - pow(yy, 1.7)), 0.55);
      inne = smoothstep(w, w - px * 1.3, abs(dx)) * step(q.y, ljusBotten) * step(ljusBotten - capH, q.y);
      ny = -0.25 - 0.6 * yy;
    }
    // Droppen som hänger under spetsen medan stearinet är varmt
    float drR = u_spets.y;
    if (drR > 0.0) {
      vec2 dc = vec2(ljusX, ljusBotten - (r * 0.9 + u_spets.x) - drR * 0.2);
      float e = length(vec2(dx, (q.y - dc.y) * 0.8) ) / drR;
      float d = smoothstep(1.0, 0.85, e);
      if (d > inne) { inne = d; hv = max(hv, u_spets.z); ny = -0.4; }
    }
    // Det som satt ovanför klippet följer inte med ljuset
    if (klipp > 0.0) inne *= step(klipp, hp.y - q.y);
    // Bara det som är ovanför stearinets yta syns
    inne *= smoothstep(YV - 0.001, YV + 0.003, p.y);
    if (inne > 0.0) {
      float nx = clamp(dx / r, -1.0, 1.0);
      vec3 n = normalize(vec3(nx, ny * sqrt(max(0.0, 1.0 - nx * nx)), sqrt(max(0.0, 1.0 - nx * nx)) + 0.05));
      vec3 l = normalize(vec3(-0.45, 0.25, 0.85));
      float dif = (max(dot(n, l), 0.0) + 0.35) / 1.35;
      vec3 kall = vec3(0.97, 0.95, 0.9);
      vec3 varm = vec3(0.94, 0.84, 0.64);
      vec3 col = mix(kall, varm, hv);
      // Svaga lager och ojämnheter i ytan
      col *= 0.95 + 0.05 * brus(vec2(v * 90.0, nx * 2.0 + sida * 7.0));
      vec3 belys = lys * 0.35 + vec3(0.46, 0.45, 0.44);
      col *= (0.3 + 0.7 * dif) * belys;
      // Stearinet släpper igenom lite ljus i kanterna
      col += vec3(1.0, 0.68, 0.38) * pow(1.0 - n.z, 2.0) * (0.06 + 0.12 * u_varme);
      // Varmt stearin glänser
      float spec = pow(max(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0), mix(6.0, 50.0, hv));
      col += vec3(1.0, 0.95, 0.85) * spec * mix(0.05, 0.55, hv);
      c = mix(c, col, inne * u_alfa);
    }
    // Veken mellan ljuset och pinnen
    float veke = smoothstep(0.0016, 0.0007, abs(dx)) * step(u_ljus.y - 0.002, q.y) * step(q.y, hp.y);
    // Efter klippet: en vekstump hänger kvar på pinnen, och en kort veke sitter kvar på ljuset
    if (klipp > 0.0) {
      veke = smoothstep(0.0016, 0.0007, abs(dx)) * (step(hp.y - klipp, qv.y) * step(qv.y, hp.y)
           + step(u_ljus.y - 0.002, q.y) * step(q.y, hp.y - klipp));
    }
    c = mix(c, vec3(0.9, 0.86, 0.76) * (lys * 0.7 + 0.2), veke * u_alfa);
    // Pinnen hon håller veken i
    float pd = abs(p.y - hp.y);
    if (pd < 0.0075 && abs(p.x - ljusX) < 0.17) {
      float n = pd / 0.0075;
      vec3 tra = vec3(0.45, 0.3, 0.17) * (0.55 + 0.45 * (1.0 - n * n)) * (lys * 0.8 + 0.15);
      tra *= 0.9 + 0.1 * brus(vec2(p.x * 160.0, 3.0));
      c = mix(c, tra, smoothstep(1.0, 0.8, n) * smoothstep(0.17, 0.165, abs(p.x - ljusX)) * u_alfa);
    }
  }

  // ---- Droppar som faller tillbaka i kastrullen ----
  for (int i = 0; i < 6; i++) {
    vec3 D = u_dr[i];
    if (D.z <= 0.0) continue;
    vec2 d = p - D.xy;
    float e = length(vec2(d.x, d.y * 0.7)) / D.z;
    c = mix(c, vec3(0.95, 0.86, 0.68) * (lys * 0.7 + 0.25) + vec3(0.3) * smoothstep(0.6, 0.0, length(d / D.z + vec2(0.35, -0.35))), smoothstep(1.0, 0.8, e));
  }

  // ---- Kastrullens framsida: röd emalj med vit kant ----
  float wy = 0.25 - 0.016 * (kc.y - p.y) / 0.33;
  float fram = kc.y - kr.y * sqrt(max(0.0, 1.0 - pow((p.x - 0.5) / kr.x, 2.0)));
  float botten = 0.315 - 0.045 * sqrt(max(0.0, 1.0 - pow((p.x - 0.5) / wy, 2.0)));
  if (abs(p.x - 0.5) < wy && p.y < fram + 0.004 && p.y > botten && ke >= 0.97) {
    float nx = (p.x - 0.5) / wy;
    vec3 emalj = vec3(0.6, 0.07, 0.05);
    float dif = 0.35 + 0.65 * clamp(0.55 - 0.5 * nx, 0.0, 1.0);
    vec3 kropp = emalj * dif * (lys * 0.8 + 0.15);
    kropp += vec3(1.0, 0.85, 0.75) * pow(max(0.0, 1.0 - abs(nx + 0.42) * 7.0), 3.0) * 0.28 * (lys.r * 0.5 + 0.5);
    // Spisens glöd underifrån
    kropp += vec3(0.6, 0.2, 0.05) * smoothstep(0.42, 0.31, p.y) * 0.2;
    // En liten vit emaljkant längst upp
    float kant = smoothstep(0.014, 0.0, fram - p.y);
    kropp = mix(kropp, vec3(0.88, 0.86, 0.8) * (lys * 0.8 + 0.15), kant);
    kropp = mix(kropp, vec3(0.06, 0.08, 0.14), smoothstep(0.004, 0.0, abs(fram - p.y)) * 0.8);
    c = mix(c, kropp, smoothstep(wy, wy - px * 1.5, abs(p.x - 0.5)));
  }
  // Kanten runt öppningen
  if (abs(ke - 1.0) < 0.05 && p.y > fram - 0.002) {
    vec3 rim = vec3(0.85, 0.83, 0.78) * (lys * 0.8 + 0.15);
    rim = mix(rim, vec3(0.06, 0.08, 0.14), smoothstep(0.035, 0.05, abs(ke - 1.0)));
    c = mix(c, rim, smoothstep(0.05, 0.04, abs(ke - 1.0)));
  }
  // Öronen att lyfta i
  for (int k = 0; k < 2; k++) {
    float sx = k == 0 ? -1.0 : 1.0;
    vec2 d = (p - vec2(0.5 + sx * 0.275, 0.6)) / vec2(0.028, 0.016);
    float e = length(d);
    if (e < 1.0 && e > 0.55 && d.x * sx > -0.2) c = vec3(0.07, 0.07, 0.08) * (lys * 0.8 + 0.2);
  }

  // ---- Saxen: en gammal sax helt i stål, som ligger på spisen bredvid kastrullen ----
  {
    vec2 led = u_saxL.xy;
    // Saxens sken när ljuset är lagom tjockt
    vec2 dg = (p - led - vec2(-0.005, 0.0)) / vec2(0.15, 0.06);
    c += vec3(1.0, 0.75, 0.45) * exp(-dot(dg, dg) * 2.0) * u_sax.y * (0.1 + 0.05 * sin(t * 2.2));
    vec2 rikt = vec2(cos(u_saxL.z), sin(u_saxL.z));
    // Slitet stål: matt, med mörkare fläckar av ålder
    float patina = fbm3(p * 70.0);
    vec3 stal = vec3(0.6, 0.61, 0.62) * (0.82 + 0.25 * fbm3(p * 160.0));
    stal = mix(stal, vec3(0.36, 0.33, 0.3), smoothstep(0.55, 0.72, patina) * 0.6);
    stal *= lys * 0.4 + 0.6;
    for (int k = 1; k >= 0; k--) {
      float sg = k == 0 ? 1.0 : -1.0;
      float a = sg * u_sax.x * 0.5;
      vec2 d = vec2(cos(a) * rikt.x - sin(a) * rikt.y, sin(a) * rikt.x + cos(a) * rikt.y);
      vec2 nn = vec2(-d.y, d.x);
      vec2 pl = vec2(dot(p - led, d), dot(p - led, nn));
      float tack = 0.0, form = 1.0;
      // Bladet: långt och avsmalnande, med en rak rygg
      const float BL = 0.088;
      if (pl.x > -0.004 && pl.x < BL) {
        float h = clamp(pl.x / BL, 0.0, 1.0);
        float w = 0.0068 * pow(1.0 - h, 0.75) + 0.0006;
        float mitt = sg * 0.0018 * (1.0 - h);
        float dd = abs(pl.y - mitt);
        float t2 = smoothstep(w, w - px * 1.2, dd);
        if (t2 > tack) { tack = t2; form = dd / w; }
      }
      // Skänkeln som böjer ut mot handtaget på andra sidan leden
      if (pl.x < 0.0 && pl.x > -0.042) {
        float h = clamp(-pl.x / 0.042, 0.0, 1.0);
        float mitt = -sg * 0.011 * h * h * (3.0 - 2.0 * h);
        float w = 0.0042 - 0.001 * h;
        float dd = abs(pl.y - mitt);
        float t2 = smoothstep(w, w - px * 1.2, dd);
        if (t2 > tack) { tack = t2; form = dd / w; }
      }
      // Öglorna: en liten rund för tummen och en större, avlång för fingrarna
      vec2 R = k == 0 ? vec2(0.013, 0.012) : vec2(0.026, 0.014);
      vec2 oc = vec2(-0.04 - R.x * 0.85, -sg * (0.011 + R.y * 0.75));
      float e = length((pl - oc) / R);
      float tj = 0.0042;
      float dd = abs(e - 1.0) * min(R.x, R.y);
      float t2 = smoothstep(tj, tj - px * 1.2, dd);
      if (t2 > tack) { tack = t2; form = dd / tj; }
      if (tack > 0.0) {
        // Rundad, sliten yta: ljusare mitt på och mörkare mot kanterna
        vec3 f = stal * (0.62 + 0.45 * (1.0 - form * form));
        f += vec3(1.0, 0.95, 0.88) * pow(max(0.0, 1.0 - form * 1.6), 3.0) * 0.18 * (lys.r * 0.4 + 0.6);
        // Den undre halvan ligger lite i skugga under den övre
        f *= k == 1 ? 0.82 : 1.0;
        c = mix(c, f, tack);
      }
    }
    // Niten i leden
    float dl = length(p - led);
    vec3 nit = vec3(0.68, 0.69, 0.7) * (lys * 0.4 + 0.6) * (0.75 + 0.35 * smoothstep(0.0045, 0.0, length(p - led - vec2(-0.0012, 0.0012))));
    c = mix(c, nit, smoothstep(0.0046, 0.0036, dl));
    c = mix(c, c * 0.6, smoothstep(0.0012, 0.0, abs(dl - 0.0042)) * 0.6);
  }

  // Mjuk vinjett
  vec2 vg = (p - vec2(0.5, H * 0.5)) / vec2(0.9, H * 0.65);
  c *= 0.72 + 0.28 * smoothstep(1.2, 0.3, length(vg));
  frag = vec4(c * u_synlig, 1.0);
}`;

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const prog = program(gl, HELSKARM, FS);
    const u = platser(gl, prog, ['u_res', 'u_tid', 'u_synlig', 'u_prof', 'u_ljus', 'u_spets', 'u_alfa',
      'u_ring', 'u_dr', 'u_fonster', 'u_varme', 'u_rors', 'u_snitt', 'u_former', 'u_sax', 'u_saxL', 'u_klipp']);
    gl.useProgram(prog);
    const tom = gl.createVertexArray();

    // ---------- Ljuset ----------
    // Två sidor, vänster och höger, så att ljuset kan bli knöligt. Det fasta stearinet
    // och det ännu flytande lagret hålls isär: det flytande rinner nedåt medan det är
    // varmt och stelnar efter hand som det svalnar.
    const H = () => duk.clientHeight / duk.clientWidth;
    const HALS = 0.07;                   // veken mellan pinnen och ljuset
    const vilaY = () => Math.max(YV + LANGD + HALS + 0.12, H() * 0.72 + HALS);
    const fast = [new Float32Array(N).fill(VEKE), new Float32Array(N).fill(VEKE)];
    const film = [new Float32Array(N), new Float32Array(N)];
    const varme = new Float32Array(N);
    const nere = new Uint8Array(N);
    const vidDopp = new Float32Array(N);
    const pinne = { x: 0.5, y: vilaY() + 0.25 };
    const mal = { x: 0.5, y: vilaY() };
    let vinkel = 0, vinkelFart = 0, forraX = pinne.x, forraVx = 0;
    let spets = 0;                       // stelnade droppar längst ner
    let droppe = null;                   // { r, nasta, varm }
    const fall = [];                     // fallande droppar { x, y, vy, r }
    const ringar = [];                   // { x, t0, s }
    let fas = 'ny', fasTid = 0, alfa = 0;   // rummet börjar med att veken sänks ner
    let rors = 0, forraBotten = 9;
    let dopp = 0;                        // alla dopp sedan rummet öppnades
    let ljusDopp = 0;                    // dopp på ljuset som hänger nu
    let toppDopp = 1;                    // det högsta stället på ljuset som har varit nere i stearinet
    let klippDist = 0, klippFall = 0;    // där veken klipptes, och hur långt ljuset har fallit

    let antal = 0;
    try { antal = Math.max(0, Math.floor(Number(localStorage.getItem(NYCKEL)) || 0)); } catch {}
    // Ljusen i fönstret: höjden varierar lite, som på riktiga doppade ljus
    // Formerna på ljusen hon har gjort sparas, så att de står i fönstret precis som de blev
    let former = [];
    try { former = JSON.parse(localStorage.getItem(FORM_NYCKEL) || '[]'); } catch {}
    if (!Array.isArray(former)) former = [];
    // Ett ljus utan sparad form (gjort innan formerna sparades) får en påhittad i samma stil
    function pahittadForm(fro) {
      const slp = (k) => ((Math.sin(fro * 91.7 + k * 12.9898) * 43758.5453) % 1 + 1) % 1;
      const sidor = [0, 1].map((s) => {
        const f = 4 + 4 * slp(s + 1), a = 6.3 * slp(s + 3), kv = 0.2 + 0.7 * slp(s + 5), kh = 0.08 + 0.18 * slp(s + 7);
        return Array.from({ length: FN }, (_, j) => {
          const v = j / (FN - 1);
          const bas = 0.004 + 0.02 * mjuk(0, 0.32, v) + 0.007 * v;
          return bas * (1 + 0.06 * Math.sin(v * f + a) + kh * Math.exp(-((v - kv) ** 2) / 0.006));
        });
      });
      return beskar({ l: sidor[0], r: sidor[1], spets: 0.015 + 0.015 * slp(9) });
    }
    // Ett ljus i fönstret består bara av den doppade delen. Den tunna, bara veken ovanför
    // stearinet skärs bort, så att lågan sitter på ljuset och inte uppe i luften.
    function beskar(f) {
      if (f.fran !== undefined) return f;
      let j = 0;
      while (j < FN - 2 && (f.l[j] + f.r[j]) * 0.5 < VEKE * 2.5) j++;
      const fran = Math.max(V0, j / (FN - 1));
      const om = (a) => Array.from({ length: FN }, (_, k) => {
        const x = (fran + (1 - fran) * (k / (FN - 1))) * (FN - 1), i = Math.floor(x), t = x - i;
        return a[i] + ((a[Math.min(FN - 1, i + 1)] ?? a[i]) - a[i]) * t;
      });
      return { l: om(f.l), r: om(f.r), spets: f.spets || 0, fran };
    }
    former = former.map((f) => (f ? beskar(f) : f));
    const formHojd = (f) => (1 - f.fran) * LANGD * SKALA + (f.spets || 0) * SKALA;
    const fonster = FONSTER_X.map((x, i) => {
      if (i < antal && !former[i]) former[i] = pahittadForm(i);
      return {
        x, hojd: former[i] ? formHojd(former[i]) : 0.15,
        tand: i < antal ? 10 : -1, syns: i < antal ? 1 : 0,
      };
    });

    function nollstall() {
      for (let s = 0; s < 2; s++) { fast[s].fill(VEKE); film[s].fill(0); }
      varme.fill(0); nere.fill(0); vidDopp.fill(0);
      spets = 0; droppe = null; ljusDopp = 0; toppDopp = 1; klippDist = 0; klippFall = 0;
      vinkel = 0; vinkelFart = 0;
      ljusForm = ojamnhet(); doppForm = ojamnhet();
    }
    // Varje lager blir lite ojämnt: mjuka vågor längs ljuset och ett par knölar,
    // olika på vänster och höger sida
    function ojamnhet() {
      const sidor = [];
      for (let s = 0; s < 2; s++) {
        const f1 = slump(4, 8), f2 = slump(9, 14), a1 = slump(0, 6.3), a2 = slump(0, 6.3);
        const knolar = Array.from({ length: 2 }, () => ({ v: slump(0.15, 0.95), b: slump(0.05, 0.11), h: slump(0.1, 0.3) }));
        sidor.push((v) => {
          let k = 1 + 0.07 * Math.sin(v * f1 + a1) + 0.03 * Math.sin(v * f2 + a2);
          for (const kn of knolar) k += kn.h * Math.exp(-((v - kn.v) ** 2) / (kn.b * kn.b));
          return Math.max(0.3, k);
        });
      }
      return sidor;
    }
    // Varje ljus får sin egen karaktär som byggs på dopp för dopp, plus lite nytt för
    // varje lager. Längre ner fastnar mer, eftersom det som rinner ovanifrån samlas där.
    let ljusForm = ojamnhet(), doppForm = ojamnhet();
    const lagerForm = [0, 1].map((s) => (v) =>
      (0.6 * ljusForm[s](v) + 0.4 * doppForm[s](v)) * (0.7 + 0.55 * Math.pow(v, 1.3)));
    // Var en punkt på ljuset befinner sig, räknat från pinnen
    const punkt = (avst) => [pinne.x + avst * Math.sin(vinkel), pinne.y - avst * Math.cos(vinkel)];

    // ---------- Ljud ----------
    const l = rumsLjud(1.4, 2);
    const { ctx, ut } = l;
    const eko = rum(1.8);
    const ekoUt = ctx.createGain(); ekoUt.gain.value = 0.3;
    eko.connect(ekoUt).connect(ut);
    // Spisen: ett lågt brus av elden bakom luckan
    const spis = brusKalla('rosa');
    const spF = ctx.createBiquadFilter(); spF.type = 'lowpass'; spF.frequency.value = 170;
    const spG = ctx.createGain(); spG.gain.value = 0.035;
    spis.connect(spF).connect(spG).connect(ut);
    // Det tröga stearinet när veken rör sig i det
    const trog = brusKalla('rosa');
    const trF = ctx.createBiquadFilter(); trF.type = 'lowpass'; trF.frequency.value = 280; trF.Q.value = 3;
    const trG = ctx.createGain(); trG.gain.value = 0;
    trog.connect(trF).connect(trG).connect(ut);
    l.kallor.push(spis, trog);
    let knasterTid = 0.5, puttraTid = 2;
    function plopp(fart) {
      const t = ctx.currentTime;
      bubbla(ctx, ut, slump(120, 160), Math.min(0.045, 0.012 + fart * 0.05), t);
      brusstot(ctx, ut, { frekvens: 420, q: 0.9, styrka: Math.min(0.03, fart * 0.05), langd: 0.012, nar: t });
    }
    function plipp() { bubbla(ctx, ut, slump(650, 950), 0.011); }
    function klippLjud() {
      const t = ctx.currentTime;
      // Två korta metalliska knäpp när bladen glider mot varandra och möts
      brusstot(ctx, ut, { frekvens: 5200, q: 3, styrka: 0.03, langd: 0.0025, nar: t });
      brusstot(ctx, ut, { frekvens: 3800, q: 2.5, styrka: 0.035, langd: 0.003, nar: t + 0.07 });
      klang(ctx, ut, 3100, [[1, 1, 0.12], [2.7, 0.4, 0.06]], { styrka: 0.006, ansats: 0.001, nar: t + 0.07 });
    }
    function tandFras() {
      const t = ctx.currentTime;
      const k = brusKalla('rosa');
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = 0.7;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.022, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      k.connect(f).connect(g).connect(ut);
      setTimeout(() => { try { k.stop(); } catch {} }, 1000);
    }

    // ---------- Ledtext ----------
    const led = document.createElement('p');
    led.className = 'lucka-ui ledtext';
    led.textContent = 'Ta tag i pinnen och doppa ljuset';
    led.style.bottom = '42%';
    scen.append(led);
    let ledVisad = false;

    // ---------- Saxen ----------
    let saxOppen = 0.06, saxTid = -1, saxSken = 0, saxTryck = null, redo = false, saxLedVisad = false;
    const SAX_VILA = Math.atan2(0.16, -1);
    const saxL = { x: SAX[0], y: SAX[1], a: SAX_VILA };
    let saxFlykt = null;                 // { t, fran: { x, y, a } } medan saxen är på väg att klippa
    const paSaxen = (wx, wy) => Math.hypot((wx - SAX[0] - 0.01) / 1.8, wy - SAX[1]) < 0.06;
    function klipp() {
      if (fas !== 'doppa' || saxTid >= 0 || saxFlykt) return;
      grepp = null;
      // För få dopp, eller ljuset nere i stearinet: saxen klipper bara i luften där den ligger
      const botten = pinne.y - (HALS + LANGD) * Math.cos(vinkel);
      if (ljusDopp < MINDOPP || botten < YV + 0.01) { saxTid = 0; klippLjud(); return; }
      // Annars flyger saxen upp till veken, öppnas på vägen och klipper strax ovanför
      // det högsta stället hon har doppat
      fas = 'klipper';
      droppe = null;
      led.classList.remove('syns');
      saxFlykt = { t: 0, fran: { ...saxL } };
    }
    // Var stearinet börjar synas på ljuset: det högsta stället som är märkbart tjockare
    // än den bara veken. Högst upp i det doppade har stearinet runnit ner, så där är
    // lagret nästan osynligt.
    function vaxTopp() {
      for (let i = 0; i < N; i++) {
        if ((data[i * 4] + data[i * 4 + 1]) * 0.5 > VEKE * 2.5) return Math.max(toppDopp, i / (N - 1));
      }
      return toppDopp;
    }
    // Var saxen ska klippa: vinkelrätt mot veken, strax ovanför stearinet
    function klippMal() {
      const dist = Math.max(HALS * 0.5, HALS + vaxTopp() * LANGD - 0.012);
      const [cx, cy] = punkt(dist);
      const a = Math.PI + vinkel;
      return { dist, x: cx - Math.cos(a) * 0.046, y: cy - Math.sin(a) * 0.046, a };
    }
    const vinkelMellan = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; };
    function saxenFlyger(dt) {
      if (!saxFlykt) return;
      const F = saxFlykt;
      F.t += dt;
      const t = F.t;
      const mal2 = klippMal();
      if (t < 0.85) {
        // Upp till veken i en mjuk båge, medan bladen öppnas
        const e = mjuk(0, 0.85, t);
        saxL.x = F.fran.x + (mal2.x - F.fran.x) * e + Math.sin(Math.PI * e) * 0.06;
        saxL.y = F.fran.y + (mal2.y - F.fran.y) * e;
        saxL.a = vinkelMellan(F.fran.a, mal2.a, e);
        saxOppen = 0.06 + 0.5 * mjuk(0, 0.7, t);
      } else if (t < 1.1) {
        // Ett ögonblick vid veken, och så klipper den
        saxL.x = mal2.x; saxL.y = mal2.y; saxL.a = mal2.a;
        if (t >= 0.98) {
          if (!F.klippt) {
            F.klippt = true;
            klippLjud();
            klippDist = mal2.dist;
            fas = 'klar'; fasTid = 0;
            klocka(587.3, { till: ut, eko, styrka: 0.028, ansats: 0.2, langd: 5, nar: ctx.currentTime + 0.25 });
            klocka(880, { till: ut, eko, styrka: 0.018, ansats: 0.25, langd: 5, nar: ctx.currentTime + 0.75 });
          }
          saxOppen = Math.max(0, 0.56 - ((t - 0.98) / 0.08) * 0.56);
        }
        F.vid = { x: saxL.x, y: saxL.y, a: saxL.a };
      } else if (t < 2.2) {
        // Tillbaka till spisen
        const e = mjuk(1.1, 2.2, t);
        saxL.x = F.vid.x + (SAX[0] - F.vid.x) * e - Math.sin(Math.PI * e) * 0.04;
        saxL.y = F.vid.y + (SAX[1] - F.vid.y) * e;
        saxL.a = vinkelMellan(F.vid.a, SAX_VILA, e);
        saxOppen += (0.06 - saxOppen) * Math.min(1, dt * 4);
      } else {
        saxL.x = SAX[0]; saxL.y = SAX[1]; saxL.a = SAX_VILA;
        saxFlykt = null;
      }
    }

    // ---------- Fingret ----------
    // Så fort hon rör vid skärmen har hon tag i pinnen, var hon än sätter fingret.
    // Sedan följer pinnen fingret, upp, ner och åt sidan, tills hon släpper.
    const tillVarld = (x, y) => [x / duk.clientWidth, (duk.clientHeight - y) / duk.clientWidth];
    let grepp = null;
    fingrar(duk, {
      ner: (x, y, id) => {
        if (grepp || fas !== 'doppa') return;
        const [wx, wy] = tillVarld(x, y);
        // Ett tryck på saxen tar inte tag i pinnen
        if (paSaxen(wx, wy)) { saxTryck = id; return; }
        grepp = { id, ox: pinne.x - wx, oy: pinne.y - wy };
        mal.x = pinne.x; mal.y = pinne.y;
      },
      drag: (x, y, id) => {
        if (!grepp || grepp.id !== id) return;
        const [wx, wy] = tillVarld(x, y);
        mal.x = wx + grepp.ox;
        mal.y = wy + grepp.oy;
      },
      upp: (x, y, id, { tryck }) => {
        if (grepp && grepp.id === id) grepp = null;
        if (saxTryck === id) {
          saxTryck = null;
          const [wx, wy] = tillVarld(x, y);
          if (tryck && paSaxen(wx, wy)) klipp();
        }
      },
    });
    // Pinnen hålls inom rummet, och nere i kastrullen styr kanten ljuset inåt
    function begransa() {
      mal.x = klamp(mal.x, 0.12, 0.88);
      mal.y = klamp(mal.y, YV + 0.025 + HALS, H() - 0.05);
      if (mal.y - HALS - LANGD < 0.72) mal.x = klamp(mal.x, 0.5 - 0.2, 0.5 + 0.2);
    }

    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const data = new Float32Array(N * 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, N, 1, 0, gl.RGBA, gl.FLOAT, data);
    gl.uniform1i(u.u_prof, 0);
    const formTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, formTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const formData = new Float32Array(FN * 8 * 4);
    function laddaFormer() {
      formData.fill(0);
      former.forEach((f, rad) => {
        if (!f || rad >= 8) return;
        for (let j = 0; j < FN; j++) {
          formData[(rad * FN + j) * 4] = f.l[j] || 0;
          formData[(rad * FN + j) * 4 + 1] = f.r[j] || 0;
        }
      });
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, formTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, FN, 8, 0, gl.RGBA, gl.FLOAT, formData);
      gl.activeTexture(gl.TEXTURE0);
    }
    laddaFormer();
    gl.uniform1i(u.u_former, 1);
    // Det färdiga ljusets form, nedräknad till FN punkter per sida
    function sparaForm(plats) {
      // Bara den doppade delen sparas, från strax ovanför det högsta stället hon doppat
      const fran = Math.min(0.9, Math.max(0, vaxTopp() - 0.01));
      const ta = (s) => Array.from({ length: FN }, (_, j) => {
        const x = (fran + (1 - fran) * (j / (FN - 1))) * (N - 1), i = Math.floor(x), t = x - i;
        const a = data[i * 4 + s], b = data[Math.min(N - 1, i + 1) * 4 + s];
        return Math.round((a + (b - a) * t) * 1e5) / 1e5;
      });
      former[plats] = { l: ta(0), r: ta(1), spets: Math.round(spets * 1e4) / 1e4, fran: Math.round(fran * 1e3) / 1e3 };
      try { localStorage.setItem(FORM_NYCKEL, JSON.stringify(former)); } catch {}
      laddaFormer();
      fonster[plats].hojd = formHojd(former[plats]);
    }
    const ringData = new Float32Array(16);
    const drData = new Float32Array(18);
    const fData = new Float32Array(32);
    const ring = (x, t0, s) => { ringar.push({ x, t0, s }); if (ringar.length > 4) ringar.shift(); };

    // ---------- Ritslinga ----------
    const stoppa = slinga((tid, dt) => {
      // Ledtexten visas en stund i början, tills hon har doppat första gången
      if (!ledVisad && tid > 2.5) { led.classList.add('syns'); ledVisad = true; }
      if (ledVisad && !saxLedVisad && (dopp > 0 || tid > 16)) led.classList.remove('syns');

      // ---- Pinnen och ljuset ----
      const botten0 = pinne.y - (HALS + LANGD) * Math.cos(vinkel);
      if (fas === 'doppa' && !grepp && botten0 < YV + 0.04) {
        // Släpper hon med ljuset nere i stearinet lyfts det sakta upp ur det
        mal.y = pinne.y + 0.35 * dt;
      } else if (fas === 'doppa' && !grepp) {
        mal.x = pinne.x; mal.y = pinne.y;
      }
      begransa();
      const fore = { x: pinne.x, y: pinne.y };
      const k = Math.min(1, dt * 16);
      pinne.x += (mal.x - pinne.x) * k;
      pinne.y += (mal.y - pinne.y) * k;
      const fart = Math.hypot(pinne.x - fore.x, pinne.y - fore.y) / Math.max(dt, 1e-3);

      // Ljuset hänger som en pendel från pinnen och svänger när hon för det åt sidan.
      // Nere i stearinet bromsas det nästan helt.
      const vx = (pinne.x - forraX) / Math.max(dt, 1e-3);
      const ax = dt > 0 ? (vx - forraVx) / dt : 0;
      forraX = pinne.x; forraVx += (vx - forraVx) * 0.5;
      const iVax = botten0 < YV;
      const broms = iVax ? 16 : 2.4;
      vinkelFart += (-28 * Math.sin(vinkel) - klamp(ax, -60, 60) * 2.6 * Math.cos(vinkel) - broms * vinkelFart) * dt;
      vinkel = klamp(vinkel + vinkelFart * dt, -0.45, 0.45);
      if (iVax) vinkel *= Math.exp(-dt * 3);
      vinkel += 0.0015 * Math.sin(tid * 0.7) * dt;

      const cosV = Math.cos(vinkel);
      const botten = pinne.y - (HALS + LANGD) * cosV;
      const [spetsX] = punkt(HALS + LANGD);

      // Ringar när spetsen bryter ytan
      if (forraBotten >= YV && botten < YV) {
        ring(spetsX, tid, Math.min(1, 0.3 + fart * 0.8));
        plopp(fart);
      }
      forraBotten = botten;

      // ---- Lager för lager ----
      for (let i = 0; i < N; i++) {
        const v = i / (N - 1);
        const y = pinne.y - (HALS + v * LANGD) * cosV;
        if (y < YV) {
          if (v < toppDopp) toppDopp = v;
          if (!nere[i]) {
            nere[i] = 1;
            vidDopp[i] = varme[i];
            // Det som ännu är flytande smälter tillbaka ner i kastrullen
            film[0][i] = 0; film[1][i] = 0;
          }
          varme[i] += (1 - varme[i]) * Math.min(1, dt / 0.12);
          // Ligger det kvar länge mjuknar det yttersta lagret lite
          if (varme[i] > 0.95) for (let s = 0; s < 2; s++) fast[s][i] = Math.max(VEKE, fast[s][i] - 0.00006 * dt);
        } else {
          if (nere[i]) {
            nere[i] = 0;
            // Ett nytt flytande lager. Var ljuset redan varmt fastnar mindre.
            const nu = (fast[0][i] + fast[1][i]) * 0.5;
            const tjock = LAGER * (1 - 0.6 * vidDopp[i]) * Math.max(0.12, 1 - nu / MAXR);
            film[0][i] += tjock * lagerForm[0](v);
            film[1][i] += tjock * lagerForm[1](v);
            if (i === N - 1) {
              droppe = { r: 0.0055, nasta: slump(0.3, 0.6), varm: 1 };
              dopp++;
              ljusDopp++;
              doppForm = ojamnhet();
            }
          }
          varme[i] *= Math.exp(-dt / KYL);
        }
      }
      // Det flytande stearinet rinner nedåt medan det är varmt och stelnar när det svalnar
      for (let s = 0; s < 2; s++) {
        const F = film[s], S = fast[s];
        for (let i = N - 2; i >= 0; i--) {
          if (nere[i] || F[i] <= 0) continue;
          const w = varme[i];
          const flyt = Math.min(0.45, 6 * w * w * (F[i] / LAGER) * dt);
          const ner = F[i] * flyt;
          F[i] -= ner;
          if (!nere[i + 1]) F[i + 1] += ner;
        }
        for (let i = 0; i < N; i++) {
          if (F[i] <= 0) continue;
          const stel = F[i] * Math.min(1, dt * 3.2 * (1 - varme[i]));
          F[i] -= stel;
          if (i === N - 1) {
            // Längst ner stelnar det som runnit dit till en tjockare, längre spets
            S[i] += stel * 0.5;
            spets = Math.min(0.04, spets + stel * 0.3);
          } else S[i] += stel;
        }
        // Det som har runnit ner till spetsen medan det är varmt droppar av
        const B = N - 1;
        if (!nere[B] && F[B] > 0) F[B] -= F[B] * Math.min(1, dt * 5 * varme[B]);
      }
      for (let i = 0; i < N; i++) {
        data[i * 4] = fast[0][i] + film[0][i];
        data[i * 4 + 1] = fast[1][i] + film[1][i];
        data[i * 4 + 2] = varme[i];
        data[i * 4 + 3] = 0;
      }
      // Spetsen rundas av mot det som är ovanför
      for (let s = 0; s < 2; s++) data[(N - 1) * 4 + s] = Math.max(data[(N - 1) * 4 + s], 0.8 * data[(N - 2) * 4 + s]);
      const rSlut = (data[(N - 1) * 4] + data[(N - 1) * 4 + 1]) * 0.5;

      // Droppen under spetsen: den droppar ett par gånger och stelnar sedan
      const spetsAvst = HALS + LANGD + rSlut * 0.9 + spets;
      if (droppe) {
        droppe.nasta -= dt;
        droppe.varm = varme[N - 1];
        if (botten < YV) droppe = null;
        else if (droppe.nasta <= 0 && droppe.r > 0.0032 && droppe.varm > 0.45) {
          const [dx, dy] = punkt(spetsAvst + droppe.r);
          fall.push({ x: dx, y: dy, vy: 0, r: droppe.r * 0.6 });
          droppe.r *= 0.72;
          droppe.nasta = slump(0.35, 0.9);
        } else if (droppe.varm < 0.4) {
          spets = Math.min(0.04, spets + droppe.r * 0.35);
          droppe = null;
        }
      }
      for (let i = fall.length - 1; i >= 0; i--) {
        const d = fall[i];
        d.vy += 2.2 * dt;
        d.y -= d.vy * dt;
        if (d.y < YV) {
          fall.splice(i, 1);
          ring(d.x + slump(-0.004, 0.004), tid, 0.25);
          plipp();
        }
      }

      // Där ljuset går genom ytan, för menisken
      let snittX = 0, snittR = 0;
      if (iVax) {
        const avst = (pinne.y - YV) / Math.max(cosV, 0.3);
        snittX = pinne.x + avst * Math.sin(vinkel);
        const vi = klamp(Math.round(((avst - HALS) / LANGD) * (N - 1)), 0, N - 1);
        snittR = Math.max(VEKE, (data[vi * 4] + data[vi * 4 + 1]) * 0.5);
      }

      // Omrörningen i stearinet och det tröga ljudet
      rors += ((iVax ? Math.min(1, fart * 1.5) : 0) - rors) * Math.min(1, dt * 4);
      const t = ctx.currentTime;
      trG.gain.setTargetAtTime(0.07 * rors, t, 0.06);
      trF.frequency.setTargetAtTime(200 + 250 * rors, t, 0.1);

      // Spisen knastrar och stearinet puttrar svagt
      knasterTid -= dt;
      if (knasterTid <= 0) {
        brusstot(ctx, ut, { frekvens: slump(1500, 4200), q: 1.2, styrka: slump(0.012, 0.035), langd: slump(0.001, 0.003) });
        knasterTid = slump(0.12, 1.3);
      }
      puttraTid -= dt;
      if (puttraTid <= 0) {
        bubbla(ctx, ut, slump(100, 170), 0.01);
        ring(0.5 + slump(-0.15, 0.15), tid, 0.12);
        puttraTid = slump(2, 5);
      }

      // Lagom tjockt? Då lyser saxen svagt, men det är hon som bestämmer när det är klart
      if (fas === 'doppa') {
        alfa = Math.min(1, alfa + dt / 1.2);
        let summa = 0, n = 0;
        for (let i = Math.floor(N * 0.1); i < Math.floor(N * 0.95); i++) { summa += data[i * 4] + data[i * 4 + 1]; n += 2; }
        redo = summa / n >= KLAR && ljusDopp >= MINDOPP;
        if (redo && !saxLedVisad && !grepp && botten > YV + 0.05) {
          saxLedVisad = true;
          led.textContent = 'Klipp loss ljuset med saxen';
          led.classList.add('syns');
          setTimeout(() => led.classList.remove('syns'), 6000);
        }
      } else if (fas === 'klar') {
        // Det avklippta ljuset faller en bit och tonar bort, och tänds i fönstret
        fasTid += dt;
        klippFall = 0.05 * mjuk(0, 0.45, fasTid);
        alfa = 1 - mjuk(1.0, 2.4, fasTid);
        if (fasTid > 1.6 && fasTid - dt <= 1.6) {
          const plats = antal % FONSTER_X.length;
          sparaForm(plats);
          const L = fonster[plats];
          L.syns = 1; L.tand = 0;
          antal++;
          try { localStorage.setItem(NYCKEL, String(antal)); } catch {}
          tandFras();
        }
        if (fasTid > 3.2) {
          nollstall();
          fas = 'ny'; fasTid = 0;
          pinne.x = 0.5; pinne.y = vilaY() + 0.25; forraX = pinne.x; forraVx = 0;
          mal.x = 0.5; mal.y = vilaY();
          forraBotten = 9;
        }
      } else if (fas === 'ny') {
        // En ny veke sänks ner på sin plats
        fasTid += dt;
        mal.x = 0.5; mal.y = vilaY();
        alfa = mjuk(0, 1.2, fasTid);
        if (fasTid > 1.4) fas = 'doppa';
      }

      // Saxen: flyger upp och klipper, eller klipper i luften där den ligger
      saxenFlyger(dt);
      if (saxFlykt) {
        // saxenFlyger sköter bladen
      } else if (saxTid >= 0) {
        saxTid += dt;
        saxOppen = saxTid < 0.08 ? 0.06 + (saxTid / 0.08) * 0.44 : Math.max(0.0, 0.5 - ((saxTid - 0.08) / 0.08) * 0.5);
        if (saxTid > 0.6) { saxTid = -1; }
      } else saxOppen += (0.06 - saxOppen) * Math.min(1, dt * 3);
      saxSken += ((redo && fas === 'doppa' ? 1 : 0) - saxSken) * Math.min(1, dt * 1.5);

      // Ljusen i fönstret
      let brinner = 0;
      fonster.forEach((L, i) => {
        if (L.tand >= 0) L.tand += dt;
        fData[i * 4] = L.x;
        fData[i * 4 + 1] = L.hojd;
        fData[i * 4 + 2] = L.tand;
        fData[i * 4 + 3] = L.syns;
        if (L.tand > 0) brinner += Math.min(1, L.tand);
      });

      ringData.fill(0);
      ringar.forEach((g, i) => {
        const alder = tid - g.t0;
        ringData[i * 4] = g.x; ringData[i * 4 + 1] = alder; ringData[i * 4 + 2] = alder < 4 ? g.s : 0;
      });
      drData.fill(0);
      fall.slice(0, 6).forEach((d, i) => { drData[i * 3] = d.x; drData[i * 3 + 1] = d.y; drData[i * 3 + 2] = d.r; });

      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, N, 1, gl.RGBA, gl.FLOAT, data);
      anpassa(gl, duk, 0.75);
      gl.viewport(0, 0, duk.width, duk.height);
      gl.useProgram(prog);
      gl.bindVertexArray(tom);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_synlig, mjuk(0, 2.5, tid));
      gl.uniform4f(u.u_ljus, pinne.x, pinne.y - HALS, LANGD, vinkel);
      gl.uniform3f(u.u_spets, spets, droppe ? droppe.r : 0, droppe ? droppe.varm : 0);
      gl.uniform2f(u.u_snitt, snittX, snittR);
      gl.uniform1f(u.u_alfa, alfa);
      gl.uniform4fv(u.u_ring, ringData);
      gl.uniform3fv(u.u_dr, drData);
      gl.uniform4fv(u.u_fonster, fData);
      gl.uniform1f(u.u_varme, Math.min(1, brinner / 4));
      gl.uniform1f(u.u_rors, rors);
      gl.uniform2f(u.u_sax, saxOppen, saxSken);
      gl.uniform3f(u.u_saxL, saxL.x, saxL.y, saxL.a);
      gl.uniform2f(u.u_klipp, klippDist, klippFall);
      ritaHelskarm(gl);
    });

    return stangning({ ljud: l, stoppa, gl });
  },
};
