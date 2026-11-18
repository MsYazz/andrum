// Telefonens lutning.
// På iPhone måste man be om lov att läsa rörelsesensorn, och frågan måste
// ställas direkt i en tryckning. Därför anropas begarRorelse() när dörren trycks.

export function begarRorelse() {
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === 'function') {
    try { DOE.requestPermission().catch(() => {}); } catch {}
  }
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
