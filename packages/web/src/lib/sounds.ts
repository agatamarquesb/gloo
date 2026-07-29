/**
 * The app's sound effects.
 *
 * Each one is a licensed file under `public/sounds/`, played through a single
 * shared AudioContext. The files are not in the repository — they are Epidemic
 * Sound tracks, exported from the account that licenses them — so every effect
 * also carries a synthesised fallback and the app stays audible without them.
 * Drop the mp3s in and each effect swaps over on its own; see the README in that
 * directory for the names.
 *
 * The context is created lazily and resumed on use. Browsers refuse to start
 * audio before a user gesture, and every caller is gesture-driven — a button
 * press, a timer the user started, or a notification arriving in a tab they are
 * already using — so by the time one runs the page has the permission it needs.
 */

/** Every effect, and the file each looks for. */
const EFFECT_FILES = {
  notification: 'notification.mp3',
  delete: 'delete.mp3',
  sweep: 'sweep.mp3',
  countdownEnd: 'countdown-end.mp3',
  taskCompleted: 'task-completed.mp3',
} as const;

export type SoundEffect = keyof typeof EFFECT_FILES;

const SOUNDS_PATH = '/sounds/';

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    // No audio available (blocked, or an environment without the API). Silence
    // is an acceptable outcome for a decorative sound.
    return null;
  }
}

/**
 * Decoded audio per effect, or `null` once we know the file isn't there.
 *
 * Cached either way: a missing file must not mean a failed request on every
 * click, and a present one must not be decoded twice.
 */
const buffers = new Map<SoundEffect, AudioBuffer | null>();
const pending = new Map<SoundEffect, Promise<AudioBuffer | null>>();

async function loadBuffer(effect: SoundEffect): Promise<AudioBuffer | null> {
  const ctx = audioContext();
  if (!ctx) return null;

  try {
    const response = await fetch(`${SOUNDS_PATH}${EFFECT_FILES[effect]}`);
    // The content type is checked as well as the status: a dev server answers a
    // missing file with index.html rather than a 404, and decodeAudioData would
    // then throw on a page of HTML.
    if (!response.ok || !(response.headers.get('content-type') ?? '').startsWith('audio')) {
      return null;
    }
    return await ctx.decodeAudioData(await response.arrayBuffer());
  } catch {
    return null;
  }
}

function playBuffer(buffer: AudioBuffer, volume: number): void {
  const ctx = audioContext();
  if (!ctx) return;

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gain = ctx.createGain();
  gain.gain.value = volume;

  source.connect(gain).connect(ctx.destination);
  source.start();
}

/**
 * Plays an effect: the licensed file if it is there, the synthesised stand-in
 * otherwise.
 *
 * Deliberately not awaited by callers. A sound is decoration — nothing should
 * wait on it, and nothing should break if it never arrives.
 */
export function playSound(effect: SoundEffect, volume = 0.5): void {
  const cached = buffers.get(effect);
  if (cached) {
    playBuffer(cached, volume);
    return;
  }
  // Known missing: go straight to the stand-in rather than refetching.
  if (buffers.has(effect)) {
    FALLBACKS[effect]();
    return;
  }

  const load = pending.get(effect) ?? loadBuffer(effect);
  pending.set(effect, load);

  void load.then((buffer) => {
    buffers.set(effect, buffer);
    pending.delete(effect);
    if (buffer) playBuffer(buffer, volume);
    else FALLBACKS[effect]();
  });
}

/* -------------------------------------------------------------------------
 * Synthesised stand-ins.
 *
 * What the app played before these effects were specified, kept as the fallback
 * so nothing is silent while the licensed files are missing. All of them are a
 * fraction of a second of tone or noise.
 * ---------------------------------------------------------------------- */

/** A short tone at a given pitch, ramped in and out so it doesn't pop. */
function tone(frequency: number, start: number, length: number, peak = 0.2): void {
  const ctx = audioContext();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
  gain.gain.setValueAtTime(peak, start + length - 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);

  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + length);
}

/** Band-passed noise sweeping downward — something being swept away. */
function woosh(): void {
  const ctx = audioContext();
  if (!ctx) return;

  const duration = 0.28;
  const frameCount = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) samples[i] = Math.random() * 2 - 1;

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 0.8;
  filter.frequency.setValueAtTime(1800, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.14, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start();
  source.stop(ctx.currentTime + duration);
}

const FALLBACKS: Record<SoundEffect, () => void> = {
  /** Two rising notes — something arriving. */
  notification: () => {
    const ctx = audioContext();
    if (!ctx) return;
    tone(660, ctx.currentTime, 0.12, 0.18);
    tone(880, ctx.currentTime + 0.11, 0.16, 0.18);
  },

  /** One low, short note — something going away. */
  delete: () => {
    const ctx = audioContext();
    if (!ctx) return;
    tone(320, ctx.currentTime, 0.1, 0.16);
  },

  sweep: woosh,

  /** Five beeps over roughly two seconds, for the end of a countdown. */
  countdownEnd: () => {
    const ctx = audioContext();
    if (!ctx) return;
    for (let i = 0; i < 5; i++) tone(880, ctx.currentTime + i * 0.4, 0.18);
  },

  /** A small rising figure — something finished. */
  taskCompleted: () => {
    const ctx = audioContext();
    if (!ctx) return;
    tone(523, ctx.currentTime, 0.1, 0.16);
    tone(659, ctx.currentTime + 0.09, 0.1, 0.16);
    tone(784, ctx.currentTime + 0.18, 0.2, 0.16);
  },
};
