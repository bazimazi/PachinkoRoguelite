import assert from 'node:assert/strict'
import { BALL_LIST, RELIC_LIST, UPGRADE_LIST } from '../src/content/catalog'
import { rngFor } from '../src/core/rng'
import { TUNING } from '../src/tuning'
import type { Board, Peg } from '../src/sim/board'
import { Drop, type Cmd } from '../src/sim/drop'
import { createBoard } from '../src/sim/generate'
import { computeProfile } from '../src/sim/profile'

const empty: Cmd = { nudge: 0, flip: false, special: false, tilt: false, aimX: 0 }
let checks = 0
function check(name: string, run: () => void) {
  run()
  checks += 1
  console.log(`PASS ${name}`)
}
function arena(extra: Partial<Board> = {}): Board {
  return {
    w: 800, h: 1200, theme: 'workshop', margin: 0, floorY: 1000,
    launchX: 400, launchY: 40, pegs: [], bumpers: [], walls: [], zones: [],
    bins: [{ x0: 0, x1: 200, kind: 'hazard' }, { x0: 200, x1: 800, kind: 'coin' }],
    shutterY: null, gapWidth: 0, gapStart: 0, goldSide: 'right', payout: 1,
    title: 'Mechanics test', features: [], boss: false, jackpot: false, ...extra,
  }
}
function make(board: Board, relics: string[] = [], upgrades: string[] = [], ball = 'rubber') {
  const profile = computeProfile(ball, upgrades, relics)
  const drop = new Drop(board, ball, profile, profile.integrityMax, profile.integrityMax)
  drop.launch(0)
  drop.pullEvents()
  return drop
}
const peg = (x: number, y: number, kind: Peg['kind'] = 'normal', row = 0): Peg => ({ x, y, kind, row, r: 10 })
function strike(drop: Drop, i: number, speed = 740) {
  const p = drop.board.pegs[i]
  drop.ball.x = p.x
  drop.ball.y = p.y - p.r - drop.ball.r + 1
  drop.ball.vx = 0
  drop.ball.vy = speed
  drop.step(TUNING.dt)
}
function pocket(drop: Drop, x = 400) {
  drop.ball.x = x
  drop.ball.y = drop.board.floorY + 120
  drop.ball.vx = 0
  drop.ball.vy = 0
  drop.step(TUNING.dt)
}
// Pure trigger tests use a typed test seam for the private event combinators;
// collision, hazard, landing, investment and boss cases use the public step API.
type TriggerSeam = { bumpCombo(): void; engine(kind: 'spring' | 'bumper', x: number, y: number): void }
const triggers = (d: Drop) => d as unknown as TriggerSeam

check('catalog profiles are finite; duplicate inventory does not forge fake synergies', () => {
  for (const ball of BALL_LIST) {
    for (const relic of RELIC_LIST) {
      const p = computeProfile(ball.id, UPGRADE_LIST.map((u) => u.id), [relic.id])
      assert.ok(p.integrityMax >= 1 && p.maxNudges >= 3)
      assert.ok(Number.isFinite(p.restitution) && Number.isFinite(p.multGain))
    }
  }
  assert.deepEqual(computeProfile('rubber', ['side-jets', 'side-jets'], ['arc-coil', 'arc-coil']),
    computeProfile('rubber', ['side-jets'], ['arc-coil']))
})

check('theme-only tags never advertise passive bonuses without their enabling relic', () => {
  const p = computeProfile('prism', ['afterimage', 'first-gild', 'open-throat'], [
    'glass-heart', 'velvet-fuse', 'lucky-gear', 'golden-rudder', 'gravity-lens', 'portal-passport',
  ])
  for (const tag of ['risk', 'precision', 'luck', 'magnet', 'portal'] as const) {
    assert.ok((p.tags[tag] ?? 0) >= 2, `the build really contains repeated ${tag} themes`)
    assert.ok(!p.synergies.some(s => s.tag === tag), `${tag} does not promise an inactive bonus`)
  }
})

check('emerging and forged gravity and magnet bonuses match their advertised strength', () => {
  const emergingGravity = computeProfile('void', [], ['gravity-lens'])
  const forgedGravity = computeProfile('void', [], ['gravity-lens', 'clockwork-feather'])
  assert.ok(Math.abs(emergingGravity.wellScale - 1.45 * 1.65 * 1.18) < 1e-10)
  assert.ok(Math.abs(forgedGravity.wellScale - 1.45 * 1.65 * 1.35) < 1e-10)
  const emergingMagnet = computeProfile('rubber', [], ['golden-magnet', 'lucky-gear'])
  const forgedMagnet = computeProfile('rubber', [], ['golden-magnet', 'lucky-gear', 'golden-rudder'])
  assert.equal(emergingMagnet.magnetPull, 390)
  assert.equal(emergingMagnet.magnetRadius, 280)
  assert.equal(forgedMagnet.magnetPull, 450)
  assert.equal(forgedMagnet.magnetRadius, 305)
  assert.equal(forgedMagnet.synergies.find(s => s.tag === 'magnet')?.tier, 'forged')
})

check('Ouroboros portal tiers grant the actual advertised extra multiplier', () => {
  for (const [relics, expected] of [
    [['ouroboros'], 1.55],
    [['ouroboros', 'gravity-lens'], 1.70],
    [['ouroboros', 'gravity-lens', 'portal-passport'], 1.85],
  ] as const) {
    const d = make(arena({ zones: [
      { kind: 'portal', pid: 0, x: 200, y: 300, r: 24 },
      { kind: 'portal', pid: 1, x: 600, y: 500, r: 24 },
    ] }), [...relics])
    d.ball.x = 200
    d.ball.y = 300
    d.ball.vx = 0
    d.ball.vy = 200
    d.step(TUNING.dt)
    assert.equal(d.portals, 1)
    assert.equal(d.mult, expected)
  }
})

check('Void Space and Q consume the same finite tilt pool', () => {
  const d = make(arena(), [], ['capacitor'], 'void')
  assert.equal(d.tilts, 3)
  assert.equal(d.specials, 0)
  d.step(TUNING.dt, { ...empty, special: true, aimX: 0 })
  assert.equal(d.tilts, 2)
  assert.ok(d.tiltT > 0 && d.tiltDir === -1)
  d.specialCd = 0
  d.step(TUNING.dt, { ...empty, special: true, tilt: true, aimX: 800 })
  assert.equal(d.tilts, 1, 'two simultaneous bindings spend only one charge')
})

check('Arc Coil chooses nearest unlit pegs, never recursively procs, and stops after 3 discharges', () => {
  const pegs = Array.from({ length: 15 }, (_, i) => peg(420 + i * 8, 120))
  const d = make(arena({ pegs }), ['arc-coil'])
  d.ball.x = 400
  d.ball.y = 120
  for (let i = 0; i < 100; i++) triggers(d).bumpCombo()
  assert.equal(d.combo, 100)
  assert.equal(d.arcPulses, 3)
  assert.deepEqual(d.litOrder, [0, 1, 2, 3, 4, 5, 6, 7, 8])
  assert.equal(d.pegs, 0, 'arc hits are not physical peg contacts')
  assert.equal(d.golds, 0)
  assert.equal(d.mult, 1)
  assert.equal(d.events.filter((e) => e.gears).length, 9)
})

check('Velvet Fuse protects exactly one spike and preserves combo; Shock Absorber extends grace', () => {
  const d = make(arena({ zones: [{ kind: 'spike', x: 400, y: 300, r: 20 }] }), ['velvet-fuse'], ['shock-absorber'])
  d.combo = 6
  d.comboTimer = 2
  const touch = () => {
    d.ball.x = 400
    d.ball.y = 300
    d.ball.vx = 0
    d.ball.vy = 0
    d.step(TUNING.dt)
  }
  touch()
  assert.equal(d.integrity, 3)
  assert.equal(d.combo, 6)
  assert.equal(d.shields, 0)
  assert.equal(d.hazardThis, 0)
  assert.ok(d.invuln > 1.39)
  d.invuln = 0
  touch()
  assert.equal(d.integrity, 2)
  assert.equal(d.combo, 0)
  assert.equal(d.hazardThis, 1)
})

check('Velvet Fuse turns one ordinary gutter into a safe paying pocket', () => {
  const d = make(arena(), ['velvet-fuse'])
  pocket(d, 80)
  assert.equal(d.captured, 'coin')
  assert.equal(d.integrity, 3)
  assert.equal(d.earned, 12)
  assert.equal(d.shields, 0)
})

check('Golden Rudder rewards a new gold hit soon after a nudge, never the same peg twice', () => {
  const d = make(arena({ pegs: [peg(400, 300, 'gold')] }), ['golden-rudder'])
  d.step(TUNING.dt, { ...empty, nudge: 1 })
  assert.equal(d.nudges, d.maxNudges - 1)
  strike(d, 0)
  assert.equal(d.nudges, d.maxNudges)
  assert.equal(d.goldRefunds, 1)
  d.nudgeCd = 0
  d.step(TUNING.dt, { ...empty, nudge: -1 })
  // A genuine second paid contact still must not qualify as a new gold peg.
  d.payCd[0] = 0
  d.hitCd[0] = 0
  strike(d, 0)
  assert.equal(d.goldRefunds, 1)
  assert.equal(d.nudges, d.maxNudges - 1)
})

check('Golden Rudder rejects late gold and stops after three timely recoveries', () => {
  const board = arena({ pegs: Array.from({ length: 5 }, (_, i) => peg(400, 160 + i * 80, 'gold', i)) })
  const d = make(board, ['golden-rudder'])
  for (let i = 0; i < 5; i++) {
    d.nudgeCd = 0
    d.step(TUNING.dt, { ...empty, nudge: 1 })
    // Passing time with the ball high above all pegs cannot accidentally pay.
    if (i === 0) {
      d.ball.x = 40
      d.ball.y = 40
      d.ball.vx = 0
      d.ball.vy = 0
      for (let j = 0; j < 150; j++) d.step(TUNING.dt)
    }
    strike(d, i)
    assert.equal(d.goldRefunds, Math.min(i, 3))
  }
})

check('Brass Ledger invests earned gears on five distinct contacts without creating debt', () => {
  const board = arena({ pegs: Array.from({ length: 7 }, (_, i) => peg(400, 160 + i * 80, 'normal', i)) })
  const d = make(board, ['brass-ledger'])
  for (let i = 0; i < 7; i++) strike(d, i)
  assert.equal(d.investments, 5)
  assert.equal(d.mult, 1.6)
  assert.ok(d.earned >= 0)
  const gross = d.events.reduce((sum, e) => sum + (e.gears ?? 0), 0)
  assert.equal(d.earned, gross, 'controller payout events reconcile to the actual net drop earnings')
  assert.equal(d.events.filter(e => e.gears === -2).length, 5)
  d.hitCd[0] = 0
  d.payCd[0] = 0
  strike(d, 0)
  assert.equal(d.investments, 5)
})

check('Flywheel requires alternating equipment and caps rewards at four', () => {
  const d = make(arena(), ['flywheel'])
  d.nudges = 0
  triggers(d).engine('bumper', 400, 300)
  triggers(d).engine('bumper', 400, 300)
  assert.equal(d.flywheelRewards, 0)
  for (let i = 0; i < 20; i++) triggers(d).engine(i % 2 ? 'bumper' : 'spring', 400, 300)
  assert.equal(d.flywheelRewards, 4)
  assert.ok(d.nudges <= d.maxNudges)
  assert.equal(d.mult, 2)
})

check('Portal Passport pays and refunds only the first two transits', () => {
  const board = arena({ zones: [
    { kind: 'portal', pid: 0, x: 200, y: 300, r: 24 },
    { kind: 'portal', pid: 1, x: 600, y: 500, r: 24 },
  ] })
  const d = make(board, ['portal-passport'])
  d.nudges = 0
  d.combo = 3
  d.comboTimer = 0.2
  for (let i = 0; i < 4; i++) {
    d.portalCd = 0
    d.ball.x = 200
    d.ball.y = 300
    d.ball.vx = 0
    d.ball.vy = 200
    d.step(TUNING.dt)
  }
  assert.equal(d.portals, 4)
  assert.equal(d.nudges, 2)
  assert.equal(d.events.filter((e) => e.type === 'gold').length, 2)
  assert.ok(d.comboTimer > 1)
})

check('Clean Contract is a capped unique-peg landing reward and Landing Gear adds a separate payout', () => {
  const d = make(arena(), ['clean-contract'], ['landing-gear'])
  d.litOrder = Array.from({ length: 30 }, (_, i) => i)
  pocket(d)
  assert.equal(d.cleanBonus, 60)
  assert.equal(d.earned, 12 + 60 + 12)
  const hurt = make(arena(), ['clean-contract'])
  hurt.litOrder = [0, 1, 2]
  hurt.hazardThis = 1
  pocket(hurt)
  assert.equal(hurt.cleanBonus, 0)
})

check('Salvage Crown repairs exactly one shell after four Heavy Crown shatters', () => {
  const d = make(arena({ pegs: Array.from({ length: 6 }, (_, i) => peg(400, 160 + i * 80)) }), ['heavy-crown', 'salvage-crown'])
  d.integrity = 1
  for (let i = 0; i < 6; i++) strike(d, i, 900)
  assert.equal(d.shatters, 6)
  assert.equal(d.integrity, 2)
  assert.equal(d.salvageUsed, true)
  assert.equal(d.mult, 1.4)
})

check('Salvage Crown enables its own fast-hit shatters without a prerequisite relic', () => {
  const d = make(arena({ pegs: Array.from({ length: 4 }, (_, i) => peg(400, 160 + i * 80)) }), ['salvage-crown'])
  d.integrity = 1
  for (let i = 0; i < 4; i++) strike(d, i, 1000)
  assert.equal(d.shatters, 4)
  assert.equal(d.integrity, 2)
  assert.equal(d.salvageUsed, true)
})

check('Shatter payout applies the economy scale exactly once', () => {
  const d = make(arena({ pegs: [peg(400, 300)] }), ['heavy-crown', 'brass-ledger', 'clean-contract'])
  strike(d, 0, 900)
  const paid = d.events.find((e) => e.type === 'shatter')
  assert.ok(d.profile.gearScale > 1)
  assert.equal(paid?.gears, Math.round(8 * d.profile.gearScale))
})

check('Compound Interest increases combo-six payouts by 20 percent', () => {
  const d = make(arena({ pegs: [peg(400, 300)] }), [], ['compound-interest'])
  d.combo = 5
  d.comboTimer = 2
  strike(d, 0)
  assert.equal(d.combo, 6)
  const payout = d.events.find((e) => e.type === 'peg')
  assert.equal(payout?.gears, Math.round(3 * (1 + 5 * TUNING.comboStep) * 1.2))
})

check('Grinder misses consume finite shell, keep core progress, and cannot be shield-farmed', () => {
  const d = make(arena({ boss: true, bumpers: [{ x: 400, y: 600, r: 36, core: true }] }), ['velvet-fuse'])
  d.coreHits = 2
  pocket(d)
  assert.equal(d.integrity, 2)
  assert.equal(d.coreHits, 2)
  assert.equal(d.dead, false)
  assert.equal(d.captured, null)
  assert.equal(d.shields, 1, 'a relic cannot buy infinite boss lives')
  assert.ok(d.events.some((e) => e.text?.includes('SECOND CHANCE')))
  pocket(d)
  assert.equal(d.integrity, 1)
  pocket(d)
  assert.equal(d.integrity, 0)
  assert.equal(d.dead, true)
})

check('Grinder accepts five real impacts and opens a paying victory pocket', () => {
  const d = make(arena({ boss: true, bumpers: [{ x: 400, y: 600, r: 36, core: true }] }))
  for (let i = 0; i < 5; i++) {
    d.coreCd = 0
    d.ball.x = 400
    d.ball.y = 600 - 36 - d.ball.r + 1
    d.ball.vx = 0
    d.ball.vy = 650
    d.step(TUNING.dt)
  }
  assert.equal(d.coreHits, 5)
  assert.equal(d.wonBoss, true)
  assert.equal(d.coreOpen, true)
  pocket(d)
  assert.equal(d.dead, false)
  assert.ok(d.earned > 0)
})

check('the generated Grinder is winnable by every unupgraded sphere', () => {
  const board = createBoard({ layout: 'grinder', title: 'Grinder regression', tutorial: false, rng: rngFor('BUILD-VERIFY', 'grinder') })
  for (const ball of BALL_LIST) {
    let won = false
    for (let aim = 0; aim <= 24 && !won; aim++) {
      const p = computeProfile(ball.id, [], [])
      const d = new Drop(board, ball.id, p, p.integrityMax, p.integrityMax)
      d.launch(-p.aimCone + p.aimCone * 2 * aim / 24)
      for (let i = 0; i < 120 * 200 && !d.dead && !d.captured; i++) {
        d.step(TUNING.dt)
        d.pullEvents()
      }
      assert.ok(d.dead || d.captured, `${ball.name} settles within a bounded fight`)
      won ||= d.wonBoss
    }
    assert.ok(won, `${ball.name} can land five real hits without any build advantage`)
  }
})

check('timeout settlement is bounded, and a stalled boss spends shell instead of granting victory', () => {
  const ordinary = make(arena())
  ordinary.time = 80
  ordinary.step(TUNING.dt)
  assert.equal(ordinary.captured, 'coin')
  const boss = make(arena({ boss: true, bumpers: [{ x: 400, y: 600, r: 36, core: true }] }))
  boss.time = 25
  boss.step(TUNING.dt)
  assert.equal(boss.integrity, 2)
  assert.equal(boss.wonBoss, false)
})

check('seeded full builds replay identically and settle with finite score', () => {
  const run = () => {
    const board = createBoard({ layout: 'core', title: 'Determinism', tutorial: false, rng: rngFor('BUILD-VERIFY', 'core') })
    const d = make(board, RELIC_LIST.map((r) => r.id), UPGRADE_LIST.map((u) => u.id))
    d.ball.vx = 100
    for (let i = 0; i < 120 * 82 && !d.captured && !d.dead; i++) d.step(TUNING.dt)
    assert.ok(d.captured || d.dead)
    assert.ok(Number.isFinite(d.earned) && d.earned >= 0)
    assert.equal(d.events.reduce((sum, e) => sum + (e.gears ?? 0), 0), d.earned, 'all build payouts and investments reconcile')
    assert.ok(d.arcPulses <= 3 && d.goldRefunds <= 3 && d.investments <= 5 && d.flywheelRewards <= 4)
    return [d.earned, d.mult, d.captured, d.integrity, d.pegs, d.portals, d.arcPulses, d.time]
  }
  assert.deepEqual(run(), run())
})

console.log(`${checks} build and physics checks passed.`)
