import { RELICS, UPGRADES, type RelicDef, type UpgradeDef } from '../content/catalog'
import { pickIndex, rngFor } from '../core/rng'
import { hypotheticalSynergy } from '../sim/profile'
import { STARTER_RELICS } from '../tuning'

export interface Offer {
  kind: 'upgrade' | 'relic'
  id: string
  name: string
  tags: string[]
  text: string
  synergy: string | null
  price: number
}

export function availableRelicIds(researched: string[]): string[] {
  const extra = researched.filter((id) => RELICS[id])
  return [...STARTER_RELICS, ...extra]
}

function take<T extends { id: string; tags: string[] }>(
  rng: () => number,
  pool: T[],
  n: number,
  primary: string,
): T[] {
  const bag = [...pool]
  const out: T[] = []
  while (out.length < n && bag.length) {
    const weights = bag.map((item) => (item.tags.includes(primary) ? 3 : 1))
    const i = pickIndex(rng, weights)
    out.push(bag.splice(i, 1)[0])
  }
  if (out.length >= 2 && out.every((item) => item.tags.includes(primary))) {
    const off = bag.find((item) => !item.tags.includes(primary))
    if (off) out[out.length - 1] = off
  }
  return out
}

function toOffer(
  kind: 'upgrade' | 'relic',
  def: UpgradeDef | RelicDef,
  ballId: string,
  upgrades: string[],
  relics: string[],
  price: number,
): Offer {
  return {
    kind,
    id: def.id,
    name: def.name,
    tags: def.tags,
    text: def.text,
    synergy: hypotheticalSynergy(ballId, upgrades, relics, { kind, id: def.id }),
    price,
  }
}

export function rollReward(
  kind: 'upgrade' | 'relic',
  ballId: string,
  primary: string,
  upgrades: string[],
  relics: string[],
  researched: string[],
  seed: string,
  salt: string,
): Offer[] {
  const rng = rngFor(seed, salt)
  if (kind === 'upgrade') {
    const pool = Object.values(UPGRADES).filter((u) => !upgrades.includes(u.id))
    return take(rng, pool, 3, primary).map((u) => toOffer('upgrade', u, ballId, upgrades, relics, 0))
  }
  const pool = availableRelicIds(researched)
    .map((id) => RELICS[id])
    .filter((r) => r && !relics.includes(r.id))
  return take(rng, pool, 3, primary).map((r) => toOffer('relic', r, ballId, upgrades, relics, 0))
}

export function rollShop(
  ballId: string,
  primary: string,
  upgrades: string[],
  relics: string[],
  researched: string[],
  seed: string,
  salt: string,
): Offer[] {
  const rng = rngFor(seed, salt)
  const ups = Object.values(UPGRADES).filter((u) => !upgrades.includes(u.id))
  const rel = availableRelicIds(researched)
    .map((id) => RELICS[id])
    .filter((r) => r && !relics.includes(r.id))
  const pickedU = take(rng, ups, rel.length ? 2 : 3, primary)
  const pickedR = rel.length ? take(rng, rel, 1, primary) : []
  return [
    ...pickedU.map((u) => toOffer('upgrade', u, ballId, upgrades, relics, 22)),
    ...pickedR.map((r) => toOffer('relic', r, ballId, upgrades, relics, 34)),
  ]
}

export function randomFrom(
  kind: 'upgrade' | 'relic',
  ballId: string,
  upgrades: string[],
  relics: string[],
  researched: string[],
  seed: string,
  salt: string,
): Offer | null {
  const list = rollReward(kind, ballId, 'none', upgrades, relics, researched, seed, salt)
  return list[0] ?? null
}
