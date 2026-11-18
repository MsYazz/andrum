// Ett kort haptiskt klick.
// Android har navigator.vibrate. Safari på iPhone saknar det, men från iOS 18
// ger en omkopplare (<input type="checkbox" switch>) ett litet systemklick när den
// växlas. Det fungerar bara inne i en tryckning.

let etikett = null;

export function knack() {
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(10);
      return;
    }
    if (!etikett) {
      etikett = document.createElement('label');
      etikett.setAttribute('aria-hidden', 'true');
      etikett.style.cssText = 'position:fixed;left:-200px;top:0;opacity:0;pointer-events:none;';
      const omk = document.createElement('input');
      omk.type = 'checkbox';
      omk.setAttribute('switch', '');
      omk.tabIndex = -1;
      etikett.append(omk);
      document.body.append(etikett);
    }
    etikett.click();
  } catch {}
}
