// Chiptune sound effects, synthesized with square waves like an 8-bit console.
// iPhones only allow sound after a tap, so unlockAudio() runs on the first button press.

const MUTE_KEY = 'pawse.muted';
let ctx;

export const isMuted = () => localStorage.getItem(MUTE_KEY) === '1';

export function setMuted(muted) {
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
}

export function unlockAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  ctx ??= new AudioCtx();
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  const blip = ctx.createBufferSource();
  blip.buffer = ctx.createBuffer(1, 1, 22050);
  blip.connect(ctx.destination);
  blip.start(0);
}

function note(freq, start, duration, volume = 0.12, type = 'square') {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.setValueAtTime(volume, start + duration * 0.8);
  gain.gain.linearRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function ready() {
  if (!ctx || isMuted()) return false;
  ctx.resume().catch(() => {});
  return true;
}

// Your recorded "wanna play?" call. Uses an <audio> element so it plays like normal media.
const callClip = new Audio('sounds/wanna-play.mp3');
callClip.preload = 'auto';

/** Plays the call (even with SFX off, since you asked for it). Resolves when it finishes. */
export function playCall() {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(fallback);
      callClip.removeEventListener('ended', done);
      callClip.removeEventListener('error', done);
      resolve();
    };
    const fallback = setTimeout(done, 6000); // never get stuck if the clip can't play
    callClip.addEventListener('ended', done);
    callClip.addEventListener('error', done);
    callClip.currentTime = 0;
    callClip.play().catch(done);
  });
}

/** Short UI blip for button presses. */
export function playBlip(high = false) {
  if (!ready()) return;
  note(high ? 988 : 659, ctx.currentTime + 0.01, 0.06, 0.06);
}

/** "Let's go!" rising arpeggio when play starts. */
export function playStart() {
  if (!ready()) return;
  const t = ctx.currentTime + 0.02;
  [523, 659, 784, 1047].forEach((f, i) => note(f, t + i * 0.07, 0.08, 0.08));
}

/** Stage-clear style jingle when play time is over. Plays twice. */
export function playChime() {
  if (!ready()) return;
  const melody = [
    [784, 0.12], [988, 0.12], [1175, 0.12], [1568, 0.36],
    [1319, 0.12], [1568, 0.48],
  ];
  const bass = [[196, 0.48], [247, 0.48], [262, 0.6]];
  for (let round = 0; round < 2; round++) {
    let t = ctx.currentTime + 0.05 + round * 1.7;
    for (const [f, d] of melody) {
      note(f, t, d * 0.95, 0.1);
      t += d;
    }
    t = ctx.currentTime + 0.05 + round * 1.7;
    for (const [f, d] of bass) {
      note(f, t, d * 0.95, 0.12, 'triangle');
      t += d;
    }
  }
}
