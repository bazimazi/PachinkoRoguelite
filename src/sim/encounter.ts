import type { Board, EncounterId, EncounterSpec } from './board'

export const ENCOUNTERS: Record<EncounterId, EncounterSpec> = {
  bellkeeper: {
    id: 'bellkeeper', name: 'The Bellkeeper', required: 3, sequence: [], bounty: 70,
    description: 'Strike all three bells, in any order. Linked bells retract. One safe-pocket return keeps your progress; gutters still cost shell. Complete the relay for 70 gears and a relic.',
  },
  heartforge: {
    id: 'heartforge', name: 'The Heartforge', required: 4, sequence: [0, 1, 0, 1], bounty: 120,
    description: 'Strike the left and right furnaces in order: I → II → I → II. One safe-pocket return keeps your progress; gutters still cost shell. Complete the relay for 120 gears and a relic.',
  },
}

/** Install physical targets after normal seeded generation and board modifiers.
 * No RNG is consumed; the original room, anomaly, and route streams stay stable.
 * Existing boss geometry is deliberately excluded. */
export function applyEncounter(board: Board, id: EncounterId): Board {
  if (board.boss || board.encounter) return board
  const spec = ENCOUNTERS[id]
  if (!spec) return board
  board.encounter = { ...spec, sequence: [...spec.sequence] }
  const top = (board.shutterY ?? board.h * 0.3) + 180
  const placements = id === 'bellkeeper'
    ? [
        { x: board.w * 0.35, y: top, r: 42 },
        { x: board.w * 0.65, y: top, r: 42 },
        { x: board.w * 0.5, y: Math.min(board.floorY - 170, top + 250), r: 42 },
      ]
    : [
        { x: board.w * 0.39, y: top + 70, r: 43 },
        { x: board.w * 0.61, y: top + 70, r: 43 },
      ]
  for (let relay = 0; relay < placements.length; relay++) {
    const target = placements[relay]
    const clearance = target.r + 47
    // The entire moving-peg sweep stays clear of a relay. A physical wedge must
    // never masquerade as a difficult objective or trap the ball beside a seal.
    board.pegs = board.pegs.filter(p => Math.hypot(p.x - target.x, p.y - target.y) > clearance + p.r + (p.motion?.amp ?? 0))
    board.bumpers = board.bumpers.filter(b => Math.hypot(b.x - target.x, b.y - target.y) > clearance + b.r)
    // Springs, wells and portals are sensors, not physical walls. Retain them
    // so an advertised anomaly still supplies its actual mechanics. Only move
    // unavoidable damage away from the target's immediate contact envelope.
    board.zones = board.zones.filter(z => z.kind !== 'spike' || Math.hypot(z.x - target.x, z.y - target.y) > target.r + z.r + 22)
    board.bumpers.push({ ...target, relay })
  }
  if (!board.features.includes('relay')) board.features.push('relay')
  return board
}
