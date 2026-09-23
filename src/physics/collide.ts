export interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  r: number
}

export interface Seg {
  x1: number
  y1: number
  x2: number
  y2: number
  r: number
}

/**
 * Static or kinematic circle. Returns approach speed along the normal, or 0.
 * Normal points from the obstacle toward the ball.
 */
export function collideCircle(
  ball: Ball,
  cx: number,
  cy: number,
  cr: number,
  e: number,
  mu: number,
  cvx = 0,
  cvy = 0,
): number {
  let dx = ball.x - cx
  let dy = ball.y - cy
  let d2 = dx * dx + dy * dy
  const rad = ball.r + cr
  if (d2 > rad * rad) return 0
  if (d2 < 1e-8) {
    dx = 0
    dy = 1
    d2 = 1
  }
  const d = Math.sqrt(d2)
  const nx = dx / d
  const ny = dy / d
  const pen = rad - d
  if (pen > 0.35) {
    ball.x += nx * (pen - 0.35)
    ball.y += ny * (pen - 0.35)
  }
  const rvx = ball.vx - cvx
  const rvy = ball.vy - cvy
  const vn = rvx * nx + rvy * ny
  if (vn >= 0) return 0
  const j = -(1 + e) * vn
  ball.vx += j * nx
  ball.vy += j * ny
  if (mu > 0) {
    const tx = -ny
    const ty = nx
    const vt = (ball.vx - cvx) * tx + (ball.vy - cvy) * ty
    ball.vx -= vt * mu * tx
    ball.vy -= vt * mu * ty
  }
  return -vn
}

export function collideSegment(ball: Ball, seg: Seg, e: number, mu: number): number {
  const abx = seg.x2 - seg.x1
  const aby = seg.y2 - seg.y1
  const apx = ball.x - seg.x1
  const apy = ball.y - seg.y1
  const ab2 = abx * abx + aby * aby
  let t = ab2 > 1e-8 ? (apx * abx + apy * aby) / ab2 : 0
  if (t < 0) t = 0
  else if (t > 1) t = 1
  const cx = seg.x1 + abx * t
  const cy = seg.y1 + aby * t
  return collideCircle(ball, cx, cy, seg.r, e, mu)
}

export function selfcheckPhysics(): void {
  const ball: Ball = { x: 0, y: -18, vx: 0, vy: 200, r: 10 }
  let hit = 0
  for (let i = 0; i < 8; i++) {
    ball.vy += 20
    ball.y += ball.vy * 0.016
    hit = Math.max(hit, collideCircle(ball, 0, 0, 10, 0.9, 0))
  }
  if (!(hit > 0 && ball.vy < 0)) {
    throw new Error('physics self-check failed: a falling ball should rebound upward')
  }
}
