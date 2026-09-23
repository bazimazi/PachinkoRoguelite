export type ThemeName = 'workshop' | 'foundry' | 'gravity' | 'grinder'
export type PegKind = 'normal' | 'reinforced' | 'gold' | 'moving' | 'vanish'
export type BinKind = 'hazard' | 'coin' | 'bonus' | 'jackpot'
export type LayoutId = 'workshop' | 'garden' | 'furnace' | 'elite' | 'ante' | 'core' | 'grinder'

export interface Motion {
  amp: number
  period: number
  phase: number
  axis: 'x' | 'y'
}

export interface Peg {
  x: number
  y: number
  r: number
  kind: PegKind
  row: number
  motion?: Motion
  collapseAt?: number
}

export interface Bumper {
  x: number
  y: number
  r: number
  core?: boolean
}

export interface Wall {
  x1: number
  y1: number
  x2: number
  y2: number
  r: number
  seal?: boolean
}

export type Zone =
  | { kind: 'spike'; x: number; y: number; r: number }
  | { kind: 'spring'; x: number; y: number; r: number }
  | { kind: 'well'; x: number; y: number; r: number; strength: number }
  | { kind: 'portal'; pid: 0 | 1; x: number; y: number; r: number }
  | { kind: 'accel'; x: number; y: number; w: number; h: number; dx: number; dy: number; mag: number }
  | { kind: 'brake'; x: number; y: number; w: number; h: number; drag: number }

export interface Bin {
  x0: number
  x1: number
  kind: BinKind
}

export interface Board {
  w: number
  h: number
  theme: ThemeName
  margin: number
  floorY: number
  launchX: number
  launchY: number
  pegs: Peg[]
  bumpers: Bumper[]
  walls: Wall[]
  zones: Zone[]
  bins: Bin[]
  shutterY: number | null
  gapWidth: number
  /** 0 = gap on the left, 1 = gap on the right. */
  gapStart: number
  goldSide: 'left' | 'right'
  payout: number
  title: string
  features: string[]
  boss: boolean
  jackpot: boolean
}

export function gapCenter(board: Board, gapT: number): number {
  const L = board.margin + 8
  const R = board.w - board.margin - 8
  const span = R - L
  // 0 keeps a center launch inside the opening. 1 moves that opening onto the other half.
  return L + span * (0.4 + 0.32 * gapT)
}

export function shutterWalls(board: Board, gapT: number): Wall[] {
  if (board.shutterY == null) return []
  const y = board.shutterY
  const L = board.margin + 62
  const R = board.w - board.margin - 62
  const c = gapCenter(board, gapT)
  const half = board.gapWidth / 2
  const g0 = Math.max(L + 36, c - half)
  const g1 = Math.min(R - 36, c + half)
  const slope = 72
  return [
    { x1: L, y1: y + slope, x2: g0, y2: y, r: 12 },
    { x1: g1, y1: y, x2: R, y2: y + slope, r: 12 },
  ]
}

export function pegPose(
  peg: Peg,
  time: number,
  ampScale: number,
): { x: number; y: number; vx: number; vy: number } {
  if (!peg.motion || peg.kind !== 'moving') return { x: peg.x, y: peg.y, vx: 0, vy: 0 }
  const w = (Math.PI * 2) / peg.motion.period
  const s = Math.sin(w * time + peg.motion.phase)
  const c = Math.cos(w * time + peg.motion.phase)
  const amp = peg.motion.amp * ampScale
  if (peg.motion.axis === 'x') return { x: peg.x + s * amp, y: peg.y, vx: c * w * amp, vy: 0 }
  return { x: peg.x, y: peg.y + s * amp, vx: 0, vy: c * w * amp }
}
