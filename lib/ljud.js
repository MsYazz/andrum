// Gemensam ljudmotor. Allt ljud skapas i koden, det finns inga ljudfiler.

let ctx = null;
let master = null;
const buffertar = {};

// Måste anropas inne i en tryckning första gången (krav i iOS).
export function ljud() {
  if (!ctx) {
    // Låt ljudet höras även när iPhone står på ljudlöst läge.
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 1;
    // Mjuk begränsare så att inget någonsin blir skarpt.
    const komp = ctx.createDynamicsCompressor();
    komp.threshold.value = -20;
    komp.knee.value = 14;
    komp.ratio.value = 3;
    komp.attack.value = 0.05;
    komp.release.value = 0.5;
    master.connect(komp).connect(ctx.destination);
  }
  if (ctx.state !== 'running') ctx.resume();
  return { ctx, master };
}

export function vaknaLjud() {
  if (ctx && ctx.state !== 'running') ctx.resume();
}

export const sov = (ms) => new Promise((r) => setTimeout(r, ms));

function rosaBuffer(sek = 6) {
  const n = Math.floor(ctx.sampleRate * sek);
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
  }
  return b;
}

// Glest knaster, låter som sandkorn som gnids mot varandra.
function kornBuffer(sek = 4) {
  const n = Math.floor(ctx.sampleRate * sek);
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  let e = 0;
  for (let i = 0; i < n; i++) {
    if (Math.random() < 0.05) e = Math.random() * 2 - 1;
    else e *= 0.62;
    d[i] = e * 0.75 + (Math.random() * 2 - 1) * 0.12;
  }
  return b;
}

export function brusKalla(typ = 'rosa') {
  if (!buffertar[typ]) buffertar[typ] = typ === 'korn' ? kornBuffer() : rosaBuffer();
  const s = ctx.createBufferSource();
  s.buffer = buffertar[typ];
  s.loop = true;
  // Starta på olika ställen så att två källor inte låter likadant.
  s.loopStart = 0;
  s.start(0, Math.random() * s.buffer.duration);
  return s;
}

// Ett enkelt rum (efterklang) byggt av avklingande brus.
export function rum(sek = 3.5) {
  const n = Math.floor(ctx.sampleRate * sek);
  const b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let k = 0; k < 2; k++) {
    const d = b.getChannelData(k);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.4);
  }
  const c = ctx.createConvolver();
  c.buffer = b;
  return c;
}

// En mjuk, dov duns, som när trä trycks mot trä.
export function duns() {
  const { ctx, master } = ljud();
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.25);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.12, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.5);
}

// En mjuk klocka med långsam ansats, så att den aldrig överraskar.
export function klocka(f, { till, eko, styrka = 0.05, ansats = 0.3, langd = 6, nar } = {}) {
  const t = nar ?? ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(styrka, t + ansats);
  g.gain.exponentialRampToValueAtTime(0.0001, t + langd);
  const delar = [[1, 1], [2, 0.3], [2.76, 0.12], [5.4, 0.04]];
  for (const [k, a] of delar) {
    const o = ctx.createOscillator();
    o.frequency.value = f * k;
    const og = ctx.createGain();
    og.gain.value = a;
    o.connect(og).connect(g);
    o.start(t);
    o.stop(t + langd + 0.2);
  }
  g.connect(till);
  if (eko) g.connect(eko);
}
