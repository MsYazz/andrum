import { ljud, vaknaLjud, duns } from './lib/ljud.js';
import { knack } from './lib/haptik.js';

// Rummen som finns. Färgen är ljuset som strömmar ut genom dörren.
// Motivet präglas i den övre dörrspegeln första gången dörren öppnas (SVG, 24x24).
const RUM = {
  1: {
    namn: 'Andetaget',
    farg: '#ffbf8a',
    motiv: '<path d="M3.5 9.5h9.5a3 3 0 1 0-3-3"/><path d="M3.5 13h13a3 3 0 1 1-3 3"/><path d="M6 16.5h3"/>',
    ladda: () => import('./luckor/01-andetaget.js'),
  },
  2: {
    namn: 'Sandlådan',
    farg: '#eadcc0',
    motiv: '<ellipse cx="12" cy="12" rx="3.3" ry="2.7" class="fylld"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="9"/>',
    ladda: () => import('./luckor/02-sandladan.js'),
  },
};

const NYCKEL = 'andrum.oppnade';
const lista = document.getElementById('dorrar');
const kalender = document.getElementById('kalender');
const scen = document.getElementById('scen');
const tillbaka = document.getElementById('tillbaka');

function oppnade() {
  try { return new Set(JSON.parse(localStorage.getItem(NYCKEL) || '[]')); }
  catch { return new Set(); }
}

function sparaOppnad(n) {
  try {
    const s = oppnade();
    s.add(n);
    localStorage.setItem(NYCKEL, JSON.stringify([...s]));
  } catch {}
}

// Vilken dag i december det är (0 före december, 24 efter julafton och i januari).
function dagensDorr() {
  const d = new Date();
  if (d.getMonth() === 11) return Math.min(d.getDate(), 24);
  if (d.getMonth() === 0) return 24;
  return 0;
}

const idag = dagensDorr();
const forhand = idag === 0 || new URLSearchParams(location.search).has('prov');

function arOppen(n) {
  return !!RUM[n] && (forhand || n <= idag);
}

function ritaKalender() {
  const sedda = oppnade();
  lista.innerHTML = '';
  for (let n = 1; n <= 24; n++) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.className = 'dorr';
    b.dataset.n = n;
    b.disabled = !arOppen(n);
    if (RUM[n]) b.style.setProperty('--rum', RUM[n].farg);
    if (n === idag && arOppen(n)) b.classList.add('idag');
    if (sedda.has(n)) b.classList.add('oppnad', 'preglad');
    b.setAttribute('aria-label', RUM[n] && arOppen(n) ? `Dörr ${n}, ${RUM[n].namn}` : `Dörr ${n}, stängd`);
    const relief = RUM[n]
      ? `<svg class="relief" viewBox="0 0 24 24" aria-hidden="true">${RUM[n].motiv}</svg>`
      : '';
    b.innerHTML = `<span class="rum"></span><span class="blad">${relief}<span class="nr">${n}</span><span class="handtag"></span></span>`;
    li.append(b);
    lista.append(li);
  }
  document.getElementById('forhand').hidden = !forhand;
}

let stoppa = null;
let vaka = null;
let oppenDorr = null;
let upptagen = false;
let sparadScroll = 0;
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const vanta = (ms) => new Promise((r) => setTimeout(r, ms));
const lugn = matchMedia('(prefers-reduced-motion: reduce)').matches;

async function kliverIn(dorr) {
  if (upptagen) return;
  upptagen = true;
  const n = Number(dorr.dataset.n);

  // Ljud och vibration måste startas direkt i tryckningen (krav i iOS).
  ljud();
  knack();
  const laddning = RUM[n].ladda();
  oppenDorr = dorr;

  // 1. Första gången präglas motivet i dörrspegeln. Präglingen sitter sedan kvar.
  if (!dorr.classList.contains('preglad')) {
    duns();
    dorr.classList.add('preglad', 'praglas');
    await vanta(900);
  } else {
    await vanta(150);
  }

  // 2. Dörren svänger upp.
  dorr.classList.add('oppnas');
  await vanta(650);

  // 3. Vi glider in genom öppningen. Förstoringen får inte rubba var man står i kalendern.
  sparadScroll = window.scrollY;
  const k = kalender.getBoundingClientRect();
  const d = dorr.getBoundingClientRect();
  kalender.style.transformOrigin = `${d.left - k.left + d.width / 2}px ${d.top - k.top + d.height * 0.55}px`;
  if (!lugn) kalender.style.transform = 'scale(7)';
  kalender.classList.add('kliver');

  const duk = document.createElement('canvas');
  duk.className = 'duk';
  scen.prepend(duk);
  scen.hidden = false;
  document.body.classList.add('i-scen');

  const mod = await laddning;
  await vanta(450);
  scen.classList.add('synlig');
  try {
    stoppa = mod.default.start(duk, scen);
  } catch (fel) {
    console.error(fel);
    stoppa = async () => {};
  }
  sparaOppnad(n);
  try { vaka = await navigator.wakeLock?.request('screen'); } catch {}
  upptagen = false;
}

async function kliverUt() {
  if (upptagen || !stoppa) return;
  upptagen = true;
  const s = stoppa;
  stoppa = null;
  scen.classList.remove('synlig');
  await s();
  scen.querySelectorAll('.duk, .lucka-ui').forEach((e) => e.remove());
  scen.hidden = true;
  document.body.classList.remove('i-scen');
  try { vaka?.release(); } catch {}
  vaka = null;

  // Tillbaka ut genom dörren, som sedan glider igen till glänt.
  kalender.style.transform = '';
  kalender.classList.remove('kliver');
  window.scrollTo(0, sparadScroll);
  await vanta(900);
  if (oppenDorr) {
    oppenDorr.classList.remove('oppnas');
    oppenDorr.classList.add('oppnad');
  }
  oppenDorr = null;
  upptagen = false;
}

lista.addEventListener('click', (e) => {
  const dorr = e.target.closest('.dorr');
  if (dorr && !dorr.disabled) kliverIn(dorr);
});

tillbaka.addEventListener('click', kliverUt);

// iOS pausar ljudet när appen ligger i bakgrunden. Väck det vid nästa beröring.
document.addEventListener('pointerdown', vaknaLjud, { passive: true });
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && stoppa && !vaka) {
    try { vaka = await navigator.wakeLock?.request('screen'); } catch {}
  }
});

ritaKalender();

const lokal = ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && !lokal) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
