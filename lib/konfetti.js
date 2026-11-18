// Mjuk konfetti: några få flagor i dämpade färger som singlar ner långsamt och vajar,
// med en stilla klang. Visas när sju, fjorton, tjugoen och tjugofyra dörrar har öppnats.

import { ljud, klocka, rum } from './ljud.js';
import { yta } from './portratt.js';

const NYCKEL = 'andrum.konfetti';
export const MILSTOLPAR = [7, 14, 21, 24];

const FARGER = ['#f2c27a', '#e8a598', '#c9b6e4', '#a9d6c2', '#f4e3c1', '#d99a6c'];

function visade() {
  try { return new Set(JSON.parse(localStorage.getItem(NYCKEL) || '[]')); } catch { return new Set(); }
}

// Returnerar milstolpen som just nåddes, eller null
export function nyMilstolpe(antal) {
  const v = visade();
  const m = MILSTOLPAR.filter((x) => x <= antal && !v.has(x)).pop();
  if (!m) return null;
  try { localStorage.setItem(NYCKEL, JSON.stringify([...v, ...MILSTOLPAR.filter((x) => x <= antal)])); } catch {}
  return m;
}

// Konfettin som syns just nu, så att den kan tonas bort när man kliver in i ett rum
let aktiv = null;
export function tonaUtKonfetti() {
  if (aktiv && aktiv.tonaUt === null) aktiv.tonaUt = performance.now();
}

export function visaKonfetti() {
  const lugn = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duk = document.createElement('canvas');
  duk.className = 'konfetti';
  document.body.append(duk);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { b: B, h: H } = yta();
  duk.width = B * dpr; duk.height = H * dpr;
  const c = duk.getContext('2d');
  c.scale(dpr, dpr);

  const antal = lugn ? 18 : 46;
  const flagor = Array.from({ length: antal }, () => ({
    x: Math.random() * B,
    y: -20 - Math.random() * H * 0.6,
    vy: 34 + Math.random() * 34,
    fas: Math.random() * 6.28,
    sving: 10 + Math.random() * 22,
    vinkel: Math.random() * 6.28,
    snurr: (Math.random() - 0.5) * 1.6,
    b: 5 + Math.random() * 6,
    h: 3 + Math.random() * 4,
    farg: FARGER[Math.floor(Math.random() * FARGER.length)],
    rund: Math.random() < 0.35,
  }));

  // En stilla klang i tre toner uppåt
  try {
    const { ctx, master } = ljud();
    const eko = rum(3.5);
    const ekoUt = ctx.createGain();
    ekoUt.gain.value = 0.4;
    eko.connect(ekoUt).connect(master);
    const t = ctx.currentTime + 0.2;
    [523.25, 659.25, 783.99].forEach((f, i) => klocka(f, { till: master, eko, styrka: 0.03, ansats: 0.4, langd: 5, nar: t + i * 0.45 }));
    setTimeout(() => ekoUt.disconnect(), 9000);
  } catch {}

  const start = performance.now();
  const LANGD = Math.max(14000, ((H * 1.6) / 34) * 1000);
  let forra = start;
  const denna = { tonaUt: null };
  aktiv = denna;
  const rita = (nu) => {
    const dt = Math.min(0.05, (nu - forra) / 1000);
    forra = nu;
    const t = nu - start;
    let tona = Math.min(1, t / 800) * (1 - Math.max(0, (t - LANGD + 2000) / 2000));
    // Snabb uttoning när man kliver in i ett rum
    if (denna.tonaUt !== null) {
      tona *= Math.max(0, 1 - (performance.now() - denna.tonaUt) / 400);
      if (tona <= 0) { duk.remove(); if (aktiv === denna) aktiv = null; return; }
    }
    c.clearRect(0, 0, B, H);
    for (const f of flagor) {
      f.y += f.vy * dt;
      f.fas += dt * 1.3;
      f.vinkel += f.snurr * dt;
      const x = f.x + Math.sin(f.fas) * f.sving;
      // Flagan vänder sig långsamt, som ett papper som faller
      const vand = Math.abs(Math.cos(f.fas * 0.9));
      c.save();
      c.globalAlpha = 0.85 * tona;
      c.translate(x, f.y);
      c.rotate(f.vinkel);
      c.fillStyle = f.farg;
      if (f.rund) {
        c.beginPath();
        c.ellipse(0, 0, f.b * 0.5, f.b * 0.5 * (0.3 + 0.7 * vand), 0, 0, Math.PI * 2);
        c.fill();
      } else {
        c.fillRect(-f.b / 2, (-f.h / 2) * (0.3 + 0.7 * vand), f.b, f.h * (0.3 + 0.7 * vand));
      }
      c.restore();
    }
    if (t < LANGD) requestAnimationFrame(rita);
    else { duk.remove(); if (aktiv === denna) aktiv = null; }
  };
  requestAnimationFrame(rita);
}
