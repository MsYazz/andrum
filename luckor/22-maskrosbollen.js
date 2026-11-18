// Lucka 22: Maskrosbollen
// En minnesbild från sommaren: en maskrosboll i kvällssolen över en äng. Hon sveper
// med fingret förbi bollen, som en pust, och fröna lossnar och seglar iväg på sina små
// fallskärmar. De driver med vinden, stiger sakta och försvinner bort i ljuset.
// Ett tryck på bollen lossar några få. När nästan alla har flugit växer en ny boll
// fram, långsamt.
//
// Fröna sitter på ett klot och ritas som små ytor, var och en med sin skärm av
// fina trådar. Bakgrunden är en egen helskärmsyta.

import { skapaGL, program, platser, anpassa, HELSKARM, ritaHelskarm, utanGL } from '../lib/gl.js';
import { brusKalla } from '../lib/ljud.js';
import { BRUS } from '../lib/glsl.js';
import { mjuk, slump, klamp, rumsLjud, slinga, fingrar, stangning } from '../lib/scen.js';
import { skapaVind } from '../lib/vind.js';

const FRON = 170;

const BAK_FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform float u_tid;
uniform vec3 u_huvud;      // bollens mitt x, y och radie
uniform float u_kvar;      // hur mycket av bollen som finns kvar (fäste synligt annars)
uniform float u_synlig;
${BRUS}

float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  float s = u_res.x;
  vec2 p = gl_FragCoord.xy / s;
  vec2 uv = gl_FragCoord.xy / u_res;
  float H = u_res.y / s;

  // Kvällshimmel: varmt guld nertill, rosa och sedan ljust blått upptill
  vec3 c = mix(vec3(1.0, 0.74, 0.42), vec3(0.95, 0.6, 0.55), smoothstep(0.15, 0.55, uv.y));
  c = mix(c, vec3(0.52, 0.6, 0.78), smoothstep(0.5, 1.0, uv.y));
  // Solen lågt till vänster, med ett mjukt sken
  vec2 sol = vec2(0.22, H * 0.3);
  float ds = length(p - sol);
  c += vec3(1.0, 0.85, 0.55) * (exp(-ds * ds * 8.0) * 0.45 + smoothstep(0.06, 0.05, ds) * 0.5);
  // Oskarpa ljusprickar, som solljus genom gräs långt bort
  for (int i = 0; i < 2; i++) {
    vec2 g = p * (5.0 + float(i) * 3.0) + vec2(u_tid * 0.01 * float(i + 1), 0.0);
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5 - (hash2(id + float(i) * 7.0) - 0.5) * 0.5;
    float r = hash(id + 11.0 + float(i));
    if (r > 0.6) {
      float sz = 0.18 + 0.15 * hash(id + 3.0);
      float b = smoothstep(sz, sz * 0.85, length(f));
      c += vec3(1.0, 0.9, 0.7) * b * 0.06 * (1.0 - uv.y) * (1.5 - float(i));
    }
  }
  // Maskrosens stjälk, lite böjd, och fästet där fröna sitter
  vec2 m = u_huvud.xy;
  vec2 b0 = vec2(0.5 + 0.03, -0.02);
  float dst = 1e3;
  vec2 forra = b0;
  for (int i = 1; i <= 8; i++) {
    float t = float(i) / 8.0;
    vec2 q = mix(b0, m, t) + vec2(sin(t * 3.14159) * 0.04, 0.0);
    dst = min(dst, segment(p, forra, q));
    forra = q;
  }
  c = mix(c, vec3(0.3, 0.33, 0.12), smoothstep(0.0055, 0.0035, dst));
  c += vec3(1.0, 0.8, 0.4) * smoothstep(0.006, 0.004, dst) * smoothstep(0.003, 0.005, dst) * 0.15;
  float fd = length((p - m) * vec2(1.0, 1.2));
  c = mix(c, vec3(0.45, 0.38, 0.2), smoothstep(0.028, 0.022, fd));

  // Ängen: tätt gräs i motljus, oskarpt längst bort och skarpare närmast.
  // Det ritas efter stjälken, så att maskrosen står i gräset.
  float ang = H * 0.2 + 0.025 * fbm(vec2(p.x * 3.0, 0.0));
  if (p.y < ang) {
    float djup = clamp((ang - p.y) / ang, 0.0, 1.0);
    vec3 gras = mix(vec3(0.62, 0.52, 0.24), vec3(0.24, 0.2, 0.08), pow(djup, 0.7));
    gras *= 0.85 + 0.3 * fbm(vec2(p.x * 90.0, p.y * 6.0));
    gras += vec3(0.5, 0.35, 0.12) * pow(1.0 - djup, 3.0) * 0.3;
    c = mix(c, gras, smoothstep(ang, ang - 0.03, p.y));
  }
  for (int i = 0; i < 3; i++) {
    float t2 = float(i);
    float x = p.x * (55.0 + t2 * 25.0) + t2 * 0.31;
    float id = floor(x);
    float fx = fract(x) - 0.5;
    float hgt = (0.05 + 0.08 * hash(vec2(id, t2))) * (1.0 + t2 * 0.45);
    float bas = ang - 0.02 - t2 * 0.07;
    float yy = (p.y - bas) / hgt;
    float bojd = (sin(u_tid * 0.8 + id * 0.3) * 0.15 + (hash(vec2(id, 5.0 + t2)) - 0.5) * 0.6) * yy * yy;
    if (yy > 0.0 && yy < 1.0 && abs(fx - bojd) < 0.1 * (1.0 - yy)) {
      vec3 stra = mix(vec3(0.45, 0.38, 0.16), vec3(0.2, 0.17, 0.07), t2 / 2.0);
      stra += vec3(1.0, 0.75, 0.35) * smoothstep(0.03, 0.0, abs(fx - bojd - 0.07 * (1.0 - yy))) * 0.2;
      c = mix(c, stra, 0.9);
    }
  }

  c *= 1.0 - 0.2 * pow(length(uv - 0.5) * 1.3, 2.5);
  c *= u_synlig;
  frag = vec4(dither(c, gl_FragCoord.xy, u_tid), 1.0);
}`;

// Ett frö: en skärm av fina trådar och ett skaft ner till fröet
const FRO_VS = `#version 300 es
precision highp float;
in vec4 a_pos;      // skärmens mitt x, y, skaftets fot x, y
in vec4 a_form;     // riktning (vinkel), plathet, storlek, ljus
uniform float u_H;
uniform int u_typ;  // 0 skaft, 1 skärm
out vec2 v_lok;
out vec4 v_form;
out float v_len;
void main() {
  vec2 h = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  vec2 p;
  v_form = a_form;
  if (a_form.w <= 0.0) { gl_Position = vec4(2.0, 2.0, 0.0, 1.0); return; }
  if (u_typ == 1) {
    float r = a_form.z * 1.1;
    float an = a_form.x;
    vec2 u = vec2(cos(an), sin(an)), v = vec2(-u.y, u.x);
    p = a_pos.xy + (u * h.x + v * h.y) * r;
    v_lok = h * 1.1;
    v_len = 0.0;
  } else {
    vec2 a = a_pos.zw, b = a_pos.xy;
    vec2 dir = b - a;
    float len = length(dir);
    vec2 t = len > 1e-6 ? dir / len : vec2(0.0, 1.0);
    vec2 n = vec2(-t.y, t.x);
    float w = 0.0035;
    float langs = (h.x * 0.5 + 0.5) * len + h.x * w;
    p = a + t * langs + n * h.y * w;
    v_lok = vec2(langs, h.y * w);
    v_len = len;
  }
  gl_Position = vec4(p.x * 2.0 - 1.0, p.y / u_H * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRO_FS = `#version 300 es
precision highp float;
precision highp int;
in vec2 v_lok;
in vec4 v_form;
in float v_len;
out vec4 frag;
uniform int u_typ;
uniform float u_synlig;
void main() {
  float ljus = v_form.w;
  if (u_typ == 1) {
    // Skärmen: ses rakt framifrån som en stjärna av trådar, från sidan som en solfjäder
    vec2 q = vec2(v_lok.x / max(v_form.y, 0.18), v_lok.y);
    float r = length(q);
    if (r > 1.05) discard;
    float th = atan(q.y, q.x);
    float N = 22.0;
    float d = abs(fract(th * N / 6.2832) - 0.5) * (6.2832 / N) * r;
    float trad = smoothstep(0.045, 0.0, d) * smoothstep(1.0, 0.75, r) * smoothstep(0.05, 0.25, r);
    float spets = smoothstep(0.08, 0.0, abs(r - 0.93)) * smoothstep(0.1, 0.0, d) * 0.6;
    float dis = smoothstep(1.0, 0.2, r) * 0.03;
    float a = clamp((trad * 0.55 + spets * 0.8 + dis) * ljus, 0.0, 1.0);
    // Motljus: ljust, nästan vitt, med en varm kant
    vec3 farg = mix(vec3(1.0, 0.97, 0.9), vec3(1.0, 0.85, 0.6), smoothstep(0.4, 1.0, r));
    frag = vec4(farg * a * u_synlig, a * u_synlig);
  } else {
    float dx = max(0.0, max(-v_lok.x, v_lok.x - v_len));
    float d = length(vec2(dx, v_lok.y));
    // Ett tunt skaft, och fröet längst ner som en liten mörkare tjocklek
    float skaft = smoothstep(0.0017, 0.0006, d);
    float fro = smoothstep(0.0028, 0.0016, length(vec2(max(0.0, v_lok.x - 0.008) + min(0.0, v_lok.x), v_lok.y * 1.0))) * step(v_lok.x, 0.012);
    vec3 farg = mix(vec3(0.95, 0.9, 0.8), vec3(0.45, 0.35, 0.22), fro);
    float a = clamp(max(skaft * 0.7, fro * 0.9) * ljus, 0.0, 1.0);
    frag = vec4(farg * a * u_synlig, a * u_synlig);
  }
}`;

export default {
  start(duk, scen) {
    const gl = skapaGL(duk);
    if (!gl) return utanGL(scen);
    const bak = program(gl, HELSKARM, BAK_FS);
    const bu = platser(gl, bak, ['u_res', 'u_tid', 'u_huvud', 'u_kvar', 'u_synlig']);
    const froProg = program(gl, FRO_VS, FRO_FS);
    const fu = platser(gl, froProg, ['u_H', 'u_typ', 'u_synlig']);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const data = new Float32Array(FRON * 8);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
    const aPos = gl.getAttribLocation(froProg, 'a_pos'), aForm = gl.getAttribLocation(froProg, 'a_form');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 4, gl.FLOAT, false, 32, 0);
    gl.vertexAttribDivisor(aPos, 1);
    gl.enableVertexAttribArray(aForm);
    gl.vertexAttribPointer(aForm, 4, gl.FLOAT, false, 32, 16);
    gl.vertexAttribDivisor(aForm, 1);
    const tom = gl.createVertexArray();

    // ---------- Bollen ----------
    const H = () => duk.clientHeight / duk.clientWidth;
    const R = 0.16;
    const huvud = { x: 0.5, y: H() * 0.55 };
    // Fröna jämnt fördelade över ett klot (Fibonacci-spiral)
    const fron = Array.from({ length: FRON }, (_, i) => {
      const y = 1 - (i / (FRON - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const a = i * 2.39996;
      return {
        d: [Math.cos(a) * r, y, Math.sin(a) * r],
        fast: true, ljus: 1, x: 0, y: 0, vx: 0, vy: 0, vinkel: 0, snurr: 0, storlek: slump(0.03, 0.04),
      };
    });
    let vaxer = false;      // en ny boll växer fram
    let stilla = 0;         // tid sedan hon rörde bollen
    let sving = 0;          // bollens svaj

    function lossa(f, vx, vy) {
      f.fast = false;
      const [sx, sy] = skarm(f);
      f.x = sx; f.y = sy;
      f.vx = vx; f.vy = vy;
      f.vinkel = Math.atan2(f.d[1], f.d[0]);
      f.snurr = slump(-0.6, 0.6);
      f.liv = 0;
      f.borta = false;
    }
    const skarm = (f) => [huvud.x + sving * 0.02 + f.d[0] * R, huvud.y + f.d[1] * R];

    // ---------- Fingret ----------
    let forra = null;
    let pust = 0;
    const tillVarld = (x, y) => [x / duk.clientWidth, (duk.clientHeight - y) / duk.clientWidth];
    fingrar(duk, {
      ner: (x, y, id, e) => { const [wx, wy] = tillVarld(x, y); forra = { x: wx, y: wy, t: e.timeStamp }; stilla = 0; },
      drag: (x, y, id, e) => {
        const [wx, wy] = tillVarld(x, y);
        if (forra) {
          const dtt = Math.max(0.008, (e.timeStamp - forra.t) / 1000);
          const vx = (wx - forra.x) / dtt, vy = (wy - forra.y) / dtt;
          const fart = Math.hypot(vx, vy);
          stilla = 0;
          // Fröna nära fingrets väg lossnar, fler ju fortare svepet går
          const sannolikhet = klamp((fart - 0.3) * 0.35, 0, 0.9);
          if (sannolikhet > 0) {
            for (const f of fron) {
              if (!f.fast) continue;
              const [sx, sy] = skarm(f);
              const dd = Math.hypot(sx - wx, sy - wy);
              if (dd < 0.12 && Math.random() < sannolikhet * (1 - dd / 0.12) * (0.6 + 0.4 * Math.max(0, f.d[2] + 0.3))) {
                lossa(f, vx * 0.12 + f.d[0] * 0.08, vy * 0.12 + f.d[1] * 0.08 + 0.03);
              }
            }
            pust = Math.min(1, pust + fart * 0.05);
          }
          sving += vx * 0.004;
        }
        forra = { x: wx, y: wy, t: e.timeStamp };
      },
      upp: (x, y, id, { tryck }) => {
        forra = null;
        if (!tryck) return;
        // Ett tryck på bollen lossar några få frön
        const [wx, wy] = tillVarld(x, y);
        if (Math.hypot(wx - huvud.x, wy - huvud.y) < R * 1.3) {
          let n = 0;
          for (const f of fron) {
            if (f.fast && Math.random() < 0.08 && n < 6) { lossa(f, f.d[0] * 0.08, f.d[1] * 0.06 + 0.04); n++; }
          }
          pust = Math.min(1, pust + 0.25);
        }
      },
    });

    // ---------- Ljud ----------
    const l = rumsLjud(1.4, 2);
    const { ctx, ut } = l;
    const vind = skapaVind(ctx, ut, { styrka: 0.35, ljus: 0.3 });
    l.kallor.push(...vind.kallor);
    // Pusten: ett mjukt luftljud när fröna blåser iväg
    const luft = brusKalla('rosa');
    const luF = ctx.createBiquadFilter(); luF.type = 'bandpass'; luF.frequency.value = 900; luF.Q.value = 0.6;
    const luG = ctx.createGain(); luG.gain.value = 0;
    luft.connect(luF).connect(luG).connect(ut);
    // En varm, svag sommarton i bakgrunden
    const ton = ctx.createGain(); ton.gain.value = 0;
    [220, 330, 440.5].forEach((f, i) => {
      const o = ctx.createOscillator(); o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = [0.5, 0.3, 0.12][i];
      o.connect(g).connect(ton); o.start(); l.kallor.push(o);
    });
    const tonF = ctx.createBiquadFilter(); tonF.type = 'lowpass'; tonF.frequency.value = 600;
    ton.connect(tonF).connect(ut);
    ton.gain.setTargetAtTime(0.012, ctx.currentTime + 1, 3);
    l.kallor.push(luft);

    // ---------- Vinden ----------
    // En mjuk bris åt höger och uppåt, med virvlar som fröna dansar i
    function vindVid(x, y, t) {
      const a = Math.sin(x * 5 + t * 0.4) * Math.cos(y * 4 - t * 0.3);
      const b = Math.cos(x * 3 - t * 0.25 + y * 2);
      return [0.05 + 0.03 * a + 0.02 * Math.sin(t * 0.13), 0.02 + 0.025 * b];
    }

    // ---------- Ritslinga ----------
    const ordning = fron.map((_, i) => i);
    const stoppa = slinga((tid, dt) => {
      stilla += dt;
      sving += (-sving * 2.5) * dt;
      sving += Math.sin(tid * 0.7) * 0.002 * dt * 60 * 0.05;
      pust *= Math.exp(-dt * 2);
      const kvar = fron.filter((f) => f.fast).length;
      // En ny boll växer fram när nästan alla flugit och hon har låtit den vara en stund
      if (kvar < 12 && stilla > 5) vaxer = true;
      if (kvar === FRON || stilla < 1) vaxer = false;
      // Frön som har flugit bort kommer tillbaka som en ny boll, och tonar fram sakta
      if (vaxer) for (const f of fron) if (!f.fast && f.borta) { f.fast = true; f.ljus = 0; }

      let n = 0;
      // Bollens frön sorteras bakifrån och fram, de flygande ritas sist
      ordning.sort((a, b) => (fron[a].fast ? fron[a].d[2] : 9) - (fron[b].fast ? fron[b].d[2] : 9));
      for (const i of ordning) {
        const f = fron[i];
        if (f.fast) {
          if (f.ljus < 1) f.ljus = Math.min(1, f.ljus + dt / 4);
          const [sx, sy] = skarm(f);
          const djup = f.d[2];
          const ljus = f.ljus * (0.55 + 0.45 * (djup * 0.5 + 0.5));
          data.set([sx, sy, huvud.x + sving * 0.02 + f.d[0] * 0.02, huvud.y + f.d[1] * 0.02,
            Math.atan2(f.d[1], f.d[0]), klamp(Math.abs(djup), 0.22, 1), f.storlek * (0.9 + 0.1 * djup), ljus], n * 8);
        } else {
          f.liv += dt;
          const [wx, wy] = vindVid(f.x, f.y, tid);
          f.vx += (wx - f.vx) * dt * 0.9;
          f.vy += (wy + 0.012 - f.vy) * dt * 0.9;
          f.x += f.vx * dt; f.y += f.vy * dt;
          // Skärmen vänder sig uppåt i luften och vickar lite
          const mal = Math.PI / 2 + Math.sin(f.liv * 1.3 + i) * 0.25 + f.vx * 1.5;
          f.vinkel += (mal - f.vinkel) * Math.min(1, dt * 1.5);
          f.borta = f.x > 1.15 || f.x < -0.15 || f.y > H() + 0.15 || f.liv > 14;
          const ljus = f.borta ? 0 : mjuk(14, 8, f.liv) * 0.95;
          const ux = Math.cos(f.vinkel), uy = Math.sin(f.vinkel);
          const skaft = f.storlek * 1.1;
          data.set([f.x, f.y, f.x - ux * skaft, f.y - uy * skaft, f.vinkel, 0.4, f.storlek * 0.9, ljus], n * 8);
        }
        n++;
      }

      anpassa(gl, duk, 0.75);
      gl.viewport(0, 0, duk.width, duk.height);
      gl.useProgram(bak);
      gl.bindVertexArray(tom);
      gl.uniform2f(bu.u_res, duk.width, duk.height);
      gl.uniform1f(bu.u_tid, tid);
      gl.uniform3f(bu.u_huvud, huvud.x + sving * 0.02, huvud.y, R);
      gl.uniform1f(bu.u_kvar, kvar / FRON);
      const synlig = mjuk(0, 2.5, tid);
      gl.uniform1f(bu.u_synlig, synlig);
      ritaHelskarm(gl);

      gl.useProgram(froProg);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
      gl.uniform1f(fu.u_H, duk.clientHeight / duk.clientWidth);
      gl.uniform1f(fu.u_synlig, synlig);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1i(fu.u_typ, 0);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, FRON);
      gl.uniform1i(fu.u_typ, 1);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, FRON);
      gl.disable(gl.BLEND);

      // Ljud
      const t = ctx.currentTime;
      luG.gain.setTargetAtTime(0.07 * pust, t, 0.08);
      luF.frequency.setTargetAtTime(600 + 900 * pust, t, 0.1);
      vind.uppdatera(dt, pust * 0.5);
    });

    return stangning({ ljud: l, stoppa, gl });
  },
};
