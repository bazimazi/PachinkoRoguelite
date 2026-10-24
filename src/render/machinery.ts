import type { Board } from '../sim/board'
import type { Drop } from '../sim/drop'
import type { Palette } from './palette'

const TAU = Math.PI * 2
const layers = new Map<string, HTMLCanvasElement>()

function circle(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath(); g.arc(x, y, r, 0, TAU)
}

function panel(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 8) {
  g.beginPath(); g.roundRect(x, y, w, h, r)
}

/** The machinery is recessed scenery, never a physical obstacle. Cached at native board size. */
export function drawMachineRelief(ctx: CanvasRenderingContext2D, board: Board, pal: Palette) {
  const key = `${board.theme}:${board.w}:${board.h}`
  let layer = layers.get(key)
  if (!layer) {
    layer = document.createElement('canvas')
    layer.width = board.w; layer.height = board.h
    const g = layer.getContext('2d')!
    const cx = board.w / 2
    g.save()
    panel(g, 43, 25, board.w - 86, board.h - 42, 23); g.clip()

    // Light is caught by the bevels of dark glass panels, not a flat wallpaper.
    for (let row = 0, y = 130; y < board.floorY; row++, y += 196) {
      const surface = g.createLinearGradient(90, y, cx, y + 180)
      surface.addColorStop(0, pal.accent + '0c')
      surface.addColorStop(0.47, '#ffffff02')
      surface.addColorStop(1, '#00000035')
      panel(g, 85, y, board.w - 170, 182, 15)
      g.fillStyle = surface; g.fill()
      g.strokeStyle = pal.frame + '12'; g.lineWidth = 1; g.stroke()
      g.fillStyle = pal.frame + '30'
      g.font = '9px monospace'; g.textAlign = 'left'
      g.fillText(`0${row + 1} / ${board.theme === 'foundry' ? 'HEAT SINK' : board.theme === 'gravity' ? 'FIELD ARRAY' : board.theme === 'grinder' ? 'SEAL ARRAY' : 'RESONANCE'}`, 102, y + 18)
      // Micro-perforation lends material scale without expensive frame-time noise.
      for (let xx = 104; xx < board.w - 100; xx += 18) {
        g.fillStyle = '#00000035'; g.fillRect(xx, y + 168, 2, 2)
      }
    }

    if (board.theme === 'workshop') {
      // The conservatory: overlapping Art Deco vaults and botanical copper tracery.
      g.lineWidth = 3
      for (let j = 0; j < 3; j++) {
        const left = 105 + j * 30, right = board.w - left
        g.strokeStyle = pal.frame + (j ? '0e' : '21')
        g.beginPath(); g.moveTo(left, board.floorY)
        g.lineTo(left, 275 + j * 30)
        g.bezierCurveTo(left, 105, cx, 105, cx, 190)
        g.bezierCurveTo(cx, 105, right, 105, right, 275 + j * 30)
        g.lineTo(right, board.floorY); g.stroke()
      }
      for (const side of [-1, 1]) {
        g.save(); g.translate(cx, 0); g.scale(side, 1)
        g.strokeStyle = pal.accent + '16'; g.lineWidth = 1.2
        for (let y = 310; y < board.floorY - 80; y += 170) {
          g.beginPath(); g.moveTo(155, y + 85)
          g.bezierCurveTo(115, y + 30, 96, y + 15, 80, y)
          g.bezierCurveTo(147, y - 5, 184, y + 40, 155, y + 85); g.stroke()
        }
        g.restore()
      }
    } else if (board.theme === 'foundry') {
      // The foundry: beveled cooling fins and a pressure vessel behind the pin field.
      for (const side of [-1, 1]) {
        g.save(); g.translate(cx, 0); g.scale(side, 1)
        for (let y = 175; y < board.floorY - 80; y += 54) {
          const fin = g.createLinearGradient(125, y, 225, y + 16)
          fin.addColorStop(0, '#00000000'); fin.addColorStop(.65, pal.frame + '16'); fin.addColorStop(1, '#00000044')
          g.fillStyle = fin; g.beginPath()
          g.moveTo(118, y); g.lineTo(222, y + 20); g.lineTo(222, y + 28); g.lineTo(118, y + 8); g.fill()
        }
        g.strokeStyle = pal.frame + '24'; g.lineWidth = 3
        g.beginPath(); g.moveTo(246, 140); g.lineTo(246, board.floorY - 110)
        g.quadraticCurveTo(246, board.floorY - 60, 185, board.floorY - 60); g.stroke()
        g.restore()
      }
      g.fillStyle = pal.danger + '08'
      panel(g, cx - 38, 165, 76, board.floorY - 230, 38); g.fill()
      g.strokeStyle = pal.frame + '16'; g.lineWidth = 2; g.stroke()
    } else {
      // Gravity and the final engine use nested, broken field lenses, not the same engraving.
      const cy = board.boss ? 620 : board.h * .47
      const radii = board.theme === 'grinder' ? [112, 142, 225, 292] : [122, 182, 240, 300]
      for (let i = 0; i < radii.length; i++) {
        const r = radii[i]
        g.save(); g.translate(cx, cy); g.rotate(i * .34)
        g.lineWidth = i % 2 ? 6 : 2; g.strokeStyle = pal.accent + (i % 2 ? '10' : '22')
        for (let k = 0; k < 3; k++) {
          g.beginPath(); g.arc(0, 0, r, k * TAU / 3, k * TAU / 3 + 1.75); g.stroke()
        }
        g.restore()
      }
      g.strokeStyle = pal.frame + '15'; g.lineWidth = 1
      for (let y = 150; y < board.floorY; y += 70) {
        g.beginPath(); g.moveTo(cx, y - 20); g.lineTo(cx + 45, y + 15)
        g.lineTo(cx, y + 50); g.lineTo(cx - 45, y + 15); g.closePath(); g.stroke()
      }
    }

    // Outer rack-and-pinion rails create a physical silhouette across all viewports.
    for (const x of [58, board.w - 58]) {
      const rail = g.createLinearGradient(x - 10, 0, x + 10, 0)
      rail.addColorStop(0, '#02080d'); rail.addColorStop(.5, pal.frameDeep); rail.addColorStop(1, '#02080d')
      panel(g, x - 11, 148, 22, board.floorY - 165, 8); g.fillStyle = rail; g.fill()
      g.strokeStyle = pal.frame + '36'; g.lineWidth = 1; g.stroke()
      for (let y = 167; y < board.floorY - 36; y += 12) {
        g.fillStyle = pal.frame + '40'; g.fillRect(x - 6, y, 12, 2)
      }
    }
    g.restore()
    if (layers.size >= 12) layers.delete(layers.keys().next().value!)
    layers.set(key, layer)
  }
  ctx.drawImage(layer, 0, 0)
}

/** Cabinet instrumentation follows real simulation state; it cannot influence it. */
export function drawReactor(ctx: CanvasRenderingContext2D, board: Board, drop: Drop, pal: Palette, time: number) {
  ctx.save()
  const active = drop.overdriveTime > 0
  const charge = Math.max(0, Math.min(1, drop.charge))
  // The two vertical reactors are readable even when the launcher has scrolled away.
  for (const x of [58, board.w - 58]) {
    const y = Math.max(180, Math.min(board.floorY - 140, drop.ball.y - 46))
    panel(ctx, x - 8, y, 16, 96, 7); ctx.fillStyle = '#030a10'; ctx.fill()
    ctx.strokeStyle = pal.frame + '80'; ctx.lineWidth = 1.5; ctx.stroke()
    for (let i = 0; i < 5; i++) {
      const lit = active || charge >= (i + 1) / 5 - .001
      ctx.fillStyle = lit ? active ? '#fff1b3' : pal.accent : pal.accent + '20'
      ctx.globalAlpha = active ? .78 + .2 * Math.sin(time * 7 + i) : 1
      panel(ctx, x - 4, y + 77 - i * 16, 8, 11, 2); ctx.fill()
    }
  }
  ctx.globalAlpha = 1
  // A top instrument plate anchors the machine identity and gives launch space hierarchy.
  const title = board.encounter ? board.encounter.name.toUpperCase() : board.boss ? 'THE WORLD ENGINE' : board.theme === 'foundry' ? 'EMBER FOUNDRY' : board.theme === 'gravity' ? 'CELESTIAL VAULT' : 'ASTRAL CONSERVATORY'
  const encounterSubtitle = board.encounter?.id === 'bellkeeper' ? 'THREE BELLS · ONE HARMONY' : 'ALTERNATE THE TWIN RELAYS'
  for (const [x, text, sub] of [
    [board.margin + 15, title, board.encounter ? encounterSubtitle : board.boss ? 'FIVE SEALS · ONE CORE' : 'HELIX / EXPEDITION ENGINE'],
    [board.w - board.margin - 15, active ? 'OVERDRIVE' : drop.overdriveReady ? 'REACTOR READY' : 'REACTOR CHARGE', active ? '×2 CONTACT PAYOUT' : `${Math.round(charge * 100)}% / FIVE CONTACTS`],
  ] as const) {
    ctx.textAlign = x < board.w / 2 ? 'left' : 'right'
    ctx.fillStyle = active ? '#fff1b3' : pal.frame
    ctx.font = '700 12px Outfit, sans-serif'; ctx.fillText(text, x, 57)
    ctx.fillStyle = pal.accent + 'a0'; ctx.font = '8px monospace'; ctx.fillText(sub, x, 73)
  }
  ctx.restore()
}
