// Inspelade ljud. En inspelning spelas aldrig rakt av i loop, eftersom örat snabbt
// lär sig känna igen en upprepning. I stället plockas bitar av slumpvis längd ur de
// rena avsnitten (där det inte finns fåglar, röster eller hantering av mikrofonen) och
// läggs efter varandra med långa, mjuka övertoningar och en aning olika tonhöjd.
// Nivån räknas fram ur själva inspelningen, så att alla inspelningar låter lika
// starkt som de framräknade ljuden de ersätter. Allt går genom samma kedja som
// övriga ljud, med säkerhetsspärren sist.

const avkodade = new Map();

// Avkodar en inspelning en gång och återanvänder den sedan
export function laddaInspelning(ctx, url) {
  if (!avkodade.has(url)) {
    const lofte = fetch(url)
      .then((svar) => { if (!svar.ok) throw new Error(`${url}: ${svar.status}`); return svar.arrayBuffer(); })
      .then((data) => new Promise((ja, nej) => ctx.decodeAudioData(data, ja, nej)));
    lofte.catch(() => avkodade.delete(url));
    avkodade.set(url, lofte);
  }
  return avkodade.get(url);
}

// Medelnivån (RMS) och den starkaste toppen i de rena avsnitten
function niva(buffer, avsnitt) {
  let summa = 0, antal = 0, topp = 0;
  for (let k = 0; k < buffer.numberOfChannels; k++) {
    const d = buffer.getChannelData(k);
    for (const [a, b] of avsnitt) {
      const i1 = Math.min(d.length, Math.floor(b * buffer.sampleRate));
      for (let i = Math.floor(a * buffer.sampleRate); i < i1; i++) {
        const v = d[i];
        summa += v * v; antal++;
        if (v > topp) topp = v; else if (-v > topp) topp = -v;
      }
    }
  }
  return { rms: Math.sqrt(summa / Math.max(1, antal)), topp };
}

// Jämnar ut en inspelning: nivån mäts i korta block, glättas över ett par sekunder,
// och varje del förstärks eller dämpas mot medianen. mangd 0 gör ingenting, 1 gör
// nivån helt jämn. Det fungerar som en mjuk, långsam kompressor, men räknas fram en
// gång när inspelningen laddas och kan därför aldrig höja något oväntat.
function jamnaUt(ctx, buffer, mangd) {
  const sr = buffer.sampleRate, n = buffer.length, kan = buffer.numberOfChannels;
  const blk = Math.floor(sr * 0.1), antal = Math.ceil(n / blk);
  const env = new Float32Array(antal);
  for (let b = 0; b < antal; b++) {
    let q = 0, c = 0;
    for (let k = 0; k < kan; k++) {
      const d = buffer.getChannelData(k);
      for (let i = b * blk; i < Math.min(n, (b + 1) * blk); i += 3) { q += d[i] * d[i]; c++; }
    }
    env[b] = Math.sqrt(q / Math.max(1, c));
  }
  // Glätta över ungefär två sekunder åt båda hållen
  const glatt = new Float32Array(antal), R = 10;
  for (let b = 0; b < antal; b++) {
    let q = 0, c = 0;
    for (let j = Math.max(0, b - R); j <= Math.min(antal - 1, b + R); j++) { q += env[j]; c++; }
    glatt[b] = q / c;
  }
  const sorterad = Array.from(glatt).sort((a, b) => a - b);
  const median = sorterad[Math.floor(sorterad.length / 2)] || 1e-5;
  const forst = Array.from(glatt, (e) => Math.min(4, Math.max(0.25, Math.pow(median / Math.max(e, 1e-6), mangd))));
  const ny = ctx.createBuffer(kan, n, sr);
  for (let k = 0; k < kan; k++) {
    const d = buffer.getChannelData(k), u = ny.getChannelData(k);
    for (let i = 0; i < n; i++) {
      const x = i / blk - 0.5, b = Math.max(0, Math.min(antal - 2, Math.floor(x))), t = Math.min(1, Math.max(0, x - b));
      u[i] = d[i] * (forst[b] + (forst[b + 1] - forst[b]) * t);
    }
  }
  return ny;
}

// Mjuka kurvor med jämn effekt, så att övertoningen inte ger en svacka i mitten
const IN = new Float32Array(64).map((_, i) => Math.sin((i / 63) * Math.PI / 2));
const UT = new Float32Array(64).map((_, i) => Math.cos((i / 63) * Math.PI / 2));

/**
 * En ljudmatta av en inspelning.
 * avsnitt: rena delar i sekunder, [[start, slut], ...]
 * niva: önskad RMS ut, ungefär som de framräknade ljuden
 * bit: längden på varje bit i sekunder [min, max]
 * over: övertoningens längd i sekunder
 * hp, lp: filter mot muller och sus (0 = av)
 * tonhojd: hur mycket tonhöjden får variera mellan bitarna
 * jamna: 0 till 1, jämnar ut byar och svackor (se jamnaUt)
 * maxTopp: den starkaste toppen ut. Knastrande ljud som eld är mest tystnad med
 *   skarpa knäpp, så de får aldrig förstärkas efter medelnivån ensam.
 */
export function skapaMatta(ctx, till, url, {
  avsnitt = null, niva: malNiva = 0.05, bit = [6, 14], over = 2.5, hp = 0, lp = 0, tonhojd = 0.03, maxTopp = 0.12, jamna = 0,
} = {}) {
  const ut = ctx.createGain();
  ut.gain.value = 0;
  let kedja = ut;
  // Två steg ger ett brant filter, så att sus kan tas bort utan att ljudet blir dovt
  if (lp) for (const q of [0.54, 1.31]) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = q; f.connect(kedja); kedja = f; }
  if (hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; f.Q.value = 0.6; f.connect(kedja); kedja = f; }
  const in_ = kedja;
  ut.connect(till);

  const kallor = new Set();
  let buffer = null, delar = null, nasta = 0, timer = 0, stoppad = false;

  function spelaBit() {
    if (stoppad || !buffer) return;
    const nu = ctx.currentTime;
    // Hann vi efter (till exempel när appen låg i bakgrunden) börjar vi om mjukt
    if (nasta < nu + 0.05) nasta = nu + 0.05;
    while (nasta < nu + 1.5) {
      const [a, b] = delar[Math.floor(Math.random() * delar.length)];
      const langd = Math.min(b - a, bit[0] + Math.random() * (bit[1] - bit[0]));
      const start = a + Math.random() * (b - a - langd);
      const fart = 1 + (Math.random() * 2 - 1) * tonhojd;
      const verklig = langd / fart;
      const o = Math.min(over, verklig / 3);
      const k = ctx.createBufferSource();
      k.buffer = buffer;
      k.playbackRate.value = fart;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setValueCurveAtTime(IN, nasta, o);
      g.gain.setValueCurveAtTime(UT, nasta + verklig - o, o);
      k.connect(g).connect(in_);
      k.start(nasta, start, langd);
      kallor.add(k);
      k.onended = () => { kallor.delete(k); try { g.disconnect(); } catch {} };
      nasta += verklig - o;
    }
    timer = setTimeout(spelaBit, 500);
  }

  const klar = laddaInspelning(ctx, url).then((b) => {
    if (stoppad) return;
    buffer = jamna > 0 ? jamnaUt(ctx, b, jamna) : b;
    b = buffer;
    const max = b.duration - 0.05;
    delar = (avsnitt || [[0.1, max]])
      .map(([a, z]) => [Math.max(0.05, a), Math.min(max, z)])
      .filter(([a, z]) => z - a > 1);
    if (!delar.length) throw new Error(`${url}: inga användbara avsnitt`);
    const { rms, topp } = niva(b, delar);
    // Tona in till rätt nivå: efter medelnivån, men aldrig så att toppen blir starkare
    // än maxTopp, och aldrig mer än 30 dB förstärkning
    const forst = Math.min(31.6, malNiva / Math.max(rms, 1e-5), maxTopp / Math.max(topp, 1e-5));
    matta.forst = forst;
    ut.gain.setTargetAtTime(forst, ctx.currentTime, 0.8);
    nasta = ctx.currentTime + 0.05;
    spelaBit();
    return b;
  });

  const matta = {
    klar,            // löses med den avkodade inspelningen
    ut,
    ing: in_,        // in i filtren och nivån, för korta ljud ur samma inspelning
    // Kallas när rummet stängs
    stop() {
      stoppad = true;
      clearTimeout(timer);
      for (const k of kallor) { try { k.stop(); } catch {} }
      kallor.clear();
      try { ut.disconnect(); } catch {}
    },
  };
  return matta;
}

/**
 * Ett kort ljud ur en inspelning, till exempel ett knäpp ur en eld.
 * stallen: tidpunkter i sekunder där det finns ett bra ljud att ta
 */
export function spelaKorn(ctx, till, buffer, stallen, { langd = 0.35, styrka = 1, nar = ctx.currentTime, tonhojd = 0.06 } = {}) {
  if (!buffer || !stallen.length) return;
  const t0 = stallen[Math.floor(Math.random() * stallen.length)];
  const k = ctx.createBufferSource();
  k.buffer = buffer;
  k.playbackRate.value = 1 + (Math.random() * 2 - 1) * tonhojd;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, nar);
  g.gain.linearRampToValueAtTime(styrka, nar + 0.008);
  g.gain.setValueAtTime(styrka, nar + langd * 0.6);
  g.gain.linearRampToValueAtTime(0, nar + langd);
  k.connect(g).connect(till);
  k.start(nar, Math.max(0, t0 - 0.03), langd + 0.05);
  k.onended = () => { try { g.disconnect(); } catch {} };
}

/**
 * En ljudbank: korta ljud ur en inspelning, till exempel steg eller pip, som spelas ett
 * i taget. Nivån ställs efter inspelningens starkaste topp, så att inget enskilt ljud
 * kan bli starkare än maxTopp. Samma ställe spelas aldrig två gånger i rad.
 * stallen: [[start, längd], ...] i sekunder
 */
export function skapaLjudbank(ctx, till, url, stallen, { maxTopp = 0.15, hp = 0, lp = 0 } = {}) {
  const ut = ctx.createGain();
  ut.gain.value = 0;
  let kedja = ut;
  if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = 0.6; f.connect(kedja); kedja = f; }
  if (hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; f.Q.value = 0.6; f.connect(kedja); kedja = f; }
  const in_ = kedja;
  ut.connect(till);
  let buffer = null, forra = -1;
  const klar = laddaInspelning(ctx, url).then((b) => {
    buffer = b;
    let topp = 0;
    for (let k = 0; k < b.numberOfChannels; k++) {
      const d = b.getChannelData(k);
      for (const [s, l] of stallen) {
        const i1 = Math.min(d.length, Math.floor((s + l) * b.sampleRate));
        for (let i = Math.floor(s * b.sampleRate); i < i1; i++) { const v = Math.abs(d[i]); if (v > topp) topp = v; }
      }
    }
    ut.gain.value = Math.min(31.6, maxTopp / Math.max(topp, 1e-5));
    return b;
  });
  return {
    klar,
    ut,
    // Spelar ett ljud. Returnerar false om banken inte är laddad än.
    spela({ styrka = 1, tonhojd = 0.06, nar = ctx.currentTime, ansats = 0.004, ut: till2 = in_, pan = 0 } = {}) {
      if (!buffer) return false;
      let i = Math.floor(Math.random() * stallen.length);
      if (stallen.length > 1 && i === forra) i = (i + 1 + Math.floor(Math.random() * (stallen.length - 1))) % stallen.length;
      forra = i;
      const [s, l] = stallen[i];
      const k = ctx.createBufferSource();
      k.buffer = buffer;
      k.playbackRate.value = 1 + (Math.random() * 2 - 1) * tonhojd;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, nar);
      g.gain.linearRampToValueAtTime(styrka, nar + ansats);
      g.gain.setValueAtTime(styrka, nar + l * 0.7);
      g.gain.linearRampToValueAtTime(0, nar + l);
      let sista = g;
      if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); sista = p; }
      k.connect(g);
      sista.connect(till2);
      k.start(nar, s, l + 0.05);
      k.onended = () => { try { g.disconnect(); sista.disconnect(); } catch {} };
      return true;
    },
    stop() { try { ut.disconnect(); } catch {} },
  };
}
