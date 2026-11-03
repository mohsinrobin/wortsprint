// Tiny WebAudio sound effects; no audio files needed.
let ctx: AudioContext | null = null;

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.06) {
  if (!ctx) ctx = new AudioContext();
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export type Sfx = 'correct' | 'wrong' | 'combo' | 'tick' | 'finish' | 'flip';

export function play(sfx: Sfx, enabled: boolean) {
  if (!enabled) return;
  try {
    switch (sfx) {
      case 'correct':
        tone(660, 0, 0.12);
        tone(990, 0.08, 0.16);
        break;
      case 'wrong':
        tone(196, 0, 0.22, 'triangle', 0.07);
        break;
      case 'combo':
        tone(784, 0, 0.1);
        tone(988, 0.07, 0.1);
        tone(1318, 0.14, 0.18);
        break;
      case 'tick':
        tone(1200, 0, 0.04, 'square', 0.02);
        break;
      case 'flip':
        tone(520, 0, 0.06, 'sine', 0.03);
        break;
      case 'finish':
        [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.22));
        break;
    }
  } catch {
    /* audio unavailable */
  }
}
