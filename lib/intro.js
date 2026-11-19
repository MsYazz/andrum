// Introt: först en kontroll av om sidan öppnats i en apps inbyggda webbläsare
// (till exempel Messenger), sedan julkortet med rimmet och sist en instruktion
// för att lägga Andrum på hemskärmen.

import { tillVivan } from './mottagare.js';

const NYCKEL = 'andrum.intro';
const FORSOKT = 'andrum.inapp-forsokt';

// Delar av webbläsarens namn som avslöjar en inbyggd webbläsare i en app
const INBYGGDA = [
  'FBAN', 'FBAV', 'FB_IAB', 'Messenger', 'Instagram', 'Line/', 'Twitter', 'Snapchat',
  'MicroMessenger', 'musical_ly', 'BytedanceWebview', 'TikTok', 'Pinterest', 'LinkedInApp', 'GSA/',
];

const RIM = [
  'Du önskade andetag, tio i rad,',
  'och lite konfetti som gör dig glad.',
  'Här är tjugofyra dörrar, en varje dag,',
  'till rum där det är helt okej att vara svag.',
];

const ua = navigator.userAgent || '';
const arIos = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
const arAndroid = /Android/i.test(ua);
const fristaende = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

function lagra(n, v) { try { v == null ? localStorage.removeItem(n) : localStorage.setItem(n, v); } catch {} }
function hamta(n) { try { return localStorage.getItem(n); } catch { return null; } }
function sessionHamta(n) { try { return sessionStorage.getItem(n); } catch { return null; } }
function sessionLagra(n, v) { try { sessionStorage.setItem(n, v); } catch {} }

// Android: en intent-länk får appen att fråga om sidan ska öppnas i den riktiga webbläsaren.
// På iPhone går det inte att ta sig ut automatiskt, där visas en instruktion.
function oppnaExternt() {
  try {
    const u = new URL(location.href);
    const reserv = encodeURIComponent(location.href);
    location.href = `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;S.browser_fallback_url=${reserv};end`;
  } catch {}
}

function skapa(html) {
  const el = document.createElement('div');
  el.className = 'intro';
  el.innerHTML = html;
  document.body.append(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('syns')));
  return el;
}

function stang(el) {
  return new Promise((r) => {
    el.classList.remove('syns');
    setTimeout(() => { el.remove(); r(); }, 700);
  });
}

function inbyggdSida() {
  const kanTaSigUt = arAndroid;
  return new Promise((klar) => {
    const el = skapa(`
      <div class="intro-ruta">
        <h2>Öppna i din webbläsare</h2>
        <p>Andrum har öppnats inuti en annan app. För att den ska kunna ligga på hemskärmen och fungera fullt ut behöver den öppnas i ${arIos ? 'Safari' : 'din vanliga webbläsare'}.</p>
        ${kanTaSigUt ? '<button class="intro-knapp" data-g="extern">Öppna i webbläsaren</button>' : ''}
        <ol class="intro-steg">
          <li>Tryck på menyknappen <span class="tecken">${arAndroid ? '⋮' : '•••'}</span> i hörnet.</li>
          <li>Välj <strong>${arIos ? 'Öppna i Safari' : 'Öppna i Chrome'}</strong> eller <strong>Öppna i webbläsare</strong>.</li>
        </ol>
        <button class="intro-knapp sekundar" data-g="kopiera">Kopiera länken</button>
        <button class="intro-lank" data-g="fortsatt">Fortsätt här ändå</button>
      </div>`);
    el.addEventListener('click', async (e) => {
      const g = e.target.closest('[data-g]')?.dataset.g;
      if (g === 'extern') oppnaExternt();
      if (g === 'kopiera') {
        try {
          await navigator.clipboard.writeText(location.href);
          e.target.textContent = 'Länken är kopierad';
        } catch {
          e.target.textContent = location.href;
        }
      }
      if (g === 'fortsatt') { await stang(el); klar(); }
    });
    if (kanTaSigUt && !sessionHamta(FORSOKT)) {
      sessionLagra(FORSOKT, '1');
      oppnaExternt();
    }
  });
}

function julkort() {
  return new Promise((klar) => {
    const el = skapa(`
      <div class="intro-ruta kort">
        <div class="tagg">
          <div class="snore" aria-hidden="true"></div>
          <p class="till">Till Vivan</p>
          <p class="rim">${RIM.map((r) => `<span>${r}</span>`).join('')}</p>
          <p class="halsning">God jul, Vivan!<br><span>från Ella</span></p>
        </div>
        <button class="intro-knapp" data-g="oppna">Öppna julklappen</button>
      </div>`);
    el.querySelector('[data-g="oppna"]').addEventListener('click', async () => { await stang(el); klar(); });
  });
}

function hemskarm() {
  let installation = null;
  return new Promise((klar) => {
    const delaIkon = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M6 11v9h12v-9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const steg = arIos
      ? `<li>Tryck på dela-knappen <span class="tecken">${delaIkon}</span> i Safari.</li>
         <li>Bläddra ner och välj <strong>Lägg till på hemskärmen</strong>.</li>
         <li>Tryck på <strong>Lägg till</strong>.</li>`
      : `<li>Tryck på menyknappen <span class="tecken">⋮</span> i webbläsaren.</li>
         <li>Välj <strong>Lägg till på startskärmen</strong> eller <strong>Installera app</strong>.</li>`;
    const el = skapa(`
      <div class="intro-ruta">
        <h2>Lägg Andrum på hemskärmen</h2>
        <p>Då öppnas kalendern som en egen app, i helskärm och utan adressfält.</p>
        <button class="intro-knapp" data-g="installera" hidden>Lägg till på hemskärmen</button>
        <ol class="intro-steg">${steg}</ol>
        <p class="intro-tips">Öppna sedan Andrum från ikonen på hemskärmen.</p>
        <button class="intro-lank" data-g="fortsatt">Fortsätt här i webbläsaren</button>
      </div>`);
    const knapp = el.querySelector('[data-g="installera"]');
    const visa = (e) => { e.preventDefault(); installation = e; knapp.hidden = false; };
    window.addEventListener('beforeinstallprompt', visa);
    if (window.__installation) visa(window.__installation);
    knapp.addEventListener('click', async () => {
      if (!installation) return;
      installation.prompt();
      const val = await installation.userChoice.catch(() => null);
      installation = null;
      knapp.hidden = true;
      if (val?.outcome === 'accepted') { await stang(el); klar(); }
    });
    el.querySelector('[data-g="fortsatt"]').addEventListener('click', async () => {
      window.removeEventListener('beforeinstallprompt', visa);
      await stang(el);
      klar();
    });
  });
}

// Fånga installationserbjudandet tidigt, innan introt hunnit visa hemskärmssteget
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__installation = e; });

export async function visaIntro() {
  const inbyggd = INBYGGDA.some((s) => ua.includes(s)) || (arAndroid && /; wv\)/.test(ua));
  if (inbyggd && !fristaende()) await inbyggdSida();
  if (hamta(NYCKEL) === 'klar') return;
  // Julkortet med rimmet är bara till Vivan
  if (tillVivan) await julkort();
  // Hemskärmen är bara aktuell i en telefon som inte redan kör Andrum därifrån
  if (!fristaende() && (arIos || arAndroid)) await hemskarm();
  lagra(NYCKEL, 'klar');
}
