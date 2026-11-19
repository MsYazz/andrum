// Vem appen är till. De personliga korten (julkortet med rimmet när appen öppnas första
// gången och julkortet i Grottan på julafton) visas bara när länken har en mottagare:
//   ?till=vivan   korten till Vivan
//   ?till=barnen  provkort till dem som provar appen, med samma utseende men egen text
//   ?till=ingen   inga kort
// Mottagaren sparas, och den skrivs in i hemskärmsappens startadress, eftersom en
// hemskärmsapp på iPhone har ett eget minne och startar på sin egen adress.

const NYCKEL = 'andrum.till';
const KANDA = ['vivan', 'barnen'];

function las() {
  try {
    const p = new URLSearchParams(location.search);
    if (p.has('till')) {
      const till = KANDA.includes(p.get('till')) ? p.get('till') : null;
      if (till) localStorage.setItem(NYCKEL, till); else localStorage.removeItem(NYCKEL);
      return till;
    }
    const sparad = localStorage.getItem(NYCKEL);
    return KANDA.includes(sparad) ? sparad : null;
  } catch {
    return null;
  }
}

export const mottagare = las();
export const tillVivan = mottagare === 'vivan';

// Med en mottagare pekar hemskärmen på en startbeskrivning där mottagaren ingår
if (mottagare) {
  const lank = document.querySelector('link[rel="manifest"]');
  if (lank) lank.setAttribute('href', `manifest-${mottagare}.webmanifest`);
}
