/** Physical-input checks for the finite, player-triggered Overdrive reactor. */
import assert from 'node:assert/strict'
import { BALL_LIST, RELIC_LIST, UPGRADE_LIST } from '../src/content/catalog'
import { rngFor } from '../src/core/rng'
import { TUNING } from '../src/tuning'
import type { Board, LayoutId, Peg } from '../src/sim/board'
import { Drop, OVERDRIVE, type Cmd } from '../src/sim/drop'
import { createBoard } from '../src/sim/generate'
import { computeProfile } from '../src/sim/profile'

const empty: Cmd = { nudge: 0, flip: false, special: false, tilt: false, aimX: 400 }
let checks = 0
function check(name: string, run: () => void) {
  run()
  checks++
  console.log(`PASS ${name}`)
}
const peg = (i: number, kind: Peg['kind'] = 'normal'): Peg => ({ x: 100 + (i % 8) * 100, y: 800 + Math.floor(i / 8) * 150, r: 10, row: Math.floor(i / 8), kind })
function arena(extra: Partial<Board> = {}): Board {
  return {
    w: 1000, h: 6000, theme: 'workshop', margin: 0, floorY: 5500,
    launchX: 400, launchY: 40, pegs: Array.from({ length: 24 }, (_, i) => peg(i)),
    bumpers: [], walls: [], zones: [], bins: [{ x0: 0, x1: 1000, kind: 'coin' }],
    shutterY: null, gapWidth: 0, gapStart: 0, goldSide: 'right', payout: 1,
    title: 'Reactor laboratory', features: [], boss: false, jackpot: false, ...extra,
  }
}
function make(board = arena(), relics: string[] = [], upgrades: string[] = [], ball = 'rubber') {
  const p = computeProfile(ball, upgrades, relics)
  const d = new Drop(board, ball, p, p.integrityMax, p.integrityMax)
  d.launch(0)
  d.pullEvents()
  return d
}
function strike(d: Drop, i: number) {
  const p = d.board.pegs[i]
  d.ball.x = p.x
  d.ball.y = p.y - p.r - d.ball.r + 1
  d.ball.vx = 0
  d.ball.vy = 650
  d.step(TUNING.dt)
}
function charge(d: Drop, from = 0) {
  for (let i = from; i < from + OVERDRIVE.pegsToCharge; i++) strike(d, i)
}
function idle(d: Drop, seconds: number) {
  // Isolate time/combo behavior from collisions and the anti-stuck watchdog.
  for (let i = 0; i < Math.ceil(seconds / TUNING.dt); i++) {
    d.ball.x = 350 + (i % 4) * 80
    d.ball.y = 2800
    d.ball.vx = d.ball.vy = 0
    d.step(TUNING.dt)
  }
}

check('five distinct physical contacts charge once; rattling the same peg cannot farm energy', () => {
  const d = make()
  strike(d, 0)
  assert.equal(d.charge, 0.2)
  idle(d, 0.8)
  strike(d, 0)
  assert.equal(d.charge, 0.2)
  for (let i = 1; i < 5; i++) strike(d, i)
  assert.equal(d.charge, 1)
  assert.ok(d.overdriveReady)
  assert.equal(d.overdriveUses, 0, 'charging never fires the ability automatically')
  assert.equal(d.events.filter(e => e.type === 'overdrive-ready').length, 1)
})

check('Arc Coil lights and pays without forging physical reactor contacts', () => {
  const d = make(arena({ pegs: Array.from({ length: 12 }, (_, i) => ({ ...peg(i), x: 330 + i * 15, y: 800 })) }), ['arc-coil'])
  d.ball.x = 400
  d.ball.y = 800
  const seam = d as unknown as { bumpCombo(): void }
  for (let i = 0; i < 8; i++) seam.bumpCombo()
  assert.ok(d.litOrder.length > 0)
  assert.equal(d.charge, 0)
  const lit = d.litOrder[0]
  strike(d, lit)
  assert.equal(d.charge, 0.2, 'a later real contact still earns its one charge contribution')
})

check('the discrete press rescues upward, steers toward aim, and saves a nearly expired combo', () => {
  const d = make()
  charge(d)
  d.ball.x = 400
  d.ball.y = 1600
  d.ball.vx = 0
  d.ball.vy = 1100
  d.combo = 7
  d.comboTimer = TUNING.dt / 2
  d.step(TUNING.dt, { ...empty, overdrive: true, aimX: 900 })
  assert.equal(d.overdriveUses, 1)
  assert.equal(d.charge, 0)
  assert.ok(d.overdriveTime > 2.98 && d.overdriveTime <= 3)
  assert.ok(d.ball.vy < -580)
  assert.ok(d.ball.vx > 280)
  assert.equal(d.combo, 7)
  assert.equal(d.comboTimer, TUNING.dt / 2)
  assert.equal(d.events.filter(e => e.type === 'overdrive-start').length, 1)
  assert.equal(d.invuln, 0, 'the pulse supplies no hidden shield')
})

check('reactor cannot fire before launch, below full charge, or after a finished fall', () => {
  const p = computeProfile('rubber', [], [])
  const unlaunched = new Drop(arena(), 'rubber', p, 3, 3)
  unlaunched.charge = 1
  unlaunched.step(TUNING.dt, { ...empty, overdrive: true })
  assert.equal(unlaunched.overdriveUses, 0)
  const d = make()
  strike(d, 0)
  d.step(TUNING.dt, { ...empty, overdrive: true })
  assert.equal(d.overdriveUses, 0)
  charge(d, 1)
  d.captured = 'coin'
  d.step(TUNING.dt, { ...empty, overdrive: true })
  assert.equal(d.overdriveUses, 0)
  assert.equal(d.overdriveReady, false)
})

check('surge doubles physical collision value without doubling relic lightning or landing money', () => {
  const d = make()
  charge(d)
  d.ball.x = 400
  d.ball.y = 1600
  d.step(TUNING.dt, { ...empty, overdrive: true })
  d.combo = 0
  d.comboTimer = 0
  const before = d.earned
  strike(d, 5)
  assert.equal(d.earned - before, TUNING.pegPay * OVERDRIVE.payout)
  const seam = d as unknown as { pay(x: number, y: number, base: number, type: string, big: boolean): void }
  const relicBefore = d.earned
  seam.pay(400, 1600, 8, 'gold', false)
  assert.equal(d.earned - relicBefore, 8, 'triggered relic pay remains flat')
  const landingBefore = d.earned
  d.ball.x = 400
  d.ball.y = d.board.floorY + 120
  d.ball.vx = d.ball.vy = 0
  d.step(TUNING.dt)
  assert.equal(d.earned - landingBefore, 12)
  assert.equal(d.overdriveTime, 0, 'settling ends the visual surge immediately')
  assert.equal(d.events.reduce((sum, e) => sum + (e.gears ?? 0), 0), d.earned)
})

check('three-second surge freezes normal combo decay, expires once, and allows ordinary decay again', () => {
  const d = make()
  charge(d)
  d.ball.x = 400
  d.ball.y = 1600
  d.step(TUNING.dt, { ...empty, overdrive: true })
  d.combo = 8
  d.comboTimer = 0.2
  idle(d, 2.8)
  assert.equal(d.combo, 8)
  assert.equal(d.comboTimer, 0.2)
  idle(d, 0.5)
  assert.equal(d.overdriveTime, 0)
  assert.equal(d.combo, 0)
  assert.equal(d.events.filter(e => e.type === 'overdrive-end').length, 1)
})

check('energy earned during surge waits, and the reactor has exactly two uses per machine', () => {
  const d = make()
  charge(d)
  d.ball.x = 400
  d.ball.y = 1600
  d.step(TUNING.dt, { ...empty, overdrive: true })
  charge(d, 5)
  assert.equal(d.charge, 1)
  assert.equal(d.overdriveReady, false)
  d.step(TUNING.dt, { ...empty, overdrive: true })
  assert.equal(d.overdriveUses, 1)
  idle(d, 3.1)
  assert.ok(d.overdriveReady)
  assert.equal(d.events.filter(e => e.type === 'overdrive-ready').length, 2)
  d.step(TUNING.dt, { ...empty, overdrive: true })
  assert.equal(d.overdriveUses, 2)
  charge(d, 10)
  assert.equal(d.charge, 0)
  idle(d, 3.1)
  d.step(TUNING.dt, { ...empty, overdrive: true })
  assert.equal(d.overdriveUses, 2)
  assert.equal(d.overdriveReady, false)
})

check('active surge still takes hazard damage and hazards break its combo', () => {
  const d = make(arena({ zones: [{ kind: 'spike', x: 400, y: 1800, r: 24 }] }))
  charge(d)
  d.ball.x = 400
  d.ball.y = 1600
  d.step(TUNING.dt, { ...empty, overdrive: true })
  d.combo = 8
  d.comboTimer = 1
  d.ball.x = 400
  d.ball.y = 1800
  d.ball.vx = d.ball.vy = 0
  const shell = d.integrity
  d.step(TUNING.dt)
  assert.equal(d.integrity, shell - 1)
  assert.equal(d.combo, 0)
  assert.equal(d.comboTimer, 0)
  assert.ok(d.overdriveTime > 0)
})

check('pulse near the inlet is height-limited and rejects invalid aim without corrupting physics', () => {
  const d = make()
  charge(d)
  d.ball.x = 400
  d.ball.y = d.board.launchY + d.ball.r + 16
  d.ball.vx = 0
  d.ball.vy = 1000
  d.step(TUNING.dt, { ...empty, overdrive: true, aimX: Number.NaN })
  assert.ok(d.ball.vy >= 0, 'there is no headroom for an upward kick')
  assert.ok(Number.isFinite(d.ball.x) && Number.isFinite(d.ball.y) && Number.isFinite(d.ball.vx))
  assert.equal(d.ball.vx, 0)
})

check('reactor pulse cannot directly damage or unlock the boss core', () => {
  const board = createBoard({ layout: 'grinder', title: 'Grinder', tutorial: false, rng: rngFor('REACTOR', 'boss') })
  const d = make(board)
  // Reach the charge using physical contacts; then fire far from the core.
  charge(d)
  d.ball.x = board.margin + 30
  d.ball.y = board.launchY + 150
  d.ball.vx = d.ball.vy = 0
  const hits = d.coreHits
  d.step(TUNING.dt, { ...empty, overdrive: true })
  assert.equal(d.coreHits, hits)
  assert.equal(d.wonBoss, false)
  assert.equal(d.coreOpen, false)
})

const layouts: LayoutId[] = ['workshop', 'garden', 'furnace', 'elite', 'ante', 'core', 'grinder']
let actualFalls = 0
let naturalReady = 0
let activeFalls = 0
check('seeded real machines provide reachable energy, finite active physics and reconciled payouts', () => {
  for (const layout of layouts) {
    for (const ball of BALL_LIST) {
      for (let seed = 0; seed < 8; seed++) {
        const all = seed >= 6
        const board = createBoard({ layout, title: layout, tutorial: false, rng: rngFor(`OVERDRIVE${seed}`, layout) })
        // All spheres receive their actual launch behavior, not a fixture path.
        const angle = (seed % 3 - 1) * 0.3
        const p = computeProfile(ball.id, all ? UPGRADE_LIST.map(u => u.id) : [], all ? RELIC_LIST.map(r => r.id) : [])
        const run = new Drop(board, ball.id, p, p.integrityMax, p.integrityMax)
        run.launch(angle)
        let score = 0
        let ready = false
        for (let step = 0; step < 160 / TUNING.dt && !run.captured && !run.dead; step++) {
          ready ||= run.overdriveReady
          const target = board.w * (run.overdriveUses % 2 ? 0.65 : 0.35)
          run.step(TUNING.dt * run.timeScale, { ...empty, aimX: target, overdrive: run.overdriveReady })
          for (const event of run.pullEvents()) score += event.gears ?? 0
          assert.ok(Number.isFinite(run.ball.x) && Number.isFinite(run.ball.y) && Number.isFinite(run.ball.vx) && Number.isFinite(run.ball.vy))
          assert.ok(run.charge >= 0 && run.charge <= 1)
          assert.ok(run.overdriveUses <= 2 && run.overdriveTime <= 3 && run.overdriveTime >= 0)
          assert.ok(run.coreHits <= 5 && run.integrity >= 0)
        }
        assert.ok(run.captured || run.dead, `${layout}/${ball.id}/${seed} must settle`)
        assert.equal(score, run.earned)
        actualFalls++
        naturalReady += Number(ready)
        activeFalls += Number(run.overdriveUses > 0)
      }
    }
  }
  assert.ok(naturalReady >= actualFalls * 0.6, 'ordinary play must reach the feature in a majority of falls')
  assert.equal(activeFalls, naturalReady)
})

console.log(`Passed ${checks} Overdrive checks and ${actualFalls} real falls; ${naturalReady} reached and activated the reactor. Five distinct contacts, 3 seconds, 2 uses; no passive auto-fire, shield, boss damage or infinite farming.`)
