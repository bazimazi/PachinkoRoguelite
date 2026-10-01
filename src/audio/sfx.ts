/** Major pentatonic steps in semitones, so rising combos always sound like a melody. */
const PENTA = [0, 2, 4, 7, 9]

function penta(step: number): number {
  const octave = Math.floor(step / PENTA.length)
  return PENTA[step % PENTA.length] + octave * 12
}

export class Sfx {
  private ctx: AudioContext | null = null
  private bus: GainNode | null = null
  volume = 0.7
  private muted = false
  private lastPeg = 0

  setMuted(m: boolean): void {
    this.muted = m
    if (this.ctx) this.ctx.suspend().catch(() => undefined)
    if (!m) this.resume()
  }

  toggle(): boolean {
    this.muted = !this.muted
    if (this.muted) this.ctx?.suspend().catch(() => undefined)
    else this.resume()
    return this.muted
  }

  get isMuted(): boolean {
    return this.muted
  }

  resume(): void {
    if (this.muted) return
    const ctx = this.ensure()
    if (ctx.state === 'suspended') void ctx.resume()
  }

  private ensure(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      // Everything goes through one compressor so stacked hits never clip.
      const comp = this.ctx.createDynamicsCompressor()
      comp.threshold.value = -18
      comp.knee.value = 12
      comp.ratio.value = 4
      comp.attack.value = 0.003
      comp.release.value = 0.12
      this.bus = this.ctx.createGain()
      this.bus.gain.value = 1
      this.bus.connect(comp)
      comp.connect(this.ctx.destination)
    }
    return this.ctx
  }

  private out(): AudioNode {
    this.ensure()
    return this.bus!
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, slide = 0, delay = 0): void {
    if (this.muted || this.volume <= 0) return
    const ctx = this.ensure()
    const t = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain * this.volume, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(this.out())
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  private noise(dur: number, gain: number, hp = 400, delay = 0): void {
    if (this.muted || this.volume <= 0) return
    const ctx = this.ensure()
    const t = ctx.currentTime + delay
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur))
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = hp
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain * this.volume, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    src.connect(filter)
    filter.connect(g)
    g.connect(this.out())
    src.start(t)
  }

  /** A struck glass bell: a fundamental plus a quiet inharmonic partial. */
  private bell(freq: number, dur: number, gain: number, delay = 0): void {
    this.tone(freq, dur, 'sine', gain, 0, delay)
    this.tone(freq * 2.76, dur * 0.45, 'sine', gain * 0.22, 0, delay)
  }

  peg(combo: number): void {
    // Rapid hits in one frame would stack into a buzz.
    const now = performance.now()
    if (now - this.lastPeg < 18) return
    this.lastPeg = now
    const f = 523 * Math.pow(2, penta(Math.min(combo - 1, 14)) / 12)
    this.bell(f, 0.16, 0.09)
  }

  gold(combo: number): void {
    const f = 659 * Math.pow(2, penta(Math.min(combo, 14)) / 12)
    this.bell(f, 0.26, 0.1)
    this.tone(f * 1.5, 0.18, 'triangle', 0.04, 0, 0.03)
  }

  combo(n: number): void {
    const base = 523 * Math.pow(2, penta(Math.min(n / 5, 6) * 2) / 12)
    ;[0, 4, 7, 12].forEach((s, i) => this.bell(base * Math.pow(2, s / 12), 0.2, 0.07, i * 0.045))
  }

  pop(index: number, gold: boolean): void {
    const f = 392 * Math.pow(2, penta(Math.min(index, 24)) / 12)
    this.tone(f, 0.07, 'triangle', gold ? 0.07 : 0.05)
    if (gold) this.tone(f * 2, 0.09, 'sine', 0.03)
  }

  bumper(): void {
    this.noise(0.06, 0.1, 300)
    this.tone(220, 0.14, 'square', 0.05, -110)
    this.tone(440, 0.1, 'sine', 0.05, 220)
  }

  hazard(): void {
    this.tone(110, 0.28, 'sawtooth', 0.09, -60)
    this.noise(0.12, 0.08, 200)
  }

  launch(): void {
    this.noise(0.14, 0.09, 700)
    this.tone(180, 0.18, 'sine', 0.09, 160)
    this.tone(90, 0.12, 'triangle', 0.06, -30)
  }

  flip(): void {
    this.tone(140, 0.07, 'square', 0.05)
    this.noise(0.05, 0.06, 800)
    this.tone(330, 0.08, 'triangle', 0.04, 110, 0.03)
  }

  nudge(): void {
    this.noise(0.06, 0.06, 900)
    this.tone(260, 0.06, 'sine', 0.04, 60)
  }

  jackpot(): void {
    ;[523, 659, 784, 1046, 1318].forEach((f, i) => this.bell(f, 0.4, 0.09, i * 0.075))
    this.noise(0.5, 0.05, 4000, 0.3)
  }

  shatter(): void {
    this.noise(0.18, 0.14, 500)
    this.tone(800, 0.12, 'square', 0.04, -400)
  }

  core(): void {
    this.tone(110, 0.22, 'sine', 0.14, -30)
    this.noise(0.1, 0.1, 150)
  }

  ui(): void {
    this.tone(640, 0.05, 'sine', 0.05)
    this.tone(960, 0.04, 'sine', 0.025, 0, 0.025)
  }

  pocket(good = true): void {
    if (good) {
      this.bell(784, 0.3, 0.08)
      this.bell(1046, 0.3, 0.06, 0.07)
    } else this.tone(196, 0.22, 'triangle', 0.08, -60)
  }
}
