// Porlande vatten.
// Riktigt porl är mycket korta luftbubblor som stiger i tonhöjd när de spricker vid ytan,
// i klungor med ojämna mellanrum, ovanpå ett vattenbrus som hela tiden skiftar.
// Allt här är slumpat på flera nivåer, så att det aldrig låter likadant två gånger.

import { brusKalla } from './ljud.js';

const slump = (a, b) => a + Math.random() * (b - a);
const logSlump = (a, b) => Math.exp(slump(Math.log(a), Math.log(b)));
// Exponentiellt fördelad väntetid, som för händelser som kommer helt på måfå
const vanta = (medel) => -Math.log(1 - Math.random()) * medel;

export function skapaPorl(ctx, ut, { styrka = 1, ljus = 1 } = {}) {
  const kallor = [];
  const bus = ctx.createGain();
  bus.gain.value = styrka;
  bus.connect(ut);
  const panorera = typeof ctx.createStereoPanner === 'function';

  // En bubbla: kort sinus som glider uppåt och klingar av fort.
  // Små bubblor är ljusa och korta, stora är dovare och lite längre.
  function bubbla(nar, f, amp, pan) {
    const langd = slump(0.008, 0.03) * Math.sqrt(900 / f) * slump(0.7, 1.5);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, nar);
    o.frequency.exponentialRampToValueAtTime(f * slump(1.15, 2.4), nar + langd * slump(0.8, 1.6));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, nar);
    g.gain.linearRampToValueAtTime(amp, nar + slump(0.0008, 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, nar + langd * 2.2);
    o.connect(g);
    if (panorera) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p).connect(bus);
    } else {
      g.connect(bus);
    }
    o.start(nar);
    o.stop(nar + langd * 2.4 + 0.02);
  }

  // En klunga: några bubblor av liknande storlek tätt efter varandra
  function klunga(nar, kraft) {
    const n = 1 + Math.floor(Math.random() * (2 + 10 * kraft));
    const bas = logSlump(280, 2400 * ljus);
    const pan = slump(-0.8, 0.8);
    let t = nar;
    for (let i = 0; i < n; i++) {
      const f = bas * slump(0.7, 1.45);
      const amp = slump(0.004, 0.022) * (0.6 + kraft) * Math.pow(800 / f, 0.25);
      bubbla(t, f, amp, Math.max(-1, Math.min(1, pan + slump(-0.25, 0.25))));
      t += vanta(0.035) + 0.004;
    }
  }

  // Ett djupare klunk då och då
  function klunk(nar) {
    const f = logSlump(110, 230);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, nar);
    o.frequency.exponentialRampToValueAtTime(f * slump(1.4, 1.9), nar + 0.09);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, nar);
    g.gain.linearRampToValueAtTime(slump(0.02, 0.04), nar + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, nar + slump(0.1, 0.18));
    o.connect(lp).connect(g).connect(bus);
    o.start(nar);
    o.stop(nar + 0.22);
  }

  // Vattenbrus i tre band som var för sig sakta växer och avtar på måfå
  const band = [
    { f: 420, q: 0.7, bas: 0.03 },
    { f: 1150, q: 0.9, bas: 0.026 },
    { f: 2900, q: 1.1, bas: 0.012 },
  ].map((b) => {
    const k = brusKalla('rosa');
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = b.f; bp.Q.value = b.q;
    const g = ctx.createGain(); g.gain.value = b.bas;
    const fl = ctx.createGain(); fl.gain.value = 1;
    k.connect(bp).connect(g).connect(fl).connect(bus);
    kallor.push(k);
    return { ...b, bp, g, fl, nasta: 0, flNasta: 0 };
  });
  const mull = brusKalla('rosa');
  const mullF = ctx.createBiquadFilter();
  mullF.type = 'lowpass'; mullF.frequency.value = 200;
  const mullG = ctx.createGain(); mullG.gain.value = 0.03;
  mull.connect(mullF).connect(mullG).connect(bus);
  kallor.push(mull);

  let tid = 0;
  let nastaKlunga = 0.5;
  let nastaKlunk = slump(2, 6);
  let tathet = 1;       // en långsam slumpvandring, så att porlet ebbar och flödar
  let tathetMal = 1;
  let tathetByte = 0;

  // intensitet 0..1: hur mycket vattnet virvlar just nu
  function uppdatera(dt, intensitet = 0.3) {
    tid += dt;
    const t = ctx.currentTime;

    tathetByte -= dt;
    if (tathetByte <= 0) { tathetMal = slump(0.45, 1.6); tathetByte = slump(1.5, 5); }
    tathet += (tathetMal - tathet) * Math.min(1, dt * 0.6);

    // Bruset
    for (const b of band) {
      b.nasta -= dt;
      if (b.nasta <= 0) {
        b.g.gain.setTargetAtTime(b.bas * slump(0.55, 1.5) * (0.8 + intensitet * 0.6), t, slump(0.2, 0.8));
        b.bp.frequency.setTargetAtTime(b.f * slump(0.8, 1.25), t, slump(0.3, 1));
        b.nasta = slump(0.2, 1.2);
      }
      b.flNasta -= dt;
      if (b.flNasta <= 0) {
        b.fl.gain.setTargetAtTime(slump(0.75, 1.15), t, 0.02);
        b.flNasta = slump(0.025, 0.09);
      }
    }

    // Bubblorna, schemalagda lite i förväg så att takten blir jämn trots ojämna bildrutor
    const takt = (5 + intensitet * 28) * tathet;
    nastaKlunga -= dt;
    while (nastaKlunga <= 0) {
      klunga(t + 0.03 + Math.max(0, -nastaKlunga), Math.min(1, intensitet + slump(0, 0.3)));
      nastaKlunga += vanta(1 / takt);
    }
    nastaKlunk -= dt;
    if (nastaKlunk <= 0) { klunk(t + 0.02); nastaKlunk = vanta(4 / (0.6 + intensitet)); }
  }

  return { uppdatera, kallor };
}
