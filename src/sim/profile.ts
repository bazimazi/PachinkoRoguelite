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
  arcEvery: number
  hazardShields: number
  hazardGrace: number
  goldRefundWindow: number
  ledger: boolean
  flywheel: boolean
  passport: boolean
  cleanContract: boolean
  salvage: boolean
  comboBonusAt: number
  comboBonusScale: number
  landingBonus: number
  tags: Partial<Record<Tag, number>>
  synergies: Synergy[]
}

const BLURB: Record<Tag, [string, string]> = {
  bounce: ['Combo window +0.08 seconds.', 'Combo window +0.08 seconds; impact restitution +0.04.'],
  multiplier: ['Multiplier gains +10%.', 'Multiplier gains +22%.'],
  gravity: ['Gravity well influence +18%.', 'Gravity well influence +35%.'],
  control: ['Nudge force +8%.', 'Nudge force +8%; one extra nudge each drop.'],
  economy: ['Peg, spring, and bumper payouts +8%.', 'Peg, spring, and bumper payouts +16%.'],
  risk: ['The shell is part of the math.', 'Danger is the multiplier.'],
  portal: ['Ouroboros gains an extra +0.15 multiplier per transit.', 'Ouroboros gains an extra +0.30 multiplier per transit.'],
  destruction: ['Shatter speed threshold −70, when a relic enables shattering.', 'Shatter speed threshold −120, when a relic enables shattering.'],
  combo: ['Combo window +0.10 seconds.', 'Combo window +0.18 seconds.'],
  precision: ['The first second of the fall is clearer.', 'Aim and marks reward a committed line.'],
  luck: ['Rows remember their first kiss.', 'The first peg in a row can turn to gold.'],
  magnet: ['Golden Magnet: pull +110, reach +40.', 'Golden Magnet: pull +170, reach +65.'],
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
  for (const id of up) bump(tags, UPGRADES[id]?.tags ?? [])
  for (const id of rel) bump(tags, RELICS[id]?.tags ?? [])

  const synergies: Synergy[] = []
  for (const [tag, count] of Object.entries(tags) as [Tag, number][]) {
    if (count < 2) continue
    // Theme tags remain useful for drafting, but are not advertised as passive bonuses.
    if (['risk', 'precision', 'luck'].includes(tag)) continue
    if (tag === 'portal' && !rel.has('ouroboros')) continue
    if (tag === 'magnet' && !rel.has('golden-magnet')) continue
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

  let shatterSpeed = Math.min(
    rel.has('heavy-crown') ? RELICS['heavy-crown'].params.speed : Infinity,
    rel.has('salvage-crown') ? RELICS['salvage-crown'].params.speed : Infinity,
  )
  if (Number.isFinite(shatterSpeed) && count('destruction') >= 2) shatterSpeed -= 70
  if (Number.isFinite(shatterSpeed) && count('destruction') >= 3) shatterSpeed -= 50

  const lens = rel.has('gravity-lens')
  const magnet = rel.has('golden-magnet')
  let magnetPull = magnet ? RELICS['golden-magnet'].params.pull : 0
  let magnetRadius = magnet ? RELICS['golden-magnet'].params.radius : 0
  if (magnetPull > 0 && count('magnet') >= 2) {
    magnetPull += count('magnet') >= 3 ? 170 : 110
    magnetRadius += count('magnet') >= 3 ? 65 : 40
  }

  const special = ball.special
  const extraCharges = up.has('capacitor') ? UPGRADES.capacitor.params.charges : 0
  const tiltCharges =
    (special === 'tilt' ? ball.charges + extraCharges : 0) + (up.has('plumb-line') ? 1 : 0)

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
    wellScale: ball.well * (lens ? RELICS['gravity-lens'].params.wells : 1) * (count('gravity') >= 3 ? 1.35 : count('gravity') >= 2 ? 1.18 : 1),
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
    specialCharges: special === 'tilt' ? 0 : ball.charges + extraCharges,
    previewSteps: TUNING.previewSteps + (up.has('afterimage') ? UPGRADES.afterimage.params.steps : 0),
    gateCombo: up.has('gate-memory') ? UPGRADES['gate-memory'].params.combo : 0,
    arcEvery: rel.has('arc-coil') ? RELICS['arc-coil'].params.every : 0,
    hazardShields: rel.has('velvet-fuse') ? RELICS['velvet-fuse'].params.shields : 0,
    hazardGrace: up.has('shock-absorber') ? UPGRADES['shock-absorber'].params.grace : 0.85,
    goldRefundWindow: rel.has('golden-rudder') ? RELICS['golden-rudder'].params.window : 0,
    ledger: rel.has('brass-ledger'),
    flywheel: rel.has('flywheel'),
    passport: rel.has('portal-passport'),
    cleanContract: rel.has('clean-contract'),
    salvage: rel.has('salvage-crown'),
    comboBonusAt: up.has('compound-interest') ? UPGRADES['compound-interest'].params.combo : 0,
    comboBonusScale: up.has('compound-interest') ? UPGRADES['compound-interest'].params.scale : 1,
    landingBonus: up.has('landing-gear') ? UPGRADES['landing-gear'].params.pay : 0,
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
