import { BALLS, UPGRADES, RELICS, type Tag, type SpecialKind, ballById } from '../content/catalog'
import { TUNING } from '../tuning'
import { capitalize } from '../core/math'

export interface Synergy {
  tag: Tag
  count: number
  tier: 'emerging' | 'forged'
  name: string
  blurb: string
}

export interface Profile {
  restitution: number
  friction: number
  radius: number
  nudgeScale: number
  launch: number
  wellScale: number
  gravityScale: number
  comboWindow: number
  maxNudges: number
  aimCone: number
  startMult: number
  multGain: number
  gearScale: number
  integrityMax: number
  bumperGears: number
  shatterSpeed: number
  magnetPull: number
  magnetRadius: number
  portalPull: number
  portalBoost: boolean
  echo: boolean
  gildMax: number
  gildMult: number
  compassEvery: number
  featherAt: number
  featherScale: number
  featherDur: number
  tiltCharges: number
  tiltDuration: number
  special: SpecialKind
  specialCharges: number
  previewSteps: number
  gateCombo: number
  tags: Partial<Record<Tag, number>>
  synergies: Synergy[]
}

const BLURB: Record<Tag, [string, string]> = {
  bounce: ['Hits keep the combo awake a little longer.', 'Rebounds sharpen. The board starts to sing.'],
  multiplier: ['Gold pays a little more attention to you.', 'Multipliers compound. Greed is the plan.'],
  gravity: ['Wells reach a little farther.', 'The fall bends. Wells and tilts are the line.'],
  control: ['Nudges come a little easier.', 'You are steering, not hoping.'],
  economy: ['The machine sheds a few more gears.', 'Every glint is worth more.'],
  risk: ['The shell is part of the math.', 'Danger is the multiplier.'],
  portal: ['Portals leave a small wake.', 'A loop through the pair is a scoring engine.'],
  destruction: ['Fast impacts worry the pegs.', 'Lanes open when you hit hard enough.'],
  combo: ['The chain is a little more patient.', 'Long chains are the point of the drop.'],
  precision: ['The first second of the fall is clearer.', 'Aim and marks reward a committed line.'],
  luck: ['Rows remember their first kiss.', 'The first peg in a row can turn to gold.'],
  magnet: ['Gold tugs a little harder.', 'You can bend toward value.'],
}

function bump(tags: Partial<Record<Tag, number>>, list: Tag[], n = 1) {
  for (const t of list) tags[t] = (tags[t] ?? 0) + n
}

export function computeProfile(ballId: string, upgrades: string[], relics: string[]): Profile {
  const ball = ballById(ballId)
  const up = new Set(upgrades)
  const rel = new Set(relics)
  const tags: Partial<Record<Tag, number>> = {}
  bump(tags, ball.tags)
  for (const id of upgrades) bump(tags, UPGRADES[id]?.tags ?? [])
  for (const id of relics) bump(tags, RELICS[id]?.tags ?? [])

  const synergies: Synergy[] = []
  for (const [tag, count] of Object.entries(tags) as [Tag, number][]) {
    if (count < 2) continue
    const tier = count >= 3 ? 'forged' : 'emerging'
    const pair = BLURB[tag]
    synergies.push({
      tag,
      count,
      tier,
      name: `${capitalize(tier)} ${tag}`,
      blurb: tier === 'forged' ? pair[1] : pair[0],
    })
  }
  synergies.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))

  const count = (t: Tag) => tags[t] ?? 0
  const glass = rel.has('glass-heart')
  const integrityMax = Math.max(
    1,
    ball.integrity + (up.has('spare-shell') ? 1 : 0) - (glass ? 1 : 0),
  )

  let shatterSpeed = rel.has('heavy-crown') ? RELICS['heavy-crown'].params.speed : Infinity
  if (Number.isFinite(shatterSpeed) && count('destruction') >= 2) shatterSpeed -= 70
  if (Number.isFinite(shatterSpeed) && count('destruction') >= 3) shatterSpeed -= 50

  const lens = rel.has('gravity-lens')
  const magnet = rel.has('golden-magnet')
  let magnetPull = magnet ? RELICS['golden-magnet'].params.pull : 0
  let magnetRadius = magnet ? RELICS['golden-magnet'].params.radius : 0
  if (magnetPull > 0 && count('magnet') >= 2) {
    magnetPull += 110
    magnetRadius += 40
  }

  const special = ball.special
  const tiltCharges =
    (special === 'tilt' ? ball.charges : 0) + (up.has('plumb-line') ? 1 : 0)

  return {
    restitution:
      ball.restitution +
      (rel.has('spring-soul') ? RELICS['spring-soul'].params.rest : 0) +
      (up.has('heated-skin') ? UPGRADES['heated-skin'].params.rest : 0) +
      (count('bounce') >= 3 ? 0.04 : 0),
    friction: ball.friction,
    radius: ball.radius,
    nudgeScale: ball.nudge * (count('control') >= 2 ? 1.08 : 1),
    launch: ball.launch,
    wellScale: ball.well * (lens ? RELICS['gravity-lens'].params.wells : 1) * (count('gravity') >= 2 ? 1.18 : 1),
    gravityScale: 1,
    comboWindow:
      TUNING.comboWindow +
      (rel.has('spring-soul') ? RELICS['spring-soul'].params.window : 0) +
      (up.has('long-ratchet') ? UPGRADES['long-ratchet'].params.window : 0) +
      (count('bounce') >= 2 ? 0.08 : 0) +
      (count('combo') >= 2 ? 0.1 : 0) +
      (count('combo') >= 3 ? 0.08 : 0),
    maxNudges: 3 + (up.has('side-jets') ? 1 : 0) + (count('control') >= 3 ? 1 : 0),
    aimCone: 0.58 + (up.has('open-throat') ? UPGRADES['open-throat'].params.cone : 0),
    startMult: 1 + (up.has('first-gild') ? UPGRADES['first-gild'].params.mult : 0),
    multGain:
      (glass ? RELICS['glass-heart'].params.gain : 1) *
      (1 + (count('multiplier') >= 2 ? 0.1 : 0) + (count('multiplier') >= 3 ? 0.12 : 0)),
    gearScale: 1 + (count('economy') >= 2 ? 0.08 : 0) + (count('economy') >= 3 ? 0.08 : 0),
    integrityMax,
    bumperGears: up.has('bumper-tithe') ? UPGRADES['bumper-tithe'].params.gears : 0,
    shatterSpeed,
    magnetPull,
    magnetRadius,
    portalPull: lens ? RELICS['gravity-lens'].params.portal : 0,
    portalBoost: rel.has('ouroboros'),
    echo: rel.has('echo-core'),
    gildMax: rel.has('lucky-gear') ? RELICS['lucky-gear'].params.max : 0,
    gildMult: rel.has('lucky-gear') ? RELICS['lucky-gear'].params.mult : 0,
    compassEvery: rel.has('broken-compass') ? RELICS['broken-compass'].params.every : 0,
    featherAt: rel.has('clockwork-feather') ? RELICS['clockwork-feather'].params.combo : 0,
    featherScale: rel.has('clockwork-feather') ? RELICS['clockwork-feather'].params.scale : 1,
    featherDur: rel.has('clockwork-feather') ? RELICS['clockwork-feather'].params.duration : 0,
    tiltCharges,
    tiltDuration: (lens ? RELICS['gravity-lens'].params.tilt : 1) * 1.05,
    special,
    specialCharges: special === 'tilt' ? 0 : ball.charges,
    previewSteps: TUNING.previewSteps + (up.has('afterimage') ? UPGRADES.afterimage.params.steps : 0),
    gateCombo: up.has('gate-memory') ? UPGRADES['gate-memory'].params.combo : 0,
    tags,
    synergies,
  }
}

export function hypotheticalSynergy(
  ballId: string,
  upgrades: string[],
  relics: string[],
  add: { kind: 'upgrade' | 'relic'; id: string },
): string | null {
  const before = computeProfile(ballId, upgrades, relics)
  const ups = add.kind === 'upgrade' ? [...upgrades, add.id] : upgrades
  const rel = add.kind === 'relic' ? [...relics, add.id] : relics
  const after = computeProfile(ballId, ups, rel)
  const have = new Map(before.synergies.map((s) => [s.tag, s.tier]))
  let best: Synergy | null = null
  for (const s of after.synergies) {
    const prev = have.get(s.tag)
    if (prev === s.tier) continue
    if (!best || s.count > best.count) best = s
  }
  return best ? best.name : null
}

export function ballName(id: string): string {
  return BALLS[id]?.name ?? id
}
