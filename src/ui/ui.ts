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
  specials: number
  maxSpecials: number
  specialName: string
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
  playing: boolean
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
}

export type StageModel =
  | { kind: 'none' }
  | { kind: 'hub'; balls: BallCard[]; shards: number; best: number; runs: number; seed: string; study: string; canStudy: boolean; tick: number }
  | { kind: 'help' }
  | { kind: 'collection'; balls: CollItem[]; relics: CollItem[]; parts: CollItem[]; challenges: CollItem[]; lore: string[]; pegs: number }
  | { kind: 'settings'; shake: boolean; particles: boolean; flash: boolean; large: boolean; volume: number }
  | { kind: 'choices'; kicker: string; title: string; build: string; cards: ChoiceCard[]; skip: string }
  | { kind: 'shop'; gears: number; cards: ChoiceCard[]; reroll: number; canReroll: boolean; build: string }
  | { kind: 'fork'; title: string; options: ForkCard[] }
  | { kind: 'repair'; text: string; action: string }
  | { kind: 'bargain'; canShell: boolean; canPay: boolean }
  | { kind: 'resolve'; title: string; sub: string; earned: number; tone: 'good' | 'bad' | 'gold' }
  | { kind: 'pause' }
  | { kind: 'runend'; summary: SummaryModel }
  | { kind: 'reveal'; name: string; text: string; tags: string }

export interface ViewModel {
  sig: string
  screen: string
  hud: HudModel | null
  stage: StageModel
  toast: { title: string; sub: string } | null
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
      const card = (e.target as HTMLElement).closest('.card') as HTMLElement | null
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
        const card = (e.target as HTMLElement).closest('.card') as HTMLElement | null
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
    }
    if (view.sig !== this.sig) {
      const prevKind = this.stage.dataset.kind
      this.sig = view.sig
      this.stage.innerHTML = stageHtml(view.stage)
      this.stage.className = view.stage.kind === 'none' ? '' : 'open'
      this.stage.dataset.kind = view.stage.kind
      // Only play entrance animations when the screen itself changes, not on in-place refreshes.
      this.stage.classList.toggle('enter', prevKind !== view.stage.kind)
      if (prevKind !== view.stage.kind) countUp(this.stage)
    }
    this.renderHud(view.hud, dt)
    if (view.toast) {
      const key = `${view.toast.title}|${view.toast.sub}`
      this.toast.hidden = false
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
      return
    }
    const key = `${hud.aiming}|${hud.playing}|${hud.showFlip}|${hud.maxSpecials}|${hud.maxTilts}|${hud.maxNudges}|${hud.core}|${hud.jackpot}`
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
          </div>
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
          </div>
        </div>
        <div class="tally" data-hud="tally"><span>This drop</span><b data-hud="earned"></b></div>
        <div class="controls">
          ${hud.playing && hud.aiming ? `<p class="hint"><kbd>Click</kbd> or <kbd>Enter</kbd> to release · <kbd>←</kbd><kbd>→</kbd> aim</p>` : ''}
          ${hud.playing && !hud.aiming ? keyBtn('nudge-left', 'A', 'Nudge', 'nudges') : ''}
          ${hud.playing && !hud.aiming && hud.maxSpecials > 0 ? keyBtn('special', 'Space', esc(hud.specialName), 'specials') : ''}
          ${hud.playing && !hud.aiming && hud.maxTilts > 0 ? keyBtn('tilt', 'Q', 'Tilt', 'tilts') : ''}
          ${hud.playing && !hud.aiming && hud.showFlip ? keyBtn('flip', 'F', 'Flip gate', '') : ''}
          ${hud.playing && !hud.aiming ? keyBtn('nudge-right', 'D', 'Nudge', 'nudges') : ''}
          ${hud.playing ? `<button class="ghost esc" data-act="pause-btn" title="Pause"><kbd>Esc</kbd></button>` : ''}
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
    set('blurb', hud.blurb)
    set('gate', hud.gate)
    set('synergy', hud.synergy || '—')
    set('core', hud.core)
    set('jackpot', hud.jackpot)
    set('mute', hud.muted ? '♪ Off' : '♪ On')

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
    const disable = (act: string, off: boolean) =>
      this.hud.querySelectorAll<HTMLButtonElement>(`[data-act="${act}"]`).forEach((b) => {
        if (b.disabled !== off) b.disabled = off
      })
    disable('nudge-left', hud.nudges <= 0)
    disable('nudge-right', hud.nudges <= 0)
    disable('special', hud.specials <= 0)
    disable('tilt', hud.tilts <= 0)
  }
}

function keyBtn(act: string, key: string, label: string, pipSlot: string): string {
  return `<button class="key" data-act="${act}"><kbd>${key}</kbd><span class="lbl">${label}</span>${pipSlot ? `<span data-pips="${pipSlot}"></span>` : ''}</button>`
}

function stageHtml(stage: StageModel): string {
  switch (stage.kind) {
    case 'none':
      return ''
    case 'hub':
      return `
        <div class="hub">
          <header class="masthead">
            <span class="wordmark"><i aria-hidden="true">✧</i> THE HELIX <span>EST. OUTSIDE TIME</span></span>
            <nav aria-label="Main menu">
              <button class="texty" data-act="help">How to play</button>
              <button class="texty" data-act="collection">Archive</button>
              <button class="texty" data-act="settings">Settings</button>
            </nav>
          </header>
          <div class="hub-copy">
            <p class="eyebrow"><span class="live-dot"></span> A pachinko roguelite</p>
            <h1>Plumb</h1>
            <p class="hero-line">Fortune favors<br><em>the falling.</em></p>
            <p class="lede">One sphere. A beautiful chain reaction.<br>Find your fortune in the heart of the machine.</p>
            <button class="primary big launch-button" data-act="start"><span>Begin the descent</span><span aria-hidden="true">↘</span><kbd>Enter</kbd></button>
            <div class="seed-row">
              <label class="seed"><span>Run seed</span>
                <input data-seed value="${esc(stage.seed)}" maxlength="12" spellcheck="false" placeholder="Let fate decide" aria-label="Run seed" />
              </label>
              <button class="texty" data-act="random-seed" aria-label="Randomize seed" title="Randomize seed">↻</button>
            </div>
          </div>
          <div class="specimen-caption" aria-hidden="true"><span>GRAVITATIONAL SPECIMEN / 0${stage.balls.findIndex(b => b.selected) + 1}</span><b>${esc(stage.balls.find(b => b.selected)?.name ?? '')}</b><i>Suspended between chance &amp; control</i></div>
          <div class="hub-balls">
            <div class="section-label"><p class="eyebrow">01 — Choose your sphere</p><span>Every heart falls differently</span></div>
            <div class="ball-row">${stage.balls.map((b, i) => ballHtml(b, i)).join('')}</div>
          </div>
          <footer class="hub-foot">
            <div><span>Shards</span><b>${stage.shards}</b></div>
            <div><span>Best score</span><b>${stage.best.toLocaleString()}</b></div>
            <div><span>Falls</span><b>${stage.runs}</b></div>
            <button class="${stage.canStudy ? 'primary' : 'ghost'}" data-act="study" ${stage.canStudy ? '' : 'disabled'}>${esc(stage.study)}</button>
          </footer>
        </div>`
    case 'help':
      return `
        <article class="plaque narrow">
          <p class="eyebrow">A short briefing</p>
          <h2>How a fall works</h2>
          <ol class="steps">
            <li><kbd>Mouse</kbd> or <kbd>←</kbd><kbd>→</kbd> aim. Click to release. The weight of the drop is fixed.</li>
            <li><kbd>A</kbd> <kbd>D</kbd> nudge. You only get a few. Spend them when the line is about to go wrong.</li>
            <li><kbd>F</kbd> flips the gate once. Gold usually sits off the calm lane.</li>
            <li>Pegs pay gears. Gold raises the multiplier. The gutters crack the shell.</li>
            <li>When the shell is empty, the fall is over. Shards and names remain.</li>
            <li><kbd>Space</kbd> is the sphere's trick. <kbd>Q</kbd> tilts gravity, once you have learned how.</li>
          </ol>
          <button class="primary" data-act="back">Return</button>
        </article>`
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
          <button class="primary" data-act="back">Return</button>
        </article>`
    case 'choices':
      return `
        <div class="decision">
          <p class="eyebrow">${esc(stage.kicker)}</p>
          <h2>${esc(stage.title)}</h2>
          <p class="build">${esc(stage.build)}</p>
          <div class="cards">${stage.cards.map((c) => choiceHtml(c, 'pick')).join('')}</div>
          <button class="ghost" data-act="skip">${esc(stage.skip)}</button>
        </div>`
    case 'shop':
      return `
        <div class="decision">
          <p class="eyebrow">The Counter</p>
          <h2>Buy what changes the fall</h2>
          <p class="purse"><span class="gear-ico"></span>${stage.gears} gears</p>
          <p class="build">${esc(stage.build)}</p>
          <div class="cards">${stage.cards.map((c) => choiceHtml(c, 'buy')).join('')}</div>
          <div class="row center">
            <button class="ghost" data-act="reroll" ${stage.canReroll ? '' : 'disabled'}>Reroll · ${stage.reroll}</button>
            <button class="primary" data-act="leave">Leave</button>
          </div>
        </div>`
    case 'fork':
      return `
        <div class="decision">
          <p class="eyebrow">A route</p>
          <h2>${esc(stage.title)}</h2>
          <div class="cards">
            ${stage.options
              .map(
                (o) => `
              <button class="card fork ${o.risk}" data-act="fork:${o.index}" style="--i:${o.index}">
                <span class="risk ${o.risk}">${o.risk === 'safe' ? '● Safe' : '▲ Risk'}</span>
                <kbd class="num">${o.index + 1}</kbd>
                <h3>${esc(o.title)}</h3>
                <p>${esc(o.detail)}</p>
              </button>`,
              )
              .join('')}
          </div>
        </div>`
    case 'repair':
      return `
        <article class="plaque narrow">
          <p class="eyebrow">The Bench</p>
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
        <article class="plaque narrow">
          <p class="eyebrow">Held</p>
          <h2>The sphere waits</h2>
          <div class="col">
            <button class="primary" data-act="resume">Resume</button>
            <button class="ghost" data-act="settings">Settings</button>
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
          <div class="row">
            <button class="primary" data-act="again">Drop again <kbd>Enter</kbd></button>
            <button class="ghost" data-act="retry">Retry this seed</button>
          </div>
          <div class="row">
            ${s.canStudy ? `<button class="ghost" data-act="study">${esc(s.studyLabel)}</button>` : ''}
            <button class="texty" data-act="copy-seed">Copy seed</button>
            <button class="texty" data-act="hub">Hub</button>
          </div>
        </article>`
    }
    case 'reveal':
      return `
        <article class="plaque narrow reveal">
          <div class="sigil"></div>
          <p class="eyebrow">Schematic</p>
          <h2>${esc(stage.name)}</h2>
          <p class="tags">${esc(stage.tags)}</p>
          <p>${esc(stage.text)}</p>
          <p class="quiet">It can appear in future falls.</p>
          <button class="primary" data-act="close-reveal">Continue</button>
        </article>`
  }
}

function orb(colors: [string, string, string]): string {
  return `<i class="orb" style="--oa:${colors[0]};--ob:${colors[1]};--oc:${colors[2]}"></i>`
}

function ballHtml(b: BallCard, i: number): string {
  if (b.locked) {
    return `<article class="card ball locked" style="--i:${i};--sphere:${b.colors[0]}"><span class="ball-index">0${i + 1}</span>${orb(b.colors)}<div><span class="ball-state">◇ Dormant</span><h3>${esc(b.name)}</h3><p>${esc(b.reason)}</p></div></article>`
  }
  return `
    <button class="card ball ${b.selected ? 'selected' : ''}" data-act="ball:${b.id}" aria-pressed="${b.selected}" style="--i:${i};--sphere:${b.colors[0]}">
      <span class="ball-index">0${i + 1}</span>
      ${orb(b.colors)}
      <div>
        <span class="ball-state">${b.selected ? '● Selected' : 'Available'}</span>
        <h3>${esc(b.name)}</h3>
        <p>${esc(b.tagline)}</p>
        <span class="tags">${esc(b.tags)}</span>
      </div>
    </button>`
}

function choiceHtml(c: ChoiceCard, act: 'pick' | 'buy'): string {
  const head = c.price ? `<em class="price">${c.price} gears</em>` : ''
  return `
    <button class="card offer ${c.synergy ? 'has-syn' : ''}" data-act="${act}:${c.index}" style="--i:${c.index}" ${c.afford ? '' : 'disabled'}>
      <kbd class="num">${c.index + 1}</kbd>
      <span class="relic-art" aria-hidden="true">${['◇', '✧', '◎'][c.index % 3]}</span>
      ${head}
      <h3>${esc(c.name)}</h3>
      <span class="tags">${esc(c.tags)}</span>
      <p>${esc(c.text)}</p>
      ${c.synergy ? `<span class="syn">${esc(c.synergy)}</span>` : ''}
    </button>`
}

function block(title: string, items: CollItem[]): string {
  return `
    <h3>${esc(title)}</h3>
    <ul class="archive">
      ${items
        .map(
          (item) => `
        <li class="${item.known ? '' : 'unknown'}">
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
