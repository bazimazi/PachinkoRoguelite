# PLUMB

A pachinko roguelite. The sphere falls through a living machine. You cannot hold it. You can still decide the fall.

## Relay guardians · v0.4

Two optional physical objectives now change the problem inside existing machines:

- **The Bellkeeper**, in Act I's gallery or kiln, asks you to strike three bells in any order. Credited bells retract. Linking all three pays **70 gears** and opens a relic draft if you survive. The riskier kiln retains its guaranteed surviving relic even when the bells are unfinished; completion adds the gear bounty, rather than a second relic.
- **The Heartforge**, in Act II's dynamo, asks for **I → II → I → II** across its left and right relays. Completing the sequence pays **120 gears** and opens a relic draft if you survive. The HUD shows the next valid target.

An unfinished guardian allows **one automatic return from a safe collector before 75 seconds of simulation time**. Progress, shell, earned gears, and remaining controls carry over; the return awards no landing payout and restores no resources. Hazard gutters still follow normal damage rules and cannot trigger this return, even when shielded. After the return is spent, its time window expires, or the objective is completed, collectors settle normally. An incomplete guardian never blocks normal route progression if you survive.

Fresh profiles receive contextual **Workshop tips** for release, nudging, and Overdrive. The relevant controls light up as the situation changes; completing a real nudge and an Overdrive activation finishes the coaching. Dismiss tips at any time, or choose **Show Workshop tips again** in How to play. This returns to the hub while preserving the expedition checkpoint. Guardian instructions, credited targets, bounty, and remaining return stay visible during play; the journal explains the complete contract. Live notices sit at the edge of the playfield.

Feedback keeps the sphere visible: first-contact labels avoid the launcher, nearby payout labels are capped, and the persistent chain readout replaces competing combo and lightning captions. Phone guardian completion and reactor readiness use their existing HUD instruments, leaving collectors visible. Nudge, trick, and tilt buttons now reflect their brief recovery periods as well as remaining charges.

New expeditions and dailies use **rules 3**. Rules 2 challenge links, checkpoints, and logbook replays keep their original routes without relay guardians. Imported rules 2 challenges are labeled **Classic route**; daily personal bests are kept separately by rules version.

The presentation has been rebuilt around an orbital specimen display, a dedicated expedition console, illustrated schematic cards, and a connected constellation route. Machines have distinct conservatory, foundry, gravity, and boss architecture, a first-contact aim marker, clearer sphere trails, live chain timing, and a five-seal boss display.

**Overdrive adds a decision during every fall.** Five different physical peg contacts charge the reactor. Press **E** or its on-screen control for an aimed upward pulse, three seconds of doubled collision earnings, and held combo decay. You get two activations per machine. Hazards still hurt, and landing/relic payouts are not doubled.

The Helix unfolds over **three acts and 10–11 machines**, with seven route forks, three choice events, shops, and full shell repairs between acts. Choose a starting relic and build from **18 relics and 14 upgrades**. Six seeded anomalies change the physical boards: extra gold, vanishing constellations, springs, gravity wells, reinforced pegs, and moving tracks.

New relic engines include capped lightning discharges, one-hit protection, timely gold-hit nudge recovery, reinvesting earned gears, alternating springs and bumpers, portal rewards, clean landings, and shatter-driven repairs. The journal explains the actual bonuses of matching tags and shows every acquired item.

- **Commissions:** three seeded goals pay gears, mend one shell when you survive the drop, and award four shards each at expedition end.
- **Trials:** clearing the Grinder unlocks the next cumulative difficulty for that sphere, up to Trial 6. Select an unlocked trial at the hub; its rule is explained before starting.
- **Circuits:** bank a boss victory or keep your build, fully repair, choose another relic, and enter another three-act circuit. Gravity, anomaly intensity/frequency, payouts, and shop prices increase within bounded limits. Cleared circuits still count toward mastery and challenges if a later circuit ends in defeat.
- **Daily constellation:** a UTC-date seed with a fixed sphere and complete research catalogue. Replay freely; bests are local to this device. There is no online leaderboard or streak penalty.
- **Sharing:** challenge links include the rules version, seed, sphere, trial, mode, and captured research catalogue. Follow the same choices in the same version to reproduce a challenge across fresh and veteran profiles. Bare seeds reproduce boards; they do not encode a build or player inputs.
- **Continue:** decisions save automatically. Reloading during a fall restarts the current machine from its launch state. Purchases and rerolls persist. Starting another expedition replaces the saved one. The logbook keeps the last 20 completed expeditions.

The Grinder still needs five real core strikes. A missed pocket now spends one shell and returns the sphere with core progress intact. Finite lives and stalled-drop recovery keep a fight from continuing indefinitely. Void Marble's Space ability now uses its tilt pool correctly.

Research and the implementation direction are documented in [the genre evidence brief](docs/genre-research.md) and [the design and validation notes](docs/expedition-design.md).

## Play

```bash
npm install
npm run dev
```

Open the local URL Vite prints. `npm run build` typechecks and writes `dist/`.

Use a currently supported Node.js LTS release. The test harness uses Happy DOM and native Canvas; these are development dependencies and are not shipped in the game bundle.

The Helix is presented as a celestial arcade: an animated astrolabe on the title screen, engraved machines in four color palettes, glass sphere materials, illuminated collectors, and ricochet effects. The selected sphere changes the title specimen. Phone layouts reserve space above and below the playfield for the controls; system reduced-motion preferences quiet ambient animation, camera shake, zoom, particles, and flashes.

## Visual verification

```bash
npm test
npm run verify:visuals
npm run verify:browser
```

`npm test` checks relic mechanics and accounting, Overdrive, guardian contacts and finite returns, generated routes and anomalous physics, and DOM/controller flows including full expeditions with every sphere. Each suite can also be run through `verify:builds`, `verify:momentum`, `verify:encounters`, `verify:routes`, or `verify:expeditions`. These tests are deterministic and run offline.

`npm run verify:browser` runs Playwright in desktop Chromium, touch-emulated phone/tablet Chromium, and desktop Firefox. It tests real clicks and taps, seeded physical charging, guardian progress and earned relic drafts, Workshop coaching, classic challenge compatibility, pause/resume, checkpoints, decision screens, large type, reduced motion, cooldowns, and layout fit. It writes screenshots to `artifacts/browser/` and an HTML report to `artifacts/playwright-report/`. Run `npx playwright install chromium firefox` once if the required browsers are not installed. Mobile emulation complements physical-device testing. The final v0.4 run passes all **40 browser scenarios**; the production build, 32 expedition integration checks, 12 guardian checks across 720 falls, and 112 Canvas renders also pass.

Set `PLUMB_TEST_LIGHT=1` when memory is constrained to omit trace and video recording. Screenshots, browser profiles, and assertions stay the same.

`npm run verify:visuals` uses a native Canvas implementation, without launching a browser. It simulates all seven layouts with all three spheres, checks that rendering does not mutate gameplay, exercises animated and still title scenes at desktop and high-DPI phone sizes, and writes PNGs to `artifacts/visual-checks/`. These checks complement browser playtesting; they do not verify CSS layout or browser-specific rendering.

## A fall

- Aim with the mouse or the arrow keys. Click or press Enter to release. Launch weight is fixed.
- **V** inspects the whole machine before launch; press again to return to the inlet. Releasing the sphere restores the tracking camera.
- **A / D** nudge. You only get a few.
- **F** flips the gate once.
- **E** triggers charged Overdrive. Choose between saving a line and maximizing three seconds of collision earnings.
- **Space** uses the sphere's trick: Rebound, Mark, or Tilt.
- **Q** leans gravity, once a build has learned it.
- **J** opens the build, commissions, and route journal; the machine pauses while you read.
- **Esc** pauses. Settings offer 0.75×, 1×, 1.5×, or 2× pacing, motion controls, and larger text. Hidden tabs pause automatically.
- Gold raises the multiplier. Gutters and spikes crack the shell. An empty shell ends the fall.
- Shards stay. They study schematics, which add relics to future falls.

Rubber Heart is awake at the start. Prism Core wakes after the first fall. Void Marble wakes when you reach the Gravity Core, or after two falls.

Every fall has a seed. Share a complete challenge from its results or logbook, or retry it with the same captured catalogue.

`` ` `` opens the developer panel in dev builds.
