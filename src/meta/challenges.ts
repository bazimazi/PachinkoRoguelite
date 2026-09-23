import { CHALLENGES } from '../content/catalog'
import type { SaveData } from './save'
import { TUNING } from '../tuning'

export interface RunFacts {
  bestCombo: number
  bestMult: number
  cleanDrop: boolean
  bossWin: boolean
  shatters: number
  portals: number
  score: number
  flipGold: boolean
  jackpots: number
  ballId: string
}

export function grantChallenges(save: SaveData, facts: RunFacts): string[] {
  const fresh: string[] = []
  const done = (id: string, ok: boolean) => {
    if (!ok || save.challenges.includes(id)) return
    save.challenges.push(id)
    save.shards += TUNING.challengeShards
    fresh.push(CHALLENGES.find((c) => c.id === id)?.name ?? id)
  }
  done('combo10', facts.bestCombo >= 10)
  done('mult4', facts.bestMult >= 4)
  done('clean', facts.cleanDrop)
  done('grinder', facts.bossWin)
  done('shatter8', facts.shatters >= 8)
  done('portal', facts.portals > 0)
  done('score1500', facts.score >= 1500)
  done('flip-gold', facts.flipGold)
  done('jackpot', facts.jackpots > 0)
  done('win-rubber', facts.bossWin && facts.ballId === 'rubber')
  done('win-prism', facts.bossWin && facts.ballId === 'prism')
  done('win-void', facts.bossWin && facts.ballId === 'void')
  return fresh
}
