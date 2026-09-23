import { PALETTE, type Palette } from './palette'
import type { Cam } from './camera'
import { gapCenter, pegPose, shutterWalls, type Board } from '../sim/board'
import type { Drop } from '../sim/drop'

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  color: string
  size: number
}

export interface Floater {
  x: number
  y: number
  text: string
  life: number
  max: number
  color: string
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
  particlesOn: boolean
  trailColor: string
  time: number
  hitboxes: boolean
}

const sprites = new Map<string, HTMLCanvasElement>()

function pegSprite(pal: Palette, kind: 'normal' | 'gold' | 'reinforced'): HTMLCanvasElement {
  const key = `${pal.peg}:${kind}`
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
  g.arc(cx, cy + 3, r, 0, Math.PI * 2)
  g.fillStyle = 'rgba(0,0,0,0.28)'
  g.fill()
  const body = g.createRadialGradient(cx - 5, cy - 6, 2, cx, cy, r)
  if (kind === 'gold') {
    body.addColorStop(0, '#fff6d0')
    body.addColorStop(0.45, pal.gold)
    body.addColorStop(1, '#a36b12')
  } else if (kind === 'reinforced') {
    body.addColorStop(0, '#ffffff')
    body.addColorStop(0.4, pal.steel)
    body.addColorStop(1, '#5c6770')
  } else {
    body.addColorStop(0, '#ffffff')
    body.addColorStop(0.42, pal.peg)
    body.addColorStop(1, pal.pegDeep)
  }
  g.beginPath()
  g.arc(cx, cy, r, 0, Math.PI * 2)
  g.fillStyle = body
  g.fill()
  g.beginPath()
  g.arc(cx, cy, r - 1.5, 0, Math.PI * 2)
  g.strokeStyle = 'rgba(255,255,255,0.35)'
  g.lineWidth = 1.5
  g.stroke()
  if (kind === 'gold') {
    g.strokeStyle = '#6a3e08'
    g.lineWidth = 1.6
    g.beginPath()
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i + Math.PI / 4
      g.moveTo(cx, cy)
      g.lineTo(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8)
    }
    g.stroke()
  } else if (kind === 'reinforced') {
    g.strokeStyle = 'rgba(40,48,56,0.7)'
    g.lineWidth = 2
    g.beginPath()
    g.arc(cx, cy, 8, 0, Math.PI * 2)
    g.stroke()
  } else {
    g.fillStyle = 'rgba(255,255,255,0.55)'
    g.beginPath()
    g.ellipse(cx - 5, cy - 6, 4, 3, -0.6, 0, Math.PI * 2)
    g.fill()
  }
  sprites.set(key, c)
  return c
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

export function drawFrame(input: DrawInput): void {
  const { ctx, cssW, cssH, dpr, cam, board } = input
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssW, cssH)
  const pal = PALETTE[board?.theme ?? 'workshop']
  drawBackdrop(ctx, cssW, cssH, pal, input.time)
  if (!board || !input.drop) return
  ctx.save()
  ctx.translate(cssW / 2 + cam.shakeX, cssH / 2 + cam.shakeY)
  ctx.scale(cam.scale * cam.zoom, cam.scale * cam.zoom)
  ctx.translate(-cam.boardW / 2, -cam.camY)
  drawBoard(ctx, board, input.drop, pal, input)
  ctx.restore()
}

function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, pal: Palette, time: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, pal.bg0)
  g.addColorStop(1, pal.bg1)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.save()
  ctx.translate(w * 0.18, h * 0.62)
  ctx.rotate(time * 0.05)
  strokeGear(ctx, 180, pal.frame, 0.06)
  ctx.restore()
  ctx.save()
  ctx.translate(w * 0.86, h * 0.3)
  ctx.rotate(-time * 0.04)
  strokeGear(ctx, 120, pal.accent, 0.05)
  ctx.restore()
  const glow = ctx.createRadialGradient(w / 2, h * 0.45, 40, w / 2, h * 0.5, w * 0.45)
  glow.addColorStop(0, hexAlpha(pal.accent, 0.05))
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)
}

function strokeGear(ctx: CanvasRenderingContext2D, r: number, color: string, alpha: number) {
  ctx.beginPath()
  const teeth = 12
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2
    const a1 = ((i + 0.35) / teeth) * Math.PI * 2
    const a2 = ((i + 0.65) / teeth) * Math.PI * 2
    ctx.lineTo(Math.cos(a0) * r, Math.sin(a0) * r)
    ctx.lineTo(Math.cos(a1) * (r + 16), Math.sin(a1) * (r + 16))
    ctx.lineTo(Math.cos(a2) * (r + 16), Math.sin(a2) * (r + 16))
  }
  ctx.closePath()
  ctx.strokeStyle = hexAlpha(color, alpha)
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2)
  ctx.stroke()
}

function drawBoard(ctx: CanvasRenderingContext2D, board: Board, drop: Drop, pal: Palette, input: DrawInput) {
  roundRect(ctx, 36, 18, board.w - 72, board.h - 28, 28)
  ctx.fillStyle = pal.felt
  ctx.fill()
  ctx.lineWidth = 10
  ctx.strokeStyle = pal.frameDeep
  ctx.stroke()
  ctx.lineWidth = 3
  ctx.strokeStyle = pal.frame
  ctx.stroke()

  for (let y = 80; y < board.h; y += 140) {
    ctx.beginPath()
    ctx.arc(48, y, 3.5, 0, Math.PI * 2)
    ctx.arc(board.w - 48, y, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = pal.frame
    ctx.fill()
  }

  drawChute(ctx, board, pal)
  drawBins(ctx, board, drop, pal)
  drawZones(ctx, board, pal, input.time)
  drawShutter(ctx, board, drop, pal)

  for (let i = 0; i < board.pegs.length; i++) {
    if (drop.gone[i]) continue
    const peg = board.pegs[i]
    const pose = pegPose(peg, drop.time, board.boss && drop.coreHits >= 2 ? 2.1 : 1)
    if (peg.motion) {
      ctx.strokeStyle = hexAlpha(pal.steel, 0.35)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(peg.x - peg.motion.amp, peg.y)
      ctx.lineTo(peg.x + peg.motion.amp, peg.y)
      ctx.stroke()
    }
    const vanishing = drop.vanish[i] > 0
    ctx.save()
    ctx.globalAlpha = vanishing ? 0.25 + 0.2 * Math.sin(input.time * 16) : 1
    const kind = peg.kind === 'gold' || drop.gilded[i] ? 'gold' : peg.kind === 'reinforced' ? 'reinforced' : 'normal'
    const sprite = pegSprite(pal, kind)
    const size = peg.r * 3.3
    ctx.drawImage(sprite, pose.x - size / 2, pose.y - size / 2, size, size)
    if (peg.kind === 'vanish' && !vanishing) {
      ctx.strokeStyle = hexAlpha(pal.accent, 0.8)
      ctx.setLineDash([3, 3])
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(pose.x, pose.y, peg.r + 5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }
    if (drop.flashPeg[i] > 0) {
      ctx.globalAlpha = drop.flashPeg[i]
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(pose.x, pose.y, peg.r, 0, Math.PI * 2)
      ctx.fill()
    }
    if (drop.critPeg === i) {
      ctx.globalAlpha = 0.9
      ctx.strokeStyle = pal.gold
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(pose.x, pose.y, peg.r + 8 + Math.sin(input.time * 8) * 2, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
    if (input.hitboxes) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.strokeRect(pose.x - peg.r, pose.y - peg.r, peg.r * 2, peg.r * 2)
    }
  }

  for (const b of board.bumpers) {
    if (b.core && drop.coreOpen) {
      ctx.strokeStyle = hexAlpha(pal.gold, 0.8)
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
      ctx.stroke()
      continue
    }
    ctx.beginPath()
    ctx.arc(b.x, b.y + 4, b.r, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
    ctx.fillStyle = pal.frameDeep
    ctx.fill()
    ctx.lineWidth = b.core ? 8 : 7
    ctx.strokeStyle = b.core ? pal.accent : pal.frame
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r * 0.55, 0, Math.PI * 2)
    ctx.fillStyle = pal.felt
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.stroke()
    if (b.core) {
      ctx.strokeStyle = pal.bg0
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.r * 0.45, 0, Math.PI * 2)
      ctx.stroke()
      for (let c = 0; c < drop.coreHits; c++) {
        ctx.beginPath()
        ctx.moveTo(b.x, b.y)
        const a = -Math.PI / 2 + c * 1.1
        ctx.lineTo(b.x + Math.cos(a) * b.r * 0.85, b.y + Math.sin(a) * b.r * 0.85)
        ctx.stroke()
      }
    }
  }

  if (input.aiming && input.preview.length) {
    for (let i = 0; i < input.preview.length; i++) {
      const p = input.preview[i]
      const t = 1 - i / input.preview.length
      ctx.globalAlpha = t * 0.55
      ctx.fillStyle = pal.accent
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2.2 + t * 1.4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    const a = input.aimAngle
    ctx.strokeStyle = hexAlpha(pal.accent, 0.7)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(drop.ball.x, drop.ball.y)
    ctx.lineTo(drop.ball.x + Math.sin(a) * 70, drop.ball.y + Math.cos(a) * 70)
    ctx.stroke()
  }

  if (input.particlesOn) {
    for (const p of input.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max)
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  drawBall(ctx, drop, input.trailColor, input.time)

  ctx.font = '600 18px Outfit, sans-serif'
  ctx.textAlign = 'center'
  for (const f of input.floaters) {
    ctx.globalAlpha = Math.max(0, f.life / f.max)
    ctx.fillStyle = f.color
    ctx.fillText(f.text, f.x, f.y)
  }
  ctx.globalAlpha = 1
}

function drawChute(ctx: CanvasRenderingContext2D, board: Board, pal: Palette) {
  ctx.strokeStyle = hexAlpha(pal.frame, 0.55)
  ctx.lineWidth = 6
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(board.launchX - 34, 28)
  ctx.quadraticCurveTo(board.launchX - 80, 90, board.margin + 20, 150)
  ctx.moveTo(board.launchX + 34, 28)
  ctx.quadraticCurveTo(board.launchX + 80, 90, board.w - board.margin - 20, 150)
  ctx.stroke()
}

function drawBins(ctx: CanvasRenderingContext2D, board: Board, drop: Drop, pal: Palette) {
  for (const bin of board.bins) {
    const hot = drop.captured && drop.ball.x >= bin.x0 && drop.ball.x <= bin.x1
    let color = 'rgba(0,0,0,0.18)'
    if (bin.kind === 'hazard') color = hexAlpha(pal.danger, hot ? 0.45 : 0.18)
    else if (bin.kind === 'bonus') color = hexAlpha(pal.accent, hot ? 0.4 : 0.14)
    else if (bin.kind === 'jackpot') color = hexAlpha(pal.gold, hot ? 0.5 : 0.2)
    else color = hexAlpha(pal.frame, hot ? 0.35 : 0.1)
    ctx.fillStyle = color
    ctx.fillRect(bin.x0, board.floorY, bin.x1 - bin.x0, 120)
    if (bin.kind === 'hazard') {
      ctx.fillStyle = pal.danger
      const mid = (bin.x0 + bin.x1) / 2
      for (let i = -1; i <= 1; i++) {
        const x = mid + i * 14
        ctx.beginPath()
        ctx.moveTo(x - 6, board.floorY + 96)
        ctx.lineTo(x, board.floorY + 78)
        ctx.lineTo(x + 6, board.floorY + 96)
        ctx.fill()
      }
    }
    if (bin.kind === 'jackpot') {
      ctx.fillStyle = pal.gold
      ctx.font = '700 14px Outfit, sans-serif'
      ctx.textAlign = 'center'
      ctx.globalAlpha = 0.8
      ctx.fillText(drop.coreOpen || !board.boss ? 'MAW' : 'SEAL', (bin.x0 + bin.x1) / 2, board.floorY + 28)
      ctx.globalAlpha = 1
    }
  }
}

function drawZones(ctx: CanvasRenderingContext2D, board: Board, pal: Palette, time: number) {
  for (const z of board.zones) {
    if (z.kind === 'well') {
      ctx.save()
      ctx.translate(z.x, z.y)
      ctx.rotate(time * 0.6)
      ctx.strokeStyle = hexAlpha(pal.well, 0.65)
      ctx.lineWidth = 2
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.arc(0, 0, z.r * (0.35 + i * 0.22), 0.2, Math.PI * 1.4)
        ctx.stroke()
      }
      ctx.restore()
      ctx.fillStyle = hexAlpha(pal.well, 0.12)
      ctx.beginPath()
      ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2)
      ctx.fill()
      drawArrow(ctx, z.x, z.y, 0, 10, pal.well)
    } else if (z.kind === 'portal') {
      ctx.strokeStyle = pal.accent
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(z.x, z.y, z.r, time, time + Math.PI * 1.4)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(z.x, z.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = pal.accent
      ctx.fill()
    } else if (z.kind === 'spike') {
      ctx.fillStyle = pal.danger
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        const bx = z.x + Math.cos(a) * 4
        const by = z.y + Math.sin(a) * 4
        ctx.beginPath()
        ctx.moveTo(bx + Math.cos(a) * z.r, by + Math.sin(a) * z.r)
        ctx.lineTo(bx + Math.cos(a + 0.4) * 6, by + Math.sin(a + 0.4) * 6)
        ctx.lineTo(bx + Math.cos(a - 0.4) * 6, by + Math.sin(a - 0.4) * 6)
        ctx.fill()
      }
    } else if (z.kind === 'spring') {
      ctx.strokeStyle = pal.accent
      ctx.lineWidth = 3
      ctx.beginPath()
      for (let i = 0; i <= 6; i++) {
        const y = z.y - 16 + i * 6
        const x = z.x + (i % 2 === 0 ? -10 : 10)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    } else if (z.kind === 'accel') {
      ctx.fillStyle = hexAlpha(pal.accent, 0.08)
      ctx.fillRect(z.x, z.y, z.w, z.h)
      ctx.strokeStyle = hexAlpha(pal.accent, 0.5)
      ctx.lineWidth = 2
      for (let x = z.x + 16; x < z.x + z.w; x += 28) {
        drawArrow(ctx, x, z.y + z.h / 2, 0, 1, pal.accent)
      }
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

function drawShutter(ctx: CanvasRenderingContext2D, board: Board, drop: Drop, pal: Palette) {
  const walls = shutterWalls(board, drop.gapT)
  if (!walls.length || board.shutterY == null) return
  const c = gapCenter(board, drop.gapT)
  const glow = ctx.createLinearGradient(0, board.shutterY, 0, board.floorY)
  glow.addColorStop(0, hexAlpha(pal.accent, 0.2))
  glow.addColorStop(1, hexAlpha(pal.accent, 0))
  ctx.fillStyle = glow
  ctx.fillRect(c - board.gapWidth / 2, board.shutterY, board.gapWidth, board.floorY - board.shutterY)
  ctx.lineCap = 'round'
  ctx.lineWidth = 16
  ctx.strokeStyle = pal.frame
  for (const w of walls) {
    ctx.beginPath()
    ctx.moveTo(w.x1, w.y1)
    ctx.lineTo(w.x2, w.y2)
    ctx.stroke()
  }
  ctx.lineWidth = 4
  ctx.strokeStyle = pal.frameDeep
  for (const w of walls) {
    ctx.beginPath()
    ctx.moveTo(w.x1, w.y1)
    ctx.lineTo(w.x2, w.y2)
    ctx.stroke()
  }
}

function drawBall(ctx: CanvasRenderingContext2D, drop: Drop, trail: string, time: number) {
  const b = drop.ball
  const color = trail || drop.ballDef.accent
  if (drop.trail.length > 1) {
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (let i = 1; i < drop.trail.length; i++) {
      const a = drop.trail[i - 1]
      const c = drop.trail[i]
      ctx.strokeStyle = hexAlpha(color, (i / drop.trail.length) * 0.45)
      ctx.lineWidth = (i / drop.trail.length) * b.r * 0.7
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(c.x, c.y)
      ctx.stroke()
    }
  }
  ctx.save()
  ctx.translate(b.x, b.y)
  const squash = drop.squash
  ctx.rotate(drop.squashAng)
  ctx.scale(1 + squash, 1 - squash * 0.8)
  ctx.rotate(drop.spin)
  ctx.beginPath()
  ctx.ellipse(0, b.r * 0.75, b.r * 0.7, b.r * 0.22, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.fill()
  const g = ctx.createRadialGradient(-b.r * 0.35, -b.r * 0.4, 2, 0, 0, b.r)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.28, drop.ballDef.accent)
  g.addColorStop(0.62, drop.ballDef.color)
  g.addColorStop(1, drop.ballDef.core)
  ctx.beginPath()
  ctx.arc(0, 0, b.r, 0, Math.PI * 2)
  ctx.fillStyle = g
  ctx.fill()
  if (drop.armedRebound) {
    ctx.strokeStyle = hexAlpha('#ffffff', 0.6 + Math.sin(time * 18) * 0.3)
    ctx.lineWidth = 2
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
    ctx.strokeStyle = hexAlpha(color, 0.35 + Math.min(0.5, drop.combo * 0.03))
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r + 7 + (drop.combo % 4), 0, Math.PI * 2)
    ctx.stroke()
  }
}

function hexAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${a})`
}
