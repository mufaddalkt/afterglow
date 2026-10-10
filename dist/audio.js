/**
 * AFTERGLOW RUSH — original, entirely synthesized race audio.
 * No samples, remote assets, autoplay, or third-party melodies.
 */
export class RaceAudio {
  constructor() {
    this.context = null;
    this.supported = true;
    this.muted = false;
    this.paused = false;
    this.started = false;
    this.timer = null;
    this.step = 0;
    this.nextNote = 0;
    this.bpm = 136;
    this.lastEffects = Object.create(null);
    this.state = { speed: 0, maxSpeed: 250, throttle: 0, nitro: false, drift: false, active: false };
  }

  async start() {
    if (!this.supported) return false;
    try {
      if (!this.context) this._init();
      if (!this.context) return false;
      if (this.context.state === 'suspended') await this.context.resume();
      this.started = this.context.state === 'running';
      if (this.started && !this.paused) this._startSequencer();
      this._applyVolumes();
      return this.started;
    } catch (_) {
      // Audio is optional: blocked or unavailable devices must not break racing.
      this.supported = false;
      return false;
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this._applyVolumes();
  }

  pause(paused) {
    this.paused = Boolean(paused);
    if (this.paused) {
      if (this.timer !== null) clearInterval(this.timer);
      this.timer = null;
    } else if (this.started) {
      this._startSequencer();
    }
    this._applyVolumes();
  }

  update(state = {}) {
    this.state = { ...this.state, ...state };
    if (!this.context || !this.started) return;
    const t = this.context.currentTime;
    const speed = Math.max(0, Number(this.state.speed) || 0);
    const max = Math.max(1, Number(this.state.maxSpeed) || 250);
    const ratio = Math.min(1.35, speed / max);
    const load = Math.max(0, Math.min(1, Number(this.state.throttle) || 0));
    const boost = this.state.nitro ? 1 : 0;
    const drift = this.state.drift ? 1 : 0;
    const audible = this.state.active && !this.paused ? 1 : 0;
    // Small automatic upshift drops give acceleration a mechanical rhythm.
    const gearPosition = Math.min(4.99, ratio * 5);
    const gear = Math.floor(gearPosition);
    const rpm = 39 + (gearPosition - gear) * 37 + gear * 4 + load * 7 + boost * 14;
    this.engineOsc.frequency.setTargetAtTime(rpm, t, 0.055);
    this.engineHarmonic.frequency.setTargetAtTime(rpm * 2.01, t, 0.06);
    this.engineSub.frequency.setTargetAtTime(rpm / 2, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(260 + ratio * 1600 + load * 330 + boost * 650, t, 0.1);
    this.engineLevel.gain.setTargetAtTime(audible * (0.035 + ratio * 0.045 + load * 0.025), t, 0.09);
    this.windLevel.gain.setTargetAtTime(audible * ratio * ratio * 0.055, t, 0.2);
    this.windFilter.frequency.setTargetAtTime(550 + ratio * 2100, t, 0.16);
    this.boostLevel.gain.setTargetAtTime(audible * boost * 0.1, t, 0.08);
    this.boostFilter.frequency.setTargetAtTime(900 + ratio * 1900, t, 0.1);
    this.tireLevel.gain.setTargetAtTime(audible * drift * Math.min(1, ratio * 3) * 0.06, t, 0.045);
    this.tireFilter.frequency.setTargetAtTime(950 + ratio * 900, t, 0.07);
  }

  play(type) {
    if (!this.context || !this.started || this.muted) return;
    const t = this.context.currentTime;
    // Repeated collisions or pickup intersections cannot flood the mixer.
    const minimumGap = type === 'collision' ? 0.16 : type === 'pickup' ? 0.09 : 0.035;
    if (t - (this.lastEffects[type] ?? -999) < minimumGap) return;
    this.lastEffects[type] = t;
    switch (type) {
      case 'countdown':
        this._tone(587.33, t, 0.14, 0.32, 'sine', this.sfxBus);
        this._tone(1174.66, t, 0.1, 0.08, 'triangle', this.sfxBus);
        break;
      case 'go':
        [587.33, 739.99, 880, 1174.66].forEach((n, i) => this._tone(n, t + i * 0.037, 0.28, 0.21, 'triangle', this.sfxBus));
        this._noise(t, 0.3, 0.1, 'highpass', 1500, this.sfxBus);
        break;
      case 'pickup':
        [880, 1174.66, 1760].forEach((n, i) => this._tone(n, t + i * 0.052, 0.18, 0.19, 'sine', this.sfxBus));
        break;
      case 'collision':
        this._noise(t, 0.19, 0.55, 'lowpass', 2400, this.sfxBus);
        this._tone(85, t, 0.22, 0.45, 'triangle', this.sfxBus, 27);
        this._noise(t + 0.035, 0.12, 0.12, 'highpass', 5200, this.sfxBus);
        break;
      case 'jump':
        this._tone(180, t, 0.27, 0.14, 'sine', this.sfxBus, 580);
        this._noise(t, 0.28, 0.16, 'bandpass', 1700, this.sfxBus);
        break;
      case 'finish':
        [62, 65, 69, 74, 77, 81].forEach((n, i) => this._tone(this._midi(n), t + i * 0.115, 0.62, 0.23, 'triangle', this.sfxBus));
        this._noise(t, 0.7, 0.17, 'highpass', 3600, this.sfxBus);
        break;
      case 'click':
        this._tone(760, t, 0.065, 0.14, 'sine', this.sfxBus, 1020);
        break;
      default:
        break;
    }
  }

  _init() {
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) {
      this.supported = false;
      return;
    }
    const c = this.context = new AudioContext({ latencyHint: 'interactive' });
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.68;
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -13;
    limiter.knee.value = 12;
    limiter.ratio.value = 5;
    limiter.attack.value = 0.004;
    limiter.release.value = 0.17;
    this.master.connect(limiter);
    limiter.connect(c.destination);
    this.musicBus = c.createGain();
    this.musicBus.gain.value = 0.23;
    this.musicBus.connect(this.master);
    this.sfxBus = c.createGain();
    this.sfxBus.gain.value = 0.32;
    this.sfxBus.connect(this.master);
    this.vehicleBus = c.createGain();
    this.vehicleBus.gain.value = 1;
    this.vehicleBus.connect(this.master);

    this.noiseBuffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const noise = this.noiseBuffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < noise.length; i++) {
      const white = Math.random() * 2 - 1;
      brown = (brown + white * 0.035) / 1.035;
      noise[i] = white * 0.72 + brown * 0.8;
    }

    this.engineFilter = c.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 330;
    this.engineFilter.Q.value = 0.75;
    this.engineLevel = c.createGain();
    this.engineLevel.gain.value = 0;
    this.engineFilter.connect(this.engineLevel);
    this.engineLevel.connect(this.vehicleBus);
    this.engineOsc = this._loopOscillator('sawtooth', 42, 0.56, this.engineFilter);
    this.engineHarmonic = this._loopOscillator('triangle', 84, 0.32, this.engineFilter);
    this.engineSub = this._loopOscillator('sine', 21, 0.25, this.engineFilter);
    [this.windFilter, this.windLevel] = this._loopNoise('highpass', 900, 0.7);
    [this.boostFilter, this.boostLevel] = this._loopNoise('bandpass', 2200, 1.6);
    [this.tireFilter, this.tireLevel] = this._loopNoise('bandpass', 1350, 7);
    this._loopOscillator('sawtooth', 610, 0.2, this.tireFilter);
  }

  _loopOscillator(type, frequency, volume, target) {
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(target);
    osc.start();
    return osc;
  }

  _loopNoise(type, frequency, q) {
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const level = this.context.createGain();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    level.gain.value = 0;
    source.connect(filter);
    filter.connect(level);
    level.connect(this.vehicleBus);
    source.start();
    return [filter, level];
  }

  _applyVolumes() {
    if (!this.context) return;
    const t = this.context.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.68, t, 0.035);
    this.musicBus.gain.setTargetAtTime(this.paused ? 0 : 0.23, t, 0.045);
    this.vehicleBus.gain.setTargetAtTime(this.paused ? 0 : 1, t, 0.035);
    this.update();
  }

  _startSequencer() {
    if (this.timer !== null || !this.context) return;
    this.nextNote = this.context.currentTime + 0.055;
    this._schedule();
    this.timer = setInterval(() => this._schedule(), 50);
  }

  _schedule() {
    if (this.paused || !this.started || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    // A sleeping tab never attempts to catch up all the missed notes.
    if (this.nextNote < now - 0.2) this.nextNote = now + 0.025;
    while (this.nextNote < now + 0.14) {
      this._musicStep(this.step, this.nextNote);
      this.nextNote += 60 / this.bpm / 4;
      this.step = (this.step + 1) % 256;
    }
  }

  _musicStep(step, t) {
    const sixteenth = step % 16;
    const bar = Math.floor(step / 16);
    const root = [38, 34, 41, 36][Math.floor(bar / 2) % 4];
    const bus = this.musicBus;
    // Four-on-the-floor pulse with an original eight-bar bass/arp progression.
    if (sixteenth % 4 === 0) this._kick(t);
    if (sixteenth === 4 || sixteenth === 12) {
      this._noise(t, 0.15, 0.43, 'highpass', 1700, bus);
      this._tone(178, t, 0.085, 0.17, 'triangle', bus, 100);
    }
    if (sixteenth % 2 === 0 || (bar % 4 === 3 && sixteenth > 11)) {
      this._noise(t, sixteenth % 4 === 2 ? 0.085 : 0.037, sixteenth % 4 === 2 ? 0.2 : 0.1, 'highpass', 7200, bus);
    }
    if ([0, 3, 6, 8, 10, 14].includes(sixteenth)) {
      const bassOffset = sixteenth === 14 ? 12 : sixteenth === 6 ? 7 : 0;
      this._tone(this._midi(root + bassOffset), t, 0.135, 0.29, 'sawtooth', bus, null, 650);
      this._tone(this._midi(root - 12), t, 0.15, 0.17, 'sine', bus);
    }
    const notes = [0, 7, 12, 15, 19, 12, 7, 10];
    if (sixteenth % 2 === 1) {
      const note = root + 24 + notes[(Math.floor(sixteenth / 2) + (bar % 2) * 3) % notes.length];
      this._tone(this._midi(note), t, 0.16, 0.075, 'triangle', bus);
      // Quiet delayed echo creates space without a feedback network.
      this._tone(this._midi(note), t + 60 / this.bpm * 0.75, 0.16, 0.022, 'sine', bus);
    }
    if (sixteenth === 0 && bar % 2 === 0) {
      [0, 7, 15].forEach(n => this._tone(this._midi(root + 12 + n), t, 1.45, 0.035, 'triangle', bus, null, 1200));
    }
    if (sixteenth === 15 && bar % 4 === 3) this._noise(t, 0.13, 0.12, 'bandpass', 2800, bus);
  }

  _kick(t) {
    this._tone(145, t, 0.21, 0.7, 'sine', this.musicBus, 41);
    this._noise(t, 0.018, 0.07, 'highpass', 4000, this.musicBus);
  }

  _tone(frequency, t, duration, volume, type, target, endFrequency = null, cutoff = null) {
    const c = this.context;
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, frequency), t);
    if (endFrequency !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), t + duration * 0.82);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + Math.min(0.009, duration * 0.1));
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    let filter;
    if (cutoff) {
      filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      osc.connect(filter);
      filter.connect(env);
    } else osc.connect(env);
    env.connect(target);
    osc.onended = () => {
      osc.disconnect();
      if (filter) filter.disconnect();
      env.disconnect();
    };
    osc.start(t);
    osc.stop(t + duration + 0.015);
  }

  _noise(t, duration, volume, type, frequency, target) {
    const c = this.context;
    const source = c.createBufferSource();
    const filter = c.createBiquadFilter();
    const env = c.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = type === 'bandpass' ? 0.85 : 0.7;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(filter);
    filter.connect(env);
    env.connect(target);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      env.disconnect();
    };
    source.start(t, Math.random() * 0.7);
    source.stop(t + duration + 0.015);
  }

  _midi(note) {
    return 440 * 2 ** ((note - 69) / 12);
  }
}
