// Vem appen är till. De personliga korten (julkortet med rimmet när appen öppnas första
// gången och julkortet i Grottan på julafton) visas bara när länken har flaggan
// ?till=vivan, så att andra kan prova appen utan att se dem. Flaggan sparas, och den
// skrivs in i hemskärmsappens startadress, eftersom en hemskärmsapp på iPhone har ett
// eget minne och startar på sin egen adress. ?till=ingen stänger av den igen.

const NYCKEL = 'andrum.till';

function las() {
  let till = null;
  try {
    const p = new URLSearchParams(location.search);
    if (p.has('till')) {
      till = p.get('till') === 'vivan' ? 'vivan' : null;
      if (till) localStorage.setItem(NYCKEL, till); else localStorage.removeItem(NYCKEL);
      return till;
    }
    till = localStorage.getItem(NYCKEL);
  } catch {}
  return till === 'vivan' ? 'vivan' : null;
}

export const tillVivan = las() === 'vivan';

// Med flaggan pekar hemskärmen på en startbeskrivning där flaggan ingår
if (tillVivan) {
  const lank = document.querySelector('link[rel="manifest"]');
  if (lank) lank.setAttribute('href', 'manifest-vivan.webmanifest');
}
