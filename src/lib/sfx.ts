// Small WebAudio sound kit; no audio files needed. Soft mallet tones for
// right answers, a pen scratch for corrections, paper sounds for cards.
let ctx: AudioContext | null = null;
let out: AudioNode | null = null;

function audio(): { ctx: AudioContext; out: AudioNode } {
  if (!ctx) {
    ctx = new AudioContext();
    // Gentle master chain: a low-pass takes the edge off, a compressor keeps levels even.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5200;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 3;
    lp.connect(comp).connect(ctx.destination);
    out = lp;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, out: out! };
}

/** Mallet-like note: a sine plus a quickly fading overtone. */
function note(freq: number, start: number, dur: number, gain = 0.07) {
  const { ctx, out } = audio();
  const t = ctx.currentTime + start;
  for (const [mult, level, decay] of [
    [1, 1, dur],
    [2.76, 0.18, dur * 0.35],
  ] as const) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * mult, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain * level, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  }
}

/** Filtered noise burst: paper flips, pen scratches, soft clicks. */
function noise(start: number, dur: number, freq: number, q: number, gain: number) {
  const { ctx, out } = audio();
  const t = ctx.currentTime + start;
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(out);
  src.start(t);
}

export type Sfx = 'correct' | 'wrong' | 'combo' | 'tick' | 'finish' | 'flip';

const HAPTIC: Partial<Record<Sfx, number | number[]>> = { correct: 8, wrong: [14, 60, 14], combo: [8, 40, 8, 40, 12] };

export function play(sfx: Sfx, enabled: boolean) {
  // A light tap on phones that support it (Android); silent elsewhere.
  const h = HAPTIC[sfx];
  if (h && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(h);
    } catch {
      /* not allowed */
    }
  }
  if (!enabled) return;
  try {
    switch (sfx) {
      case 'correct':
        note(659.3, 0, 0.35); // E5
        note(987.8, 0.07, 0.5, 0.06); // B5
        break;
      case 'wrong':
        noise(0, 0.16, 2600, 1.2, 0.05); // pen scratch
        note(220, 0.02, 0.3, 0.06);
        note(196, 0.12, 0.4, 0.05);
        break;
      case 'combo':
        [784, 987.8, 1318.5].forEach((f, i) => note(f, i * 0.065, 0.4, 0.055));
        break;
      case 'tick':
        noise(0, 0.03, 1800, 4, 0.06);
        break;
      case 'flip':
        noise(0, 0.12, 1400, 0.7, 0.035);
        break;
      case 'finish':
        [523.3, 659.3, 784, 1046.5].forEach((f, i) => note(f, i * 0.1, 0.6, 0.06));
        break;
    }
  } catch {
    /* audio unavailable */
  }
}
