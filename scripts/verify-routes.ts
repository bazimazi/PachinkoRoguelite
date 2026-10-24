/** Seeded route graph and actual simulation checks. Run with: npx tsx scripts/verify-routes.ts */
import assert from 'node:assert/strict'
import { createRoute, type GameNode } from '../src/game/route'
import { rngFor } from '../src/core/rng'
import { ANOMALIES, ANOMALY_IDS, applyAnomaly } from '../src/sim/anomaly'
import { createBoard } from '../src/sim/generate'
import { Drop } from '../src/sim/drop'
import { computeProfile } from '../src/sim/profile'
import { BALL_LIST, RELICS, UPGRADES } from '../src/content/catalog'
import type { LayoutId } from '../src/sim/board'
import { TUNING } from '../src/tuning'

let routeCount = 0
let paths = 0
let simulations = 0
const variants = new Set<string>()
const layoutVariants = new Set<string>()

function edges(node: GameNode): string[] {
  return node.options?.map((o) => o.next) ?? (node.next ? [node.next] : [])
}

for (let seed = 0; seed < 48; seed++) {
  for (const [loop, ascension] of [[0, 0], [1, 3], [3, 6]]) {
    const key = `ROUTE${seed}`
    const make = () => createRoute(rngFor(key, `route:${loop}`), { loop, ascension })
    const route = make()
    assert.deepEqual(route, make(), 'A seed, loop and ascension must rebuild the same route')
    variants.add(JSON.stringify(route))
    layoutVariants.add(route.nodes.dynamo.layout)
    assert.equal(route.start, 'workshop')
    assert.equal(route.nodes.grinder.kind, 'boss')
    assert.equal(route.nodes.core.reward, 'relic')
    assert.equal(route.nodes.grinder.anomaly, undefined, 'Boss return geometry must stay protected')
    assert.equal(route.nodes['rest-brass'].repairAmount, 99)
    assert.equal(route.nodes['rest-ember'].repairAmount, 99)
    const visited = new Set<string>()
    const walk = (id: string, chain: string[], drops: number, rewards: number, acts: number[]) => {
      assert.ok(!chain.includes(id), `${key}: route cycle at ${id}`)
      const node = route.nodes[id]
      assert.ok(node, `${key}: missing node ${id}`)
      visited.add(id)
      assert.equal(node.id, id)
      assert.ok(Number.isInteger(node.depth) && node.depth >= 1)
      if (node.anomaly) assert.ok(ANOMALIES[node.anomaly])
      if (node.kind === 'event') assert.ok(node.eventId)
      if (node.kind === 'repair') assert.ok((node.repairAmount ?? 0) > 0)
      const drop = node.kind === 'drop' || node.kind === 'boss'
      const count = drops + Number(drop)
      const drafts = rewards + Number(Boolean(node.reward))
      const sectorDrops = [...acts]
      if (drop) sectorDrops[node.sector - 1]++
      const next = edges(node)
      if (node.kind === 'fork') {
        assert.equal(next.length, 2, `${id} has a meaningful binary choice`)
        assert.notEqual(next[0], next[1])
        assert.ok(node.options!.some((o) => o.risk === 'safe'))
        assert.ok(node.options!.some((o) => o.risk === 'risky'))
      }
      if (!next.length) {
        assert.equal(id, 'grinder', 'Every branch must reach the final boss')
        assert.ok(count === 10 || count === 11, `Expected 10-11 drops; got ${count}`)
        assert.ok(drafts >= 6 && drafts <= 9, `Expected a deliberate 6-9 drafts; got ${drafts}`)
        assert.deepEqual(sectorDrops.slice(0, 2), [3, 3])
        assert.ok(sectorDrops[2] === 4 || sectorDrops[2] === 5)
        assert.ok(chain.includes('rest-brass') && chain.includes('rest-ember'), 'Every path has two full repairs')
        assert.ok(chain.includes('salvage') && chain.includes('resonance') && chain.includes('oracle'))
        paths++
        return
      }
      for (const target of next) {
        const dest = route.nodes[target]
        assert.ok(dest, `Missing destination ${target}`)
        assert.ok(dest.sector >= node.sector, 'The expedition may only descend between acts')
        walk(target, [...chain, id], count, drafts, sectorDrops)
      }
    }
    walk(route.start, [], 0, 0, [0, 0, 0])
    assert.equal(visited.size, Object.keys(route.nodes).length, 'Every generated room must be reachable')
    routeCount++
  }
}
assert.ok(variants.size > 100, 'Seed and difficulty must produce meaningful route variety')
assert.equal(layoutVariants.size, 2, 'The mid-act engine should vary its layout')

const layouts: LayoutId[] = ['workshop', 'garden', 'furnace', 'elite', 'ante', 'core']
let maxTime = 0
for (const layout of layouts) {
  for (const id of ANOMALY_IDS) {
    for (const intensity of [1, 3, 4]) {
      const make = () => createBoard({ layout, title: layout, tutorial: false, rng: rngFor('EXPEDITION', layout) })
      const board = make()
      const baseline = make()
      const hazardCount = baseline.zones.filter((z) => z.kind === 'spike').length
      applyAnomaly(board, id, intensity)
      const other = applyAnomaly(make(), id, intensity)
      assert.deepEqual(board, other, 'Anomalies must be deterministic and isolated from visual randomness')
      assert.notDeepEqual(board, baseline, 'An anomaly must change gameplay')
      assert.ok(board.payout > baseline.payout)
      assert.equal(board.zones.filter((z) => z.kind === 'spike').length, hazardCount, 'Anomalies must not add hidden shell attrition')
      for (const peg of board.pegs) {
        assert.ok(Number.isFinite(peg.x) && Number.isFinite(peg.y))
        assert.ok(peg.x - peg.r > board.margin && peg.x + peg.r < board.w - board.margin)
        if (peg.motion) assert.ok(peg.motion.period > 0 && peg.motion.amp > 0)
      }
      if (id === 'springtide') assert.ok(board.zones.filter((z) => z.kind === 'spring').length > baseline.zones.filter((z) => z.kind === 'spring').length)
      if (id === 'orbital') assert.ok(board.zones.filter((z) => z.kind === 'well').length > baseline.zones.filter((z) => z.kind === 'well').length)
      // Exercise the cumulative high-trial geometry with the strongest modifier.
      if (intensity === 4) {
        board.gapWidth *= 0.84
        for (const peg of board.pegs) if (peg.motion) peg.motion.amp *= 1.2
      }
      for (const ball of BALL_LIST) {
        for (const angle of [-0.4, 0, 0.4]) {
          const profile = computeProfile(ball.id, [], [])
          if (intensity === 4) {
            profile.integrityMax = Math.max(1, profile.integrityMax - 1)
            profile.maxNudges = Math.max(1, profile.maxNudges - 1)
            profile.gravityScale = 1.21
          }
          const drop = new Drop(board, ball.id, profile, profile.integrityMax, profile.integrityMax)
          drop.launch(angle)
          for (let step = 0; step < 95 / TUNING.dt && !drop.captured && !drop.dead; step++) {
            drop.step(TUNING.dt)
            drop.pullEvents()
            assert.ok(Number.isFinite(drop.ball.x) && Number.isFinite(drop.ball.y) && Number.isFinite(drop.ball.vx) && Number.isFinite(drop.ball.vy), `${layout}/${id}/${ball.id}: finite physics`)
          }
          assert.ok(drop.captured || drop.dead, `${layout}/${id}/${ball.id}/${angle}: every fall must settle`)
          assert.ok(drop.integrity >= 0 && drop.integrity <= profile.integrityMax)
          assert.ok(Number.isFinite(drop.earned) && drop.earned >= 0)
          maxTime = Math.max(maxTime, drop.time)
          simulations++
        }
      }
    }
  }
}

// A late circuit can carry the entire catalogue. Test that combination against
// maximum anomalies and cumulative trials, including actual net payout events.
for (const layout of [...layouts, 'grinder'] as LayoutId[]) {
  for (const id of layout === 'grinder' ? [ANOMALY_IDS[0]] : ANOMALY_IDS) {
    const board = applyAnomaly(createBoard({ layout, title: layout, tutorial: false, rng: rngFor('FULLBUILD', layout) }), id, 4)
    board.gapWidth *= 0.84
    for (const peg of board.pegs) if (peg.motion) peg.motion.amp *= 1.2
    board.payout *= 2.68
    for (const ball of BALL_LIST) {
      for (const angle of [-0.4, 0, 0.4]) {
        const profile = computeProfile(ball.id, Object.keys(UPGRADES), Object.keys(RELICS))
        profile.gravityScale = 1.21
        profile.integrityMax = Math.max(1, profile.integrityMax - 1)
        profile.maxNudges = Math.max(1, profile.maxNudges - 1)
        const drop = new Drop(board, ball.id, profile, profile.integrityMax, profile.integrityMax)
        drop.launch(angle)
        let payouts = 0
        for (let step = 0; step < 200 / TUNING.dt && !drop.captured && !drop.dead; step++) {
          drop.step(TUNING.dt * drop.timeScale)
          for (const event of drop.pullEvents()) payouts += event.gears ?? 0
          assert.ok(Number.isFinite(drop.ball.x) && Number.isFinite(drop.ball.y) && Number.isFinite(drop.earned), 'A complete build must keep finite physics and score')
        }
        assert.ok(drop.captured || drop.dead, `${layout}/${id}/${ball.id}: the complete build must resolve`)
        assert.equal(payouts, drop.earned, 'A complete build must reconcile every investment, trigger and landing payout')
        assert.ok(drop.arcPulses <= 3 && drop.flywheelRewards <= 4 && drop.goldRefunds <= 3)
        assert.ok(drop.nudges <= drop.maxNudges && drop.shatters <= 14 && drop.coreHits <= 5)
        simulations++
        maxTime = Math.max(maxTime, drop.time)
      }
    }
  }
}

// Modifiers must never compromise the tuned boss return circuit.
for (const id of ANOMALY_IDS) {
  const boss = createBoard({ layout: 'grinder', title: 'Grinder', tutorial: false, rng: rngFor('BOSS', 'boss') })
  const before = JSON.stringify(boss)
  applyAnomaly(boss, id, 4)
  assert.equal(JSON.stringify(boss), before)
}

console.log(`Passed: ${routeCount} seeded expeditions, ${paths} complete paths, ${simulations} anomalous falls. Longest fall: ${maxTime.toFixed(1)}s. All branches reach the boss, both act repairs, and all three events.`)
