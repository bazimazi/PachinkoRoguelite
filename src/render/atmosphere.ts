import type { Palette } from './palette'
import type { BallDef } from '../content/catalog'
import type { Board } from '../sim/board'

const TAU = Math.PI * 2
const noise = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v) }

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
}

function halo(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, color)
  g.addColorStop(1, 'transparent')
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

/** Quiet, deterministic scenery. No random work or large allocations per frame. */
export function drawAtmosphere(ctx: CanvasRenderingContext2D, w: number, h: number, pal: Palette, time: number, particles: boolean) {
  ctx.save()
  const bg = ctx.createLinearGradient(0, 0, w, h)
  bg.addColorStop(0, pal.bg0)
  bg.addColorStop(0.55, pal.bg1)
  bg.addColorStop(1, '#03090f')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  halo(ctx, w * 0.7, h * 0.4, Math.max(w, h) * 0.58, pal.accent + '16')
  halo(ctx, w * 0.1, h * 0.92, h * 0.65, pal.well + '12')
  // Architectural ribs create depth without competing with the board.
  ctx.strokeStyle = pal.frame + '0d'
  ctx.lineWidth = 1
  for (let i = 0; i < 5; i++) {
    const x = w * (0.12 + i * 0.2)
    ctx.beginPath()
    ctx.moveTo(x, h)
    ctx.lineTo(x, h * 0.26)
    ctx.bezierCurveTo(x, -h * 0.1, w - x, -h * 0.1, w - x, h * 0.26)
    ctx.stroke()
  }
  ctx.save()
  ctx.translate(w * 0.7, h * 0.43)
  ctx.rotate(-0.22)
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = pal.accent + (i % 2 ? '0b' : '12')
    ctx.beginPath()
    ctx.ellipse(0, 0, w * (0.2 + i * 0.11), h * (0.2 + i * 0.13), 0, 0, TAU)
    ctx.stroke()
  }
  ctx.restore()
  if (particles) {
    for (let i = 0; i < 75; i++) {
      const x = (noise(i) * w + Math.sin(time * 0.12 + i) * 12 + w) % w
      const y = ((noise(i + 80) * h - time * (2 + noise(i + 30) * 9)) % h + h) % h
      const a = 0.12 + noise(i + 200) * 0.32 * (0.6 + Math.sin(time + i) * 0.4)
      ctx.globalAlpha = a
      ctx.fillStyle = i % 4 ? pal.accent : pal.gold
      const r = 0.5 + noise(i + 10) * 1.3
      circle(ctx, x, y, r)
      ctx.fill()
      if (i % 11 === 0) {
        ctx.fillRect(x - 4, y - 0.4, 8, 0.8)
        ctx.fillRect(x - 0.4, y - 4, 0.8, 8)
      }
    }
  }
  ctx.restore()
}

/** A living astrolabe on the title screen, colored by the selected sphere. */
export function drawAstrolabe(ctx: CanvasRenderingContext2D, w: number, h: number, ball: BallDef, time: number) {
  const compact = w < 760
  const x = w * (compact ? 0.82 : 0.71)
  const y = compact ? 180 : Math.min(h * 0.36, h - 335)
  const r = Math.max(72, Math.min(w * 0.15, h * 0.24, 206))
  ctx.save()
  ctx.translate(x, y)
  if (compact) ctx.globalAlpha = 0.35
  halo(ctx, 0, 0, r * 2.5, ball.accent + '22')
  const bob = Math.sin(time * 0.7) * 7
  ctx.translate(0, bob)
  // Fine dial, minute marks and slowly rotating gold arcs.
  for (let i = 0; i < 3; i++) {
    circle(ctx, 0, 0, r * (1.18 + i * 0.17))
    ctx.strokeStyle = i === 1 ? '#c8a46d55' : '#94d9ce20'
    ctx.lineWidth = i === 1 ? 2 : 1
    ctx.stroke()
  }
  ctx.save()
  ctx.rotate(time * 0.035)
  for (let i = 0; i < 72; i++) {
    const a = i / 72 * TAU
    const major = i % 6 === 0
    ctx.strokeStyle = major ? '#edcd9177' : '#edcd9126'
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * r * 1.48, Math.sin(a) * r * 1.48)
    ctx.lineTo(Math.cos(a) * r * (major ? 1.57 : 1.52), Math.sin(a) * r * (major ? 1.57 : 1.52))
    ctx.stroke()
  }
  ctx.restore()
  // Tilted orbits pass behind the specimen, with luminous satellites.
  for (let j = 0; j < 3; j++) {
    ctx.save()
    ctx.rotate(-0.5 + j * 1.05 + Math.sin(time * 0.12) * 0.08)
    ctx.strokeStyle = j === 1 ? '#e8c88d80' : '#90e9db55'
    ctx.lineWidth = j === 1 ? 2 : 1
    ctx.beginPath()
    ctx.ellipse(0, 0, r * 1.83, r * 0.61, 0, 0, TAU)
    ctx.stroke()
    const a = time * (0.18 + j * 0.05) + j * 2.2
    const sx = Math.cos(a) * r * 1.83, sy = Math.sin(a) * r * 0.61
    halo(ctx, sx, sy, 22, '#ffe0a155')
    circle(ctx, sx, sy, j === 1 ? 5 : 3)
    ctx.fillStyle = '#fff0c8'
    ctx.fill()
    ctx.restore()
  }
  // Layered sphere: deep limb, lit face, reflected light and glass caustic.
  ctx.save()
  circle(ctx, 0, 0, r * 0.82)
  ctx.shadowColor = ball.color + '65'
  ctx.shadowBlur = 60
  const body = ctx.createRadialGradient(-r * 0.32, -r * 0.4, 0, r * 0.1, r * 0.12, r)
  body.addColorStop(0, '#fff9e7')
  body.addColorStop(0.14, ball.accent)
  body.addColorStop(0.38, ball.color)
  body.addColorStop(0.75, ball.core)
  body.addColorStop(1, '#03090f')
  ctx.fillStyle = body
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.clip()
  // Each specimen has a different material, not just a different tint.
  if (ball.id === 'prism') {
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU + Math.sin(time * 0.16) * 0.1
      ctx.beginPath()
      ctx.moveTo(-r * 0.15, -r * 0.1)
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
      ctx.lineTo(Math.cos(a + TAU / 8) * r, Math.sin(a + TAU / 8) * r)
      ctx.closePath()
      ctx.fillStyle = i % 2 ? '#ddffff25' : '#073c6238'
      ctx.fill()
      ctx.strokeStyle = '#f1ffff33'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  } else if (ball.id === 'void') {
    const eclipse = ctx.createRadialGradient(r * 0.05, r * 0.03, r * 0.2, 0, 0, r * 0.79)
    eclipse.addColorStop(0, '#020410')
    eclipse.addColorStop(0.72, '#090c28ee')
    eclipse.addColorStop(1, '#9691ef00')
    ctx.fillStyle = eclipse
    circle(ctx, 0, 0, r * 0.81)
    ctx.fill()
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.ellipse(0, 0, r * (0.45 + i * 0.12), r * 0.22, time * 0.08 + i * 0.15 - 0.5, 0, TAU)
      ctx.strokeStyle = '#b0aaff35'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  } else for (let i = 0; i < 7; i++) {
    ctx.save()
    ctx.rotate(-0.5 + Math.sin(time * 0.22) * 0.15)
    ctx.strokeStyle = i % 2 ? '#fff3d51c' : ball.core + '35'
    ctx.lineWidth = i % 2 ? 1 : 9
    ctx.beginPath()
    ctx.ellipse(r * 0.16, r * (i * 0.18 - 0.65), r * 0.9, r * 0.35, 0, 0, TAU)
    ctx.stroke()
    ctx.restore()
  }
  halo(ctx, r * 0.6, r * 0.3, r * 0.65, '#70fbe766')
  ctx.restore()
  circle(ctx, 0, 0, r * 0.82)
  ctx.strokeStyle = ball.accent + 'aa'
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(-r * 0.3, -r * 0.41, r * 0.24, r * 0.075, -0.55, 0, TAU)
  ctx.fillStyle = '#ffffff77'
  ctx.fill()
  // Foreground brass crescent gives the instrument real occlusion and depth.
  ctx.save()
  ctx.rotate(-0.5)
  ctx.beginPath()
  ctx.ellipse(0, 0, r * 1.83, r * 0.61, 0, 0.08, Math.PI - 0.08)
  ctx.strokeStyle = '#ebc98bb0'
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.restore()
  ctx.restore()
}

const engravings = new Map<string, HTMLCanvasElement>()

/** Cached cabinet engraving: static details are painted only once per board size/theme. */
export function drawEngraving(ctx: CanvasRenderingContext2D, board: Board, pal: Palette, time: number) {
  const key = `${board.theme}:${board.w}:${board.h}`
  let layer = engravings.get(key)
  if (!layer) {
    layer = document.createElement('canvas')
    layer.width = board.w
    layer.height = board.h
    const g = layer.getContext('2d')!
    g.save()
    g.strokeStyle = pal.accent + '13'
    g.lineWidth = 1
    for (let y = 170; y < board.floorY; y += 220) {
      g.save()
      g.translate(board.w / 2, y)
      for (const r of [70, 116, 125]) { circle(g, 0, 0, r); g.stroke() }
      g.rotate(Math.PI / 4)
      g.strokeRect(-83, -83, 166, 166)
      g.restore()
    }
    for (const x of [68, board.w - 68]) {
      g.strokeStyle = pal.frame + '40'
      g.beginPath()
      g.moveTo(x, 90)
      g.lineTo(x, board.h - 70)
      g.stroke()
      for (let y = 100; y < board.h - 60; y += 24) {
        g.fillStyle = pal.frame + '40'
        g.fillRect(x - 3, y, 6, 1)
      }
    }
    g.font = '10px Outfit, sans-serif'
    g.textAlign = 'center'
    g.fillStyle = pal.frame + '70'
    g.fillText('H E L I X   /   G R A V I T A T I O N A L   E N G I N E', board.w / 2, board.h - 37)
    g.restore()
    // Bound the cache even if future procedural layouts introduce many sizes.
    if (engravings.size >= 12) engravings.delete(engravings.keys().next().value!)
    engravings.set(key, layer)
  }
  ctx.drawImage(layer, 0, 0)
  ctx.save()
  // Traveling rail lights give the machine a constant sense of downward energy.
  for (let j = 0; j < 2; j++) {
    const x = j ? board.w - 49 : 49
    for (let i = 0; i < 14; i++) {
      const y = 90 + i * (board.h - 170) / 14
      const pulse = 0.3 + 0.7 * Math.pow((Math.sin(time * 2.5 - i * 0.6) + 1) / 2, 3)
      ctx.fillStyle = pal.accent
      ctx.globalAlpha = pulse
      ctx.fillRect(x - 1.5, y, 3, 12)
    }
  }
  ctx.restore()
}
