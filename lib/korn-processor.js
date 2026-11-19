// Kornsyntes för sand. Varje sandkorn som landar blir ett eget, ytterst kort brusknäpp
// utan tonhöjd. Sand låter inte som toner: ett korn som träffar något ger ett litet
// tonlöst knäpp, och tusentals sådana i sekunden blir ett fint, levande sus. Tonade
// knäpp (korta svängningar) låter i stället som droppar och bubblor, alltså vatten.
//
// Det som styr kommer från sandens simulering:
// - tathet: hur många korn som landar per sekund
// - ljus:   hur långt kornen faller. Långa fall ger ljusare och skarpare knäpp.
// - glas:   hur stor del av kornen som träffar glaset. De ger ibland ett svagt klirr.
// - ras:    korn som glider nedför sandhögen, mörkare, längre och mjukare
//
// Styrkan hålls låg, så att ljudvakten aldrig ser något skarpt.

const GLASTONER = [2730, 4170, 5890, 7310];

class Korn extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'tathet', defaultValue: 0, minValue: 0, maxValue: 8000, automationRate: 'k-rate' },
      { name: 'ljus', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'glas', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'ras', defaultValue: 0, minValue: 0, maxValue: 4000, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.korn = [];
    this.toner = [];
    // Ett mjukt högpassfilter på allt, så att knäppen aldrig dunsar
    this.hpL = 0; this.hpR = 0; this.xL = 0; this.xR = 0;
    this.hpA = Math.exp(-2 * Math.PI * 900 / sampleRate);
  }

  nyttKorn(ljus, ras) {
    if (this.korn.length > 128) return;
    let langd, medel, lp;
    if (ras) {
      // Glidande korn: längre och mörkare gnissel av sand mot sand
      langd = 0.0004 + Math.random() * 0.0012;
      medel = 0.004;
      lp = 2500 + Math.random() * 1500;
    } else {
      // Landande korn: kortare och ljusare ju längre de har fallit
      langd = 0.00008 + Math.random() * (0.0003 - 0.0002 * ljus);
      medel = 0.0055 + 0.0055 * ljus;
      lp = 4500 + 9000 * ljus * (0.7 + 0.6 * Math.random());
    }
    // De flesta korn är svaga, några lite starkare, som när riktiga korn träffar
    const amp = Math.min(medel * 4, medel * -Math.log(Math.random() + 1e-6));
    const pan = (Math.random() * 2 - 1) * 0.55;
    const n = Math.max(3, Math.round(langd * sampleRate));
    this.korn.push({
      pos: 0, n, amp, y: 0,
      // Avklingningen per sampel, så att knäppet dör ut över sin längd
      avkl: Math.exp(-5 / n),
      // Ett enkelt lågpassfilter per korn bestämmer hur ljust det låter
      lpA: 1 - Math.exp(-2 * Math.PI * Math.min(lp, sampleRate * 0.45) / sampleRate),
      vl: Math.cos((pan + 1) * Math.PI / 4), vh: Math.sin((pan + 1) * Math.PI / 4),
    });
  }

  nyTon() {
    if (this.toner.length > 4) return;
    const f = GLASTONER[Math.floor(Math.random() * GLASTONER.length)] * (1 + (Math.random() * 2 - 1) * 0.02);
    const tau = 0.02 + Math.random() * 0.05;
    this.toner.push({
      fas: 0, dfas: (6.283 * f) / sampleRate, amp: 0.0006 + Math.random() * 0.0012,
      avkl: Math.exp(-1 / (tau * sampleRate)), pan: (Math.random() * 2 - 1) * 0.4,
    });
  }

  process(inputs, outputs, params) {
    const ut = outputs[0];
    const L = ut[0], R = ut[1] || ut[0];
    const n = L.length;
    const pKorn = params.tathet[0] / sampleRate;
    const pRas = params.ras[0] / sampleRate;
    const ljus = params.ljus[0], glas = params.glas[0];
    const a = this.hpA;
    for (let i = 0; i < n; i++) {
      if (Math.random() < pKorn) {
        this.nyttKorn(ljus, false);
        if (glas > 0 && Math.random() < glas * 0.012) this.nyTon();
      }
      if (Math.random() < pRas) this.nyttKorn(0, true);
      let l = 0, r = 0;
      for (let k = 0; k < this.korn.length; k++) {
        const g = this.korn[k];
        if (g.pos >= g.n) continue;
        // Tonlöst brus som klingar av snabbt, filtrerat till kornets ljushet
        const x = (Math.random() * 2 - 1) * g.amp;
        g.y += (x - g.y) * g.lpA;
        g.amp *= g.avkl;
        g.pos++;
        l += g.y * g.vl; r += g.y * g.vh;
      }
      for (let k = 0; k < this.toner.length; k++) {
        const t = this.toner[k];
        const v = Math.sin(t.fas) * t.amp;
        t.fas += t.dfas; t.amp *= t.avkl;
        l += v * (1 - t.pan) * 0.5; r += v * (1 + t.pan) * 0.5;
      }
      // Högpass: y[n] = a * (y[n-1] + x[n] - x[n-1])
      this.hpL = a * (this.hpL + l - this.xL); this.xL = l;
      this.hpR = a * (this.hpR + r - this.xR); this.xR = r;
      L[i] = this.hpL; R[i] = this.hpR;
    }
    // Städa bort korn och toner som har klingat ut
    this.korn = this.korn.filter((g) => g.pos < g.n);
    this.toner = this.toner.filter((t) => t.amp > 1e-5);
    return true;
  }
}

registerProcessor('andrum-korn', Korn);
