// Synthesized Web Audio FX — no wav assets required.
// initAudio() must be called from a user gesture (autoplay policy).

let ctx: AudioContext | null = null;
let hum: { osc: OscillatorNode; noise: AudioBufferSourceNode } | null = null;

const reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function ensureCtx(): AudioContext | null {
  if (reducedMotion) return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }
  return ctx;
}

/** Call once from the first user gesture. */
export function initAudio(): void {
  ensureCtx();
}

/** Switch toggle click — short square blip. */
export function click(): void {
  const c = ensureCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'square';
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.05, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.05);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.06);
}

/** Hopper drop — mechanical clack-chunk. */
export function clack(): void {
  const c = ensureCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(170, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(52, c.currentTime + 0.12);
  gain.gain.setValueAtTime(0.14, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.16);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.17);

  // Second thump for the "chunk"
  const osc2 = c.createOscillator();
  const g2 = c.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(90, c.currentTime + 0.04);
  osc2.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.14);
  g2.gain.setValueAtTime(0.0001, c.currentTime + 0.04);
  g2.gain.linearRampToValueAtTime(0.1, c.currentTime + 0.06);
  g2.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.15);
  osc2.connect(g2).connect(c.destination);
  osc2.start(c.currentTime + 0.04);
  osc2.stop(c.currentTime + 0.16);
}

/** CRT hum (60 Hz + filtered noise) — call while terminal is streaming. */
export function startCrtHum(): void {
  const c = ensureCtx();
  if (!c || hum) return;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 60;
  const g = c.createGain();
  g.gain.value = 0.012;

  const len = c.sampleRate;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const noise = c.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const ng = c.createGain();
  ng.gain.value = 0.0035;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;

  noise.connect(lp);
  lp.connect(ng);
  ng.connect(c.destination);
  osc.connect(g);
  g.connect(c.destination);
  osc.start();
  noise.start();
  hum = { osc, noise };
}

export function stopCrtHum(): void {
  if (!hum || !ctx) return;
  try {
    hum.osc.stop();
    hum.noise.stop();
  } catch {
    // already stopped
  }
  hum = null;
}
