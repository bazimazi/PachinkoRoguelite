import { PALETTE, type Palette } from './palette'
import type { Cam } from './camera'
import { gapCenter, pegPose, shutterWalls, type Bin, type Board, type Bumper } from '../sim/board'
import type { Drop } from '../sim/drop'
import { drawAstrolabe, drawAtmosphere, drawEngraving } from './atmosphere'
import type { BallDef } from '../content/catalog'
import { drawReactor } from './machinery'

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  color: string
  size: number
  /** Streaks draw as a short line along velocity instead of a dot. */
  streak?: boolean
}

export interface Floater {
  x: number
  y: number
  text: string
  life: number
  max: number
  color: string
  size?: number
  /** High-value feedback may replace nearby ordinary income labels. */
  priority?: boolean
}

/** An expanding shockwave circle. */
export interface Ring {
  x: number
  y: number
  r0: number
  r1: number
  life: number
  max: number
  color: string
  width: number
}

export interface DrawInput {
  ctx: CanvasRenderingContext2D
  cssW: number
  cssH: number
  dpr: number
  cam: Cam
  board: Board | null
  drop: Drop | null
  preview: { x: number; y: number }[]
  aiming: boolean
  aimAngle: number
  particles: Particle[]
  floaters: Floater[]
  rings: Ring[]
  /** Seconds since each peg popped during the settle, 0 while still standing. */
  popT: Float32Array | null
  launchKick: number
  /** Time warp: 1 is real time, lower means the fall is slowed for drama. */
  warp: number
  multHot: boolean
  particlesOn: boolean
  trailColor: string
  time: number
  hitboxes: boolean
  showcase: BallDef | null
}

const POP_LIFE = 0.28
const sprites = new Map<string, HTMLCanvasElement>()

type PegLook = 'normal' | 'gold' | 'reinforced'

function pegSprite(pal: Palette, kind: PegLook, lit: boolean): HTMLCanvasElement {
  const key = `${pal.peg}:${pal.accent}:${kind}:${lit ? 1 : 0}`
  const hit = sprites.get(key)
  if (hit) return hit
  const s = 64
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const g = c.getContext('2d')!
  const cx = 32
  const cy = 32
  const r = 18
  g.beginPath()
  g.arc(cx + 1, cy + 4, r, 0, Math.PI * 2)
  g.fillStyle = 'rgba(0,0,0,0.35)'
  g.fill()
  const body = g.createRadialGradient(cx - 5, cy - 6, 2, cx, cy, r)
  if (kind === 'gold') {
    body.addColorStop(0, lit ? '#ffffff' : '#fff6d0')
    body.addColorStop(0.45, lit ? '#ffe89a' : pal.gold)
    body.addColorStop(1, lit ? '#d08a18' : '#a36b12')
  } else if (kind === 'reinforced') {
    body.addColorStop(0, '#ffffff')
    body.addColorStop(0.4, lit ? pal.accent : pal.steel)
    body.addColorStop(1, '#5c6770')
  } else if (lit) {
    body.addColorStop(0, '#ffffff')
    body.addColorStop(0.35, mix(pal.accent, '#ffffff', 0.35))
    body.addColorStop(1, mix(pal.accent, '#000000', 0.45))
  } else {
    body.addColorStop(0, '#ffffff')
    body.addColorStop(0.42, pal.peg)
    body.addColorStop(1, pal.pegDeep)
  }
  g.beginPath()
  if (kind === 'reinforced') {
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + Math.PI / 6
      const x = cx + Math.cos(a) * (r + 1), y = cy + Math.sin(a) * (r + 1)
      if (!i) g.moveTo(x, y); else g.lineTo(x, y)
    }
    g.closePath()
  } else g.arc(cx, cy, r, 0, Math.PI * 2)
  g.fillStyle = body
  g.fill()
  g.beginPath()
  g.arc(cx, cy, r - 1.5, 0, Math.PI * 2)
  g.strokeStyle = lit ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)'
  g.lineWidth = 1.5
  g.stroke()
  if (kind === 'gold') {
    g.strokeStyle = '#6a3e08'
    g.lineWidth = 1.6
    g.beginPath()
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i
      const x = cx + Math.cos(a) * 9, y = cy + Math.sin(a) * 9
      if (!i) g.moveTo(x, y); else g.lineTo(x, y)
    }
    g.closePath(); g.fillStyle = lit ? '#fff6d8' : '#805716'; g.fill()
    g.stroke()
    g.beginPath(); g.arc(cx, cy, 12.5, 0, Math.PI * 2)
    g.strokeStyle = '#fff0b380'; g.lineWidth = 1; g.stroke()
  } else if (kind === 'reinforced') {
    g.strokeStyle = 'rgba(40,48,56,0.7)'
    g.lineWidth = 2
    g.beginPath()
    g.roundRect(cx - 7, cy - 7, 14, 14, 3)
    g.stroke()
    for (const x of [-1, 1]) for (const y of [-1, 1]) {
      g.beginPath(); g.arc(cx + x * 11, cy + y * 11, 1.2, 0, Math.PI * 2)
      g.fillStyle = '#263542'; g.fill()
    }
  }
  g.fillStyle = 'rgba(255,255,255,0.6)'
  g.beginPath()
  g.ellipse(cx - 5, cy - 7, 5, 3, -0.6, 0, Math.PI * 2)
  g.fill()
  sprites.set(key, c)
  return c
}

function glowSprite(color: string): HTMLCanvasElement {
  const key = `glow:${color}`
  const hit = sprites.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, hexAlpha(color, 0.85))
  grad.addColorStop(0.28, hexAlpha(color, 0.38))
  grad.addColorStop(1, hexAlpha(color, 0))
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  sprites.set(key, c)
  return c
}

/** Draws an additive halo. Caller sets globalCompositeOperation. */
function glow(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, r: number, alpha: number) {
  if (alpha <= 0.01) return
  ctx.globalAlpha = Math.min(1, alpha)
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

export function drawFrame(input: DrawInput): void {
  const { ctx, cssW, cssH, dpr, cam, board } = input
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  const pal = PALETTE[board?.theme ?? 'workshop']
  drawAtmosphere(ctx, cssW, cssH, pal, input.time, input.particlesOn)
  if (input.showcase) {
    drawAstrolabe(ctx, cssW, cssH, input.showcase, input.time)
  } else if (board && input.drop) {
    ctx.save()
    ctx.translate(cssW / 2 + cam.shakeX, cssH / 2 + cam.shakeY)
    ctx.scale(cam.scale * cam.zoom, cam.scale * cam.zoom)
    ctx.translate(-cam.boardW / 2, -cam.camY)
    drawBoard(ctx, board, input.drop, pal, input)
    ctx.restore()
  }
  drawVignette(ctx, cssW, cssH, input.warp)
}

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number, warp: number) {
  const slow = Math.max(0, Math.min(1, (1 - warp) / 0.6))
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * (0.42 - slow * 0.12), w / 2, h / 2, Math.max(w, h) * 0.75)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, `rgba(0,0,0,${0.5 + slow * 0.3})`)
  ctx.fillStyle = v
  ctx.fillRect(0, 0, w, h)
}

function drawCabinet(ctx: CanvasRenderingContext2D, board: Board, drop: Drop, pal: Palette, time: number) {
  const x = 36
  const y = 18
  const w = board.w - 72
  const h = board.h - 28
  // A layered metal chassis gives every board a recognizable physical silhouette.
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.translate(side < 0 ? x : x + w, 0)
    ctx.scale(side, 1)
    const metal = ctx.createLinearGradient(0, 0, 29, 0)
    metal.addColorStop(0, pal.frameDeep)
    metal.addColorStop(.35, mix(pal.frame, '#000000', .25))
    metal.addColorStop(.7, pal.frameDeep)
    metal.addColorStop(1, '#050b12')
    for (let yy = 140; yy < board.floorY - 80; yy += 230) {
      ctx.beginPath(); ctx.moveTo(-4, yy - 35); ctx.lineTo(19, yy - 12)
      ctx.lineTo(26, yy + 20); ctx.lineTo(26, yy + 105)
      ctx.lineTo(14, yy + 130); ctx.lineTo(-4, yy + 148); ctx.closePath()
      ctx.fillStyle = metal; ctx.fill()
      ctx.strokeStyle = pal.frame + '70'; ctx.lineWidth = 1; ctx.stroke()
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = '#030a10'; ctx.fillRect(8, yy + 23 + k * 13, 12, 5)
        ctx.fillStyle = pal.accent + '50'; ctx.fillRect(9, yy + 23 + k * 13, 3, 2)
      }
    }
    ctx.restore()
  }
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 50
  ctx.shadowOffsetY = 18
  roundRect(ctx, x, y, w, h, 28)
  ctx.fillStyle = pal.felt
  ctx.fill()
  ctx.restore()
  const felt = ctx.createLinearGradient(0, y, 0, y + h)
  felt.addColorStop(0, mix(pal.felt, '#ffffff', 0.04))
  felt.addColorStop(0.5, pal.felt)
  felt.addColorStop(1, mix(pal.felt, '#000000', 0.3))
  roundRect(ctx, x, y, w, h, 28)
  ctx.fillStyle = felt
  ctx.fill()
  // Soft pool of light that follows the sphere.
  ctx.save()
  roundRect(ctx, x, y, w, h, 28)
  ctx.clip()
  const b = drop.ball
  const pool = ctx.createRadialGradient(b.x, b.y, 10, b.x, b.y, 260)
  pool.addColorStop(0, hexAlpha(drop.ballDef.accent, 0.12))
  pool.addColorStop(1, hexAlpha(drop.ballDef.accent, 0))
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = pool
  ctx.fillRect(b.x - 260, b.y - 260, 520, 520)
  ctx.globalCompositeOperation = 'source-over'
  // Faint engraved guide lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.025)'
  ctx.lineWidth = 1
  for (let gx = board.margin + 40; gx < board.w - board.margin; gx += 40) {
    ctx.beginPath()
    ctx.moveTo(gx, y)
    ctx.lineTo(gx, y + h)
    ctx.stroke()
  }
  ctx.restore()
  drawEngraving(ctx, board, pal, time)
  roundRect(ctx, x, y, w, h, 28)
  ctx.lineWidth = 12
  ctx.strokeStyle = pal.frameDeep
  ctx.stroke()
  const rim = ctx.createLinearGradient(x, 0, x + w, 0)
  rim.addColorStop(0, mix(pal.frame, '#000000', 0.25))
  rim.addColorStop(0.5, mix(pal.frame, '#ffffff', 0.25))
  rim.addColorStop(1, mix(pal.frame, '#000000', 0.25))
  ctx.lineWidth = 4
  ctx.strokeStyle = rim
  ctx.stroke()
  roundRect(ctx, x + 6, y + 6, w - 12, h - 12, 23)
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.stroke()
  for (let ry = 80; ry < board.h; ry += 140) {
    for (const rx of [48, board.w - 48]) {
      ctx.beginPath()
      ctx.arc(rx, ry, 4, 0, Math.PI * 2)
      ctx.fillStyle = pal.frameDeep
      ctx.fill()
      ctx.beginPath()
      ctx.arc(rx - 0.8, ry - 0.8, 2.6, 0, Math.PI * 2)
      ctx.fillStyle = pal.frame
      ctx.fill()
    }
  }
  // Narrow glass highlights are attached to the cabinet, never the moving ball.
  ctx.save()
  roundRect(ctx, x + 9, y + 9, w - 18, h - 18, 22); ctx.clip()
  const glass = ctx.createLinearGradient(x, 0, x + w, 0)
  glass.addColorStop(0, '#ffffff00'); glass.addColorStop(.065, '#c5eeff09')
  glass.addColorStop(.17, '#ffffff00'); glass.addColorStop(.84, '#ffffff00')
  glass.addColorStop(.91, '#ffffff06'); glass.addColorStop(1, '#ffffff00')
  ctx.fillStyle = glass; ctx.fillRect(x, y, w, h)
  ctx.restore()
}

function drawBoard(ctx: CanvasRenderingContext2D, board: Board, drop: Drop, pal: Palette, input: DrawInput) {
  drawCabinet(ctx, board, drop, pal, input.time)
  drawReactor(ctx, board, drop, pal, input.time)
  drawChute(ctx, board, pal)
  drawBins(ctx, board, drop, pal, input)
  drawZones(ctx, board, pal, input.time)
  drawShutter(ctx, board, drop, pal, input.time)
  drawPegs(ctx, board, drop, pal, input)
  drawBumpers(ctx, board, drop, pal, input.time)
  if (input.aiming && input.preview.length) drawPreview(ctx, input, pal)
  drawLauncher(ctx, board, drop, pal, input)

  ctx.globalCompositeOperation = 'lighter'
  for (const r of input.rings) {
    const k = 1 - r.life / r.max
    const e = 1 - (1 - k) * (1 - k) * (1 - k)
    ctx.globalAlpha = Math.max(0, r.life / r.max) * 0.9
    ctx.strokeStyle = r.color
    ctx.lineWidth = Math.max(0.5, r.width * (1 - k * 0.7))
    ctx.beginPath()
    ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * e, 0, Math.PI * 2)
    ctx.stroke()
    // Faceted impact rays open out between the two shockwave fronts.
    if (r.r1 >= 45) {
      const radius = r.r0 + (r.r1 - r.r0) * e
      ctx.lineWidth = Math.max(0.7, r.width * 0.35 * (1 - k))
      for (let j = 0; j < 8; j++) {
        const a = j * Math.PI / 4 + r.x * 0.1
        ctx.beginPath()
        ctx.moveTo(r.x + Math.cos(a) * radius * 0.8, r.y + Math.sin(a) * radius * 0.8)
        ctx.lineTo(r.x + Math.cos(a) * radius * (1.18 - k * 0.18), r.y + Math.sin(a) * radius * (1.18 - k * 0.18))
        ctx.stroke()
      }
    }
  }
  if (input.particlesOn) {
    ctx.lineCap = 'round'
    for (const p of input.particles) {
      const a = Math.max(0, p.life / p.max)
      ctx.globalAlpha = a
      if (p.streak) {
        ctx.strokeStyle = p.color
        ctx.lineWidth = p.size * (0.4 + a * 0.6)
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035)
        ctx.stroke()
      } else {
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'

  drawBall(ctx, drop, input.trailColor, input.time, input.particlesOn)
  drawChainReadout(ctx, drop, pal)
  drawFloaters(ctx, input.floaters)
}

function drawChainReadout(ctx: CanvasRenderingContext2D, drop: Drop, pal: Palette) {
  if (drop.combo < 3 || drop.captured || drop.dead) return
  const b = drop.ball
  // One stable, offset readout replaces competing tiny numbers around the sphere.
  const side = b.x > drop.board.w * .65 ? -1 : 1
  const x = b.x + side * 42
  ctx.save()
  ctx.textAlign = side > 0 ? 'left' : 'right'
  ctx.textBaseline = 'middle'
  ctx.font = '800 21px Outfit, sans-serif'
  ctx.strokeStyle = '#03090ff0'; ctx.lineWidth = 5
  const label = `${drop.combo} CHAIN`
  ctx.strokeText(label, x, b.y - 15)
  ctx.fillStyle = drop.combo >= 10 ? pal.gold : '#effff9'; ctx.fillText(label, x, b.y - 15)
  ctx.font = '700 11px monospace'
  const mult = `×${drop.mult.toFixed(1)}${drop.overdriveTime > 0 ? ' · SURGE' : ''}`
  ctx.strokeText(mult, x, b.y + 3); ctx.fillStyle = pal.accent; ctx.fillText(mult, x, b.y + 3)
  // Depleting chain window is real timing information, not decorative animation.
  const left = Math.max(0, Math.min(1, drop.comboTimer / drop.profile.comboWindow))
  ctx.fillStyle = '#02080dcc'; ctx.fillRect(side > 0 ? x : x - 56, b.y + 15, 56, 3)
  ctx.fillStyle = pal.accent; ctx.fillRect(side > 0 ? x : x - 56, b.y + 15, 56 * left, 3)
  ctx.restore()
}

function drawPegs(ctx: CanvasRenderingContext2D, board: Board, drop: Drop, pal: Palette, input: DrawInput) {
  const amp = board.boss && drop.coreHits >= 2 ? 2.1 : 1
  const popT = input.popT
  // Brief filaments make a ricochet chain readable at a glance.
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < board.pegs.length; i++) {
    const flash = drop.flashPeg[i]
    if (flash < 0.35 || drop.gone[i]) continue
    const p = pegPose(board.pegs[i], drop.time, amp)
    const distance = Math.hypot(p.x - drop.ball.x, p.y - drop.ball.y)
    if (distance > 180) continue
    ctx.strokeStyle = hexAlpha(pal.accent, flash * 0.24)
    ctx.lineWidth = 1.3
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(drop.ball.x, drop.ball.y)
    ctx.stroke()
  }
  ctx.restore()
  // Additive halo pass: lit pegs breathe, fresh hits flare.
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < board.pegs.length; i++) {
    if (drop.gone[i]) continue
    const pop = popT ? popT[i] : 0
    if (pop > POP_LIFE) continue
    const lit = drop.lit[i]
    const flash = Math.max(0, drop.flashPeg[i])
    if (!lit && flash <= 0) continue
    const peg = board.pegs[i]
    const pose = pegPose(peg, drop.time, amp)
    const gold = peg.kind === 'gold' || drop.gilded[i]
    const color = gold ? pal.gold : pal.accent
    const breathe = 0.28 + 0.08 * Math.sin(input.time * 3 + i)
    glow(ctx, color, pose.x, pose.y, peg.r * (3 + flash * 2.4), (lit ? breathe : 0) + flash * 0.9)
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'

  for (let i = 0; i < board.pegs.length; i++) {
    if (drop.gone[i]) continue
    const pop = popT ? popT[i] : 0
    if (pop > POP_LIFE) continue
    const peg = board.pegs[i]
    const pose = pegPose(peg, drop.time, amp)
    if (peg.motion) {
      ctx.strokeStyle = hexAlpha(pal.steel, 0.22)
      ctx.lineWidth = 2
      ctx.setLineDash([2, 5])
      ctx.beginPath()
      ctx.moveTo(peg.x - peg.motion.amp * amp, peg.y)
      ctx.lineTo(peg.x + peg.motion.amp * amp, peg.y)
      ctx.stroke()
      ctx.setLineDash([])
    }
    const vanishing = drop.vanish[i] > 0
    const flash = Math.max(0, drop.flashPeg[i])
    let scale = 1 + flash * flash * 0.32
    let alpha = vanishing ? 0.25 + 0.2 * Math.sin(input.time * 16) : 1
    if (pop > 0) {
      scale = 1 + (pop / POP_LIFE) * 0.9
      alpha = 1 - pop / POP_LIFE
    }
    ctx.globalAlpha = alpha
    const kind: PegLook = peg.kind === 'gold' || drop.gilded[i] ? 'gold' : peg.kind === 'reinforced' ? 'reinforced' : 'normal'
    // Recessed sockets distinguish the play surface from the polished peg heads.
    ctx.beginPath()
    ctx.arc(pose.x, pose.y + 1, peg.r + 3.5, 0, Math.PI * 2)
    ctx.fillStyle = '#03090f'
    ctx.fill()
    ctx.strokeStyle = hexAlpha(kind === 'gold' ? pal.gold : pal.accent, kind === 'gold' ? 0.45 : 0.15)
    ctx.lineWidth = 1
    ctx.stroke()
    const sprite = pegSprite(pal, kind, drop.lit[i])
    const size = peg.r * 3.3 * scale
    ctx.drawImage(sprite, pose.x - size / 2, pose.y - size / 2, size, size)
    if (kind === 'gold') {
      const a = input.time * 1.2 + i
      const sx = pose.x + Math.cos(a) * (peg.r + 6)
      const sy = pose.y + Math.sin(a) * (peg.r + 6)
      ctx.fillStyle = pal.gold
      ctx.globalAlpha = alpha * (0.45 + Math.sin(input.time * 2 + i) * 0.25)
      ctx.fillRect(sx - 3, sy - 0.7, 6, 1.4)
      ctx.fillRect(sx - 0.7, sy - 3, 1.4, 6)
      ctx.globalAlpha = alpha
    }
    if (peg.kind === 'vanish' && !vanishing) {
      ctx.strokeStyle = hexAlpha(pal.accent, 0.8)
      ctx.setLineDash([3, 3])
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(pose.x, pose.y, peg.r + 5, input.time, input.time + Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }
    if (flash > 0) {
      ctx.globalAlpha = flash * 0.8
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(pose.x, pose.y, peg.r * scale, 0, Math.PI * 2)
      ctx.fill()
    }
    if (drop.critPeg === i) {
      ctx.globalAlpha = 0.95
      ctx.strokeStyle = pal.gold
      ctx.lineWidth = 2.5
      const rr = peg.r + 9 + Math.sin(input.time * 8) * 2
      ctx.beginPath()
      ctx.arc(pose.x, pose.y, rr, 0, Math.PI * 2)
      ctx.stroke()
      for (let k = 0; k < 4; k++) {
        const a = input.time * 2 + (k * Math.PI) / 2
        ctx.beginPath()
        ctx.moveTo(pose.x + Math.cos(a) * (rr + 3), pose.y + Math.sin(a) * (rr + 3))
        ctx.lineTo(pose.x + Math.cos(a) * (rr + 10), pose.y + Math.sin(a) * (rr + 10))
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
    if (input.hitboxes) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.strokeRect(pose.x - peg.r, pose.y - peg.r, peg.r * 2, peg.r * 2)
    }
  }
}

function drawBumpers(ctx: CanvasRenderingContext2D, board: Board, drop: Drop, pal: Palette, time: number) {
  for (let bi = 0; bi < board.bumpers.length; bi++) {
    const b = board.bumpers[bi]
    const flash = Math.max(0, drop.bumperFlash[bi] ?? 0)
    if (b.relay != null && board.encounter) {
      drawGuardianRelay(ctx, b, flash, board, drop, pal)
      continue
    }
    if (b.core) drawCoreSeal(ctx, b.x, b.y, b.r, drop, pal, time)
    if (b.core && drop.coreOpen) {
      ctx.strokeStyle = hexAlpha(pal.gold, 0.6 + 0.3 * Math.sin(time * 6))
      ctx.lineWidth = 3
      ctx.setLineDash([6, 6])
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.r, time, time + Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      continue
    }
    const s = 1 + flash * 0.16
    const r = b.r * s
    ctx.globalCompositeOperation = 'lighter'
    glow(ctx, b.core ? pal.accent : pal.frame, b.x, b.y, r * 2.6, 0.12 + flash * 0.7)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.beginPath()
    ctx.arc(b.x + 1, b.y + 5, r, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2)
    ctx.fillStyle = pal.frameDeep
    ctx.fill()
    ctx.lineWidth = b.core ? 8 : 7
    ctx.strokeStyle = flash > 0 ? mix(b.core ? pal.accent : pal.frame, '#ffffff', flash * 0.7) : b.core ? pal.accent : pal.frame
    ctx.stroke()
    // Rotating tick marks keep the bumper feeling alive.
    ctx.save()
    ctx.translate(b.x, b.y)
    ctx.rotate(time * (b.core ? -0.8 : 0.5))
    ctx.strokeStyle = hexAlpha('#ffffff', 0.35)
    ctx.lineWidth = 2
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66)
      ctx.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8)
      ctx.stroke()
    }
    ctx.restore()
    const inner = ctx.createRadialGradient(b.x - r * 0.2, b.y - r * 0.25, 1, b.x, b.y, r * 0.55)
    inner.addColorStop(0, flash > 0 ? '#ffffff' : mix(pal.felt, '#ffffff', 0.2))
    inner.addColorStop(1, pal.felt)
    ctx.beginPath()
    ctx.arc(b.x, b.y, r * 0.55, 0, Math.PI * 2)
    ctx.fillStyle = inner
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.stroke()
    if (b.core) {
      ctx.strokeStyle = pal.bg0
      ctx.lineWidth = 2.5
      for (let c = 0; c < drop.coreHits; c++) {
        ctx.beginPath()
        ctx.moveTo(b.x, b.y)
        const a = -Math.PI / 2 + c * 1.1
        ctx.lineTo(b.x + Math.cos(a) * r * 0.85, b.y + Math.sin(a) * r * 0.85)
        ctx.stroke()
      }
      // Five hit sockets around the core.
      for (let c = 0; c < 5; c++) {
        const a = -Math.PI / 2 + (c / 5) * Math.PI * 2
        ctx.beginPath()
        ctx.arc(b.x + Math.cos(a) * (r + 14), b.y + Math.sin(a) * (r + 14), 4, 0, Math.PI * 2)
        ctx.fillStyle = c < drop.coreHits ? pal.gold : hexAlpha(pal.frame, 0.25)
        ctx.fill()
      }
    }
  }
}

/** Guardian targets have a collision-driven material and a persistent, non-color state. */
function drawGuardianRelay(ctx: CanvasRenderingContext2D, b: Bumper, flash: number, board: Board, drop: Drop, pal: Palette) {
  const encounter = board.encounter!
  const id = b.relay!
  const bell = encounter.id === 'bellkeeper'
  const credited = drop.encounterComplete || (bell && !!drop.relayHits[id])
  const target = !credited && drop.encounterTargets.includes(id)
  const cyan = '#94f7ed'
  const state = credited ? pal.gold : target ? cyan : pal.steel
  const r = b.r
  ctx.save(); ctx.translate(b.x, b.y)

  if (bell && credited) {
    // Linked bells physically retract. A hollow seal records the credit without
    // suggesting a solid bumper remains in the newly opened lane.
    ctx.strokeStyle = hexAlpha(pal.gold, .6); ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(0, 0, r + 10, 0, Math.PI * 2); ctx.stroke()
    ctx.setLineDash([3, 6]); ctx.strokeStyle = pal.gold + '48'
    ctx.beginPath(); ctx.arc(0, 0, r - 2, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([])
    if (flash > .04) {
      // The just-struck bell withdraws as an outline, leaving the lane visibly open.
      ctx.save(); ctx.globalAlpha = flash * .5
      ctx.translate(0, -r * .12 - (1 - flash) * 8)
      ctx.rotate(Math.sin(flash * 12) * flash * .28)
      ctx.strokeStyle = pal.gold; ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.moveTo(-r * .62, r * .36)
      ctx.bezierCurveTo(-r * .36, 0, -r * .48, -r * .55, 0, -r * .59)
      ctx.bezierCurveTo(r * .48, -r * .55, r * .36, 0, r * .62, r * .36)
      ctx.closePath(); ctx.stroke()
      const swing = Math.sin(flash * 18) * flash * r * .17
      ctx.beginPath(); ctx.moveTo(0, -r * .1); ctx.lineTo(swing, r * .45); ctx.stroke()
      ctx.restore()
    }
    ctx.strokeStyle = pal.gold; ctx.lineWidth = 3; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(-r * .25, 0); ctx.lineTo(-r * .04, r * .2)
    ctx.lineTo(r * .35, -r * .25); ctx.stroke()
    ctx.font = '700 11px Outfit, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = pal.gold
    ctx.fillText(['I', 'II', 'III'][id] ?? String(id + 1), 0, r + 27)
    ctx.restore(); return
  }

  // Recessed mount and ring: the visible circle remains the actual collision boundary.
  ctx.fillStyle = '#01060c'; ctx.beginPath(); ctx.arc(1, 5, r + 7, 0, Math.PI * 2); ctx.fill()
  const mount = ctx.createLinearGradient(-r, -r, r, r)
  mount.addColorStop(0, '#d3c9ac'); mount.addColorStop(.22, '#384f56')
  mount.addColorStop(.62, '#09141b'); mount.addColorStop(1, '#867256')
  ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, Math.PI * 2)
  ctx.fillStyle = mount; ctx.fill()
  ctx.lineWidth = 1.5; ctx.strokeStyle = pal.frame + '80'; ctx.stroke()
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = '#051119'; ctx.fill()
  ctx.lineWidth = 3; ctx.strokeStyle = hexAlpha(state, credited || target ? .95 : .35); ctx.stroke()
  // Four honest mounting screws make the targets feel embedded in the cabinet.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2
    const sx = Math.cos(a) * (r + 1), sy = Math.sin(a) * (r + 1)
    ctx.fillStyle = '#080e15'; ctx.beginPath(); ctx.arc(sx, sy, 2, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#dfd5ae80'; ctx.lineWidth = .8
    ctx.beginPath(); ctx.moveTo(sx - 1, sy - 1); ctx.lineTo(sx + 1, sy + 1); ctx.stroke()
  }

  // Mechanical reactions are driven only by the corresponding contact flash.
  if (bell) {
    ctx.save()
    ctx.translate(0, -r * .12)
    ctx.rotate(Math.sin(flash * 12) * flash * .28)
    const brass = ctx.createLinearGradient(-r * .65, 0, r * .65, 0)
    brass.addColorStop(0, '#896a35'); brass.addColorStop(.34, credited ? '#fff0a6' : '#e5c58d')
    brass.addColorStop(.62, '#b89c63'); brass.addColorStop(1, '#63482b')
    ctx.fillStyle = brass
    ctx.beginPath(); ctx.moveTo(-r * .65, r * .38)
    ctx.bezierCurveTo(-r * .38, r * .05, -r * .5, -r * .55, 0, -r * .59)
    ctx.bezierCurveTo(r * .5, -r * .55, r * .38, r * .05, r * .65, r * .38)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = '#ffedbc90'; ctx.lineWidth = 1; ctx.stroke()
    ctx.fillStyle = '#241d15'; ctx.beginPath()
    ctx.ellipse(0, r * .39, r * .65, r * .1, 0, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = credited ? pal.gold : '#e8ce93'; ctx.lineWidth = 2.5; ctx.stroke()
    // The clapper swings separately inside the bell after a physical strike.
    ctx.save(); ctx.rotate(Math.sin(flash * 18) * flash * .45)
    ctx.strokeStyle = '#c2ac78'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(0, -r * .03); ctx.lineTo(0, r * .45); ctx.stroke()
    ctx.beginPath(); ctx.arc(0, r * .46, r * .1, 0, Math.PI * 2)
    ctx.fillStyle = '#f4dfac'; ctx.fill(); ctx.restore()
    ctx.beginPath(); ctx.arc(0, -r * .64, r * .085, 0, Math.PI * 2); ctx.fillStyle = '#e5c58d'; ctx.fill()
    ctx.restore()
  } else {
    // Twin piston cartridges have a clear numbered identity and a real recoil stroke.
    const recoil = flash * r * .18
    ctx.fillStyle = '#111f29'; ctx.strokeStyle = '#95afba70'; ctx.lineWidth = 1
    roundRect(ctx, -r * .58, -r * .67, r * 1.16, r * 1.3, 5); ctx.fill(); ctx.stroke()
    for (const side of [-1, 1]) {
      const shaft = ctx.createLinearGradient(side * r * .4 - 2, 0, side * r * .4 + 2, 0)
      shaft.addColorStop(0, '#536874'); shaft.addColorStop(.5, '#e7ecdf'); shaft.addColorStop(1, '#4e5e65')
      ctx.fillStyle = shaft; ctx.fillRect(side * r * .4 - 2, -r * .58, 4, r * 1.04)
    }
    const piston = ctx.createLinearGradient(0, -r * .4, 0, r * .28)
    piston.addColorStop(0, target ? '#b0fcf2' : '#9aaeb6')
    piston.addColorStop(.16, '#415c64'); piston.addColorStop(.8, '#142832'); piston.addColorStop(1, '#b4a27a')
    roundRect(ctx, -r * .52, -r * .4 + recoil, r * 1.04, r * .65, 4)
    ctx.fillStyle = piston; ctx.fill(); ctx.strokeStyle = state + '80'; ctx.stroke()
    ctx.strokeStyle = target ? cyan : '#8da5ac60'; ctx.lineWidth = 1.5
    for (let j = 0; j < 3; j++) {
      const yy = -r * .2 + j * r * .13 + recoil
      ctx.beginPath(); ctx.moveTo(-r * .32, yy); ctx.lineTo(r * .32, yy); ctx.stroke()
    }
  }

  // Large glyphs and explicit marks distinguish NEXT, credited, and idle targets.
  const label = ['I', 'II', 'III'][id] ?? String(id + 1)
  ctx.font = `800 ${Math.max(13, r * .43)}px Outfit, sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.strokeStyle = '#02070c'; ctx.lineWidth = 4
  ctx.strokeText(label, 0, r * .64); ctx.fillStyle = credited ? pal.gold : '#f3f8ec'; ctx.fillText(label, 0, r * .64)
  const rr = r + 13
  if (credited) {
    ctx.strokeStyle = pal.gold; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(rr - 8, -rr + 4); ctx.lineTo(rr - 3, -rr + 9); ctx.lineTo(rr + 7, -rr - 3); ctx.stroke()
  } else if (target) {
    ctx.strokeStyle = cyan; ctx.lineWidth = 2
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2
      ctx.beginPath(); ctx.arc(0, 0, rr, a + .18, a + 1.12); ctx.stroke()
    }
    if (!bell) {
      ctx.fillStyle = '#03131a'; roundRect(ctx, -23, -rr - 22, 46, 17, 4); ctx.fill()
      ctx.fillStyle = cyan; ctx.font = '800 11px Outfit, sans-serif'; ctx.fillText('NEXT', 0, -rr - 13)
      ctx.beginPath(); ctx.moveTo(-4, -rr - 3); ctx.lineTo(0, -rr + 2); ctx.lineTo(4, -rr - 3); ctx.lineWidth = 1.5; ctx.stroke()
    }
  }
  if (flash > .05) {
    ctx.strokeStyle = hexAlpha('#fff9d8', flash * .8); ctx.lineWidth = 2 + flash * 2
    ctx.beginPath(); ctx.arc(0, 0, r + flash * 8, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.restore()
}

function drawCoreSeal(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, drop: Drop, pal: Palette, time: number) {
  ctx.save(); ctx.translate(x, y)
  const rr = r + 37
  // The five broad seals are the boss health display; damage physically opens the ring.
  ctx.lineWidth = 9; ctx.lineCap = 'butt'
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 5
    ctx.strokeStyle = i < drop.coreHits ? pal.gold + '40' : '#030910'
    ctx.beginPath(); ctx.arc(0, 0, rr, a + .075, a + Math.PI * 2 / 5 - .075); ctx.stroke()
    ctx.lineWidth = 3
    ctx.strokeStyle = i < drop.coreHits ? pal.gold : drop.coreHits >= 2 ? pal.danger : pal.accent
    ctx.beginPath(); ctx.arc(0, 0, rr, a + .075, a + Math.PI * 2 / 5 - .075); ctx.stroke()
    ctx.lineWidth = 9
    const ax = Math.cos(a + .62), ay = Math.sin(a + .62)
    ctx.fillStyle = i < drop.coreHits ? pal.gold : pal.frame + '60'
    ctx.beginPath(); ctx.arc(ax * (rr + 10), ay * (rr + 10), 2.4, 0, Math.PI * 2); ctx.fill()
  }
  if (!drop.coreOpen) {
    const danger = drop.coreHits >= 2
    // A slow-moving segmented threat orbit communicates the phase escalation.
    ctx.strokeStyle = hexAlpha(danger ? pal.danger : pal.accent, danger ? .45 : .22)
    ctx.lineWidth = 1.5
    for (let i = 0; i < 3; i++) {
      const a = -time * .28 + i * Math.PI * 2 / 3
      ctx.beginPath(); ctx.arc(0, 0, rr + 18, a, a + .5); ctx.stroke()
    }
  }
  ctx.textAlign = 'center'; ctx.font = '700 11px monospace'
  ctx.fillStyle = '#030910'; ctx.fillRect(-64, rr + 23, 128, 18)
  ctx.fillStyle = drop.coreOpen ? pal.gold : drop.coreHits >= 2 ? pal.danger : pal.accent
  ctx.fillText(drop.coreOpen ? 'CORE UNSEALED' : drop.coreHits >= 4 ? 'FINAL SEAL' : `${5 - drop.coreHits} SEALS · ${drop.coreHits >= 2 ? 'OVERCLOCK' : 'STABLE'}`, 0, rr + 35)
  ctx.restore()
}

function drawPreview(ctx: CanvasRenderingContext2D, input: DrawInput, pal: Palette) {
  const pts = input.preview
  const flow = Math.floor(input.time * 16)
  // A solid launch segment establishes direction immediately; later uncertainty fades.
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  ctx.beginPath()
  for (let i = 0; i < Math.min(14, pts.length); i++) {
    const p = pts[i]
    if (!i) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y)
  }
  ctx.strokeStyle = pal.accent + '22'; ctx.lineWidth = 11; ctx.stroke()
  ctx.strokeStyle = '#eafff1a0'; ctx.lineWidth = 1.5; ctx.stroke()
  ctx.restore()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const t = 1 - i / pts.length
    const beat = (i + 1000 - flow) % 6 === 0
    ctx.globalAlpha = t * (beat ? 0.95 : 0.5)
    ctx.fillStyle = beat ? '#ffffff' : pal.accent
    ctx.beginPath()
    ctx.arc(p.x, p.y, (beat ? 3.4 : 2.2) + t * 1.4, 0, Math.PI * 2)
    ctx.fill()
  }
  const last = pts[pts.length - 1]
  if (last) {
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(input.time * 6)
    ctx.strokeStyle = pal.accent
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(last.x, last.y, 9, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  if (input.board && input.drop) {
    const board = input.board, drop = input.drop
    // Highlight the first predicted contact using the same world path, without adding simulation work.
    let target = -1
    for (let p = 1; p < pts.length && target < 0; p++) {
      for (let i = 0; i < board.pegs.length; i++) {
        const peg = board.pegs[i]
        const pos = pegPose(peg, drop.time, 1)
        if (Math.hypot(pts[p].x - pos.x, pts[p].y - pos.y) < peg.r + drop.ball.r + 5) { target = i; break }
      }
    }
    if (target >= 0) {
      const peg = board.pegs[target], p = pegPose(peg, drop.time, 1)
      const color = peg.kind === 'gold' ? pal.gold : pal.accent
      const rr = peg.r + drop.ball.r + 8
      ctx.strokeStyle = color; ctx.lineWidth = 2
      for (let k = 0; k < 4; k++) {
        const a = Math.PI * k / 2
        ctx.beginPath(); ctx.arc(p.x, p.y, rr, a + .2, a + 1.15); ctx.stroke()
      }
      ctx.font = '700 10px monospace'; ctx.textAlign = 'center'
      const text = peg.kind === 'gold' ? 'GOLD CONTACT' : 'FIRST CONTACT'
      const w = ctx.measureText(text).width + 16
      const labelX = Math.max(board.margin + w / 2 + 8, Math.min(board.w - board.margin - w / 2 - 8, p.x))
      let labelY = p.y - rr - 23
      const overlapsLauncher = labelX + w / 2 > board.launchX - 85 &&
        labelX - w / 2 < board.launchX + 85 &&
        labelY + 17 > board.launchY - 30 && labelY < board.launchY + 105
      if (overlapsLauncher) labelY = p.y + rr + 9
      roundRect(ctx, labelX - w / 2, labelY, w, 17, 4)
      ctx.fillStyle = '#030b12ee'; ctx.fill(); ctx.fillStyle = color
      ctx.fillText(text, labelX, labelY + 12)
    }
  }
}

function drawLauncher(ctx: CanvasRenderingContext2D, board: Board, drop: Drop, pal: Palette, input: DrawInput) {
  const x = board.launchX
  const y = board.launchY
  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = hexAlpha(pal.frame, 0.4)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(0, 0, 59, 0.18, Math.PI - 0.18)
  ctx.stroke()
  for (let i = -5; i <= 5; i++) {
    const a = Math.PI / 2 + i * 0.12
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * 60, Math.sin(a) * 60)
    ctx.lineTo(Math.cos(a) * (i % 5 ? 65 : 70), Math.sin(a) * (i % 5 ? 65 : 70))
    ctx.stroke()
  }
  if (input.aiming) {
    ctx.rotate(-input.aimAngle)
    ctx.fillStyle = pal.accent
    ctx.beginPath()
    ctx.moveTo(0, 56)
    ctx.lineTo(-4, 67)
    ctx.lineTo(4, 67)
    ctx.fill()
  }
  ctx.restore()
  if (input.aiming) {
    // Degree readout and symmetric brackets turn the launcher into a precision instrument.
    ctx.save(); ctx.textAlign = 'center'; ctx.font = '700 10px monospace'
    ctx.fillStyle = pal.accent
    const deg = Math.round(input.aimAngle * 180 / Math.PI)
    ctx.fillText(`${deg > 0 ? '+' : ''}${deg}°`, x, y + 91)
    ctx.strokeStyle = pal.accent + '80'; ctx.lineWidth = 1.5
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(x + side * 66, y - 12)
      ctx.lineTo(x + side * 74, y - 12); ctx.lineTo(x + side * 74, y + 12)
      ctx.lineTo(x + side * 66, y + 12); ctx.stroke()
    }
    ctx.restore()
  }
  ctx.lineCap = 'round'
  ctx.strokeStyle = pal.frameDeep
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.moveTo(x - 30, 36)
  ctx.lineTo(x - 16, y - 14)
  ctx.moveTo(x + 30, 36)
  ctx.lineTo(x + 16, y - 14)
  ctx.stroke()
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-input.aimAngle)
  const kick = input.launchKick
  const len = 42 - kick * 14
  const barrel = ctx.createLinearGradient(-13, 0, 13, 0)
  barrel.addColorStop(0, mix(pal.frame, '#000000', 0.35))
  barrel.addColorStop(0.45, mix(pal.frame, '#ffffff', 0.35))
  barrel.addColorStop(1, mix(pal.frame, '#000000', 0.45))
  roundRect(ctx, -13, 4, 26, len, 7)
  ctx.fillStyle = barrel
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = pal.frameDeep
  ctx.stroke()
  roundRect(ctx, -15, len - 4, 30, 9, 4)
  ctx.fillStyle = mix(pal.frame, '#ffffff', 0.15)
  ctx.fill()
  ctx.stroke()
  if (kick > 0.05) {
    ctx.globalCompositeOperation = 'lighter'
    glow(ctx, pal.gold, 0, len + 6, 30 * kick + 10, kick)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }
  ctx.restore()
  ctx.beginPath()
  ctx.arc(x, y, 24, 0, Math.PI * 2)
  const hub = ctx.createRadialGradient(x - 6, y - 8, 2, x, y, 24)
  hub.addColorStop(0, mix(pal.frame, '#ffffff', 0.3))
  hub.addColorStop(1, pal.frameDeep)
  ctx.fillStyle = hub
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = pal.frame
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x, y, 16, 0, Math.PI * 2)
  ctx.fillStyle = mix(pal.felt, '#000000', 0.4)
  ctx.fill()
  if (input.aiming) {
    ctx.globalCompositeOperation = 'lighter'
    glow(ctx, pal.accent, x, y, 60, 0.25 + 0.1 * Math.sin(input.time * 4))
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }
}

function drawChute(ctx: CanvasRenderingContext2D, board: Board, pal: Palette) {
  ctx.lineCap = 'round'
  ctx.strokeStyle = hexAlpha(pal.frameDeep, 0.9)
  ctx.lineWidth = 9
  ctx.beginPath()
  ctx.moveTo(board.launchX - 34, 28)
  ctx.quadraticCurveTo(board.launchX - 80, 90, board.margin + 20, 150)
  ctx.moveTo(board.launchX + 34, 28)
  ctx.quadraticCurveTo(board.launchX + 80, 90, board.w - board.margin - 20, 150)
  ctx.stroke()
  ctx.strokeStyle = hexAlpha(pal.frame, 0.55)
  ctx.lineWidth = 3
  ctx.stroke()
}

function binColor(bin: Bin, pal: Palette): string {
  if (bin.kind === 'hazard') return pal.danger
  if (bin.kind === 'bonus') return pal.accent
  if (bin.kind === 'jackpot') return pal.gold
  return pal.frame
}

function binLabel(bin: Bin, board: Board, drop: Drop): string {
  if (bin.kind === 'hazard') return 'GUTTER'
  if (bin.kind === 'coin') return `+${Math.round(12 * board.payout)}`
  if (bin.kind === 'bonus') return 'RICH ×'
  return drop.coreOpen || !board.boss ? 'MAW' : 'SEALED'
}

function drawBins(ctx: CanvasRenderingContext2D, board: Board, drop: Drop, pal: Palette, input: DrawInput) {
  const top = board.floorY
  const depth = 108
  const time = input.time
  for (const bin of board.bins) {
    const hot = !!drop.captured && drop.ball.x >= bin.x0 && drop.ball.x <= bin.x1
    const armed = bin.kind === 'jackpot' && (board.boss ? drop.coreOpen : input.multHot)
    const color = binColor(bin, pal)
    const x0 = bin.x0 + 4
    const x1 = bin.x1 - 4
    const pulse = 0.5 + 0.5 * Math.sin(time * 5)
    const base = bin.kind === 'coin' ? 0.1 : 0.2
    const fill = ctx.createLinearGradient(0, top, 0, top + depth)
    fill.addColorStop(0, hexAlpha(color, 0.02))
    fill.addColorStop(1, hexAlpha(color, hot ? 0.6 : armed ? base + 0.2 * pulse : base))
    ctx.fillStyle = fill
    ctx.fillRect(x0, top, x1 - x0, depth)
    // Glass collector rim and inset panel, with a distinct shape for each pocket.
    roundRect(ctx, x0, top + 12, x1 - x0, depth - 13, 8)
    ctx.strokeStyle = hexAlpha(color, hot || armed ? 0.8 : 0.3)
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = hexAlpha(color, 0.35)
    for (let j = 0; j < 3; j++) ctx.fillRect(x0 + 8 + j * 7, top + depth - 14, 3, 3)
    ctx.fillStyle = hexAlpha(color, hot ? 1 : 0.7)
    ctx.fillRect(x0 + 6, top + depth - 4, x1 - x0 - 12, 3)
    if (hot || armed) {
      ctx.globalCompositeOperation = 'lighter'
      const beam = ctx.createLinearGradient(0, top + depth, 0, top - (hot ? 320 : 140))
      beam.addColorStop(0, hexAlpha(color, hot ? 0.45 : 0.18 * pulse + 0.06))
      beam.addColorStop(1, hexAlpha(color, 0))
      ctx.fillStyle = beam
      ctx.fillRect(x0, top - (hot ? 320 : 140), x1 - x0, depth + (hot ? 320 : 140))
      ctx.globalCompositeOperation = 'source-over'
      for (let j = 0; j < 4; j++) {
        const t = (time * 0.5 + j / 4) % 1
        ctx.globalAlpha = Math.sin(t * Math.PI) * (hot ? 0.9 : 0.4)
        const bx = (x0 + x1) / 2 + Math.sin(j * 14) * (x1 - x0) * 0.32
        const by = top + 70 - t * (hot ? 230 : 120)
        ctx.fillStyle = color
        ctx.fillRect(bx - 1, by - 4, 2, 8)
      }
      ctx.globalAlpha = 1
    }
    const mid = (bin.x0 + bin.x1) / 2
    if (bin.kind === 'hazard') {
      ctx.fillStyle = pal.danger
      for (let i = -1; i <= 1; i++) {
        const sx = mid + i * 14
        ctx.beginPath()
        ctx.moveTo(sx - 6, top + 98)
        ctx.lineTo(sx, top + 80)
        ctx.lineTo(sx + 6, top + 98)
        ctx.fill()
      }
    }
    ctx.font = '700 13px Outfit, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.globalAlpha = hot ? 1 : armed ? 0.7 + 0.3 * pulse : 0.65
    ctx.fillStyle = color
    const label = binLabel(bin, board, drop)
    if (x1 - x0 > ctx.measureText(label).width + 10) ctx.fillText(label, mid, top + (bin.kind === 'hazard' ? 54 : 44))
    ctx.globalAlpha = 1
    ctx.textBaseline = 'alphabetic'
  }
  // Dividers between pockets.
  ctx.lineCap = 'round'
  for (let i = 1; i < board.bins.length; i++) {
    const x = board.bins[i].x0
    ctx.strokeStyle = pal.frameDeep
    ctx.lineWidth = 9
    ctx.beginPath()
    ctx.moveTo(x, top + 10)
    ctx.lineTo(x, top + depth)
    ctx.stroke()
    ctx.strokeStyle = pal.frame
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, top + 10, 5, 0, Math.PI * 2)
    ctx.fillStyle = pal.frame
    ctx.fill()
  }
}

function drawZones(ctx: CanvasRenderingContext2D, board: Board, pal: Palette, time: number) {
  for (const z of board.zones) {
    if (z.kind === 'well') {
      ctx.fillStyle = hexAlpha(pal.well, 0.1)
      ctx.beginPath()
      ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.save()
      ctx.translate(z.x, z.y)
      ctx.lineWidth = 2
      for (let i = 0; i < 4; i++) {
        // Rings shrink inward so the pull reads without text.
        const k = (i / 4 + time * 0.35) % 1
        ctx.strokeStyle = hexAlpha(pal.well, 0.55 * k)
        ctx.beginPath()
        ctx.arc(0, 0, z.r * (1 - k) + 6, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.rotate(time * 0.6)
      ctx.strokeStyle = hexAlpha(pal.well, 0.7)
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.arc(0, 0, z.r * (0.35 + i * 0.22), 0.2 + i, Math.PI * 1.1 + i)
        ctx.stroke()
      }
      ctx.restore()
    } else if (z.kind === 'portal') {
      const tunnel = ctx.createRadialGradient(z.x, z.y, 1, z.x, z.y, z.r)
      tunnel.addColorStop(0, '#020813')
      tunnel.addColorStop(0.55, hexAlpha(pal.well, 0.16))
      tunnel.addColorStop(0.9, hexAlpha(pal.accent, 0.32))
      tunnel.addColorStop(1, hexAlpha(pal.accent, 0))
      ctx.fillStyle = tunnel
      ctx.beginPath()
      ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalCompositeOperation = 'lighter'
      glow(ctx, pal.accent, z.x, z.y, z.r * 2.4, 0.35 + 0.1 * Math.sin(time * 3))
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = pal.accent
      ctx.lineWidth = 3
      for (let j = 0; j < 10; j++) {
        const a = time * 1.1 + j * Math.PI / 5
        const r = z.r + 5 + Math.sin(time * 2 + j) * 3
        ctx.fillStyle = hexAlpha(pal.accent, 0.3 + j / 16)
        ctx.beginPath()
        ctx.arc(z.x + Math.cos(a) * r, z.y + Math.sin(a) * r, j % 3 ? 1.3 : 2.2, 0, Math.PI * 2)
        ctx.fill()
      }
      for (let k = 0; k < 3; k++) {
        ctx.beginPath()
        ctx.arc(z.x, z.y, z.r - k * 6, time * (k % 2 ? -2 : 1.4) + k, time * (k % 2 ? -2 : 1.4) + k + Math.PI * 1.2)
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.arc(z.x, z.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
    } else if (z.kind === 'spike') {
      ctx.globalCompositeOperation = 'lighter'
      glow(ctx, pal.danger, z.x, z.y, z.r * 2.4, 0.2 + 0.1 * Math.sin(time * 4 + z.y))
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      ctx.save()
      ctx.translate(z.x, z.y)
      ctx.rotate(time * 0.8)
      ctx.fillStyle = pal.danger
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        const bx = Math.cos(a) * 4
        const by = Math.sin(a) * 4
        ctx.beginPath()
        ctx.moveTo(bx + Math.cos(a) * z.r, by + Math.sin(a) * z.r)
        ctx.lineTo(bx + Math.cos(a + 0.4) * 6, by + Math.sin(a + 0.4) * 6)
        ctx.lineTo(bx + Math.cos(a - 0.4) * 6, by + Math.sin(a - 0.4) * 6)
        ctx.fill()
      }
      ctx.beginPath()
      ctx.arc(0, 0, 6, 0, Math.PI * 2)
      ctx.fillStyle = mix(pal.danger, '#000000', 0.4)
      ctx.fill()
      ctx.restore()
    } else if (z.kind === 'spring') {
      ctx.strokeStyle = pal.accent
      ctx.lineWidth = 3
      ctx.lineJoin = 'round'
      const bob = Math.sin(time * 5) * 1.5
      ctx.beginPath()
      for (let i = 0; i <= 6; i++) {
        const y = z.y - 16 + i * (6 + bob * 0.1)
        const x = z.x + (i % 2 === 0 ? -10 : 10)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.fillStyle = pal.frame
      ctx.fillRect(z.x - 14, z.y - 20 + bob, 28, 4)
    } else if (z.kind === 'accel') {
      ctx.fillStyle = hexAlpha(pal.accent, 0.07)
      ctx.fillRect(z.x, z.y, z.w, z.h)
      const shift = (time * 40) % 24
      for (let x = z.x + 16; x < z.x + z.w; x += 28) {
        for (let k = 0; k < 3; k++) {
          const y = z.y + ((k * 24 + shift) % z.h)
          ctx.globalAlpha = 0.25 + 0.5 * Math.sin((y - z.y) / z.h * Math.PI)
          drawArrow(ctx, x, y, 0, 1, pal.accent)
        }
      }
      ctx.globalAlpha = 1
    }
  }
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, color: string) {
  const l = Math.hypot(dx, dy) || 1
  const nx = dx / l
  const ny = dy / l
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x - nx * 8, y - ny * 8)
  ctx.lineTo(x + nx * 6, y + ny * 6)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + nx * 8, y + ny * 8)
  ctx.lineTo(x + nx * 2 - ny * 4, y + ny * 2 + nx * 4)
  ctx.lineTo(x + nx * 2 + ny * 4, y + ny * 2 - nx * 4)
  ctx.fill()
}

function drawShutter(ctx: CanvasRenderingContext2D, board: Board, drop: Drop, pal: Palette, time: number) {
  const walls = shutterWalls(board, drop.gapT)
  if (!walls.length || board.shutterY == null) return
  const c = gapCenter(board, drop.gapT)
  const glowG = ctx.createLinearGradient(0, board.shutterY, 0, board.floorY)
  glowG.addColorStop(0, hexAlpha(pal.accent, 0.22))
  glowG.addColorStop(1, hexAlpha(pal.accent, 0))
  ctx.fillStyle = glowG
  ctx.fillRect(c - board.gapWidth / 2, board.shutterY, board.gapWidth, board.floorY - board.shutterY)
  // Chevrons falling through the open gate.
  ctx.strokeStyle = hexAlpha(pal.accent, 0.5)
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  for (let k = 0; k < 3; k++) {
    const t = (k / 3 + time * 0.8) % 1
    const y = board.shutterY - 50 + t * 70
    ctx.globalAlpha = Math.sin(t * Math.PI)
    ctx.beginPath()
    ctx.moveTo(c - 10, y - 6)
    ctx.lineTo(c, y + 2)
    ctx.lineTo(c + 10, y - 6)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.lineWidth = 18
  ctx.strokeStyle = pal.frameDeep
  for (const w of walls) {
    ctx.beginPath()
    ctx.moveTo(w.x1, w.y1)
    ctx.lineTo(w.x2, w.y2)
    ctx.stroke()
  }
  ctx.lineWidth = 12
  ctx.strokeStyle = pal.frame
  for (const w of walls) {
    ctx.beginPath()
    ctx.moveTo(w.x1, w.y1)
    ctx.lineTo(w.x2, w.y2)
    ctx.stroke()
  }
  ctx.lineWidth = 3
  ctx.strokeStyle = hexAlpha('#ffffff', 0.35)
  for (const w of walls) {
    ctx.beginPath()
    ctx.moveTo(w.x1, w.y1 - 3)
    ctx.lineTo(w.x2, w.y2 - 3)
    ctx.stroke()
  }
}

function drawBall(ctx: CanvasRenderingContext2D, drop: Drop, trail: string, time: number, motion: boolean) {
  const b = drop.ball
  const surge = drop.overdriveTime > 0
  const color = surge ? '#ffe9a3' : trail || drop.ballDef.accent
  // A hard dark isolation ring keeps the sphere distinct from illuminated peg heads.
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 3, 0, Math.PI * 2)
  ctx.fillStyle = '#020710'; ctx.fill()
  if (surge || drop.overdriveReady) {
    ctx.save(); ctx.translate(b.x, b.y)
    const rr = b.r + (surge ? 20 : 11)
    ctx.strokeStyle = surge ? '#ffe9a3' : drop.ballDef.accent
    ctx.lineWidth = surge ? 3 : 1.6
    for (let i = 0; i < 3; i++) {
      const a = (motion ? time * (surge ? 2.6 : .8) : 0) + i * Math.PI * 2 / 3
      ctx.beginPath(); ctx.arc(0, 0, rr, a, a + 1.3); ctx.stroke()
    }
    if (surge && motion) {
      const field = ctx.createRadialGradient(0, 0, b.r + 4, 0, 0, 88)
      field.addColorStop(0, '#ffedbb22'); field.addColorStop(1, '#ffedbb00')
      ctx.fillStyle = field; ctx.fillRect(-88, -88, 176, 176)
      ctx.strokeStyle = '#ffe9a340'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.ellipse(0, 0, 55, 19, -time * .8, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.ellipse(0, 0, 55, 19, time * .8, 0, Math.PI * 2); ctx.stroke()
    }
    ctx.restore()
  }
  if (drop.ballDef.id === 'void') {
    ctx.save()
    ctx.translate(b.x, b.y)
    ctx.rotate(-0.5)
    ctx.strokeStyle = hexAlpha(color, 0.5)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(0, 0, b.r * 1.7, b.r * 0.5, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
  ctx.globalCompositeOperation = 'lighter'
  if (drop.trail.length > 1) {
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const n = drop.trail.length
    for (let i = 1; i < n; i++) {
      const a = drop.trail[i - 1]
      const c = drop.trail[i]
      const k = i / n
      // Teleports never leave a misleading straight line across the whole machine.
      if (Math.hypot(c.x - a.x, c.y - a.y) > 150) continue
      ctx.strokeStyle = hexAlpha(color, k * (surge ? .75 : .5))
      ctx.lineWidth = k * b.r * 1.5
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(c.x, c.y)
      ctx.stroke()
      ctx.strokeStyle = hexAlpha('#ffffff', k * 0.55)
      ctx.lineWidth = Math.max(0.5, k * b.r * 0.24)
      ctx.stroke()
    }
    const head = drop.trail[n - 1]
    if (Math.hypot(b.x - head.x, b.y - head.y) <= 150) {
      ctx.strokeStyle = hexAlpha(color, 0.5)
      ctx.lineWidth = b.r * 1.5
      ctx.beginPath()
      ctx.moveTo(head.x, head.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
  }
  const heat = Math.min(1, drop.combo / 12)
  glow(ctx, color, b.x, b.y, b.r * (3.2 + heat * 2), 0.4 + heat * 0.4)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'

  ctx.save()
  ctx.translate(b.x, b.y)
  const squash = drop.squash
  ctx.rotate(drop.squashAng)
  ctx.scale(1 + squash, 1 - squash * 0.8)
  ctx.rotate(-drop.squashAng)
  const g = ctx.createRadialGradient(-b.r * 0.35, -b.r * 0.4, 1, 0, 0, b.r)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.28, drop.ballDef.accent)
  g.addColorStop(0.62, drop.ballDef.color)
  g.addColorStop(1, drop.ballDef.core)
  ctx.beginPath()
  ctx.arc(0, 0, b.r, 0, Math.PI * 2)
  ctx.fillStyle = g
  ctx.fill()
  if (drop.ballDef.id === 'prism') {
    ctx.save()
    ctx.clip()
    ctx.rotate(drop.spin * 0.4)
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3
      ctx.beginPath()
      ctx.moveTo(-b.r * 0.2, -b.r * 0.2)
      ctx.lineTo(Math.cos(a) * b.r, Math.sin(a) * b.r)
      ctx.lineTo(Math.cos(a + Math.PI / 3) * b.r, Math.sin(a + Math.PI / 3) * b.r)
      ctx.closePath()
      ctx.fillStyle = i % 2 ? '#ffffff40' : '#06394b44'
      ctx.fill()
    }
    ctx.restore()
    // Restore the circular clipping path used by the rolling seam below.
    ctx.beginPath()
    ctx.arc(0, 0, b.r, 0, Math.PI * 2)
  }
  // A seam that rolls with the sphere so spin reads.
  ctx.save()
  ctx.clip()
  ctx.rotate(drop.spin)
  ctx.strokeStyle = hexAlpha(drop.ballDef.core, 0.45)
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.ellipse(0, 0, b.r * 0.95, b.r * 0.35, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
  ctx.beginPath()
  ctx.arc(0, 0, b.r, 0, Math.PI * 2)
  ctx.strokeStyle = hexAlpha('#ffffff', 0.3)
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.beginPath()
  ctx.ellipse(-b.r * 0.35, -b.r * 0.42, b.r * 0.28, b.r * 0.17, -0.6, 0, Math.PI * 2)
  ctx.fill()
  if (drop.armedRebound) {
    ctx.strokeStyle = hexAlpha('#ffffff', 0.6 + Math.sin(time * 18) * 0.3)
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(0, 0, b.r + 3, 0, Math.PI * 2)
    ctx.stroke()
  }
  if (drop.tiltT > 0) {
    ctx.strokeStyle = hexAlpha(drop.ballDef.accent, 0.8)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, b.r + 5, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
  if (drop.combo >= 2) {
    // One orbiting segment per combo step.
    const segs = Math.min(12, drop.combo)
    const rr = b.r + 8
    ctx.strokeStyle = hexAlpha(heat > 0.6 ? '#ffd56a' : color, 0.5 + heat * 0.5)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    for (let i = 0; i < segs; i++) {
      const a = time * 4 + (i / segs) * Math.PI * 2
      ctx.beginPath()
      ctx.arc(b.x, b.y, rr, a, a + (Math.PI * 2) / segs - 0.25)
      ctx.stroke()
    }
  }
}

function drawFloaters(ctx: CanvasRenderingContext2D, floaters: Floater[]) {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  for (const f of floaters) {
    const k = 1 - f.life / f.max
    const pop = k < 0.14 ? 1 + (1 - k / 0.14) * 0.7 : 1
    const size = (f.size ?? 18) * pop
    const left = f.life / f.max
    ctx.globalAlpha = left < 0.35 ? left / 0.35 : 1
    ctx.font = `800 ${size.toFixed(1)}px Outfit, sans-serif`
    ctx.lineWidth = Math.max(3, size * 0.22)
    ctx.strokeStyle = 'rgba(8,6,4,0.85)'
    ctx.strokeText(f.text, f.x, f.y)
    ctx.fillStyle = f.color
    ctx.fillText(f.text, f.x, f.y)
  }
  ctx.globalAlpha = 1
  ctx.textBaseline = 'alphabetic'
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = parseHex(a)
  const [r2, g2, b2] = parseHex(b)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const bl = Math.round(b1 + (b2 - b1) * t)
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`
}

function hexAlpha(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex)
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`
}
