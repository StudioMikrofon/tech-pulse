// ---------------------------------------------------------------------------
// TECH & SPACE — Procedural Sci-Fi Sound Engine (Web Audio API)
// Dark cinematic terminal aesthetic. No external files required.
// ---------------------------------------------------------------------------

type SoundName =
  | 'hover' | 'click' | 'transition' | 'boot' | 'success'
  | 'dataStream' | 'ping' | 'ambient' | 'whoosh' | 'alert'
  | 'quizCorrect' | 'quizWrong' | 'glitch' | 'select' | 'tab';

const STORAGE_KEY = 'tp-sound';
const MASTER_VOL  = 0.08;

let ctx: AudioContext | null = null;
let ambientLoopNode: OscillatorNode | null = null;
let ambientGain: GainNode | null = null;

// ── Public API ──────────────────────────────────────────────────────────────

export function playSound(name: SoundName): void {
  if (!isSoundEnabled()) return;
  try {
    if (!ctx) ctx = new (window.AudioContext ?? (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    sounds[name]?.(ctx);
  } catch { /* non-critical */ }
}

export function startAmbient(): void {
  if (!isSoundEnabled()) return;
  if (ambientLoopNode) return; // already running
  try {
    if (!ctx) ctx = new (window.AudioContext ?? (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    _startAmbientLoop(ctx);
  } catch { /* non-critical */ }
}

export function stopAmbient(): void {
  try {
    ambientGain?.gain.setTargetAtTime(0, ctx?.currentTime ?? 0, 0.8);
    setTimeout(() => {
      try { ambientLoopNode?.stop(); } catch { /* */ }
      ambientLoopNode = null;
      ambientGain = null;
    }, 2000);
  } catch { /* */ }
}

export function setSoundEnabled(enabled: boolean): void {
  try { localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0'); } catch { /* */ }
  if (!enabled) stopAmbient();
}

export function isSoundEnabled(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v !== '0';
  } catch { return true; }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function gain(audio: AudioContext, vol: number): GainNode {
  const g = audio.createGain();
  g.gain.value = vol;
  g.connect(audio.destination);
  return g;
}

function osc(
  audio: AudioContext,
  dest: AudioNode,
  type: OscillatorType,
  freq: number,
  start: number,
  dur: number,
  freqEnd?: number,
): OscillatorNode {
  const o = audio.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (freqEnd !== undefined) o.frequency.linearRampToValueAtTime(freqEnd, start + dur);
  o.connect(dest);
  o.start(start);
  o.stop(start + dur);
  return o;
}

function whiteNoise(audio: AudioContext, dur: number): AudioBufferSourceNode {
  const sz  = Math.ceil(audio.sampleRate * dur);
  const buf = audio.createBuffer(1, sz, audio.sampleRate);
  const d   = buf.getChannelData(0);
  for (let i = 0; i < sz; i++) d[i] = Math.random() * 2 - 1;
  const src = audio.createBufferSource();
  src.buffer = buf;
  return src;
}

function bpf(audio: AudioContext, dest: AudioNode, freq: number, Q = 1): BiquadFilterNode {
  const f = audio.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = Q;
  f.connect(dest);
  return f;
}

function lpf(audio: AudioContext, dest: AudioNode, freq: number): BiquadFilterNode {
  const f = audio.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  f.connect(dest);
  return f;
}

/** Fake plate reverb: comb + allpass filters on white noise impulse */
function addReverb(audio: AudioContext, src: AudioNode, dest: AudioNode, wet = 0.18, decayMs = 400): void {
  const wetG  = audio.createGain();  wetG.gain.value = wet;
  const dryG  = audio.createGain();  dryG.gain.value = 1 - wet;
  const delay = audio.createDelay(1);
  delay.delayTime.value = decayMs / 1000 * 0.3;
  const fb    = audio.createGain();  fb.gain.value = 0.4;
  const filt  = lpf(audio, dest, 3000);
  src.connect(dryG);  dryG.connect(dest);
  src.connect(wetG);  wetG.connect(delay);
  delay.connect(fb);  fb.connect(delay);
  delay.connect(filt);
}

// ── Ambient loop ─────────────────────────────────────────────────────────────

function _startAmbientLoop(audio: AudioContext): void {
  const now = audio.currentTime;
  const g   = audio.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(MASTER_VOL * 0.35, now + 4);
  g.connect(audio.destination);

  // Layer 1: sub-bass drone 40Hz + 41Hz (slow beat)
  const sub1 = audio.createOscillator(); sub1.type = 'sine';
  sub1.frequency.value = 40; sub1.connect(g); sub1.start(now);

  const sub2 = audio.createOscillator(); sub2.type = 'sine';
  sub2.frequency.value = 41.1; sub2.connect(g); sub2.start(now);

  // Layer 2: mid hum 120Hz sawtooth → lowpass (filtered down to warmth)
  const midG  = audio.createGain(); midG.gain.value = 0.12; midG.connect(g);
  const midLP = audio.createBiquadFilter();
  midLP.type = 'lowpass'; midLP.frequency.value = 180; midLP.Q.value = 0.7;
  midLP.connect(midG);
  const mid = audio.createOscillator(); mid.type = 'sawtooth';
  mid.frequency.value = 120; mid.connect(midLP); mid.start(now);

  // Layer 3: slow LFO tremolo on sub
  const lfo = audio.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.07;
  const lfoGain = audio.createGain(); lfoGain.gain.value = 0.008;
  lfo.connect(lfoGain); lfoGain.connect(g.gain); lfo.start(now);

  // Layer 4: occasional high-freq shimmer (5kHz → filtered noise, very quiet)
  const shimG  = audio.createGain(); shimG.gain.value = 0.018; shimG.connect(g);
  const shimLP = audio.createBiquadFilter();
  shimLP.type = 'bandpass'; shimLP.frequency.value = 4800; shimLP.Q.value = 3;
  shimLP.connect(shimG);
  const shimLFO = audio.createOscillator(); shimLFO.type = 'sine'; shimLFO.frequency.value = 0.03;
  const shimLFOGain = audio.createGain(); shimLFOGain.gain.value = 0.4;
  shimLFO.connect(shimLFOGain); shimLFOGain.connect(shimG.gain);
  shimLFO.start(now);

  // We store references to stop them later
  ambientLoopNode = sub1;
  ambientGain     = g;

  // Store all nodes for cleanup
  const allNodes = [sub1, sub2, mid, lfo, shimLFO];
  (g as any)._ambient_nodes = allNodes;
}

// ── Sound generators ──────────────────────────────────────────────────────────

const sounds: Partial<Record<SoundName, (audio: AudioContext) => void>> = {

  // 1. HOVER — subspace frequency blip: 2-partial sine, very short
  hover(audio) {
    const now = audio.currentTime;
    const g   = gain(audio, 0);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(MASTER_VOL * 0.65, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

    osc(audio, g, 'sine', 880, now, 0.065, 820);
    const g2 = gain(audio, 0);
    g2.gain.setValueAtTime(0, now + 0.008);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    osc(audio, g2, 'sine', 1760, now + 0.008, 0.06, 1600);
    g2.gain.value = MASTER_VOL * 0.25;
  },

  // 2. CLICK — sharp console keypress: attack transient + resonant tail
  click(audio) {
    const now = audio.currentTime;

    // Transient: shaped noise burst
    const tG = gain(audio, MASTER_VOL);
    tG.gain.setValueAtTime(MASTER_VOL, now);
    tG.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
    const n = whiteNoise(audio, 0.03);
    const f = bpf(audio, tG, 3200, 4);
    n.connect(f); n.start(now); n.stop(now + 0.03);

    // Resonant body: triangle wave, decays slowly
    const bG = gain(audio, MASTER_VOL * 0.7);
    bG.gain.setValueAtTime(MASTER_VOL * 0.7, now + 0.005);
    bG.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc(audio, bG, 'triangle', 680, now + 0.005, 0.17, 560);

    // Sub click: very short bass thump
    const sG = gain(audio, MASTER_VOL * 0.5);
    sG.gain.setValueAtTime(MASTER_VOL * 0.5, now);
    sG.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    osc(audio, sG, 'sine', 180, now, 0.04, 60);
  },

  // 3. SELECT — lighter variant of click for tab switching
  select(audio) {
    const now = audio.currentTime;
    const g   = gain(audio, MASTER_VOL * 0.6);
    g.gain.setValueAtTime(MASTER_VOL * 0.6, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc(audio, g, 'triangle', 900, now, 0.10, 1100);

    const g2  = gain(audio, MASTER_VOL * 0.3);
    g2.gain.setValueAtTime(MASTER_VOL * 0.3, now + 0.015);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    osc(audio, g2, 'sine', 1800, now + 0.015, 0.09);
  },

  // 4. TAB — very quick tick for sidebar tab changes
  tab(audio) {
    const now = audio.currentTime;
    const g   = gain(audio, MASTER_VOL * 0.55);
    g.gain.setValueAtTime(MASTER_VOL * 0.55, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    osc(audio, g, 'square', 1400, now, 0.035, 1200);
  },

  // 5. GLITCH — digital scramble: noise bursts with pitch steps
  glitch(audio) {
    const now = audio.currentTime;
    const steps = 8;
    const stepDur = 0.018;
    const freqs = [2400, 800, 3200, 600, 2800, 1200, 3600, 400];

    for (let i = 0; i < steps; i++) {
      const t  = now + i * stepDur;
      const gv = MASTER_VOL * (1 - i / steps) * 0.8;
      const g  = gain(audio, gv);
      g.gain.setValueAtTime(gv, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + stepDur * 0.9);

      if (i % 2 === 0) {
        // Noise burst through BPF
        const n = whiteNoise(audio, stepDur);
        const f = bpf(audio, g, freqs[i], 3);
        n.connect(f); n.start(t); n.stop(t + stepDur);
      } else {
        osc(audio, g, 'square', freqs[i], t, stepDur * 0.8);
      }
    }
  },

  // 6. TRANSITION — glitch scramble → space whoosh → clean
  transition(audio) {
    const now = audio.currentTime;

    // Phase 1 (0–180ms): digital glitch burst
    const glitchSteps = 6;
    const sd          = 0.025;
    const gFreqs      = [3600, 900, 2400, 600, 4200, 300];
    for (let i = 0; i < glitchSteps; i++) {
      const t  = now + i * sd;
      const gv = MASTER_VOL * (0.8 - i * 0.1);
      const g  = gain(audio, gv);
      g.gain.setValueAtTime(gv, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + sd);
      if (i % 2 === 0) {
        const n = whiteNoise(audio, sd * 1.1);
        const f = bpf(audio, g, gFreqs[i], 4);
        n.connect(f); n.start(t); n.stop(t + sd * 1.1);
      } else {
        osc(audio, g, 'sawtooth', gFreqs[i], t, sd * 0.9);
      }
    }

    // Phase 2 (160ms–400ms): noise sweep 200→8000Hz (whoosh)
    const wStart = now + 0.16;
    const wDur   = 0.26;
    const wG     = gain(audio, 0);
    wG.gain.setValueAtTime(0, wStart);
    wG.gain.linearRampToValueAtTime(MASTER_VOL * 1.2, wStart + 0.06);
    wG.gain.linearRampToValueAtTime(0, wStart + wDur);
    const wn  = whiteNoise(audio, wDur + 0.05);
    const wf  = audio.createBiquadFilter();
    wf.type = 'bandpass'; wf.Q.value = 0.8;
    wf.frequency.setValueAtTime(200, wStart);
    wf.frequency.exponentialRampToValueAtTime(8000, wStart + wDur);
    wn.connect(wf); wf.connect(wG);
    wn.start(wStart); wn.stop(wStart + wDur + 0.1);

    // Phase 3 (350ms): clean confirmation sine
    const cStart = now + 0.35;
    const cG     = gain(audio, MASTER_VOL * 0.5);
    cG.gain.setValueAtTime(MASTER_VOL * 0.5, cStart);
    cG.gain.exponentialRampToValueAtTime(0.0001, cStart + 0.15);
    osc(audio, cG, 'sine', 1200, cStart, 0.14, 1400);
  },

  // 7. BOOT — CRT power-on: sub rumble, pitch ramp, digital handshake
  boot(audio) {
    const now = audio.currentTime;

    // Sub rumble (0–500ms)
    const rG = gain(audio, 0);
    rG.gain.setValueAtTime(0, now);
    rG.gain.linearRampToValueAtTime(MASTER_VOL * 0.6, now + 0.15);
    rG.gain.linearRampToValueAtTime(0, now + 0.5);
    osc(audio, rG, 'sawtooth', 45, now, 0.5, 80);
    const rlp = lpf(audio, audio.destination, 200);
    rG.connect(rlp);

    // Pitch rise sweep (200ms–700ms)
    const swG = gain(audio, MASTER_VOL * 0.35);
    swG.gain.setValueAtTime(0, now + 0.2);
    swG.gain.linearRampToValueAtTime(MASTER_VOL * 0.35, now + 0.35);
    swG.gain.linearRampToValueAtTime(0, now + 0.8);
    osc(audio, swG, 'sawtooth', 80, now + 0.2, 0.6, 1800);

    // Digital handshake tones (600ms, 700ms, 850ms)
    [[600, 880, 0.12], [700, 1100, 0.1], [850, 1320, 0.14]].forEach(([ms, f, vol]) => {
      const t  = now + (ms as number) / 1000;
      const g  = gain(audio, vol as number);
      g.gain.setValueAtTime(vol as number, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      osc(audio, g, 'triangle', f as number, t, 0.11);
    });

    // Final confirm tone (950ms)
    const cG = gain(audio, MASTER_VOL * 0.6);
    cG.gain.setValueAtTime(MASTER_VOL * 0.6, now + 0.95);
    cG.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    osc(audio, cG, 'sine', 1760, now + 0.95, 0.25);
    addReverb(audio, cG, audio.destination, 0.15, 300);
  },

  // 8. SUCCESS — clean dual-tone comms confirm (not video-gamey)
  success(audio) {
    const now = audio.currentTime;
    const pairs: [number, number][] = [[880, 0.08], [1320, 0.1]];
    pairs.forEach(([f, dur], i) => {
      const t = now + i * 0.09;
      const g = gain(audio, MASTER_VOL * 0.7);
      g.gain.setValueAtTime(MASTER_VOL * 0.7, t);
      g.gain.setValueAtTime(MASTER_VOL * 0.7, t + dur - 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
      osc(audio, g, 'sine', f, t, dur + 0.12);
    });
  },

  // 9. DATA STREAM — digital packet burst: fast freq steps with noise gate
  dataStream(audio) {
    const now   = audio.currentTime;
    const total = 0.12;
    const step  = 0.01;
    const freqs = [2400, 1600, 3200, 800, 2800, 1200, 3600, 1000, 2200, 1800, 400, 3000];

    const g = gain(audio, 0);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(MASTER_VOL * 0.6, now + 0.01);
    g.gain.setValueAtTime(MASTER_VOL * 0.6, now + total - 0.02);
    g.gain.linearRampToValueAtTime(0, now + total);

    const o = audio.createOscillator();
    o.type = 'square';
    freqs.forEach((f, i) => o.frequency.setValueAtTime(f, now + i * step));
    o.connect(g); o.start(now); o.stop(now + total + 0.01);

    const f = lpf(audio, audio.destination, 2500);
    g.connect(f);
  },

  // 10. PING — deep-space sonar: fundamental + overtone + echo
  ping(audio) {
    const now = audio.currentTime;

    // Fundamental
    const g = gain(audio, MASTER_VOL * 0.8);
    g.gain.setValueAtTime(MASTER_VOL * 0.8, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    osc(audio, g, 'sine', 1200, now, 0.6, 900);

    // Overtone (3rd harmonic, quieter)
    const g2 = gain(audio, MASTER_VOL * 0.25);
    g2.gain.setValueAtTime(MASTER_VOL * 0.25, now);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc(audio, g2, 'sine', 3600, now, 0.3, 2700);

    // Echo (delayed 220ms, half amplitude)
    const eG = gain(audio, MASTER_VOL * 0.3);
    eG.gain.setValueAtTime(0, now + 0.22);
    eG.gain.linearRampToValueAtTime(MASTER_VOL * 0.3, now + 0.24);
    eG.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    osc(audio, eG, 'sine', 1100, now + 0.22, 0.5, 800);
  },

  // 11. AMBIENT — 10s segment (use startAmbient/stopAmbient for loop)
  ambient(audio) {
    const now = audio.currentTime;
    const dur = 10;
    const g   = gain(audio, 0);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(MASTER_VOL * 0.3, now + 2);
    g.gain.setValueAtTime(MASTER_VOL * 0.3, now + dur - 2);
    g.gain.linearRampToValueAtTime(0, now + dur);

    osc(audio, g, 'sine', 40, now, dur);
    osc(audio, g, 'sine', 41.1, now, dur);

    const midG = gain(audio, 0.1);
    midG.gain.value = 0.1;
    midG.connect(g);
    const midLP = lpf(audio, midG, 160);
    osc(audio, midLP, 'sawtooth', 80, now, dur);
  },

  // 12. WHOOSH — cinema quality: three-layer noise sweep with doppler feel
  whoosh(audio) {
    const now = audio.currentTime;
    const dur = 0.35;

    // Low freq whoosh (200→600Hz)
    const lG = gain(audio, 0);
    lG.gain.setValueAtTime(0, now);
    lG.gain.linearRampToValueAtTime(MASTER_VOL * 0.7, now + 0.08);
    lG.gain.linearRampToValueAtTime(0, now + dur);
    const ln = whiteNoise(audio, dur + 0.05);
    const lf = audio.createBiquadFilter();
    lf.type = 'bandpass'; lf.Q.value = 0.8;
    lf.frequency.setValueAtTime(200, now);
    lf.frequency.exponentialRampToValueAtTime(600, now + dur);
    ln.connect(lf); lf.connect(lG);
    ln.start(now); ln.stop(now + dur + 0.05);

    // High freq shimmer (2000→6000Hz, slight delay)
    const hG = gain(audio, 0);
    hG.gain.setValueAtTime(0, now + 0.04);
    hG.gain.linearRampToValueAtTime(MASTER_VOL * 0.4, now + 0.12);
    hG.gain.linearRampToValueAtTime(0, now + dur);
    const hn = whiteNoise(audio, dur);
    const hf = audio.createBiquadFilter();
    hf.type = 'bandpass'; hf.Q.value = 2;
    hf.frequency.setValueAtTime(2000, now + 0.04);
    hf.frequency.exponentialRampToValueAtTime(6000, now + dur);
    hn.connect(hf); hf.connect(hG);
    hn.start(now + 0.04); hn.stop(now + dur + 0.02);

    // Sub tail (sinusoidal thump at the start)
    const sG = gain(audio, MASTER_VOL * 0.4);
    sG.gain.setValueAtTime(MASTER_VOL * 0.4, now);
    sG.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc(audio, sG, 'sine', 80, now, 0.12, 30);
  },

  // 13. ALERT — military tonal: urgent stutter pulse, not video-gamey
  alert(audio) {
    const now = audio.currentTime;
    const pulses = 3;
    const pDur   = 0.06;
    const pGap   = 0.04;

    for (let i = 0; i < pulses; i++) {
      const t  = now + i * (pDur + pGap);
      const gv = MASTER_VOL * (i === 0 ? 1 : 0.75);
      const g  = gain(audio, gv);
      g.gain.setValueAtTime(gv, t);
      g.gain.setValueAtTime(gv, t + pDur - 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + pDur + 0.02);

      // Two-tone chord: fundamental + tritone (tense interval)
      osc(audio, g, 'square', 660, t, pDur);
      const g2  = gain(audio, gv * 0.5);
      g2.gain.setValueAtTime(gv * 0.5, t);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + pDur + 0.02);
      osc(audio, g2, 'square', 928, t, pDur); // ~tritone above 660

      // High-pass shape for clarity
      const hp = audio.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 400;
      g.connect(hp); hp.connect(audio.destination);
    }
  },

  // 14. QUIZ CORRECT — clean ascending two-tone confirmation
  quizCorrect(audio) {
    const now = audio.currentTime;
    [[523, 0, 0.9], [784, 0.08, 1.0]].forEach(([f, delay, vol]) => {
      const t = now + (delay as number);
      const g = gain(audio, MASTER_VOL * (vol as number));
      g.gain.setValueAtTime(MASTER_VOL * (vol as number), t);
      g.gain.setValueAtTime(MASTER_VOL * (vol as number), t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc(audio, g, 'sine', f as number, t, 0.22);
    });
  },

  // 15. QUIZ WRONG — descending error: filtered sawtooth glide
  quizWrong(audio) {
    const now = audio.currentTime;
    const g   = gain(audio, MASTER_VOL * 0.7);
    g.gain.setValueAtTime(MASTER_VOL * 0.7, now);
    g.gain.setValueAtTime(MASTER_VOL * 0.7, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    const lp = lpf(audio, audio.destination, 800);
    g.connect(lp);
    osc(audio, g, 'sawtooth', 400, now, 0.25, 180);

    // Noise burst at start
    const nG = gain(audio, MASTER_VOL * 0.4);
    nG.gain.setValueAtTime(MASTER_VOL * 0.4, now);
    nG.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    const n = whiteNoise(audio, 0.06);
    const nf = bpf(audio, nG, 600, 2);
    n.connect(nf); n.start(now); n.stop(now + 0.06);
  },
};
