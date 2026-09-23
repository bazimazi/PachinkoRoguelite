export type Tag =
  | 'bounce'
  | 'multiplier'
  | 'gravity'
  | 'control'
  | 'economy'
  | 'risk'
  | 'portal'
  | 'destruction'
  | 'combo'
  | 'precision'
  | 'luck'
  | 'magnet'

export type SpecialKind = 'rebound' | 'crit' | 'tilt'

export interface BallDef {
  id: string
  name: string
  tagline: string
  tags: Tag[]
  primary: Tag
  restitution: number
  friction: number
  radius: number
  integrity: number
  nudge: number
  launch: number
  well: number
  special: SpecialKind
  charges: number
  specialName: string
  specialText: string
  color: string
  accent: string
  core: string
}

export interface RelicDef {
  id: string
  name: string
  tags: Tag[]
  text: string
  lockHint: string
  params: Record<string, number>
}

export interface UpgradeDef {
  id: string
  name: string
  tags: Tag[]
  text: string
  params: Record<string, number>
}

export interface PartDef {
  id: string
  name: string
  about: string
}

export interface ChallengeDef {
  id: string
  name: string
  text: string
}

export interface TrailDef {
  id: string
  name: string
  color: string
}

export const BALLS: Record<string, BallDef> = {
  rubber: {
    id: 'rubber',
    name: 'Rubber Heart',
    tagline: 'It wants another bounce.',
    tags: ['bounce', 'combo'],
    primary: 'bounce',
    restitution: 0.98,
    friction: 0.05,
    radius: 13,
    integrity: 3,
    nudge: 1.08,
    launch: 1.04,
    well: 1,
    special: 'rebound',
    charges: 2,
    specialName: 'Rebound',
    specialText: 'The next impact leaves harder than it arrived.',
    color: '#ff6a52',
    accent: '#ffd2c4',
    core: '#8a2418',
  },
  prism: {
    id: 'prism',
    name: 'Prism Core',
    tagline: 'Fragile, and hungry for a multiplier.',
    tags: ['multiplier', 'risk', 'precision'],
    primary: 'multiplier',
    restitution: 0.74,
    friction: 0.16,
    radius: 12.4,
    integrity: 2,
    nudge: 1,
    launch: 1,
    well: 1,
    special: 'crit',
    charges: 2,
    specialName: 'Mark',
    specialText: 'Mark a peg. Strike it and the multiplier jumps.',
    color: '#e7fff8',
    accent: '#7eefe6',
    core: '#1c6e78',
  },
  void: {
    id: 'void',
    name: 'Void Marble',
    tagline: 'Down is a suggestion.',
    tags: ['gravity', 'control'],
    primary: 'gravity',
    restitution: 0.56,
    friction: 0.3,
    radius: 14.6,
    integrity: 3,
    nudge: 0.68,
    launch: 0.86,
    well: 1.45,
    special: 'tilt',
    charges: 2,
    specialName: 'Tilt',
    specialText: 'Lean gravity toward the cursor.',
    color: '#2a2144',
    accent: '#c4b6ff',
    core: '#090712',
  },
}

export const BALL_LIST = [BALLS.rubber, BALLS.prism, BALLS.void]

export const RELICS: Record<string, RelicDef> = {
  'spring-soul': {
    id: 'spring-soul',
    name: 'Spring Soul',
    tags: ['bounce', 'combo'],
    text: 'The sphere keeps more of every bounce. Combos forgive a longer pause.',
    lockHint: '',
    params: { rest: 0.07, window: 0.2 },
  },
  'golden-magnet': {
    id: 'golden-magnet',
    name: 'Golden Magnet',
    tags: ['magnet', 'economy'],
    text: 'Gold pegs tug the sphere as it passes. You can bend toward value.',
    lockHint: '',
    params: { pull: 280, radius: 240 },
  },
  'lucky-gear': {
    id: 'lucky-gear',
    name: 'Lucky Gear',
    tags: ['luck', 'multiplier', 'magnet'],
    text: 'The first peg struck in a row turns to gold. Six rows, then it sleeps.',
    lockHint: '',
    params: { mult: 0.34, max: 6 },
  },
  'broken-compass': {
    id: 'broken-compass',
    name: 'Broken Compass',
    tags: ['control', 'precision'],
    text: 'Every third ricochet that reverses your drift restores a nudge.',
    lockHint: '',
    params: { every: 3 },
  },
  'heavy-crown': {
    id: 'heavy-crown',
    name: 'Heavy Crown',
    tags: ['destruction', 'risk'],
    text: 'Fast strikes shatter ordinary pegs, pay extra, and leave a hole. A dead ball rarely qualifies.',
    lockHint: '',
    params: { speed: 680, bonus: 8 },
  },
  'echo-core': {
    id: 'echo-core',
    name: 'Echo Core',
    tags: ['bounce', 'combo'],
    text: 'A bumper strikes twice. The second pulse finds you if you are still close.',
    lockHint: '',
    params: { delay: 0.14, impulse: 300, radius: 200 },
  },
  'gravity-lens': {
    id: 'gravity-lens',
    name: 'Gravity Lens',
    tags: ['gravity', 'portal'],
    text: 'Wells pull harder and longer. Portals tug faintly as you pass.',
    lockHint: 'wells grow teeth',
    params: { wells: 1.65, tilt: 1.4, portal: 90 },
  },
  'glass-heart': {
    id: 'glass-heart',
    name: 'Glass Heart',
    tags: ['risk', 'multiplier'],
    text: 'Max shell −1. Every multiplier gain is much richer.',
    lockHint: 'a brittle fortune',
    params: { shell: 1, gain: 1.55 },
  },
  ouroboros: {
    id: 'ouroboros',
    name: 'Ouroboros',
    tags: ['portal', 'multiplier'],
    text: 'Leaving a portal raises the multiplier and throws you faster.',
    lockHint: 'a door that bites back',
    params: { mult: 0.55, speed: 1.13 },
  },
  'clockwork-feather': {
    id: 'clockwork-feather',
    name: 'Clockwork Feather',
    tags: ['combo', 'gravity', 'control'],
    text: 'At an 8 combo the machine inhales. Physics slows, and you may still nudge.',
    lockHint: 'the clock skips',
    params: { combo: 8, scale: 0.46, duration: 0.62 },
  },
}

export const RELIC_LIST = Object.values(RELICS)

export const UPGRADES: Record<string, UpgradeDef> = {
  'side-jets': {
    id: 'side-jets',
    name: 'Side Jets',
    tags: ['control'],
    text: '+1 nudge each drop. Spend it. The machine will not spend it for you.',
    params: { nudges: 1 },
  },
  'open-throat': {
    id: 'open-throat',
    name: 'Open Throat',
    tags: ['precision', 'control'],
    text: 'The launch cone widens. Extreme angles become available.',
    params: { cone: 0.16 },
  },
  'heated-skin': {
    id: 'heated-skin',
    name: 'Heated Skin',
    tags: ['bounce', 'destruction'],
    text: 'Impacts keep more speed. Shattering becomes a little easier.',
    params: { rest: 0.06 },
  },
  'first-gild': {
    id: 'first-gild',
    name: 'First Gild',
    tags: ['multiplier', 'luck'],
    text: 'Each drop begins at ×1.5 instead of ×1.',
    params: { mult: 0.5 },
  },
  'long-ratchet': {
    id: 'long-ratchet',
    name: 'Long Ratchet',
    tags: ['combo'],
    text: 'The combo survives a longer silence between hits.',
    params: { window: 0.22 },
  },
  'spare-shell': {
    id: 'spare-shell',
    name: 'Spare Shell',
    tags: [],
    text: '+1 max shell, and the new pip is filled now.',
    params: { shell: 1 },
  },
  'plumb-line': {
    id: 'plumb-line',
    name: 'Plumb Line',
    tags: ['gravity', 'control'],
    text: 'Gain one gravity tilt each drop. Press Q. The cursor chooses the lean.',
    params: { tilts: 1 },
  },
  'bumper-tithe': {
    id: 'bumper-tithe',
    name: 'Bumper Tithe',
    tags: ['economy'],
    text: 'Bumpers pay gears when they kick you.',
    params: { gears: 5 },
  },
  'gate-memory': {
    id: 'gate-memory',
    name: 'Gate Memory',
    tags: ['control', 'combo'],
    text: 'Flipping the gate at combo 4 or higher restores a nudge.',
    params: { combo: 4 },
  },
  afterimage: {
    id: 'afterimage',
    name: 'Afterimage',
    tags: ['precision'],
    text: 'The aim preview reaches farther down the machine.',
    params: { steps: 70 },
  },
}

export const UPGRADE_LIST = Object.values(UPGRADES)

export const PARTS: PartDef[] = [
  { id: 'peg', name: 'Peg', about: 'Pays when struck. The ordinary tooth of the machine.' },
  { id: 'gold', name: 'Gold peg', about: 'Raises the multiplier. Usually off the calm lane.' },
  { id: 'reinforced', name: 'Reinforced peg', about: 'Pays more, and will not shatter.' },
  { id: 'moving', name: 'Moving peg', about: 'Slides on a track. It can shove you.' },
  { id: 'vanish', name: 'Vanishing peg', about: 'Leaves a hole after a hit, then grows back.' },
  { id: 'bumper', name: 'Bumper', about: 'A kick, not a wall. Time your nudge after it.' },
  { id: 'shutter', name: 'Shutter', about: 'One flip each drop. It chooses which lane is open.' },
  { id: 'spike', name: 'Spike', about: 'Cracks the shell and breaks your combo.' },
  { id: 'spring', name: 'Spring', about: 'Throws you back up. Greed with a second chance.' },
  { id: 'well', name: 'Gravity well', about: 'Bends the fall. It will not hold you forever.' },
  { id: 'portal', name: 'Portal', about: 'A paired door. Speed is kept. Position is not.' },
  { id: 'accel', name: 'Accelerator', about: 'A fast strip. Harder to correct, richer if you meant it.' },
  { id: 'core', name: 'Grinder core', about: 'Five true hits break it. The gutters are how you lose.' },
  { id: 'jackpot', name: 'Jackpot maw', about: 'The center bin. It only erupts at ×3 or higher.' },
]

export const CHALLENGES: ChallengeDef[] = [
  { id: 'combo10', name: 'Tenfold', text: 'Reach a 10 combo in one drop.' },
  { id: 'mult4', name: 'Prism hour', text: 'Reach ×4 in one drop.' },
  { id: 'clean', name: 'Untouched', text: 'Finish a drop without a hazard.' },
  { id: 'grinder', name: 'Break the Grinder', text: 'Defeat the boss.' },
  { id: 'shatter8', name: 'Open lane', text: 'Shatter 8 pegs in one fall.' },
  { id: 'portal', name: 'Elsewhere', text: 'Pass through a portal.' },
  { id: 'score1500', name: 'Deep score', text: 'Score 1500 in one fall.' },
  { id: 'flip-gold', name: 'Committed', text: 'Flip the gate and strike gold in the same drop.' },
  { id: 'jackpot', name: 'Jackpot', text: 'Trigger a jackpot.' },
  { id: 'win-rubber', name: 'Heart of rubber', text: 'Break the Grinder with Rubber Heart.' },
  { id: 'win-prism', name: 'Heart of prism', text: 'Break the Grinder with Prism Core.' },
  { id: 'win-void', name: 'Heart of void', text: 'Break the Grinder with Void Marble.' },
]

export const TRAILS: TrailDef[] = [
  { id: 'brass', name: 'Brass wake', color: '#e0b07a' },
  { id: 'ember', name: 'Ember wake', color: '#ff8a5b' },
  { id: 'violet', name: 'Violet wake', color: '#b7a4ff' },
]

export const LORE: Record<string, string> = {
  workshop: 'The first teeth of the Helix are brass. They were made to be understood.',
  foundry: 'Heat is just gravity that learned impatience.',
  gravity: 'Below the foundry, the machine stops pretending down is a rule.',
  grinder: 'The Grinder does not hate you. It only repeats.',
}

export function ballById(id: string): BallDef {
  return BALLS[id] ?? BALLS.rubber
}
