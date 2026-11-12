// Effects: synthesized chiptune sound (no files), vibration and confetti. If anything fails, the game goes on.
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CONFETTI = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.4/+esm';
let ctx;

export let muted = false;
export const setMuted = m => (muted = m);

// Browsers only play audio created or resumed during a user gesture.
export function unlock() {
  if (muted) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state !== 'running') ctx.resume();
  } catch {}
}

function beep(freq, duration, type, delay = 0, volume = 0.06) {
  if (muted) return;
  try {
    ctx ??= new AudioContext();
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration);
  } catch {}
}

// One "tick" per tile, higher-pitched as the word gets longer.
export function tick(n) {
  beep(440 + 90 * n, 0.04, 'square', 0, 0.03);
  navigator.vibrate?.(10);
}

export function good(len) {
  [523, 659, 784, 1047].slice(0, Math.min(4, len - 1)).forEach((f, k) => beep(f, 0.14, 'triangle', k * 0.05, 0.06));
}

export function gold() {
  beep(1568, 0.2, 'triangle', 0.12, 0.06);
  beep(2093, 0.3, 'triangle', 0.2, 0.05);
}

export function bad() {
  beep(150, 0.15, 'sawtooth', 0, 0.05);
}

export function win() {
  [523, 659, 784, 1047].forEach((f, k) => beep(f, 0.25, 'triangle', 0.15 + k * 0.09, 0.08));
  if (calm) return;
  import(CONFETTI)
    .then(m => m.default({ particleCount: 160, spread: 90, origin: { y: 0.6 }, colors: ['#00e5ff', '#ff2bd6', '#39ff88', '#ffd23f'] }))
    .catch(() => {});
}
