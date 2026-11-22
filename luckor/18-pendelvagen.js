// Lucka 18: Pendelvågen
// Femton pendlar sedda rakt uppifrån, med blanka mässingskulor över ett mörkt bord.
// Längderna är valda så att pendel nummer i svänger 30 + i gånger på 90 sekunder, så
// alla är i takt igen efter en och en halv minut. Däremellan glider kulorna ut i ormar,
// vågor och spiraler. Varje kula spelar en mjuk ton och lyser till när den passerar
// mittlinjen på väg uppåt, så att melodin följer mönstret man ser.
// Ett tryck samlar pendlarna och släpper dem i takt igen. Håller hon fingret stilla
// saktar tiden in nästan till stillhet, så att hon kan stanna vid en form, och när hon
// släpper fortsätter allt där det var. Drar hon fingret tvärs över pendlarna spelar
// varje kula sin ton, som strängarna på en harpa. Ett svep upp eller ner knuffar till
// dem, men knuffarna läker: varje pendel glider sakta tillbaka in i mönstret.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { brusKalla, rum } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { mjuk, klamp, rumsLjud, slinga, fingrar, stangning, klang } from '../lib/scen.js';

const N = 15;
const CYKEL = 90;          // sekunder tills alla är i takt igen
const VARV0 = 30;          // svängningar under en cykel för den längsta pendeln
const AMP = 0.3;           // största utslag, i skärmbredder

// Moll-pentatonisk skala, från dov till ljus
const TONER = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 392.0, 440.0, 523.25, 587.33, 698.46, 783.99, 880.0, 1046.5];

const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform vec4 u_kula[${N}];   // x, y (skärmbredder, y uppåt), radie, glöd när den spelar
uniform float u_mitt;        // upphängningens linje
uniform float u_tid;
uniform float u_synlig;
${BRUS}

float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  float s = u_res.x;
  vec2 p = gl_FragCoord.xy / s;
  vec2 uv = gl_FragCoord.xy / u_res;

  // Bordet under: mörkt trä i en ljuskägla
  float ad = fbm(vec2(p.x * 3.0, p.y * 28.0)) * 0.7 + brus(vec2(p.x * 10.0, p.y * 90.0)) * 0.3;
  vec3 c = mix(vec3(0.08, 0.05, 0.035), vec3(0.18, 0.11, 0.06), ad);
  float lampa = exp(-dot(uv - vec2(0.5, 0.5), uv - vec2(0.5, 0.5)) * 3.0);
  c *= 0.35 + 0.9 * lampa;

  // Skuggor under kulorna, lite förskjutna
  for (int i = 0; i < ${N}; i++) {
    vec4 k = u_kula[i];
    float d = length(p - k.xy - vec2(0.01, -0.016));
    c *= 1.0 - 0.45 * smoothstep(k.z * 1.5, k.z * 0.6, d);
  }
  // Snörena upp mot upphängningen
  for (int i = 0; i < ${N}; i++) {
    vec4 k = u_kula[i];
    float d = segment(p, k.xy, vec2(k.x, u_mitt));
    c = mix(c, vec3(0.75, 0.7, 0.6), smoothstep(0.0022, 0.0008, d) * 0.5);
  }
  // Upphängningens stång, som en svag skugga tvärs över. Det är här tonerna spelas.
  c *= 1.0 - 0.25 * smoothstep(0.012, 0.0, abs(p.y - u_mitt));
  c += vec3(0.6, 0.45, 0.25) * smoothstep(0.003, 0.0, abs(p.y - u_mitt)) * 0.12;
  // Ett varmt sken runt kulor som just spelat
  for (int i = 0; i < ${N}; i++) {
    vec4 k = u_kula[i];
    float d = length(p - k.xy);
    c += vec3(1.0, 0.75, 0.4) * exp(-d * d / (k.z * k.z * 6.0)) * k.w * 0.35;
  }

  // Kulorna: blank mässing med en ljuspunkt och reflex från bordet
  for (int i = 0; i < ${N}; i++) {
    vec4 k = u_kula[i];
    vec2 d = (p - k.xy) / k.z;
    float r2 = dot(d, d);
    if (r2 < 1.0) {
      vec3 n = vec3(d, sqrt(1.0 - r2));
      vec3 L = normalize(vec3(-0.3, 0.4, 0.85));
      float lj = max(dot(n, L), 0.0);
      float glans = pow(max(dot(reflect(-L, n), vec3(0, 0, 1)), 0.0), 40.0);
      vec3 massing = mix(vec3(0.35, 0.22, 0.08), vec3(0.85, 0.64, 0.32), lj);
      massing += vec3(1.0, 0.95, 0.85) * glans * 0.9;
      massing += vec3(0.3, 0.18, 0.08) * pow(1.0 - n.z, 3.0) * 0.5;
      massing += vec3(1.0, 0.8, 0.5) * k.w * 0.35;
      c = mix(c, massing * (0.6 + 0.5 * lampa), smoothstep(1.0, 0.92, r2));
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
    const u = platser(gl, prog, ['u_res', 'u_kula', 'u_mitt', 'u_tid', 'u_synlig']);

    // ---------- Pendlarna ----------
    // Varje pendel är en svängning med egen vinkelhastighet. Utslaget kan knuffas.
    const pendlar = Array.from({ length: N }, (_, i) => ({
      w: (2 * Math.PI * (VARV0 + i)) / CYKEL,
      fas: 0,
      amp: AMP,
      senast: 0,
      knuff: 0,
    }));
    let start = 0;
    let samlar = 0;
    // Pendlarnas egen klocka, som kan sakta in när hon håller fingret stilla
    let ptid = 0, tidFart = 1;
    // Läget i svängningen som alla pendlar hör hemma i, och som knuffar läker tillbaka till
    let basFas = 0;

    // ---------- Ljud ----------
    const l = rumsLjud(1.2, 1.5);
    const { ctx, ut } = l;
    const eko = rum(3);
    const ekoUt = ctx.createGain(); ekoUt.gain.value = 0.4;
    eko.connect(ekoUt).connect(ut);
    const rumston = brusKalla('rosa');
    const rF = ctx.createBiquadFilter(); rF.type = 'lowpass'; rF.frequency.value = 160;
    const rG = ctx.createGain(); rG.gain.value = 0.025;
    rumston.connect(rF).connect(rG).connect(ut);
    l.kallor.push(rumston);
    // En mjuk ton som en liten klocka av trä och metall
    const tonDelar = [[1, 1, 1.4], [2.0, 0.25, 0.6], [3.98, 0.06, 0.25]];
    function ton(i, styrka) {
      klang(ctx, ut, TONER[i], tonDelar, { styrka: 0.018 * styrka, ansats: 0.004, eko });
    }

    // ---------- Fingret ----------
    const tillVarld = (x, y) => [x / duk.clientWidth, (duk.clientHeight - y) / duk.clientWidth];
    let forra = null;
    // Håller hon fingret ungefär stilla en halv sekund saktar tiden in. Fingret får darra.
    const hall = { nere: false, x: 0, y: 0, t: 0, sveper: false };
    const kolumn = (i) => 0.12 + (i / (N - 1)) * 0.76;
    const senastHarpa = new Array(N).fill(0);
    fingrar(duk, {
      ner: (x, y) => {
        forra = tillVarld(x, y);
        Object.assign(hall, { nere: true, x, y, t: performance.now(), sveper: false });
      },
      drag: (x, y) => {
        const [wx, wy] = tillVarld(x, y);
        if (Math.hypot(x - hall.x, y - hall.y) > 28) hall.sveper = true;
        if (forra) {
          const dy = wy - forra[1];
          for (let i = 0; i < N; i++) {
            const px = kolumn(i);
            // Harpan: passerar fingret en pendel i sidled spelar kulan sin ton
            if ((forra[0] - px) * (wx - px) < 0 && hall.sveper) {
              const nu = performance.now();
              if (nu - senastHarpa[i] > 120) {
                senastHarpa[i] = nu;
                ton(N - 1 - i, 0.75);
                pendlar[i].glod = 1;
                pendlar[i].amp = Math.min(AMP * 1.15, pendlar[i].amp + 0.006);
              }
            }
            // Ett svep upp eller ner förbi en pendel knuffar till den
            if (Math.abs(px - wx) < 0.03) pendlar[i].knuff += dy * 6;
          }
        }
        forra = [wx, wy];
      },
      upp: (x, y, id, { tryck }) => {
        forra = null;
        hall.nere = false;
        if (tryck) samlar = 1;
      },
    }, { ett: true });

    // ---------- Ritslinga ----------
    const data = new Float32Array(N * 4);
    const stoppa = slinga((tid, dt) => {
      const H = duk.clientHeight / duk.clientWidth;
      const mitt = H * 0.5;
      // Tiden saktar in när hon håller fingret stilla, och kommer långsamt igång igen
      const haller = hall.nere && !hall.sveper && performance.now() - hall.t > 500;
      tidFart += ((haller ? 0.03 : 1) - tidFart) * Math.min(1, dt * (haller ? 1.6 : 0.7));
      ptid += dt * tidFart;
      // Att samla: alla glider mjukt till ytterläget och släpps i takt
      if (samlar > 0) {
        samlar -= dt * 0.8;
        for (const q of pendlar) {
          q.amp += (AMP - q.amp) * Math.min(1, dt * 3);
          const mal = Math.PI / 2;
          const nu = ((q.w * (ptid - start) + q.fas) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          let diff = mal - nu;
          if (diff > Math.PI) diff -= Math.PI * 2;
          if (diff < -Math.PI) diff += Math.PI * 2;
          q.fas += diff * Math.min(1, dt * 3);
        }
        if (samlar <= 0) {
          start = ptid;
          basFas = Math.PI / 2;
          for (const q of pendlar) q.fas = basFas;
        }
      }
      pendlar.forEach((q, i) => {
        // Knuffar ändrar utslaget, och allt klingar av mycket långsamt
        if (q.knuff) {
          q.amp = klamp(q.amp + Math.abs(q.knuff) * 0.08, 0.05, AMP * 1.2);
          q.fas += q.knuff * 0.5;
          q.knuff = 0;
        }
        // Knuffarna läker: läget i svängningen och utslaget glider sakta tillbaka in i
        // mönstret, så att ordningen alltid återvänder av sig själv
        if (samlar <= 0) {
          let skillnad = basFas - q.fas;
          skillnad = Math.atan2(Math.sin(skillnad), Math.cos(skillnad));
          q.fas += skillnad * Math.min(1, dt / 12);
          q.amp += (AMP - q.amp) * Math.min(1, dt / 15);
        }
        const vinkel = q.w * (ptid - start) + q.fas;
        const y = Math.sin(vinkel);
        // En ton varje gång kulan passerar mittlinjen på väg uppåt, och då lyser den till.
        // Räknas i hela varv, så att ingen passage missas mellan två bildrutor.
        const varv = Math.floor(vinkel / (Math.PI * 2));
        if (varv > q.senast && tid > 1 && samlar <= 0) {
          ton(N - 1 - i, mjuk(0.05, AMP, q.amp));
          q.glod = 1;
        }
        q.senast = varv;
        q.glod = (q.glod || 0) * Math.exp(-dt * 3);
        data.set([0.12 + (i / (N - 1)) * 0.76, mitt + y * q.amp, 0.024, q.glod], i * 4);
      });

      anpassa(gl, duk, 0.75);
      gl.uniform2f(u.u_res, duk.width, duk.height);
      gl.uniform4fv(u.u_kula, data);
      gl.uniform1f(u.u_mitt, mitt);
      gl.uniform1f(u.u_tid, tid);
      gl.uniform1f(u.u_synlig, mjuk(0, 2.5, tid));
      ritaHelskarm(gl);
    });

    return stangning({ ljud: l, stoppa, gl });
  },
};
