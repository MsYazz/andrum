// Ljudvakten. Den sitter allra sist i ljudkedjan och ser varje sampel innan det når
// högtalaren eller hörlurarna. Den finns för att ett plötsligt starkt ljud aldrig ska
// kunna nå fram, oavsett vad som har gått fel längre upp i kedjan.
//
// - Trasiga sampel (NaN eller oändligt) byts mot tystnad.
// - Blir nivån eller diskanten plötsligt för stark stängs ljudet på några millisekunder,
//   och huvudtråden får ett larm så att den kan koppla bort det som lät.
// - Allt som passerar har ett mjukt tak, så att inget sampel kan bli fullt utslag.
// - Efter ett larm öppnas ljudet bara igen på begäran, och då långsamt.

const KNA = 0.35;         // under detta passerar ljudet orört
const TAK = 0.55;         // mjukt tak för varje sampel, som aldrig kan överskridas
const tak = (y) => {
  const a = Math.abs(y);
  if (a <= KNA) return y;
  return Math.sign(y) * (KNA + (TAK - KNA) * Math.tanh((a - KNA) / (TAK - KNA)));
};
const NIVA_MAX = 0.35;    // högsta tillåtna medelnivå (RMS) under 10 ms, vanliga rum ligger under 0,15
const DISKANT_MAX = 0.15; // högsta tillåtna nivå på skillnaden mellan sampel, som blir stor för brus (vanligt: under 0,05)

class Vakt extends AudioWorkletProcessor {
  constructor() {
    super();
    this.g = 1;
    this.mal = 1;
    this.upp = 1 / (sampleRate * 2);       // öppnar på två sekunder
    this.ner = 1 / (sampleRate * 0.003);   // stänger på tre millisekunder
    this.a = 1 - Math.exp(-1 / (sampleRate * 0.01));
    this.niva = 0;
    this.diskant = 0;
    this.forra = [0, 0];
    this.larmad = false;
    this.topp = 0;
    this.maxNiva = 0;
    this.maxDiskant = 0;
    this.rakna = 0;
    this.port.onmessage = (e) => {
      if (e.data === 'oppna') { this.larmad = false; this.mal = 1; this.niva = 0; this.diskant = 0; }
      if (e.data === 'stang') this.mal = 0;
    };
  }

  process(inputs, outputs) {
    const inp = inputs[0] || [];
    const out = outputs[0];
    const kanaler = out.length;
    const n = out[0].length;
    for (let i = 0; i < n; i++) {
      let s2 = 0, d2 = 0, trasig = false;
      for (let c = 0; c < kanaler; c++) {
        const k = inp[c] || inp[0];
        let x = k ? k[i] : 0;
        if (!Number.isFinite(x)) { trasig = true; x = 0; }
        const d = x - this.forra[c & 1];
        this.forra[c & 1] = x;
        s2 += x * x;
        d2 += d * d;
        out[c][i] = x;
      }
      s2 /= kanaler; d2 /= kanaler;
      this.niva += (s2 - this.niva) * this.a;
      this.diskant += (d2 - this.diskant) * this.a;
      if (!this.larmad && (trasig || this.niva > NIVA_MAX * NIVA_MAX || this.diskant > DISKANT_MAX * DISKANT_MAX)) {
        this.larmad = true;
        this.mal = 0;
        this.port.postMessage({
          larm: trasig ? 'trasigt' : this.niva > NIVA_MAX * NIVA_MAX ? 'starkt' : 'brus',
          niva: Math.sqrt(this.niva),
          diskant: Math.sqrt(this.diskant),
        });
      }
      if (this.niva > this.maxNiva) this.maxNiva = this.niva;
      if (this.diskant > this.maxDiskant) this.maxDiskant = this.diskant;
      if (this.g > this.mal) this.g = Math.max(this.mal, this.g - this.ner);
      else if (this.g < this.mal) this.g = Math.min(this.mal, this.g + this.upp);
      for (let c = 0; c < kanaler; c++) {
        const y = out[c][i] * this.g;
        out[c][i] = tak(y);
        const ay = Math.abs(y);
        if (ay > this.topp) this.topp = ay;
      }
    }
    // Rapportera nivåerna ungefär en gång i sekunden, för felsökning
    this.rakna += n;
    if (this.rakna > sampleRate) {
      this.port.postMessage({ topp: this.topp, niva: Math.sqrt(this.maxNiva), diskant: Math.sqrt(this.maxDiskant) });
      this.rakna = 0;
      this.topp = 0;
      this.maxNiva = 0;
      this.maxDiskant = 0;
    }
    return true;
  }
}

registerProcessor('andrum-vakt', Vakt);
