import { pegPose, shutterWalls, type Board, type Peg, type Wall } from './board'

export const ANOMALY_IDS = ['gilded', 'fading', 'springtide', 'orbital', 'armored', 'drifting'] as const
export type AnomalyId = typeof ANOMALY_IDS[number]

export interface AnomalyDef {
  id: AnomalyId
  name: string
  description: string
}

export const ANOMALIES: Record<AnomalyId, AnomalyDef> = {
  gilded: { id: 'gilded', name: 'Midas Array', description: 'Extra gold constellations raise the multiplier. Payouts are 12% richer.' },
  fading: { id: 'fading', name: 'Fading Constellation', description: 'Ordinary pegs vanish after a hit, opening fresh lines. Payouts are 8% richer.' },
  springtide: { id: 'springtide', name: 'Spring Tide', description: 'Extra springs return the sphere to the scoring field. Payouts are 8% richer.' },
  orbital: { id: 'orbital', name: 'Orbital Field', description: 'New gravity wells bend the fall toward unexpected lines. Payouts are 10% richer.' },
  armored: { id: 'armored', name: 'Crystal Bloom', description: 'More reinforced pegs pay extra and tame hard impacts. Payouts are 10% richer.' },
  drifting: { id: 'drifting', name: 'Clockwork Drift', description: 'Additional pegs move along gentle tracks. Payouts are 12% richer.' },
}

/** Mutates and returns this generated board. The boss and its return lanes are protected. */
export function applyAnomaly(board: Board, id: AnomalyId, intensity = 1): Board {
  if (board.boss) return board
  const level = Math.max(1, Math.min(4, Number.isFinite(intensity) ? intensity : 1))
  const ordinary = board.pegs
    .map((peg, i) => ({ peg, i }))
    .filter(({ peg }) => peg.kind === 'normal' && !peg.motion)
  // A coprime traversal spreads changes across rows instead of filling the top.
  const spread = ordinary.sort((a, b) => ((a.i * 37 + 11) % 101) - ((b.i * 37 + 11) % 101) || a.i - b.i)
  const amount = Math.min(spread.length, Math.round(5 + level * 3))
  const feature = (name: string) => {
    if (!board.features.includes(name)) board.features.push(name)
  }

  if (id === 'gilded' || id === 'fading' || id === 'armored') {
    const kind: Peg['kind'] = id === 'gilded' ? 'gold' : id === 'fading' ? 'vanish' : 'reinforced'
    for (const { peg } of spread.slice(0, amount)) peg.kind = kind
    feature(id === 'gilded' ? 'gold' : id === 'fading' ? 'vanish' : 'reinforced')
    board.payout *= id === 'gilded' ? 1.12 : id === 'fading' ? 1.08 : 1.1
  } else if (id === 'drifting') {
    const walls = [...board.walls, ...shutterWalls(board, 0), ...shutterWalls(board, 1)]
    let made = 0
    for (const { peg, i } of spread) {
      if (made >= Math.round(4 + level * 2)) break
      const amp = 12 + level * 2
      if (walls.some((wall) => distanceToWall(wall, peg.x, peg.y) < peg.r + wall.r + amp + 34)) continue
      if (board.pegs.some((other) => other !== peg && Math.abs(other.y - peg.y) < peg.r + other.r + 4 && Math.abs(other.x - peg.x) < peg.r + other.r + amp + (other.motion?.amp ?? 0) + 8)) continue
      peg.kind = 'moving'
      peg.motion = { amp, period: 3.2 + (i % 5) * 0.19, phase: i * 0.83, axis: 'x' }
      made++
    }
    if (made) feature('moving')
    board.payout *= 1.12
  } else {
    const top = (board.shutterY ?? board.h * 0.36) + 150
    const maxY = board.floorY - 180
    const candidates = [
      { x: board.w * 0.29, y: top },
      { x: board.w * 0.71, y: Math.min(maxY, top + 210) },
      { x: board.w * 0.48, y: Math.min(maxY, top + 360) },
      { x: board.w * 0.35, y: Math.min(maxY, top + 270) },
      { x: board.w * 0.65, y: top + 65 },
    ]
    let made = 0
    for (const at of candidates) {
      if (made >= Math.min(3, Math.round(level + 1))) break
      if (at.y > maxY) continue
      const rad = id === 'springtide' ? 24 : 100
      const clearance = id === 'springtide' ? rad + 32 : 42
      if (!clearSpot(board, at.x, at.y, clearance)) continue
      if (id === 'springtide') {
        // Remove nearby teeth so the spring cannot form a physical wedge.
        board.pegs = board.pegs.filter((peg) => {
          const p = pegPose(peg, 0, 1)
          return Math.hypot(p.x - at.x, p.y - at.y) > clearance + peg.r + (peg.motion?.amp ?? 0)
        })
        board.zones.push({ kind: 'spring', x: at.x, y: at.y, r: rad })
        feature('spring')
      } else {
        board.zones.push({ kind: 'well', x: at.x, y: at.y, r: rad, strength: 420 + level * 45 })
        feature('well')
      }
      made++
    }
    board.payout *= id === 'springtide' ? 1.08 : 1.1
  }
  board.payout = Math.round(board.payout * 1000) / 1000
  return board
}

function clearSpot(board: Board, x: number, y: number, radius: number): boolean {
  const walls = [...board.walls, ...shutterWalls(board, 0), ...shutterWalls(board, 1)]
  if (walls.some((w) => distanceToWall(w, x, y) < radius + w.r)) return false
  if (board.bumpers.some((b) => Math.hypot(b.x - x, b.y - y) < radius + b.r + 12)) return false
  return !board.zones.some((z) => 'r' in z && Math.hypot(z.x - x, z.y - y) < radius + z.r + 12)
}

function distanceToWall(wall: Wall, x: number, y: number): number {
  const dx = wall.x2 - wall.x1
  const dy = wall.y2 - wall.y1
  const t = Math.max(0, Math.min(1, ((x - wall.x1) * dx + (y - wall.y1) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(x - wall.x1 - dx * t, y - wall.y1 - dy * t)
}
