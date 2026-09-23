import { ballById, RELICS, type BallDef } from '../content/catalog'
import { clamp, len } from '../core/math'
import { collideCircle, collideSegment, type Ball } from '../physics/collide'
import { TUNING } from '../tuning'
import { gapCenter, pegPose, shutterWalls, type Board, type BinKind } from './board'
import type { Profile } from './profile'

export interface Cmd {
  nudge: -1 | 0 | 1
  flip: boolean
  special: boolean
  tilt: boolean
  aimX: number
}

export interface SimEvent {
  type: string
  x: number
  y: number
  gears?: number
  text?: string
  combo?: number
  mult?: number
  big?: boolean
}

const EMPTY: Cmd = { nudge: 0, flip: false, special: false, tilt: false, aimX: 0 }

export class Drop {
  readonly board: Board
  readonly ballDef: BallDef
  readonly profile: Profile
  ball: Ball
  launched = false
  time = 0
  mult = 1
  combo = 0
  comboTimer = 0
  nudges = 0
  maxNudges = 0
  specials = 0
  tilts = 0
  flips = 1
  gapT = 0
  gapTarget = 0
  integrity = 1
  integrityMax = 1
  earned = 0
  hazardThis = 0
  shatters = 0
  portals = 0
  golds = 0
  pegs = 0
  coreHits = 0
  coreCd = 0
  wonBoss = false
  coreOpen = false
  dead = false
  captured: BinKind | null = null
  jackpot = false
  flipped = false
  goldAfterFlip = false
  nudgeCd = 0
  specialCd = 0
  invuln = 0
  portalCd = 0
  stuck = 0
  compass = 0
  gilds = 0
  featherUsed = false
  timeScale = 1
  featherT = 0
  tiltT = 0
  tiltDir = 1
  armedRebound = false
  critPeg = -1
  critT = 0
  echoT = 0
  echoX = 0
  echoY = 0
  echoNx = 0
  echoNy = 0
  echoArmed = false
  spin = 0
  squash = 0
  squashAng = 0
  hitstop = 0
  flashPeg = new Float32Array(0)
  vanish = new Float32Array(0)
  gone: boolean[] = []
  gilded: boolean[] = []
  hitCd = new Float32Array(0)
  springCd: number[] = []
  events: SimEvent[] = []
  trail: { x: number; y: number }[] = []
  private trailAcc = 0

  constructor(board: Board, ballId: string, profile: Profile, integrity: number, integrityMax: number) {
    this.board = board
    this.ballDef = ballById(ballId)
    this.profile = profile
    this.ball = { x: board.launchX, y: board.launchY, vx: 0, vy: 0, r: profile.radius }
    this.mult = profile.startMult
    this.nudges = profile.maxNudges
    this.maxNudges = profile.maxNudges
    this.specials = profile.specialCharges
    this.tilts = profile.tiltCharges
    this.integrity = integrity
    this.integrityMax = integrityMax
    this.gapT = board.gapStart
    this.gapTarget = board.gapStart
    const n = board.pegs.length
    this.flashPeg = new Float32Array(n)
    this.vanish = new Float32Array(n)
    this.hitCd = new Float32Array(n)
    this.gone = board.pegs.map(() => false)
    this.gilded = board.pegs.map(() => false)
    this.springCd = board.zones.map(() => 0)
  }

  setAim(angle: number): void {
    if (this.launched) return
    const pose = launchPose(this.board, angle, this.profile, this.ballDef.launch)
    this.ball.x = pose.x
    this.ball.y = pose.y
    this.ball.vx = 0
    this.ball.vy = 0
  }

  launch(angle: number): void {
    const pose = launchPose(this.board, angle, this.profile, this.ballDef.launch)
    this.ball.x = pose.x
    this.ball.y = pose.y
    this.ball.vx = pose.vx
    this.ball.vy = pose.vy
    this.launched = true
    this.events.push({ type: 'launch', x: pose.x, y: pose.y })
  }

  pullEvents(): SimEvent[] {
    const e = this.events
    this.events = []
    return e
  }

  step(dt: number, cmd: Cmd = EMPTY): void {
    if (!this.launched || this.captured || this.dead) return
    this.time += dt
    if (this.comboTimer > 0) {
      this.comboTimer -= dt
      if (this.comboTimer <= 0) this.combo = 0
    }
    if (this.nudgeCd > 0) this.nudgeCd -= dt
    if (this.specialCd > 0) this.specialCd -= dt
    if (this.invuln > 0) this.invuln -= dt
    if (this.portalCd > 0) this.portalCd -= dt
    if (this.coreCd > 0) this.coreCd -= dt
    if (this.tiltT > 0) this.tiltT -= dt
    if (this.critT > 0) {
      this.critT -= dt
      if (this.critT <= 0) this.critPeg = -1
    }
    if (this.squash > 0) this.squash = Math.max(0, this.squash - dt * 2.4)
    for (let i = 0; i < this.hitCd.length; i++) if (this.hitCd[i] > 0) this.hitCd[i] -= dt
    for (let i = 0; i < this.flashPeg.length; i++) if (this.flashPeg[i] > 0) this.flashPeg[i] -= dt * 3.2
    for (let i = 0; i < this.vanish.length; i++) if (this.vanish[i] > 0) this.vanish[i] -= dt
    for (let i = 0; i < this.springCd.length; i++) if (this.springCd[i] > 0) this.springCd[i] -= dt

    if (this.featherT > 0) {
      this.featherT -= dt
      if (this.featherT <= 0) this.timeScale = 1
    }

    this.applyCmd(cmd)
    this.animateShutter(dt)

    const dist = len(this.ball.vx, this.ball.vy) * dt
    const sub = Math.max(1, Math.min(8, Math.ceil(dist / TUNING.substepPx)))
    const h = dt / sub
    for (let s = 0; s < sub; s++) {
      this.integrate(h)
      this.collide()
      this.sensors()
      this.clampSpeed()
      if (this.dead || this.captured) break
    }
    this.echo(dt)
    this.antiStuck(dt)
    this.capture()
    this.spin += this.ball.vx * dt * 0.015
    this.trailAcc += dt
    if (this.trailAcc > 0.016) {
      this.trailAcc = 0
      this.trail.push({ x: this.ball.x, y: this.ball.y })
      if (this.trail.length > 18) this.trail.shift()
    }
    if (!Number.isFinite(this.ball.x) || !Number.isFinite(this.ball.y)) {
      this.finishCapture(this.binAt(this.board.w / 2))
    }
  }

  private applyCmd(cmd: Cmd): void {
    if (cmd.nudge && this.nudgeCd <= 0 && this.nudges > 0) {
      this.nudges -= 1
      this.nudgeCd = 0.32
      const kick = TUNING.nudgeSpeed * this.profile.nudgeScale * cmd.nudge
      this.ball.vx += kick
      this.events.push({ type: 'nudge', x: this.ball.x, y: this.ball.y, text: cmd.nudge < 0 ? '◀' : '▶' })
    }
    if (cmd.flip && this.flips > 0 && this.board.shutterY != null) {
      this.flips -= 1
      this.flipped = true
      this.gapTarget = this.gapTarget > 0.5 ? 0 : 1
      this.events.push({ type: 'flip', x: this.ball.x, y: this.board.shutterY })
      if (this.profile.gateCombo && this.combo >= this.profile.gateCombo && this.nudges < this.maxNudges) {
        this.nudges += 1
        this.events.push({ type: 'refund', x: this.ball.x, y: this.ball.y, text: '+NUDGE' })
      }
    }
    if (cmd.special && this.specialCd <= 0 && this.specials > 0) {
      if (this.profile.special === 'rebound') {
        this.specials -= 1
        this.specialCd = 0.35
        this.armedRebound = true
        this.events.push({ type: 'special', x: this.ball.x, y: this.ball.y, text: 'REBOUND' })
      } else if (this.profile.special === 'crit') {
        const id = this.findCrit()
        if (id >= 0) {
          this.specials -= 1
          this.specialCd = 0.35
          this.critPeg = id
          this.critT = 2.5
          const p = this.pose(id)
          this.events.push({ type: 'special', x: p.x, y: p.y, text: 'MARK' })
        }
      }
    }
    if (cmd.tilt && this.specialCd <= 0 && this.tilts > 0) {
      this.tilts -= 1
      this.specialCd = 0.4
      this.tiltT = this.profile.tiltDuration
      this.tiltDir = Math.sign(cmd.aimX - this.ball.x) || this.tiltDir || 1
      this.events.push({
        type: 'special',
        x: this.ball.x,
        y: this.ball.y,
        text: this.tiltDir < 0 ? 'LEAN ◀' : 'LEAN ▶',
      })
    }
  }

  private findCrit(): number {
    let best = -1
    let bestD = 210
    const aheadX = this.ball.x + this.ball.vx * 0.12
    const aheadY = this.ball.y + Math.max(70, this.ball.vy * 0.18)
    for (let i = 0; i < this.board.pegs.length; i++) {
      if (!this.solid(i)) continue
      const p = this.pose(i)
      if (p.y < this.ball.y - 20) continue
      const d = Math.hypot(p.x - aheadX, p.y - aheadY)
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    return best
  }

  private animateShutter(dt: number): void {
    if (Math.abs(this.gapT - this.gapTarget) < 0.004) {
      this.gapT = this.gapTarget
      return
    }
    this.gapT += (this.gapTarget - this.gapT) * (1 - Math.exp(-16 * dt))
  }

  private gravity(): { x: number; y: number } {
    let angle = 0
    if (this.tiltT > 0) angle += this.tiltDir * 0.52
    if (this.board.boss && this.coreHits >= 4 && !this.wonBoss) angle += Math.sin(this.time * 1.35) * 0.3
    const g = TUNING.gravity * this.profile.gravityScale
    return { x: Math.sin(angle) * g, y: Math.cos(angle) * g }
  }

  private integrate(dt: number): void {
    const g = this.gravity()
    let ax = g.x
    let ay = g.y
    const { ball, profile, board } = this
    if (profile.magnetPull > 0) {
      for (let i = 0; i < board.pegs.length; i++) {
        if (!this.solid(i)) continue
        if (board.pegs[i].kind !== 'gold' && !this.gilded[i]) continue
        const p = this.pose(i)
        const dx = p.x - ball.x
        const dy = p.y - ball.y
        const d = Math.hypot(dx, dy)
        if (d > 8 && d < profile.magnetRadius) {
          const f = profile.magnetPull * (1 - d / profile.magnetRadius)
          ax += (dx / d) * f
          ay += (dy / d) * f * 0.22
        }
      }
    }
    if (profile.portalPull > 0) {
      for (const z of board.zones) {
        if (z.kind !== 'portal') continue
        const dx = z.x - ball.x
        const dy = z.y - ball.y
        const d = Math.hypot(dx, dy)
        if (d > 8 && d < 280) {
          const f = profile.portalPull * (1 - d / 280)
          ax += (dx / d) * f
          ay += (dy / d) * f * 0.15
        }
      }
    }
    for (const z of board.zones) {
      if (z.kind === 'well') {
        const dx = z.x - ball.x
        const dy = z.y - ball.y
        const d = Math.hypot(dx, dy)
        if (d > 18 && d < z.r) {
          const f = z.strength * profile.wellScale * (1 - d / z.r)
          const cap = Math.abs(g.y) * 0.72
          ax += clamp((dx / d) * f, -cap * 1.3, cap * 1.3)
          ay += clamp((dy / d) * f * 0.32, -cap, cap)
        }
      } else if (z.kind === 'accel') {
        if (ball.x >= z.x && ball.x <= z.x + z.w && ball.y >= z.y && ball.y <= z.y + z.h) {
          ax += z.dx * z.mag
          ay += z.dy * z.mag
        }
      } else if (z.kind === 'brake') {
        if (ball.x >= z.x && ball.x <= z.x + z.w && ball.y >= z.y && ball.y <= z.y + z.h) {
          const damp = Math.exp(-z.drag * dt)
          ball.vx *= damp
          ball.vy *= damp
        }
      }
    }
    ball.vx += ax * dt
    ball.vy += ay * dt
    const drag = Math.exp(-TUNING.airDrag * dt)
    ball.vx *= drag
    ball.vy *= drag
    ball.x += ball.vx * dt
    ball.y += ball.vy * dt
  }

  private pose(i: number): { x: number; y: number; vx: number; vy: number } {
    const amp = this.board.boss && this.coreHits >= 2 ? 2.1 : 1
    return pegPose(this.board.pegs[i], this.time, amp)
  }

  private solid(i: number): boolean {
    if (this.gone[i] || this.vanish[i] > 0) return false
    const peg = this.board.pegs[i]
    if (peg.collapseAt && this.coreHits >= peg.collapseAt) {
      if (!this.gone[i]) {
        this.gone[i] = true
        const p = this.pose(i)
        this.events.push({ type: 'collapse', x: p.x, y: p.y })
      }
      return false
    }
    return true
  }

  private collide(): void {
    const ball = this.ball
    const eBall = this.profile.restitution
    const mu = this.profile.friction
    for (const w of this.board.walls) {
      if (w.seal && this.coreOpen) continue
      const before = Math.sign(ball.vx)
      const impact = collideSegment(ball, w, Math.min(eBall, TUNING.wallE), mu * 0.4)
      if (impact > 40) this.noteBounce(before, impact)
    }
    if (this.board.shutterY != null) {
      const before = Math.sign(ball.vx)
      for (const w of shutterWalls(this.board, this.gapT)) {
        const impact = collideSegment(
          ball,
          w,
          this.armedRebound ? 0.9 : TUNING.shutterE,
          0.04,
        )
        if (impact > 30) {
          this.noteBounce(before, impact)
          if (this.armedRebound) this.armedRebound = false
        }
      }
    }
    for (let i = 0; i < this.board.pegs.length; i++) {
      if (!this.solid(i)) continue
      const pose = this.pose(i)
      const peg = this.board.pegs[i]
      const mat = peg.kind === 'gold' || this.gilded[i] ? TUNING.goldE : peg.kind === 'reinforced' ? TUNING.reinforcedE : TUNING.pegE
      let e = clamp((eBall + mat) * 0.5, 0.2, 0.98)
      if (this.armedRebound) e = 1.12
      const before = Math.sign(ball.vx)
      const impact = collideCircle(ball, pose.x, pose.y, peg.r, e, mu, pose.vx, pose.vy)
      if (impact > 46 && this.hitCd[i] <= 0) {
        this.hitCd[i] = 0.12
        if (this.armedRebound) this.armedRebound = false
        this.noteBounce(before, impact)
        this.onPeg(i, impact, pose.x, pose.y)
      }
    }
    for (const b of this.board.bumpers) {
      if (b.core && this.coreOpen) continue
      const dx = ball.x - b.x
      const dy = ball.y - b.y
      const d = Math.hypot(dx, dy) || 1
      const rad = ball.r + b.r
      if (d > rad) continue
      const nx = dx / d
      const ny = dy / d
      const vn = ball.vx * nx + ball.vy * ny
      if (b.core) {
        if (vn < -40 && this.coreCd <= 0 && !this.wonBoss) {
          this.coreCd = 0.48
          this.coreHits += 1
          this.events.push({
            type: 'core',
            x: b.x,
            y: b.y,
            text: `${this.coreHits}/5`,
            big: this.coreHits >= 5,
          })
          this.addMult(0.42)
          if (this.coreHits >= 5) {
            this.wonBoss = true
            this.coreOpen = true
            this.timeScale = 0.42
            this.featherT = 0.72
            const sp = len(ball.vx, ball.vy) || 1
            ball.x += (ball.vx / sp) * 8
            ball.y += (ball.vy / sp) * 8
            this.events.push({ type: 'maw', x: b.x, y: b.y, text: 'THE MAW OPENS', big: true })
          } else {
            ball.x = b.x + nx * (rad + 1)
            ball.y = b.y + ny * (rad + 1)
            ball.vy = -Math.min(1020, 760 + this.coreHits * 36)
            ball.vx += nx * 240
            this.squash = 0.45
          }
        }
        continue
      }
      if (vn >= -20 && d > rad - 2) continue
      const before = Math.sign(ball.vx)
      collideCircle(ball, b.x, b.y, b.r, TUNING.bumperE, 0.05)
      ball.vx += nx * TUNING.bumperKick * 0.28
      ball.vy = -Math.max(420, Math.abs(ball.vy) * 0.35 + TUNING.bumperKick * 0.72)
      this.noteBounce(before, 300)
      this.squash = 0.4
      this.onBumper(b.x, b.y, nx, ny)
    }
  }

  private noteBounce(before: number, impact: number): void {
    this.squash = Math.max(this.squash, clamp(impact / 900, 0.12, 0.42))
    this.squashAng = Math.atan2(this.ball.vy, this.ball.vx)
    const after = Math.sign(this.ball.vx)
    if (
      this.profile.compassEvery &&
      before !== 0 &&
      after !== 0 &&
      before !== after &&
      this.nudges < this.maxNudges
    ) {
      this.compass += 1
      if (this.compass >= this.profile.compassEvery) {
        this.compass = 0
        this.nudges += 1
        this.events.push({ type: 'refund', x: this.ball.x, y: this.ball.y, text: '+NUDGE' })
      }
    }
  }

  private onPeg(i: number, impact: number, x: number, y: number): void {
    const peg = this.board.pegs[i]
    if (this.profile.gildMax && !this.gilded[i] && peg.kind !== 'gold' && this.gilds < this.profile.gildMax) {
      const rowTaken = this.gildedRow(peg.row)
      if (!rowTaken) {
        this.gilded[i] = true
        this.gilds += 1
      }
    }
    const gold = peg.kind === 'gold' || this.gilded[i]
    if (peg.kind === 'vanish') this.vanish[i] = 1.45
    this.flashPeg[i] = 1
    this.pegs += 1
    if (gold) {
      this.golds += 1
      if (this.flipped) this.goldAfterFlip = true
      this.addMult(0.28 * (gold && peg.kind !== 'gold' ? this.profile.gildMult / 0.28 : 1))
    }
    if (this.critPeg === i && this.critT > 0) {
      this.critPeg = -1
      this.critT = 0
      this.addMult(1)
      this.events.push({ type: 'crit', x, y, text: 'MARK', big: true })
    }
    const canShatter =
      Number.isFinite(this.profile.shatterSpeed) &&
      impact >= this.profile.shatterSpeed &&
      (peg.kind === 'normal' || peg.kind === 'vanish' || peg.kind === 'gold') &&
      !peg.motion
    if (canShatter && this.shatters < 14) {
      this.gone[i] = true
      this.shatters += 1
      this.pay(x, y, this.profile.gearScale * 8, 'shatter', true)
    }
    const base = gold ? TUNING.goldPay : peg.kind === 'reinforced' ? TUNING.reinforcedPay : TUNING.pegPay
    this.bumpCombo()
    this.pay(x, y, base, gold ? 'gold' : 'peg', gold)
    this.maybeFeather()
  }

  private gildedRow(row: number): boolean {
    for (let i = 0; i < this.board.pegs.length; i++) {
      if (this.gilded[i] && this.board.pegs[i].row === row) return true
    }
    return false
  }

  private onBumper(x: number, y: number, nx: number, ny: number): void {
    this.bumpCombo()
    const bonus = this.profile.bumperGears
    this.pay(x, y, 2 + bonus, 'bumper', false)
    this.events.push({ type: 'bumper', x, y })
    if (this.profile.echo) {
      this.echoArmed = true
      this.echoT = RELICS['echo-core'].params.delay
      this.echoX = x
      this.echoY = y
      this.echoNx = nx
      this.echoNy = ny
    }
    this.maybeFeather()
  }

  private echo(dt: number): void {
    if (!this.echoArmed) return
    this.echoT -= dt
    if (this.echoT > 0) return
    this.echoArmed = false
    const d = Math.hypot(this.ball.x - this.echoX, this.ball.y - this.echoY)
    if (d < RELICS['echo-core'].params.radius) {
      const imp = RELICS['echo-core'].params.impulse
      this.ball.vx += this.echoNx * imp
      this.ball.vy += this.echoNy * imp
      this.events.push({ type: 'echo', x: this.echoX, y: this.echoY })
    }
  }

  private bumpCombo(): void {
    if (this.comboTimer > 0) this.combo += 1
    else this.combo = 1
    this.comboTimer = this.profile.comboWindow
    this.events.push({ type: 'combo', x: this.ball.x, y: this.ball.y, combo: this.combo })
  }

  private addMult(amount: number): void {
    const gain = amount * this.profile.multGain
    this.mult = Math.round((this.mult + gain) * 100) / 100
    this.events.push({ type: 'mult', x: this.ball.x, y: this.ball.y, mult: this.mult, text: `+${gain.toFixed(2)}` })
  }

  private pay(x: number, y: number, base: number, type: string, big: boolean): void {
    const comboMult = 1 + Math.max(0, this.combo - 1) * TUNING.comboStep
    const gears = Math.max(1, Math.round(base * comboMult * this.mult * this.profile.gearScale * this.board.payout))
    this.earned += gears
    this.events.push({ type, x, y, gears, text: `+${gears}`, big, combo: this.combo })
  }

  private maybeFeather(): void {
    if (this.featherUsed || !this.profile.featherAt) return
    if (this.combo >= this.profile.featherAt) {
      this.featherUsed = true
      this.timeScale = this.profile.featherScale
      this.featherT = this.profile.featherDur
      this.events.push({ type: 'feather', x: this.ball.x, y: this.ball.y, text: 'THE CLOCK SKIPS', big: true })
    }
  }

  private sensors(): void {
    const ball = this.ball
    for (let zi = 0; zi < this.board.zones.length; zi++) {
      const z = this.board.zones[zi]
      if (z.kind === 'spike') {
        const d = Math.hypot(ball.x - z.x, ball.y - z.y)
        if (d < ball.r + z.r * 0.72 && this.invuln <= 0 && !this.dead) {
          this.invuln = 0.85
          this.hazardThis += 1
          this.combo = 0
          this.comboTimer = 0
          this.integrity -= 1
          const nx = (ball.x - z.x) / (d || 1)
          const ny = (ball.y - z.y) / (d || 1)
          ball.vx += nx * 280
          ball.vy += ny * 220 - 40
          this.events.push({ type: 'hazard', x: z.x, y: z.y, text: 'SHELL −1', big: true })
          if (this.integrity <= 0) this.shatter()
        }
      } else if (z.kind === 'spring' && this.springCd[zi] <= 0) {
        const d = Math.hypot(ball.x - z.x, ball.y - z.y)
        if (d < ball.r + z.r && ball.vy > -80) {
          this.springCd[zi] = 0.35
          ball.vy = -Math.max(TUNING.springKick, Math.abs(ball.vy))
          ball.vx += (ball.x - z.x) * 2
          this.bumpCombo()
          this.pay(z.x, z.y, 2, 'spring', false)
        }
      } else if (z.kind === 'portal' && this.portalCd <= 0) {
        const d = Math.hypot(ball.x - z.x, ball.y - z.y)
        if (d < z.r) {
          const other = this.board.zones.find((o) => o.kind === 'portal' && o.pid !== z.pid)
          if (other && other.kind === 'portal') {
            const sp = len(ball.vx, ball.vy) || 1
            ball.x = other.x + (ball.vx / sp) * (other.r + ball.r + 6)
            ball.y = other.y + (ball.vy / sp) * (other.r + ball.r + 6)
            this.portalCd = 0.45
            this.portals += 1
            if (this.profile.portalBoost) {
              const speed = RELICS.ouroboros.params.speed
              ball.vx *= speed
              ball.vy *= speed
              this.addMult(RELICS.ouroboros.params.mult)
              if ((this.profile.tags.portal ?? 0) >= 2) this.addMult(0.15)
            }
            this.events.push({ type: 'portal', x: other.x, y: other.y, text: 'PORTAL' })
          }
        }
      }
    }
  }

  private shatter(): void {
    this.dead = true
    this.events.push({ type: 'shatter-ball', x: this.ball.x, y: this.ball.y, text: 'SHELL BROKEN', big: true })
  }

  private antiStuck(dt: number): void {
    if (this.captured || this.dead) return
    const sp = len(this.ball.vx, this.ball.vy)
    if (sp < 58 && this.ball.y < this.board.floorY - 8) this.stuck += dt
    else this.stuck = 0
    if (this.stuck < 0.3) return
    this.stuck = 0
    if (this.board.boss && !this.wonBoss) {
      const core = this.board.bumpers.find((b) => b.core)
      if (core && this.ball.y > core.y - 40) {
        this.ball.vy = -460
        this.ball.vx += this.ball.x < this.board.w / 2 ? -90 : 90
        return
      }
    }
    if (this.board.shutterY != null && Math.abs(this.ball.y - this.board.shutterY) < 84) {
      const c = gapCenter(this.board, this.gapT)
      const inGap = Math.abs(this.ball.x - c) < this.board.gapWidth * 0.42
      if (!inGap) {
        this.ball.vx = (this.ball.x < c ? -1 : 1) * 260
        this.ball.vy = 320
        return
      }
    }
    this.ball.vy += 180
  }

  private capture(): void {
    if (this.captured || this.dead) return
    const y = this.ball.y
    const floor = this.board.floorY
    const sp = len(this.ball.vx, this.ball.vy)
    if (y < floor + 36) return
    if (sp > 150 && y < floor + 110) return
    const kind = this.binAt(this.ball.x)
    if (this.board.boss && !this.coreOpen && kind === 'jackpot') return
    this.finishCapture(kind)
  }

  private clampSpeed(): void {
    const sp = len(this.ball.vx, this.ball.vy)
    if (sp > TUNING.maxSpeed) {
      const k = TUNING.maxSpeed / sp
      this.ball.vx *= k
      this.ball.vy *= k
    }
  }

  private binAt(x: number): BinKind {
    for (const b of this.board.bins) {
      if (x >= b.x0 && x <= b.x1) return b.kind
    }
    return x < this.board.w / 2 ? 'hazard' : 'hazard'
  }

  private finishCapture(kind: BinKind): void {
    if (this.captured || this.dead) return
    const x = this.ball.x
    const y = this.ball.y
    if (this.board.boss && !this.wonBoss) {
      this.captured = 'hazard'
      this.hazardThis += 1
      this.dead = true
      this.events.push({ type: 'pocket', x, y, text: 'THE GRINDER KEEPS YOU', gears: 0 })
      this.ball.vx = 0
      this.ball.vy = 0
      return
    }
    const resolved = kind
    this.captured = resolved
    if (resolved === 'hazard') {
      this.hazardThis += 1
      this.integrity -= 1
      this.events.push({ type: 'pocket', x, y, text: 'GUTTER', gears: 0 })
      if (this.integrity <= 0) this.dead = true
    } else if (resolved === 'coin') {
      const gears = Math.round(12 * this.board.payout)
      this.earned += gears
      this.events.push({ type: 'pocket', x, y, text: 'POCKET', gears })
    } else if (resolved === 'bonus') {
      const gears = Math.round(18 * this.mult * this.board.payout)
      this.earned += gears
      this.events.push({ type: 'pocket', x, y, text: 'RICH POCKET', gears, big: this.mult >= 2 })
    } else if (resolved === 'jackpot') {
      const hot = this.mult >= TUNING.jackpotAt
      const gears = Math.round((hot ? 40 : 22) * this.mult * this.board.payout)
      this.earned += gears
      this.jackpot = hot
      this.events.push({
        type: hot ? 'jackpot' : 'pocket',
        x,
        y,
        text: hot ? 'JACKPOT' : 'COLD MAW',
        gears,
        big: true,
      })
    }
    this.ball.vx = 0
    this.ball.vy = 0
  }
}

export function launchPose(board: Board, angle: number, profile: Profile, launchScale: number) {
  const a = clamp(angle, -profile.aimCone, profile.aimCone)
  return {
    x: board.launchX,
    y: board.launchY,
    vx: Math.sin(a) * 460 * launchScale,
    vy: (150 + Math.cos(a) * 80) * launchScale,
  }
}

export function previewPath(drop: Drop, angle: number): { x: number; y: number }[] {
  const ghost = new Drop(drop.board, drop.ballDef.id, drop.profile, drop.integrity, drop.integrityMax)
  ghost.gapT = drop.gapT
  ghost.gapTarget = drop.gapT
  ghost.launch(angle)
  ghost.events = []
  const pts: { x: number; y: number }[] = []
  const steps = drop.profile.previewSteps
  for (let i = 0; i < steps; i++) {
    ghost.step(TUNING.previewDt, EMPTY)
    if (i % 2 === 0) pts.push({ x: ghost.ball.x, y: ghost.ball.y })
    if (ghost.captured || ghost.dead || ghost.ball.y > drop.board.floorY) break
  }
  return pts
}
