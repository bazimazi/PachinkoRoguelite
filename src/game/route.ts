import type { LayoutId, ThemeName } from '../sim/board'
import { irand } from '../core/rng'

export interface ForkOption {
  title: string
  detail: string
  risk: 'safe' | 'risky'
  next: string
}

export interface GameNode {
  id: string
  kind: 'drop' | 'boss' | 'fork' | 'shop' | 'repair' | 'bargain'
  title: string
  kicker: string
  sector: 1 | 2 | 3
  theme: ThemeName
  risk: 'safe' | 'risky' | 'boss'
  layout: LayoutId
  reward?: 'upgrade' | 'relic'
  next?: string
  blurb: string
  options?: ForkOption[]
}

const NODES: Record<string, GameNode> = {
  workshop: {
    id: 'workshop',
    kind: 'drop',
    title: 'The Workshop',
    kicker: 'Sector I',
    sector: 1,
    theme: 'workshop',
    risk: 'safe',
    layout: 'workshop',
    reward: 'upgrade',
    next: 'fork-lane',
    blurb: 'Flip toward the gold, or stay in the calm lane.',
  },
  'fork-lane': {
    id: 'fork-lane',
    kind: 'fork',
    title: 'The machine splits',
    kicker: 'Sector I',
    sector: 1,
    theme: 'workshop',
    risk: 'safe',
    layout: 'garden',
    blurb: '',
    options: [
      {
        title: 'The Garden',
        detail: 'A quieter machine. Vanishing pegs, a spring, no spikes.',
        risk: 'safe',
        next: 'garden',
      },
      {
        title: 'The Furnace',
        detail: 'Moving pegs and spikes guard a richer gold lane.',
        risk: 'risky',
        next: 'furnace',
      },
    ],
  },
  garden: {
    id: 'garden',
    kind: 'drop',
    title: 'The Garden',
    kicker: 'Sector I',
    sector: 1,
    theme: 'workshop',
    risk: 'safe',
    layout: 'garden',
    reward: 'relic',
    next: 'fork-mid',
    blurb: 'No spikes. The gutters still bite. A spring can throw you back up.',
  },
  furnace: {
    id: 'furnace',
    kind: 'drop',
    title: 'The Furnace',
    kicker: 'Sector II',
    sector: 2,
    theme: 'foundry',
    risk: 'risky',
    layout: 'furnace',
    reward: 'relic',
    next: 'fork-mid',
    blurb: 'Spikes guard the rich side. Moving pegs shove.',
  },
  'fork-mid': {
    id: 'fork-mid',
    kind: 'fork',
    title: 'A pause in the fall',
    kicker: 'Sector II',
    sector: 2,
    theme: 'foundry',
    risk: 'safe',
    layout: 'elite',
    blurb: '',
    options: [
      {
        title: 'Open the shop',
        detail: 'Spend gears on a part you can see.',
        risk: 'safe',
        next: 'shop',
      },
      {
        title: 'Take the bargain',
        detail: 'Crack a shell for a relic, or pay gears blind.',
        risk: 'risky',
        next: 'bargain',
      },
    ],
  },
  shop: {
    id: 'shop',
    kind: 'shop',
    title: 'The Counter',
    kicker: 'Sector II',
    sector: 2,
    theme: 'foundry',
    risk: 'safe',
    layout: 'elite',
    next: 'press',
    blurb: '',
  },
  bargain: {
    id: 'bargain',
    kind: 'bargain',
    title: 'The Bargain',
    kicker: 'Sector II',
    sector: 2,
    theme: 'foundry',
    risk: 'risky',
    layout: 'elite',
    next: 'press',
    blurb: '',
  },
  press: {
    id: 'press',
    kind: 'drop',
    title: 'The Press',
    kicker: 'Sector II',
    sector: 2,
    theme: 'foundry',
    risk: 'risky',
    layout: 'elite',
    reward: 'upgrade',
    next: 'fork-late',
    blurb: 'An elite machine. The edges bite. The center is reinforced.',
  },
  'fork-late': {
    id: 'fork-late',
    kind: 'fork',
    title: 'Before the core',
    kicker: 'Sector II',
    sector: 2,
    theme: 'foundry',
    risk: 'safe',
    layout: 'ante',
    blurb: '',
    options: [
      {
        title: 'Repair the shell',
        detail: 'Restore one integrity. If you are whole, take scrap instead.',
        risk: 'safe',
        next: 'repair',
      },
      {
        title: 'Jackpot ante',
        detail: 'A short, vicious gold room. The center bin jackpots at ×3.',
        risk: 'risky',
        next: 'ante',
      },
    ],
  },
  repair: {
    id: 'repair',
    kind: 'repair',
    title: 'The Bench',
    kicker: 'Sector II',
    sector: 2,
    theme: 'foundry',
    risk: 'safe',
    layout: 'core',
    next: 'core',
    blurb: '',
  },
  ante: {
    id: 'ante',
    kind: 'drop',
    title: 'The Ante',
    kicker: 'Sector II',
    sector: 2,
    theme: 'foundry',
    risk: 'risky',
    layout: 'ante',
    next: 'core',
    blurb: 'Gold is everywhere. So are spikes. Jackpot needs ×3 in the center.',
  },
  core: {
    id: 'core',
    kind: 'drop',
    title: 'The Gravity Core',
    kicker: 'Sector III',
    sector: 3,
    theme: 'gravity',
    risk: 'risky',
    layout: 'core',
    next: 'grinder',
    blurb: 'Wells bend the fall. The portal is a door, not a prize — unless you made it one.',
  },
  grinder: {
    id: 'grinder',
    kind: 'boss',
    title: 'The Grinder',
    kicker: 'Sector III',
    sector: 3,
    theme: 'grinder',
    risk: 'boss',
    layout: 'grinder',
    blurb: 'Hit the core five times. Do not let it spit you into the gutters.',
  },
}

export function createRoute(rng: () => number): { start: string; nodes: Record<string, GameNode> } {
  const nodes: Record<string, GameNode> = {}
  for (const [id, node] of Object.entries(NODES)) {
    const copy: GameNode = { ...node, options: node.options ? node.options.map((o) => ({ ...o })) : undefined }
    if (copy.options && rng() < 0.5 && copy.options.length === 2) {
      const flip = irand(rng, 2) === 0
      if (flip) copy.options = [copy.options[1], copy.options[0]]
    }
    nodes[id] = copy
  }
  return { start: 'workshop', nodes }
}

export const SECTOR_LORE: Record<number, string> = {
  1: 'workshop',
  2: 'foundry',
  3: 'gravity',
}
