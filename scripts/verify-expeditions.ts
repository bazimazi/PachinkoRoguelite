/** DOM/controller integration in Happy DOM with real native Canvas. No browser is launched. */
import assert from 'node:assert/strict'
import { createCanvas } from '@napi-rs/canvas'
import { Window } from 'happy-dom'
import { BALLS, RELICS } from '../src/content/catalog'
import { COMMISSIONS, challengeUrl, dailyExpedition, readCheckpoint } from '../src/meta/expedition'
import { loadSave, writeSave, type SaveData } from '../src/meta/save'
import { RESEARCH_ORDER, TUNING } from '../src/tuning'
import { Drop } from '../src/sim/drop'

const SAVE_KEY = 'plumb-save-v1'
const CHECKPOINT_KEY = 'plumb-expedition-v2'
// The harness deliberately reaches controller-private seams to jump between real
// route rooms. User interactions still go through DOM clicks and Input events.
type Controller = Record<string, any>
interface Fixture { window: Window; game: Controller; copied: string[] }
interface Options { url?: string; save?: Partial<SaveData>; rawSave?: string; checkpoint?: string }
let GameConstructor: new () => Controller
let checks = 0
let failures = 0
const windows: Window[] = []
const backing = new WeakMap<object, { canvas: ReturnType<typeof createCanvas>; context: any }>()

function setGlobal(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
}

function mountWindow(url: string) {
  const window = new Window({ url, width: 1280, height: 900 })
  windows.push(window)
  window.document.body.innerHTML = '<main id="app"><canvas id="view"></canvas><section id="stage"></section><section id="hud"></section><aside id="toast"></aside><div id="flash"></div><aside id="debug"></aside></main>'
  const matchMedia = (media: string) => ({ media, matches: media.includes('reduced-motion'), onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return true } })
  const raf = () => 1
  const resizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia })
  Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, value: raf })
  Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, value: () => {} })
  const copied: string[] = []
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { copied.push(text) } } })
  for (const name of ['window', 'document', 'navigator', 'location', 'localStorage', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLCanvasElement', 'Element', 'Node', 'Event', 'KeyboardEvent', 'MouseEvent', 'InputEvent']) {
    setGlobal(name, name === 'window' ? window : (window as any)[name])
  }
  setGlobal('matchMedia', matchMedia)
  setGlobal('requestAnimationFrame', raf)
  setGlobal('cancelAnimationFrame', () => {})
  setGlobal('ResizeObserver', resizeObserver)
  setGlobal('getComputedStyle', window.getComputedStyle.bind(window))
  const nativeFor = (node: any) => {
    let entry = backing.get(node)
    if (!entry) {
      const canvas = createCanvas(Math.max(1, node.width), Math.max(1, node.height))
      entry = { canvas, context: canvas.getContext('2d') }
      backing.set(node, entry)
    }
    if (entry.canvas.width !== Math.max(1, node.width)) entry.canvas.width = Math.max(1, node.width)
    if (entry.canvas.height !== Math.max(1, node.height)) entry.canvas.height = Math.max(1, node.height)
    return entry
  }
  Object.defineProperty(window.HTMLCanvasElement.prototype, 'getBoundingClientRect', {
    configurable: true, value() { return new window.DOMRect(0, 0, 1280, 900) },
  })
  Object.defineProperty(window.HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value(this: any, kind: string) {
      if (kind !== '2d') return null
      const node = this
      const entry = nativeFor(node)
      return new Proxy(entry.context, {
        get(target, prop) {
          nativeFor(node)
          const value = Reflect.get(target, prop, target)
          if (typeof value !== 'function') return value
          if (prop === 'drawImage' || prop === 'createPattern') return (source: any, ...args: any[]) => {
            const existing = backing.get(source)
            const image = existing ? existing.canvas : source instanceof window.HTMLCanvasElement ? nativeFor(source).canvas : source
            return value.call(target, image, ...args)
          }
          return value.bind(target)
        },
        set(target, prop, value) { nativeFor(node); return Reflect.set(target, prop, value, target) },
      })
    },
  })
  return { window, copied }
}

// Establish DOM globals before importing the UI's reduced-motion preference.
mountWindow('https://plumb.test/')
GameConstructor = (await import('../src/game/game')).Game as unknown as new () => Controller

function fixture(options: Options = {}): Fixture {
  const mounted = mountWindow(options.url ?? 'https://plumb.test/')
  if (options.rawSave !== undefined) localStorage.setItem(SAVE_KEY, options.rawSave)
  else if (options.save) writeSave({ ...loadSave(), ...options.save })
  if (options.checkpoint) localStorage.setItem(CHECKPOINT_KEY, options.checkpoint)
  const game = new GameConstructor()
  game.sfx.setMuted(true)
  const f = { ...mounted, game }
  render(f)
  return f
}
function render(f: Fixture) {
  f.game.ui.render(f.game.view())
  assert.doesNotMatch(f.window.document.getElementById('app')!.textContent, /\b(?:undefined|NaN)\b/, `${f.game.screen} has complete readable UI text`)
}
function button(f: Fixture, act: string) {
  render(f)
  const node = f.window.document.querySelector(`[data-act="${act}"]`) as any
  assert.ok(node, `action ${act} is visible on ${f.game.screen}`)
  return node
}
function click(f: Fixture, act: string) { button(f, act).click(); render(f) }
function press(f: Fixture, code: string, target: any = f.window) {
  target.dispatchEvent(new f.window.KeyboardEvent('keydown', { code, key: code === 'Enter' ? 'Enter' : code, bubbles: true }))
  f.game.collectEdges()
  f.game.input.endFrame()
  target.dispatchEvent(new f.window.KeyboardEvent('keyup', { code, bubbles: true }))
  render(f)
}
function begin(options: Options = {}) {
  const f = fixture({ url: 'https://plumb.test/?seed=INTEGRATE', ...options })
  click(f, 'start')
  assert.equal(f.game.screen, 'choices')
  assert.equal(f.game.run.relics.length, 0)
  click(f, 'pick:0')
  assert.equal(f.game.screen, 'aim')
  return f
}
function checkpoint() { return JSON.parse(localStorage.getItem(CHECKPOINT_KEY) || 'null') }
/** Reach the new ability through the actual seeded machine and controller. */
function reactorReady(f: Fixture) {
  const g = f.game
  if (g.screen === 'aim') press(f, 'Enter')
  assert.equal(g.screen, 'drop')
  for (let tick = 0; tick < 120 * 30 && g.screen === 'drop' && !g.drop.overdriveReady; tick++) g.fixed(TUNING.dt)
  assert.equal(g.screen, 'drop', 'the real first machine reaches a charge before settlement')
  assert.ok(g.drop.overdriveReady)
  assert.ok(g.drop.litOrder.length >= 5)
  assert.equal(g.drop.overdriveUses, 0)
  render(f)
}
function consumeControl(f: Fixture) {
  // Collision feedback can defer one input for a few hitstop frames.
  for (let tick = 0; tick < 20 && f.game.pending.overdrive; tick++) f.game.fixed(TUNING.dt)
  render(f)
}
function finish(f: Fixture, fields: Record<string, unknown> = {}) {
  const g = f.game
  if (g.screen === 'aim') press(f, 'Enter')
  assert.equal(g.screen, 'drop')
  Object.assign(g.drop, { captured: 'coin', dead: false, hazardThis: 0 }, fields)
  g.drain(true)
  g.finishDrop()
  assert.equal(g.screen, 'resolve')
  render(f)
}
function victory(f: Fixture) {
  f.game.enterNode('grinder')
  finish(f, { wonBoss: true, coreOpen: true, coreHits: 5, captured: 'jackpot', jackpot: true })
  click(f, 'skip')
  assert.equal(f.game.screen, 'victory')
}
function check(name: string, run: () => void | Promise<void>) {
  return Promise.resolve().then(run).then(() => {
    checks++
    console.log(`PASS ${name}`)
  }, error => {
    failures++
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : error}`)
  }).finally(async () => {
    // Release each isolated DOM after its scenario rather than retaining dozens
    // of native backing stores until process exit on constrained CI machines.
    for (const window of windows.splice(0)) {
      for (const node of window.document.querySelectorAll('canvas')) {
        const entry = backing.get(node)
        if (entry) { entry.canvas.width = 1; entry.canvas.height = 1 }
      }
      await window.happyDOM.close()
    }
  })
}

await check('fresh and legacy saves migrate with complete expedition defaults', () => {
  let f = fixture()
  assert.deepEqual(f.game.save.balls, ['rubber'])
  assert.equal(f.game.save.shards, 0)
  assert.deepEqual(f.game.save.history, [])
  assert.deepEqual(f.game.save.dailyBest, {})
  assert.equal(f.game.save.settings.speed, 1)
  f = fixture({ rawSave: JSON.stringify({ version: 1, shards: 12, runs: 2, balls: ['rubber', 'prism'], ball: 'prism', settings: { volume: 0.4 } }) })
  assert.equal(f.game.save.shards, 12)
  assert.equal(f.game.save.ball, 'prism')
  assert.equal(f.game.save.mastery.prism, 0)
  assert.equal(f.game.save.settings.volume, 0.4)
  assert.equal(f.game.save.settings.speed, 1)
  assert.deepEqual(f.game.save.history, [])
})

await check('malformed saves and checkpoints recover without corrupting the archive', () => {
  for (const rawSave of ['{broken', 'null', JSON.stringify({ version: 99 })]) {
    const f = fixture({ rawSave })
    assert.equal(f.game.screen, 'hub')
    assert.equal(f.game.save.shards, 0)
  }
  const f = fixture({
    rawSave: JSON.stringify({ version: 1, shards: -9, runs: 'many', balls: [null, 'void', {}, 'rubber', 'void'], mastery: { void: 999, rubber: -1 }, settings: { volume: 900, speed: 99, particles: 'yes' }, lifetime: { pegs: -5 } }),
    checkpoint: JSON.stringify({ version: 2, run: {}, screen: 'aim' }),
  })
  assert.deepEqual(f.game.save.balls, ['rubber', 'void'])
  assert.equal(f.game.save.shards, 0)
  assert.equal(f.game.save.runs, 0)
  assert.equal(f.game.save.mastery.void, 6)
  assert.equal(f.game.save.settings.volume, 1)
  assert.equal(f.game.save.settings.speed, 1)
  assert.equal(f.game.save.settings.particles, true)
  assert.equal(f.game.save.lifetime.pegs, 0)
  click(f, 'continue-run')
  assert.equal(f.game.run, null)
  assert.equal(readCheckpoint(), null)
  assert.deepEqual(f.game.save.balls, ['rubber', 'void'])
})

await check('starter draft precedes the first real launch and Canvas renders the machine', () => {
  const f = begin()
  assert.equal(f.game.run.relics.length, 1)
  assert.ok(RELICS[f.game.run.relics[0]])
  assert.equal(f.game.drop.launched, false)
  assert.equal(checkpoint().screen, 'aim')
  f.game.draw(0)
  press(f, 'Enter')
  assert.equal(f.game.screen, 'drop')
  assert.equal(f.game.drop.launched, true)
  assert.equal(f.game.run.launchedOnce, true)
  f.game.fixed(TUNING.dt)
  f.game.draw(1)
})

await check('Enter in the seed input edits the seed without starting a run', () => {
  const f = fixture()
  const input = f.window.document.querySelector('[data-seed]') as any
  input.focus()
  input.value = 'MYSEED42'
  input.dispatchEvent(new f.window.Event('input', { bubbles: true }))
  press(f, 'Enter', input)
  assert.equal(f.game.screen, 'hub')
  assert.equal(f.game.run, null)
  assert.equal(f.game.draftSeed, 'MYSEED42')
  input.blur()
  click(f, 'start')
  assert.equal(f.game.run.seed, 'MYSEED42')
})

await check('hub Enter resumes the saved primary expedition instead of overwriting it', () => {
  const first = begin()
  const seed = first.game.run.seed
  const inventory = [...first.game.run.relics]
  const saved = localStorage.getItem(CHECKPOINT_KEY)!
  const f = fixture({ url: 'https://plumb.test/?seed=DIFFERENT', checkpoint: saved })
  assert.ok(button(f, 'continue-run'))
  press(f, 'Enter')
  assert.equal(f.game.screen, 'aim')
  assert.equal(f.game.run.seed, seed)
  assert.deepEqual(f.game.run.relics, inventory)
})

await check('focused control buttons retain gameplay letter hotkeys while suppressing native Space duplication', () => {
  const f = begin()
  press(f, 'Enter')
  const target = button(f, 'nudge-left')
  target.focus()
  const nudges = f.game.drop.nudges
  press(f, 'KeyD', target)
  f.game.fixed(TUNING.dt)
  assert.equal(f.game.drop.nudges, nudges - 1)
  press(f, 'Space', target)
  assert.equal(f.game.pending.special, false, 'Space on a focused button is reserved for its native activation')
  press(f, 'KeyF', target)
  assert.equal(f.game.pending.flip, true)
  press(f, 'KeyJ', target)
  assert.equal(f.game.screen, 'journal')
  press(f, 'KeyJ', button(f, 'close-journal'))
  assert.equal(f.game.screen, 'drop')
})

await check('pause, settings, journal and resume preserve the live drop and remaining resources', () => {
  const f = begin()
  press(f, 'Enter')
  f.game.fixed(TUNING.dt)
  const drop = f.game.drop
  const state = JSON.stringify({ ball: drop.ball, nudges: drop.nudges, specials: drop.specials, tilts: drop.tilts, time: drop.time })
  click(f, 'pause-btn')
  assert.equal(f.game.screen, 'pause')
  click(f, 'settings')
  assert.equal(f.game.screen, 'settings')
  f.game.fixed(0.5)
  click(f, 'back')
  assert.equal(f.game.screen, 'pause')
  click(f, 'journal')
  assert.equal(f.game.screen, 'journal')
  assert.ok(f.window.document.querySelector('.route-map'))
  click(f, 'close-journal')
  assert.equal(f.game.screen, 'pause')
  click(f, 'resume')
  assert.equal(f.game.screen, 'drop')
  assert.equal(f.game.drop, drop)
  assert.equal(JSON.stringify({ ball: drop.ball, nudges: drop.nudges, specials: drop.specials, tilts: drop.tilts, time: drop.time }), state)
})

await check('visibility pause clears held and queued controls before resuming the same fall', () => {
  const f = begin()
  press(f, 'Enter')
  const drop = f.game.drop
  f.game.input.keys.add('KeyA')
  f.game.input.pressed.add('KeyA')
  f.game.pending.nudge = -1
  f.game.accum = 0.4
  Object.defineProperty(f.window.document, 'hidden', { configurable: true, value: true })
  f.window.document.dispatchEvent(new f.window.Event('visibilitychange'))
  assert.equal(f.game.screen, 'pause')
  assert.equal(f.game.pending.nudge, 0)
  assert.equal(f.game.input.keys.size, 0)
  assert.equal(f.game.input.pressed.size, 0)
  assert.equal(f.game.accum, 0)
  Object.defineProperty(f.window.document, 'hidden', { configurable: true, value: false })
  click(f, 'resume')
  assert.equal(f.game.screen, 'drop')
  f.game.fixed(TUNING.dt)
  assert.equal(f.game.drop, drop)
  assert.equal(drop.nudges, drop.maxNudges)
})

await check('Void has a visible Space trick button whose click and keyboard share finite tilt charges', () => {
  const f = begin({ save: { balls: Object.keys(BALLS), ball: 'void' } })
  press(f, 'Enter')
  const original = f.game.drop.tilts
  const special = button(f, 'special')
  assert.match(special.textContent, /Space/)
  assert.match(special.textContent, /Tilt/)
  assert.equal(special.disabled, false)
  click(f, 'special')
  f.game.fixed(TUNING.dt)
  assert.equal(f.game.drop.tilts, original - 1)
  assert.equal(f.game.hud().specials, original - 1)
  for (let i = 0; i < 60; i++) f.game.fixed(TUNING.dt)
  press(f, 'Space')
  f.game.fixed(TUNING.dt)
  assert.equal(f.game.drop.tilts, original - 2)
  assert.equal(f.game.hud().specials, original - 2)
})

await check('real peg contacts update the reactor HUD and KeyE triggers one visible timed surge', () => {
  const f = begin()
  press(f, 'Enter')
  assert.equal(button(f, 'overdrive').disabled, true)
  assert.match(button(f, 'overdrive').textContent, /0%/)
  for (let tick = 0; tick < 120 * 15 && !f.game.drop.charge && f.game.screen === 'drop'; tick++) f.game.fixed(TUNING.dt)
  assert.ok(f.game.drop.charge > 0 && f.game.drop.charge < 1, 'an ordinary physical contact provides partial energy')
  const partial = button(f, 'overdrive')
  assert.equal(partial.disabled, true)
  assert.match(partial.getAttribute('aria-label'), new RegExp(`${Math.round(f.game.drop.charge * 100)} percent`))
  const fill = f.window.document.querySelector('[data-hud="drive-fill"]') as any
  assert.equal(fill.style.transform, `scaleX(${f.game.drop.charge})`)
  reactorReady(f)
  const ready = button(f, 'overdrive')
  assert.equal(ready.disabled, false)
  assert.ok(ready.classList.contains('ready'))
  assert.match(ready.textContent, /E.*Overdrive.*READY/)
  press(f, 'KeyE')
  assert.equal(f.game.pending.overdrive, true)
  assert.equal(f.game.drop.overdriveUses, 0, 'the input waits for the next physical step')
  consumeControl(f)
  assert.equal(f.game.drop.overdriveUses, 1)
  assert.equal(f.game.hud().overdriveUses, 1, 'the HUD exposes remaining activations')
  assert.ok(f.game.drop.overdriveTime > 0 && f.game.drop.overdriveTime <= 3)
  assert.equal(f.game.pending.overdrive, undefined)
  const active = button(f, 'overdrive')
  assert.equal(active.disabled, true)
  assert.ok(active.classList.contains('active'))
  assert.match(active.textContent, /2× OVERDRIVE/)
  assert.match(active.getAttribute('aria-label'), /Overdrive active/)
  press(f, 'KeyE')
  consumeControl(f)
  assert.equal(f.game.drop.overdriveUses, 1, 'pressing again during the surge cannot spend another activation')
})

await check('the visible Overdrive button spends the same finite reactor pool as its E binding', () => {
  const f = begin()
  reactorReady(f)
  const drop = f.game.drop
  const before = { shell: drop.integrity, nudges: drop.nudges, special: drop.specials, tilt: drop.tilts }
  click(f, 'overdrive')
  assert.equal(f.game.pending.overdrive, true)
  consumeControl(f)
  assert.equal(drop.overdriveUses, 1)
  assert.equal(f.game.drop, drop)
  assert.equal(f.game.hud().overdriveUses, 1)
  assert.deepEqual({ shell: drop.integrity, nudges: drop.nudges, special: drop.specials, tilt: drop.tilts }, before)
  assert.ok(drop.overdriveTime > 0)
  assert.ok(drop.ball.vy < 0, 'the real controller delivers the upward rescue pulse')
  assert.equal(button(f, 'overdrive').disabled, true)
})

await check('Escape and pause button discard a queued surge and paused input cannot spend it', () => {
  for (const pause of ['Escape', 'pause-btn']) {
    const f = begin()
    reactorReady(f)
    const drop = f.game.drop
    drop.hitstop = 0.08
    press(f, 'KeyE')
    assert.equal(f.game.pending.overdrive, true)
    if (pause === 'Escape') press(f, 'Escape')
    else click(f, 'pause-btn')
    assert.equal(f.game.screen, 'pause')
    assert.ok(!f.game.pending.overdrive, 'opening pause drops queued E even during collision hitstop')
    const frozen = JSON.stringify({ time: drop.time, ball: drop.ball, charge: drop.charge, uses: drop.overdriveUses })
    press(f, 'KeyE')
    f.game.onAction('overdrive')
    f.game.fixed(0.5)
    assert.equal(JSON.stringify({ time: drop.time, ball: drop.ball, charge: drop.charge, uses: drop.overdriveUses }), frozen)
    assert.ok(!f.game.pending.overdrive)
    click(f, 'resume')
    for (let tick = 0; tick < 20; tick++) f.game.fixed(TUNING.dt)
    assert.equal(drop.overdriveUses, 0, 'resuming does not silently spend the charge')
    assert.ok(drop.overdriveReady)
    press(f, 'KeyE')
    consumeControl(f)
    assert.equal(drop.overdriveUses, 1, 'a new deliberate press after resuming remains usable')
  }
})

await check('journal and visibility pause clear queued Overdrive before restoring the same charged fall', () => {
  for (const pause of ['journal', 'hidden']) {
    const f = begin()
    reactorReady(f)
    const drop = f.game.drop
    press(f, 'KeyE')
    assert.equal(f.game.pending.overdrive, true)
    if (pause === 'journal') {
      click(f, 'journal')
      assert.equal(f.game.screen, 'journal')
      press(f, 'KeyE')
      f.game.onAction('overdrive')
      f.game.fixed(0.5)
      assert.ok(!f.game.pending.overdrive)
      click(f, 'close-journal')
    } else {
      Object.defineProperty(f.window.document, 'hidden', { configurable: true, value: true })
      f.window.document.dispatchEvent(new f.window.Event('visibilitychange'))
      assert.equal(f.game.screen, 'pause')
      assert.ok(!f.game.pending.overdrive)
      Object.defineProperty(f.window.document, 'hidden', { configurable: true, value: false })
      click(f, 'resume')
    }
    assert.equal(f.game.screen, 'drop')
    assert.equal(f.game.drop, drop)
    for (let tick = 0; tick < 20; tick++) f.game.fixed(TUNING.dt)
    assert.equal(drop.overdriveUses, 0)
    assert.ok(drop.overdriveReady)
  }
})

await check('fork clicks follow their advertised destination and event affordability is enforced', () => {
  const f = begin()
  f.game.enterNode('fork-lane')
  const target = f.game.run.nodes['fork-lane'].options[0].next
  click(f, 'fork:0')
  assert.equal(f.game.run.nodeId, target)
  assert.equal(f.game.screen, 'aim')
  f.game.run.gears = 0
  f.game.enterNode('oracle')
  assert.equal(f.game.screen, 'event')
  const before = JSON.stringify([f.game.run.relics, f.game.run.gears])
  assert.equal(button(f, 'event:0').disabled, true)
  f.game.onAction('event:0')
  assert.equal(f.game.run.nodeId, 'oracle')
  assert.equal(JSON.stringify([f.game.run.relics, f.game.run.gears]), before)
  f.game.run.gears = 50
  f.game.selectedPulse++
  click(f, 'event:0')
  assert.equal(f.game.run.gears, 0)
  assert.equal(f.game.run.relics.length, 2)
  assert.notEqual(f.game.run.nodeId, 'oracle')
})

await check('shop refuses unaffordable purchases and checkpoints every buy and reroll', () => {
  const f = begin()
  f.game.enterNode('shop-brass')
  const offer = f.game.offers[0]
  assert.equal(button(f, 'buy:0').disabled, true)
  f.game.onAction('buy:0')
  assert.ok(!f.game.run.upgrades.includes(offer.id) && !f.game.run.relics.includes(offer.id))
  f.game.run.gears = offer.price
  f.game.selectedPulse++
  click(f, 'buy:0')
  assert.equal(f.game.run.gears, 0)
  assert.ok([...f.game.run.upgrades, ...f.game.run.relics].includes(offer.id))
  assert.equal(checkpoint().run.gears, 0)
  assert.ok([...checkpoint().run.upgrades, ...checkpoint().run.relics].includes(offer.id))
  f.game.run.gears = 100
  f.game.selectedPulse++
  click(f, 'reroll')
  assert.equal(f.game.rerolls, 1)
  assert.equal(checkpoint().rerolls, 1)
  assert.equal(checkpoint().run.gears, 100 - TUNING.shopReroll)
  assert.deepEqual(checkpoint().offers.map((o: any) => o.id), f.game.offers.map((o: any) => o.id))
  click(f, 'reroll')
  const after = f.game.run.gears
  assert.equal(button(f, 'reroll').disabled, true)
  f.game.onAction('reroll')
  assert.equal(f.game.run.gears, after)
})

await check('resume restores purchased inventory and rerolls instead of regenerating shop stock', () => {
  const first = begin()
  first.game.enterNode('shop')
  first.game.run.gears = 500
  first.game.selectedPulse++
  click(first, 'buy:0')
  click(first, 'reroll')
  const saved = localStorage.getItem(CHECKPOINT_KEY)!
  const expected = JSON.parse(saved)
  const next = fixture({ checkpoint: saved })
  click(next, 'continue-run')
  assert.equal(next.game.screen, 'shop')
  assert.equal(next.game.run.gears, expected.run.gears)
  assert.deepEqual(next.game.run.relics, expected.run.relics)
  assert.deepEqual(next.game.run.upgrades, expected.run.upgrades)
  assert.equal(next.game.rerolls, expected.rerolls)
  assert.deepEqual(next.game.offers.map((o: any) => o.id), expected.offers.map((o: any) => o.id))
})

await check('shop repairs enforce their price, cap shell and checkpoint the new state', () => {
  const f = begin()
  f.game.run.integrity = 1
  f.game.run.gears = 0
  f.game.enterNode('shop-brass')
  const price = f.game.shopRepairCost()
  assert.equal(button(f, 'shop-repair').disabled, true)
  f.game.onAction('shop-repair')
  assert.equal(f.game.run.integrity, 1)
  f.game.run.gears = price
  f.game.selectedPulse++
  click(f, 'shop-repair')
  assert.equal(f.game.run.integrity, 2)
  assert.equal(f.game.run.gears, 0)
  assert.equal(checkpoint().run.integrity, 2)
  assert.equal(checkpoint().run.gears, 0)
  f.game.run.gears = 1000
  f.game.run.integrity = f.game.run.integrityMax
  f.game.selectedPulse++
  assert.equal(button(f, 'shop-repair').disabled, true)
  f.game.onAction('shop-repair')
  assert.equal(f.game.run.gears, 1000)
})

await check('resume preserves seed, mode, archive and trial and regenerates the identical aim board', () => {
  const catalogue = ['flywheel', 'glass-heart']
  const url = challengeUrl('https://plumb.test/', { seed: 'RESTORE42', ballId: 'void', mode: 'expedition', ascension: 4, catalogue })
  const first = begin({ url })
  const expectedBoard = JSON.stringify(first.game.drop.board)
  const expectedRun = JSON.parse(JSON.stringify(first.game.run))
  const saved = localStorage.getItem(CHECKPOINT_KEY)!
  const next = fixture({ checkpoint: saved, save: { researched: [...RESEARCH_ORDER], mastery: { rubber: 6, prism: 6, void: 6 } } })
  click(next, 'continue-run')
  assert.equal(next.game.screen, 'aim')
  assert.equal(next.game.run.seed, expectedRun.seed)
  assert.equal(next.game.run.ballId, 'void')
  assert.equal(next.game.run.ascension, 4)
  assert.equal(next.game.run.mode, 'expedition')
  assert.deepEqual(next.game.run.catalogue, catalogue)
  assert.deepEqual(next.game.run.relics, expectedRun.relics)
  assert.equal(JSON.stringify(next.game.drop.board), expectedBoard)
})

await check('daily has a fixed sphere and full archive independent of personal unlocks', () => {
  assert.deepEqual(dailyExpedition(new Date('2026-10-23T12:00:00Z')).seed, 'DAY20261023')
  const today = dailyExpedition()
  const first = fixture()
  click(first, 'daily')
  assert.equal(first.game.screen, 'choices')
  assert.equal(first.game.run.ballId, today.ballId)
  assert.equal(first.game.run.seed, today.seed)
  assert.equal(first.game.run.mode, 'daily')
  assert.deepEqual(first.game.run.catalogue, [...RESEARCH_ORDER])
  const offers = first.game.offers.map((o: any) => o.id)
  click(first, 'pick:0')
  const board = JSON.stringify(first.game.drop.board)
  const rich = fixture({ save: { balls: Object.keys(BALLS), researched: [...RESEARCH_ORDER], runs: 99, ball: 'void' } })
  click(rich, 'daily')
  assert.deepEqual(rich.game.offers.map((o: any) => o.id), offers)
  click(rich, 'pick:0')
  assert.equal(JSON.stringify(rich.game.drop.board), board)
})

await check('shared challenge parameters faithfully reproduce sphere, trial and captured archive', async () => {
  const catalogue = ['portal-passport', 'glass-heart']
  const url = challengeUrl('https://plumb.test/subpath?old=1#old', { seed: 'FRIENDS7', ballId: 'prism', mode: 'expedition', ascension: 3, catalogue })
  const params = new URL(url).searchParams
  assert.equal(params.get('seed'), 'FRIENDS7')
  assert.equal(params.get('sphere'), 'prism')
  assert.equal(params.get('trial'), '3')
  assert.equal(params.get('rules'), '2')
  assert.equal(params.get('archive'), catalogue.join(','))
  assert.equal(params.has('old'), false)
  const f = begin({ url })
  assert.equal(f.game.run.ballId, 'prism')
  assert.equal(f.game.run.ascension, 3)
  assert.deepEqual(f.game.run.catalogue, catalogue)
  f.game.onAction('copy-challenge')
  await Promise.resolve()
  assert.ok(f.copied.length)
  const copied = new URL(f.copied.at(-1)!)
  for (const key of ['seed', 'sphere', 'trial', 'rules', 'archive']) assert.equal(copied.searchParams.get(key), params.get(key))
})

await check('retry and logbook replay retain the original trial and archive after personal research changes', () => {
  const catalogue = ['glass-heart', 'flywheel']
  const url = challengeUrl('https://plumb.test/', { seed: 'REPEAT42', ballId: 'prism', mode: 'expedition', ascension: 3, catalogue })
  const f = begin({ url })
  const draft = f.game.offers.map((o: any) => o.id)
  finish(f, { dead: true, captured: 'hazard', integrity: 0, hazardThis: 1 })
  click(f, 'skip')
  f.game.save.researched = [...RESEARCH_ORDER]
  click(f, 'retry')
  assert.equal(f.game.run.seed, 'REPEAT42')
  assert.equal(f.game.run.ballId, 'prism')
  assert.equal(f.game.run.ascension, 3)
  assert.deepEqual(f.game.run.catalogue, catalogue)
  assert.deepEqual(f.game.offers.map((o: any) => o.id), draft)
  click(f, 'pick:0')
  finish(f, { dead: true, captured: 'hazard', integrity: 0, hazardThis: 1 })
  click(f, 'skip')
  click(f, 'hub')
  click(f, 'history')
  click(f, 'replay:0')
  assert.equal(f.game.screen, 'choices')
  assert.equal(f.game.run.seed, 'REPEAT42')
  assert.equal(f.game.run.ascension, 3)
  assert.deepEqual(f.game.run.catalogue, catalogue)
  assert.deepEqual(f.game.offers.map((o: any) => o.id), draft)
})

await check('daily score persists by date and retry keeps daily rules and offers', () => {
  const f = fixture()
  click(f, 'daily')
  const seed = f.game.run.seed
  const ball = f.game.run.ballId
  const draft = f.game.offers.map((o: any) => o.id)
  click(f, 'pick:0')
  f.game.run.score = 321
  finish(f, { dead: true, captured: 'hazard', integrity: 0, hazardThis: 1 })
  click(f, 'skip')
  const day = `${seed.slice(3, 7)}-${seed.slice(7, 9)}-${seed.slice(9, 11)}`
  assert.equal(f.game.save.dailyBest[`${day}@3`], 321)
  click(f, 'retry')
  assert.equal(f.game.run.mode, 'daily')
  assert.equal(f.game.run.seed, seed)
  assert.equal(f.game.run.ballId, ball)
  assert.deepEqual(f.game.run.catalogue, [...RESEARCH_ORDER])
  assert.deepEqual(f.game.offers.map((o: any) => o.id), draft)
})

await check('old checkpoints and shared challenges preserve classic routes while new expeditions add guardians', () => {
  const current = begin()
  assert.equal(current.game.run.rules, 3)
  current.game.enterNode('gallery')
  assert.equal(current.game.drop.board.encounter.id, 'bellkeeper')
  current.game.checkpoint()
  const data = checkpoint()
  delete data.run.rules
  const legacy = fixture({ checkpoint: JSON.stringify(data) })
  click(legacy, 'continue-run')
  assert.equal(legacy.game.run.rules, 2)
  assert.equal(legacy.game.drop.board.encounter, undefined)
  assert.equal(legacy.game.run.nodeId, 'gallery')
  const classic = begin({ url: challengeUrl('https://plumb.test/', { seed: 'KEEPOLD', ballId: 'rubber', mode: 'expedition', ascension: 0, rules: 2 }) })
  assert.equal(classic.game.run.rules, 2)
  classic.game.enterNode('dynamo')
  assert.equal(classic.game.drop.board.encounter, undefined)
  const modern = begin({ url: challengeUrl('https://plumb.test/', { seed: 'KEEPOLD', ballId: 'rubber', mode: 'expedition', ascension: 0, rules: 3 }) })
  assert.equal(modern.game.run.rules, 3)
  modern.game.enterNode('dynamo')
  assert.equal(modern.game.drop.board.encounter.id, 'heartforge')
})

await check('physical guardian credit pays once, earns a relic, and never impersonates a Grinder victory', () => {
  const f = begin()
  const g = f.game
  g.enterNode('gallery')
  press(f, 'Enter')
  const events: any[] = []
  const react = g.react.bind(g)
  g.react = (event: any) => { events.push(event); react(event) }
  for (const id of [0, 1, 2]) {
    const bumper = g.drop.board.bumpers.find((b: any) => b.relay === id)
    assert.ok(bumper)
    // Stage an incoming physical strike, not a synthetic clear event.
    Object.assign(g.drop.ball, { x: bumper.x, y: bumper.y - bumper.r - g.drop.ball.r + 1, vx: 0, vy: 500 })
    g.drop.hitstop = 0
    g.fixed(TUNING.dt)
  }
  assert.equal(g.drop.encounterProgress, 3)
  assert.equal(g.drop.encounterComplete, true)
  assert.equal(events.filter(e => e.type === 'encounter-clear').length, 1)
  assert.equal(events.find(e => e.type === 'encounter-clear').gears, 70)
  assert.equal(g.run.gears, g.drop.earned)
  assert.equal(g.run.score, g.drop.earned)
  assert.equal(g.drop.wonBoss, false)
  finish(f)
  assert.equal(g.run.clears, 0)
  assert.equal(g.run.bossWin, false)
  click(f, 'skip')
  assert.equal(g.screen, 'choices')
  assert.ok(g.offers.every((o: any) => o.kind === 'relic'))
  assert.equal(g.stage().kicker, 'A relic')
})

await check('incomplete guardians continue normally and the risky kiln retains its promised relic', () => {
  for (const [id, screen] of [['gallery', 'shop'], ['kiln', 'choices'], ['dynamo', 'repair']]) {
    const f = begin()
    f.game.enterNode(id)
    finish(f)
    click(f, 'skip')
    assert.equal(f.game.screen, screen)
    assert.equal(f.game.run.clears, 0)
    assert.equal(f.game.run.bossWin, false)
    if (id === 'kiln') assert.ok(f.game.offers.every((o: any) => o.kind === 'relic'))
  }
})

await check('Workshop coaching follows actual controls, tolerates refunds, and can be dismissed or replayed', () => {
  const f = begin()
  const g = f.game
  assert.equal(g.hud().coach.step, 1)
  reactorReady(f)
  assert.equal(g.hud().coach.step, 3)
  press(f, 'KeyA')
  g.drop.hitstop = 0
  g.fixed(TUNING.dt)
  assert.equal(g.workshopNudged, true)
  // A refunded charge must not erase the fact that the player learned a nudge.
  g.drop.nudges = g.drop.maxNudges
  press(f, 'KeyE')
  consumeControl(f)
  assert.equal(g.save.coachingComplete, true)
  assert.equal(g.hud().coach, null)
  const saved = JSON.stringify(g.suspended)
  g.toHub()
  click(f, 'help')
  click(f, 'coach-enable')
  assert.equal(g.screen, 'hub')
  assert.equal(g.save.coachingComplete, false)
  assert.equal(JSON.stringify(g.suspended), saved, 'enabling tips preserves the expedition checkpoint')
  click(f, 'continue-run')
  assert.equal(g.hud().coach.step, 1)
  click(f, 'coach-dismiss')
  assert.equal(g.save.coachingComplete, true)
  assert.equal(loadSave().coachingComplete, true)
  assert.equal(g.hud().coach, null)
})

await check('Brass Ledger net drop earnings reconcile with controller currency and score', () => {
  const f = begin()
  f.game.run.relics = ['brass-ledger']
  f.game.run.gears = 100
  f.game.run.score = 200
  f.game.enterNode('workshop')
  press(f, 'Enter')
  const d = f.game.drop
  const p = d.board.pegs.find((p: any) => p.kind === 'normal' && !p.motion)
  assert.ok(p)
  d.ball.x = p.x
  d.ball.y = p.y - p.r - d.ball.r + 1
  d.ball.vx = 0
  d.ball.vy = 740
  f.game.fixed(TUNING.dt)
  assert.equal(d.investments, 1)
  assert.equal(f.game.run.gears - 100, d.earned)
  assert.equal(f.game.run.score - 200, d.earned)
})

await check('a commission pays and mends once, then remains claimed', () => {
  const f = begin()
  f.game.run.commissions = ['gold']
  f.game.run.claimed = []
  f.game.run.golds = 11
  const commission = COMMISSIONS.find(c => c.id === 'gold')!
  finish(f, { golds: 1, integrity: 1 })
  assert.deepEqual(f.game.run.claimed, ['gold'])
  assert.equal(f.game.run.gears, commission.gears)
  assert.equal(f.game.run.score, commission.gears)
  assert.equal(f.game.run.integrity, 2)
  assert.equal(f.game.hud().shell, 2, 'the resolved HUD includes the commission repair immediately')
  f.game.enterNode('gallery')
  finish(f, { golds: 1 })
  assert.deepEqual(f.game.run.claimed, ['gold'])
  assert.equal(f.game.run.gears, commission.gears)
})

await check('banking victory records the win, awards mastery and clears the checkpoint', () => {
  const f = begin()
  victory(f)
  assert.equal(f.game.run.clears, 1)
  click(f, 'bank')
  assert.equal(f.game.screen, 'runend')
  assert.equal(f.game.save.history[0].win, true)
  assert.equal(f.game.save.history[0].clears, 1)
  assert.equal(f.game.save.mastery.rubber, 1)
  assert.ok(f.game.save.challenges.includes('grinder'))
  assert.ok(f.game.save.challenges.includes('win-rubber'))
  assert.equal(readCheckpoint(), null)
})

await check('looping preserves the build, heals shell and retains the cleared boss after later failure', () => {
  const f = begin()
  f.game.run.upgrades.push('side-jets')
  f.game.recompute()
  const relics = [...f.game.run.relics]
  victory(f)
  f.game.run.integrity = 1
  click(f, 'loop')
  assert.equal(f.game.screen, 'choices')
  assert.equal(f.game.run.loop, 1)
  assert.equal(f.game.run.clears, 1)
  assert.deepEqual(f.game.run.relics, relics)
  assert.ok(f.game.run.upgrades.includes('side-jets'))
  assert.equal(f.game.run.integrity, f.game.run.integrityMax)
  click(f, 'pick:0')
  assert.equal(f.game.run.relics.length, relics.length + 1)
  finish(f, { dead: true, captured: 'hazard', integrity: 0, hazardThis: 1 })
  click(f, 'skip')
  assert.equal(f.game.screen, 'runend')
  assert.equal(f.game.save.history[0].clears, 1)
  assert.equal(f.game.save.mastery.rubber, 1)
  assert.ok(f.game.save.challenges.includes('grinder'))
  assert.ok(f.game.save.challenges.includes('win-rubber'))
  assert.equal(readCheckpoint(), null)
})

await check('explicit abandonment clears both unlaunched and launched checkpoints', () => {
  let f = begin()
  click(f, 'pause-btn')
  click(f, 'abandon')
  assert.equal(f.game.screen, 'hub')
  assert.equal(f.game.save.runs, 0)
  assert.equal(readCheckpoint(), null)
  f = begin()
  press(f, 'Enter')
  click(f, 'pause-btn')
  click(f, 'abandon')
  assert.equal(f.game.screen, 'runend')
  assert.equal(f.game.save.runs, 1)
  assert.equal(readCheckpoint(), null)
})

function offerValue(id: string): number {
  const priority: Record<string, number> = {
    'velvet-fuse': 100, 'spare-shell': 95, 'spring-soul': 85, 'arc-coil': 82,
    'salvage-crown': 80, 'heated-skin': 75, 'heavy-crown': 70, 'clean-contract': 65,
    'long-ratchet': 60, 'first-gild': 60, 'shock-absorber': 55, 'golden-rudder': 50,
    'golden-magnet': 45, 'brass-ledger': 45, 'compound-interest': 40, 'landing-gear': 40,
    'glass-heart': -50,
  }
  return priority[id] ?? 30
}

/** Try legal aim angles on cloned physics, then play the selected angle through
 * the actual Game controller. No resources, positions or results are changed. */
function chooseAim(g: Controller): number {
  const original = g.drop as Drop
  let bestAngle = 0
  let bestValue = -Infinity
  const divisions = original.board.boss ? 24 : 12
  for (let i = 0; i <= divisions; i++) {
    const angle = -original.profile.aimCone + original.profile.aimCone * 2 * i / divisions
    const ghost = new Drop(original.board, original.ballDef.id, original.profile, original.integrity, original.integrityMax)
    ghost.launch(angle)
    for (let tick = 0; tick < 120 * 240 && !ghost.captured && !ghost.dead; tick++) {
      ghost.step(TUNING.dt * ghost.timeScale)
      ghost.pullEvents()
    }
    assert.ok(ghost.captured || ghost.dead, 'legal aim search resolves without an endless fall')
    const value = original.board.boss
      ? (ghost.wonBoss ? ghost.dead ? 9e8 : 1e9 : -1e8) + ghost.coreHits * 1e6 + ghost.integrity * 1e4 + ghost.earned
      : (ghost.dead ? -1e7 : 1e7) + ghost.integrity * 1e5 + ghost.earned
    if (value > bestValue) { bestValue = value; bestAngle = angle }
  }
  return bestAngle
}

function playActualExpedition(f: Fixture) {
  const g = f.game
  const seen = new Set<string>()
  let machines = 0
  let shops = 0
  let events = 0
  let buys = 0
  for (let decision = 0; decision < 160 && g.screen !== 'runend' && g.screen !== 'victory'; decision++) {
    seen.add(g.screen)
    render(f)
    switch (g.screen) {
      case 'choices': {
        const ranked = g.offers.map((offer: any, index: number) => ({ index, value: offerValue(offer.id) })).sort((a: any, b: any) => b.value - a.value)
        click(f, ranked.length ? `pick:${ranked[0].index}` : 'skip')
        break
      }
      case 'aim': {
        g.keyboardAim = chooseAim(g)
        const before = g.run.drops
        press(f, 'Enter')
        assert.equal(g.screen, 'drop')
        for (let tick = 0; tick < 120 * 260 && g.screen === 'drop'; tick++) g.fixed(TUNING.dt)
        assert.equal(g.screen, 'resolve', 'a real physical fall reaches controller resolution')
        assert.equal(g.run.drops, before + 1)
        const counted = g.run.drops
        g.finishDrop()
        assert.equal(g.run.drops, counted, 'a resolved fall is counted exactly once')
        assert.ok(g.drop.captured || g.drop.dead)
        assert.ok(Number.isFinite(g.run.score) && g.run.score >= 0)
        assert.ok(Number.isFinite(g.run.gears) && g.run.gears >= 0)
        assert.ok(g.run.integrity >= 0 && g.run.integrity <= g.run.integrityMax)
        machines++
        break
      }
      case 'resolve': click(f, 'skip'); break
      case 'fork': {
        const node = g.run.nodes[g.run.nodeId]
        const index = Math.max(0, node.options.findIndex((o: any) => o.risk === 'safe'))
        const next = node.options[index].next
        click(f, `fork:${index}`)
        assert.equal(g.run.nodeId, next)
        break
      }
      case 'event': {
        const type = g.run.nodes[g.run.nodeId].eventId
        let index = type === 'salvage' ? g.run.integrity < g.run.integrityMax ? 0 : 2
          : type === 'resonance' ? g.run.integrity < g.run.integrityMax ? 2 : 1
          : g.run.integrity < g.run.integrityMax && g.run.gears >= 20 ? 1 : g.run.gears >= 50 ? 0 : 2
        if (button(f, `event:${index}`).disabled) index = 2
        click(f, `event:${index}`)
        events++
        break
      }
      case 'shop': {
        shops++
        while (g.run.integrity < g.run.integrityMax && g.run.gears >= g.shopRepairCost()) click(f, 'shop-repair')
        for (let purchase = 0; purchase < 3; purchase++) {
          const ranked = g.offers.map((offer: any, index: number) => ({ index, offer })).filter((item: any) => item.offer.price <= g.run.gears).sort((a: any, b: any) => offerValue(b.offer.id) - offerValue(a.offer.id))
          if (!ranked.length) break
          click(f, `buy:${ranked[0].index}`)
          assert.equal(checkpoint().run.gears, g.run.gears)
          buys++
        }
        if (shops === 1 && g.run.gears >= TUNING.shopReroll) click(f, 'reroll')
        click(f, 'leave')
        break
      }
      case 'repair': click(f, 'repair'); break
      case 'bargain': click(f, 'bargain:walk'); break
      default: assert.fail(`autoplay reached an unexpected state: ${g.screen}`)
    }
  }
  assert.ok(g.screen === 'victory' || g.screen === 'runend', 'the expedition reaches exactly one legitimate end state')
  render(f)
  if (g.screen === 'victory') {
    assert.equal(g.drop.wonBoss, true)
    assert.equal(g.drop.coreHits, 5)
    assert.ok(machines >= 10 && machines <= 11)
    assert.equal(events, 3)
    assert.ok(shops >= 2)
    assert.ok(buys > 0)
    for (const screen of ['choices', 'aim', 'resolve', 'fork', 'event', 'shop', 'repair']) assert.ok(seen.has(screen), `complete expedition exercised ${screen}`)
  } else {
    assert.equal(g.save.runs, 1)
    assert.equal(g.save.history.length, 1)
    assert.ok(g.run.integrity <= 0 || g.run.bossWin, 'a finished physical run ends by shell loss or a real core clear')
    g.onAction('skip')
    assert.equal(g.save.runs, 1, 'a late resolve click cannot end the same run twice')
  }
  return { win: g.screen === 'victory', machines, shops, events, buys }
}

await check('three full physical expeditions traverse real rooms, ending legitimately and banking a real victory', () => {
  let victories = 0
  let resumedCircuit = false
  const scenarios = [
    { seed: 'HELIX2026', ball: 'rubber' },
    { seed: 'STARFALL', ball: 'prism' },
    { seed: 'WORLDTOUR', ball: 'void' },
  ]
  for (const scenario of scenarios) {
    const f = fixture({ url: `https://plumb.test/?seed=${scenario.seed}`, save: { balls: Object.keys(BALLS), ball: scenario.ball } })
    click(f, 'start')
    const result = playActualExpedition(f)
    console.log(`  PHYSICS ${scenario.seed}/${scenario.ball}: ${result.win ? 'Grinder defeated' : 'shell lost'}, ${result.machines} machines, ${result.events} events, ${result.buys} purchases`)
    if (!result.win) continue
    victories++
    const victoryCheckpoint = localStorage.getItem(CHECKPOINT_KEY)!
    const archive = localStorage.getItem(SAVE_KEY)!
    const inventory = [...f.game.run.relics, ...f.game.run.upgrades]
    click(f, 'bank')
    assert.equal(f.game.screen, 'runend')
    assert.equal(f.game.save.runs, 1)
    assert.equal(f.game.save.history.length, 1)
    assert.equal(f.game.save.history[0].win, true)
    assert.equal(readCheckpoint(), null)
    f.game.onAction('bank')
    assert.equal(f.game.save.runs, 1, 'a repeated bank action cannot award the same expedition twice')
    if (!resumedCircuit) {
      // Branch the actual earned victory snapshot through its other legal choice.
      let next = fixture({ checkpoint: victoryCheckpoint, rawSave: archive })
      click(next, 'continue-run')
      assert.equal(next.game.screen, 'victory')
      click(next, 'loop')
      assert.equal(next.game.run.loop, 1)
      const saved = localStorage.getItem(CHECKPOINT_KEY)!
      const save = localStorage.getItem(SAVE_KEY)!
      const offers = next.game.offers.map((o: any) => o.id)
      next = fixture({ checkpoint: saved, rawSave: save })
      click(next, 'continue-run')
      assert.equal(next.game.screen, 'choices')
      assert.equal(next.game.run.loop, 1)
      assert.equal(next.game.run.clears, 1)
      assert.equal(next.game.run.integrity, next.game.run.integrityMax)
      assert.deepEqual([...next.game.run.relics, ...next.game.run.upgrades], inventory)
      assert.deepEqual(next.game.offers.map((o: any) => o.id), offers)
      click(next, 'pick:0')
      next.game.keyboardAim = chooseAim(next.game)
      press(next, 'Enter')
      for (let tick = 0; tick < 120 * 260 && next.game.screen === 'drop'; tick++) next.game.fixed(TUNING.dt)
      assert.equal(next.game.screen, 'resolve')
      assert.ok(next.game.drop.captured || next.game.drop.dead)
      next.game.endRun(false)
      assert.equal(readCheckpoint(), null)
      resumedCircuit = true
    }
  }
  assert.ok(victories >= 1, 'at least one complete seeded expedition earns a real five-hit boss victory')
  assert.equal(resumedCircuit, true)
})

for (const window of windows) await window.happyDOM.close()
console.log(`${checks} expedition integration checks passed${failures ? `; ${failures} failed` : ''}.`)
if (failures) process.exitCode = 1
