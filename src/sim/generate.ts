import { irand } from '../core/rng'
import { gapCenter, type Board, type LayoutId, type Peg, type ThemeName } from './board'

interface Spec {
  layout: LayoutId
  title: string
  tutorial: boolean
  rng: () => number
}

interface Profile {
  w: number
  h: number
  theme: ThemeName
  rowGap: number
  colGap: number
  gold: number
  spikes: number
  moving: number
  reinforced: number
  vanish: number
  springs: number
  wells: number
  portals: boolean
  accel: boolean
  bumpers: number
  jackpot: boolean
  payout: number
  gapWidth: number
  boss: boolean
}

const PROFILES: Record<Exclude<LayoutId, 'grinder'>, Profile> = {
  workshop: {
    w: 760,
    h: 1240,
    theme: 'workshop',
    rowGap: 84,
    colGap: 70,
    gold: 5,
    spikes: 0,
    moving: 0,
    reinforced: 0,
    vanish: 0,
    springs: 0,
    wells: 0,
    portals: false,
    accel: false,
    bumpers: 1,
    jackpot: false,
    payout: 1,
    gapWidth: 176,
    boss: false,
  },
  garden: {
    w: 800,
    h: 1500,
    theme: 'workshop',
    rowGap: 72,
    colGap: 62,
    gold: 6,
    spikes: 0,
    moving: 0,
    reinforced: 6,
    vanish: 5,
    springs: 1,
    wells: 0,
    portals: false,
    accel: false,
    bumpers: 1,
    jackpot: false,
    payout: 1,
    gapWidth: 188,
    boss: false,
  },
  furnace: {
    w: 820,
    h: 1620,
    theme: 'foundry',
    rowGap: 64,
    colGap: 58,
    gold: 7,
    spikes: 3,
    moving: 6,
    reinforced: 4,
    vanish: 0,
    springs: 0,
    wells: 0,
    portals: false,
    accel: true,
    bumpers: 1,
    jackpot: false,
    payout: 1.12,
    gapWidth: 176,
    boss: false,
  },
  elite: {
    w: 840,
    h: 1720,
    theme: 'foundry',
    rowGap: 60,
    colGap: 56,
    gold: 7,
    spikes: 4,
    moving: 8,
    reinforced: 12,
    vanish: 0,
    springs: 1,
    wells: 0,
    portals: false,
    accel: true,
    bumpers: 2,
    jackpot: false,
    payout: 1.18,
    gapWidth: 168,
    boss: false,
  },
  ante: {
    w: 800,
    h: 1420,
    theme: 'foundry',
    rowGap: 62,
    colGap: 58,
    gold: 10,
    spikes: 4,
    moving: 4,
    reinforced: 0,
    vanish: 0,
    springs: 0,
    wells: 0,
    portals: false,
    accel: true,
    bumpers: 1,
    jackpot: true,
    payout: 1.3,
    gapWidth: 160,
    boss: false,
  },
  core: {
    w: 820,
    h: 1680,
    theme: 'gravity',
    rowGap: 68,
    colGap: 60,
    gold: 6,
    spikes: 2,
    moving: 0,
    reinforced: 4,
    vanish: 0,
    springs: 0,
    wells: 2,
    portals: true,
    accel: false,
    bumpers: 1,
    jackpot: false,
    payout: 1.08,
    gapWidth: 180,
    boss: false,
  },
}

export function createBoard(spec: Spec): Board {
  if (spec.layout === 'grinder') return buildGrinder(spec.title)
  const profile = PROFILES[spec.layout]
  const tutorial = spec.tutorial && spec.layout === 'workshop'
  const p = tutorial ? PROFILES.workshop : profile
  const rng = spec.rng
  const goldSide: 'left' | 'right' = tutorial || rng() < 0.5 ? 'right' : 'left'
  const margin = 76
  const floorY = p.h - 168
  const shutterY = Math.round(p.h * (tutorial ? 0.46 : 0.4))
  const board: Board = {
    w: p.w,
    h: p.h,
    theme: p.theme,
    margin,
    floorY,
    launchX: p.w / 2,
    launchY: 78,
    pegs: [],
    bumpers: [],
    walls: [],
    zones: [],
    bins: [],
    shutterY,
    gapWidth: p.gapWidth,
    gapStart: goldSide === 'right' ? 0 : 1,
    goldSide,
    payout: p.payout,
    title: spec.title,
    features: ['peg', 'shutter'],
    boss: false,
    jackpot: p.jackpot,
  }

  const blocked = (x: number, y: number, rad: number) => {
    if (Math.hypot(x - board.launchX, y - board.launchY) < rad + 36) return true
    if (Math.abs(y - shutterY) < 34) return true
    for (const b of board.bumpers) {
      if (Math.hypot(x - b.x, y - b.y) < rad + b.r + 8) return true
    }
    for (const z of board.zones) {
      if (z.kind === 'spike' || z.kind === 'spring' || z.kind === 'well' || z.kind === 'portal') {
        if (Math.hypot(x - z.x, y - z.y) < rad + z.r + 6) return true
      }
    }
    return false
  }

  const pegR = 10
  const left = margin + 18
  const right = p.w - margin - 18
  const cols = Math.max(6, Math.floor((right - left) / p.colGap))
  let row = 0
  for (let y = 168; y < shutterY - 70; y += p.rowGap, row++) placeRow(y, row, false)
  for (let y = shutterY + 78; y < floorY - 120; y += p.rowGap, row++) placeRow(y, row, true)

  function placeRow(y: number, rowIndex: number, below: boolean) {
    const stagger = (rowIndex % 2) * p.colGap * 0.5
    for (let c = 0; c < cols; c++) {
      const x = left + stagger + c * p.colGap
      if (x < left || x > right) continue
      if (inLane(x, y, below)) continue
      if (blocked(x, y, pegR)) continue
      board.pegs.push({ x, y, r: pegR, kind: 'normal', row: rowIndex })
    }
  }

  function inLane(x: number, y: number, below: boolean): boolean {
    const safeBase = goldSide === 'right' ? p.w * 0.42 : p.w * 0.58
    const goldBase = goldSide === 'right' ? p.w * 0.74 : p.w * 0.26
    const safeX = safeBase + Math.sin(y * 0.01 + 0.4) * 18
    const goldX = goldBase + Math.sin(y * 0.012 + 1.6) * 22
    if (Math.abs(x - safeX) < (below ? 36 : 28)) return true
    if (Math.abs(x - goldX) < (below ? 14 : 18)) return true
    return false
  }

  // Gold cluster just under the shutter, off the calm lane toward the wall.
  const clusterY = shutterY + 150
  const toward = goldSide === 'right' ? 1 : -1
  const clusterX = p.w * (goldSide === 'right' ? 0.7 : 0.3) + toward * 18
  const goldSpots = [
    [0, 0],
    [-34, 28],
    [34, 28],
    [-18, 62],
    [18, 62],
    [0, 96],
    [-48, 70],
    [48, 70],
    [-36, 120],
    [36, 120],
  ]
  let golds = 0
  for (const [ox, oy] of goldSpots) {
    if (golds >= p.gold) break
    const x = clusterX + ox
    const y = clusterY + oy
    if (x < left || x > right || y > floorY - 140) continue
    removeNear(x, y, 22)
    board.pegs.push({ x, y, r: pegR, kind: 'gold', row: Math.round(y / p.rowGap) })
    golds++
  }
  if (golds) board.features.push('gold')

  // Bumper above the shutter, centered, so the pop can send you either way.
  const bumperY = shutterY - 150
  removeNear(p.w / 2, bumperY, 46)
  board.bumpers.push({ x: p.w / 2, y: bumperY, r: 28 })
  board.features.push('bumper')
  if (p.bumpers > 1) {
    const bx = goldSide === 'right' ? p.w * 0.68 : p.w * 0.32
    const by = shutterY + 300
    removeNear(bx, by, 40)
    board.bumpers.push({ x: bx, y: by, r: 24 })
  }

  convertKind('reinforced', p.reinforced, (peg) => peg.kind === 'normal' && peg.y > shutterY && peg.y < shutterY + 420)
  convertKind('vanish', p.vanish, (peg) => peg.kind === 'normal' && peg.y > shutterY + 80)
  convertKind('moving', p.moving, (peg) => peg.kind === 'normal' && peg.y > shutterY + 40 && peg.y < floorY - 200)

  if (p.springs) {
    const sx = p.w * (goldSide === 'right' ? 0.28 : 0.72)
    const sy = shutterY + 280
    removeNear(sx, sy, 36)
    board.zones.push({ kind: 'spring', x: sx, y: sy, r: 26 })
    board.features.push('spring')
  }

  if (p.spikes) {
    const wall = goldSide === 'right' ? p.w - margin - 36 : margin + 36
    const spots = [
      [wall, shutterY + 250],
      [wall + (goldSide === 'right' ? -28 : 28), shutterY + 330],
      [wall, shutterY + 420],
      [wall + (goldSide === 'right' ? -20 : 20), shutterY + 510],
    ]
    for (let i = 0; i < p.spikes; i++) {
      const [x, y] = spots[i]
      removeNear(x, y, 20)
      board.zones.push({ kind: 'spike', x, y, r: 16 })
    }
    board.features.push('spike')
  }

  if (p.wells) {
    const wells = [
      { x: p.w * 0.34, y: shutterY + 240, r: 110, strength: 520 },
      { x: p.w * 0.66, y: shutterY + 460, r: 120, strength: 560 },
    ]
    for (const w of wells) {
      removeNear(w.x, w.y, 28)
      board.zones.push({ kind: 'well', ...w })
    }
    board.features.push('well')
  }

  if (p.portals) {
    const a = { kind: 'portal' as const, pid: 0 as const, x: margin + 70, y: shutterY + 210, r: 26 }
    const b = { kind: 'portal' as const, pid: 1 as const, x: p.w - margin - 70, y: shutterY + 520, r: 26 }
    removeNear(a.x, a.y, 40)
    removeNear(b.x, b.y, 40)
    board.zones.push(a, b)
    board.features.push('portal')
  }

  if (p.accel) {
    const onRight = goldSide === 'right'
    board.zones.push({
      kind: 'accel',
      x: onRight ? p.w * 0.55 : margin,
      y: shutterY + 40,
      w: p.w * 0.32,
      h: 70,
      dx: 0,
      dy: 1,
      mag: 420,
    })
    board.features.push('accel')
  }

  addArena(board)
  board.launchX = gapCenter(board, board.gapStart)
  return board

  function removeNear(x: number, y: number, rad: number) {
    board.pegs = board.pegs.filter((peg) => Math.hypot(peg.x - x, peg.y - y) > rad)
  }

  function convertKind(kind: Peg['kind'], n: number, ok: (peg: Peg) => boolean) {
    if (n <= 0) return
    const idx = board.pegs.map((peg, i) => (ok(peg) ? i : -1)).filter((i) => i >= 0)
    // Fisher-Yates with the layout rng so the same seed converts the same pegs.
    for (let i = idx.length - 1; i > 0; i--) {
      const j = irand(rng, i + 1)
      ;[idx[i], idx[j]] = [idx[j], idx[i]]
    }
    const name = kind === 'moving' ? 'moving' : kind === 'vanish' ? 'vanish' : 'reinforced'
    let made = 0
    for (const i of idx) {
      if (made >= n) break
      const peg = board.pegs[i]
      peg.kind = kind
      if (kind === 'moving') {
        peg.motion = {
          amp: 26 + rng() * 10,
          period: 2.4 + rng() * 1.4,
          phase: rng() * Math.PI * 2,
          axis: 'x',
        }
      }
      made++
    }
    if (made) board.features.push(name)
  }
}

function addArena(board: Board) {
  const { w, h, margin, floorY } = board
  const r = 16
  board.walls.push(
    { x1: margin, y1: 36, x2: margin, y2: h - 20, r },
    { x1: w - margin, y1: 36, x2: w - margin, y2: h - 20, r },
    { x1: margin, y1: 36, x2: w - margin, y2: 36, r },
  )

  const innerL = margin + 8
  const innerR = w - margin - 8
  const span = innerR - innerL
  const cuts = board.boss ? [0, 0.2, 0.36, 0.64, 0.8, 1] : [0, 0.12, 0.34, 0.66, 0.88, 1]
  const kinds: Board['bins'][number]['kind'][] = board.boss
    ? ['hazard', 'coin', 'jackpot', 'coin', 'hazard']
    : ['hazard', 'coin', board.jackpot ? 'jackpot' : 'bonus', 'coin', 'hazard']
  for (let i = 0; i < 5; i++) {
    const x0 = innerL + span * cuts[i]
    const x1 = innerL + span * cuts[i + 1]
    board.bins.push({ x0, x1, kind: kinds[i] })
    const floor = floorY + 108
    const seal = board.boss && kinds[i] === 'jackpot'
    board.walls.push({ x1: x0 + 10, y1: floor, x2: x1 - 10, y2: floor, r: 12, seal })
    if (i > 0) {
      board.walls.push({ x1: x0, y1: floorY + 8, x2: x0, y2: floor, r: 10 })
    }
  }
  board.zones.push({
    kind: 'brake',
    x: margin,
    y: floorY - 78,
    w: w - margin * 2,
    h: 64,
    drag: 1.6,
  })
  if (board.jackpot || board.boss) board.features.push('jackpot')
}

function buildGrinder(title: string): Board {
  const w = 800
  const h = 1460
  const margin = 78
  const floorY = h - 170
  const board: Board = {
    w,
    h,
    theme: 'grinder',
    margin,
    floorY,
    launchX: w / 2,
    launchY: 74,
    pegs: [],
    bumpers: [],
    walls: [],
    zones: [],
    bins: [],
    shutterY: null,
    gapWidth: 0,
    gapStart: 0,
    goldSide: 'right',
    payout: 1.15,
    title,
    features: ['peg', 'bumper', 'core', 'spike', 'jackpot'],
    boss: true,
    jackpot: true,
  }
  const pegR = 10
  const rows = [190, 265, 340, 860, 940, 1020]
  rows.forEach((y, ri) => {
    const n = 8
    for (let c = 0; c < n; c++) {
      const x = margin + 36 + c * ((w - margin * 2 - 72) / (n - 1))
      const lower = ri >= 3
      const peg: Peg = { x, y, r: pegR, kind: lower ? 'moving' : 'normal', row: ri }
      if (lower) {
        peg.motion = { amp: 22, period: 2.6, phase: c * 0.45 + ri, axis: 'x' }
        if (c === 0 || c === n - 1) peg.collapseAt = 4
      }
      if (ri === 1 && (c === 2 || c === 5)) peg.kind = 'gold'
      board.pegs.push(peg)
    }
  })
  board.features.push('gold', 'moving')
  board.bumpers.push({ x: w / 2, y: 620, r: 36, core: true })
  board.bumpers.push({ x: w * 0.28, y: 520, r: 22 }, { x: w * 0.72, y: 520, r: 22 })
  board.zones.push(
    { kind: 'spike', x: margin + 34, y: 700, r: 16 },
    { kind: 'spike', x: w - margin - 34, y: 700, r: 16 },
    { kind: 'spike', x: margin + 48, y: 800, r: 15 },
    { kind: 'spike', x: w - margin - 48, y: 800, r: 15 },
  )
  addArena(board)
  return board
}

export function demoBoard(): Board {
  return createBoard({
    layout: 'workshop',
    title: 'The Workshop',
    tutorial: true,
    rng: () => 0.2,
  })
}
