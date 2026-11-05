/**
 * Звуки тренажера, синтезовані через Web Audio API (без аудіофайлів і ліцензій).
 * Звуки м'які й тихі; помилка — лагідний низький тон, а не «сирена».
 */
type Kind = 'move' | 'star' | 'success' | 'oops' | 'badge' | 'tap';

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(v: boolean) {
  muted = v;
}

function audio(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    ctx = AC ? new AC() : null;
  } catch {
    ctx = null;
  }
  return ctx;
}

function tone(ac: AudioContext, freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.12) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + start);
  gain.gain.setValueAtTime(0.0001, ac.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(vol, ac.currentTime + start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + dur + 0.05);
}

export function play(kind: Kind) {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  try {
    if (ac.state === 'suspended') void ac.resume();
    switch (kind) {
      case 'tap':
        tone(ac, 660, 0, 0.06, 'triangle', 0.05);
        break;
      case 'move':
        tone(ac, 420, 0, 0.08, 'triangle', 0.14);
        tone(ac, 260, 0.02, 0.07, 'sine', 0.08);
        break;
      case 'star':
        tone(ac, 988, 0, 0.12, 'triangle', 0.1);
        tone(ac, 1319, 0.07, 0.18, 'triangle', 0.1);
        break;
      case 'success':
        [523, 659, 784, 1047].forEach((f, i) => tone(ac, f, i * 0.09, 0.25, 'triangle', 0.11));
        break;
      case 'badge':
        [784, 988, 1175, 1568].forEach((f, i) => tone(ac, f, i * 0.11, 0.3, 'sine', 0.1));
        break;
      case 'oops':
        tone(ac, 349, 0, 0.18, 'sine', 0.09);
        tone(ac, 294, 0.14, 0.26, 'sine', 0.08);
        break;
    }
  } catch {
    /* звук — не критичний */
  }
}
