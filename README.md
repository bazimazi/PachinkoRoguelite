# PLUMB

A pachinko roguelite. The sphere falls through a living machine. You cannot hold it. You can still decide the fall.

## Play

```bash
npm install
npm run dev
```

Open the local URL Vite prints. `npm run build` typechecks and writes `dist/`.

The Helix is presented as a celestial arcade: an animated astrolabe on the title screen, engraved machines in four color palettes, glass sphere materials, illuminated collectors, and ricochet effects. The selected sphere changes the title specimen. Phone layouts reserve space above and below the playfield for the controls; system reduced-motion preferences quiet ambient animation, camera shake, zoom, particles, and flashes.

## Visual verification

```bash
npm run verify:visuals
```

This offline check uses a native Canvas implementation, without launching a browser. It simulates all seven layouts with all three spheres, checks that rendering does not mutate gameplay, exercises animated and still title scenes at desktop and high-DPI phone sizes, and writes PNGs to `artifacts/visual-checks/`. These checks complement browser playtesting; they do not verify CSS layout or browser-specific rendering.

## A fall

- Aim with the mouse or the arrow keys. Click or press Enter to release. Launch weight is fixed.
- **A / D** nudge. You only get a few.
- **F** flips the gate once.
- **Space** uses the sphere's trick: Rebound, Mark, or Tilt.
- **Q** leans gravity, once a build has learned it.
- Gold raises the multiplier. Gutters and spikes crack the shell. An empty shell ends the fall.
- Shards stay. They study schematics, which add relics to future falls.

Rubber Heart is awake at the start. Prism Core wakes after the first fall. Void Marble wakes when you reach the Gravity Core, or after two falls.

Every fall has a seed. The same seed rebuilds the same machines. Share it, or retry it.

`` ` `` opens the developer panel in dev builds.
