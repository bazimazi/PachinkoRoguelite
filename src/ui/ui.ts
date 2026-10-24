export interface BallCard {
  id: string
  name: string
  tagline: string
  tags: string
  /** Highlight, body and core colors for the orb swatch. */
  colors: [string, string, string]
  locked: boolean
  reason: string
  selected: boolean
}

export interface ChoiceCard {
  name: string
  tags: string
  text: string
  synergy: string
  price: number
  afford: boolean
  index: number
}

export interface ForkCard {
  title: string
  detail: string
  risk: 'safe' | 'risky'
  index: number
}

export interface CollItem {
  name: string
  text: string
  known: boolean
}

export interface EncounterModel {
  title: string
  instruction: string
  progress: number
  target: number
  reward: string
  returns: number
  maxReturns: number
  hint: string
  complete: boolean
  linked?: number[]
  targets?: number[]
}

export interface CoachModel {
  step: number
  title: string
  text: string
  action: string
}

export interface HudModel {
  gears: number
  score: number
  shell: number
  shellMax: number
  mult: string
  /** Progress from the starting multiplier to the jackpot threshold, 0..1. */
  multT: number
  multHot: boolean
  jackpotAt: string
  combo: number
  /** Remaining combo window, 0..1. */
  comboT: number
  earned: number
  tally: boolean
  nudges: number
  maxNudges: number
  nudgeCooldown?: number
  specials: number
  maxSpecials: number
  specialName: string
  specialCooldown?: number
  tilts: number
  maxTilts: number
  flips: number
  showFlip: boolean
  seed: string
  kicker: string
  title: string
  blurb: string
  gate: string
  synergy: string
  core: string
  jackpot: string
  muted: boolean
  aiming: boolean
  overview: boolean
  playing: boolean
  journey: string
  objective: string
  anomaly: string
  charge: number
  overdriveTime: number
  overdriveUses: number
  overdriveReady: boolean
  encounter?: EncounterModel | null
  coach?: CoachModel | null
}

export interface SummaryModel {
  heading: string
  line: string
  score: number
  best: boolean
  gears: number
  mult: string
  combo: number
  depth: string
  shards: number
  awakened: string[]
  challenges: string[]
  temptation: string
  canStudy: boolean
  studyLabel: string
  seed: string
  mode: 'expedition' | 'daily'
  ascension: number
  clears: number
  commissions: number
}

export interface RouteItem {
  id: string; title: string; kind: string; act: number; depth: number
  status: 'current' | 'visited' | 'future' | 'alternative'; detail: string; next: string
  nextIds?: string[]
}

export type StageModel =
  | { kind: 'none' }
  | { kind: 'hub'; balls: BallCard[]; shards: number; best: number; runs: number; seed: string; study: string; canStudy: boolean; tick: number; resume: boolean; trial: number; maxTrial: number; trialText: string; dailyDate: string; dailySphere: string; dailyBest: number; shared: boolean; legacy?: boolean }
  | { kind: 'help' }
  | { kind: 'collection'; balls: CollItem[]; relics: CollItem[]; parts: CollItem[]; challenges: CollItem[]; lore: string[]; pegs: number }
  | { kind: 'settings'; shake: boolean; particles: boolean; flash: boolean; large: boolean; volume: number; speed: number }
  | { kind: 'choices'; kicker: string; title: string; build: string; cards: ChoiceCard[]; skip: string }
  | { kind: 'shop'; gears: number; cards: ChoiceCard[]; reroll: number; canReroll: boolean; build: string; repairCost: number; canRepair: boolean }
  | { kind: 'fork'; title: string; options: ForkCard[] }
  | { kind: 'repair'; text: string; action: string }
  | { kind: 'bargain'; canShell: boolean; canPay: boolean }
  | { kind: 'resolve'; title: string; sub: string; earned: number; tone: 'good' | 'bad' | 'gold' }
  | { kind: 'pause' }
  | { kind: 'runend'; summary: SummaryModel }
  | { kind: 'reveal'; name: string; text: string; tags: string }
  | { kind: 'event'; title: string; story: string; cards: ChoiceCard[] }
  | { kind: 'victory'; circuit: number; score: number; build: string }
  | { kind: 'history'; records: { seed: string; sphere: string; score: number; drops: number; clears: number; mode: string; date: string; index: number; trial: number; build: string }[] }
  | { kind: 'journal'; title: string; stats: string; commissions: { name: string; text: string; value: number; target: number; done: boolean }[]; relics: CollItem[]; upgrades: CollItem[]; synergies: CollItem[]; route: RouteItem[]; encounter?: EncounterModel | null }

export interface ViewModel {
  sig: string
  screen: string
  hud: HudModel | null
  stage: StageModel
  toast: { title: string; sub: string; big?: boolean } | null
  flash: '' | 'gold' | 'hurt' | 'core'
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)
}

function pips(on: number, max: number, cls = ''): string {
  let html = ''
  for (let i = 0; i < max; i++) html += `<i class="${i < on ? 'on' : ''}"></i>`
  return `<span class="pips ${cls}">${html}</span>`
}

const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

function bump(el: Element | null, scale = 1.25): void {
  if (!el || reduced || !(el as HTMLElement).animate) return
  ;(el as HTMLElement).animate([{ transform: `scale(${scale})` }, { transform: 'scale(1)' }], {
    duration: 280,
    easing: 'cubic-bezier(.2,1.7,.4,1)',
  })
}

function shake(el: Element | null): void {
  if (!el || reduced || !(el as HTMLElement).animate) return
  ;(el as HTMLElement).animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-7px)' },
      { transform: 'translateX(6px)' },
      { transform: 'translateX(-4px)' },
      { transform: 'translateX(0)' },
    ],
    { duration: 320, easing: 'ease-out' },
  )
}

/** Animate numbers marked with data-count up from zero once a screen appears. */
function countUp(root: HTMLElement): void {
  const els = root.querySelectorAll<HTMLElement>('[data-count]')
  if (!els.length) return
  const start = performance.now()
  const dur = reduced ? 0 : 750
  const targets = Array.from(els).map((el) => ({ el, to: Number(el.dataset.count) || 0, suffix: el.dataset.suffix ?? '' }))
  const tick = (now: number) => {
    const k = dur ? Math.min(1, (now - start) / dur) : 1
    const e = 1 - Math.pow(1 - k, 3)
    for (const t of targets) t.el.textContent = `${Math.round(t.to * e)}${t.suffix}`
    if (k < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

export class UI {
  private sig = ''
  private hudKey = ''
  private shown: Record<string, number> = {}
  private prev: Record<string, string | number> = {}
  private lastT = performance.now()
  private toastKey = ''

  constructor(
    private stage: HTMLElement,
    private hud: HTMLElement,
    private toast: HTMLElement,
    private flash: HTMLElement,
    private onAction: (act: string) => void,
    private onSeed: (value: string) => void,
  ) {
    const click = (e: Event) => {
      const t = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null
      if (!t || (t as HTMLButtonElement).disabled) return
      this.onAction(t.dataset.act || '')
    }
    stage.addEventListener('click', click)
    hud.addEventListener('click', click)
    stage.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement
      if (t.dataset.seed != null) this.onSeed(t.value)
      if (t.dataset.volume != null) this.onAction('volume:' + t.value)
    })
    // Cards lean toward the pointer, like a hand of cards being considered.
    stage.addEventListener('pointermove', (e) => {
      if (reduced) return
      const target = e.target instanceof Element ? e.target : null
      const card = target?.closest('.card') as HTMLElement | null
      if (!card || card.classList.contains('ball')) return
      const r = card.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width - 0.5
      const py = (e.clientY - r.top) / r.height - 0.5
      card.style.setProperty('--rx', `${(-py * 6).toFixed(2)}deg`)
      card.style.setProperty('--ry', `${(px * 8).toFixed(2)}deg`)
      card.style.setProperty('--gx', `${((px + 0.5) * 100).toFixed(1)}%`)
      card.style.setProperty('--gy', `${((py + 0.5) * 100).toFixed(1)}%`)
    })
    stage.addEventListener(
      'pointerout',
      (e) => {
        const target = e.target instanceof Element ? e.target : null
        const card = target?.closest('.card') as HTMLElement | null
        if (!card || card.contains(e.relatedTarget as Node)) return
        card.style.removeProperty('--rx')
        card.style.removeProperty('--ry')
      },
      true,
    )
  }

  render(view: ViewModel): void {
    const now = performance.now()
    const dt = Math.min(0.1, (now - this.lastT) / 1000)
    this.lastT = now
    const root = document.getElementById('app')
    if (root) {
      if (root.dataset.mode !== view.screen) root.dataset.mode = view.screen
      const playfield = view.hud ? 'true' : 'false'
      if (root.dataset.playfield !== playfield) root.dataset.playfield = playfield
      const encounter = view.hud?.encounter ? 'true' : 'false'
      if (root.dataset.encounter !== encounter) root.dataset.encounter = encounter
    }
    if (view.sig !== this.sig) {
      const prevKind = this.stage.dataset.kind
      this.sig = view.sig
      this.stage.innerHTML = stageHtml(view.stage)
      if (['choices', 'fork', 'shop', 'event', 'bargain', 'repair', 'victory'].includes(view.stage.kind)) this.stage.insertAdjacentHTML('beforeend', '<button class="ghost decision-journal" data-act="journal">Build & route <kbd>J</kbd></button>')
      this.stage.className = view.stage.kind === 'none' ? '' : 'open'
      this.stage.dataset.kind = view.stage.kind
      // Only play entrance animations when the screen itself changes, not on in-place refreshes.
      this.stage.classList.toggle('enter', prevKind !== view.stage.kind)
      if (prevKind !== view.stage.kind) countUp(this.stage)
    }
    this.renderHud(view.hud, dt)
    if (view.toast) {
      const key = `${view.toast.title}|${view.toast.sub}|${!!view.toast.big}`
      this.toast.hidden = false
      const live = view.screen === 'aim' || view.screen === 'drop' || (key === this.toastKey && this.toast.classList.contains('live'))
      this.toast.classList.toggle('live', live)
      this.toast.classList.toggle('subtle', !view.toast.big)
      if (key !== this.toastKey) {
        this.toastKey = key
        this.toast.innerHTML = `<b>${esc(view.toast.title)}</b>${view.toast.sub ? `<span>${esc(view.toast.sub)}</span>` : ''}`
        if (!reduced && this.toast.animate) {
          this.toast.animate(
            [
              { transform: 'translateX(-50%) scale(0.6)', opacity: 0, filter: 'blur(6px)' },
              { transform: 'translateX(-50%) scale(1.08)', opacity: 1, filter: 'blur(0)', offset: 0.6 },
              { transform: 'translateX(-50%) scale(1)', opacity: 1 },
            ],
            { duration: 380, easing: 'cubic-bezier(.2,1.4,.4,1)' },
          )
        }
      }
    } else if (!this.toast.hidden) {
      this.toast.hidden = true
      this.toast.innerHTML = ''
      this.toastKey = ''
      this.toast.classList.remove('live')
    }
    if (this.flash.className !== view.flash) this.flash.className = view.flash
  }

  /** Eases a displayed number toward its target so totals roll instead of jumping. */
  private roll(name: string, target: number, dt: number): number {
    const cur = this.shown[name]
    if (cur == null || target < cur) {
      this.shown[name] = target
      return target
    }
    const next = cur + (target - cur) * (1 - Math.exp(-14 * dt))
    this.shown[name] = target - next < 0.5 ? target : next
    return Math.round(this.shown[name])
  }

  private renderHud(hud: HudModel | null, dt: number): void {
    if (!hud) {
      this.hud.innerHTML = ''
      this.hudKey = ''
      this.shown = {}
      this.prev = {}
      delete this.hud.dataset.encounter
      delete this.hud.dataset.coach
      return
    }
    const key = `${hud.aiming}|${hud.overview}|${hud.playing}|${hud.showFlip}|${hud.maxSpecials}|${hud.maxTilts}|${hud.maxNudges}|${hud.core}|${hud.jackpot}`
    if (key !== this.hudKey) {
      this.hudKey = key
      this.prev = {}
      this.hud.innerHTML = `
        <div class="dock left">
          <div class="chip res"><span>Gears</span><b data-hud="gears"></b></div>
          <div class="chip res shell" data-hud="shell-wrap"><span>Shell</span><b data-hud="shell"></b></div>
          <div class="chip dim score"><span>Score</span><b data-hud="score"></b></div>
          <div class="util">
            <button class="texty" data-act="copy-seed" title="Copy seed"><span class="ico">#</span><span data-hud="seed"></span></button>
            <button class="texty" data-act="mute" data-hud="mute"></button>
            <button class="texty" data-act="journal">Journal <kbd>J</kbd></button>
          </div>
          ${coachHtml('desktop')}
        </div>
        <div class="dock right">
          <div class="chip mult" data-hud="mult-wrap">
            <span>Multiplier</span><b data-hud="mult"></b>
            <div class="meter" title="Jackpot pockets pay out once the multiplier reaches ${esc(hud.jackpotAt)}"><i data-hud="mult-fill"></i></div>
            <em class="meter-label">Hot at ${esc(hud.jackpotAt)}</em>
          </div>
          <div class="chip combo" data-hud="combo-wrap">
            <span>Combo</span><b data-hud="combo"></b>
            <div class="meter thin"><i data-hud="combo-fill"></i></div>
          </div>
          <div class="chip dim build"><span>Build</span><b data-hud="synergy"></b></div>
          <div class="place">
            <div class="kicker" data-hud="kicker"></div>
            <h2 data-hud="title"></h2>
            <p class="blurb" data-hud="blurb"></p>
            <p class="gate" data-hud="gate"></p>
            <p class="core" data-hud="core"></p>
            <p class="gate" data-hud="jackpot"></p>
            <p class="journey" data-hud="journey"></p>
            <p class="anomaly" data-hud="anomaly"></p>
            <p class="objective" data-hud="objective"></p>
          </div>
          ${encounterHtml('desktop')}
        </div>
        <div class="mobile-place"><b data-hud="mobile-title"></b><span data-hud="mobile-status"></span>${encounterHtml('mobile')}${coachHtml('mobile')}</div>
        <div class="tally" data-hud="tally"><span>This drop</span><b data-hud="earned"></b></div>
        <button class="mobile-journal ghost" data-act="journal" aria-label="Open build and route journal">◇ Journal</button>
        <div class="controls ${hud.aiming ? 'aim-controls' : ''}">
          ${hud.playing && hud.aiming ? `<button class="release-sphere" data-act="launch"><span class="release-symbol" aria-hidden="true">↓</span><span>Release sphere<small>Mouse or ← → to aim</small></span><kbd>Enter</kbd></button>` : ''}
          ${hud.playing && hud.aiming ? `<button class="machine-overview ${hud.overview ? 'selected' : ''}" data-act="overview" aria-pressed="${hud.overview}"><kbd>V</kbd><span>${hud.overview ? 'Return to launcher' : 'Inspect machine'}</span></button>` : ''}
          ${hud.playing && !hud.aiming ? keyBtn('nudge-left', 'A', 'Nudge', 'nudges') : ''}
          ${hud.playing && !hud.aiming && hud.maxSpecials > 0 ? keyBtn('special', 'Space', esc(hud.specialName), 'specials') : ''}
          ${hud.playing && !hud.aiming && hud.maxTilts > 0 ? keyBtn('tilt', 'Q', 'Tilt', 'tilts') : ''}
          ${hud.playing && !hud.aiming ? `<button class="key overdrive-key" data-act="overdrive" data-hud="overdrive" title="Strike five different pegs to charge. Overdrive doubles payouts for three seconds and lifts the sphere. Two activations per fall."><span class="drive-fill" data-hud="drive-fill"></span><kbd>E</kbd><span class="lbl" data-hud="drive-label">Overdrive</span><span class="drive-status" data-hud="drive-status"></span></button>` : ''}
          ${hud.playing && !hud.aiming && hud.showFlip ? keyBtn('flip', 'F', 'Flip gate', '') : ''}
          ${hud.playing && !hud.aiming ? keyBtn('nudge-right', 'D', 'Nudge', 'nudges') : ''}
          ${hud.playing ? `<button class="ghost esc" data-act="pause-btn" title="Pause"><kbd>Esc</kbd><span class="touch-label">Pause</span></button>` : ''}
        </div>`
    }
    const q = (name: string) => this.hud.querySelector(`[data-hud="${name}"]`)
    const set = (name: string, text: string) => {
      const el = q(name)
      if (el && el.textContent !== text) el.textContent = text
    }
    const changed = (name: string, v: string | number) => {
      const was = this.prev[name]
      this.prev[name] = v
      return was !== undefined && was !== v ? (was as number) : null
    }

    const gears = this.roll('gears', hud.gears, dt)
    set('gears', String(gears))
    const gearsWas = changed('gears-t', hud.gears)
    if (gearsWas !== null && hud.gears > gearsWas) bump(q('gears'), 1.18)
    set('score', String(this.roll('score', hud.score, dt)))
    const earned = this.roll('earned', hud.earned, dt)
    set('earned', `+${earned}`)
    const earnedWas = changed('earned-t', hud.earned)
    if (earnedWas !== null && hud.earned > earnedWas) bump(q('earned'), 1.22)
    const tally = q('tally') as HTMLElement | null
    if (tally) tally.classList.toggle('show', hud.tally)

    set('mult', hud.mult)
    if (changed('mult', hud.mult) !== null) bump(q('mult'), 1.35)
    const multWrap = q('mult-wrap') as HTMLElement | null
    if (multWrap) multWrap.classList.toggle('hot', hud.multHot)
    const multFill = q('mult-fill') as HTMLElement | null
    if (multFill) multFill.style.transform = `scaleX(${hud.multT.toFixed(3)})`

    set('combo', hud.combo ? String(hud.combo) : '—')
    if (changed('combo', hud.combo) !== null && hud.combo > 1) bump(q('combo'), 1.15 + Math.min(0.35, hud.combo * 0.02))
    const comboWrap = q('combo-wrap') as HTMLElement | null
    if (comboWrap) comboWrap.dataset.heat = hud.combo >= 15 ? '3' : hud.combo >= 8 ? '2' : hud.combo >= 3 ? '1' : '0'
    const comboFill = q('combo-fill') as HTMLElement | null
    if (comboFill) comboFill.style.transform = `scaleX(${hud.comboT.toFixed(3)})`

    set('seed', hud.seed)
    set('kicker', hud.kicker)
    set('title', hud.title)
    set('mobile-title', hud.title)
    set('mobile-status', hud.core || hud.gate || hud.journey)
    set('blurb', hud.blurb)
    set('gate', hud.gate)
    set('synergy', hud.synergy || '—')
    set('core', hud.core)
    set('jackpot', hud.jackpot)
    set('journey', hud.journey)
    set('objective', hud.objective)
    set('anomaly', hud.anomaly)
    set('mute', hud.muted ? '♪ Off' : '♪ On')
    const encounterState = hud.encounter ? 'true' : 'false'
    const coachState = hud.coach ? 'true' : 'false'
    if (this.hud.dataset.encounter !== encounterState) this.hud.dataset.encounter = encounterState
    if (this.hud.dataset.coach !== coachState) this.hud.dataset.coach = coachState
    for (const variant of ['desktop', 'mobile']) {
      const encounter = q(`${variant}-encounter`) as HTMLElement | null
      if (encounter) {
        encounter.hidden = !hud.encounter
        encounter.classList.toggle('complete', !!hud.encounter?.complete)
      }
      if (hud.encounter) {
        const e = hud.encounter
        set(`${variant}-encounter-title`, e.title)
        set(`${variant}-encounter-instruction`, e.complete ? 'Bounty secured' : e.instruction)
        set(`${variant}-encounter-count`, `${Math.min(e.progress, e.target)} / ${e.target}`)
        set(`${variant}-encounter-reward`, e.reward)
        set(`${variant}-encounter-returns`, `${e.returns}/${e.maxReturns} safe return${e.maxReturns === 1 ? '' : 's'}`)
        set(`${variant}-encounter-hint`, e.hint)
        const sequence = q(`${variant}-encounter-sequence`) as HTMLElement | null
        const sequenceKey = `${e.title}|${e.progress}|${e.target}|${e.linked?.join(',')}|${e.targets?.join(',')}`
        if (sequence && this.prev[`${variant}-encounter-sequence`] !== sequenceKey) {
          this.prev[`${variant}-encounter-sequence`] = sequenceKey
          sequence.innerHTML = encounterSequence(e)
        }
      }
      const coach = q(`${variant}-coach`) as HTMLElement | null
      if (coach) coach.hidden = !hud.coach
      if (hud.coach) {
        set(`${variant}-coach-step`, `${hud.coach.step} / 3`)
        const mobile = variant === 'mobile'
        const action = hud.coach.action
        const mobileTitle = action === 'launch' ? 'Release' : action === 'nudge' ? 'Nudge' : action === 'overdrive' ? 'Overdrive' : hud.coach.title
        const mobileText = action === 'launch' ? 'Aim for your first peg. Tap Release sphere.'
          : action === 'nudge' ? 'A / D or Nudge pushes toward a useful lane.'
            : action === 'overdrive' ? hud.overdriveReady ? 'E / Overdrive lifts the sphere: 2× payouts for 3s.' : 'Hit five different pegs to charge Overdrive.'
              : hud.coach.text
        set(`${variant}-coach-title`, mobile ? mobileTitle : hud.coach.title)
        set(`${variant}-coach-text`, mobile ? mobileText : hud.coach.text)
      }
    }
    const coachAction = hud.coach?.action ?? ''
    if (this.prev['coach-action'] !== coachAction) {
      this.prev['coach-action'] = coachAction
      this.hud.querySelectorAll('.coach-target').forEach(el => el.classList.remove('coach-target'))
      const targets = coachAction === 'nudge' ? ['nudge-left', 'nudge-right'] : [coachAction]
      for (const action of targets) if (action) this.hud.querySelectorAll('[data-act]').forEach(el => {
        if ((el as HTMLElement).dataset.act === action) el.classList.add('coach-target')
      })
    }
    const drive = q('overdrive') as HTMLButtonElement | null
    if (drive) {
      const active = hud.overdriveTime > 0
      drive.disabled = !hud.overdriveReady
      drive.classList.toggle('ready', hud.overdriveReady)
      drive.classList.toggle('active', active)
      drive.setAttribute('aria-label', active ? `Overdrive active, ${hud.overdriveTime.toFixed(1)} seconds` : hud.overdriveReady ? 'Activate Overdrive. Double payouts for three seconds.' : `Overdrive charging, ${Math.round(hud.charge * 100)} percent`)
      set('drive-label', active ? '2× OVERDRIVE' : 'Overdrive')
      set('drive-status', active ? `${hud.overdriveTime.toFixed(1)}s` : hud.overdriveReady ? 'READY' : hud.overdriveUses <= 0 ? 'SPENT' : `${Math.round(hud.charge * 100)}%`)
      const fill = q('drive-fill') as HTMLElement | null
      if (fill) fill.style.transform = `scaleX(${Math.max(0, Math.min(1, active ? hud.overdriveTime / 3 : hud.charge))})`
    }

    const shellKey = `${hud.shell}/${hud.shellMax}`
    const lostShell = changed('shell', hud.shell)
    if (this.prev['shell-html'] !== shellKey) {
      this.prev['shell-html'] = shellKey
      const shell = q('shell')
      if (shell) shell.innerHTML = `${pips(hud.shell, hud.shellMax, 'shell-pips')}<em>${hud.shell}/${hud.shellMax}</em>`
    }
    if (lostShell !== null && hud.shell < lostShell) {
      const wrap = q('shell-wrap')
      shake(wrap)
      wrap?.classList.remove('hurt')
      void (wrap as HTMLElement | null)?.offsetWidth
      wrap?.classList.add('hurt')
    }

    const setPips = (slot: string, on: number, max: number) => {
      const k = `pips-${slot}`
      const v = `${on}/${max}`
      if (this.prev[k] === v) return
      const was = this.prev[k]
      this.prev[k] = v
      this.hud.querySelectorAll(`[data-pips="${slot}"]`).forEach((el) => {
        el.innerHTML = pips(on, max)
        if (was !== undefined) bump(el.closest('button'), 0.94)
      })
    }
    setPips('nudges', hud.nudges, hud.maxNudges)
    setPips('specials', hud.specials, hud.maxSpecials)
    setPips('tilts', hud.tilts, hud.maxTilts)
    const flip = this.hud.querySelector('[data-act="flip"]') as HTMLButtonElement | null
    if (flip) {
      const spent = hud.flips <= 0
      if (flip.disabled !== spent) {
        flip.disabled = spent
        const label = flip.querySelector('.lbl')
        if (label) label.textContent = spent ? 'Gate spent' : 'Flip gate'
        if (spent) bump(flip, 0.92)
      }
    }
    const disable = (act: string, off: boolean, cooldown = 0) =>
      this.hud.querySelectorAll<HTMLButtonElement>(`[data-act="${act}"]`).forEach((b) => {
        const cooling = cooldown > 0 && !off
        b.disabled = off || cooling
        b.classList.toggle('cooling', cooling)
        if (cooling) {
          const label = b.querySelector('.lbl')?.textContent ?? 'Control'
          b.setAttribute('aria-label', `${label} recovering, ${cooldown.toFixed(1)} seconds`)
          b.title = `${label} recovering · ${cooldown.toFixed(1)}s`
        } else {
          b.removeAttribute('aria-label')
          b.removeAttribute('title')
        }
      })
    disable('nudge-left', hud.nudges <= 0, hud.nudgeCooldown)
    disable('nudge-right', hud.nudges <= 0, hud.nudgeCooldown)
    disable('special', hud.specials <= 0, hud.specialCooldown)
    disable('tilt', hud.tilts <= 0, hud.specialCooldown)
  }
}

function keyBtn(act: string, key: string, label: string, pipSlot: string): string {
  const touch = act === 'nudge-left' ? '← Nudge' : act === 'nudge-right' ? 'Nudge →' : act === 'flip' ? 'Flip gate' : label
  return `<button class="key" data-act="${act}"><kbd>${key}</kbd><span class="lbl">${label}</span><span class="touch-label">${touch}</span>${pipSlot ? `<span data-pips="${pipSlot}"></span>` : ''}</button>`
}

function encounterSequence(e: EncounterModel): string {
  const forge = /heartforge|alternate/i.test(`${e.title} ${e.instruction}`)
  return Array.from({ length: Math.max(1, Math.min(8, e.target)) }, (_, i) => {
    const credited = forge ? i < e.progress : !!e.linked?.includes(i)
    const valid = forge ? i === e.progress : e.targets ? e.targets.includes(i) : !credited
    const label = forge ? i % 2 === 0 ? 'I' : 'II' : ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][i]
    return `<i class="${credited ? 'struck' : valid ? 'next' : ''}">${label}</i>`
  }).join('')
}

function encounterHtml(variant: string): string {
  return `<section class="encounter-instrument ${variant}-encounter" data-hud="${variant}-encounter" hidden aria-label="Guardian objective"><div class="encounter-heading"><span>Optional guardian</span><b data-hud="${variant}-encounter-title"></b></div><strong data-hud="${variant}-encounter-instruction"></strong><div class="encounter-progress"><span class="encounter-sequence" data-hud="${variant}-encounter-sequence" aria-hidden="true"></span><b data-hud="${variant}-encounter-count"></b></div><p class="encounter-target" data-hud="${variant}-encounter-hint"></p><div class="encounter-contract"><span class="encounter-bounty" data-hud="${variant}-encounter-reward"></span><span class="encounter-returns" data-hud="${variant}-encounter-returns"></span></div><button class="texty encounter-rules" data-act="journal">Inspect guardian rules <kbd>J</kbd></button></section>`
}

function coachHtml(variant: string): string {
  return `<aside class="workshop-coach ${variant}-coach" data-hud="${variant}-coach" hidden aria-label="Workshop tips" aria-live="polite" aria-atomic="true"><div class="coach-heading"><span data-hud="${variant}-coach-step"></span><b data-hud="${variant}-coach-title"></b><button class="coach-dismiss" data-act="coach-dismiss" aria-label="Dismiss Workshop tips"><span aria-hidden="true">×</span></button></div><p data-hud="${variant}-coach-text"></p></aside>`
}

function encounterBriefing(e: EncounterModel): string {
  return `<section class="guardian-briefing ${e.complete ? 'complete' : ''}"><div><p class="eyebrow">Optional guardian / Current machine</p><h3>${esc(e.title)}</h3><strong>${esc(e.complete ? 'Bounty secured' : e.instruction)}</strong></div><div class="guardian-briefing-progress"><span class="encounter-sequence" aria-hidden="true">${encounterSequence(e)}</span><b>${Math.min(e.progress, e.target)} / ${e.target}</b></div><p>${esc(e.hint)}</p><div class="guardian-terms"><span><b>Bounty</b>${esc(e.reward)}</span><span><b>Safety reserve</b>${e.returns} of ${e.maxReturns} safe return${e.maxReturns === 1 ? '' : 's'} remaining</span></div><p class="quiet">Once per machine, entering a safe collector before 75 seconds returns the sphere while an unfinished objective keeps its progress. Gutters still follow normal hazard rules. After the return is spent or its time window expires, collectors settle the drop normally. The bounty is optional: an incomplete objective never blocks the normal route.</p></section>`
}

function stageHtml(stage: StageModel): string {
  switch (stage.kind) {
    case 'none':
      return ''
    case 'hub':
      return hubHtml(stage)
    case 'help':
      return `<article class="plaque wide scroll briefing"><div class="briefing-header"><div><p class="eyebrow">Operator's field guide</p><h2>Chance gives you a line.<br><em>Control makes it yours.</em></h2></div><div class="briefing-emblem" aria-hidden="true">${artifactArt('compass')}</div></div><div class="briefing-grid"><section><span class="briefing-number">01 / RELEASE</span><h3>Find your opening.</h3><p>Aim with the mouse or <kbd>←</kbd><kbd>→</kbd>. Click, tap Release Sphere, or press <kbd>Enter</kbd>. Pegs pay gears; gold increases your multiplier. The hot center pocket pays a jackpot. Press <kbd>V</kbd> or Inspect Machine before release to study every hazard, lane, and pocket.</p></section><section><span class="briefing-number">02 / INTERVENE</span><h3>Spend control wisely.</h3><p><kbd>A</kbd><kbd>D</kbd> nudge left or right. <kbd>Space</kbd> uses your sphere's trick. <kbd>Q</kbd> tilts gravity when available. <kbd>F</kbd> flips the gate once. Limited charges reset each machine.</p></section><section class="drive-briefing"><span class="briefing-number">03 / OVERDRIVE</span><h3>Make your moment.</h3><p>Hit five different pegs to charge <kbd>E</kbd>. Overdrive lifts the sphere, doubles payouts, and holds the combo for three seconds. Two activations per fall. Time it before a rich lane.</p></section><section><span class="briefing-number">04 / BUILD</span><h3>Turn luck into a machine.</h3><p>Draft a starting relic. Add relics and upgrades between falls. Two matching tags awaken a resonance; three forge a stronger one. Open <kbd>J</kbd> to inspect your build, commissions, and connected route.</p></section></div><div class="briefing-notes"><p><b>Keep your shell.</b> Gutters and spikes cost integrity. Benches at the end of Acts I and II fully repair it. Completed commissions award gears, 1 shell if you survive, and 4 shards at the end.</p><p><b>Meet the guardians.</b> The Bellkeeper asks you to ring three bells. Heartforge asks you to alternate relays I and II. These bounties are optional. Before 75 seconds, one safe collector return gives an unfinished objective another chance; gutters still hurt. Your route continues even if the bounty is incomplete.</p><p><b>Break the Helix.</b> The Grinder needs five core hits. A missed pocket costs 1 shell and returns you to the fight. Win to bank the run or carry your build into a harder circuit.</p><p><b>Come back to your machine.</b> Expeditions save between machines. A reload replays the current drop from its launch. Daily constellations share a fixed sphere, full archive, and UTC seed. Bests and progress live on this device.</p></div><div class="row"><button class="primary" data-act="back">Ready to descend</button><button class="ghost" data-act="coach-enable">Show Workshop tips again</button></div></article>`
    case 'collection':
      return `
        <article class="plaque wide scroll">
          <p class="eyebrow">Archive</p>
          <h2>What the machine has shown you</h2>
          <p class="quiet">Pegs struck, all falls: ${stage.pegs}</p>
          ${block('Spheres', stage.balls)}
          ${block('Relics', stage.relics)}
          ${block('Parts', stage.parts)}
          ${block('Challenges', stage.challenges)}
          ${stage.lore.length ? `<h3>Margins</h3><ul class="lore">${stage.lore.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
          <button class="primary" data-act="back">Return</button>
        </article>`
    case 'settings':
      return `
        <article class="plaque narrow">
          <p class="eyebrow">Settings</p>
          <h2>Keep the fall readable</h2>
          ${toggle('shake', 'Screen shake', stage.shake)}
          ${toggle('particles', 'Particles', stage.particles)}
          ${toggle('flash', 'Flashes', stage.flash)}
          ${toggle('large', 'Larger text', stage.large)}
          <label class="seed">Sound
            <input type="range" min="0" max="1" step="0.05" data-volume value="${stage.volume}" />
          </label>
          <div class="speed-setting"><span>Fall speed</span><div class="row">${[0.75, 1, 1.5, 2].map(speed => `<button class="${stage.speed === speed ? 'primary' : 'ghost'}" data-act="speed:${speed}" aria-pressed="${stage.speed === speed}">${speed}×</button>`).join('')}</div><p class="quiet">Take more time to react, or quicken the descent. The physics stays the same.</p></div>
          <button class="primary" data-act="back">Return</button>
        </article>`
    case 'choices':
      return `
        <div class="decision forge-decision">
          <div class="decision-crest" aria-hidden="true">${artifactArt('forge')}</div><p class="eyebrow">${esc(stage.kicker)}</p>
          <h2>${esc(stage.title)}</h2>
          <p class="build">${esc(stage.build)}</p>
          <div class="cards">${stage.cards.map((c) => choiceHtml(c, 'pick')).join('')}</div>
          <button class="ghost" data-act="skip">${esc(stage.skip)}</button>
        </div>`
    case 'shop':
      return `
        <div class="decision shop-decision">
          <p class="eyebrow">Trading station / The Counter</p>
          <h2>Buy what changes the fall</h2>
          <p class="purse"><span class="gear-ico"></span>${stage.gears} gears</p>
          <p class="build">${esc(stage.build)}</p>
          <div class="cards">${stage.cards.map((c) => choiceHtml(c, 'buy')).join('')}</div>
          <div class="row center">
            <button class="ghost" data-act="reroll" ${stage.canReroll ? '' : 'disabled'}>Reroll · ${stage.reroll}</button>
            <button class="primary" data-act="leave">Leave</button>
            <button class="ghost" data-act="shop-repair" ${stage.canRepair ? '' : 'disabled'}>Mend 1 shell · ${stage.repairCost} gears</button>
          </div>
        </div>`
    case 'fork':
      return forkHtml(stage)
    case 'repair':
      return `
        <article class="plaque narrow repair-plaque">
          <div class="monument-art" aria-hidden="true">${artifactArt('shell')}</div><p class="eyebrow">Safe haven / The Bench</p>
          <h2>The shell can be mended</h2>
          <p>${esc(stage.text)}</p>
          <button class="primary" data-act="repair">${esc(stage.action)}</button>
        </article>`
    case 'bargain':
      return `
        <div class="decision">
          <p class="eyebrow">The Bargain</p>
          <h2>The machine offers three bad ideas</h2>
          <div class="cards">
            <button class="card risky" data-act="bargain:shell" style="--i:0" ${stage.canShell ? '' : 'disabled'}>
              <span class="risk risky">▲ Risk</span><kbd class="num">1</kbd>
              <h3>Crack the shell</h3>
              <p>Lose 1 integrity. Receive a relic you do not choose.</p>
            </button>
            <button class="card risky" data-act="bargain:pay" style="--i:1" ${stage.canPay ? '' : 'disabled'}>
              <span class="risk risky">▲ Risk</span><kbd class="num">2</kbd>
              <h3>Pay thirty gears</h3>
              <p>Lose 30 gears. Receive an upgrade you do not choose.</p>
            </button>
            <button class="card safe" data-act="bargain:walk" style="--i:2">
              <span class="risk safe">● Safe</span><kbd class="num">3</kbd>
              <h3>Skim the tray</h3>
              <p>Take 18 gears and leave the offer on the table.</p>
            </button>
          </div>
        </div>`
    case 'resolve':
      return `
        <button class="resolve ${stage.tone}" data-act="skip">
          <b>${esc(stage.title)}</b>
          ${stage.sub ? `<span class="sub">${esc(stage.sub)}</span>` : ''}
          <strong class="earned">+<span data-count="${stage.earned}">0</span><small>gears this drop</small></strong>
          <em>Click or <kbd>Enter</kbd> to continue</em>
        </button>`
    case 'pause':
      return `
        <article class="plaque narrow pause-plaque">
          <div class="pause-orbit" aria-hidden="true"><i></i><i></i><i></i></div><p class="eyebrow">Transmission suspended</p>
          <h2>The sphere waits</h2>
          <div class="col">
            <button class="primary" data-act="resume">Resume</button>
            <button class="ghost" data-act="settings">Settings</button>
            <button class="ghost" data-act="journal">Build & route journal <kbd>J</kbd></button>
            <button class="ghost danger" data-act="abandon">Abandon this fall</button>
          </div>
        </article>`
    case 'runend': {
      const s = stage.summary
      return `
        <article class="plaque end">
          <p class="eyebrow">Run complete</p>
          <h2>${esc(s.heading)}</h2>
          <p class="lede">${esc(s.line)}</p>
          <div class="final">
            <span>Score</span>
            <b data-count="${s.score}">0</b>
            ${s.best ? '<em class="badge">New best</em>' : ''}
          </div>
          <dl class="stats">
            <div style="--i:0"><dt>Gears left</dt><dd>${s.gears}</dd></div>
            <div style="--i:1"><dt>Best multiplier</dt><dd>${esc(s.mult)}</dd></div>
            <div style="--i:2"><dt>Best combo</dt><dd>${s.combo}</dd></div>
            <div style="--i:3"><dt>Depth</dt><dd>${esc(s.depth)}</dd></div>
            <div style="--i:4" class="shards"><dt>Shards</dt><dd>+${s.shards}</dd></div>
          </dl>
          ${s.awakened.length ? `<p class="unlock">Awakened: ${esc(s.awakened.join(', '))}</p>` : ''}
          ${s.challenges.length ? `<p class="unlock">Challenges: ${esc(s.challenges.join(', '))}</p>` : ''}
          <p class="tempt">${esc(s.temptation)}</p>
          <p class="quiet">Seed ${esc(s.seed)}</p>
          <p class="quiet">${s.mode === 'daily' ? 'Daily constellation' : 'Expedition'} · Trial ${s.ascension} · ${s.clears} circuit${s.clears === 1 ? '' : 's'} cleared · ${s.commissions}/3 commissions</p>
          <div class="row">
            <button class="primary" data-act="again">Drop again <kbd>Enter</kbd></button>
            <button class="ghost" data-act="retry">Retry this seed</button>
          </div>
          <div class="row">
            ${s.canStudy ? `<button class="ghost" data-act="study">${esc(s.studyLabel)}</button>` : ''}
            <button class="texty" data-act="copy-challenge">Share challenge</button>
            <button class="texty" data-act="copy-result">Copy result</button>
            <button class="texty" data-act="hub">Hub</button>
          </div>
        </article>`
    }
    case 'reveal':
      return `
        <article class="plaque narrow reveal">
          <div class="reveal-art" aria-hidden="true">${artifactArt(artifactKind(stage.name, stage.tags))}</div>
          <p class="eyebrow">Schematic</p>
          <h2>${esc(stage.name)}</h2>
          <p class="tags">${esc(stage.tags)}</p>
          <p>${esc(stage.text)}</p>
          <p class="quiet">It can appear in future falls.</p>
          <button class="primary" data-act="close-reveal">Continue</button>
        </article>`
    case 'event':
      return `<div class="decision event-decision"><div class="event-oracle" aria-hidden="true">${artifactArt('oracle')}</div><p class="eyebrow">A voice in the machine</p><h2>${esc(stage.title)}</h2><p class="event-story">${esc(stage.story)}</p><div class="cards">${stage.cards.map(c => choiceHtml(c, 'event')).join('')}</div></div>`
    case 'victory':
      return `<article class="plaque victory"><p class="eyebrow">Circuit ${stage.circuit} complete</p><div class="victory-sigil" aria-hidden="true">${artifactArt('heart')}</div><h2>You broke the heart.</h2><p class="lede">The Helix opens another door.</p><p>${stage.score.toLocaleString()} score · Your build survives.</p><p class="build">${esc(stage.build)}</p><div class="col"><button class="primary big" data-act="bank">Bank the victory</button><button class="ghost" data-act="loop">Enter circuit ${stage.circuit + 1} ↘</button></div><p class="quiet">Continuing fully repairs shell and grants a new relic choice. More anomalies, richer payouts, dearer shops. Your cleared circuits still count if the next one breaks you.</p></article>`
    case 'history':
      return `<article class="plaque wide scroll"><p class="eyebrow">The logbook</p><h2>Every fall leaves a story</h2><p class="quiet">Your last 20 expeditions, saved on this device.</p>${stage.records.length ? `<ol class="run-log">${stage.records.map(r => `<li><div><span class="eyebrow">${esc(r.mode)} · Trial ${r.trial} · ${esc(r.date)}</span><h3>${esc(r.sphere)} <b>${r.score.toLocaleString()}</b></h3><p>${r.drops} drops · ${r.clears} cleared · ${esc(r.seed)}</p><p class="quiet">${esc(r.build)}</p></div><div class="row"><button class="ghost" data-act="replay:${r.index}">Replay</button><button class="texty" data-act="share:${r.index}">Share</button></div></li>`).join('')}</ol>` : '<p class="lede">The first page is waiting. Begin an expedition to write it.</p>'}<button class="primary" data-act="back">Return</button></article>`
    case 'journal':
      return journalHtml(stage)
  }
}

function orb(colors: [string, string, string]): string {
  return `<i class="orb" style="--oa:${colors[0]};--ob:${colors[1]};--oc:${colors[2]}"></i>`
}

function ballHtml(b: BallCard, i: number): string {
  if (b.locked) {
    return `<article class="card ball locked" style="--i:${i};--sphere:${b.colors[0]}"><span class="ball-index">0${i + 1}</span><div class="sphere-seat">${orb(b.colors)}</div><div><span class="ball-state">Dormant specimen</span><h3>${esc(b.name)}</h3><p>${esc(b.reason)}</p></div><span class="sphere-selector" aria-hidden="true">⊘</span></article>`
  }
  return `
    <button class="card ball ${b.selected ? 'selected' : ''}" data-act="ball:${b.id}" aria-pressed="${b.selected}" style="--i:${i};--sphere:${b.colors[0]}">
      <span class="ball-index">0${i + 1}</span>
      <div class="sphere-seat">${orb(b.colors)}</div>
      <div>
        <span class="ball-state">${b.selected ? 'Active specimen' : 'Select specimen'}</span>
        <h3>${esc(b.name)}</h3>
        <p>${esc(b.tagline)}</p>
        <span class="tags">${esc(b.tags)}</span>
      </div>
      <span class="sphere-selector" aria-hidden="true">${b.selected ? '✓' : '+'}</span>
    </button>`
}

function choiceHtml(c: ChoiceCard, act: 'pick' | 'buy' | 'event'): string {
  const head = c.price ? `<em class="price">${c.price} gears</em>` : ''
  const kind = artifactKind(c.name, c.tags)
  return `
    <button class="card offer artifact-${kind} ${c.synergy ? 'has-syn' : ''}" data-act="${act}:${c.index}" style="--i:${c.index}" ${c.afford ? '' : 'disabled'}>
      <span class="offer-edition">${act === 'event' ? 'TRANSMISSION' : act === 'buy' ? 'COUNTER / INVENTORY' : 'HELIX / SCHEMATIC'} <i>0${c.index + 1}</i></span>
      <kbd class="num">${c.index + 1}</kbd>
      <span class="relic-art" aria-hidden="true">${artifactArt(kind)}</span>
      ${head}
      <h3>${esc(c.name)}</h3>
      <span class="tags">${esc(c.tags)}</span>
      <p>${esc(c.text)}</p>
      ${c.synergy ? `<span class="syn">${esc(c.synergy)}</span>` : ''}
      <span class="offer-action">${!c.afford ? 'Insufficient gears' : act === 'buy' ? 'Install schematic' : act === 'event' ? 'Make this choice' : 'Add to your build'} <i aria-hidden="true">↗</i></span>
    </button>`
}

function hubHtml(stage: Extract<StageModel, { kind: 'hub' }>): string {
  const selected = stage.balls.find(b => b.selected) ?? stage.balls[0]
  const number = Math.max(0, stage.balls.indexOf(selected)) + 1
  return `<div class="hub observatory-hub">
    <header class="masthead"><span class="wordmark"><i aria-hidden="true">${helixMark()}</i> THE HELIX <span>GRAVITATIONAL ARCADE</span></span><nav aria-label="Main menu"><button class="texty" data-act="help">How to play</button><button class="texty" data-act="collection">Archive</button><button class="texty" data-act="history">Logbook</button><button class="texty" data-act="settings">Settings</button></nav></header>
    <section class="hub-feature hub-copy">
      <div class="hero-type"><p class="eyebrow"><span class="live-dot"></span> A cosmic pachinko roguelite</p><h1>PLUMB<span aria-hidden="true">.</span></h1><p class="hero-line">Fortune<br>has <em>weight.</em></p><p class="lede">Build a beautiful disaster.<br>Send it through the heart of a star.</p></div>
      ${specimenAssembly(selected, number)}
      <div class="specimen-readout"><span class="readout-id">SPECIMEN / 0${number}</span><div><b>${esc(selected.name)}</b><p>${esc(selected.tagline)}</p></div><span class="readout-tags">${esc(selected.tags)}</span></div>
      <div class="hero-coordinates" aria-hidden="true"><span>Ø 03.1415</span><i></i><span>CHANCE × CONTROL</span></div>
    </section>
    <aside class="expedition-terminal">
      <div class="terminal-heading"><span class="eyebrow">Descent control</span><span class="terminal-status"><i></i>${stage.resume ? 'SIGNAL HELD' : 'SYSTEM READY'}</span></div>
      <h2>${stage.resume ? 'Your machine<br>is waiting.' : 'One more<br><em>perfect fall.</em>'}</h2>
      <div class="expedition-spec"><div><b>03</b><span>Acts to descend</span></div><div><b>10<span>+</span></b><span>Machines to master</span></div><div><b>∞</b><span>Keep the circuit alive</span></div></div>
      ${stage.resume ? '<button class="primary big launch-button" data-act="continue-run"><span>Resume expedition<small>Return to your saved machine</small></span><i aria-hidden="true">↘</i><kbd>Enter</kbd></button>' : ''}
      <button class="${stage.resume ? 'ghost secondary-launch' : 'primary big'} launch-button" data-act="start"><span>${stage.shared ? 'Play shared challenge' : stage.resume ? 'Start a new expedition' : 'Begin the descent'}${stage.resume ? '' : '<small>Choose a relic. Make a little chaos.</small>'}</span><i aria-hidden="true">↘</i>${stage.resume ? '' : '<kbd>Enter</kbd>'}</button>
      <div class="run-calibration"><div class="seed-row"><label class="seed"><span>Frequency / seed</span><input data-seed value="${esc(stage.seed)}" maxlength="12" spellcheck="false" placeholder="Let fate decide" aria-label="Run seed" /></label><button class="texty" data-act="random-seed" aria-label="Randomize seed" title="Randomize seed">↻</button></div><div class="trial-select"><span>Mastery trial <b>${stage.trial.toString().padStart(2, '0')}</b><small> / ${stage.maxTrial.toString().padStart(2, '0')}</small></span><div><button class="ghost" data-act="trial-down" aria-label="Lower trial" ${stage.trial <= 0 ? 'disabled' : ''}>−</button><button class="ghost" data-act="trial-up" aria-label="Raise trial" ${stage.trial >= stage.maxTrial ? 'disabled' : ''}>+</button></div></div><p class="trial-copy">${esc(stage.trialText)}</p>${stage.legacy ? '<p class="legacy-route">Classic route · relay guardians disabled</p>' : ''}</div>
      <button class="daily-card" data-act="daily"><span class="daily-orbit" aria-hidden="true">${helixMark()}</span><span class="daily-copy"><span>Daily constellation <small>${esc(stage.dailyDate)} · UTC</small></span><b>${esc(stage.dailySphere)}</b><em>${stage.dailyBest ? `Best ${stage.dailyBest.toLocaleString()} · fall again` : 'One seed. One sphere. A new story every day.'}</em></span><i aria-hidden="true">↗</i></button>
    </aside>
    <section class="hub-balls"><div class="section-label"><p class="eyebrow">01 / Select your heart</p><span>Three ways to bend the odds.</span></div><div class="ball-row">${stage.balls.map(ballHtml).join('')}</div></section>
    <footer class="hub-foot"><div><span>Shards</span><b>${stage.shards}</b></div><div><span>Best score</span><b>${stage.best.toLocaleString()}</b></div><div><span>Expeditions</span><b>${stage.runs}</b></div><button class="${stage.canStudy ? 'primary' : 'ghost'}" data-act="study" ${stage.canStudy ? '' : 'disabled'}>${esc(stage.study)}</button></footer>
  </div>`
}

function helixMark(): string {
  return '<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle cx="20" cy="20" r="15" stroke="currentColor" opacity=".5"/><path d="M20 2v36M2 20h36M7 7l26 26M7 33L33 7" stroke="currentColor" opacity=".35"/><path d="m20 9 5 11-5 11-5-11 5-11Z" stroke="currentColor"/><circle cx="20" cy="20" r="3" fill="currentColor"/></svg>'
}

function specimenAssembly(ball: BallCard, number: number): string {
  const ticks = Array.from({ length: 48 }, (_, i) => `<path d="M200 ${i % 4 === 0 ? 17 : 24}v${i % 4 === 0 ? 13 : 5}" transform="rotate(${i * 7.5} 200 200)"/>`).join('')
  return `<div class="hero-apparatus specimen-${esc(ball.id)}" aria-hidden="true" style="--oa:${ball.colors[0]};--ob:${ball.colors[1]};--oc:${ball.colors[2]}"><div class="apparatus-glow"></div><svg class="orbital-instrument" viewBox="0 0 400 400" fill="none"><g class="instrument-ticks" stroke="currentColor" opacity=".6">${ticks}</g><circle cx="200" cy="200" r="164" stroke="currentColor" opacity=".22"/><circle cx="200" cy="200" r="155" stroke="currentColor" opacity=".13" stroke-dasharray="1 9"/><g class="orbital-orbit"><ellipse cx="200" cy="200" rx="187" ry="76" stroke="currentColor" opacity=".5" transform="rotate(-35 200 200)"/><circle cx="353" cy="93" r="4" fill="currentColor"/><path d="M15 200h27m316 0h27M200 15v27m0 316v27" stroke="currentColor"/></g><path d="M80 61h34M61 80v34m259-53h-34m53 19v34M80 339h34m-53-19v-34m259 53h-34m53-19v-34" stroke="currentColor" opacity=".4"/></svg><div class="gravity-sphere"><i class="sphere-contour"></i><i class="sphere-sheen"></i><i class="sphere-heart"></i></div><span class="instrument-number">0${number}</span><span class="instrument-label">MASS / UNDEFINED</span></div>`
}

function artifactKind(name: string, tags = ''): string {
  const title = name.toLowerCase()
  if (/echo|afterimage/.test(title)) return 'echo'
  if (/spring|flywheel/.test(title)) return 'spring'
  if (/crown/.test(title)) return 'crown'
  if (/heart/.test(title)) return 'heart'
  if (/feather/.test(title)) return 'feather'
  if (/side jets/.test(title)) return 'jets'
  if (/gate|open throat/.test(title)) return 'gate'
  if (/plumb line/.test(title)) return 'compass'
  const value = `${name} ${tags}`.toLowerCase()
  if (/arc|capacitor|coil|electric|combo/.test(value)) return 'coil'
  if (/shell|fuse|shield|shock|landing|mend/.test(value)) return 'shell'
  if (/portal|passport|ouroboros/.test(value)) return 'portal'
  if (/gravity|void|well|singularity/.test(value)) return 'gravity'
  if (/magnet|rudder|control|compass|gyroscope/.test(value)) return 'compass'
  if (/salvage|hammer|shatter|anvil|destruction/.test(value)) return 'forge'
  if (/gold|ledger|interest|economy|coin|gears/.test(value)) return 'coin'
  if (/prism|precision|clean|contract|lens/.test(value)) return 'prism'
  if (/spring|bounce|flywheel|rebound/.test(value)) return 'spring'
  if (/risk|multiplier|gambler|dice|luck/.test(value)) return 'star'
  return 'oracle'
}

/** Engraved artifacts have recognizable silhouettes rather than random Unicode glyphs. */
function artifactArt(kind: string): string {
  const drawings: Record<string, string> = {
    echo: '<circle cx="60" cy="60" r="12"/><circle cx="60" cy="60" r="4" fill="currentColor"/><path d="M42 42a25 25 0 0 0 0 36m36-36a25 25 0 0 1 0 36M33 33a38 38 0 0 0 0 54m54-54a38 38 0 0 1 0 54M24 24a51 51 0 0 0 0 72m72-72a51 51 0 0 1 0 72"/>',
    crown: '<path d="m30 43 8 37h44l8-37-20 16-10-28-10 28-20-16Zm8 37v8h44v-8M44 69h32"/><circle cx="30" cy="40" r="3"/><circle cx="60" cy="27" r="3"/><circle cx="90" cy="40" r="3"/><path d="M51 87v5m18-5v5" opacity=".5"/>',
    feather: '<path d="M83 25C50 23 29 51 42 78c26 13 54-8 52-41L83 25ZM31 91l49-49M43 78h21M49 65h28M60 54h25M44 66V53m10 1V40m12 2V32"/><circle cx="30" cy="92" r="3" fill="currentColor"/>',
    jets: '<path d="m51 34 9-12 9 12v47H51V34Zm0 13-16 9v24l16-11m18-22 16 9v24L69 69M51 82h18"/><path class="artifact-spark" d="m55 89 5 14 5-14m-27-5 2 10 5-14m30 0 5 14 2-10"/><circle cx="60" cy="45" r="4"/>',
    gate: '<path d="M28 88h64M35 88V37h50v51M43 87V46h34v41M60 46v25m-7-7 7 7 7-7M34 29h52"/><path d="m45 20 5 9-5 9m30-18-5 9 5 9" opacity=".5"/>',
    coil: '<path d="M45 37h29M45 83h29M50 42c-23 5 43 5 20 11s-43 5-20 11 43 5 20 11-20 4-20 4"/><path class="artifact-spark" d="m68 21-11 14h13L57 51M38 76l-7 8h9l-7 13"/>',
    shell: '<path d="M60 24 86 35v23c0 19-26 35-26 35S34 77 34 58V35l26-11Z"/><path d="m60 36 16 7v15c0 11-16 22-16 22S44 69 44 58V43l16-7Z" opacity=".4"/><path d="m50 58 7 7 15-18"/>',
    portal: '<ellipse cx="59" cy="60" rx="23" ry="34" transform="rotate(32 59 60)"/><ellipse cx="59" cy="60" rx="13" ry="25" transform="rotate(32 59 60)" opacity=".4"/><path d="m26 72 13-4-2 13m58-35-13 4 2-13M45 40l35 39"/><circle cx="60" cy="60" r="4" fill="currentColor"/>',
    gravity: '<circle cx="60" cy="60" r="13" fill="currentColor" opacity=".18"/><circle cx="60" cy="60" r="15"/><ellipse cx="60" cy="60" rx="36" ry="13" transform="rotate(-29 60 60)"/><path d="M45 32c23-11 48 6 47 31M28 58c-2 26 24 43 47 32" opacity=".6"/><circle cx="87" cy="40" r="4" fill="currentColor"/>',
    compass: '<circle cx="60" cy="60" r="29"/><path d="m76 36-9 33-24 15 10-33 23-15Z"/><path d="m60 51 7 18-14-18M60 21v12m0 54v12M21 60h12m54 0h12"/><circle cx="60" cy="60" r="3" fill="currentColor"/>',
    forge: '<path d="m42 34 12-12 30 30-12 12-30-30Zm15 15L34 72l9 9 23-23M30 88h58M33 79h34l9-10H45l-12 10Zm17 0v9m15-9v9"/><path class="artifact-spark" d="m83 24 3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8Z"/>',
    coin: '<ellipse cx="60" cy="69" rx="30" ry="13"/><path d="M30 57v12m60-12v12M30 45v12c0 7 13 13 30 13s30-6 30-13V45"/><ellipse cx="60" cy="45" rx="30" ry="13"/><path d="m60 37 9 8-9 8-9-8 9-8Z"/><path d="M43 69v7m34-7v7M43 55v7m34-7v7" opacity=".5"/>',
    prism: '<path d="m60 23 30 50-30 22-30-22 30-50Zm0 0v72M30 73l30-15 30 15M41 55l19 3 20-3"/><path d="M19 43h13m56 0h13M25 34l10 7m50 0 10-7" opacity=".5"/>',
    spring: '<path d="M42 29h36M47 34c-26 7 52 7 26 14s-52 7-26 14 52 7 26 14-26 7-26 7M42 89h36"/><path d="M60 17v8m-5-4 5-5 5 5M60 103v-9m-5 5 5 5 5-5" opacity=".6"/>',
    star: '<path d="m60 22 10 25 27 3-21 17 7 28-23-15-23 15 7-28-21-17 27-3 10-25Z"/><path d="m60 37 6 18 17 2-13 11 4 17-14-10-14 10 4-17-13-11 17-2 6-18Z" opacity=".35"/><circle cx="60" cy="61" r="4" fill="currentColor"/>',
    heart: '<path d="M60 91 32 62c-21-23 12-47 28-22 16-25 49-1 28 22L60 91Z"/><path d="m60 40-8 19 14 4-6 28M22 28l12 8m64-8-12 8M60 15v12" opacity=".65"/>',
    oracle: '<path d="M23 60s15-24 37-24 37 24 37 24-15 24-37 24-37-24-37-24Z"/><circle cx="60" cy="60" r="14"/><circle cx="60" cy="60" r="5" fill="currentColor"/><path d="M60 22v8m0 60v8M31 30l6 6m46 48 6 6m0-60-6 6M37 84l-6 6" opacity=".5"/>',
  }
  return `<svg class="artifact-engraving" viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><g class="artifact-halo" opacity=".25"><circle cx="60" cy="60" r="54"/><circle cx="60" cy="60" r="49" stroke-dasharray="1 7"/><path d="M60 2v10m0 96v10M2 60h10m96 0h10"/></g><g class="artifact-symbol">${drawings[kind] ?? drawings.oracle}</g></svg>`
}

function forkHtml(stage: Extract<StageModel, { kind: 'fork' }>): string {
  return `<div class="decision fork-decision"><p class="eyebrow">Navigation / The path divides</p><h2>${esc(stage.title)}</h2><p class="quiet fork-intro">There is no perfect route. There is your next move.</p><div class="fork-constellation"><div class="fork-origin" aria-hidden="true">${helixMark()}<span>YOU ARE HERE</span></div><svg class="fork-wires" viewBox="0 0 800 180" preserveAspectRatio="none" aria-hidden="true"><path d="M400 12v30C400 110 200 60 200 155M400 42C400 110 600 60 600 155"/><circle cx="400" cy="12" r="4"/><circle cx="200" cy="155" r="5"/><circle cx="600" cy="155" r="5"/></svg><div class="cards">${stage.options.map(o => `<button class="card fork ${o.risk}" data-act="fork:${o.index}" style="--i:${o.index}"><span class="risk ${o.risk}">${o.risk === 'safe' ? 'PRESERVE THE SHELL' : 'RAISE THE STAKES'}</span><kbd class="num">${o.index + 1}</kbd><span class="fork-art" aria-hidden="true">${artifactArt(o.risk === 'safe' ? 'shell' : 'star')}</span><h3>${esc(o.title)}</h3><p>${esc(o.detail)}</p><span class="fork-action">${o.risk === 'safe' ? 'Take the measured path' : 'Commit to the risk'} <i>↘</i></span></button>`).join('')}</div></div></div>`
}

function journalHtml(stage: Extract<StageModel, { kind: 'journal' }>): string {
  return `<article class="plaque journal wide scroll"><div class="journal-head"><div><p class="eyebrow">The expedition journal</p><h2>${esc(stage.title)}</h2><p class="quiet">${esc(stage.stats)}</p></div><button class="ghost" data-act="close-journal">Return <kbd>J</kbd></button></div>${stage.encounter ? encounterBriefing(stage.encounter) : ''}<h3>Commissions</h3><p class="quiet">Complete a commission for gears, 1 shell if you survive, and 4 shards at the end.</p><div class="commissions">${stage.commissions.map(c => `<div class="commission ${c.done ? 'complete' : ''}"><span class="commission-seal" aria-hidden="true">${c.done ? '✓' : '◇'}</span><b>${esc(c.name)}</b><p>${esc(c.text)}</p><progress max="${c.target}" value="${Math.min(c.target, c.value)}" aria-label="${esc(c.name)}"></progress><span>${Math.min(c.target, c.value)}/${c.target}${c.done ? ' · Paid' : ''}</span></div>`).join('')}</div><div class="journal-inventory"><section>${block('Relics', stage.relics)}</section><section>${block('Upgrades', stage.upgrades)}</section></div>${block('Resonances · two tags awaken, three forge', stage.synergies)}<div class="route-heading"><div><p class="eyebrow">Navigation / Three acts</p><h3>Your constellation</h3></div><p class="quiet">Follow the connected paths. Select a station to inspect it.<br><span class="route-legend"><i></i> Current <i></i> Visited <i></i> Ahead</span></p></div><div class="route-map">${[1, 2, 3].map(act => routeAct(stage.route, act)).join('')}</div><button class="primary" data-act="close-journal">Return to the expedition</button></article>`
}

function routeAct(all: RouteItem[], act: number): string {
  const nodes = all.filter(n => n.act === act)
  const ids = new Set(nodes.map(n => n.id))
  const edges = (n: RouteItem) => (n.nextIds ?? nodes.filter(v => n.next.split(' / ').includes(v.title)).map(v => v.id)).filter(id => ids.has(id))
  const ranks = new Map(nodes.map(n => [n.id, 0]))
  // Longest-path ranks keep forks and their reunion on distinct levels.
  for (let pass = 0; pass < nodes.length; pass++) for (const n of nodes) for (const next of edges(n)) ranks.set(next, Math.max(ranks.get(next) ?? 0, (ranks.get(n.id) ?? 0) + 1))
  const rows = new Map<number, RouteItem[]>()
  for (const n of nodes) { const rank = ranks.get(n.id) ?? 0; rows.set(rank, [...(rows.get(rank) ?? []), n]) }
  const positions = new Map<string, { x: number; y: number; count: number }>()
  for (const [rank, row] of rows) row.forEach((n, i) => positions.set(n.id, { x: (i + 1) * 240 / (row.length + 1), y: rank * 92 + 42, count: row.length }))
  const height = Math.max(1, rows.size) * 92 + 16
  const lines = nodes.flatMap(n => edges(n).map(id => {
    const from = positions.get(n.id)!, to = positions.get(id)!, target = nodes.find(v => v.id === id)!
    return `<path class="${n.status === 'visited' && ['visited', 'current'].includes(target.status) ? 'traversed' : ''}" d="M${from.x} ${from.y + 12}C${from.x} ${from.y + 54},${to.x} ${to.y - 40},${to.x} ${to.y - 12}"/>`
  })).join('')
  return `<section class="route-act"><h4><span>0${act}</span> ${['The Brass Garden', 'The Ember Foundry', 'The Astral Engine'][act - 1]}</h4><div class="constellation-chart" style="height:${height}px"><svg viewBox="0 0 240 ${height}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${nodes.map(n => { const p = positions.get(n.id)!; return `<details class="route-node ${n.status} ${p.count > 1 ? 'branch-node' : ''}" style="left:${p.x / 2.4}%;top:${p.y}px"><summary><i class="route-node-icon" aria-hidden="true">${n.kind.startsWith('Machine') ? '◇' : n.kind === 'boss' ? '✧' : n.kind === 'fork' ? '⑂' : n.kind === 'shop' ? '⊙' : n.kind === 'repair' ? '+' : '◉'}</i><b>${esc(n.title)}</b><span>${n.status === 'current' ? 'YOU ARE HERE' : esc(n.kind)}</span></summary><div class="route-inspection"><span>${n.status === 'visited' ? 'Visited' : n.status === 'alternative' ? 'Unchosen path' : n.status === 'current' ? 'Current station' : 'Ahead'} / ${esc(n.kind)}</span>${n.detail ? `<p>${esc(n.detail)}</p>` : ''}${n.next ? `<small>Continues to ${esc(n.next)}</small>` : ''}</div></details>` }).join('')}</div></section>`
}

function block(title: string, items: CollItem[]): string {
  return `
    <h3>${esc(title)}</h3>
    <ul class="archive">
      ${items
        .map(
          (item) => `
        <li class="${item.known ? '' : 'unknown'}">
          <i class="archive-art" aria-hidden="true">${item.known ? artifactArt(artifactKind(item.name)) : helixMark()}</i>
          <b>${esc(item.known ? item.name : 'Unknown')}</b>
          <span>${esc(item.text)}</span>
        </li>`,
        )
        .join('')}
    </ul>`
}

function toggle(id: string, label: string, on: boolean): string {
  return `<button class="toggle ${on ? 'on' : ''}" data-act="toggle:${id}" role="switch" aria-checked="${on}"><span>${esc(label)}</span><i class="sw"></i></button>`
}
