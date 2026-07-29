/**
 * The app's two sound effects, synthesised with the Web Audio API rather than
 * shipped as files: both are a fraction of a second of noise or tone, so
 * generating them costs less than the request for an asset would.
 *
 * The context is created lazily and resumed on use. Browsers refuse to start
 * audio before a user gesture, and both callers are gesture-driven — a button
 * press, or a timer the user started — so by the time either runs the page has
 * the permission it needs.
 */
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

/** Short breathy sweep, for clearing a field. */
export function playWoosh(): void {
  const ctx = audioContext();
  if (!ctx) return;

  const duration = 0.28;
  // White noise, shaped by a band-pass sweeping downward — the pitch drop is
  // what makes it read as something being swept away rather than a click.
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

/** Two seconds of alarm beeps, for the end of a countdown. */
export function playAlarm(): void {
  const ctx = audioContext();
  if (!ctx) return;

  const beepLength = 0.18;
  const interval = 0.4;
  const beeps = 5; // 5 × 0.4s ≈ the 2 seconds asked for.

  for (let i = 0; i < beeps; i++) {
    const start = ctx.currentTime + i * interval;

    const oscillator = ctx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;

    // Ramped rather than switched: a square-edged gain change pops.
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
    gain.gain.setValueAtTime(0.2, start + beepLength - 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + beepLength);

    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + beepLength);
  }
}
