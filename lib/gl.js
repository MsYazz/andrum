// Gemensamma WebGL2-hjälpare. Varje lucka ritar en helskärmsyta med en egen fragment-shader.

export function skapaGL(duk) {
  return duk.getContext('webgl2', {
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
  });
}

// En triangel som täcker hela skärmen, utan vertexdata.
export const HELSKARM = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export function program(gl, vs, fs) {
  const kompilera = (typ, kod) => {
    const s = gl.createShader(typ);
    gl.shaderSource(s, kod);
    gl.compileShader(s);
    return s;
  };
  const p = gl.createProgram();
  const v = kompilera(gl.VERTEX_SHADER, vs);
  const f = kompilera(gl.FRAGMENT_SHADER, fs);
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getShaderInfoLog(f) || gl.getShaderInfoLog(v) || gl.getProgramInfoLog(p));
  }
  gl.useProgram(p);
  gl.bindVertexArray(gl.createVertexArray());
  // Rita en gång i en enda pixel och vänta in den. Safari bygger annars shadern först
  // vid första riktiga bilden, och då hinner ljudet börja långt innan bilden syns.
  gl.viewport(0, 0, 1, 1);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  return p;
}

export function platser(gl, p, namn) {
  const u = {};
  for (const n of namn) u[n] = gl.getUniformLocation(p, n);
  return u;
}

// Anpassar ritytans upplösning. skala < 1 ritar i lägre upplösning (bra för mjuka motiv).
export function anpassa(gl, duk, skala = 1) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2) * skala;
  const b = Math.max(1, Math.round(duk.clientWidth * dpr));
  const h = Math.max(1, Math.round(duk.clientHeight * dpr));
  if (duk.width !== b || duk.height !== h) {
    duk.width = b;
    duk.height = h;
    gl.viewport(0, 0, b, h);
  }
  return dpr;
}

export function ritaHelskarm(gl) {
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

export function slappGL(gl) {
  try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch {}
}

// Visas om telefonen saknar WebGL2.
export function utanGL(scen) {
  const m = document.createElement('p');
  m.className = 'lucka-ui meddelande';
  m.textContent = 'Den här luckan behöver en nyare version av iOS för att visas.';
  scen.append(m);
  return async () => {};
}
