import { test, expect, type Page, type TestInfo } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { commissionSet } from '../../src/meta/expedition'
import { createRoute } from '../../src/game/route'
import { rngFor } from '../../src/core/rng'
import { RELICS, UPGRADES } from '../../src/content/catalog'

const seed = 'HELIX2026'
const action = (page: Page, name: string) => page.locator(`[data-act="${name}"]:visible`).last()

async function capture(page: Page, info: TestInfo, name: string) {
  await mkdir('artifacts/browser', { recursive: true })
  const path = `artifacts/browser/${info.project.name}-${name}.png`
  // The game owns a fixed viewport; capture it at CSS resolution even on high-DPI phones.
  await page.screenshot({ path, fullPage: false, scale: 'css', animations: 'disabled' })
  await info.attach(name, { path, contentType: 'image/png' })
}

async function cleanLayout(page: Page) {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      if (animation.effect?.getComputedTiming().iterations !== Infinity) animation.finish()
    }
  })
  const problems = await page.evaluate(() => {
    const issues: string[] = []
    if (document.documentElement.scrollWidth > innerWidth + 2) issues.push('Document overflows horizontally')
    for (const element of document.querySelectorAll<HTMLElement>('#stage button, #stage input, #hud button')) {
      const style = getComputedStyle(element)
      const r = element.getBoundingClientRect()
      if (!r.width || !r.height || style.visibility === 'hidden' || style.display === 'none') continue
      if (r.left < -2 || r.right > innerWidth + 2) issues.push(`${element.dataset.act ?? element.tagName} overflows horizontally`)
      if (element.closest('.controls') && (r.top < 0 || r.bottom > innerHeight + 2)) issues.push(`${element.dataset.act} falls outside the control area`)
      if (element.closest('.controls') && /^(aim|drop)$/.test(document.getElementById('app')!.dataset.mode ?? '')) {
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        if (!hit || !element.contains(hit)) issues.push(`${element.dataset.act} is covered by another element`)
      }
    }
    if (innerWidth <= 760 && /^(aim|drop)$/.test(document.getElementById('app')!.dataset.mode ?? '')) {
      const title = document.querySelector<HTMLElement>('[data-hud="mobile-title"]')!
      const hud = document.getElementById('hud')!
      const status = document.querySelector<HTMLElement>(hud.dataset.encounter === 'true' ? '.mobile-encounter > strong' : hud.dataset.coach === 'true' ? '.mobile-coach p' : '[data-hud="mobile-status"]')!
      if (!title.textContent?.trim() || !title.getBoundingClientRect().width) issues.push('Mobile machine title is hidden')
      if (!status.textContent?.trim() || !status.getBoundingClientRect().width) issues.push('Mobile machine status is hidden')
      for (const label of document.querySelectorAll<HTMLElement>('.controls .touch-label, .controls .overdrive-key .lbl')) {
        if (!label.getBoundingClientRect().width || Number.parseFloat(getComputedStyle(label).fontSize) < 9) issues.push('Touch action label is hidden or too small')
      }
      const header = [...document.querySelectorAll<HTMLElement>('.mobile-place, .tally.show, .mobile-journal')]
        .filter(el => getComputedStyle(el).display !== 'none').map(el => ({ name: el.className, rect: el.getBoundingClientRect() }))
      for (let i = 0; i < header.length; i++) for (let j = i + 1; j < header.length; j++) {
        const a = header[i].rect, b = header[j].rect
        if (Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)) {
          issues.push(`${header[i].name} overlaps ${header[j].name}`)
        }
      }
    }
    if (/\b(?:undefined|NaN)\b/.test(document.getElementById('app')!.textContent ?? '')) issues.push('Invalid UI value')
    return issues
  })
  expect(problems).toEqual([])
}

async function start(page: Page) {
  await page.goto(`/?seed=${seed}`)
  await action(page, 'start').click()
  await expect(page.locator('.card.offer')).toHaveCount(3)
}

async function room(page: Page, nodeId: string, screen = 'aim', rules: 2 | 3 = 3) {
  const route = createRoute(rngFor(seed, 'route:0'), { rules })
  const checkpoint = {
    version: 2, screen, offers: [], rerolls: 0, drafting: false, draftTitle: '',
    run: {
      seed, ballId: 'rubber', nodeId, rules, upgrades: ['capacitor', 'plumb-line'], relics: ['arc-coil'],
      gears: 300, score: 1200, integrity: 3, integrityMax: 3,
      drops: Math.max(0, route.nodes[nodeId].depth - 1), bestCombo: 12, bestMult: 2.4,
      shatters: 0, portals: 0, jackpots: 0, flipGold: false, cleanDrop: false,
      bossWin: screen === 'victory', launchedOnce: true, depthTitle: route.nodes[nodeId].title,
      boardNonce: 0, reachedCore: false, mode: 'expedition', ascension: 0, loop: 0,
      clears: screen === 'victory' ? 1 : 0, catalogue: Object.keys(RELICS),
      commissions: commissionSet(seed), claimed: [], cleanDrops: 0, golds: 0, pegs: 0,
      visited: ['workshop', nodeId],
    },
  }
  if (screen === 'shop') {
    checkpoint.offers = ['capacitor', 'shock-absorber', 'compound-interest'].map(id => ({
      kind: 'upgrade', id, name: UPGRADES[id].name, text: UPGRADES[id].text,
      tags: UPGRADES[id].tags, price: 50,
    })) as never[]
  }
  await page.goto('/')
  await page.evaluate(data => localStorage.setItem('plumb-expedition-v2', JSON.stringify(data)), checkpoint)
  await page.reload()
  await action(page, 'continue-run').click()
  await expect(page.locator('#app')).toHaveAttribute('data-mode', screen)
}

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.route('https://fonts.gstatic.com/**', route => route.abort())
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  ;(page as Page & { gameErrors?: string[] }).gameErrors = errors
  await page.addInitScript(() => {
    if (!localStorage.getItem('plumb-save-v1')) localStorage.setItem('plumb-save-v1', JSON.stringify({
      version: 1, settings: { volume: 0, speed: 1 },
    }))
  })
})

test.afterEach(async ({ page }) => {
  expect((page as Page & { gameErrors?: string[] }).gameErrors).toEqual([])
})

test('hub, seed editor and settings remain usable without external fonts', async ({ page }, info) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'PLUMB', exact: true })).toBeVisible()
  await cleanLayout(page)
  await capture(page, info, 'hub')
  await page.locator('[data-seed]').fill('MYSEED42')
  await page.locator('[data-seed]').press('Enter')
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'hub')
  await action(page, 'settings').click()
  await action(page, 'speed:0.75').click()
  await expect(action(page, 'speed:0.75')).toHaveAttribute('aria-pressed', 'true')
  await cleanLayout(page)
  await action(page, 'back').click()
  await action(page, 'start').click()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('plumb-expedition-v2')!))
  expect(saved.run.seed).toBe('MYSEED42')
})

test('draft, launch, pause and constellation journal work through real controls', async ({ page }, info) => {
  await start(page)
  await cleanLayout(page)
  await capture(page, info, 'relic-draft')
  await action(page, 'pick:0').click()
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'aim')
  await cleanLayout(page)
  await capture(page, info, 'workshop-aim')
  await action(page, 'overview').click()
  await expect(action(page, 'overview')).toHaveAttribute('aria-pressed', 'true')
  await capture(page, info, 'machine-overview')
  await action(page, 'overview').click()
  if (/phone|tablet/.test(info.project.name)) {
    await expect(page.locator('#view')).toHaveCSS('touch-action', 'none')
    const bounds = await page.locator('#view').boundingBox()
    expect(bounds).toBeTruthy()
    await page.locator('#view').tap({ position: { x: bounds!.width * 0.6, y: bounds!.height * 0.35 } })
  } else await action(page, 'launch').click()
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'drop')
  await action(page, 'pause-btn').click()
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'pause')
  await cleanLayout(page)
  await action(page, 'journal').click()
  await expect(page.locator('.route-act')).toHaveCount(3)
  await cleanLayout(page)
  await capture(page, info, 'journal')
  await page.locator('.route-heading').scrollIntoViewIfNeeded()
  await page.locator('.route-node.current summary').click()
  await expect(page.locator('.route-node.current')).toHaveAttribute('open', '')
  await capture(page, info, 'constellation-route')
  await action(page, 'close-journal').first().click()
  await action(page, 'resume').click()
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'drop')
})

test('physical peg hits charge Overdrive and its browser button activates the surge', async ({ page }, info) => {
  if (info.project.name.includes('phone')) await page.setViewportSize({ width: 360, height: 740 })
  await page.clock.install()
  await room(page, 'workshop')
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  if (/phone|tablet/.test(info.project.name)) await action(page, 'launch').tap()
  else await action(page, 'launch').click()
  let charged = false
  for (let i = 0; i < 36; i++) {
    await page.clock.runFor(250)
    if (await action(page, 'overdrive').isEnabled()) { charged = true; break }
    if (await page.locator('#app').getAttribute('data-mode') !== 'drop') break
  }
  expect(charged, 'real collisions naturally charge the reactor').toBe(true)
  await expect(action(page, 'overdrive')).toContainText('READY')
  if (/phone|tablet/.test(info.project.name)) await action(page, 'overdrive').tap()
  else await action(page, 'overdrive').click()
  await page.clock.runFor(100)
  await expect(action(page, 'overdrive')).toHaveClass(/active/)
  await expect(action(page, 'overdrive')).toContainText('2× OVERDRIVE')
  await cleanLayout(page)
  await capture(page, info, 'overdrive-active')
  await page.keyboard.press('Escape')
  await page.clock.runFor(50)
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'pause')
  await page.clock.fastForward(5000)
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'pause')
  await action(page, 'resume').click()
  await page.clock.runFor(50)
  await expect(action(page, 'overdrive')).toHaveClass(/active/)
  const resumed = Number.parseFloat(await page.locator('[data-hud="drive-status"]').textContent() ?? '')
  expect(resumed, 'a surge survives a pause longer than its entire duration').toBeGreaterThan(0)
})

test('three machine identities and boss render at desktop and touch sizes', async ({ page }, info) => {
  for (const id of ['workshop', 'press', 'core', 'grinder']) {
    await room(page, id)
    await cleanLayout(page)
    await expect(page.locator('canvas#view')).toBeVisible()
    if (id === 'grinder' && page.viewportSize()!.width <= 760) await expect(page.locator('[data-hud="mobile-status"]')).toHaveText('Strike the core · 0/5')
    await capture(page, info, `${id}-machine`)
  }
})

test('limited controls spend their displayed charges through clicks and touch', async ({ page }, info) => {
  if (info.project.name.includes('phone')) await page.setViewportSize({ width: 360, height: 740 })
  await page.clock.install()
  await room(page, 'workshop')
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  const activate = async (name: string) => {
    if (/phone|tablet/.test(info.project.name)) await action(page, name).tap()
    else await action(page, name).click()
    await page.clock.runFor(150)
  }
  await activate('launch')
  await cleanLayout(page)
  for (const [name, resource] of [['nudge-left', 'nudges'], ['special', 'specials'], ['tilt', 'tilts']]) {
    if (name === 'tilt') {
      await expect(action(page, 'tilt')).toBeDisabled()
      await expect(action(page, 'tilt')).toHaveAttribute('aria-label', /recovering/)
      await page.clock.runFor(500)
      await expect(action(page, 'tilt')).toBeEnabled()
    }
    const pips = action(page, name).locator(`[data-pips="${resource}"] i.on`)
    const available = await pips.count()
    expect(available).toBeGreaterThan(0)
    await activate(name)
    await expect(pips).toHaveCount(available - 1)
  }
  await activate('flip')
  await expect(action(page, 'flip')).toBeDisabled()
  await cleanLayout(page)
  await capture(page, info, 'limited-controls-spent')
})

test('forks, events, shop and victory have readable working decision screens', async ({ page }, info) => {
  for (const [id, screen] of [['fork-lane', 'fork'], ['salvage', 'event'], ['shop-brass', 'shop'], ['rest-brass', 'repair'], ['bargain', 'bargain'], ['grinder', 'victory']]) {
    await room(page, id, screen)
    await cleanLayout(page)
    await capture(page, info, screen)
    if (screen === 'fork') {
      await action(page, 'fork:0').click()
      await expect(page.locator('#app')).toHaveAttribute('data-mode', 'aim')
    }
    if (screen === 'event') {
      await action(page, 'event:0').click()
      await expect(page.locator('#app')).toHaveAttribute('data-mode', 'fork')
    }
    if (screen === 'shop') {
      await action(page, 'buy:1').click()
      const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('plumb-expedition-v2')!))
      expect(snapshot.run.gears).toBe(250)
      expect(snapshot.run.upgrades).toContain('shock-absorber')
    }
    if (screen === 'victory') {
      await action(page, 'loop').click()
      await expect(page.locator('#app')).toHaveAttribute('data-mode', 'choices')
    }
    if (screen === 'repair') {
      await action(page, 'repair').click()
      await expect(page.locator('#app')).toHaveAttribute('data-mode', 'aim')
    }
    if (screen === 'bargain') {
      await action(page, 'bargain:walk').click()
      await expect(page.locator('#app')).toHaveAttribute('data-mode', 'aim')
    }
  }
})

test('checkpoint survives reload and reduced motion plus large type stays readable', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const animated = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getComputedTiming().iterations === Infinity).length)
  expect(animated, 'reduced motion removes continuous UI animation').toBe(0)
  await action(page, 'settings').click()
  await action(page, 'toggle:large').click()
  await action(page, 'back').click()
  await cleanLayout(page)
  await start(page)
  await action(page, 'pick:0').click()
  await page.reload()
  await action(page, 'continue-run').click()
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'aim')
  await cleanLayout(page)
  await capture(page, info, 'large-reduced-motion')
  if (info.project.name.includes('phone')) {
    await page.setViewportSize({ width: 360, height: 740 })
    await cleanLayout(page)
    await capture(page, info, 'narrow-phone-large-type')
  }
})

test('guardian objectives credit real contacts, clear naturally and explain their finite return', async ({ page }, info) => {
  test.setTimeout(150_000)
  if (info.project.name.includes('phone')) await page.setViewportSize({ width: 360, height: 740 })
  await page.clock.install()
  await page.goto('/')
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('plumb-save-v1')!)
    save.settings.speed = 2
    localStorage.setItem('plumb-save-v1', JSON.stringify(save))
  })
  for (const [id, title, required, presses] of [['gallery', 'The Bellkeeper', 3, 1], ['dynamo', 'The Heartforge', 4, 2]] as const) {
    await room(page, id)
    const objective = page.locator('.encounter-instrument:visible')
    await expect(objective).toContainText(title)
    await expect(objective).toContainText(`0 / ${required}`)
    await expect(objective).toContainText('1/1 safe return')
    await cleanLayout(page)
    await action(page, 'overview').click()
    await capture(page, info, `${id}-guardian-overview`)
    await action(page, 'overview').click()
    await action(page, 'journal').click()
    await expect(page.locator('.guardian-briefing')).toContainText('Gutters still follow normal hazard rules')
    await expect(page.locator('.guardian-briefing')).toContainText('incomplete objective never blocks')
    await action(page, 'close-journal').click()
    // Keep a discrete arrow tap distinct from holding the key across a render frame.
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
    for (let i = 0; i < presses; i++) {
      await page.keyboard.press('ArrowRight')
      await page.clock.runFor(50)
    }
    if (/phone|tablet/.test(info.project.name)) await action(page, 'launch').tap()
    else await action(page, 'launch').click()
    let cleared = false
    let returned = false
    let capturedProgress = false
    for (let tick = 0; tick < 100; tick++) {
      await page.clock.runFor(150)
      const text = await objective.textContent()
      if (text?.includes('0/1 safe return')) returned = true
      if (!capturedProgress && /[1-3] \/ [34]/.test(text ?? '')) {
        capturedProgress = true
        await capture(page, info, `${id}-guardian-progress`)
      }
      if (text?.includes('Bounty secured')) { cleared = true; break }
      if (await page.locator('#app').getAttribute('data-mode') !== 'drop') break
    }
    expect(cleared, `${id} is cleared by real physics and legal launch input`).toBe(true)
    await expect(objective).toContainText(`${required} / ${required}`)
    await expect(objective).toContainText(id === 'gallery' ? '70 gears' : '120 gears')
    if (id === 'gallery') expect(returned, 'Bellkeeper preserves progress through its one return').toBe(true)
    await cleanLayout(page)
    await capture(page, info, `${id}-guardian-linked`)
    for (let tick = 0; tick < 80 && await page.locator('#app').getAttribute('data-mode') === 'drop'; tick++) await page.clock.runFor(150)
    await expect(page.locator('#app')).toHaveAttribute('data-mode', 'resolve')
    await expect(action(page, 'skip')).toContainText('choose a relic')
    await cleanLayout(page)
    await action(page, 'skip').click()
    await page.clock.runFor(50)
    await expect(page.locator('#app')).toHaveAttribute('data-mode', 'choices')
    await expect(page.locator('.card.offer')).toHaveCount(3)
    const reward = await page.evaluate(() => JSON.parse(localStorage.getItem('plumb-expedition-v2')!))
    expect(reward.offers.every((offer: { kind: string }) => offer.kind === 'relic')).toBe(true)
    await page.clock.resume()
  }
})

test('Workshop tips follow real input and can be dismissed or replayed without replacing a run', async ({ page }, info) => {
  if (info.project.name.includes('phone')) await page.setViewportSize({ width: 360, height: 740 })
  await page.clock.install()
  await room(page, 'workshop')
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  const tips = page.locator('.workshop-coach:visible')
  await expect(tips).toContainText('1 / 3')
  await cleanLayout(page)
  await capture(page, info, 'workshop-coaching')
  if (/phone|tablet/.test(info.project.name)) await action(page, 'launch').tap()
  else await action(page, 'launch').click()
  await page.clock.runFor(50)
  for (let tick = 0; tick < 36 && !(await action(page, 'overdrive').isEnabled()); tick++) await page.clock.runFor(250)
  await expect(action(page, 'overdrive')).toBeEnabled()
  await expect(tips).toContainText('3 / 3')
  if (/phone|tablet/.test(info.project.name)) await action(page, 'nudge-left').tap()
  else await action(page, 'nudge-left').click()
  await page.clock.runFor(100)
  if (/phone|tablet/.test(info.project.name)) await action(page, 'overdrive').tap()
  else await action(page, 'overdrive').click()
  await page.clock.runFor(100)
  await expect(tips).toHaveCount(0)
  const completed = await page.evaluate(() => JSON.parse(localStorage.getItem('plumb-save-v1')!).coachingComplete)
  expect(completed).toBe(true)
  const checkpoint = await page.evaluate(() => localStorage.getItem('plumb-expedition-v2'))
  await page.clock.resume()
  await page.reload()
  await action(page, 'help').click()
  await action(page, 'coach-enable').click()
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'hub')
  expect(await page.evaluate(() => localStorage.getItem('plumb-expedition-v2'))).toBe(checkpoint)
  await action(page, 'continue-run').click()
  await expect(tips).toContainText('1 / 3')
  await action(page, 'coach-dismiss').click()
  await expect(tips).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('plumb-save-v1')!).coachingComplete)).toBe(true)
})

test('classic challenge links and checkpoints retain their original guardian-free route', async ({ page }, info) => {
  await page.goto(`/?seed=${seed}&sphere=rubber&trial=0&rules=2&archive=`)
  await expect(page.locator('.legacy-route')).toContainText('relay guardians disabled')
  await action(page, 'start').click()
  await action(page, 'pick:0').click()
  const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('plumb-expedition-v2')!))
  expect(snapshot.run.rules).toBe(2)
  await room(page, 'gallery', 'aim', 2)
  await expect(page.locator('#hud')).toHaveAttribute('data-encounter', 'false')
  await expect(page.locator('.encounter-instrument:visible')).toHaveCount(0)
  await cleanLayout(page)
  await capture(page, info, 'classic-route')
})
