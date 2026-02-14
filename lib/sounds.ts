// ---------------------------------------------------------------------------
// Tech Pulse - Procedural Sci-Fi Sound Effects (Web Audio API)
// ---------------------------------------------------------------------------
// All sounds are generated programmatically using oscillators and noise
// buffers. No external audio files are required.
// ---------------------------------------------------------------------------

type SoundName = 'hover' | 'click' | 'transition' | 'boot' | 'success' | 'dataStream';

const STORAGE_KEY = 'tp-sound';
const MASTER_VOLUME = 0.1;

let ctx: AudioContext | null = null;

// ---- Public API -----------------------------------------------------------

/**
 * Play a named sound effect.  The AudioContext is lazily created on the first
 * call so the browser auto-play policy (requiring user interaction) is
 * respected.  If anything goes wrong the call silently does nothing.
 */
export function playSound(name: SoundName): void {
  if (!isSoundEnabled()) return;

  try {
    if (!ctx) {
      ctx = new (window.AudioContext ?? (window as any).webkitAudioContext)();
    }

    // Resume if the context was suspended (Safari / Chrome policy)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const generator = sounds[name];
    if (generator) generator(ctx);
  } catch {
    // Silently swallow – sound is non-critical
  }
}

/**
 * Enable or disable all sound effects.  The preference is persisted in
 * localStorage so it survives page reloads.
 */
export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // localStorage may be unavailable (private browsing, etc.)
  }
}

/**
 * Returns `true` when sound effects are enabled.  Defaults to `true` when no
 * preference has been stored yet.
 */
export function isSoundEnabled(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== '0';
  } catch {
    return true;
  }
}

// ---- Internal helpers -----------------------------------------------------

/** Create a GainNode wired to the destination with the given volume. */
function masterGain(audio: AudioContext, volume: number = MASTER_VOLUME): GainNode {
  const gain = audio.createGain();
  gain.gain.value = volume;
  gain.connect(audio.destination);
  return gain;
}

/** Schedule an oscillator that starts and stops automatically. */
function scheduleOsc(
  audio: AudioContext,
  dest: AudioNode,
  type: OscillatorType,
  frequency: number,
  startTime: number,
  duration: number,
  freqEnd?: number,
): OscillatorNode {
  const osc = audio.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);
  if (freqEnd !== undefined) {
    osc.frequency.linearRampToValueAtTime(freqEnd, startTime + duration);
  }
  osc.connect(dest);
  osc.start(startTime);
  osc.stop(startTime + duration);
  return osc;
}

// ---- Sound generators -----------------------------------------------------

const sounds: Record<SoundName, (audio: AudioContext) => void> = {

  // 1. Hover – very subtle high-pitched blip (50ms)
  //    Sine wave sweeping 800 Hz -> 1200 Hz
  hover(audio) {
    const now = audio.currentTime;
    const gain = masterGain(audio, 0.08);

    // Fade out to avoid pop
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.05);

    scheduleOsc(audio, gain, 'sine', 800, now, 0.05, 1200);
  },

  // 2. Click – short click / beep (80ms)
  //    Square wave pulse at 600 Hz
  click(audio) {
    const now = audio.currentTime;
    const gain = masterGain(audio, 0.1);

    // Sharp attack, quick decay
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    scheduleOsc(audio, gain, 'square', 600, now, 0.08);
  },

  // 3. Transition – whoosh / sweep (300ms)
  //    White noise through a bandpass filter sweeping low -> high
  transition(audio) {
    const now = audio.currentTime;
    const duration = 0.3;

    // Generate a buffer of white noise
    const bufferSize = audio.sampleRate * duration;
    const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = audio.createBufferSource();
    noise.buffer = buffer;

    // Bandpass filter sweeping from 400 Hz to 6000 Hz
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2;
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(6000, now + duration);

    const gain = masterGain(audio, 0.12);
    // Fade in then out
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    noise.start(now);
    noise.stop(now + duration);
  },

  // 4. Boot – terminal boot beep sequence: three ascending tones (100ms each)
  //    beep (440 Hz) – beep (660 Hz) – BEEP (880 Hz)
  boot(audio) {
    const now = audio.currentTime;
    const toneDuration = 0.1;
    const gap = 0.04;
    const frequencies = [440, 660, 880];
    const volumes = [0.08, 0.1, 0.13];

    frequencies.forEach((freq, i) => {
      const start = now + i * (toneDuration + gap);
      const gain = masterGain(audio, volumes[i]);

      // Quick fade-out per tone to avoid clicks
      gain.gain.setValueAtTime(volumes[i], start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + toneDuration);

      scheduleOsc(audio, gain, 'square', freq, start, toneDuration);
    });
  },

  // 5. Success – two-tone pleasant chime (200ms total)
  //    Sine 523 Hz (C5) then 659 Hz (E5), 100ms each
  success(audio) {
    const now = audio.currentTime;
    const toneDuration = 0.1;

    [523, 659].forEach((freq, i) => {
      const start = now + i * toneDuration;
      const gain = masterGain(audio, 0.12);

      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + toneDuration);

      scheduleOsc(audio, gain, 'sine', freq, start, toneDuration);
    });
  },

  // 6. Data Stream – subtle digital chatter (150ms)
  //    Fast alternating between two frequencies (1200 Hz / 1800 Hz)
  dataStream(audio) {
    const now = audio.currentTime;
    const totalDuration = 0.15;
    const stepDuration = 0.015; // 15ms per step -> ~10 steps
    const freqs = [1200, 1800];

    const gain = masterGain(audio, 0.08);
    // Envelope: fade in quickly then fade out
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
    gain.gain.linearRampToValueAtTime(0, now + totalDuration);

    const osc = audio.createOscillator();
    osc.type = 'square';
    osc.connect(gain);

    // Schedule alternating frequency values
    const steps = Math.floor(totalDuration / stepDuration);
    for (let i = 0; i < steps; i++) {
      osc.frequency.setValueAtTime(freqs[i % 2], now + i * stepDuration);
    }

    osc.start(now);
    osc.stop(now + totalDuration);
  },
};
