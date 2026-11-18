// Håller appen i porträttläge. Manifestet ber om det, men hemskärmsappar på iPhone bryr
// sig inte om det. Vrids telefonen till liggande vrider vi därför tillbaka hela innehållet,
// så att allt står kvar som om skärmen vore låst. Fingrarnas koordinater räknas om på
// samma sätt, så att rummen inte märker någon skillnad.

let vinkel = 0;   // 0, 90 (vriden moturs) eller 270 (vriden medurs)

function lasVinkel() {
  const w = typeof window.orientation === 'number' ? window.orientation : (screen.orientation?.angle ?? 0);
  const v = ((w % 360) + 360) % 360;
  // Bara när sidan faktiskt ligger ner. En stor skärm i liggande läge (dator) får vara.
  if (innerWidth <= innerHeight) return 0;
  return v === 90 || v === 270 ? v : 0;
}

function uppdatera() {
  vinkel = lasVinkel();
  const html = document.documentElement;
  if (vinkel) {
    html.dataset.vriden = String(vinkel);
    html.style.setProperty('--vb', `${innerHeight}px`);
    html.style.setProperty('--vh', `${innerWidth}px`);
  } else {
    delete html.dataset.vriden;
  }
}

export const vriden = () => vinkel !== 0;

// Från skärmens koordinater till innehållets (porträtt) koordinater.
export function tillInnehall(x, y) {
  if (vinkel === 90) return [innerHeight - y, x];
  if (vinkel === 270) return [y, innerWidth - x];
  return [x, y];
}

// Ett elements ruta i innehållets koordinater.
export function rektangel(el) {
  const r = el.getBoundingClientRect();
  if (vinkel === 90) return { left: innerHeight - r.bottom, top: r.left, width: r.height, height: r.width };
  if (vinkel === 270) return { left: r.top, top: innerWidth - r.right, width: r.height, height: r.width };
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

// Innehållets storlek i porträtt.
export const yta = () => (vinkel ? { b: innerHeight, h: innerWidth } : { b: innerWidth, h: innerHeight });

// Hur långt kalendern är nerrullad. Vriden rullar body i stället för fönstret.
export const rullat = () => (vinkel ? document.body.scrollTop : window.scrollY);
export function rullaTill(y) {
  if (vinkel) document.body.scrollTop = y;
  else window.scrollTo(0, y);
}

// Räkna om pekarhändelser innan rummen ser dem.
function omrakna(e) {
  if (!vinkel) return;
  const [x, y] = tillInnehall(e.clientX, e.clientY);
  try {
    Object.defineProperty(e, 'clientX', { value: x });
    Object.defineProperty(e, 'clientY', { value: y });
    if (e.getCoalescedEvents) {
      const egna = e.getCoalescedEvents.bind(e);
      Object.defineProperty(e, 'getCoalescedEvents', {
        value: () => egna().map((h) => {
          const [hx, hy] = tillInnehall(h.clientX, h.clientY);
          return { clientX: hx, clientY: hy, timeStamp: h.timeStamp, pointerId: h.pointerId, pressure: h.pressure };
        }),
      });
    }
  } catch {}
}
for (const typ of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
  window.addEventListener(typ, omrakna, { capture: true, passive: true });
}

uppdatera();
window.addEventListener('resize', uppdatera);
window.addEventListener('orientationchange', () => setTimeout(uppdatera, 50));
screen.orientation?.addEventListener?.('change', uppdatera);
// Där det går (Android i hemskärmsläge) låser vi på riktigt
try { screen.orientation?.lock?.('portrait').catch(() => {}); } catch {}
