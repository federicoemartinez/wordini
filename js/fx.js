// Efectos: sonido chiptune sintetizado (sin archivos), vibración y confetti. Si algo falla, el juego sigue.
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CONFETTI = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.4/+esm';
let ctx;

export let muted = false;
export const setMuted = m => (muted = m);

// Los navegadores solo dejan sonar audio creado o reanudado durante un gesto del usuario.
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

export function tick() {
  beep(1800, 0.03, 'square', 0, 0.03);
  navigator.vibrate?.(10);
}

export function clack() {
  beep(140, 0.12, 'sawtooth', 0, 0.08);
  beep(90, 0.15, 'square', 0.04, 0.06);
}

export function win() {
  [523, 659, 784, 1047].forEach((f, k) => beep(f, 0.25, 'triangle', 0.15 + k * 0.09, 0.08));
  if (calm) return;
  import(CONFETTI)
    .then(m => m.default({ particleCount: 160, spread: 90, origin: { y: 0.6 }, colors: ['#00e5ff', '#ff2bd6', '#39ff88'] }))
    .catch(() => {});
}

export function lose() {
  [392, 330, 262].forEach((f, k) => beep(f, 0.3, 'sawtooth', 0.15 + k * 0.15, 0.05));
}
