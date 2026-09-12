// ============================================================
// AUDIO.JS - AudioManager
// All sound is generated programmatically with WebAudio oscillators
// and noise buffers, so no external/copyrighted audio is used.
// ============================================================
class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = SaveManager.getSoundEnabled();
    this.engineNode = null;
  }

  _ensureCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  // must be called from a user gesture (menu click / key press)
  unlock() { this._ensureCtx(); }

  setEnabled(v) {
    this.enabled = v;
    SaveManager.setSoundEnabled(v);
    if (!v) this.stopEngine();
  }
  toggle() { this.setEnabled(!this.enabled); return this.enabled; }

  _tone(freq, dur, type = 'square', vol = 0.15, glideTo = null) {
    if (!this.enabled) return;
    const ctx = this._ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (glideTo) osc.frequency.linearRampToValueAtTime(glideTo, ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  _noise(dur, vol = 0.2, filterFreq = 1200) {
    if (!this.enabled) return;
    const ctx = this._ensureCtx();
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
  }

  menuMove() { this._tone(440, 0.05, 'square', 0.08); }
  menuSelect() { this._tone(660, 0.08, 'square', 0.12); this._tone(880, 0.09, 'square', 0.1); }
  countdownBeep() { this._tone(520, 0.12, 'square', 0.15); }
  countdownGo() { this._tone(880, 0.22, 'square', 0.18); }
  collision() { this._noise(0.18, 0.25, 800); }
  nitro() { this._tone(300, 0.35, 'sawtooth', 0.12, 900); }
  coin() { this._tone(988, 0.06, 'square', 0.1); this._tone(1318, 0.08, 'square', 0.1); }
  lap() { this._tone(659, 0.1, 'square', 0.12); this._tone(880, 0.14, 'square', 0.12); }
  victory() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._tone(f, 0.22, 'square', 0.14), i * 110));
  }
  gameOver() {
    [392, 349, 311, 261].forEach((f, i) => setTimeout(() => this._tone(f, 0.28, 'square', 0.14), i * 120));
  }
  powerup() { this._tone(700, 0.05, 'square', 0.1, 1100); }

  // subtle looping engine hum whose pitch follows throttle/speed
  startEngine() {
    if (!this.enabled) { this.stopEngine(); return; }
    if (this.engineNode) return;
    const ctx = this._ensureCtx();
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    const gain = ctx.createGain();
    gain.gain.value = 0.035;
    osc.frequency.value = 60;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    this.engineNode = { osc, gain };
  }
  updateEngine(throttle01, speed01) {
    if (!this.enabled) { this.stopEngine(); return; }
    if (!this.engineNode) this.startEngine();
    if (!this.engineNode) return;
    const target = 55 + speed01 * 160 + throttle01 * 40;
    this.engineNode.osc.frequency.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  }
  stopEngine() {
    if (this.engineNode) {
      try { this.engineNode.osc.stop(); } catch (e) {}
      this.engineNode = null;
    }
  }
}
