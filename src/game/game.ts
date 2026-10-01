import { Sfx } from '../audio/sfx'
import { BALLS, BALL_LIST, CHALLENGES, LORE, PARTS, RELICS, TRAILS, UPGRADES, ballById } from '../content/catalog'
import { clamp, formatMult } from '../core/math'
import { cleanSeed, makeSeed, rngFor } from '../core/rng'
import { Input } from '../input'
import { grantChallenges } from '../meta/challenges'
import { loadSave, shardsFor, writeSave, type SaveData } from '../meta/save'
import { type Cam, machineScale, screenToWorld } from '../render/camera'
import { drawFrame, type Floater, type Particle, type Ring } from '../render/draw'
import { pegPose, type Board, type BinKind } from '../sim/board'
import { Drop, previewPath, type Cmd } from '../sim/drop'
import { createBoard, demoBoard } from '../sim/generate'
import { computeProfile, type Profile } from '../sim/profile'
import { RESEARCH_ORDER, STARTER_RELICS, TUNING } from '../tuning'
import { createRoute, type GameNode } from './route'
import { randomFrom, rollReward, rollShop, type Offer } from './offers'
import { UI, type ChoiceCard, type HudModel, type StageModel, type SummaryModel, type ViewModel } from '../ui/ui'

const EMPTY: Cmd = { nudge: 0, flip: false, special: false, tilt: false, aimX: 0 }

const COMBO_CALLS: Record<number, string> = { 5: 'Nice chain', 10: 'Great chain', 15: 'Rattling!', 20: 'Unstoppable', 30: 'Helix hum' }

function binKindAt(board: Board, x: number): BinKind | null {
  for (const b of board.bins) if (x >= b.x0 && x <= b.x1) return b.kind
  return null
}

interface Run {
  seed: string
  ballId: string
  nodes: Record<string, GameNode>
  nodeId: string
  upgrades: string[]
  relics: string[]
  gears: number
  score: number
  integrity: number
  integrityMax: number
  profile: Profile
  drops: number
  bestCombo: number
  bestMult: number
  shatters: number
  portals: number
  jackpots: number
  flipGold: boolean
  cleanDrop: boolean
  bossWin: boolean
  launchedOnce: boolean
  depthTitle: string
  boardNonce: number
  reachedCore: boolean
}

interface Summary extends SummaryModel {
  ballId: string
}

export class Game {
  private save: SaveData
  private screen = 'hub'
  private returnTo = 'hub'
  private run: Run | null = null
  private drop: Drop | null = null
  private demo: Drop | null = null
  private demoAngle = -0.25
  private demoWait = 0
  private offers: Offer[] = []
  private rerolls = 0
  private summary: Summary | null = null
  private reveal: { name: string; text: string; tags: string } | null = null
  private resolveCopy = { title: 'Settled', sub: '' }
  private resolveT = 0
  private draftSeed = ''
  private hubTick = 0
  private selectedPulse = 0
  private aimAngle = 0
  private mouseAim = false
  private keyboardAim = 0
  private preview: { x: number; y: number }[] = []
  private previewKey = Number.NaN
  private pending: Cmd = { ...EMPTY }
  private camY = 400
  private snapCam = true
  private zoom = 1
  private zoomTarget = 1
  /** Real-time multiplier on the fixed-step accumulator. Physics stays identical, it just runs slower. */
  private warp = 1
  private launchKick = 0
  private rings: Ring[] = []
  private popT: Float32Array | null = null
  private cash: { order: number[]; next: number; t: number; step: number } | null = null
  private trauma = 0
  private shakeX = 0
  private shakeY = 0
  private particles: Particle[] = []
  private floaters: Floater[] = []
  private toast: { title: string; sub: string } | null = null
  private toastT = 0
  private toastBig = false
  private flash: ViewModel['flash'] = ''
  private flashT = 0
  private copied = ''
  private accum = 0
  private last = 0
  private cssW = 800
  private cssH = 600
  private dpr = 1
  private fps = 0
  private frames = 0
  private fpsT = 0
  private debugOpen = false
  private hitboxes = false
  private readonly dev: boolean
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly input: Input
  private readonly ui: UI
  private readonly sfx: Sfx
  private readonly debugEl: HTMLElement

  constructor() {
    this.dev = import.meta.env.DEV
    this.save = loadSave()
    if (!this.save.balls.includes(this.save.ball)) this.save.ball = 'rubber'
    this.sfx = new Sfx()
    this.sfx.volume = this.save.settings.volume
    this.canvas = document.getElementById('view') as HTMLCanvasElement
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('canvas unavailable')
    this.ctx = ctx
    this.input = new Input(this.canvas)
    this.ui = new UI(
      document.getElementById('stage')!,
      document.getElementById('hud')!,
      document.getElementById('toast')!,
      document.getElementById('flash')!,
      (act) => this.onAction(act),
      (seed) => {
        this.draftSeed = seed
      },
    )
    this.debugEl = document.getElementById('debug')!
    const params = new URLSearchParams(location.search)
    if (params.get('seed')) this.draftSeed = cleanSeed(params.get('seed') || '')
    if (params.has('debug')) this.debugOpen = true
    document.documentElement.classList.toggle('lg', this.save.settings.large)
    this.resize()
    window.addEventListener('resize', () => this.resize())
    this.spawnDemo()
    requestAnimationFrame((t) => this.frame(t))
  }

  private resize(): void {
    const r = this.canvas.getBoundingClientRect()
    this.cssW = r.width
    this.cssH = r.height
    this.dpr = Math.min(2, window.devicePixelRatio || 1)
    this.canvas.width = Math.max(1, Math.floor(this.cssW * this.dpr))
    this.canvas.height = Math.max(1, Math.floor(this.cssH * this.dpr))
  }

  private frame(now: number): void {
    const t = now / 1000
    let dt = t - this.last
    this.last = t
    if (!Number.isFinite(dt) || dt < 0) dt = 0
    if (dt > 0.05) dt = 0.05
    this.frames++
    this.fpsT += dt
    if (this.fpsT >= 0.5) {
      this.fps = this.frames / this.fpsT
      this.frames = 0
      this.fpsT = 0
    }
    this.collectEdges()
    this.accum += dt * this.warp
    let steps = 0
    while (this.accum >= TUNING.dt && steps < 8) {
      this.fixed(TUNING.dt)
      this.accum -= TUNING.dt
      steps++
    }
    this.animate(dt)
    this.draw(t)
    this.ui.render(this.view())
    this.debug()
    this.input.endFrame()
    requestAnimationFrame((n) => this.frame(n))
  }

  private collectEdges(): void {
    const p = this.input.pressed
    if (p.has('Backquote') && this.dev) this.debugOpen = !this.debugOpen
    if (p.has('Escape')) {
      if (this.screen === 'pause') this.screen = this.returnTo === 'drop' || this.returnTo === 'aim' ? this.returnTo : 'aim'
      else if (this.screen === 'aim' || this.screen === 'drop') {
        this.returnTo = this.screen
        this.screen = 'pause'
      } else if (this.screen === 'help' || this.screen === 'collection' || this.screen === 'settings') {
        this.screen = this.returnTo === 'pause' ? 'pause' : 'hub'
      }
    }
    if (this.screen === 'hub' && p.has('Enter')) this.onAction('start')
    else if (this.screen === 'aim') {
      if (p.has('ArrowLeft') || p.has('KeyA')) {
        this.mouseAim = false
        this.keyboardAim -= 0.045
      }
      if (p.has('ArrowRight') || p.has('KeyD')) {
        this.mouseAim = false
        this.keyboardAim += 0.045
      }
      if (this.input.pointer && (Math.abs(this.input.dx) + Math.abs(this.input.dy) > 1.5)) this.mouseAim = true
      if (p.has('Enter') || this.input.clicked) this.launch()
    } else if (this.screen === 'drop') {
      if (p.has('KeyA') || p.has('ArrowLeft')) this.pending.nudge = -1
      if (p.has('KeyD') || p.has('ArrowRight')) this.pending.nudge = 1
      if (p.has('KeyF')) this.pending.flip = true
      if (p.has('Space')) this.pending.special = true
      if (p.has('KeyQ')) this.pending.tilt = true
    } else if (p.has('Digit1')) this.hotkey(0)
    else if (p.has('Digit2')) this.hotkey(1)
    else if (p.has('Digit3')) this.hotkey(2)
    else if (p.has('Enter')) {
      if (this.screen === 'resolve') this.skipResolve()
      else if (this.screen === 'runend') this.onAction('again')
      else if (this.screen === 'pause') this.screen = this.returnTo
    }
  }

  private hotkey(index: number): void {
    if (this.screen === 'choices' || this.screen === 'upgrade' || this.screen === 'relic') this.pick(index)
    else if (this.screen === 'shop') this.buy(index)
    else if (this.screen === 'fork') this.fork(index)
    else if (this.screen === 'bargain') this.bargain(index === 0 ? 'shell' : index === 1 ? 'pay' : 'walk')
  }

  private fixed(dt: number): void {
    if (this.attract()) {
      this.stepDemo(dt)
      return
    }
    if (this.screen !== 'drop' || !this.drop) return
    if (this.drop.hitstop > 0) {
      this.drop.hitstop -= dt
      return
    }
    const cmd = this.pending
    this.pending = { ...EMPTY, aimX: this.worldX() }
    cmd.aimX = this.worldX()
    this.drop.step(dt * this.drop.timeScale, cmd)
    this.drain(false)
    if (this.drop.captured || this.drop.dead) this.finishDrop()
  }

  private stepDemo(dt: number): void {
    if (!this.demo) this.spawnDemo()
    const demo = this.demo
    if (!demo) return
    if (demo.captured || demo.dead) {
      this.demoWait -= dt
      if (this.demoWait <= 0) {
        this.demoAngle = this.demoAngle > 0.3 ? -0.35 : this.demoAngle + 0.22
        this.spawnDemo()
      }
      return
    }
    if (!demo.launched) demo.launch(this.demoAngle)
    demo.step(dt, EMPTY)
    demo.pullEvents()
  }

  private spawnDemo(): void {
    const board = demoBoard()
    const profile = computeProfile('rubber', [], [])
    this.demo = new Drop(board, 'rubber', profile, 3, 3)
    this.demoWait = 0.45
  }

  private animate(dt: number): void {
    if (this.screen === 'aim' && this.drop) {
      const angle = this.currentAngle()
      this.aimAngle = angle
      this.drop.setAim(angle)
      const key = Math.round(angle * 200)
      if (key !== this.previewKey) {
        this.previewKey = key
        this.preview = previewPath(this.drop, angle)
      }
    }
    if (this.screen === 'resolve') {
      this.resolveT -= dt
      if (this.resolveT <= 0) this.skipResolve()
    }
    const target = this.cameraTarget()
    if (this.snapCam) {
      this.camY = target
      this.snapCam = false
    } else {
      this.camY += (target - this.camY) * (1 - Math.exp(-4.2 * dt))
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.7)
    const mag = this.trauma * this.trauma * (this.save.settings.shake ? 18 : 0)
    this.shakeX = (Math.random() * 2 - 1) * mag
    this.shakeY = (Math.random() * 2 - 1) * mag
    this.updateWarp(dt)
    this.zoom += (Math.max(this.zoomTarget, 1) - this.zoom) * (1 - Math.exp(-3 * dt))
    this.launchKick = Math.max(0, this.launchKick - dt * 3.2)
    this.cashIn(dt)
    if (!this.drop || this.drop.hitstop <= 0) {
      const vdt = dt * (0.35 + 0.65 * this.warp)
      const drag = Math.exp(-2.6 * vdt)
      for (const p of this.particles) {
        p.life -= vdt
        p.vy += (p.streak ? 520 : 60) * vdt
        p.vx *= drag
        p.vy *= drag
        p.x += p.vx * vdt
        p.y += p.vy * vdt
      }
      this.particles = this.particles.filter((p) => p.life > 0).slice(-260)
      for (const f of this.floaters) {
        f.life -= vdt
        f.y -= 70 * vdt * (f.life / f.max)
      }
      this.floaters = this.floaters.filter((f) => f.life > 0).slice(-28)
      for (const r of this.rings) r.life -= vdt
      this.rings = this.rings.filter((r) => r.life > 0).slice(-40)
    }
    if (this.toastT > 0) {
      this.toastT -= dt
      if (this.toastT <= 0) this.toast = null
    }
    if (this.flashT > 0) {
      this.flashT -= dt
      if (this.flashT <= 0) this.flash = ''
    }
    this.canvas.style.cursor = this.screen === 'aim' ? 'crosshair' : 'default'
  }

  private draw(time: number): void {
    const drop = this.attract() ? this.demo : this.drop
    const board = drop?.board ?? null
    const scale = board ? machineScale(this.cssW, board.w) : 1
    const cam: Cam = {
      scale,
      camY: this.camY,
      cssW: this.cssW,
      cssH: this.cssH,
      boardW: board?.w ?? 800,
      zoom: this.zoom,
      shakeX: this.shakeX,
      shakeY: this.shakeY,
    }
    const trail = TRAILS.find((t) => t.id === this.save.trail)?.color ?? ''
    const demo = this.attract()
    drawFrame({
      ctx: this.ctx,
      cssW: this.cssW,
      cssH: this.cssH,
      dpr: this.dpr,
      cam,
      board,
      drop,
      preview: this.screen === 'aim' ? this.preview : [],
      aiming: this.screen === 'aim',
      aimAngle: demo ? this.demoAngle : this.aimAngle,
      particles: demo ? [] : this.particles,
      floaters: demo ? [] : this.floaters,
      rings: demo ? [] : this.rings,
      popT: demo ? null : this.popT,
      launchKick: demo ? 0 : this.launchKick,
      warp: this.warp,
      multHot: !!drop && drop.mult >= TUNING.jackpotAt,
      particlesOn: this.save.settings.particles,
      trailColor: trail,
      time,
      hitboxes: this.hitboxes,
    })
  }

  private menu(): boolean {
    return this.screen === 'hub' || this.screen === 'help' || this.screen === 'collection' || this.screen === 'settings'
  }

  /** Attract mode only when no fall is in progress, so pause settings keep the live machine. */
  private attract(): boolean {
    return !this.run && (this.menu() || this.screen === 'reveal')
  }

  private currentAngle(): number {
    const cone = this.run?.profile.aimCone ?? 0.58
    if (!this.mouseAim || !this.drop) return clamp(this.keyboardAim, -cone, cone)
    const world = screenToWorld(this.cam(), this.input.x, this.input.y)
    const dx = world.x - this.drop.ball.x
    const dy = world.y - this.drop.ball.y
    if (dy < 8 && Math.abs(dx) < 8) return clamp(this.keyboardAim, -cone, cone)
    return clamp(Math.atan2(dx, dy), -cone, cone)
  }

  private cam(): Cam {
    const board = (this.attract() ? this.demo : this.drop)?.board
    return {
      scale: board ? machineScale(this.cssW, board.w) : 1,
      camY: this.camY,
      cssW: this.cssW,
      cssH: this.cssH,
      boardW: board?.w ?? 800,
      zoom: this.zoom,
      shakeX: this.shakeX,
      shakeY: this.shakeY,
    }
  }

  private worldX(): number {
    return screenToWorld(this.cam(), this.input.x, this.input.y).x
  }

  private cameraTarget(): number {
    const drop = this.attract() ? this.demo : this.drop
    const board = drop?.board
    if (!board) return 400
    const scale = machineScale(this.cssW, board.w)
    const half = this.cssH / scale / 2
    let y = board.h * 0.34
    // Frame the launcher at the top so the barrel and the aim line read together.
    if (!this.attract() && this.screen === 'aim') y = Math.min((board.shutterY ?? board.h * 0.36) - 40, board.launchY - 70 + half)
    else if (drop?.launched) y = drop.ball.y + clamp(drop.ball.vy * 0.1, -30, 200)
    const max = board.h - half
    if (max <= half) return board.h / 2
    return clamp(y, half, max)
  }

  private launch(): void {
    if (!this.drop || !this.run || this.screen !== 'aim') return
    this.sfx.resume()
    const angle = this.currentAngle()
    this.aimAngle = angle
    this.drop.launch(angle)
    this.launchKick = 1
    const pal = this.drop.ballDef.accent
    const mx = this.drop.board.launchX + Math.sin(angle) * 44
    const my = this.drop.board.launchY + Math.cos(angle) * 44
    this.ring(mx, my, 8, 60, 0.35, pal, 4)
    if (this.save.settings.particles) this.sparks(mx, my, pal, 12, 260, Math.atan2(Math.cos(angle), Math.sin(angle)), 0.7)
    this.trauma = Math.min(1, this.trauma + 0.25)
    this.run.launchedOnce = true
    this.screen = 'drop'
    this.preview = []
    this.pending = { ...EMPTY }
  }

  private startRun(seed: string, ballId: string): void {
    const clean = cleanSeed(seed) || makeSeed()
    const ball = this.save.balls.includes(ballId) ? ballId : 'rubber'
    const route = createRoute(rngFor(clean, 'route'))
    const profile = computeProfile(ball, [], [])
    this.run = {
      seed: clean,
      ballId: ball,
      nodes: route.nodes,
      nodeId: route.start,
      upgrades: [],
      relics: [],
      gears: 0,
      score: 0,
      integrity: profile.integrityMax,
      integrityMax: profile.integrityMax,
      profile,
      drops: 0,
      bestCombo: 0,
      bestMult: profile.startMult,
      shatters: 0,
      portals: 0,
      jackpots: 0,
      flipGold: false,
      cleanDrop: false,
      bossWin: false,
      launchedOnce: false,
      depthTitle: 'The Workshop',
      boardNonce: 0,
      reachedCore: false,
    }
    this.particles = []
    this.floaters = []
    this.enterNode(route.start)
  }

  private enterNode(id: string): void {
    const run = this.run
    if (!run) return
    const node = run.nodes[id]
    if (!node) return this.endRun(false)
    run.nodeId = id
    run.depthTitle = node.title
    if (node.sector >= 1) this.learnLore('workshop')
    if (node.sector >= 2) this.learnLore('foundry')
    if (node.sector >= 3) this.learnLore('gravity')
    if (node.id === 'core') run.reachedCore = true
    if (node.kind === 'drop' || node.kind === 'boss') this.beginAim(node)
    else if (node.kind === 'fork') this.screen = 'fork'
    else if (node.kind === 'shop') {
      this.offers = this.makeShop()
      this.rerolls = 0
      this.rememberOffers()
      this.screen = 'shop'
    } else if (node.kind === 'repair') this.screen = 'repair'
    else if (node.kind === 'bargain') this.screen = 'bargain'
    this.selectedPulse++
  }

  private beginAim(node: GameNode): void {
    const run = this.run
    if (!run) return
    const tutorial = this.save.runs === 0 && node.id === 'workshop'
    const board = createBoard({
      layout: node.layout,
      title: node.title,
      tutorial,
      rng: rngFor(run.seed, `${node.id}:${run.boardNonce}`),
    })
    for (const feature of board.features) {
      if (!this.save.seenParts.includes(feature)) this.save.seenParts.push(feature)
    }
    this.drop = new Drop(board, run.ballId, run.profile, run.integrity, run.integrityMax)
    this.popT = new Float32Array(board.pegs.length)
    this.cash = null
    this.rings = []
    this.floaters = []
    this.warp = 1
    this.zoomTarget = 1
    this.screen = 'aim'
    this.mouseAim = false
    this.keyboardAim = 0
    this.previewKey = Number.NaN
    this.preview = []
    this.snapCam = true
    this.particles = []
  }

  private finishDrop(): void {
    const run = this.run
    const drop = this.drop
    if (!run || !drop || this.screen !== 'drop') return
    const node = run.nodes[run.nodeId]
    run.drops += 1
    run.integrity = Math.max(0, drop.integrity)
    run.shatters += drop.shatters
    run.portals += drop.portals
    if (drop.goldAfterFlip) run.flipGold = true
    if (drop.jackpot) run.jackpots += 1
    if (!drop.dead && drop.hazardThis === 0 && drop.captured && drop.captured !== 'hazard') run.cleanDrop = true
    if (drop.wonBoss) run.bossWin = true
    this.save.lifetime.pegs += drop.pegs
    this.save.lifetime.golds += drop.golds
    drop.hitstop = 0
    const win = drop.wonBoss
    const boss = node.kind === 'boss'
    if (win && drop.jackpot) this.resolveCopy = { title: 'Jackpot', sub: 'The maw pays.' }
    else if (win && drop.captured === 'jackpot') this.resolveCopy = { title: 'The Grinder falls', sub: 'The maw was cold. The core is still broken.' }
    else if (win) this.resolveCopy = { title: 'The Grinder falls', sub: 'You broke the core and missed the maw.' }
    else if (boss) this.resolveCopy = { title: 'The Grinder keeps you', sub: `${drop.coreHits} of 5 hits.` }
    else if (drop.dead) this.resolveCopy = { title: 'The shell opens', sub: 'The fall ends.' }
    else this.resolveCopy = { title: this.resolveCopy.title || 'Settled', sub: [this.resolveCopy.sub, drop.hazardThis === 0 ? 'clean drop' : ''].filter(Boolean).join(' · ') }
    this.screen = 'resolve'
    const lit = drop.litOrder.filter((i) => !drop.gone[i])
    const step = clamp(0.95 / Math.max(1, lit.length), 0.022, 0.07)
    this.cash = { order: lit, next: 0, t: -0.18, step }
    this.resolveT = Math.max(drop.jackpot || win ? 1.6 : 1, lit.length * step + 0.75)
    this.toast = null
  }

  private skipResolve(): void {
    if (this.screen !== 'resolve' || !this.run || !this.drop) return
    this.finishCash()
    const node = this.run.nodes[this.run.nodeId]
    const win = this.drop.wonBoss
    const failed = this.drop.dead || (node.kind === 'boss' && !win)
    if (win || failed || node.kind === 'boss') this.endRun(win)
    else if (node.reward) this.openReward(node.reward)
    else this.advance()
  }

  private openReward(kind: 'upgrade' | 'relic'): void {
    const run = this.run
    if (!run) return
    const ball = ballById(run.ballId)
    this.offers = rollReward(kind, run.ballId, ball.primary, run.upgrades, run.relics, this.save.researched, run.seed, `reward:${run.nodeId}`)
    this.rememberOffers()
    if (!this.offers.length) {
      this.advance()
      return
    }
    this.screen = 'choices'
  }

  private advance(): void {
    const run = this.run
    if (!run) return
    const next = run.nodes[run.nodeId]?.next
    if (!next) this.endRun(false)
    else this.enterNode(next)
  }

  private pick(index: number): void {
    const offer = this.offers[index]
    const run = this.run
    if (!offer || !run || this.screen !== 'choices') return
    this.sfx.ui()
    if (offer.kind === 'upgrade') run.upgrades.push(offer.id)
    else run.relics.push(offer.id)
    this.recompute()
    this.advance()
  }

  private buy(index: number): void {
    const offer = this.offers[index]
    const run = this.run
    if (!offer || !run || this.screen !== 'shop') return
    if (run.gears < offer.price) return
    this.sfx.ui()
    run.gears -= offer.price
    if (offer.kind === 'upgrade') run.upgrades.push(offer.id)
    else run.relics.push(offer.id)
    this.offers.splice(index, 1)
    this.recompute()
    this.selectedPulse++
  }

  private fork(index: number): void {
    const run = this.run
    const option = run?.nodes[run.nodeId]?.options?.[index]
    if (!option) return
    this.sfx.ui()
    this.enterNode(option.next)
  }

  private bargain(which: 'shell' | 'pay' | 'walk'): void {
    const run = this.run
    if (!run || this.screen !== 'bargain') return
    this.sfx.ui()
    if (which === 'shell') {
      if (run.integrity <= 1) return
      run.integrity -= 1
      const relic = randomFrom('relic', run.ballId, run.upgrades, run.relics, this.save.researched, run.seed, 'bargain-relic')
      if (relic) {
        run.relics.push(relic.id)
        this.recompute()
        this.say(relic.name, 'The bargain keeps its word.', 1.4, true)
      } else {
        run.gears += 28
        this.say('Empty hands', 'No new relic. The machine pays scrap.', 1.2, false)
      }
    } else if (which === 'pay') {
      if (run.gears < 30) return
      run.gears -= 30
      const up = randomFrom('upgrade', run.ballId, run.upgrades, run.relics, this.save.researched, run.seed, 'bargain-up')
      if (up) {
        run.upgrades.push(up.id)
        this.recompute()
        this.say(up.name, 'Installed without asking.', 1.3, false)
      } else run.gears += 30
    } else {
      run.gears += 18
    }
    this.advance()
  }

  private repair(): void {
    const run = this.run
    if (!run) return
    if (run.integrity < run.integrityMax) {
      run.integrity += 1
      this.say('Mended', 'One pip returns to the shell.', 1, false)
    } else {
      run.gears += 12
      this.say('Already whole', 'You pocket 12 gears of scrap.', 1, false)
    }
    this.sfx.ui()
    this.advance()
  }

  private recompute(): void {
    const run = this.run
    if (!run) return
    const prev = run.integrityMax
    run.profile = computeProfile(run.ballId, run.upgrades, run.relics)
    const delta = run.profile.integrityMax - prev
    run.integrityMax = run.profile.integrityMax
    run.integrity = clamp(run.integrity + delta, 1, run.integrityMax)
  }

  private endRun(win: boolean): void {
    const run = this.run
    if (!run) return this.toHub()
    if (!run.launchedOnce) return this.toHub()
    if (win) this.learnLore('grinder')
    const gained = shardsFor(run.score, run.drops, win)
    this.save.shards += gained
    this.save.runs += 1
    const beforeBest = this.save.bestScore
    if (run.score > this.save.bestScore) this.save.bestScore = run.score
    this.save.bestCombo = Math.max(this.save.bestCombo, run.bestCombo)
    this.save.bestMult = Math.max(this.save.bestMult, run.bestMult)
    this.save.lifetime.shatters += run.shatters
    this.save.lifetime.jackpots += run.jackpots
    this.save.lifetime.portals += run.portals
    const awakened: string[] = []
    if (!this.save.balls.includes('prism')) {
      this.save.balls.push('prism')
      awakened.push('Prism Core')
    }
    if (!this.save.balls.includes('void') && (run.reachedCore || this.save.runs >= 2)) {
      this.save.balls.push('void')
      awakened.push('Void Marble')
    }
    const challenges = grantChallenges(this.save, {
      bestCombo: run.bestCombo,
      bestMult: run.bestMult,
      cleanDrop: run.cleanDrop,
      bossWin: win,
      shatters: run.shatters,
      portals: run.portals,
      score: run.score,
      flipGold: run.flipGold,
      jackpots: run.jackpots,
      ballId: run.ballId,
    })
    const next = this.nextSchematic()
    this.summary = {
      heading: win ? 'The Grinder falls' : 'Run complete',
      line: win
        ? 'The Helix is quieter for a moment.'
        : run.integrity > 0
          ? 'The sphere left the machine. The shell is still whole.'
          : 'The shell gives out. The machine keeps the rest.',
      score: run.score,
      best: run.score > beforeBest && run.score > 0,
      gears: run.gears,
      mult: formatMult(run.bestMult),
      combo: run.bestCombo,
      depth: run.depthTitle,
      shards: gained,
      awakened,
      challenges,
      temptation: this.temptation(awakened, next),
      canStudy: !!next && this.save.shards >= TUNING.researchCost,
      studyLabel: next ? `Study · ${next.lockHint}` : '',
      seed: run.seed,
      ballId: run.ballId,
    }
    this.screen = 'runend'
    this.save.ball = run.ballId
    writeSave(this.save)
  }

  private temptation(awakened: string[], next: { lockHint: string } | null): string {
    if (awakened.length) return 'A new sphere is waiting in the hub.'
    if (next && this.save.shards >= TUNING.researchCost) return `A schematic is ready — ${next.lockHint}.`
    if (next) return `${this.save.shards}/${TUNING.researchCost} shards toward ${next.lockHint}.`
    const trail = TRAILS.find((t) => !this.save.trails.includes(t.id))
    if (trail && this.save.shards >= TUNING.trailCost) return `The archive can cast a ${trail.name.toLowerCase()}.`
    return 'The next seed will not rebuild this machine.'
  }

  private nextSchematic(): { id: string; lockHint: string; name: string; text: string; tags: string[] } | null {
    const id = RESEARCH_ORDER.find((relic) => !this.save.researched.includes(relic))
    if (!id) return null
    const relic = RELICS[id]
    return relic ? { id, lockHint: relic.lockHint, name: relic.name, text: relic.text, tags: relic.tags } : null
  }

  private study(): void {
    const next = this.nextSchematic()
    if (next && this.save.shards >= TUNING.researchCost) {
      this.save.shards -= TUNING.researchCost
      this.save.researched.push(next.id)
      this.reveal = { name: next.name, text: next.text, tags: next.tags.join(' · ') }
      this.returnTo = this.screen
      this.screen = 'reveal'
      writeSave(this.save)
      this.sfx.gold(4)
      return
    }
    const trail = TRAILS.find((t) => !this.save.trails.includes(t.id))
    if (!next && trail && this.save.shards >= TUNING.trailCost) {
      this.save.shards -= TUNING.trailCost
      this.save.trails.push(trail.id)
      this.save.trail = trail.id
      this.reveal = { name: trail.name, text: 'A cosmetic wake. The sphere falls the same. It only looks like you meant it.', tags: 'cosmetic' }
      this.returnTo = this.screen
      this.screen = 'reveal'
      writeSave(this.save)
    }
  }

  private toHub(): void {
    this.screen = 'hub'
    this.run = null
    this.drop = null
    this.popT = null
    this.cash = null
    this.rings = []
    this.particles = []
    this.floaters = []
    this.warp = 1
    this.returnTo = 'hub'
    this.spawnDemo()
    this.snapCam = true
  }

  private learnLore(id: string): void {
    if (!this.save.lore.includes(id) && LORE[id]) this.save.lore.push(id)
  }

  private makeShop(): Offer[] {
    const run = this.run
    if (!run) return []
    const ball = ballById(run.ballId)
    return rollShop(run.ballId, ball.primary, run.upgrades, run.relics, this.save.researched, run.seed, `shop:${run.nodeId}:${this.rerolls}`)
  }

  private rememberOffers(): void {
    for (const offer of this.offers) {
      if (offer.kind === 'relic' && !this.save.seenRelics.includes(offer.id)) this.save.seenRelics.push(offer.id)
    }
  }

  private drain(silent: boolean): void {
    const drop = this.drop
    const run = this.run
    if (!drop || !run) return
    for (const e of drop.pullEvents()) {
      if (e.gears) {
        run.gears += e.gears
        run.score += e.gears
      }
      if (e.combo) run.bestCombo = Math.max(run.bestCombo, e.combo)
      if (e.mult) run.bestMult = Math.max(run.bestMult, this.drop?.mult ?? e.mult)
      if (e.type === 'pocket' || e.type === 'jackpot') {
        this.resolveCopy = { title: e.text || 'Settled', sub: e.gears ? `+${e.gears} gears` : '' }
      }
      if (!silent) this.react(e)
    }
    run.integrity = drop.integrity
  }

  private react(e: { type: string; x: number; y: number; text?: string; gears?: number; big?: boolean; combo?: number; mult?: number }): void {
    const big = !!e.big
    const pal = e.type === 'hazard' || e.type === 'shatter-ball' ? '#ff6b5a' : e.type === 'gold' || e.type === 'jackpot' || e.type === 'crit' ? '#ffd56a' : '#f4efe4'
    const accent = this.drop?.ballDef.accent ?? '#7ee0c6'
    const fx = this.save.settings.particles
    const jitter = (Math.random() - 0.5) * 14
    if (e.text && (e.gears || big || e.type === 'refund' || e.type === 'special')) {
      const size = e.type === 'jackpot' ? 40 : big ? 28 : e.type === 'gold' ? 22 : e.gears && e.gears >= 20 ? 21 : 17
      this.floaters.push({ x: e.x + jitter, y: e.y - 18, text: e.text, life: 0.9, max: 0.9, color: pal, size })
    }
    if (e.type === 'mult' && e.mult) {
      this.floaters.push({ x: e.x, y: e.y - 34, text: formatMult(e.mult), life: 0.7, max: 0.7, color: '#ffd56a', size: 15 })
    }
    if (e.type === 'combo' && e.combo && COMBO_CALLS[e.combo]) {
      this.floaters.push({ x: e.x, y: e.y - 56, text: COMBO_CALLS[e.combo], life: 1.1, max: 1.1, color: '#7ee0c6', size: 26 + Math.min(14, e.combo) })
      this.ring(e.x, e.y, 16, 120, 0.5, accent, 5)
      this.sfx.combo(e.combo)
    }
    if (fx) {
      if (e.type === 'peg' || e.type === 'spring') {
        this.ring(e.x, e.y, 10, 30, 0.28, accent, 3)
        this.sparks(e.x, e.y, pal, 5, 170)
      } else if (e.type === 'gold') {
        this.ring(e.x, e.y, 10, 46, 0.38, '#ffd56a', 4)
        this.sparks(e.x, e.y, '#ffd56a', 12, 240)
      } else if (e.type === 'bumper' || e.type === 'echo' || e.type === 'seal') {
        this.ring(e.x, e.y, 28, 96, 0.4, '#e0b07a', 6)
        this.sparks(e.x, e.y, '#ffe2b8', 14, 300)
      } else if (e.type === 'shatter') {
        this.sparks(e.x, e.y, '#ffffff', 18, 320)
        this.burst(e.x, e.y, '#f4efe4', 10, 120)
      } else if (e.type === 'hazard' || e.type === 'shatter-ball') {
        this.ring(e.x, e.y, 14, 110, 0.5, '#ff6b5a', 6)
        this.sparks(e.x, e.y, '#ff6b5a', 20, 320)
      } else if (e.type === 'jackpot') {
        this.ring(e.x, e.y, 20, 420, 0.9, '#ffd56a', 10)
        this.ring(e.x, e.y, 10, 240, 0.7, '#ffffff', 5)
        this.sparks(e.x, e.y, '#ffd56a', 48, 620, -Math.PI / 2, 1.1)
        this.burst(e.x, e.y, '#fff6d0', 24, 260)
      } else if (e.type === 'pocket') {
        const color = e.gears ? '#ffd56a' : '#ff6b5a'
        this.ring(e.x, e.y, 14, big ? 200 : 120, 0.55, color, 5)
        this.sparks(e.x, e.y, color, big ? 26 : 14, big ? 460 : 300, -Math.PI / 2, 1)
      } else if (e.type === 'core') {
        this.ring(e.x, e.y, 36, 160, 0.5, '#e6f27a', 7)
        this.sparks(e.x, e.y, '#e6f27a', 20, 380)
      } else if (e.type === 'portal' || e.type === 'crit' || e.type === 'maw') {
        this.ring(e.x, e.y, 10, 90, 0.45, e.type === 'crit' ? '#ffd56a' : accent, 5)
        this.sparks(e.x, e.y, e.type === 'crit' ? '#ffd56a' : accent, 14, 280)
      } else if (e.type === 'nudge') {
        this.sparks(e.x, e.y, accent, 6, 160, e.text === '◀' ? 0 : Math.PI, 0.5)
      } else if (e.type === 'collapse') {
        this.burst(e.x, e.y, '#d5dee3', 10, 120)
      }
    }
    if (big) this.trauma = Math.min(1, this.trauma + 0.55)
    else if (e.type === 'bumper') this.trauma = Math.min(1, this.trauma + 0.2)
    else if (e.type === 'gold') this.trauma = Math.min(1, this.trauma + 0.12)
    else if (e.type === 'peg') this.trauma = Math.min(1, this.trauma + 0.06)
    if (big && this.drop) this.drop.hitstop = Math.max(this.drop.hitstop, e.type === 'jackpot' ? 0.09 : 0.04)
    else if (e.type === 'gold' && this.drop) this.drop.hitstop = Math.max(this.drop.hitstop, 0.018)
    if (e.type === 'jackpot') {
      this.zoom = 1.12
      this.flashAt('gold', 0.45)
      this.say('Jackpot', e.gears ? `+${e.gears}` : '', 1.6, true)
      this.sfx.jackpot()
    } else if (e.type === 'hazard') {
      this.flashAt('hurt', 0.25)
      this.sfx.hazard()
    } else if (e.type === 'shatter-ball') {
      this.flashAt('hurt', 0.4)
      this.say('Shell broken', '', 1.2, true)
      this.sfx.shatter()
    } else if (e.type === 'core') {
      this.flashAt('core', 0.2)
      this.sfx.core()
      this.say(`Core ${e.text ?? ''}`, '', 0.7, true)
    } else if (e.type === 'maw') {
      this.say('The maw opens', 'Steer it home.', 1.3, true)
      this.zoom = 1.08
    } else if (e.type === 'feather') {
      this.say('The clock skips', '', 1, true)
    } else if (e.type === 'launch') this.sfx.launch()
    else if (e.type === 'flip') this.sfx.flip()
    else if (e.type === 'nudge') this.sfx.nudge()
    else if (e.type === 'gold') this.sfx.gold(e.combo ?? 1)
    else if (e.type === 'peg' || e.type === 'spring') this.sfx.peg(e.combo ?? 1)
    else if (e.type === 'bumper' || e.type === 'echo' || e.type === 'seal') this.sfx.bumper()
    else if (e.type === 'shatter') this.sfx.shatter()
    else if (e.type === 'pocket') this.sfx.pocket(!!e.gears)
    else if (e.type === 'portal' || e.type === 'crit') this.sfx.gold(6)
  }

  private burst(x: number, y: number, color: string, n: number, speed: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const s = speed * (0.3 + Math.random())
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.35 + Math.random() * 0.35,
        max: 0.7,
        color,
        size: 1.5 + Math.random() * 2.2,
      })
    }
  }

  /** Streaking sparks, optionally aimed in a cone around `dir`. */
  private sparks(x: number, y: number, color: string, n: number, speed: number, dir = 0, spread = Math.PI): void {
    for (let i = 0; i < n; i++) {
      const a = dir + (Math.random() * 2 - 1) * spread
      const s = speed * (0.45 + Math.random() * 0.8)
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.25 + Math.random() * 0.3,
        max: 0.55,
        color,
        size: 1.6 + Math.random() * 1.8,
        streak: true,
      })
    }
  }

  private ring(x: number, y: number, r0: number, r1: number, life: number, color: string, width: number): void {
    this.rings.push({ x, y, r0, r1, life, max: life, color, width })
  }

  /** Slow the fall when the sphere is about to land somewhere that matters. */
  private updateWarp(dt: number): void {
    let target = 1
    const d = this.drop
    if (this.screen === 'drop' && d && d.launched && !d.captured && !d.dead && d.ball.vy > 0) {
      const b = d.board
      if (d.ball.y > b.floorY - 190 && d.ball.y < b.floorY + 60) {
        const kind = binKindAt(b, d.ball.x + d.ball.vx * 0.12)
        const hot = (kind === 'jackpot' && (b.boss ? d.coreOpen : d.mult >= TUNING.jackpotAt)) || (kind === 'bonus' && d.mult >= 2)
        if (hot) target = 0.32
      }
    }
    this.warp += (target - this.warp) * (1 - Math.exp(-(target < this.warp ? 10 : 5) * dt))
    this.zoomTarget = target < 1 ? 1.1 : 1
  }

  /** Peggle-style settle: pegs struck this drop pop one after another. */
  private cashIn(dt: number): void {
    const cash = this.cash
    const drop = this.drop
    const popT = this.popT
    if (popT) for (let i = 0; i < popT.length; i++) if (popT[i] > 0) popT[i] += dt
    if (!cash || !drop || !popT) return
    cash.t += dt
    const pal = drop.ballDef.accent
    while (cash.next < cash.order.length && cash.t >= cash.next * cash.step) {
      const i = cash.order[cash.next++]
      const peg = drop.board.pegs[i]
      popT[i] = 0.0001
      const pose = pegPose(peg, drop.time, drop.board.boss && drop.coreHits >= 2 ? 2.1 : 1)
      const gold = peg.kind === 'gold' || drop.gilded[i]
      if (this.save.settings.particles) {
        this.sparks(pose.x, pose.y, gold ? '#ffd56a' : pal, gold ? 8 : 5, 200)
        this.ring(pose.x, pose.y, 6, gold ? 40 : 28, 0.3, gold ? '#ffd56a' : pal, 3)
      }
      this.sfx.pop(cash.next, gold)
    }
    if (cash.next >= cash.order.length) this.cash = null
  }

  private finishCash(): void {
    if (!this.cash || !this.popT) return
    for (let k = this.cash.next; k < this.cash.order.length; k++) this.popT[this.cash.order[k]] = 1
    this.cash = null
  }

  private say(title: string, sub: string, time: number, big: boolean): void {
    if (!big && this.toastBig && this.toastT > 0.45) return
    this.toast = { title, sub }
    this.toastT = time
    this.toastBig = big
  }

  private flashAt(kind: ViewModel['flash'], time: number): void {
    if (!this.save.settings.flash) return
    this.flash = kind
    this.flashT = time
  }

  private buildLine(): string {
    const run = this.run
    if (!run) return ''
    const bits = [ballById(run.ballId).name]
    for (const id of run.relics) if (RELICS[id]) bits.push(RELICS[id].name)
    for (const id of run.upgrades) if (UPGRADES[id]) bits.push(UPGRADES[id].name)
    if (run.profile.synergies[0]) bits.push(run.profile.synergies[0].name)
    return bits.join('   ·   ')
  }

  private choiceCards(shop: boolean): ChoiceCard[] {
    const gears = this.run?.gears ?? 0
    return this.offers.map((offer, index) => ({
      name: offer.name,
      tags: offer.tags.join(' · '),
      text: offer.text,
      synergy: offer.synergy ?? '',
      price: shop ? offer.price : 0,
      afford: shop ? gears >= offer.price : true,
      index,
    }))
  }

  private coach(): string {
    const run = this.run
    const drop = this.drop
    const node = run ? run.nodes[run.nodeId] : null
    if (!run || !drop || !node) return ''
    if (this.save.runs === 0 && node.id === 'workshop') {
      if (this.screen === 'aim') return 'Point, then click. You are choosing a beginning, not a destiny.'
      if (this.screen === 'drop' && drop.nudges === drop.maxNudges) return 'A and D nudge. Spend them when the gate is close.'
      if (this.screen === 'drop' && drop.flips > 0 && node.layout) return `F flips the gate. Gold is on the ${drop.board.goldSide}.`
    }
    return node.blurb
  }

  private view(): ViewModel {
    return {
      sig: this.signature(),
      screen: this.attract() ? 'hub' : this.screen,
      hud: this.hud(),
      stage: this.stage(),
      toast: this.toast,
      flash: this.flash,
    }
  }

  private signature(): string {
    const run = this.run
    const base = [
      this.screen,
      this.hubTick,
      this.selectedPulse,
      this.save.ball,
      this.save.shards,
      this.save.settings.shake,
      this.save.settings.particles,
      this.save.settings.flash,
      this.save.settings.large,
      run?.nodeId ?? '',
      run?.gears ?? 0,
      this.offers.map((o) => o.id).join(','),
      this.summary?.score ?? '',
      this.reveal?.name ?? '',
      this.resolveCopy.title,
    ]
    return base.join('|')
  }

  private hud(): HudModel | null {
    if (this.menu() || !this.run || !this.drop) return null
    if (['fork', 'shop', 'choices', 'repair', 'bargain', 'pause', 'runend', 'reveal', 'resolve'].includes(this.screen) && this.screen !== 'aim' && this.screen !== 'drop') {
      // Keep the resource chips during decisions by still returning hud.
    }
    const drop = this.drop
    const live = this.screen === 'aim' || this.screen === 'drop'
    const start = this.run.profile.startMult
    const gate = drop.board.shutterY != null ? `Gate ${drop.gapT < 0.5 ? 'left' : 'right'} · gold ${drop.board.goldSide}` : ''
    return {
      gears: this.run.gears,
      score: this.run.score,
      shell: live ? drop.integrity : this.run.integrity,
      shellMax: this.run.integrityMax,
      mult: formatMult(drop.mult),
      multT: clamp((drop.mult - start) / Math.max(0.1, TUNING.jackpotAt - start), 0, 1),
      multHot: drop.mult >= TUNING.jackpotAt,
      jackpotAt: formatMult(TUNING.jackpotAt),
      combo: this.screen === 'drop' ? drop.combo : 0,
      comboT: this.screen === 'drop' && drop.combo > 0 ? clamp(drop.comboTimer / this.run.profile.comboWindow, 0, 1) : 0,
      earned: drop.earned,
      tally: this.screen === 'drop' && drop.earned > 0,
      nudges: drop.nudges,
      maxNudges: drop.maxNudges,
      specials: drop.specials,
      maxSpecials: this.run.profile.special === 'tilt' ? 0 : this.run.profile.specialCharges,
      specialName: ballById(this.run.ballId).specialName,
      tilts: drop.tilts,
      maxTilts: this.run.profile.tiltCharges,
      flips: drop.flips,
      showFlip: drop.board.shutterY != null,
      seed: this.run.seed,
      kicker: this.run.nodes[this.run.nodeId]?.kicker ?? '',
      title: this.run.depthTitle,
      blurb: this.coach(),
      gate: this.screen === 'pause' || this.screen === 'runend' ? '' : gate,
      synergy: this.run.profile.synergies[0]?.name ?? '',
      core: drop.board.boss ? `Core ${drop.coreHits}/5` : '',
      jackpot: drop.board.jackpot && !drop.board.boss ? 'Center jackpots at ×3' : '',
      muted: this.sfx.isMuted,
      aiming: this.screen === 'aim',
      playing: this.screen === 'aim' || this.screen === 'drop',
    }
  }

  private stage(): StageModel {
    const run = this.run
    switch (this.screen) {
      case 'hub':
        return {
          kind: 'hub',
          balls: BALL_LIST.map((ball) => ({
            id: ball.id,
            name: ball.name,
            tagline: ball.tagline,
            tags: ball.tags.join(' · '),
            colors: [ball.accent, ball.color, ball.core],
            locked: !this.save.balls.includes(ball.id),
            reason: ball.id === 'prism' ? 'Awakens after your first fall.' : 'Reach the Gravity Core, or finish two falls.',
            selected: this.save.ball === ball.id,
          })),
          shards: this.save.shards,
          best: this.save.bestScore,
          runs: this.save.runs,
          seed: this.draftSeed,
          study: this.studyLabel(),
          canStudy: this.canStudy(),
          tick: this.hubTick,
        }
      case 'help':
        return { kind: 'help' }
      case 'collection':
        return this.collectionStage()
      case 'settings':
        return {
          kind: 'settings',
          shake: this.save.settings.shake,
          particles: this.save.settings.particles,
          flash: this.save.settings.flash,
          large: this.save.settings.large,
          volume: this.save.settings.volume,
        }
      case 'choices':
        return {
          kind: 'choices',
          kicker: run?.nodes[run.nodeId]?.reward === 'relic' ? 'A relic' : 'An upgrade',
          title: run?.nodes[run.nodeId]?.reward === 'relic' ? 'Keep one passenger' : 'Change the sphere',
          build: this.buildLine(),
          cards: this.choiceCards(false),
          skip: 'Skip',
        }
      case 'shop':
        return {
          kind: 'shop',
          gears: run?.gears ?? 0,
          cards: this.choiceCards(true),
          reroll: TUNING.shopReroll,
          canReroll: !!run && run.gears >= TUNING.shopReroll && this.rerolls < 2,
          build: this.buildLine(),
        }
      case 'fork':
        return {
          kind: 'fork',
          title: run?.nodes[run.nodeId]?.title ?? 'Choose',
          options: (run?.nodes[run.nodeId]?.options ?? []).map((o, index) => ({ ...o, index })),
        }
      case 'repair':
        return {
          kind: 'repair',
          text:
            run && run.integrity < run.integrityMax
              ? 'One crack can be closed. The risky room will still be there next time.'
              : 'The shell is whole. The bench offers 12 gears of scrap instead.',
          action: run && run.integrity < run.integrityMax ? 'Restore one pip' : 'Take the scrap',
        }
      case 'bargain':
        return { kind: 'bargain', canShell: !!run && run.integrity > 1, canPay: !!run && run.gears >= 30 }
      case 'resolve': {
        const d = this.drop
        const tone = !d ? 'good' : d.dead || d.captured === 'hazard' ? 'bad' : d.jackpot || d.wonBoss ? 'gold' : 'good'
        return { kind: 'resolve', title: this.resolveCopy.title, sub: this.resolveCopy.sub, earned: d?.earned ?? 0, tone }
      }
      case 'pause':
        return { kind: 'pause' }
      case 'runend':
        return this.summary ? { kind: 'runend', summary: this.summary } : { kind: 'none' }
      case 'reveal':
        return this.reveal ? { kind: 'reveal', ...this.reveal } : { kind: 'none' }
      default:
        return { kind: 'none' }
    }
  }

  private collectionStage(): StageModel {
    const knownRelics = new Set([...STARTER_RELICS, ...this.save.researched])
    return {
      kind: 'collection',
      balls: BALL_LIST.map((ball) => ({
        name: ball.name,
        text: this.save.balls.includes(ball.id)
          ? `${ball.tagline} ${ball.specialText}`
          : ball.id === 'prism'
            ? 'Awakens after your first fall.'
            : 'Reach the Gravity Core, or finish two falls.',
        known: true,
      })),
      relics: Object.values(RELICS).map((relic) => {
        const researched = knownRelics.has(relic.id)
        const seen = this.save.seenRelics.includes(relic.id)
        if (!researched) return { name: relic.name, text: relic.lockHint || 'Locked schematic.', known: false }
        if (!seen) return { name: relic.name, text: 'In the machine. Not yet offered.', known: false }
        return { name: relic.name, text: relic.text, known: true }
      }),
      parts: PARTS.map((part) => ({
        name: part.name,
        text: this.save.seenParts.includes(part.id) ? part.about : 'Still inside the machine.',
        known: this.save.seenParts.includes(part.id),
      })),
      challenges: CHALLENGES.map((c) => ({
        name: this.save.challenges.includes(c.id) ? `${c.name} · done` : c.name,
        text: c.text,
        known: true,
      })),
      lore: this.save.lore.map((id) => LORE[id]).filter(Boolean),
      pegs: this.save.lifetime.pegs,
    }
  }

  private studyLabel(): string {
    const next = this.nextSchematic()
    if (next) return this.save.shards >= TUNING.researchCost ? `Study · ${next.lockHint}` : `${this.save.shards}/${TUNING.researchCost} · ${next.lockHint}`
    const trail = TRAILS.find((t) => !this.save.trails.includes(t.id))
    if (trail) return this.save.shards >= TUNING.trailCost ? `Cast ${trail.name}` : `${this.save.shards}/${TUNING.trailCost} · ${trail.name}`
    return 'Archive complete'
  }

  private canStudy(): boolean {
    const next = this.nextSchematic()
    if (next) return this.save.shards >= TUNING.researchCost
    return !!TRAILS.find((t) => !this.save.trails.includes(t.id)) && this.save.shards >= TUNING.trailCost
  }

  private onAction(act: string): void {
    if (act === 'start') {
      this.sfx.resume()
      this.sfx.ui()
      this.startRun(this.draftSeed, this.save.ball)
      return
    }
    if (act === 'random-seed') {
      this.draftSeed = makeSeed()
      this.hubTick++
      return
    }
    if (act.startsWith('ball:')) {
      const id = act.slice(5)
      if (!this.save.balls.includes(id)) return
      this.save.ball = id
      writeSave(this.save)
      this.sfx.ui()
      this.selectedPulse++
      return
    }
    if (act === 'help') {
      this.returnTo = 'hub'
      this.screen = 'help'
      return
    }
    if (act === 'collection') {
      this.returnTo = this.screen === 'runend' ? 'runend' : 'hub'
      this.screen = 'collection'
      return
    }
    if (act === 'settings') {
      this.returnTo = this.screen === 'pause' ? 'pause' : 'hub'
      this.screen = 'settings'
      return
    }
    if (act === 'back') {
      this.screen = this.returnTo === 'pause' ? 'pause' : this.returnTo === 'runend' ? 'runend' : 'hub'
      return
    }
    if (act === 'pause-btn' && (this.screen === 'aim' || this.screen === 'drop')) {
      this.returnTo = this.screen
      this.screen = 'pause'
      return
    }
    if (act === 'resume') {
      this.screen = this.returnTo === 'drop' ? 'drop' : 'aim'
      return
    }
    if (act === 'abandon') {
      if (this.run && !this.run.launchedOnce) this.toHub()
      else this.endRun(false)
      return
    }
    if (act === 'skip') return this.skipResolve()
    if (act === 'repair') return this.repair()
    if (act === 'leave') return this.advance()
    if (act === 'reroll') {
      if (!this.run || this.run.gears < TUNING.shopReroll || this.rerolls >= 2) return
      this.run.gears -= TUNING.shopReroll
      this.rerolls += 1
      this.offers = this.makeShop()
      this.rememberOffers()
      this.sfx.ui()
      this.selectedPulse++
      return
    }
    if (act === 'again' && this.summary) return this.startRun('', this.summary.ballId)
    if (act === 'retry' && this.summary) return this.startRun(this.summary.seed, this.summary.ballId)
    if (act === 'hub') return this.toHub()
    if (act === 'study') return this.study()
    if (act === 'close-reveal') {
      this.reveal = null
      this.screen = this.returnTo === 'runend' && this.summary ? 'runend' : 'hub'
      if (this.summary && this.screen === 'runend') {
        const next = this.nextSchematic()
        this.summary.temptation = this.temptation([], next)
        this.summary.canStudy = this.canStudy()
        this.summary.studyLabel = next ? `Study · ${next.lockHint}` : this.studyLabel()
      }
      this.selectedPulse++
      return
    }
    if (act === 'copy-seed') {
      const seed = this.run?.seed || this.summary?.seed || this.draftSeed
      if (!seed) return
      void navigator.clipboard?.writeText(seed).then(
        () => this.say('Seed copied', seed, 0.8, false),
        () => this.say(seed, 'Copy it from here.', 1.2, false),
      )
      return
    }
    if (act === 'mute') {
      this.sfx.toggle()
      return
    }
    if (act.startsWith('volume:')) {
      const v = Number(act.slice(7))
      if (Number.isFinite(v)) {
        this.save.settings.volume = clamp(v, 0, 1)
        this.sfx.volume = this.save.settings.volume
        writeSave(this.save)
      }
      return
    }
    if (act.startsWith('toggle:')) {
      const key = act.slice(7) as 'shake' | 'particles' | 'flash' | 'large'
      if (key === 'shake' || key === 'particles' || key === 'flash' || key === 'large') {
        this.save.settings[key] = !this.save.settings[key]
        document.documentElement.classList.toggle('lg', this.save.settings.large)
        writeSave(this.save)
        this.selectedPulse++
      }
      return
    }
    if (act.startsWith('pick:')) return this.pick(Number(act.slice(5)))
    if (act.startsWith('buy:')) return this.buy(Number(act.slice(4)))
    if (act.startsWith('fork:')) return this.fork(Number(act.slice(5)))
    if (act === 'bargain:shell') return this.bargain('shell')
    if (act === 'bargain:pay') return this.bargain('pay')
    if (act === 'bargain:walk') return this.bargain('walk')
    if (act === 'nudge-left') this.pending.nudge = -1
    if (act === 'nudge-right') this.pending.nudge = 1
    if (act === 'flip') this.pending.flip = true
    if (act === 'special') this.pending.special = true
    if (act === 'tilt') this.pending.tilt = true
    if (act === 'skip-node' && this.dev) this.advance()
  }

  private debug(): void {
    if (!this.dev) {
      this.debugEl.hidden = true
      return
    }
    this.debugEl.hidden = !this.debugOpen
    if (!this.debugOpen) return
    const drop = this.drop
    const lines = [
      `fps ${this.fps.toFixed(0)}`,
      `screen ${this.screen}`,
      `seed ${this.run?.seed ?? this.draftSeed}`,
      `node ${this.run?.nodeId ?? '-'}`,
      drop ? `v ${drop.ball.vx.toFixed(0)} ${drop.ball.vy.toFixed(0)}` : 'no ball',
      drop ? `mult ${drop.mult.toFixed(2)} combo ${drop.combo}` : '',
      drop ? `gap ${drop.gapT.toFixed(2)} core ${drop.coreHits}` : '',
      `build ${this.buildLine()}`,
      `pegs ${drop?.board.pegs.length ?? 0}`,
    ]
    let pre = this.debugEl.querySelector('pre')
    if (!pre) {
      this.debugEl.innerHTML = `<pre></pre><div class="debug-row">
        <button data-debug="gears">+gears</button>
        <button data-debug="heal">heal</button>
        <button data-debug="boss">boss</button>
        <button data-debug="relics">unlock</button>
        <button data-debug="hit">hitboxes</button>
        <button data-debug="end">end drop</button>
      </div>`
      pre = this.debugEl.querySelector('pre')
      this.debugEl.onclick = (e) => {
        const id = (e.target as HTMLElement).dataset.debug
        if (!id || !this.run) return
        if (id === 'gears') this.run.gears += 80
        if (id === 'heal') this.run.integrity = this.run.integrityMax
        if (id === 'boss') this.enterNode('grinder')
        if (id === 'relics') {
          this.save.balls = ['rubber', 'prism', 'void']
          this.save.researched = [...RESEARCH_ORDER]
          writeSave(this.save)
        }
        if (id === 'hit') this.hitboxes = !this.hitboxes
        if (id === 'end' && this.drop && this.screen === 'drop') {
          this.drop.ball.y = this.drop.board.floorY + 80
          this.drop.ball.vy = 10
        }
        this.selectedPulse++
      }
    }
    if (pre) pre.textContent = lines.filter(Boolean).join('\n')
  }
}
