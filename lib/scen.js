// Gemensam grund för rummen: ljudutgång, ritslinga, fingrar och stängning.

import { ljud, sov } from './ljud.js';
import { slappGL } from './gl.js';

export const mjuk = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const slump = (a, b) => a + Math.random() * (b - a);
export const klamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const blanda = (a, b, t) => a + (b - a) * t;

// Snabbspolning för att prova ett rum, till exempel ?fart=4
export const TIDSSKALA = Math.min(8, Number(new URLSearchParams(location.search).get('fart')) || 1);

// Ljudutgång för ett rum som tonar in mjukt.
export function rumsLjud(styrka = 1.2, tona = 1.2) {
  const { ctx, master } = ljud();
  const ut = ctx.createGain();
  ut.gain.value = 0;
  ut.connect(master);
  ut.gain.setTargetAtTime(styrka, ctx.currentTime, tona);
  return { ctx, ut, kallor: [] };
}

// Ritslinga. fn(tid, dt) i sekunder, med snabbspolning inräknad.
export function slinga(fn) {
  const t0 = performance.now();
  let forra = t0, raf = 0, stopp = false;
  const tick = (nu) => {
    if (stopp) return;
    // Bildrutans tidsstämpel kan ligga en aning före starten, så dt får aldrig bli negativt
    const dt = Math.max(0, Math.min(0.1, (nu - forra) / 1000)) * TIDSSKALA;
    forra = nu;
    fn(((nu - t0) / 1000) * TIDSSKALA, dt);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => { stopp = true; cancelAnimationFrame(raf); };
}

// Kör fysik i fasta steg, oavsett bildfrekvens.
export function fastaSteg(steglangd, maxSteg = 12) {
  let ack = 0;
  maxSteg *= TIDSSKALA;
  return (dt, fn) => {
    ack += dt;
    let n = 0;
    while (ack >= steglangd && n < maxSteg) { fn(steglangd); ack -= steglangd; n++; }
    if (n >= maxSteg) ack = 0;
  };
}

// Fingrar. Anropar ner, drag och upp med css-koordinater och ett id per finger.
// Med { ett: true } följs bara det första fingret tills det lyfts. Det passar rum där
// fingret håller i en sak (en pensel, ett bloss), så att ett andra finger inte får
// saken att hoppa fram och tillbaka mellan fingrarna.
export function fingrar(duk, { ner, drag, upp } = {}, { ett = false } = {}) {
  const aktiva = new Map();
  duk.addEventListener('pointerdown', (e) => {
    if (ett && aktiva.size) return;
    aktiva.set(e.pointerId, { x0: e.clientX, y0: e.clientY, t0: e.timeStamp });
    try { duk.setPointerCapture(e.pointerId); } catch {}
    ner?.(e.clientX, e.clientY, e.pointerId, e);
  });
  duk.addEventListener('pointermove', (e) => {
    if (!aktiva.has(e.pointerId)) return;
    const lista = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const h of (lista.length ? lista : [e])) drag?.(h.clientX, h.clientY, e.pointerId, h);
  });
  const slut = (e) => {
    const a = aktiva.get(e.pointerId);
    if (!a) return;
    aktiva.delete(e.pointerId);
    // Ett tryck får darra lite, så att skakiga fingrar också räknas som ett tryck
    const tryck = Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 18 && e.timeStamp - a.t0 < 450;
    upp?.(e.clientX, e.clientY, e.pointerId, { tryck, e });
  };
  duk.addEventListener('pointerup', slut);
  duk.addEventListener('pointercancel', slut);
  return aktiva;
}

// Stänger ett rum: tonar ut ljudet, stoppar slingan och städar.
export function stangning({ ljud: l, stoppa, gl, extra = [] }) {
  return async () => {
    l.ut.gain.setTargetAtTime(0, l.ctx.currentTime, 0.3);
    await sov(1300);
    stoppa?.();
    for (const f of extra) { try { f(); } catch {} }
    for (const k of l.kallor) { try { k.stop(); } catch {} }
    l.ut.disconnect();
    if (gl) slappGL(gl);
  };
}

// En mjuk bubbla: kort sinuston som glider uppåt, som när vatten blubbar.
export function bubbla(ctx, till, f0, styrka = 0.05, nar = ctx.currentTime) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, nar);
  o.frequency.exponentialRampToValueAtTime(f0 * 1.55, nar + 0.12);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = Math.min(6000, f0 * 4);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, nar);
  g.gain.linearRampToValueAtTime(styrka, nar + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, nar + 0.26);
  o.connect(lp).connect(g).connect(till);
  o.start(nar);
  o.stop(nar + 0.3);
}

// En klang med egna deltoner (modalsyntes). delar = [[förhållande, styrka, avklingning i s], ...]
export function klang(ctx, till, f, delar, { styrka = 0.05, ansats = 0.005, eko, nar = ctx.currentTime } = {}) {
  const g = ctx.createGain();
  g.gain.value = styrka;
  g.connect(till);
  if (eko) g.connect(eko);
  let langst = 0;
  for (const [k, a, avk] of delar) {
    const o = ctx.createOscillator();
    o.frequency.value = f * k;
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, nar);
    og.gain.linearRampToValueAtTime(a, nar + ansats);
    og.gain.exponentialRampToValueAtTime(0.0001, nar + ansats + avk);
    o.connect(og).connect(g);
    o.start(nar);
    o.stop(nar + ansats + avk + 0.05);
    langst = Math.max(langst, avk);
  }
  return langst;
}

// Kort brusstöt, till klick, knaster och steg.
let stotBuffer = null;
export function brusstot(ctx, till, { frekvens = 2500, q = 1, styrka = 0.2, langd = 0.003, nar = ctx.currentTime } = {}) {
  if (!stotBuffer || stotBuffer.sampleRate !== ctx.sampleRate) {
    const n = Math.floor(ctx.sampleRate * 0.25);
    stotBuffer = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = stotBuffer.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource();
  s.buffer = stotBuffer;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = frekvens;
  bp.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(styrka, nar);
  g.gain.exponentialRampToValueAtTime(0.0001, nar + langd * 6);
  s.connect(bp).connect(g).connect(till);
  s.start(nar, Math.random() * 0.2, langd * 6 + 0.01);
}
