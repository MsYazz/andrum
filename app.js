import { ljud, vaknaLjud, duns } from './lib/ljud.js';
import { knack } from './lib/haptik.js';
import { begarRorelse } from './lib/rorelse.js';
import { visaIntro } from './lib/intro.js';
import { nyMilstolpe, visaKonfetti } from './lib/konfetti.js';

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
  3: {
    namn: 'Lavalampan',
    farg: '#ff8f6b',
    motiv: '<path d="M9.5 3h5l2.6 12.5H6.9z"/><path d="M6.9 15.5h10.2l-1.6 5.5h-7z"/><circle cx="11" cy="8.5" r="1.5" class="fylld"/><circle cx="13.2" cy="12" r="1.1" class="fylld"/>',
    rorelse: true,
    ladda: () => import('./luckor/03-lavalampan.js'),
  },
  4: {
    namn: 'Timglaset',
    farg: '#f0d9a8',
    motiv: '<path d="M6.5 3h11M6.5 21h11"/><path d="M8 3c0 5 7.5 6 7.5 9S8 16 8 21M16 3c0 5-7.5 6-7.5 9s7.5 4 7.5 9"/><path d="M10 20.2l2-2.2 2 2.2z" class="fylld"/>',
    rorelse: true,
    ladda: () => import('./luckor/04-timglaset.js'),
  },
  5: {
    namn: 'Glöden',
    farg: '#ff9a4a',
    motiv: '<path d="M12 3c1.5 3.5 5 5.5 5 9.5a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.6 1.2 2.6 2.2 3C10.7 8.6 11 5.6 12 3z"/><path d="M5 20.5l14-3M5 17.5l14 3"/>',
    ladda: () => import('./luckor/05-gloden.js'),
  },
  6: {
    namn: 'Fjällbäcken',
    farg: '#9fd4c8',
    motiv: '<path d="M8 3c-2 4 3 6 1 10s-4 5-1 8"/><path d="M14 3c-2 4 3 6 1 10s-4 5-1 8"/><circle cx="17.5" cy="15" r="1.6" class="fylld"/>',
    ladda: () => import('./luckor/06-fjallbacken.js'),
  },
  7: {
    namn: 'Frostängen',
    farg: '#cfe0ec',
    motiv: '<ellipse cx="9" cy="15.5" rx="2.4" ry="4" class="fylld"/><ellipse cx="9" cy="21" rx="1.6" ry="1.4" class="fylld"/><ellipse cx="15.5" cy="6.5" rx="2.4" ry="4" class="fylld"/><ellipse cx="15.5" cy="12" rx="1.6" ry="1.4" class="fylld"/>',
    ladda: () => import('./luckor/07-frostangen.js'),
  },
  8: {
    namn: 'Isfönstret',
    farg: '#b9cdf0',
    motiv: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M5 12h14M12 3v18"/><path d="M6.5 19.5l3-3M6.5 16.5l1.5-1.5M8.5 19.5l1.5-1.5M17.5 4.5l-3 3M17.5 7.5L16 9M15.5 4.5L14 6"/>',
    ladda: () => import('./luckor/08-isfonstret.js'),
  },
  9: {
    namn: 'Tjärnen',
    farg: '#8fa8d8',
    motiv: '<path d="M12 3c2.2 3 3.6 5 3.6 6.8a3.6 3.6 0 0 1-7.2 0C8.4 8 9.8 6 12 3z" class="fylld"/><ellipse cx="12" cy="18.5" rx="4" ry="1.2"/><ellipse cx="12" cy="18.5" rx="8" ry="2.6"/>',
    ladda: () => import('./luckor/09-tjarnen.js'),
  },
  10: {
    namn: 'Bläckdroppen',
    farg: '#c4b8e8',
    motiv: '<path d="M12 3c1.6 2.2 2.6 3.7 2.6 5a2.6 2.6 0 0 1-5.2 0c0-1.3 1-2.8 2.6-5z" class="fylld"/><path d="M12 12c-3 2-5 4-4 7 1 2 3 1 4-1 1 2 3 3 4 1 1-3-1-5-4-7z"/>',
    ladda: () => import('./luckor/10-blackdroppen.js'),
  },
  11: {
    namn: 'Mossan',
    farg: '#a8c98a',
    motiv: '<path d="M4 20c2-1 3-4 5-4s2 3 4 3 2-5 4-5 2 4 3 6"/><circle cx="8" cy="12" r="2" class="fylld"/><circle cx="13" cy="9" r="2.6" class="fylld"/><circle cx="17.5" cy="12.5" r="1.6" class="fylld"/>',
    ladda: () => import('./luckor/11-mossan.js'),
  },
  12: {
    namn: 'Norrskenet',
    farg: '#8fe0b6',
    motiv: '<path d="M3 12c3-4 5 1 9-3s6 0 9-3"/><path d="M5 11v-4M9 10V5M13 8V4M17 8V3"/><path d="M3 20l5-5 3 3 4-5 6 7z" class="fylld"/>',
    rorelse: true,
    ladda: () => import('./luckor/12-norrskenet.js'),
  },
  13: {
    namn: 'Luciaskenet',
    farg: '#ffd28a',
    motiv: '<path d="M12 3c1.3 1.8 2 3 2 4.2a2 2 0 0 1-4 0C10 6 10.7 4.8 12 3z" class="fylld"/><rect x="9.5" y="10" width="5" height="9" rx="0.6"/><path d="M6 21h12"/>',
    ladda: () => import('./luckor/13-luciaskenet.js'),
  },
  14: {
    namn: 'Eldflugorna',
    farg: '#d4f08a',
    motiv: '<circle cx="7" cy="8" r="1.3" class="fylld"/><circle cx="15" cy="5" r="1" class="fylld"/><circle cx="17" cy="12" r="1.5" class="fylld"/><circle cx="10" cy="14" r="1" class="fylld"/><path d="M3 21c1-3 2-5 3-6M8 21c0-3 1-4 1-5M13 21c0-2 1-4 2-5M18 21c0-2-1-3-1-4"/>',
    ladda: () => import('./luckor/14-eldflugorna.js'),
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
let utBegard = false;
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
  if (RUM[n].rorelse) begarRorelse();
  const laddning = RUM[n].ladda();
  oppenDorr = dorr;
  // Ett steg i historiken, så att telefonens bakåtknapp eller bakåtsvep leder ut ur rummet
  history.pushState({ andrum: 'rum', n }, '');
  utBegard = false;

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
  // Trycktes bakåt medan dörren öppnades går vi ut direkt
  if (utBegard) kliverUt();
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

  // Efter en vecka, två, tre och på julafton singlar lite konfetti ner
  if (nyMilstolpe(oppnade().size)) setTimeout(visaKonfetti, 500);
}

lista.addEventListener('click', (e) => {
  const dorr = e.target.closest('.dorr');
  if (dorr && !dorr.disabled) kliverIn(dorr);
});

// Pilen går bakåt i historiken, precis som telefonens bakåtknapp. Båda landar i popstate.
tillbaka.addEventListener('click', () => {
  if (history.state?.andrum === 'rum') history.back();
  else kliverUt();
});
window.addEventListener('popstate', () => {
  if (upptagen && !stoppa) { utBegard = true; return; }
  kliverUt();
});

// iOS pausar ljudet när appen ligger i bakgrunden. Väck det vid nästa beröring.
document.addEventListener('pointerdown', vaknaLjud, { passive: true });
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && stoppa && !vaka) {
    try { vaka = await navigator.wakeLock?.request('screen'); } catch {}
  }
});

// Laddas sidan om inne i ett rum börjar vi i kalendern igen
if (history.state?.andrum === 'rum') history.replaceState(null, '');
ritaKalender();
visaIntro();

const lokal = ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && !lokal) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
