import type { EncounterId, LayoutId, ThemeName } from '../sim/board'
import { ANOMALY_IDS, type AnomalyId } from '../sim/anomaly'
import { irand } from '../core/rng'

export interface ForkOption {
  title: string
  detail: string
  risk: 'safe' | 'risky'
  next: string
}

export type EventId = 'salvage' | 'resonance' | 'oracle'

export interface GameNode {
  id: string
  kind: 'drop' | 'boss' | 'fork' | 'shop' | 'repair' | 'bargain' | 'event'
  title: string
  kicker: string
  sector: 1 | 2 | 3
  /** The next drop number. Forks and services share the stage they lead toward. */
  depth: number
  theme: ThemeName
  risk: 'safe' | 'risky' | 'boss'
  layout: LayoutId
  reward?: 'upgrade' | 'relic'
  next?: string
  blurb: string
  options?: ForkOption[]
  anomaly?: AnomalyId
  eventId?: EventId
  /** 99 means a complete repair, including shells added by a build. */
  repairAmount?: number
  encounter?: EncounterId
}

export interface RouteOptions {
  loop?: number
  ascension?: number
  /** Version 2 retains the pre-guardian seeded expedition exactly. */
  rules?: 2 | 3
}

export const ACT_NAMES = ['The Brass Garden', 'The Ember Foundry', 'The Astral Engine'] as const

/**
 * Ten machines form an expedition; the optional Ante adds an eleventh.
 * Every fork rejoins, so no reward roll or event can accidentally strand a run.
 * Safe branches trade speed and relic income for gentler geometry. Layout,
 * anomaly, and room identity all come from the supplied seeded stream.
 */
export function createRoute(rng: () => number, options: RouteOptions = {}): { start: string; nodes: Record<string, GameNode> } {
  const loop = Math.max(0, Math.floor(options.loop ?? 0))
  const ascension = Math.max(0, Math.floor(options.ascension ?? 0))
  const nodes: Record<string, GameNode> = {}
  const title = (names: string[]) => names[irand(rng, names.length)]
  const anomaly = (force = false): AnomalyId | undefined =>
    force || rng() < Math.min(0.86, 0.3 + loop * 0.12 + ascension * 0.045)
      ? ANOMALY_IDS[irand(rng, ANOMALY_IDS.length)]
      : undefined

  const add = (
    id: string,
    kind: GameNode['kind'],
    name: string,
    sector: GameNode['sector'],
    depth: number,
    layout: LayoutId,
    props: Partial<GameNode> = {},
  ) => {
    const theme: ThemeName = sector === 1 ? 'workshop' : sector === 2 ? 'foundry' : 'gravity'
    nodes[id] = {
      id, kind, title: name, kicker: `Act ${['I', 'II', 'III'][sector - 1]} · ${ACT_NAMES[sector - 1]}`,
      sector, depth, theme, layout, risk: 'safe', blurb: '', ...props,
    }
  }
  const fork = (id: string, name: string, sector: GameNode['sector'], depth: number, choices: ForkOption[]) => {
    // Ordering varies, while the label always describes the actual route.
    const ordered = rng() < 0.5 ? [...choices].reverse() : choices
    add(id, 'fork', name, sector, depth, sector === 1 ? 'garden' : sector === 2 ? 'furnace' : 'core', { options: ordered })
  }

  add('workshop', 'drop', 'The Workshop', 1, 1, 'workshop', {
    reward: 'upgrade', next: 'fork-lane',
    blurb: 'Find a line through the brass. Flip toward gold, or keep the calm lane.',
    anomaly: loop > 0 ? anomaly(true) : undefined,
  })
  fork('fork-lane', 'Two ways to wake the Helix', 1, 2, [
    { title: 'The Garden', detail: 'A gentle spring room without spikes. Choose a relic afterward.', risk: 'safe', next: 'garden' },
    { title: 'The Furnace', detail: 'Moving pegs, spikes, and richer payouts. Choose a relic afterward.', risk: 'risky', next: 'furnace' },
  ])
  add('garden', 'drop', title(['The Glass Garden', 'The Moss Clock', 'The Conservatory']), 1, 2, 'garden', {
    reward: 'relic', next: 'salvage', anomaly: anomaly(),
    blurb: 'Vanishing teeth open fresh lanes. The spring gives a line another chance.',
  })
  add('furnace', 'drop', title(['The Furnace', 'The Cinder Loom', 'The Coal Harp']), 1, 2, 'furnace', {
    risk: 'risky', reward: 'relic', next: 'salvage', anomaly: anomaly(true),
    blurb: 'The rich lane hides moving pegs and spikes. Spend control before the edges spend shell.',
  })
  add('salvage', 'event', 'A voice in the scrap', 1, 3, 'garden', {
    eventId: 'salvage', next: 'fork-brass',
    blurb: 'A dismantled automaton still has something to trade.',
  })
  fork('fork-brass', 'Set the rhythm of your build', 1, 3, [
    { title: 'The Quiet Gallery', detail: 'A forgiving garden. Gather gears while protecting the shell.', risk: 'safe', next: 'gallery' },
    { title: 'The Golden Kiln', detail: 'A furnace under an anomaly. Take an extra relic.', risk: 'risky', next: 'kiln' },
  ])
  add('gallery', 'drop', title(['The Quiet Gallery', 'The Waterwheel', 'The Brass Choir']), 1, 3, 'garden', {
    next: 'shop-brass', anomaly: anomaly(),
    blurb: 'Take a breath. Gather gears for the counter and keep the shell whole.',
  })
  add('kiln', 'drop', title(['The Golden Kiln', 'The Ember Vessel', 'The Gilding Press']), 1, 3, 'furnace', {
    risk: 'risky', reward: 'relic', next: 'shop-brass', anomaly: anomaly(true),
    blurb: 'A relic waits beyond the hot lane. The shell pays for careless greed.',
  })
  add('shop-brass', 'shop', 'The Brass Counter', 1, 4, 'garden', { next: 'rest-brass' })
  add('rest-brass', 'repair', 'The Lantern Bench', 1, 4, 'garden', {
    repairAmount: 99, next: 'press', blurb: 'The keeper restores the entire shell before the next act.',
  })

  add('press', 'drop', title(['The Press', 'The Iron Cathedral', 'The Tempering Engine']), 2, 4, 'elite', {
    risk: 'risky', reward: 'upgrade', next: 'fork-mid', anomaly: anomaly(),
    blurb: 'Reinforced teeth and moving lanes test the machine you have built.',
  })
  fork('fork-mid', 'Choose your fuel', 2, 5, [
    { title: 'The Cooling Works', detail: 'A spring garden. Bank gears and preserve shell for the next engine.', risk: 'safe', next: 'cooling' },
    { title: 'The High Forge', detail: 'An elite furnace with a guaranteed anomaly. Earn a relic.', risk: 'risky', next: 'forge' },
  ])
  add('cooling', 'drop', title(['The Cooling Works', 'The Verdigris Vault', 'The Steam Garden']), 2, 5, 'garden', {
    next: 'resonance', anomaly: anomaly(),
    blurb: 'The foundry keeps a quiet garden where the machines cool.',
  })
  add('forge', 'drop', title(['The High Forge', 'The Red Observatory', 'The Hammer Choir']), 2, 5, 'elite', {
    risk: 'risky', reward: 'relic', next: 'resonance', anomaly: anomaly(true),
    blurb: 'There is a relic in the furnace. Keep enough shell to carry it.',
  })
  add('resonance', 'event', 'The Resonance Chamber', 2, 6, 'furnace', {
    eventId: 'resonance', next: 'fork-service', blurb: 'The engine listens to the rhythm of your build.',
  })
  fork('fork-service', 'A debt or a certainty', 2, 6, [
    { title: 'The Counter', detail: 'Choose visible parts and buy a repair.', risk: 'safe', next: 'shop' },
    { title: 'The Bargain', detail: 'Trade shell for a relic, buy a blind upgrade, or take scrap.', risk: 'risky', next: 'bargain' },
  ])
  add('shop', 'shop', 'The Ember Counter', 2, 6, 'furnace', { next: 'dynamo' })
  add('bargain', 'bargain', 'The Bargain', 2, 6, 'furnace', { next: 'dynamo', risk: 'risky' })
  const dynamoLayout: LayoutId = rng() < 0.5 ? 'furnace' : 'elite'
  add('dynamo', 'drop', title(['The Heart Dynamo', 'The Bellows', 'The Solar Crucible']), 2, 6, dynamoLayout, {
    risk: 'risky', next: 'rest-ember', anomaly: anomaly(true),
    blurb: 'The foundry gives up its last gears before the stars. A full repair waits beyond.',
  })
  add('rest-ember', 'repair', 'The Starlight Bench', 2, 7, 'core', {
    repairAmount: 99, next: 'observatory', blurb: 'A full shell for the Astral Engine. Every build gets a fresh chance.',
  })

  add('observatory', 'drop', title(['The Observatory', 'The Lunar Loom', 'The Starfall Archive']), 3, 7, 'core', {
    reward: 'upgrade', next: 'fork-late', anomaly: anomaly(),
    blurb: 'Gravity wells pull at the line. A portal can turn a descent into another chance.',
  })
  fork('fork-late', 'How much is one more machine worth?', 3, 8, [
    { title: 'Repair the shell', detail: 'Restore two integrity, then enter the Gravity Core.', risk: 'safe', next: 'repair' },
    { title: 'Jackpot Ante', detail: 'One optional gold room, a relic, and a jackpot at ×3. The edges bite.', risk: 'risky', next: 'ante' },
  ])
  add('repair', 'repair', 'The Moonlit Bench', 3, 8, 'core', {
    repairAmount: 2, next: 'core', blurb: 'Restore up to two shell before committing to the core.',
  })
  add('ante', 'drop', title(['The Ante', 'The Golden Eclipse', 'The Last Wager']), 3, 8, 'ante', {
    risk: 'risky', reward: 'relic', next: 'core', anomaly: anomaly(true),
    blurb: 'An optional machine: gold, spikes, and a jackpot. Riches matter only if the shell survives.',
  })
  add('core', 'drop', 'The Gravity Core', 3, 8, 'core', {
    risk: 'risky', reward: 'relic', next: 'oracle', anomaly: anomaly(true),
    blurb: 'Wells bend the fall. Build a scoring engine from every door and rebound.',
  })
  add('oracle', 'event', 'The Sleeping Oracle', 3, 9, 'core', {
    eventId: 'oracle', next: 'fork-horizon', blurb: 'The last keeper offers a choice before the Grinder.',
  })
  fork('fork-horizon', 'The last constellation', 3, 9, [
    { title: 'The Celestial Garden', detail: 'A gentle final machine. Choose an upgrade.', risk: 'safe', next: 'horizon-safe' },
    { title: 'The Event Horizon', detail: 'An anomalous gravity engine. Choose one last relic.', risk: 'risky', next: 'horizon' },
  ])
  add('horizon-safe', 'drop', title(['The Celestial Garden', 'The Silent Astrolabe', 'The Silver Orchard']), 3, 9, 'garden', {
    reward: 'upgrade', next: 'shop-final', anomaly: anomaly(),
    blurb: 'A quiet final line. Choose what the build still needs.',
  })
  add('horizon', 'drop', title(['The Event Horizon', 'The Singularity', 'The Black Sun']), 3, 9, 'core', {
    risk: 'risky', reward: 'relic', next: 'shop-final', anomaly: anomaly(true),
    blurb: 'Take the long way through gravity for one last relic.',
  })
  add('shop-final', 'shop', 'The Last Counter', 3, 10, 'core', { next: 'grinder' })
  add('grinder', 'boss', 'The Grinder', 3, 10, 'grinder', {
    risk: 'boss', theme: 'grinder', blurb: 'Break the core. Read its return rhythm, protect the shell, and claim the maw.',
  })

  // Apply new content only after the original route stream has finished. Shared
  // v2 challenges and saved expeditions keep their rooms, descriptions and RNG
  // outcomes; v3 adds the optional guardians without moving any existing roll.
  if (options.rules !== 2) {
    nodes.gallery.encounter = 'bellkeeper'
    nodes.gallery.blurb = 'The Bellkeeper guards three chimes. Strike each for 70 gears and a relic. Linked bells retract; one safe-pocket return preserves progress. Gutters still cost shell.'
    nodes.kiln.encounter = 'bellkeeper'
    nodes.kiln.blurb = 'An anomalous Bellkeeper. The relic is guaranteed if you survive; all three chimes pay 70 extra gears. One safe-pocket return preserves progress. Gutters still cost shell.'
    nodes.dynamo.encounter = 'heartforge'
    nodes.dynamo.blurb = 'The Heartforge answers in pairs: I → II → I → II. Complete its relay for 120 gears and a relic. One safe-pocket return keeps progress; gutters still cost shell. A full repair waits beyond.'
    for (const option of nodes['fork-brass'].options!) {
      if (option.next === 'gallery') {
        option.title = 'The Bellkeeper’s Garden'
        option.detail = 'A forgiving relay guardian. Strike three bells for 70 gears and a relic. One safe-pocket return.'
      } else if (option.next === 'kiln') {
        option.title = 'The Bellkeeper’s Kiln'
        option.detail = 'An anomalous furnace with a guaranteed relic. Complete its three bells for 70 extra gears. One safe-pocket return.'
      }
    }
  }

  return { start: 'workshop', nodes }
}

export const SECTOR_LORE: Record<number, string> = {
  1: 'workshop', 2: 'foundry', 3: 'gravity',
}
