export interface BallCard {
  id: string
  name: string
  tagline: string
  tags: string
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
  combo: number
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
  | { kind: 'resolve'; title: string; sub: string }
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

function pips(on: number, max: number): string {
  let html = ''
  for (let i = 0; i < max; i++) html += `<i class="${i < on ? 'on' : ''}"></i>`
  return `<span class="pips">${html}</span>`
}

export class UI {
  private sig = ''
  private hudKey = ''

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
      if (!t) return
      this.onAction(t.dataset.act || '')
    }
    stage.addEventListener('click', click)
    hud.addEventListener('click', click)
    stage.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement
      if (t.dataset.seed != null) this.onSeed(t.value)
      if (t.dataset.volume != null) this.onAction('volume:' + t.value)
    })
  }

  render(view: ViewModel): void {
    const root = document.getElementById('app')
    if (root) root.dataset.mode = view.screen
    if (view.sig !== this.sig) {
      this.sig = view.sig
      this.stage.innerHTML = stageHtml(view.stage)
      this.stage.className = view.stage.kind === 'none' ? '' : 'open'
    }
    this.renderHud(view.hud)
    if (view.toast) {
      this.toast.hidden = false
      this.toast.innerHTML = `<b>${esc(view.toast.title)}</b>${view.toast.sub ? `<span>${esc(view.toast.sub)}</span>` : ''}`
    } else {
      this.toast.hidden = true
      this.toast.innerHTML = ''
    }
    this.flash.className = view.flash
  }

  private renderHud(hud: HudModel | null): void {
    if (!hud) {
      this.hud.innerHTML = ''
      this.hudKey = ''
      return
    }
    const key = `${hud.aiming}|${hud.playing}|${hud.showFlip}|${hud.maxSpecials}|${hud.maxTilts}|${hud.maxNudges}|${hud.core}|${hud.jackpot}`
    if (key !== this.hudKey) {
      this.hudKey = key
      this.hud.innerHTML = `
        <div class="dock left">
          <div class="chip"><span>Gears</span><b data-hud="gears"></b></div>
          <div class="chip"><span>Shell</span><b data-hud="shell"></b></div>
          <div class="chip dim"><span>Score</span><b data-hud="score"></b></div>
          <button class="texty" data-act="copy-seed" data-hud="seed"></button>
          <button class="texty" data-act="mute" data-hud="mute"></button>
        </div>
        <div class="dock right">
          <div class="chip mult"><span>Multiplier</span><b data-hud="mult"></b></div>
          <div class="chip"><span>Combo</span><b data-hud="combo"></b></div>
          <div class="chip dim" data-hud="synergy-wrap"><span>Build</span><b data-hud="synergy"></b></div>
          <div class="kicker" data-hud="kicker"></div>
          <h2 data-hud="title"></h2>
          <p class="blurb" data-hud="blurb"></p>
          <p class="gate" data-hud="gate"></p>
          <p class="core" data-hud="core"></p>
          <p class="gate" data-hud="jackpot"></p>
        </div>
        <div class="controls">
          ${hud.playing && hud.aiming ? `<p class="hint">Click or Enter to release</p>` : ''}
          ${hud.playing && !hud.aiming ? `<button data-act="nudge-left">A · Nudge</button>` : ''}
          ${hud.playing && !hud.aiming && hud.maxSpecials > 0 ? `<button data-act="special">Space · ${esc(hud.specialName)}</button>` : ''}
          ${hud.playing && !hud.aiming && hud.maxTilts > 0 ? `<button data-act="tilt">Q · Tilt</button>` : ''}
          ${hud.playing && !hud.aiming && hud.showFlip ? `<button data-act="flip">F · Flip gate</button>` : ''}
          ${hud.playing && !hud.aiming ? `<button data-act="nudge-right">D · Nudge</button>` : ''}
          ${hud.playing ? `<button class="ghost" data-act="pause-btn">Esc</button>` : ''}
        </div>`
    }
    const set = (name: string, text: string) => {
      const el = this.hud.querySelector(`[data-hud="${name}"]`)
      if (el && el.textContent !== text) el.textContent = text
    }
    set('gears', String(hud.gears))
    set('score', String(hud.score))
    set('mult', hud.mult)
    set('combo', hud.combo ? String(hud.combo) : '—')
    set('seed', hud.seed)
    set('kicker', hud.kicker)
    set('title', hud.title)
    set('blurb', hud.blurb)
    set('gate', hud.gate)
    set('synergy', hud.synergy || '—')
    set('core', hud.core)
    set('jackpot', hud.jackpot)
    set('mute', hud.muted ? 'Sound off' : 'Sound on')
    const shell = this.hud.querySelector('[data-hud="shell"]')
    if (shell) shell.innerHTML = `${pips(hud.shell, hud.shellMax)} <em>${hud.shell}/${hud.shellMax}</em>`
    const nudgeBtn = this.hud.querySelectorAll('[data-act="nudge-left"], [data-act="nudge-right"]')
    nudgeBtn.forEach((b) => {
      const label = b.getAttribute('data-act') === 'nudge-left' ? 'A · Nudge' : 'D · Nudge'
      b.innerHTML = `${label} ${pips(hud.nudges, hud.maxNudges)}`
    })
    const special = this.hud.querySelector('[data-act="special"]')
    if (special) special.innerHTML = `Space · ${esc(hud.specialName)} ${pips(hud.specials, hud.maxSpecials)}`
    const tilt = this.hud.querySelector('[data-act="tilt"]')
    if (tilt) tilt.innerHTML = `Q · Tilt ${pips(hud.tilts, hud.maxTilts)}`
    const flip = this.hud.querySelector('[data-act="flip"]')
    if (flip) {
      ;(flip as HTMLButtonElement).disabled = hud.flips <= 0
      flip.innerHTML = hud.flips > 0 ? 'F · Flip gate' : 'Gate spent'
    }
  }
}

function stageHtml(stage: StageModel): string {
  switch (stage.kind) {
    case 'none':
      return ''
    case 'hub':
      return `
        <div class="hub">
          <div class="hub-copy">
            <p class="eyebrow">The Helix</p>
            <h1>Plumb</h1>
            <p class="lede">You cannot hold the sphere. You can still decide its fall.</p>
            <label class="seed">Seed
              <input data-seed value="${esc(stage.seed)}" maxlength="12" spellcheck="false" placeholder="Random if empty" aria-label="Run seed" />
            </label>
            <div class="row">
              <button class="ghost" data-act="random-seed">Randomize</button>
              <button class="primary" data-act="start">Begin the drop</button>
            </div>
            <div class="row quiet">
              <button class="texty" data-act="help">How the fall works</button>
              <button class="texty" data-act="collection">Archive</button>
              <button class="texty" data-act="settings">Settings</button>
            </div>
          </div>
          <div class="hub-balls">
            <p class="eyebrow">Choose a sphere</p>
            <div class="ball-row">${stage.balls.map((b) => ballHtml(b)).join('')}</div>
          </div>
          <footer class="hub-foot">
            <div><span>Shards</span><b>${stage.shards}</b></div>
            <div><span>Best</span><b>${stage.best}</b></div>
            <div><span>Falls</span><b>${stage.runs}</b></div>
            <button class="${stage.canStudy ? 'primary' : 'ghost'}" data-act="study" ${stage.canStudy ? '' : 'disabled'}>${esc(stage.study)}</button>
          </footer>
        </div>`
    case 'help':
      return `
        <article class="plaque narrow">
          <p class="eyebrow">A short briefing</p>
          <h2>How a fall works</h2>
          <ol>
            <li>Aim with the mouse, or the arrow keys. Click to release. The weight of the drop is fixed.</li>
            <li>A and D nudge. You only get a few. Spend them when the line is about to go wrong.</li>
            <li>F flips the gate once. Gold usually sits off the calm lane.</li>
            <li>Pegs pay gears. Gold raises the multiplier. The gutters crack the shell.</li>
            <li>When the shell is empty, the fall is over. Shards and names remain.</li>
            <li>Space is the sphere's trick. Q tilts gravity, once you have learned how.</li>
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
          <p class="eyebrow">The Counter · ${stage.gears} gears</p>
          <h2>Buy what changes the fall</h2>
          <p class="build">${esc(stage.build)}</p>
          <div class="cards">${stage.cards.map((c) => choiceHtml(c, 'buy')).join('')}</div>
          <div class="row">
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
              <button class="card fork" data-act="fork:${o.index}">
                <span class="risk ${o.risk}">${o.risk === 'safe' ? '● Safe' : '▲ Risk'}</span>
                <b>${o.index + 1}</b>
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
            <button class="card" data-act="bargain:shell" ${stage.canShell ? '' : 'disabled'}>
              <span class="risk risky">▲ Risk</span>
              <h3>Crack the shell</h3>
              <p>Lose 1 integrity. Receive a relic you do not choose.</p>
            </button>
            <button class="card" data-act="bargain:pay" ${stage.canPay ? '' : 'disabled'}>
              <span class="risk risky">▲ Risk</span>
              <h3>Pay thirty gears</h3>
              <p>Lose 30 gears. Receive an upgrade you do not choose.</p>
            </button>
            <button class="card" data-act="bargain:walk">
              <span class="risk safe">● Safe</span>
              <h3>Skim the tray</h3>
              <p>Take 18 gears and leave the offer on the table.</p>
            </button>
          </div>
        </div>`
    case 'resolve':
      return `
        <button class="resolve" data-act="skip">
          <b>${esc(stage.title)}</b>
          <span>${esc(stage.sub)}</span>
          <em>Continue</em>
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
          <dl class="stats">
            <div><dt>Score</dt><dd>${s.score}${s.best ? ' · new best' : ''}</dd></div>
            <div><dt>Gears left</dt><dd>${s.gears}</dd></div>
            <div><dt>Best multiplier</dt><dd>${esc(s.mult)}</dd></div>
            <div><dt>Best combo</dt><dd>${s.combo}</dd></div>
            <div><dt>Depth</dt><dd>${esc(s.depth)}</dd></div>
            <div><dt>Shards</dt><dd>+${s.shards}</dd></div>
          </dl>
          ${s.awakened.length ? `<p>Awakened: ${esc(s.awakened.join(', '))}</p>` : ''}
          ${s.challenges.length ? `<p>Challenges: ${esc(s.challenges.join(', '))}</p>` : ''}
          <p class="tempt">${esc(s.temptation)}</p>
          <p class="quiet">Seed ${esc(s.seed)}</p>
          <div class="row">
            <button class="primary" data-act="again">Drop again</button>
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
        <article class="plaque narrow">
          <p class="eyebrow">Schematic</p>
          <h2>${esc(stage.name)}</h2>
          <p class="tags">${esc(stage.tags)}</p>
          <p>${esc(stage.text)}</p>
          <p class="quiet">It can appear in future falls.</p>
          <button class="primary" data-act="close-reveal">Continue</button>
        </article>`
  }
}

function ballHtml(b: BallCard): string {
  if (b.locked) {
    return `<article class="card ball locked"><h3>${esc(b.name)}</h3><p>${esc(b.reason)}</p></article>`
  }
  return `
    <button class="card ball ${b.selected ? 'selected' : ''}" data-act="ball:${b.id}">
      <h3>${esc(b.name)}</h3>
      <p>${esc(b.tagline)}</p>
      <span class="tags">${esc(b.tags)}</span>
    </button>`
}

function choiceHtml(c: ChoiceCard, act: 'pick' | 'buy'): string {
  const price = c.price ? `<em>${c.price} gears</em>` : `<em>${c.index + 1}</em>`
  return `
    <button class="card" data-act="${act}:${c.index}" ${c.afford ? '' : 'disabled'}>
      ${price}
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
          <span>${esc(item.known ? item.text : item.text)}</span>
        </li>`,
        )
        .join('')}
    </ul>`
}

function toggle(id: string, label: string, on: boolean): string {
  return `<button class="toggle ${on ? 'on' : ''}" data-act="toggle:${id}"><span>${esc(label)}</span><b>${on ? 'On' : 'Off'}</b></button>`
}
