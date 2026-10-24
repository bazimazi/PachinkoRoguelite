/** Deterministic guardian objectives, finite returns, and actual physical play. */
import assert from 'node:assert/strict'
import { BALL_LIST, RELIC_LIST, UPGRADE_LIST } from '../src/content/catalog'
import { rngFor } from '../src/core/rng'
import { createRoute } from '../src/game/route'
import { ANOMALY_IDS, applyAnomaly } from '../src/sim/anomaly'
import type { Board, EncounterId, LayoutId } from '../src/sim/board'
import { Drop, type Cmd } from '../src/sim/drop'
import { applyEncounter, ENCOUNTERS } from '../src/sim/encounter'
import { createBoard } from '../src/sim/generate'
import { computeProfile } from '../src/sim/profile'
import { TUNING } from '../src/tuning'

const empty: Cmd = { nudge: 0, flip: false, special: false, tilt: false, aimX: 400 }
let checks = 0
function check(name: string, run: () => void) { run(); checks++; console.log(`PASS ${name}`) }
function arena(id: EncounterId, extra: Partial<Board> = {}): Board {
  return {
    w: 800, h: 5000, theme: 'workshop', margin: 0, floorY: 4500,
    launchX: 400, launchY: 40, pegs: [],
    bumpers: (id === 'bellkeeper' ? [200, 400, 600] : [300, 500]).map((x, relay) => ({ x, y: 800, r: 35, relay })),
    walls: [], zones: [], bins: [{ x0: 0, x1: 150, kind: 'hazard' }, { x0: 150, x1: 800, kind: 'coin' }],
    shutterY: null, gapWidth: 0, gapStart: 0, goldSide: 'right', payout: 1,
    title: 'Guardian laboratory', features: [], boss: false, jackpot: false,
    encounter: { ...ENCOUNTERS[id], sequence: [...ENCOUNTERS[id].sequence] }, ...extra,
  }
}
function make(board: Board, relics: string[] = [], upgrades: string[] = [], ball = 'rubber') {
  const p = computeProfile(ball, upgrades, relics)
  const d = new Drop(board, ball, p, p.integrityMax, p.integrityMax)
  d.launch(0)
  d.pullEvents()
  return d
}
function strike(d: Drop, id: number, velocity = 650) {
  const b = d.board.bumpers.find(b => b.relay === id)!
  d.ball.x = b.x
  d.ball.y = b.y - b.r - d.ball.r + 1
  d.ball.vx = 0
  d.ball.vy = velocity
  d.step(TUNING.dt)
}
function wait(d: Drop, seconds = 0.32) {
  for (let i = 0; i < Math.ceil(seconds / TUNING.dt); i++) {
    d.ball.x = 200 + i % 3 * 150
    d.ball.y = 1800
    d.ball.vx = d.ball.vy = 0
    d.step(TUNING.dt)
  }
}
function pocket(d: Drop, x = 400) {
  d.ball.x = x
  d.ball.y = d.board.floorY + 120
  d.ball.vx = d.ball.vy = 0
  d.step(TUNING.dt)
}

check('guardian installation is deterministic and idempotent and never alters the Grinder', () => {
  for (const [layout, id] of [['garden', 'bellkeeper'], ['furnace', 'bellkeeper'], ['elite', 'heartforge']] as const) {
    const create = () => applyEncounter(createBoard({ layout, title: layout, tutorial: false, rng: rngFor('GUARDIAN', layout) }), id)
    const board = create()
    assert.deepEqual(board, create())
    const before = JSON.stringify(board)
    applyEncounter(board, id)
    assert.equal(JSON.stringify(board), before)
    const relays = board.bumpers.filter(b => b.relay != null)
    assert.equal(relays.length, id === 'bellkeeper' ? 3 : 2)
    assert.equal(board.boss, false)
    for (const b of relays) {
      assert.ok(b.x - b.r > board.margin && b.x + b.r < board.w - board.margin)
      assert.ok(b.y - b.r > (board.shutterY ?? 0) + 90 && b.y + b.r < board.floorY - 100)
      assert.ok(board.pegs.every(p => Math.hypot(p.x - b.x, p.y - b.y) > p.r + b.r + 34 + (p.motion?.amp ?? 0)))
    }
    const springBoard = applyAnomaly(createBoard({ layout, title: layout, tutorial: false, rng: rngFor('GUARDIAN', layout) }), 'springtide', 4)
    const springs = springBoard.zones.filter(z => z.kind === 'spring').length
    applyEncounter(springBoard, id)
    assert.equal(springBoard.zones.filter(z => z.kind === 'spring').length, springs, 'the guardian retains advertised anomaly mechanics')
  }
  const boss = createBoard({ layout: 'grinder', title: 'Grinder', tutorial: false, rng: rngFor('GUARDIAN', 'boss') })
  const before = JSON.stringify(boss)
  applyEncounter(boss, 'bellkeeper')
  assert.equal(JSON.stringify(boss), before)
})

check('Bellkeeper accepts each physical relay once in any order and linked bells retract', () => {
  const d = make(arena('bellkeeper'))
  assert.deepEqual(d.encounterTargets, [0, 1, 2])
  strike(d, 2)
  assert.equal(d.encounterProgress, 1)
  assert.deepEqual(d.encounterTargets, [0, 1])
  const before = d.earned
  strike(d, 2)
  assert.equal(d.encounterProgress, 1)
  assert.equal(d.earned, before, 'a retracted bell has no collision or repeat payout')
  strike(d, 0)
  strike(d, 1)
  assert.equal(d.encounterProgress, 3)
  assert.equal(d.encounterComplete, true)
  assert.deepEqual(d.encounterTargets, [])
  assert.equal(d.events.filter(e => e.type === 'encounter-clear').length, 1)
  assert.equal(d.events.find(e => e.type === 'encounter-clear')!.gears, 70)
  assert.equal(d.wonBoss, false)
  assert.equal(d.coreHits, 0)
})

check('Heartforge requires I-II-I-II; wrong and rattling contacts never advance it', () => {
  const d = make(arena('heartforge'))
  strike(d, 1)
  assert.equal(d.encounterProgress, 0)
  assert.equal(d.encounterTarget, 0)
  strike(d, 0)
  assert.equal(d.encounterProgress, 1)
  assert.equal(d.encounterTarget, 1)
  wait(d)
  strike(d, 0)
  assert.equal(d.encounterProgress, 1)
  strike(d, 1)
  assert.equal(d.encounterProgress, 2)
  wait(d)
  strike(d, 0)
  wait(d)
  strike(d, 1)
  assert.equal(d.encounterProgress, 4)
  assert.equal(d.lastRelay, 1)
  assert.equal(d.encounterComplete, true)
  assert.equal(d.encounterTarget, null)
  wait(d)
  strike(d, 0)
  strike(d, 1)
  assert.equal(d.encounterProgress, 4)
  assert.equal(d.events.filter(e => e.type === 'encounter-clear').length, 1)
})

check('only approaching physical contacts count; lightning and echo triggers cannot forge relays', () => {
  const d = make(arena('bellkeeper', { pegs: Array.from({ length: 12 }, (_, i) => ({ x: 250 + i * 15, y: 300, r: 10, row: 0, kind: 'normal' as const })) }), ['arc-coil', 'echo-core'])
  d.ball.x = 400
  d.ball.y = 300
  const seam = d as unknown as { bumpCombo(): void; onBumper(x: number, y: number, nx: number, ny: number): void; echo(dt: number): void }
  for (let i = 0; i < 8; i++) seam.bumpCombo()
  seam.onBumper(200, 800, 0, -1)
  seam.echo(1)
  assert.ok(d.arcPulses > 0)
  assert.equal(d.encounterProgress, 0)
  strike(d, 0, 0)
  assert.equal(d.encounterProgress, 0, 'resting overlap and gravity below the impact threshold do not count')
})

check('one safe return preserves progress and resources and pays no premature landing bonus', () => {
  const d = make(arena('bellkeeper'), [], ['landing-gear'])
  strike(d, 1)
  d.nudges--
  d.specials--
  const before = { progress: d.encounterProgress, earned: d.earned, shell: d.integrity, nudges: d.nudges, specials: d.specials, tilts: d.tilts, flips: d.flips, charge: d.charge, uses: d.overdriveUses, shields: d.shields }
  const time = d.time
  pocket(d)
  assert.equal(d.captured, null)
  assert.equal(d.encounterReturns, 1)
  assert.ok(d.time > time)
  assert.ok(d.ball.y <= d.board.launchY + 4)
  assert.deepEqual({ progress: d.encounterProgress, earned: d.earned, shell: d.integrity, nudges: d.nudges, specials: d.specials, tilts: d.tilts, flips: d.flips, charge: d.charge, uses: d.overdriveUses, shields: d.shields }, before)
  assert.equal(d.events.filter(e => e.type === 'recirculate').length, 1)
  pocket(d)
  assert.equal(d.captured, 'coin')
  assert.equal(d.encounterReturns, 1)
  assert.equal(d.earned - before.earned, 12 + d.profile.landingBonus)
})

check('hazard gutters retain damage, shields do not create returns, and dead balls never revive', () => {
  const d = make(arena('bellkeeper'))
  const shell = d.integrity
  pocket(d, 50)
  assert.equal(d.encounterReturns, 0)
  assert.equal(d.captured, 'hazard')
  assert.equal(d.integrity, shell - 1)
  const shielded = make(arena('bellkeeper'), ['velvet-fuse'])
  pocket(shielded, 50)
  assert.equal(shielded.encounterReturns, 0)
  assert.equal(shielded.shields, 0)
  assert.equal(shielded.captured, 'coin')
  const dead = make(arena('bellkeeper'))
  dead.dead = true
  dead.integrity = 0
  pocket(dead)
  assert.equal(dead.dead, true)
  assert.equal(dead.encounterReturns, 0)
})

check('guardian bounties remain flat and once-only under extreme payout, builds and Overdrive', () => {
  for (const id of ['bellkeeper', 'heartforge'] as const) {
    const d = make(arena(id, { payout: 9 }), RELIC_LIST.map(r => r.id), UPGRADE_LIST.map(u => u.id))
    d.mult = 15
    d.overdriveTime = 3
    const targets = id === 'bellkeeper' ? [2, 0, 1] : [0, 1, 0, 1]
    for (const relay of targets) { wait(d); strike(d, relay) }
    assert.ok(d.encounterComplete)
    const awards = d.events.filter(e => e.type === 'encounter-clear')
    assert.equal(awards.length, 1)
    assert.equal(awards[0].gears, ENCOUNTERS[id].bounty)
    assert.equal(d.events.reduce((total, e) => total + (e.gears ?? 0), 0), d.earned)
    pocket(d)
    assert.equal(d.encounterReturns, 0, 'a completed objective needs no return')
    assert.equal(d.wonBoss, false)
    assert.equal(d.coreOpen, false)
  }
})

check('guardian returns keep the original lifetime cap and cannot farm extra catches at timeout', () => {
  const d = make(arena('heartforge'))
  d.time = 80
  d.ball.x = 400
  d.ball.y = 1000
  d.step(TUNING.dt)
  assert.equal(d.captured, 'coin')
  assert.equal(d.encounterReturns, 0)
  assert.equal(d.encounterComplete, false)
})

check('route branches advertise their actual optional guardian and retain the guaranteed risky relic', () => {
  for (let seed = 0; seed < 24; seed++) {
    const route = createRoute(rngFor(`GUARDIAN${seed}`, 'route:0'))
    assert.equal(route.nodes.gallery.encounter, 'bellkeeper')
    assert.equal(route.nodes.gallery.reward, undefined)
    assert.equal(route.nodes.kiln.encounter, 'bellkeeper')
    assert.equal(route.nodes.kiln.reward, 'relic')
    assert.equal(route.nodes.dynamo.encounter, 'heartforge')
    assert.equal(route.nodes.grinder.encounter, undefined)
    assert.equal(route.nodes['rest-brass'].repairAmount, 99)
    assert.equal(route.nodes['rest-ember'].repairAmount, 99)
    assert.equal(route.nodes.dynamo.next, 'rest-ember')
  }
})

check('legacy rules retain exact room content while guardian rules preserve topology and every seeded roll', () => {
  for (let seed = 0; seed < 24; seed++) {
    for (const [loop, ascension] of [[0, 0], [1, 3], [3, 6]]) {
      const key = `GUARDIAN-RULES${seed}`
      let oldDraws = 0
      let newDraws = 0
      const oldRng = rngFor(key, `route:${loop}`)
      const newRng = rngFor(key, `route:${loop}`)
      const legacy = createRoute(() => { oldDraws++; return oldRng() }, { loop, ascension, rules: 2 })
      const current = createRoute(() => { newDraws++; return newRng() }, { loop, ascension, rules: 3 })
      assert.equal(oldDraws, newDraws, 'adding guardians consumes no additional RNG draws')
      assert.ok(Object.values(legacy.nodes).every(node => node.encounter === undefined))
      assert.equal(legacy.nodes.gallery.blurb, 'Take a breath. Gather gears for the counter and keep the shell whole.')
      assert.equal(legacy.nodes.kiln.blurb, 'A relic waits beyond the hot lane. The shell pays for careless greed.')
      assert.equal(legacy.nodes.dynamo.blurb, 'The foundry gives up its last gears before the stars. A full repair waits beyond.')
      const safe = legacy.nodes['fork-brass'].options!.find(o => o.next === 'gallery')!
      const risky = legacy.nodes['fork-brass'].options!.find(o => o.next === 'kiln')!
      assert.equal(safe.title, 'The Quiet Gallery')
      assert.equal(safe.detail, 'A forgiving garden. Gather gears while protecting the shell.')
      assert.equal(risky.title, 'The Golden Kiln')
      assert.equal(risky.detail, 'A furnace under an anomaly. Take an extra relic.')
      // Strip only the documented guardian presentation/markers. Everything
      // else, including titles, layouts, branch order and anomalies, is exact.
      const normalized = structuredClone(current)
      for (const id of ['gallery', 'kiln', 'dynamo']) {
        delete normalized.nodes[id].encounter
        normalized.nodes[id].blurb = legacy.nodes[id].blurb
      }
      for (const option of normalized.nodes['fork-brass'].options!) {
        const original = legacy.nodes['fork-brass'].options!.find(o => o.next === option.next)!
        option.title = original.title
        option.detail = original.detail
      }
      assert.deepEqual(normalized, legacy)
      assert.deepEqual(createRoute(rngFor(key, `route:${loop}`), { loop, ascension }), current, 'omitted rules select the current guardian content')
      assert.equal(oldRng(), newRng(), 'the RNG streams remain aligned for any subsequent consumer')
    }
  }
})

/** A deliberately simple legal controller: predict horizontal position at the
 * nearest unfinished relay, spend finite nudges to correct it, and save a full
 * reactor for targets already passed. No positions/resources/results change. */
function pilot(d: Drop): Cmd {
  const candidates = d.board.bumpers.filter(b => b.relay != null && d.encounterTargets.includes(b.relay))
  candidates.sort((a, b) => Math.abs(a.x - d.ball.x) + Math.abs(a.y - d.ball.y) * 0.5 + (a.y < d.ball.y - 70 ? 600 : 0) - (Math.abs(b.x - d.ball.x) + Math.abs(b.y - d.ball.y) * 0.5 + (b.y < d.ball.y - 70 ? 600 : 0)))
  const target = candidates[0]
  if (!target) return empty
  const dy = target.y - d.ball.y
  const g = TUNING.gravity * d.profile.gravityScale
  const flight = dy > 0 ? (-d.ball.vy + Math.sqrt(d.ball.vy ** 2 + 2 * g * dy)) / g : 0
  const projected = d.ball.x + d.ball.vx * Math.min(0.5, flight)
  const correction = target.x - projected
  const nudge = d.ball.vy > 40 && dy > -10 && dy < 220 && Math.abs(correction) > target.r * 0.85 ? Math.sign(correction) as -1 | 1 : 0
  const tilt = d.profile.special === 'tilt' && d.tiltT <= 0 && dy > 0 && dy < 380 && Math.abs(correction) > 100 && d.nudges === 0
  return { ...empty, aimX: target.x, nudge, tilt, overdrive: d.overdriveReady && dy < -50 }
}

let simulations = 0
let clears = 0
let passiveClears = 0
let actualReturns = 0
check('all spheres can physically reach both guardian objectives with finite legal controls', () => {
  for (const [layout, id] of [['garden', 'bellkeeper'], ['furnace', 'bellkeeper'], ['furnace', 'heartforge'], ['elite', 'heartforge']] as [LayoutId, EncounterId][]) {
    for (const ball of BALL_LIST) {
      let familyClears = 0
      let familyBest = 0
      for (let seed = 0; seed < 4; seed++) {
        for (let aim = 0; aim <= 12; aim++) {
          const raw = createBoard({ layout, title: layout, tutorial: false, rng: rngFor(`GUARDIAN${seed}`, layout) })
          if (seed) applyAnomaly(raw, ANOMALY_IDS[seed % ANOMALY_IDS.length], seed === 3 ? 4 : 1)
          const board = applyEncounter(raw, id)
          const p = computeProfile(ball.id, [], [])
          const d = new Drop(board, ball.id, p, p.integrityMax, p.integrityMax)
          d.launch(-p.aimCone + p.aimCone * 2 * aim / 12)
          let payouts = 0
          for (let tick = 0; tick < 120 * 85 && !d.captured && !d.dead; tick++) {
            d.step(TUNING.dt * d.timeScale, seed % 2 ? pilot(d) : empty)
            for (const event of d.pullEvents()) payouts += event.gears ?? 0
            assert.ok(Number.isFinite(d.ball.x) && Number.isFinite(d.ball.y) && Number.isFinite(d.ball.vx) && Number.isFinite(d.ball.vy))
            assert.ok(d.encounterProgress <= ENCOUNTERS[id].required && d.encounterReturns <= 1)
            assert.ok(d.nudges >= 0 && d.nudges <= d.maxNudges && d.overdriveUses <= 2)
          }
          assert.ok(d.captured || d.dead, `${id}/${layout}/${ball.id}/${seed}/${aim} must settle`)
          assert.equal(payouts, d.earned)
          assert.equal(d.wonBoss, false)
          assert.ok(d.time <= 80 + TUNING.dt * 2)
          simulations++
          actualReturns += d.encounterReturns
          familyClears += Number(d.encounterComplete)
          familyBest = Math.max(familyBest, d.encounterProgress)
          clears += Number(d.encounterComplete)
          if (!(seed % 2)) passiveClears += Number(d.encounterComplete)
        }
      }
      console.log(`  PHYSICS ${id}/${layout}/${ball.id}: ${familyClears}/52 clear, best ${familyBest}/${ENCOUNTERS[id].required}`)
      assert.ok(familyClears > 0, `${id}/${layout}/${ball.name} must have a physically reachable clear with no build advantage`)
    }
  }
})

check('late builds, strongest anomalies and cumulative trials keep guardian results finite and deterministic', () => {
  const run = (layout: LayoutId, id: EncounterId, ball: string, anomaly: typeof ANOMALY_IDS[number]) => {
    const board = createBoard({ layout, title: layout, tutorial: false, rng: rngFor('GUARDIAN-CIRCUIT', layout) })
    applyAnomaly(board, anomaly, 4)
    board.gapWidth *= 0.84
    for (const peg of board.pegs) if (peg.motion) peg.motion.amp *= 1.2
    board.payout *= 2.68
    applyEncounter(board, id)
    const p = computeProfile(ball, UPGRADE_LIST.map(u => u.id), RELIC_LIST.map(r => r.id))
    p.gravityScale = 1.21
    p.maxNudges = Math.max(1, p.maxNudges - 1)
    p.integrityMax = Math.max(1, p.integrityMax - 1)
    const d = new Drop(board, ball, p, p.integrityMax, p.integrityMax)
    d.launch(0)
    let payout = 0
    let awards = 0
    for (let tick = 0; tick < 120 * 100 && !d.dead && !d.captured; tick++) {
      d.step(TUNING.dt * d.timeScale, pilot(d))
      for (const e of d.pullEvents()) { payout += e.gears ?? 0; awards += Number(e.type === 'encounter-clear') }
      assert.ok(Number.isFinite(d.ball.x) && Number.isFinite(d.ball.y) && Number.isFinite(d.earned))
    }
    assert.ok(d.dead || d.captured)
    assert.equal(payout, d.earned)
    assert.equal(awards, Number(d.encounterComplete))
    assert.ok(d.encounterReturns <= 1 && d.overdriveUses <= 2 && d.time <= 80 + TUNING.dt * 2)
    assert.ok(d.integrity >= 0 && d.integrity <= d.integrityMax)
    assert.equal(d.wonBoss, false)
    simulations++
    actualReturns += d.encounterReturns
    clears += Number(d.encounterComplete)
    return { ball: d.ball, time: d.time, earned: d.earned, integrity: d.integrity, progress: d.encounterProgress, returns: d.encounterReturns, complete: d.encounterComplete, charge: d.charge, uses: d.overdriveUses }
  }
  for (const [layout, id] of [['garden', 'bellkeeper'], ['furnace', 'bellkeeper'], ['furnace', 'heartforge'], ['elite', 'heartforge']] as [LayoutId, EncounterId][]) {
    for (const ball of BALL_LIST) {
      for (const anomaly of ANOMALY_IDS) run(layout, id, ball.id, anomaly)
      assert.deepEqual(run(layout, id, ball.id, 'springtide'), run(layout, id, ball.id, 'springtide'))
    }
  }
})

console.log(`Passed ${checks} guardian checks and ${simulations} actual falls: ${clears} objectives completed (${passiveClears} without controls), ${actualReturns} finite returns. Optional objectives never award Grinder victory or block surviving runs.`)
