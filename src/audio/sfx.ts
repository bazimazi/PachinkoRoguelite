export class Sfx {
  private ctx: AudioContext | null = null
  volume = 0.7
  private muted = false

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
    if (!this.ctx) this.ctx = new AudioContext()
    return this.ctx
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, slide = 0): void {
    if (this.muted || this.volume <= 0) return
    const ctx = this.ensure()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur)
    g.gain.setValueAtTime(gain * this.volume, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  private noise(dur: number, gain: number, hp = 400): void {
    if (this.muted || this.volume <= 0) return
    const ctx = this.ensure()
    const t = ctx.currentTime
    const len = Math.floor(ctx.sampleRate * dur)
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
    g.connect(ctx.destination)
    src.start(t)
  }

  peg(combo: number): void {
    this.tone(520 + combo * 28, 0.06, 'triangle', 0.08)
  }

  gold(combo: number): void {
    this.tone(660 + combo * 20, 0.09, 'sine', 0.1)
    this.tone(880 + combo * 16, 0.12, 'triangle', 0.05)
  }

  bumper(): void {
    this.noise(0.08, 0.12, 200)
    this.tone(180, 0.1, 'square', 0.06, -80)
  }

  hazard(): void {
    this.tone(90, 0.2, 'sawtooth', 0.08, -40)
  }

  launch(): void {
    this.noise(0.1, 0.08, 600)
    this.tone(240, 0.12, 'sine', 0.06, 80)
  }

  flip(): void {
    this.tone(140, 0.07, 'square', 0.05)
    this.noise(0.05, 0.06, 800)
  }

  nudge(): void {
    this.noise(0.05, 0.05, 900)
  }

  jackpot(): void {
    ;[523, 659, 784, 1046].forEach((f, i) => {
      window.setTimeout(() => this.tone(f, 0.18, 'triangle', 0.09), i * 70)
    })
  }

  shatter(): void {
    this.noise(0.16, 0.14, 500)
    this.tone(800, 0.1, 'square', 0.04, -400)
  }

  core(): void {
    this.tone(110, 0.16, 'sine', 0.12, -30)
    this.noise(0.1, 0.1, 150)
  }

  ui(): void {
    this.tone(640, 0.04, 'sine', 0.05)
  }

  pocket(): void {
    this.tone(420, 0.08, 'triangle', 0.07)
  }
}
