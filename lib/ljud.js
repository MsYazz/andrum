// Gemensam ljudmotor. Allt ljud skapas i koden, det finns inga ljudfiler.

// Ett ogiltigt värde (NaN eller oändligt) till en ljudparameter kastar annars ett fel,
// och ett fel mitt i ett rums ritslinga får bilden att stanna. Sådana värden ignoreras
// därför här, så att ett räknefel aldrig kan frysa ett rum eller ge konstiga ljud.
if (typeof AudioParam !== 'undefined' && !AudioParam.prototype.__andrumSkyddad) {
  const P = AudioParam.prototype;
  const skydda = (namn, positiv) => {
    const orig = P[namn];
    if (typeof orig !== 'function') return;
    P[namn] = function (...a) {
      for (const v of a) if (typeof v === 'number' && !Number.isFinite(v)) return this;
      if (positiv && !(a[0] > 0)) a[0] = 0.0001;
      return orig.apply(this, a);
    };
  };
  skydda('setTargetAtTime');
  skydda('setValueAtTime');
  skydda('linearRampToValueAtTime');
  skydda('exponentialRampToValueAtTime', true);
  P.__andrumSkyddad = true;
}

let ctx = null;
let master = null;
let komp = null;
let grind = null;
let efter = null;
let klipp = null;
let vakt = null;
let buffertar = {};
let senasteLarm = -1e9;
let trasig = false;

// Ljudkedjan: allt ljud -> master -> kompressor -> sänkning -> grind -> ljudvakt -> högtalaren.
// Ljudvakten (lib/vakt-processor.js) ser varje sampel och stänger ljudet på några
// millisekunder om något plötsligt blir för starkt eller brusigt. Tills den har laddats,
// och om webbläsaren inte kan köra den, gör ett hårt tak och en enklare vakt samma jobb.
export const ljudLarm = [];
export const ljudNiva = { topp: 0, niva: 0, diskant: 0 };

// Samma mjuka tak som i ljudvakten: orört upp till 0,35, aldrig över 0,55.
const tak = (y) => {
  const a = Math.abs(y);
  if (a <= 0.35) return y;
  return Math.sign(y) * (0.35 + 0.2 * Math.tanh((a - 0.35) / 0.2));
};

function byggKomp() {
  // Mjuk begränsare så att inget någonsin blir skarpt.
  const k = ctx.createDynamicsCompressor();
  k.threshold.value = -20;
  k.knee.value = 14;
  k.ratio.value = 3;
  k.attack.value = 0.05;
  k.release.value = 0.5;
  k.connect(efter);
  return k;
}

function nyMaster() {
  master = ctx.createGain();
  master.gain.value = 1;
  master.connect(komp);
}

// Något lät fel. Koppla bort allt som spelade, så att bara nya ljud kommer fram.
function larm(info) {
  console.warn('Andrum: ljudvakten stängde ljudet', info);
  ljudLarm.push({ ...info, tid: new Date().toISOString() });
  try { localStorage.setItem('andrum.ljudlarm', JSON.stringify(ljudLarm.slice(-10))); } catch {}
  const t = ctx.currentTime;
  grind.gain.cancelScheduledValues(t);
  grind.gain.setValueAtTime(0, t);
  const gammal = master;
  const gammalKomp = komp;
  komp = byggKomp();
  nyMaster();
  try { gammal.disconnect(); } catch {}
  try { gammalKomp.disconnect(); } catch {}
  // Två larm tätt efter varandra: håll tyst tills hon går in i nästa rum, då byggs hela
  // ljudmotorn om från början.
  const nu = performance.now();
  if (nu - senasteLarm < 20000) trasig = true;
  senasteLarm = nu;
  if (!trasig) {
    setTimeout(() => {
      if (trasig || !ctx) return;
      vakt?.port.postMessage('oppna');
      const t2 = ctx.currentTime;
      grind.gain.cancelScheduledValues(t2);
      grind.gain.setValueAtTime(0, t2);
      grind.gain.setTargetAtTime(1, t2, 0.8);
    }, 1500);
  }
}

// Reservvakt om ljudvakten inte går att ladda: tittar på ljudet 20 gånger i sekunden.
function reservVakt() {
  const an = ctx.createAnalyser();
  an.fftSize = 1024;
  grind.connect(an);
  const buf = new Float32Array(an.fftSize);
  const egen = ctx;
  const id = setInterval(() => {
    if (ctx !== egen) { clearInterval(id); return; }
    if (vakt || grind.gain.value < 0.01) return;
    an.getFloatTimeDomainData(buf);
    let s2 = 0, d2 = 0, trasigt = false;
    for (let i = 0; i < buf.length; i++) {
      const x = buf[i];
      if (!Number.isFinite(x)) { trasigt = true; break; }
      s2 += x * x;
      if (i) d2 += (x - buf[i - 1]) ** 2;
    }
    const niva = Math.sqrt(s2 / buf.length), diskant = Math.sqrt(d2 / buf.length);
    if (trasigt || niva > 0.35 || diskant > 0.15) larm({ larm: trasigt ? 'trasigt' : 'starkt', niva, diskant, reserv: true });
  }, 50);
}

async function laddaVakt() {
  const egen = ctx;
  try {
    if (!ctx.audioWorklet) throw new Error('ingen AudioWorklet');
    await ctx.audioWorklet.addModule(new URL('./vakt-processor.js', import.meta.url));
    if (ctx !== egen) return;
    const v = new AudioWorkletNode(ctx, 'andrum-vakt', { outputChannelCount: [2] });
    v.port.onmessage = (e) => {
      if (e.data.larm) larm(e.data);
      else Object.assign(ljudNiva, e.data);
    };
    v.connect(ctx.destination);
    grind.connect(v);
    grind.disconnect(klipp);
    klipp.disconnect();
    vakt = v;
  } catch (e) {
    console.warn('Andrum: ljudvakten kunde inte laddas, reservvakten används', e);
    if (ctx === egen) reservVakt();
  }
}

function byggLjud() {
  // Låt ljudet höras även när iPhone står på ljudlöst läge.
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC();
  buffertar = {};
  vakt = null;
  grind = ctx.createGain();
  grind.gain.value = 1;
  // Ett hårt tak redan från början, innan ljudvakten har hunnit laddas.
  klipp = ctx.createWaveShaper();
  const kurva = new Float32Array(2049);
  for (let i = 0; i < kurva.length; i++) kurva[i] = tak((i / 1024) - 1);
  klipp.curve = kurva;
  grind.connect(klipp).connect(ctx.destination);
  // Kompressorn höjer svaga ljud en del på egen hand. Sänk efteråt så att de starkaste
  // rummen hamnar med god marginal under taket.
  efter = ctx.createGain();
  efter.gain.value = 0.6;
  efter.connect(grind);
  komp = byggKomp();
  nyMaster();
  laddaVakt();
  // När ljudet vaknar efter ett avbrott tonar det in i stället för att börja mitt i.
  let forra = ctx.state;
  ctx.onstatechange = () => {
    if (ctx.state === 'running' && forra !== 'running') tonaIn(0.6);
    forra = ctx.state;
  };
}

function tonaIn(tona) {
  if (!ctx || trasig) return;
  const t = ctx.currentTime;
  grind.gain.cancelScheduledValues(t);
  grind.gain.setValueAtTime(0, t);
  grind.gain.setTargetAtTime(1, t, tona);
}

// Tona ner direkt när appen hamnar i bakgrunden, och in igen när hon kommer tillbaka.
document.addEventListener('visibilitychange', () => {
  if (!ctx || trasig) return;
  const t = ctx.currentTime;
  if (document.visibilityState === 'hidden') {
    grind.gain.cancelScheduledValues(t);
    grind.gain.setTargetAtTime(0, t, 0.03);
  } else {
    tonaIn(0.6);
  }
});

// Måste anropas inne i en tryckning första gången (krav i iOS).
export function ljud() {
  if (ctx && trasig) {
    // Ljudvakten larmade två gånger. Börja om med en helt ny ljudmotor.
    try { ctx.close(); } catch {}
    ctx = null;
    trasig = false;
    if (vakt) { try { vakt.port.postMessage('stang'); } catch {} }
  }
  if (!ctx) byggLjud();
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
