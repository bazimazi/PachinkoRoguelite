import { BALL_LIST } from '../content/catalog'
import { hashString, rngFor } from '../core/rng'

export type RulesVersion = 2 | 3
export const CURRENT_RULES: RulesVersion = 3

export const ASCENSIONS = [
  'The original expedition. Three acts, a living build, one Grinder.',
  'Restless machinery: moving pegs travel 20% farther.',
  'Lean reserves: one fewer nudge per drop. Previous trials remain.',
  'Dearer metal: shop prices rise 25%. Previous trials remain.',
  'Narrow passage: gates are 16% narrower. Previous trials remain.',
  'Brittle heart: one less maximum shell. Previous trials remain.',
  'Convergence: every machine has an anomaly. Previous trials remain.',
] as const

export interface ExpeditionFacts {
  score: number
  bestCombo: number
  golds: number
  pegs: number
  portals: number
  shatters: number
  cleanDrops: number
  jackpots: number
}

export interface Commission {
  id: string
  name: string
  text: string
  stat: keyof ExpeditionFacts
  target: number
  gears: number
}

export const COMMISSIONS: Commission[] = [
  { id: 'chain', name: 'A singing machine', text: 'Reach a 12-hit combo in one drop.', stat: 'bestCombo', target: 12, gears: 45 },
  { id: 'gold', name: 'Gold fever', text: 'Strike 12 gold pegs across the expedition.', stat: 'golds', target: 12, gears: 55 },
  { id: 'survey', name: 'Chart the mechanism', text: 'Strike 70 pegs across the expedition.', stat: 'pegs', target: 70, gears: 45 },
  { id: 'clean', name: 'An elegant descent', text: 'Land safely without damage in 3 drops.', stat: 'cleanDrops', target: 3, gears: 60 },
  { id: 'fortune', name: 'A small fortune', text: 'Earn 1,500 score in the expedition.', stat: 'score', target: 1500, gears: 55 },
  { id: 'jackpot', name: 'Wake the collector', text: 'Land one hot jackpot.', stat: 'jackpots', target: 1, gears: 80 },
]

export function commissionSet(seed: string): string[] {
  const rng = rngFor(seed, 'commissions-v2')
  const bag = [...COMMISSIONS]
  const out: string[] = []
  while (out.length < 3) out.push(bag.splice(Math.floor(rng() * bag.length), 1)[0].id)
  return out
}

/** Shared date boundary, independent of a player's local timezone. No streak penalties. */
export function dailyExpedition(now = new Date()): { date: string; seed: string; ballId: string } {
  const date = now.toISOString().slice(0, 10)
  const seed = `DAY${date.replaceAll('-', '')}`
  return { date, seed, ballId: BALL_LIST[hashString(seed) % BALL_LIST.length].id }
}

export interface RunRecord {
  seed: string
  ballId: string
  mode: 'expedition' | 'daily'
  ascension: number
  score: number
  drops: number
  clears: number
  win: boolean
  combo: number
  relics: string[]
  upgrades: string[]
  date: string
  catalogue?: string[]
  /** Absent on the original expedition records, which use rules 2. */
  rules?: RulesVersion
}

export function challengeUrl(base: string, run: Pick<RunRecord, 'seed' | 'ballId' | 'mode' | 'ascension' | 'catalogue' | 'rules'>): string {
  const url = new URL(base)
  url.search = ''
  url.hash = ''
  url.searchParams.set('seed', run.seed)
  url.searchParams.set('sphere', run.ballId)
  url.searchParams.set('trial', String(run.ascension))
  if (run.mode === 'daily') url.searchParams.set('daily', '1')
  url.searchParams.set('rules', String(run.rules ?? 2))
  if (run.catalogue) url.searchParams.set('archive', run.catalogue.join(','))
  return url.toString()
}

const CHECKPOINT_KEY = 'plumb-expedition-v2'
export function readCheckpoint(): unknown {
  try { return JSON.parse(localStorage.getItem(CHECKPOINT_KEY) || 'null') }
  catch { return null }
}
export function writeCheckpoint(data: unknown): void {
  try { localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(data)) } catch { /* optional storage */ }
}
export function clearCheckpoint(): void {
  try { localStorage.removeItem(CHECKPOINT_KEY) } catch { /* optional storage */ }
}
