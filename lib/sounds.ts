// ---------------------------------------------------------------------------
// TECH AND SPACE - Procedural Sci-Fi Sound Effects (Web Audio API)
// ---------------------------------------------------------------------------
// All sounds are generated programmatically using oscillators and noise
// buffers. No external audio files are required.
// ---------------------------------------------------------------------------

type SoundName = 'hover' | 'click' | 'transition' | 'boot' | 'success' | 'dataStream' | 'ping' | 'ambient';

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

  // 1. Hover – warm beat-frequency hum from 2 detuned sines (60ms)
  hover(audio) {
    const now = audio.currentTime;
    const duration = 0.06;
    const gain = masterGain(audio, 0.07);

    gain.gain.setValueAtTime(0.07, now);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    scheduleOsc(audio, gain, 'sine', 600, now, duration);
    scheduleOsc(audio, gain, 'sine', 605, now, duration);
  },

  // 2. Click – triangle wave with reverb tail (120ms)
  click(audio) {
    const now = audio.currentTime;
    const gain = masterGain(audio, 0.1);

    // Main click
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    scheduleOsc(audio, gain, 'triangle', 600, now, 0.08);

    // Reverb tail — delayed sine
    const reverbGain = masterGain(audio, 0.04);
    reverbGain.gain.setValueAtTime(0.04, now + 0.06);
    reverbGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    scheduleOsc(audio, reverbGain, 'sine', 580, now + 0.06, 0.12);
  },

  // 3. Transition – wider bandpass sweep 200→8000Hz (350ms)
  transition(audio) {
    const now = audio.currentTime;
    const duration = 0.35;

    const bufferSize = audio.sampleRate * duration;
    const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = audio.createBufferSource();
    noise.buffer = buffer;

    // Stage 1: low sweep
    const filter1 = audio.createBiquadFilter();
    filter1.type = 'bandpass';
    filter1.Q.value = 1.5;
    filter1.frequency.setValueAtTime(200, now);
    filter1.frequency.exponentialRampToValueAtTime(2000, now + duration * 0.5);
    filter1.frequency.exponentialRampToValueAtTime(8000, now + duration);

    const gain = masterGain(audio, 0.12);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.04);
    gain.gain.linearRampToValueAtTime(0.14, now + duration * 0.5);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    noise.connect(filter1);
    filter1.connect(gain);
    noise.start(now);
    noise.stop(now + duration);
  },

  // 4. Boot – three ascending tones + bass rumble + reverb tail
  boot(audio) {
    const now = audio.currentTime;
    const toneDuration = 0.1;
    const gap = 0.04;
    const frequencies = [440, 660, 880];
    const volumes = [0.08, 0.1, 0.13];

    // Ascending tones
    frequencies.forEach((freq, i) => {
      const start = now + i * (toneDuration + gap);
      const gain = masterGain(audio, volumes[i]);
      gain.gain.setValueAtTime(volumes[i], start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + toneDuration);
      scheduleOsc(audio, gain, 'square', freq, start, toneDuration);
    });

    // Bass rumble underneath (55Hz)
    const totalTones = frequencies.length * (toneDuration + gap);
    const bassGain = masterGain(audio, 0.06);
    bassGain.gain.setValueAtTime(0, now);
    bassGain.gain.linearRampToValueAtTime(0.06, now + 0.05);
    bassGain.gain.linearRampToValueAtTime(0.04, now + totalTones);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + totalTones + 0.3);
    scheduleOsc(audio, bassGain, 'sine', 55, now, totalTones + 0.3);

    // Reverb tail after last tone
    const tailStart = now + totalTones;
    const tailGain = masterGain(audio, 0.05);
    tailGain.gain.setValueAtTime(0.05, tailStart);
    tailGain.gain.exponentialRampToValueAtTime(0.001, tailStart + 0.4);
    scheduleOsc(audio, tailGain, 'sine', 660, tailStart, 0.4);
  },

  // 5. Success – two-tone pleasant chime (kept as-is)
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

  // 6. Data Stream – kept as-is
  dataStream(audio) {
    const now = audio.currentTime;
    const totalDuration = 0.15;
    const stepDuration = 0.015;
    const freqs = [1200, 1800];

    const gain = masterGain(audio, 0.08);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
    gain.gain.linearRampToValueAtTime(0, now + totalDuration);

    const osc = audio.createOscillator();
    osc.type = 'square';
    osc.connect(gain);

    const steps = Math.floor(totalDuration / stepDuration);
    for (let i = 0; i < steps; i++) {
      osc.frequency.setValueAtTime(freqs[i % 2], now + i * stepDuration);
    }

    osc.start(now);
    osc.stop(now + totalDuration);
  },

  // 7. Ping – satellite radar ping: 1400→1200Hz sine + echo at 150ms
  ping(audio) {
    const now = audio.currentTime;

    // Main ping
    const gain = masterGain(audio, 0.1);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    scheduleOsc(audio, gain, 'sine', 1400, now, 0.12, 1200);

    // Echo
    const echoGain = masterGain(audio, 0.04);
    echoGain.gain.setValueAtTime(0.04, now + 0.15);
    echoGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    scheduleOsc(audio, echoGain, 'sine', 1300, now + 0.15, 0.15, 1150);
  },

  // 8. Ambient – 10s drone: two detuned sines (60Hz + 62Hz) with slow swell
  ambient(audio) {
    const now = audio.currentTime;
    const duration = 10;

    const gain = masterGain(audio, 0.03);
    // Slow swell
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.03, now + 2);
    gain.gain.setValueAtTime(0.03, now + duration - 2);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    scheduleOsc(audio, gain, 'sine', 60, now, duration);
    scheduleOsc(audio, gain, 'sine', 62, now, duration);
  },
};
