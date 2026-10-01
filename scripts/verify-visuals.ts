/** Offline Canvas integration checks. Does not launch or control a browser. */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createCanvas } from '@napi-rs/canvas'
import { drawFrame, type DrawInput } from '../src/render/draw'
import { createBoard } from '../src/sim/generate'
import { Drop, previewPath } from '../src/sim/drop'
import { computeProfile } from '../src/sim/profile'
import { BALL_LIST } from '../src/content/catalog'
import { rngFor } from '../src/core/rng'
import { TUNING } from '../src/tuning'
import { selfcheckPhysics } from '../src/physics/collide'
import { machineScale, screenToWorld } from '../src/render/camera'
import type { LayoutId } from '../src/sim/board'

// Sprite creation is the renderer's only DOM dependency.
Object.assign(globalThis, { document: { createElement: () => createCanvas(1, 1) } })
const output = 'artifacts/visual-checks'
await mkdir(output, { recursive: true })
selfcheckPhysics()
const layouts: LayoutId[] = ['workshop', 'garden', 'furnace', 'elite', 'ante', 'core', 'grinder']
let simulations = 0
let renders = 0

function state(drop: Drop) {
  return JSON.stringify({ ball: drop.ball, time: drop.time, lit: drop.lit, gone: drop.gone, mult: drop.mult, earned: drop.earned, integrity: drop.integrity, trail: drop.trail })
}

for (const layout of layouts) {
  for (const ball of BALL_LIST) {
    const board = createBoard({ layout, title: layout, tutorial: false, rng: rngFor('ASTRAL', layout) })
    const profile = computeProfile(ball.id, [], [])
    const drop = new Drop(board, ball.id, profile, profile.integrityMax, profile.integrityMax)
    const canvas = createCanvas(1280, 900)
    const scale = Math.min(1, 820 / board.w)
    const input: DrawInput = {
      ctx: canvas.getContext('2d') as unknown as CanvasRenderingContext2D,
      cssW: 1280, cssH: 900, dpr: 1,
      cam: { scale, camY: 450 / scale, cssW: 1280, cssH: 900, boardW: board.w, zoom: 1, shakeX: 0, shakeY: 0 },
      board, drop, preview: [], aiming: true, aimAngle: 0.15,
      particles: [], floaters: [], rings: [], popT: null, launchKick: 0,
      warp: 1, multHot: false, particlesOn: true, trailColor: '', time: 10, hitboxes: false, showcase: null,
    }
    drop.setAim(0.15)
    input.preview = previewPath(drop, 0.15)
    drawFrame(input)
    renders++
    if (ball.id === 'rubber') await writeFile(`${output}/${layout}-aim.png`, canvas.toBuffer('image/png'))
    drop.launch(0.15)
    let hitFrame = false
    for (let step = 0; step < 120 / TUNING.dt && !drop.captured && !drop.dead; step++) {
      drop.step(TUNING.dt)
      assert.ok(Number.isFinite(drop.ball.x) && Number.isFinite(drop.ball.y), `${layout}/${ball.id}: finite position`)
      const events = drop.pullEvents()
      if (!hitFrame && events.some(e => e.type === 'gold' || e.type === 'bumper')) {
        hitFrame = true
        const before = state(drop)
        input.aiming = false
        input.preview = []
        input.time = 12
        input.cam.camY = Math.max(450 / scale, Math.min(board.h - 450 / scale, drop.ball.y))
        input.rings = [{ x: drop.ball.x, y: drop.ball.y, r0: 8, r1: 96, life: .3, max: .5, color: '#ffd56a', width: 5 }]
        drawFrame(input)
        assert.equal(state(drop), before, 'Drawing must never change the simulation')
        renders++
        if (ball.id === 'rubber') await writeFile(`${output}/${layout}-impact.png`, canvas.toBuffer('image/png'))
      }
    }
    assert.ok(drop.captured || drop.dead, `${layout}/${ball.id}: the drop resolves`)
    simulations++
    input.aiming = false
    input.cam.camY = board.h - 450 / scale
    input.multHot = true
    input.rings = []
    input.time = 15
    drawFrame(input)
    renders++
    if (ball.id === 'rubber') await writeFile(`${output}/${layout}-settled.png`, canvas.toBuffer('image/png'))
    if (ball.id === 'rubber') {
      const phone = createCanvas(780, 1320)
      const phoneScale = machineScale(390, board.w)
      input.ctx = phone.getContext('2d') as unknown as CanvasRenderingContext2D
      input.cssW = 390
      input.cssH = 660
      input.dpr = 2
      input.cam = { scale: phoneScale, camY: board.h / 2, cssW: 390, cssH: 660, boardW: board.w, zoom: 1, shakeX: 0, shakeY: 0 }
      drawFrame(input)
      const center = screenToWorld(input.cam, 195, 330)
      assert.equal(center.x, board.w / 2)
      assert.equal(center.y, board.h / 2)
      await writeFile(`${output}/${layout}-phone.png`, phone.toBuffer('image/png'))
      renders++
    }
  }
}

// Exercise every title specimen and a small, high-DPI viewport.
for (const ball of BALL_LIST) {
  for (const [w, h, dpr] of [[1440, 900, 1], [390, 844, 2]]) {
    const canvas = createCanvas(w * dpr, h * dpr)
    const input: DrawInput = {
      ctx: canvas.getContext('2d') as unknown as CanvasRenderingContext2D,
      cssW: w, cssH: h, dpr,
      cam: { scale: 1, camY: 0, cssW: w, cssH: h, boardW: 760, zoom: 1, shakeX: 0, shakeY: 0 },
      board: null, drop: null, preview: [], aiming: false, aimAngle: 0,
      particles: [], floaters: [], rings: [], popT: null, launchKick: 0,
      warp: 1, multHot: false, particlesOn: true, trailColor: '', time: 10, hitboxes: false, showcase: ball,
    }
    drawFrame(input)
    const first = canvas.toBuffer('image/png')
    input.time = 11
    drawFrame(input)
    assert.notDeepEqual(canvas.toBuffer('image/png'), first, 'The astrolabe must animate')
    input.time = 0
    input.particlesOn = false
    drawFrame(input)
    const quiet = canvas.toBuffer('image/png')
    drawFrame(input)
    assert.deepEqual(canvas.toBuffer('image/png'), quiet, 'Reduced-motion scenery must stay still')
    input.time = 10
    input.particlesOn = true
    drawFrame(input)
    await writeFile(`${output}/specimen-${ball.id}-${w}.png`, canvas.toBuffer('image/png'))
    renders += 5
  }
}
console.log(`Passed: ${simulations} seeded falls, ${renders} Canvas renders, all 7 layouts and 3 spheres. Images: ${output}`)
