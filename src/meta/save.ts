import { TRAILS } from '../content/catalog'

export interface Settings {
  shake: boolean
  particles: boolean
  flash: boolean
  large: boolean
  volume: number
}

export interface SaveData {
  version: 1
  shards: number
  runs: number
  bestScore: number
  bestCombo: number
  bestMult: number
  balls: string[]
  ball: string
  researched: string[]
  seenRelics: string[]
  seenParts: string[]
  challenges: string[]
  trails: string[]
  trail: string
  lore: string[]
  lifetime: { pegs: number; golds: number; shatters: number; jackpots: number; portals: number }
  settings: Settings
}

const KEY = 'plumb-save-v1'

function fresh(): SaveData {
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  return {
    version: 1,
    shards: 0,
    runs: 0,
    bestScore: 0,
    bestCombo: 0,
    bestMult: 1,
    balls: ['rubber'],
    ball: 'rubber',
    researched: [],
    seenRelics: [],
    seenParts: [],
    challenges: [],
    trails: [],
    trail: '',
    lore: [],
    lifetime: { pegs: 0, golds: 0, shatters: 0, jackpots: 0, portals: 0 },
    settings: {
      shake: !reduce,
      particles: true,
      flash: !reduce,
      large: false,
      volume: 0.7,
    },
  }
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return fresh()
    const parsed = JSON.parse(raw) as SaveData
    if (!parsed || parsed.version !== 1) return fresh()
    const base = fresh()
    return {
      ...base,
      ...parsed,
      balls: parsed.balls?.length ? parsed.balls : ['rubber'],
      settings: { ...base.settings, ...parsed.settings },
      lifetime: { ...base.lifetime, ...parsed.lifetime },
      trail: TRAILS.some((t) => t.id === parsed.trail) || parsed.trail === 'brass' ? parsed.trail : 'brass',
    }
  } catch {
    return fresh()
  }
}

export function writeSave(save: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save))
  } catch {
    /* private mode or a full disk — the fall still happens */
  }
}

export function shardsFor(score: number, drops: number, win: boolean): number {
  return 5 + drops * 3 + Math.floor(score / 120) + (win ? 8 : 0)
}
