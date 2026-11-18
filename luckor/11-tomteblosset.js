// Lucka 11: Tomteblosset
// Ett tomtebloss som brinner i vintermörkret medan snön faller. Hon håller det med
// fingret och ritar i luften, och ljuset lämnar spår som dröjer kvar, som efterbilder
// på näthinnan. Spåren bleknar sakta från vitt över guld och orange till en svag glöd.
// Gnistorna sprakar mjukt och delar sig i små grenar, som på ett riktigt tomtebloss.
//
// Ljusspåren ritas i en bild som aldrig töms, bara bleknar lite för varje bildruta.
// Blått bleknar fortast och rött långsammast, så att spåren svalnar i färg.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { brusKalla, rum } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { mjuk, slump, klamp, rumsLjud, slinga, fingrar, stangning } from '../lib/scen.js';

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
uniform vec4 u_bloss;     // topp x, y, handtag x, y
uniform float u_glod;
uniform float u_synlig;
${BRUS}

float segment(vec2 p, vec2 a, vec2 b, out float h) {
  vec2 pa = p - a, ba = b - a;
  h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  float s = u_res.x;
  vec2 p = gl_FragCoord.xy / s;
  vec2 uv = gl_FragCoord.xy / u_res;
  float H = u_res.y / s;

  // Vintermörker, lite ljusare mot marken där snön ligger
  vec3 c = mix(vec3(0.03, 0.035, 0.06), vec3(0.008, 0.01, 0.02), uv.y);
  float mark = 0.22 + 0.015 * sin(p.x * 5.0 + 1.0) + 0.01 * sin(p.x * 13.0);
  if (p.y < mark) c = vec3(0.07, 0.08, 0.11) * (0.85 + 0.2 * fbm(p * vec2(8.0, 30.0)));
  // Ett avlägset, varmt fönster
  vec2 fo = (p - vec2(0.2, mark + 0.08)) / vec2(0.018, 0.022);
  if (max(abs(fo.x), abs(fo.y)) < 1.0) c = vec3(0.5, 0.3, 0.12) * (abs(fo.x) < 0.08 || abs(fo.y) < 0.08 ? 0.4 : 1.0);
  c += vec3(0.4, 0.22, 0.08) * exp(-dot(p - vec2(0.2, mark + 0.08), p - vec2(0.2, mark + 0.08)) * 300.0) * 0.15;

  // Blossets sken lyser upp omgivningen
  vec2 tp = u_bloss.xy;
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

  // Ståltråden från toppen ner mot handen, grå och upplyst nära glöden
  float h;
  float dt = segment(p, u_bloss.xy, u_bloss.zw, h);
  float trad = smoothstep(0.0028, 0.0012, dt);
  vec3 tradF = mix(vec3(0.85, 0.5, 0.2), vec3(0.22, 0.22, 0.24), smoothstep(0.0, 0.12, h));
  // Den brända delen närmast toppen är mörk och knottrig, sedan den grå satsen
  tradF *= 0.6 + 0.6 * exp(-h * 12.0) * u_glod;
  c = mix(c, tradF, trad);

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
    const vu = platser(gl, visaProg, ['u_spar', 'u_res', 'u_tid', 'u_bloss', 'u_glod', 'u_synlig']);

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
    const H = () => duk.clientHeight / duk.clientWidth;
    const topp = { x: 0.5, y: H() * 0.52 };
    let forraTopp = { ...topp };
    const mal = { ...topp };
    let fart = 0;
    const handtag = { x: 0.62, y: H() * 0.22 };
    let rorTid = 0;

    // Gnistorna: korta, snabba, och ibland delar de sig
    const gnistor = Array.from({ length: GNISTOR }, () => ({ liv: 0 }));
    function spruta(x, y, vx, vy, liv, gren) {
      const g = gnistor.find((q) => q.liv <= 0);
      if (!g) return;
      Object.assign(g, { x, y, px: x, py: y, vx, vy, liv, max: liv, gren, delad: false });
    }

    const tillVarld = (x, y) => [x / duk.clientWidth, (duk.clientHeight - y) / duk.clientWidth];
    fingrar(duk, {
      ner: (x, y) => {
        const [wx, wy] = tillVarld(x, y);
        // Blosset hålls lite ovanför fingret, så att man ser toppen
        mal.x = wx; mal.y = wy + 0.07;
      },
      drag: (x, y) => {
        const [wx, wy] = tillVarld(x, y);
        mal.x = wx; mal.y = wy + 0.07;
      },
    });

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

    // ---------- Ritslinga ----------
    const stoppa = slinga((tid, dt) => {
      const glod = mjuk(0.5, 2.5, tid);
      // Toppen följer fingret mjukt, och svajar lite av sig själv när hon inte rör det
      rorTid += dt;
      const svaj = 0.004 * Math.sin(rorTid * 1.3) + 0.002 * Math.sin(rorTid * 3.1);
      forraTopp = { ...topp };
      const k = Math.min(1, dt * 22);
      topp.x += (mal.x + svaj - topp.x) * k;
      topp.y += (mal.y + svaj * 0.5 - topp.y) * k;
      const steg = Math.hypot(topp.x - forraTopp.x, topp.y - forraTopp.y);
      fart += (steg / Math.max(dt, 1e-3) - fart) * Math.min(1, dt * 8);
      // Handtaget hänger efter, som en hand som håller blosset snett nedåt
      const hx = topp.x + 0.1 + (topp.x - 0.5) * 0.15, hy = topp.y - 0.3;
      handtag.x += (hx - handtag.x) * Math.min(1, dt * 6);
      handtag.y += (hy - handtag.y) * Math.min(1, dt * 6);
      const rx = handtag.x - topp.x, ry = handtag.y - topp.y, rl = Math.hypot(rx, ry) || 1;
      handtag.x = topp.x + (rx / rl) * 0.3; handtag.y = topp.y + (ry / rl) * 0.3;

      // Nya gnistor från toppen, åt alla håll
      const antal = Math.round(slump(3, 7) * glod);
      for (let i = 0; i < antal; i++) {
        const a = Math.random() * Math.PI * 2, v = slump(0.25, 0.75);
        spruta(topp.x, topp.y, Math.cos(a) * v, Math.sin(a) * v, slump(0.08, 0.28), 0);
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
      gl.uniform4f(vu.u_bloss, topp.x, topp.y, handtag.x, handtag.y);
      gl.uniform1f(vu.u_glod, glod * (0.92 + 0.08 * Math.sin(tid * 23) * Math.sin(tid * 7)));
      gl.uniform1f(vu.u_synlig, mjuk(0, 2.5, tid));
      ritaHelskarm(gl);

      // ---------- Ljud ----------
      const t = ctx.currentTime;
      const sving = klamp(fart / 2.5, 0, 1);
      spG.gain.setTargetAtTime(0.08 * glod * (0.75 + 0.25 * Math.random()), t, 0.03);
      frG.gain.setTargetAtTime(0.025 * glod, t, 0.2);
      suG.gain.setTargetAtTime(0.05 * sving, t, 0.08);
      suF.frequency.setTargetAtTime(400 + 600 * sving, t, 0.1);
    });

    return stangning({ ljud: l, stoppa, gl });
  },
};
