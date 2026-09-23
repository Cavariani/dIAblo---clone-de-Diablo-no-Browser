// Procedural sound recipes rendered offline into AudioBuffers (for ids without files or to layer on top).

type Recipe = (ctx: OfflineAudioContext) => void;

function env(ctx: BaseAudioContext, g: GainNode, t0: number, a: number, peak: number, d: number): void {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}

function tone(ctx: OfflineAudioContext, freq: number, t0: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode = ctx.destination, detune = 0): void {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  env(ctx, g, t0, 0.01, vol, dur);
  o.connect(g).connect(dest);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(ctx: OfflineAudioContext, t0: number, dur: number, vol: number, filterType: BiquadFilterType, f0: number, f1: number, q = 1): void {
  const len = Math.ceil(ctx.sampleRate * (dur + 0.05));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = filterType;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t0);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  const g = ctx.createGain();
  env(ctx, g, t0, 0.005, vol, dur);
  s.connect(f).connect(g).connect(ctx.destination);
  s.start(t0);
}

function reverbish(ctx: OfflineAudioContext): ConvolverNode {
  const len = Math.floor(ctx.sampleRate * 1.8);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  conv.connect(ctx.destination);
  return conv;
}

const fanfare = (root: number): Recipe => (ctx) => {
  const rev = reverbish(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.35;
  wet.connect(rev);
  // sub impact
  tone(ctx, 55, 0, 0.9, 'sine', 0.55);
  noise(ctx, 0, 0.35, 0.25, 'lowpass', 900, 120);
  // rising arpeggio
  const notes = [0, 4, 7, 12, 16, 19, 24];
  notes.forEach((n, i) => {
    const f = root * Math.pow(2, n / 12);
    tone(ctx, f, 0.06 + i * 0.07, 0.9, 'triangle', 0.16, ctx.destination);
    tone(ctx, f * 2, 0.06 + i * 0.07, 0.6, 'sine', 0.06, wet);
  });
  // shimmering bell cluster + choir-ish pad
  for (const n of [24, 28, 31, 36]) tone(ctx, root * Math.pow(2, n / 12), 0.55, 1.6, 'sine', 0.07, wet, Math.random() * 8);
  for (const n of [0, 7, 12, 16]) {
    tone(ctx, root * Math.pow(2, n / 12), 0.45, 1.8, 'sawtooth', 0.025, wet, -7);
    tone(ctx, root * Math.pow(2, n / 12), 0.45, 1.8, 'sawtooth', 0.025, wet, 7);
  }
};

export const RECIPES: Record<string, { dur: number; fn: Recipe }> = {
  drop_legendary: { dur: 2.6, fn: fanfare(261.63) },
  drop_set: { dur: 2.6, fn: fanfare(293.66) },
  paragon_up: { dur: 2.2, fn: fanfare(329.63) },
  quest_complete: {
    dur: 1.6,
    fn: (ctx) => {
      const rev = reverbish(ctx);
      [0, 4, 7, 12].forEach((n, i) => tone(ctx, 392 * Math.pow(2, n / 12), i * 0.1, 0.8, 'triangle', 0.18, i === 3 ? rev : ctx.destination));
    },
  },
  rift_open: {
    dur: 2.4,
    fn: (ctx) => {
      noise(ctx, 0, 2, 0.35, 'bandpass', 200, 2400, 4);
      tone(ctx, 73, 0, 2, 'sawtooth', 0.12);
      tone(ctx, 110, 0.2, 1.8, 'sine', 0.2);
    },
  },
  rift_complete: { dur: 2.6, fn: fanfare(220) },
  rift_guardian: {
    dur: 2.2,
    fn: (ctx) => {
      tone(ctx, 45, 0, 2, 'sawtooth', 0.3);
      noise(ctx, 0, 1.8, 0.35, 'lowpass', 1200, 80);
    },
  },
  boss_phase: {
    dur: 1.8,
    fn: (ctx) => {
      tone(ctx, 55, 0, 1.6, 'square', 0.18);
      tone(ctx, 58, 0, 1.6, 'square', 0.18);
      noise(ctx, 0, 1.2, 0.3, 'lowpass', 2000, 100);
    },
  },
  hit_fire: { dur: 0.4, fn: (ctx) => noise(ctx, 0, 0.35, 0.45, 'lowpass', 3000, 300) },
  hit_cold: {
    dur: 0.4,
    fn: (ctx) => {
      noise(ctx, 0, 0.25, 0.3, 'highpass', 3000, 6000);
      tone(ctx, 1800, 0, 0.2, 'sine', 0.08);
    },
  },
  hit_lightning: {
    dur: 0.35,
    fn: (ctx) => {
      noise(ctx, 0, 0.12, 0.45, 'bandpass', 5000, 1500, 2);
      noise(ctx, 0.08, 0.2, 0.3, 'bandpass', 3000, 800, 2);
    },
  },
  hit_poison: { dur: 0.4, fn: (ctx) => noise(ctx, 0, 0.35, 0.3, 'bandpass', 600, 200, 3) },
  hit_arcane: {
    dur: 0.4,
    fn: (ctx) => {
      tone(ctx, 880, 0, 0.3, 'sine', 0.12);
      tone(ctx, 1320, 0.02, 0.3, 'sine', 0.08);
      noise(ctx, 0, 0.2, 0.15, 'highpass', 2000, 4000);
    },
  },
  whirlwind_loop: { dur: 0.6, fn: (ctx) => noise(ctx, 0, 0.55, 0.35, 'bandpass', 400, 1600, 1.5) },
  charge: { dur: 0.6, fn: (ctx) => noise(ctx, 0, 0.55, 0.4, 'lowpass', 1600, 200) },
  roll: { dur: 0.4, fn: (ctx) => noise(ctx, 0, 0.35, 0.3, 'lowpass', 800, 200) },
  turret: {
    dur: 0.5,
    fn: (ctx) => {
      tone(ctx, 220, 0, 0.2, 'square', 0.08);
      noise(ctx, 0.05, 0.3, 0.2, 'bandpass', 1200, 400, 3);
    },
  },
  explosive_arrow: { dur: 0.8, fn: (ctx) => noise(ctx, 0, 0.7, 0.55, 'lowpass', 2500, 120) },
  explode_suicide: {
    dur: 0.9,
    fn: (ctx) => {
      noise(ctx, 0, 0.8, 0.6, 'lowpass', 3000, 90);
      tone(ctx, 60, 0, 0.6, 'sine', 0.5);
    },
  },
  ui_hover: { dur: 0.08, fn: (ctx) => tone(ctx, 1400, 0, 0.05, 'sine', 0.05) },
  ui_tab: { dur: 0.1, fn: (ctx) => tone(ctx, 900, 0, 0.07, 'triangle', 0.08) },
  ui_toast: { dur: 0.3, fn: (ctx) => [0, 7].forEach((n, i) => tone(ctx, 660 * Math.pow(2, n / 12), i * 0.06, 0.2, 'sine', 0.08)) },
  inventory_full: { dur: 0.3, fn: (ctx) => tone(ctx, 180, 0, 0.25, 'square', 0.08) },
  waypoint_activate: {
    dur: 1.4,
    fn: (ctx) => {
      const rev = reverbish(ctx);
      [0, 7, 12, 19].forEach((n, i) => tone(ctx, 330 * Math.pow(2, n / 12), i * 0.08, 1, 'sine', 0.12, rev));
    },
  },
  portal_open: {
    dur: 1.2,
    fn: (ctx) => {
      noise(ctx, 0, 1.1, 0.3, 'bandpass', 300, 3000, 5);
      tone(ctx, 220, 0, 1, 'sine', 0.12);
    },
  },
  skill_unlock: { dur: 0.8, fn: (ctx) => [0, 4, 7].forEach((n, i) => tone(ctx, 523 * Math.pow(2, n / 12), i * 0.06, 0.5, 'triangle', 0.12)) },
};

export async function renderRecipe(id: string, sampleRate: number): Promise<AudioBuffer | null> {
  const r = RECIPES[id];
  if (!r || typeof OfflineAudioContext === 'undefined') return null;
  const ctx = new OfflineAudioContext(2, Math.ceil(sampleRate * r.dur), sampleRate);
  r.fn(ctx);
  return ctx.startRendering();
}
