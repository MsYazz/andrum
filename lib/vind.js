// Vinande vind.
// Vind som viner är brus som silas genom smala, ringande frekvensband vars tonhöjd
// glider på måfå, och som kommer i byar med ojämna mellanrum. Inget här upprepar sig
// i jämn takt, så det låter inte som pulserande vågor.

import { brusKalla } from './ljud.js';

const slump = (a, b) => a + Math.random() * (b - a);

export function skapaVind(ctx, ut, { styrka = 1, ljus = 1 } = {}) {
  const kallor = [];
  const bus = ctx.createGain();
  bus.gain.value = styrka;
  bus.connect(ut);

  // Ett dovt sus i botten
  const sus = brusKalla('rosa');
  const susF = ctx.createBiquadFilter(); susF.type = 'lowpass'; susF.frequency.value = 220;
  const susG = ctx.createGain(); susG.gain.value = 0.02;
  sus.connect(susF).connect(susG).connect(bus);
  kallor.push(sus);

  // Ylande band: två filter efter varandra med hög resonans ger en vinande ton
  const band = [
    { f: [320, 780], q: 11, niva: [0.004, 0.035] },
    { f: [700, 1500 * ljus], q: 16, niva: [0.0, 0.014] },
  ].map((b) => {
    const k = brusKalla('rosa');
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = b.q;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = b.q * 0.6;
    f1.frequency.value = f2.frequency.value = slump(b.f[0], b.f[1]);
    const g = ctx.createGain(); g.gain.value = 0;
    k.connect(f1).connect(f2).connect(g).connect(bus);
    kallor.push(k);
    return { ...b, f1, f2, g, ton: f1.frequency.value, nastaTon: 0, nastaBy: 0 };
  });

  // by 0..1 lyfter allt tillfälligt, till exempel när någon drar med fingret
  function uppdatera(dt, by = 0) {
    const t = ctx.currentTime;
    for (const b of band) {
      // Tonen glider långsamt på måfå
      b.nastaTon -= dt;
      if (b.nastaTon <= 0) {
        b.ton = Math.min(b.f[1], Math.max(b.f[0], b.ton * slump(0.82, 1.22)));
        const tid = slump(0.6, 2.2);
        b.f1.frequency.setTargetAtTime(b.ton, t, tid);
        b.f2.frequency.setTargetAtTime(b.ton * slump(0.98, 1.03), t, tid);
        b.nastaTon = slump(0.5, 2.5);
      }
      // Byarna kommer och går med ojämna mellanrum och olika styrka
      b.nastaBy -= dt;
      if (b.nastaBy <= 0) {
        const lugn = Math.random() < 0.3;
        const mal = lugn ? b.niva[0] : slump(b.niva[0], b.niva[1]);
        b.g.gain.setTargetAtTime(mal * (1 + by * 1.5), t, slump(0.5, 2.5));
        b.nastaBy = slump(1, 5);
      }
    }
  }

  return { uppdatera, kallor };
}
