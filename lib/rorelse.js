// Telefonens lutning.
// På iPhone måste man be om lov att läsa rörelsesensorn, och frågan måste
// ställas direkt i en tryckning. Därför anropas begarRorelse() när dörren trycks.

export function begarRorelse() {
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === 'function') {
    try { DOE.requestPermission().catch(() => {}); } catch {}
  }
  const DME = window.DeviceMotionEvent;
  if (DME && typeof DME.requestPermission === 'function') {
    try { DME.requestPermission().catch(() => {}); } catch {}
  }
}

// Anropar fn(ax, ay) med telefonens acceleration (utan tyngdkraften) i m/s², i skärmens
// riktningar: x åt höger, y uppåt. Används för att känna när telefonen skakas.
export function lyssnaSkak(fn) {
  const h = (e) => {
    const a = e.acceleration;
    if (!a || a.x == null || a.y == null) return;
    fn(a.x, a.y);
  };
  window.addEventListener('devicemotion', h);
  return () => window.removeEventListener('devicemotion', h);
}

// Anropar fn(beta, gamma) i grader när telefonen lutas. Returnerar en funktion som slutar lyssna.
export function lyssnaLutning(fn) {
  const h = (e) => {
    if (e.beta == null || e.gamma == null) return;
    fn(e.beta, e.gamma);
  };
  window.addEventListener('deviceorientation', h);
  return () => window.removeEventListener('deviceorientation', h);
}
