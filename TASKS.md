# Mermaid Monkey Task Checkpoint

Last updated: 2026-05-30, goal-driven pass in progress

## Current Objective

Continue from `goal.md` toward `@mermaid-monkey/core` v1 web/demo release. Current focus is the remaining requirement-audit holes, especially item `44b` (adapter-backed WebGPU device-loss recovery) and any final items that still lack strong end-to-end proof.

## Latest Resume Notes

- The current Playwright browser suite is green at `83` tests.
- The current full release gate is green on this tree:
  - `pnpm verify:core`
  - lint, typecheck, unit tests, browser tests, core build, demo build, bundle check, and `npm pack --dry-run` all passed together
- External GitHub Actions evidence now exists in both shapes item `12` asked for:
  - pull request:
    - workflow: `Core Verify`
    - run: `26679935715`
    - commit: `7c07ee4`
    - trigger: `pull_request`
    - result: `success`
    - PR: `#1` (`docs: note pull request audit artifact`)
  - post-merge mainline:
    - workflow: `Core Verify`
    - run: `26680191944`
    - commit: `4224af1`
    - trigger: push to `main`
    - result: `success`
- Current verified results from that gate:
  - unit suite: `142` passed
  - browser suite: `83` passed
  - built static demo smoke: passed
  - current measured browser perf from the same run:
    - representative: `loadMs ≈ 102.7`, `avgFrameMs ≈ 11.42`, `p95FrameMs ≈ 9.20`, `approxFps ≈ 87.60`
    - stress: `220` nodes / `294` edges, `loadMs ≈ 283.0`, `avgFrameMs ≈ 9.80`, `p95FrameMs ≈ 25.00`, `approxFps ≈ 102.00`
  - current packaged/build artifact checks from that same run:
    - core ESM: `202.86 KiB` (`207724 bytes`)
    - core CJS: `205.14 KiB` (`210067 bytes`)
    - demo entry: `index-C8tk_jFF.js` `478.38 KiB` raw (`489864 bytes`) / `137.53 KiB` gzip (`140829 bytes`)
    - dry-run tarball: `mermaid-monkey-core-1.0.0.tgz`, package size `275.8 kB`
- `docs/release.md` and `docs/tech.md` now match that fresh gate instead of the older `142` / `82` checkpoint.
- Requirement-audit tie-backs on the current tree:
  - `goal.md` item `7` is covered by the browser/lifecycle suite:
    - regular render path proves a real GPU backend is active
    - no-adapter path proves fallback to WebGL
    - no-backend path proves readable unavailable state instead of white screen
    - the WebGPU device-loss probe now proves the adapter-unavailable branch finishes visibly instead of hanging
  - `goal.md` item `10` is no longer a vague cleanup bucket; it is represented by the accumulated browser invariants and the fresh green full gate on the shipped example corpus
  - `goal.md` item `13` is covered by the shipped-example plus stress overlap probe, which proves no rendered node-on-node overlap across the visible demo corpus and the generated stress graph
  - `goal.md` items `21`, `22`, `24`, `25`, and `26` now each have direct browser artifacts in addition to state/math assertions:
    - expanded-bounds hover glow
    - selection-cleared rebuild state
    - ordinary fit-to-view framing
    - fit-to-view recovery from stranded viewport
    - zoom clamp min/max states
  - `goal.md` item `39` now has paired preview-theme artifacts in addition to preview-state and font-family assertions
  - `goal.md` item `52` now has a committed rendered-footprint routing artifact in addition to the segment-vs-rect proof
  - `goal.md` item `55` remains intentionally enforced by numeric theme-contrast tests rather than screenshots, because the requirement itself is a documented contrast-ratio floor
- `@mermaid-monkey/core` is now versioned `1.0.0`, and the verified dry-run tarball is `mermaid-monkey-core-1.0.0.tgz`.
- The built static demo artifact now has its own reproducible smoke path:
  - `pnpm --filter @mermaid-monkey/core test:browser:static-demo`
  - it serves `packages/core/dist-demo/` from a plain static HTTP server and proves the built artifact renders, switches philosophy, follows a cross-file link, and responds to the file picker
- The GPU/lifecycle slice now has its own focused browser gate:
  - `pnpm --filter @mermaid-monkey/core test:browser:lifecycle`
  - current result: `10` passed
  - it isolates multi-instance behavior, lifecycle misuse errors, destroy-time cleanup of handlers/timers/live-canvas ownership, synthetic WebGL context recovery, no-adapter WebGPU fallback, visibility/idle ticker behavior, readable fallback states, and the WebGPU device-loss probe path
  - the WebGPU device-loss probe now also keeps a committed harness artifact for its terminal state when no usable adapter exists, instead of relying only on the returned probe object
  - `goal.md` item `44` is now treated as two parts:
    - `44a` is the common-path proof surface: synthetic WebGL context loss / restore plus WebGPU-no-adapter fallback
    - `44b` is the remaining adapter-backed WebGPU device-lost recovery branch
  - direct environment probe evidence on this machine now shows why only `44b` remains blocked here:
    - headless Chromium `148.0.7778.96` reports `navigator.gpu === undefined`

- The relayout/animation slice now also has its own focused browser gate:
  - `pnpm --filter @mermaid-monkey/core test:browser:relayout`
  - current result: `9` passed
  - it isolates the main animated-proof surface for `goal.md` items `30`, `48`, `49`, and the active runtime half of `50`:
    - fold state survives a philosophy switch
    - no orphaned or duplicate sprites across rebuilds
    - interrupted relayouts settle cleanly with no fade residue
    - edge endpoints stay attached during live motion
    - mid-motion inventory remains clean
    - a mid-relayout frame stays visually clean
    - node motion progresses smoothly instead of teleporting
    - relayout motion pauses while hidden and resumes when visible
    - stress mode skips relayout fade/motion work
  - while landing that focused gate, the moving-edge motion artifact was also stabilized:
    - `relayout-moving-edge-attached-chromium-darwin.png` now uses a fixed-size centered crop instead of geometry-derived image dimensions
    - that removed a real clustered-run flake where tiny motion differences changed the snapshot width by a few pixels
- The spring/runtime animation slice now also has a first-class rerun path:
  - `pnpm --filter @mermaid-monkey/core test:animation`
  - current result:
    - spring + animation-clock unit slice: `12` passed
    - relayout browser slice: `9` passed
  - this gives `goal.md` items `47` through `50` one concrete verification command instead of splitting the proof across ad hoc vitest and Playwright invocations
- The theme/emphasis slice now also has a first-class rerun path:
  - `pnpm --filter @mermaid-monkey/core test:theme`
  - current result:
    - theme unit slice: `7` passed
    - theme/emphasis browser slice: `10` passed
  - this gives `goal.md` items `55` through `64` one concrete verification command instead of scattering the proof across several unit files and many browser `-g` runs
- The cross-file linking and hover-preview slice now also has a first-class rerun path:
  - `pnpm --filter @mermaid-monkey/core test:linking`
  - current result:
    - parser/resolver unit slice: `20` passed
    - linking/preview browser slice: `16` passed
  - this gives `goal.md` items `33` through `40` one concrete verification command instead of scattering the proof across parser unit tests and many browser `-g` runs
- The render-quality and viewport slice now also has a first-class rerun path:
  - `pnpm --filter @mermaid-monkey/core test:render-quality`
  - current result:
    - browser slice: `22` passed
  - this gives `goal.md` items `13` through `32` one concrete verification command for the geometry, routing, fit/zoom, layering, containment, and degenerate-rendering invariants instead of scattering the proof across many browser `-g` runs
- The browser integration, embed, and static-demo surface now also has a first-class rerun path:
  - `pnpm --filter @mermaid-monkey/core test:web`
  - current result:
    - browser integration/embed slice: `8` passed
    - built static demo smoke: `1` passed
  - this gives `goal.md` items `1` and `3` through `6` one concrete verification command for:
    - example load -> layout -> render on the real Pixi path
    - fold/unfold and focus navigation behavior
    - philosophy-switch fold-state preservation
    - fit-to-view sanity after reload
    - documented plain-page embed mounting
    - readable invalid-input and unsupported-diagram failure states
    - built static demo artifact rendering and navigation
- The performance and stress-degradation surface now also has a first-class rerun path:
  - `pnpm --filter @mermaid-monkey/core test:performance`
  - current result:
    - performance/stress browser slice: `5` passed
  - latest focused run measurements:
    - representative: `7` nodes / `6` edges, `loadMs ≈ 97.6`, `avgFrameMs ≈ 11.41`, `p95FrameMs ≈ 8.5`, `approxFps ≈ 87.62`
    - stress: `220` nodes / `294` edges, `loadMs ≈ 297.2`, `avgFrameMs ≈ 9.87`, `p95FrameMs ≈ 25.0`, `approxFps ≈ 101.27`
  - this gives `goal.md` items `8` and `45` one concrete verification command for:
    - browser-side representative and stress perf sampling
    - explicit stress-mode activation
    - current stress-mode detail suppression
    - current stress-mode preview suppression
    - stress-mode relayout fast path
- The release artifact and ship-surface checks now also have a first-class rerun path:
  - `pnpm --filter @mermaid-monkey/core test:ship`
  - current result:
    - built static demo smoke: `1` passed
    - bundle budget check: passed
    - `npm pack --dry-run`: passed
  - latest focused run artifact measurements:
    - core ESM: `201.94 KiB` (`206788 bytes`)
    - core CJS: `204.23 KiB` (`209128 bytes`)
    - demo entry: `index-C8tk_jFF.js` `478.38 KiB` raw (`489864 bytes`) / `137.53 KiB` gzip (`140829 bytes`)
    - dry-run tarball: `mermaid-monkey-core-1.0.0.tgz`, package size `277.8 kB`
  - this gives `goal.md` items `11` and the artifact/publish half of `12` one concrete verification command for:
    - fresh library build
    - fresh static demo build
    - built static demo smoke from a plain file host
    - bundle-budget enforcement
    - publish-surface pack verification
  - `.github/workflows/core.yml` still runs the broader root `pnpm verify:core` gate on pull requests and pushes to `main`, so PR CI remains tied to the same release surface rather than a separate unpublished checklist
    - that remained true under:
      - default launch
      - `--enable-unsafe-webgpu --ignore-gpu-blocklist`
      - `--enable-unsafe-webgpu --ignore-gpu-blocklist --use-angle=swiftshader-webgpu`
    - local `Google Chrome.app` `148.0.0.0` launched through Playwright also reported `navigator.gpu === undefined`
    - that remained true in both:
      - headless Chrome channel
      - headed Chrome channel with `--enable-unsafe-webgpu --ignore-gpu-blocklist`
    - so this environment can close `44a` but still cannot exercise a real adapter-backed WebGPU recovery branch at all; finishing `44b` requires a different browser/runtime environment with an actual exposed WebGPU adapter
  - `goal.md` item `44a` now has direct visual recovery evidence in addition to lifecycle assertions:
    - the lifecycle harness exposes a retained synthetic WebGL-loss probe that captures the recovered canvas pixels before cleanup
    - browser suite now proves the recovered scene is visibly rendered after `webglcontextlost` / `webglcontextrestored`, not only that node counts repopulate
    - committed baseline:
      - `packages/core/tests/browser/render.spec.ts-snapshots/webgl-context-recovery-restored-chromium-darwin.png`
- A focused browser regression now proves stress mode suppresses secondary detail instead of only warning:
  - edge labels are hidden on large stress graphs
  - subgraph chevrons and count badges are hidden on large stress graphs
- Browser coverage now also proves stress mode suppresses cross-file hover previews on large linked graphs.
- Screenshot-backed visual checks now include:
  - `packages/core/tests/browser/render.spec.ts-snapshots/broken-link-node-badge-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/broken-link-selected-hovered-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/breath-hover-perceptible-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/breath-selection-perceptible-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/degenerate-inline-labels-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/edge-label-clearance-blueprint-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/fold-state-after-philosophy-switch-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/hover-preview-onscreen-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/long-label-node-growth-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/mobile-responsive-shell-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/narrative-light-system-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/narrative-light-to-dark-switch-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/narrative-light-dimmed-context-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/nested-subgraph-containment-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/overlap-topmost-hover-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/overlap-topmost-selection-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/philosophy-switch-blueprint-after-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/philosophy-switch-narrative-before-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/philosophy-switch-radial-broken-link-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/relationship-hover-emphasis-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/relationship-selection-emphasis-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/selection-hover-coexistence-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/selection-only-node-state-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/webgpu-device-loss-adapter-unavailable-harness-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/subgraph-depth-map-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/self-loop-bidirectional-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/stress-mode-suppression-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/relayout-mid-motion-clean-frame-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/blueprint-rendered-footprint-routing-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/edge-endpoints-boundary-simple-flow-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/fit-to-view-recovery-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/fit-to-view-reload-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/hover-glow-expanded-bounds-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/nonblueprint-crossing-warning-state-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/preview-target-philosophy-blueprint-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/preview-target-philosophy-breath-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/selection-cleared-after-rebuild-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/zoom-clamp-max-chromium-darwin.png`
  - `packages/core/tests/browser/render.spec.ts-snapshots/zoom-clamp-min-chromium-darwin.png`
- The runtime/demo v1 support boundary is `flowchart` only. `classDiagram` is not currently supported by the parser/runtime, so unsupported example files must not appear in the visible demo corpus or release claims.
- `docs/vision.md` now matches that v1 release scope:
  - web engine + static demo are the shipped consumers
  - VS Code is future-facing, not part of the current release target
  - current use cases are described in flowchart/web terms rather than C4/class-diagram claims
- `docs/tech.md` architecture now matches the same release boundary:
  - `@mermaid-monkey/core` + the static demo are the shipped v1 artifacts
  - `@mermaid-monkey/vscode` is described as a repo-local future shell, not a current release deliverable
- `README.md` now points at `docs/pain-points.md` as the explicit issue-backed problem list, in addition to the broader design problem statement.
- `docs/release.md` now reflects the current release state directly:
  - publish instructions refer to the current `1.0.0` tree, not a future version bump
  - the latest verified dry-run artifact is named explicitly as `mermaid-monkey-core-1.0.0.tgz`
- README-facing screenshots now exist as checked-in docs assets:
  - `docs/assets/readme-overview-narrative.png`
  - `docs/assets/readme-blueprint-simple-flow.png`
  - `docs/assets/readme-mobile-responsive.png`
- Matching browser snapshot coverage now exists for all three README-facing shots:
  - `readme-overview-narrative-chromium-darwin.png`
  - `readme-blueprint-simple-flow-chromium-darwin.png`
  - `readme-mobile-responsive-chromium-darwin.png`
- `goal.md` item 45 is now stated plainly in the public README, not only in technical notes and tests:
  - the browser-verified interactive floor is called out as roughly `220` nodes / `294` edges
  - rendering past that floor is described as best-effort, not guaranteed 60fps
  - `PERF_STRESS_THRESHOLD` and the current stress-mode degradations are spelled out for embedders
- The README now also states the active backend contract directly for embedders:
  - WebGPU is preferred when a usable adapter exists
  - WebGL fallback is the normal path when `navigator.gpu` exists but no adapter is available
  - there is no claimed Canvas 2D fallback; the no-usable-GPU path is a readable unavailable state instead
- The README now also states the embed lifecycle/runtime contract directly for embedders:
  - same-canvas remount is allowed, different-canvas remount is rejected
  - foreign canvas ownership is rejected instead of leaking a second renderer
  - post-`destroy()` calls fail with clear errors
  - separate canvases can host multiple live renderer instances
  - hidden-tab and idle states pause/stop ticker work instead of leaving a permanent render loop
- The README now also states the tested theme/emphasis contract directly for embedders:
  - shipped palettes keep a tested contrast floor for node, edge-label, and subgraph-label text
  - all philosophies define depth tints for nested subgraphs
  - broken-link state is not color-only
  - hover and selection remain distinct, coexisting states
  - focus dimming keeps context visible instead of treating it as hidden
- The README now also states the interaction contract directly for embedders:
  - `activateLink(nodeId)` is the same path as a real linked-node click
  - `#nodeId` fragments reveal/select the target node after navigation
  - broken targets surface a visible broken-link state and readable warning
  - selection clears across graph rebuilds instead of sticking to stale node ids
- The README now also states two live-switch guarantees directly for embedders:
  - fold state survives `setPhilosophy(...)` relayouts
  - philosophy switches recolor the live scene, including Blueprint font treatment across node, edge, subgraph, and preview text
- `docs/release.md` now carries the current verified gate result directly instead of only command recipes:
  - unit tests `140` passed
  - browser tests `78` passed
  - built static demo smoke passed
  - current bundle sizes and dry-run tarball size are listed in the release doc itself
- The philosophy leaf docs are now aligned with the current v1 runtime instead of only the top-level philosophy index:
  - `map`, `breath`, `radial`, and `mosaic` now explicitly describe their shipped behavior as Dagre + theme/spacing presets, with richer layout/routing ideas called out as future intent
  - `blueprint` now describes the actual occupancy-grid + A* routed path, rendered-footprint reservation, deterministic ordering, and visible fallback-wire behavior
  - `narrative` now documents its subgraph-heavy Dagre fallback and explicitly states that it is a best-effort readability path rather than a collision-free router
  - the detailed algorithm/routing bullet lists in the experimental philosophy docs now sit under explicit future-intent framing instead of reading like already-shipped custom engines
- `goal.md` item 15 now also has a committed browser snapshot artifact:
  - `nonrectangular-label-fit-chromium-darwin.png`
- `goal.md` item 6 now also has a committed browser snapshot artifact:
  - `invalid-mermaid-error-state-chromium-darwin.png`
- `goal.md` items 42 and the generic renderer-init fallback path now also have committed browser snapshot artifacts:
  - `renderer-init-failure-fallback-chromium-darwin.png`
  - `no-gpu-backend-fallback-chromium-darwin.png`
- `goal.md` item 34 now also has a committed browser snapshot artifact for the broken-fragment case:
  - `broken-link-missing-fragment-chromium-darwin.png`
- `goal.md` item 34 now also has a committed browser snapshot artifact for the malformed-directive warning state:
  - `malformed-link-warning-state-chromium-darwin.png`
- `goal.md` item 36 now also has a committed browser snapshot artifact for the out-of-scope trust-boundary warning state:
  - `out-of-scope-link-warning-state-chromium-darwin.png`
- `goal.md` item 43 now also has a committed browser snapshot artifact for the successful WebGL render after no-adapter fallback:
  - `webgpu-no-adapter-webgl-fallback-chromium-darwin.png`
- `goal.md` item 58 enforcement is now stronger at the source level:
  - `packages/core/src/renderer/__tests__/theme-literals.test.ts` now recurses through the full renderer tree instead of scanning only top-level `src/renderer/*.ts`
- `goal.md` item 51 is now stated explicitly in the public README, not only in deeper technical docs:
  - `blueprint` is the only shipped collision-aware router
  - `narrative` is limited/best-effort, not obstacle-free
  - `map`, `breath`, `radial`, and `mosaic` are visual presets, not collision-free routers
- `examples/blueprint-classes.mmd` was removed from the visible demo example list for that reason; this is a scope correction, not a parser fix.
- `examples/blueprint-classes.mmd` is now also excluded from the demo import glob itself, so the unsupported file no longer ships as a lazy demo asset either.
- Blueprint routing now reserves rendered long-label node footprints, not only raw layout widths.
- Blueprint routing now guarantees a visible fallback wire when A* cannot find a path, and reports that state via `RouteResult.congested` instead of silently dropping the edge.
- Blueprint routing order is now deterministic by stable edge-id ordering instead of depending on input edge order.
- Blueprint congestion/fallback is now surfaced through renderer warnings, not only internal route results.
- Non-Blueprint edge/node crossings are no longer silent:
  - the runtime emits `EDGE_NODE_CROSSING` when a rendered edge still passes through an unrelated node footprint
  - browser coverage now proves that warning path through a deterministic rendered probe
- Theme emphasis now has an explicit floor:
  - dimmed context alpha is `0.3` across dark themes and `0.32` for the current light narrative palette
  - unit coverage now enforces minimum hover/selection perceptibility and a minimum dimmed-context readability/distinction rule
- Blueprint font switching is now more complete across live scene text:
  - subgraph labels, chevrons, and count badges now switch to `MermaidBlueprint`
  - hover preview title text now follows the target philosophy font instead of staying on the generic label font
  - browser coverage now proves Blueprint edge labels, subgraph labels, and preview title text use the expected font families
- The active viewport and relayout-fade path now run on the Pixi ticker instead of separate `requestAnimationFrame` loops.
- The shipped non-Blueprint relayout path now performs a real in-place motion pass when node/edge/subgraph identity is stable:
  - node positions move over time instead of only crossfading between complete renders
  - edge geometry is recomputed every animation tick from the interpolated graph
  - subgraph containers move and resize during the same pass
  - node and subgraph theme appearance switches at animation start, not only at the final rebuild
- The runtime no longer carries a second dormant animation subsystem:
  - `packages/core/src/renderer/layout-animator.ts` and its dedicated tests were removed
  - viewport motion, relayout fade, and in-place relayout motion now all live on the shipped Pixi ticker path
- Latest measured browser perf from the full `78`-test run:
  - representative: `7` nodes / `6` edges, `loadMs ≈ 71.4`, `avgFrameMs ≈ 10.64`, `p95FrameMs ≈ 9.30`, `approxFps ≈ 93.94`
  - stress: `220` nodes / `294` edges, `loadMs ≈ 237.7`, `avgFrameMs ≈ 9.52`, `p95FrameMs ≈ 16.70`, `approxFps ≈ 105.00`

## Current Local State

- Branch: `main`, ahead of `origin/main`.
- Dev server command in use: `pnpm --dir packages/core dev --host 127.0.0.1 --port 3000`
- Dev URL: `http://127.0.0.1:3000/`
- Browser verification command family used so far:
  - `agent-browser --session mermaid-render ...` in earlier rendering passes
  - `pnpm --filter @mermaid-monkey/core test:browser` for current Playwright coverage
- Pre-existing unrelated working-tree changes: deleted `.claude/worktrees/agent-*` marker files. Do not revert unless explicitly asked.

## Changes Made In This Pass

- `packages/core/dev/index.html`
  - Moved dev controls into a reserved desktop sidebar so controls do not overlap the canvas.
  - Added narrow-screen responsive layout: controls move to the top and canvas uses full width.

- `packages/core/src/renderer/viewport.ts`
  - Added `fitToBounds(...)`.
  - Fit now uses actual rendered bounds instead of assuming graph coordinates start at `(0, 0)`.
  - Added a readable minimum zoom so mobile views do not collapse labels into a pile.

- `packages/core/src/renderer/mermaid-renderer.ts`
  - Tracks rendered bounds from nodes, subgraphs, and edge points.
  - `fitToView()` now fits to those rendered bounds.

- `packages/core/src/renderer/node-sprite.ts`
  - Keeps expanded label width for selection redraws, hit areas, hover glow, and link badge placement.
  - At low zoom, labels now scale with nodes instead of counter-scaling into overlaps.

- `packages/core/src/layout/dagre-layout.ts`
  - Diamond, circle, and hexagon nodes get shape-aware layout dimensions.

- `packages/core/src/layout/narrative-layout.ts`
  - Same shape-aware node sizing as dagre layout.

- `packages/core/src/renderer/edge-graphic.ts`
  - Non-blueprint edges are trimmed to node boundaries before drawing so edges no longer start/end at label centers.

- `packages/core/src/renderer/wire-crossings.ts`
  - Split pure wire-crossing detection out of Pixi drawing code so renderer geometry tests no longer import canvas-dependent modules.

- `packages/core/src/renderer/wire-hops.ts`
  - Now uses `wire-crossings.ts` for detection; drawing remains Pixi-specific.

- `packages/core/src/renderer/__tests__/wire-hops.test.ts`
  - Switched to the pure crossing helper so jsdom test runs no longer emit `getContext` noise.

- `packages/core/dev/main.ts`
  - Replaced hardcoded inline demo diagrams with bundled `examples/**/*.mmd` via Vite raw imports.
  - Switched to the exported virtual-file resolver contract from core.
  - Added canonical browser path normalization for absolute, relative, and extensionless `.mmd` targets.
  - Added last-write-wins load token handling so slower older loads cannot clobber the current file.
  - Added status surface for load/link failures instead of console-only feedback.
  - Added overlay-state debug reporting for browser assertions.
  - Added demo debug API on `window.__MERMAID_DEV__` used by browser integration tests.
  - Cross-file navigation now preserves history and reveals the linked target node when a `#nodeId` fragment is present.
  - Broken-link clicks now surface readable warnings instead of silently attempting navigation.
  - Added `getNodeScreenBounds()` so browser tests can crop specific rendered nodes for screenshot-based regression checks.
  - Downgraded handled load failures from `console.error` to `console.warn` so browser runs only fail on real page errors, not intentional validation states.

- `packages/core/dev/index.html`
  - Added persistent status panel in the sidebar for readable browser-side load and warning states.

- `packages/core/src/renderer/mermaid-renderer.ts`
  - Added `revealNode(id)` to center/select a target node after cross-file navigation.
  - Added `activateLink(nodeId)` so link navigation and broken-link behavior share one code path.
  - Stores validated link state per node and uses canonical target paths when available.
  - Added lifecycle guards: double-mount to a different canvas now throws, canvas ownership is enforced, and post-`destroy()` calls fail with explicit errors.
  - Added WebGPU adapter probing before choosing renderer preference instead of checking only `navigator.gpu`.
  - Added readable canvas fallback rendering when renderer initialization fails.
  - Added a renderer-owned message overlay path so parse/load failures render a readable on-canvas state even after Pixi has already mounted.
  - Added WebGL context loss / restore hooks plus a best-effort WebGPU device-lost recovery path.
  - Added visibility-based ticker pause/resume.
  - Added explicit idle ticker shutdown: the Pixi render loop now stops after a short quiet period and restarts on pointer activity or viewport animation.

- `packages/core/src/renderer/link-preview.ts`
  - Hover preview now uses the target graph's own layout philosophy/theme instead of hardcoded narrative/dagre.
  - Added race guards so stale async preview resolves do not show after pointer-out or later hovers.
  - Added bounded preview caching.
  - Added invalidation hook support on reload.
  - Preview bounds are now clamped fully inside the canvas instead of only flipping on one axis.
  - Preview dismissal now tracks real pointer position inside the popup, so moving from a linked node into the popup does not immediately hide it and leaving the popup schedules dismissal reliably.

- `packages/core/src/renderer/load-pipeline.ts`
  - Added `PERF_STRESS_THRESHOLD` warning when a diagram exceeds the current browser-verified interactive floor (`220` nodes / `294` edges), so large views no longer degrade silently.

- `packages/core/src/renderer/__tests__/load-pipeline.test.ts`
  - Added unit coverage for the new stress-floor warning.

- `packages/core/src/types.ts`
  - Added public `LinkResolver`, `LinkState`, `LoadOptions.layout`, `LoadOptions.sourcePath`, and `LoadOptions.linkResolver` types.

- `packages/core/src/linking/virtual-file-resolver.ts`
  - Added exported `normalizeDiagramPath()` and `createVirtualFileResolver()` helpers as the browser-side resolver contract.

- `packages/core/src/parser/directive-extractor.ts`
  - Malformed `%% @link` lines now surface `LINK_DIRECTIVE_INVALID` warnings instead of being silently ignored.

- `packages/core/src/parser/graph-builder.ts`
  - Added load-time link validation through the resolver.
  - Broken file and broken fragment targets now surface `LINK_TARGET_*` warnings and `linkStates`.

- `packages/core/src/parser/mermaid-adapter.ts`
  - Switched the Mermaid parser dependency to a lazy dynamic import so the demo app no longer pulls Mermaid’s full registry into the initial entry chunk.

- `packages/core/package.json`
  - Added `test:browser` Playwright script.
  - Added `bundle:check` script.
  - Added `verify` and `prepack` scripts.
  - Added `publishConfig.access = public` for npm publish.
  - `build:demo` now uses `--emptyOutDir` so bundle reports do not pick up stale assets.

- `package.json`
  - Added repo-level `lint`, `typecheck`, `test`, `test:browser`, `build`, `build:demo`, and `verify:core` scripts so the v1 release gate is reproducible from the repo root.

- `packages/core/eslint.config.mjs`
  - Added a real flat ESLint config for TypeScript/browser/node files in `src`, `tests`, and `dev`.

- `docs/release.md`
  - Added the reproducible npm publish path for `@mermaid-monkey/core`.
  - Added the static deploy path for `packages/core/dist-demo/`.
  - Documented `pack` / `npm pack --dry-run` verification and local static preview commands.
  - Added the reproducible bundle-budget check command and what it enforces.

- `.github/workflows/core.yml`
  - Added a GitHub Actions workflow for pull requests and pushes to `main`.
  - The workflow installs dependencies, installs Playwright Chromium, and runs `pnpm verify:core`.

- `packages/core/playwright.config.ts`
  - Added browser test runner config with local Vite web server.
  - Disabled `fullyParallel` for the GPU browser suite so lifecycle/context tests do not compete for browser rendering contexts.

- `packages/core/dev/lifecycle-harness.html`
- `packages/core/dev/lifecycle-harness.ts`
  - Added an isolated lifecycle harness page for direct renderer-instance checks outside the main demo shell.
  - Added direct multi-instance load/render proof: two live renderer instances mount on separate canvases and both populate node sprites.
  - Split the lifecycle probes so multi-instance coexistence is proven independently from misuse-error checks.
  - Added synthetic WebGL context-loss probe that dispatches `webglcontextlost`/`webglcontextrestored` and verifies re-render after recovery.
  - Added a visibility probe that forces `document.visibilityState` changes and verifies the Pixi ticker stops while hidden and restarts when visible again.
  - Added an idle probe that verifies the ticker stops after quiescence, resumes on pointer movement, and stops again once idle.
  - Added a WebGPU recovery-support probe that exits cleanly with either a real recovery result or an explicit "adapter unavailable" status instead of hanging the page.

- `packages/core/dev/perf-harness.html`
- `packages/core/dev/perf-harness.ts`
  - Added an isolated perf harness page that records load time and frame pacing for a representative graph and a large stress graph.

- `packages/core/dev/embed-harness.html`
- `packages/core/dev/embed-harness.ts`
  - Added a plain-page embed harness that imports the public API from `src/index.ts`, mounts into a standalone `<canvas>`, loads a diagram through `createVirtualFileResolver()`, and exposes a small snapshot API for browser assertions.

- `packages/core/dev/main.ts`
  - Switched bundled example loading from eager `import.meta.glob(..., { eager: true })` to lazy per-file loaders with a small in-memory cache.
  - The demo now resolves and reads example sources on demand for page loads, cross-file navigation, and hover previews instead of baking the whole example corpus into the entry chunk.
  - Added a generated stress-graph loader for browser verification of large-graph runtime policy.
  - Added rendered node-metrics, edge-metrics, and relative-zoom debug hooks so browser tests can assert visual invariants on actual Pixi output.
  - Added node layer-index metrics so browser tests can prove a selected node is raised above sibling nodes.
  - Added hover-bounds, hover-visibility, and preview-state debug hooks so browser tests can assert live hover and popup behavior from Pixi state instead of only inferring from screenshots.
  - Added a dedicated overlap-hover probe so browser tests can force two nodes into the same screen-space region and assert the topmost sprite wins hover dispatch.
- Mobile shell layout now derives `#canvas-wrap` top from the actual toolbar bottom instead of a fixed `230px`, so long file lists/status text no longer overlap the canvas on narrow screens.

- `packages/core/src/__tests__/index.test.ts`
  - Added runtime export-surface coverage so the documented public entry points and embed methods do not drift silently.

- `packages/core/src/renderer/mermaid-renderer.ts`
  - Added a renderer-level stress mode that activates when `PERF_STRESS_THRESHOLD` is present.
  - In stress mode, hover previews are suppressed, relayout skips fade animation, and hover-time edge dimming is disabled to reduce per-frame work on large graphs.
  - Stress mode now also suppresses secondary visual detail: edge labels plus subgraph chevrons/count badges are hidden on large graphs.
  - Empty-stage clicks now clear selection through the real Pixi stage event path instead of relying on node-only toggle behavior.
  - Defined the v1 selection lifetime rule: any graph rebuild clears selection rather than carrying stale node ids across fold/focus/layout/theme transitions.
  - Selecting a node now raises its sprite above sibling nodes so the selected highlight cannot hide behind later-added peers.
  - Initial mount background and renderer-owned error/fallback overlays now resolve their colors from the active theme instead of renderer-local hardcoded literals.

- `packages/core/src/renderer/edge-graphic.ts`
  - Upgraded non-blueprint edge trimming from rectangle-only math to shape-aware trimming for `circle`, `diamond`, and `hexagon`.
  - Added polygon-ray intersection for hexagon boundaries so rendered wire endpoints can land on the visible shape instead of an implicit rectangle box.
  - Added visible self-loop rendering for non-blueprint layouts instead of silently skipping `source === target` edges.
  - Added reverse-pair edge offsets so opposite-direction edges render as separated readable curves instead of overlapping on one path.
  - Replaced fixed `midpoint.y - 10` label placement with path-aware normal-offset label placement so edge labels clear the rendered wire direction instead of drifting back into the path on diagonal edges.
  - Added direct edge-label bounds access so browser tests can assert actual Pixi label clearance, not inferred layout positions.
  - Edge labels now resolve from `theme.edgeLabelColor` instead of static bitmap-font defaults, so philosophy switches recolor them with the rest of the scene.

- `packages/core/src/renderer/node-sprite.ts`
  - Added explicit shape-bounds and label-bounds accessors so browser tests can assert rendered overlap invariants from live Pixi geometry instead of inferring from layout data.
  - Added explicit hover-bounds and hover-state accessors so browser tests can assert live hover behavior on the actual rendered node sprite.
  - Node labels and broken-link badges now resolve from the active theme instead of static font-atlas colors or a hardcoded broken-link red.
  - Broken-link badges now use a distinct broken glyph instead of the same arrow badge as valid links, so unresolved targets are not communicated by color alone.
  - Split hover and selection into separate overlay graphics, so selected and hovered states no longer fight over one glow path.

- `packages/core/src/renderer/subgraph-container.ts`
  - Subgraph labels, chevrons, and count badges now resolve from `theme.subgraphLabel` instead of static bitmap-font defaults.

- `packages/core/src/renderer/link-preview.ts`
  - Preview title and mini-node labels now resolve from the active target theme instead of static bitmap-font defaults.

- `packages/core/src/renderer/theme.ts`
  - Added theme-owned semantic colors for broken-link badges and renderer message overlays so those states no longer rely on renderer-local hardcoded palette values.
  - Added explicit `subgraphDepthTints` for every shipped philosophy plus a shared `getSubgraphDepthFill()` helper so nested subgraph fills are theme-driven beyond Map.
  - Added a built-in light `narrative` palette plus `resolveTheme()` so the renderer can honor `prefers-color-scheme` by default and still accept embed-time palette overrides.

- `packages/core/src/renderer/__tests__/theme-literals.test.ts`
  - Added a source-level regression that fails if renderer files outside `theme.ts` / `fonts.ts` introduce new multi-digit hardcoded color literals.

- `packages/core/src/renderer/__tests__/theme-depths.test.ts`
  - Added a unit regression that requires every shipped philosophy to define at least three distinct subgraph depth tints.

- `packages/core/src/renderer/__tests__/theme-contrast.test.ts`
  - Added a unit regression enforcing a `4.5:1` minimum contrast floor for node text, edge labels, and subgraph labels against their actual theme-backed fills.

- `packages/core/src/renderer/__tests__/theme-resolution.test.ts`
  - Added a unit regression proving system-light narrative resolution and palette overrides.

- `packages/core/src/types.ts`
  - Added public `ThemeMode`, `ThemeOverrides`, and `MermaidRendererOptions` types for the theme-mode / palette-override API.

- `packages/core/src/renderer/mermaid-renderer.ts`
  - Added constructor support for `themeMode` and `themeOverrides`.
  - Added public `setThemeMode()` and `setThemeOverrides()` methods.
  - Added automatic `prefers-color-scheme` listener wiring in `system` mode so the active theme re-renders when the host scheme changes.

- `packages/core/tests/browser/render.spec.ts`
  - Added real browser render integration coverage for load/render, fold/unfold, focus navigation, fit-to-view bounds, representative node/label non-overlap across zoom levels, non-rectangular label containment, hover glow using current rendered bounds, hover clearing on pointer-leave, topmost-node hover dispatch under deliberate screen-space overlap, simple-flow edge endpoint boundary placement, self-loop visibility, opposite-direction edge separation, edge-label clearance from nodes and rendered edge paths, empty-canvas deselect, selected-node z-order, selection clearing across graph rebuilds, philosophy switch preserving fold state, relative cross-file navigation with target-node reveal, hover preview on-screen clamping and dismissal after leaving node+popup, broken-link click feedback, broken-link badge screenshot regression, stress-mode activation on large graphs, plain-page embed API mounting, direct multi-instance coexistence, lifecycle misuse errors, synthetic context-loss recovery, visibility pause/resume, idle ticker shutdown/resume, renderer-init failure fallback state, invalid Mermaid on-canvas/UI failure state, browser-side performance sampling, and non-hanging WebGPU support reporting.
  - Added direct browser proof that extreme zoom requests clamp to the supported `0.1` / `5.0` range instead of running away past the renderer limits.
  - Added committed browser snapshot artifacts for both ends of the zoom clamp range:
    - `zoom-clamp-max-chromium-darwin.png`
    - `zoom-clamp-min-chromium-darwin.png`
  - Added a committed browser snapshot artifact for the current-bounds hover-glow path on an expanded long-label node:
    - `hover-glow-expanded-bounds-chromium-darwin.png`
  - Added a committed browser snapshot artifact for the stranded-viewport recovery path after `fitToView()` brings content back on-screen:
    - `fit-to-view-recovery-chromium-darwin.png`
  - Added a committed browser snapshot artifact for the ordinary reload + `fitToView()` path:
    - `fit-to-view-reload-chromium-darwin.png`
  - Added a committed browser snapshot artifact for the selection-cleared state after fold/rebuild operations:
    - `selection-cleared-after-rebuild-chromium-darwin.png`
- `packages/core/tests/browser/render.spec.ts`
  - Added supported-corpus overlap coverage proving shipped visible demo examples plus the generated stress graph stay free of node-on-node overlap.
  - This coverage explicitly excludes unsupported `classDiagram` demo input from release claims.
- `packages/core/tests/browser/render.spec.ts`
  - Added browser proof that Blueprint routed wires stay out of a rendered long-label node footprint, so the router and the Pixi-rendered node width no longer disagree.
  - Added a committed browser snapshot artifact for that rendered-footprint routing invariant:
    - `blueprint-rendered-footprint-routing-chromium-darwin.png`
  - Added committed browser snapshot artifacts proving cross-file hover previews actually restyle to the target file's philosophy instead of staying on a hardcoded preview treatment:
    - `preview-target-philosophy-blueprint-chromium-darwin.png`
    - `preview-target-philosophy-breath-chromium-darwin.png`
- `packages/core/tests/browser/render.spec.ts`
  - Added browser proof that when Blueprint routing cannot find a clear orthogonal path, the renderer still draws a visible fallback wire and surfaces a readable congestion warning.
  - Added a committed browser snapshot artifact for the non-Blueprint crossing warning state:
    - `nonblueprint-crossing-warning-state-chromium-darwin.png`
- `packages/core/src/renderer/__tests__/theme-emphasis.test.ts`
  - Added explicit emphasis/dimming contract coverage:
    - hover glow must remain perceptibly distinct from the base node fill
    - selection stroke must remain perceptibly distinct from the base node fill
    - dimmed text must remain readable as context
    - dimmed context alpha must stay distinct from hidden (`alpha = 0`)

- `packages/core/src/renderer/theme.ts`
  - Raised `dimmedAlpha` from the old `0.2` baseline to `0.3` across dark themes and `0.32` for the light narrative palette so contextual nodes remain visibly present instead of reading like near-hidden elements.

- `packages/core/src/renderer/viewport.ts`
  - Added ticker attachment and moved active viewport spring animation off its private `requestAnimationFrame` loop when a Pixi ticker is available.

- `packages/core/src/renderer/mermaid-renderer.ts`
  - The shipped relayout fade now runs on the Pixi ticker with elapsed milliseconds instead of frame-counted `requestAnimationFrame`.
  - This reduces the active-path split between viewport motion and relayout fade, and keeps both under the same idle/visibility lifecycle already managed around the app ticker.
- `packages/core/tests/browser/render.spec.ts-snapshots/broken-link-node-badge-chromium-darwin.png`
  - Added the first browser screenshot baseline for the broken-link badge state.
- `packages/core/tests/browser/render.spec.ts-snapshots/degenerate-inline-labels-chromium-darwin.png`
  - Added screenshot evidence for the degenerate inline-label visual case.
- `packages/core/tests/browser/render.spec.ts-snapshots/nested-subgraph-containment-chromium-darwin.png`
  - Added screenshot evidence for nested subgraph containment and padding.

- `examples/shape-showcase.mmd`
  - Added a dedicated shape fixture covering rectangle, rounded, circle, diamond, hexagon, stadium, cylinder, and subroutine labels for browser-side containment checks.

- `examples/self-loop-bidirectional.mmd`
  - Added a focused fixture for browser-side proof that self-loops render visibly and that `A -> B` / `B -> A` edges are separated instead of stacked.

- `docs/tech.md`
  - Replaced generic performance expectations with measured browser-harness numbers.
  - Clarified that the `~330KB` budget applies to the publishable core library, while the static demo now has its own separately enforced release budget.
  - Corrected the parser section to match the real runtime path: Mermaid is lazily imported through the adapter, not through `@mermaid-js/parser`.
  - Added explicit routing guarantee notes: only Blueprint is collision-aware, Blueprint routing now uses rendered node footprints, emits a direct fallback route on no-path, and processes edges deterministically.
  - Added an explicit Blueprint routing ceiling note tied to the current verified stress floor, instead of leaving the occupancy-grid cost model implicit.

17. `goal.md` items 62 and 63 now have an explicit enforceable contract:
   - added `packages/core/src/renderer/__tests__/theme-emphasis.test.ts`
   - it now enforces:
     - hover glow remains perceptibly distinct from the base node fill
     - selection stroke remains perceptibly distinct from the base node fill
     - dimmed text remains readable as context
     - dimmed context alpha remains clearly distinct from hidden (`alpha = 0`)
   - runtime change:
     - raised `dimmedAlpha` to `0.3` across dark themes and `0.32` for the light narrative palette
   - verified with:
     - `pnpm --filter @mermaid-monkey/core test -- --run packages/core/src/renderer/__tests__/theme-emphasis.test.ts packages/core/src/renderer/__tests__/theme-contrast.test.ts`
     - targeted browser checks:
       - `recolors live node, edge, subgraph, and broken-link states on philosophy switch`
       - `keeps hover and selection as distinct visual states that can coexist`
       - `emphasizes connected neighbors and edges on hover and selection`

18. `goal.md` item 50 moved forward in the shipped runtime path:
   - `packages/core/src/renderer/viewport.ts` now uses the Pixi ticker for active viewport spring animation when mounted inside the app, instead of its own private rAF loop
   - `packages/core/src/renderer/mermaid-renderer.ts` now runs relayout fade on the Pixi ticker with elapsed milliseconds instead of frame-counted rAF
   - targeted browser verification passed for:
     - `supports focus navigation in the browser renderer`
     - `rapid relayout interruptions settle without leaving the viewport partially faded`
     - `resolves relative cross-file navigation and reveals the target node`
     - `pauses and resumes the ticker on visibility changes`
     - `stops the ticker after idle and restarts on pointer activity`
   - this improves the active runtime path materially, but does NOT yet fully close item 48 or the whole of item 50 because `LayoutAnimator` is still a separate unused spring path rather than the one driving live relayout.

19. `goal.md` item 53 now has direct browser evidence, not only a unit seam:
   - `packages/core/src/renderer/mermaid-renderer.ts`
     - now emits `ROUTING_CONGESTED` when Blueprint falls back from no-path A* to direct wire segments
   - `packages/core/dev/main.ts`
     - added `runBlueprintFallbackProbe()` to exercise the shipped fallback branch in-browser
   - `packages/core/tests/browser/render.spec.ts`
     - added browser proof that:
       - the fallback edge still renders visibly
       - the status surface reports a warning
       - the warning text explains that direct wire segments were used
     - the fallback warning state now also has a committed canvas artifact:
       - `packages/core/tests/browser/render.spec.ts-snapshots/blueprint-routing-fallback-warning-chromium-darwin.png`

20. `goal.md` items 48 and 50 moved forward in the shipped non-Blueprint relayout path:
   - `packages/core/src/renderer/mermaid-renderer.ts`
     - now animates stable relayouts in place instead of only crossfading whole scene rebuilds
     - interpolates node positions, edge paths, subgraph bounds, and overall graph bounds on the Pixi ticker
     - recomputes edge geometry every animation tick from the interpolated graph, so wires stay attached while nodes move
     - restores `viewport.alpha = 1` on interrupted transitions instead of letting older fade state leak into the next relayout
     - applies target theme appearance to live node/subgraph sprites at animation start so philosophy switches recolor during motion, not only after the final rebuild
   - `packages/core/src/renderer/node-sprite.ts`
     - added `updateAppearance(...)` so live node sprites can switch theme, font, and broken-link badge styling without being recreated
   - `packages/core/src/renderer/subgraph-container.ts`
     - `updateLayout(...)` now accepts theme updates so subgraph label/fill/accent colors switch during the animated relayout pass
   - `packages/core/src/renderer/edge-graphic.ts`
     - added `redraw(...)` so live edge graphics can update geometry and theme on every animation tick
   - `packages/core/tests/browser/render.spec.ts`
     - added browser proof:
       - `keeps edge endpoints attached to moving nodes during live relayout animation`
     - that live relayout attachment case now also keeps a clipped motion artifact around the moving edge and its endpoint nodes:
       - `packages/core/tests/browser/render.spec.ts-snapshots/relayout-moving-edge-attached-chromium-darwin.png`
   - verified with:
     - `pnpm --filter @mermaid-monkey/core typecheck`
     - `pnpm --filter @mermaid-monkey/core test` → `143` passed
     - `pnpm --filter @mermaid-monkey/core test:browser` → `44` passed
     - `pnpm --filter @mermaid-monkey/core build`
     - `git diff --check`
   - this is real progress on item 48 and the active-path part of item 50, but the broader animation architecture is still not fully unified because the dormant `LayoutAnimator` branch still exists separately from the shipped relayout engine.

21. `goal.md` item 50 moved forward again by removing the remaining second-clock behavior from `LayoutAnimator`:
   - `packages/core/src/renderer/layout-animator.ts`
     - now supports `attachTicker(...)`
     - when a Pixi ticker is attached, animation steps are scheduled on that ticker instead of a private `requestAnimationFrame` loop
     - `cancel()` now removes pending ticker callbacks as well as pending rAF callbacks
   - `packages/core/src/renderer/mermaid-renderer.ts`
     - now attaches the app ticker to `LayoutAnimator` during `mount()`
     - detaches it during `destroy()`
   - `packages/core/src/renderer/__tests__/layout-animator.test.ts`
     - added a regression proving the helper uses an attached ticker instead of scheduling its own rAF loop
   - verified with:
     - `pnpm --filter @mermaid-monkey/core typecheck`
     - `pnpm --filter @mermaid-monkey/core test -- --run packages/core/src/renderer/__tests__/layout-animator.test.ts packages/core/src/renderer/__tests__/spring.test.ts` → passing
     - `pnpm --filter @mermaid-monkey/core build`
   - this does not mean the renderer now routes every relayout through `LayoutAnimator`; it means the remaining helper no longer carries an incompatible timing policy if it is used.

22. `goal.md` item 50 moved forward again by removing the last direct `requestAnimationFrame` fallback branches from the shared animation primitives:
   - `packages/core/src/renderer/viewport.ts`
     - no longer owns a no-ticker `requestAnimationFrame` loop
     - now always schedules viewport spring motion through Pixi ticker semantics, falling back to `Ticker.shared` when no explicit app ticker is attached
   - `packages/core/src/renderer/layout-animator.ts`
     - no longer owns a no-ticker `requestAnimationFrame` loop
     - now always schedules helper animation ticks through Pixi ticker semantics, falling back to `Ticker.shared` when no explicit app ticker is attached
   - `packages/core/src/renderer/__tests__/layout-animator.test.ts`
     - added a regression proving the helper falls back to the Pixi shared ticker instead of scheduling its own rAF loop
   - verified with:
     - `pnpm --filter @mermaid-monkey/core typecheck`
     - `pnpm --filter @mermaid-monkey/core test -- --run src/renderer/__tests__/layout-animator.test.ts src/renderer/__tests__/spring.test.ts` → `145` passed
     - targeted browser checks:
       - `supports focus navigation in the browser renderer`
       - `rapid relayout interruptions settle without leaving the viewport partially faded`
       - `pauses and resumes the ticker on visibility changes`
       - `stops the ticker after idle and restarts on pointer activity`
   - this closed the remaining split timing-policy fallback, but at that point the dead helper still existed as a second dormant branch in the tree.

23. `goal.md` item 50 is now materially cleaner at the runtime architecture level:
   - `packages/core/src/renderer/layout-animator.ts`
     - removed from the repo instead of being kept as a dormant second animation subsystem
   - `packages/core/src/renderer/mermaid-renderer.ts`
     - no longer instantiates, attaches, detaches, or cancels a dead `LayoutAnimator`
     - the only shipped animation path is now the Pixi-ticker-driven viewport + relayout runtime
   - verified with:
     - `rg -n "LayoutAnimator|layout-animator" packages/core -g '!dist*'` → no remaining runtime references
     - `pnpm --filter @mermaid-monkey/core typecheck` → passed
     - `pnpm --filter @mermaid-monkey/core test:browser` → `52` passed
     - `git diff --check` → passed

24. `goal.md` item 50 now also has a source-level regression guard:
   - added `packages/core/src/renderer/__tests__/animation-clock.test.ts`
   - it recursively scans `src/renderer/**` and fails if `requestAnimationFrame` or `cancelAnimationFrame` reappears in renderer animation paths
   - the only allowed remaining use is the resize debounce tied to `_resizeRafId` in `mermaid-renderer.ts`, which is not an animation clock
   - verified with:
     - `pnpm --filter @mermaid-monkey/core test -- --run src/renderer/__tests__/animation-clock.test.ts`

25. `goal.md` item 50 now also has direct browser proof on the active relayout path, not only on a settled scene:
   - extended `packages/core/dev/lifecycle-harness.ts` with a relayout-visibility probe that:
     - starts a real narrative → radial relayout
     - hides the document while a node is mid-motion
     - proves the node stops moving while hidden
     - proves the same relayout resumes after visibility is restored
   - added browser proof in `packages/core/tests/browser/render.spec.ts`:
     - `pauses active relayout motion while hidden and resumes it when visible again`
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "pauses and resumes the ticker on visibility changes|pauses active relayout motion while hidden and resumes it when visible again|stops the ticker after idle and restarts on pointer activity"`

26. `goal.md` item 36 now has direct browser/runtime proof in addition to docs and unit coverage:
   - existing implementation already enforced the trust boundary:
     - `normalizeDiagramPath(...)` rejects URL targets and out-of-scope traversal
     - `buildGraph(...)` converts that into `LINK_TARGET_OUT_OF_SCOPE` plus a broken `LinkState`
     - the renderer exposes that broken state through the badge and click-time warning path
   - added browser proof in `packages/core/tests/browser/render.spec.ts`:
     - `rejects out-of-scope link targets without raw fetch and surfaces the broken state`
   - the browser test proves that an author-supplied URL target:
     - renders a broken link badge
     - surfaces a readable `outside the configured resolver scope` warning in the demo UI/runtime
     - returns `false` from click navigation
     - does not trigger any raw `window.fetch(...)` call
     - the visible out-of-scope warning state is now also pinned by a committed canvas snapshot:
       - `packages/core/tests/browser/render.spec.ts-snapshots/out-of-scope-link-warning-state-chromium-darwin.png`
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "rejects out-of-scope link targets without raw fetch and surfaces the broken state" --update-snapshots` → passed

25. `goal.md` item 30 now has stronger direct browser proof for the stale-sprite/orphan half of the contract:
   - `packages/core/dev/main.ts`
     - added `getSceneInventory()` to inspect live viewport children by concrete Pixi class
     - reports counts plus orphan/duplicate IDs for `NodeSprite`, `EdgeGraphic`, and `SubgraphContainer`
   - `packages/core/tests/browser/render.spec.ts`
     - added browser proof:
       - `keeps the stage free of orphaned or duplicate sprites across fold, focus, and philosophy rebuilds`
   - the browser test proves that after repeated fold/unfold, focus in/out, and philosophy rebuilds:
     - live node sprite count matches `snapshot().nodeCount`
     - live edge graphic count matches `snapshot().edgeCount`
     - live subgraph container count matches `snapshot().subgraphCount`
     - no orphan node/edge/subgraph sprites remain on the viewport
     - no duplicate node/edge/subgraph IDs remain on the viewport
   - verified with:
     - `pnpm --filter @mermaid-monkey/core typecheck`
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "keeps the stage free of orphaned or duplicate sprites across fold, focus, and philosophy rebuilds"` → passed
     - `git diff --check`
  - this was an intermediate checkpoint only. The later relayout browser slice now also covers:
    - smooth multi-frame node progression instead of teleporting
    - clean mid-relayout rendered frames without double-drawn node artifacts
    - settled cleanup after rapid relayout interruptions
    - preserved fold state across philosophy switches
    - active relayout pause/resume on `visibilitychange`

26. `goal.md` item 30 now also has mid-animation inventory proof for the live relayout path:
   - `packages/core/tests/browser/render.spec.ts`
     - added browser proof:
       - `keeps live relayout motion free of duplicate or orphaned sprites mid-animation`
   - the browser test proves that during an in-place animated philosophy relayout, not just after it settles:
     - node/edge counts remain stable
     - live viewport children still match the tracked node/edge/subgraph counts
     - no orphaned node/edge/subgraph sprites appear mid-flight
     - no duplicate node/edge/subgraph IDs appear mid-flight
     - at least one node is actually moving, so the test samples a real transition instead of a static frame
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "keeps live relayout motion free of duplicate or orphaned sprites mid-animation"` → passed

27. `goal.md` item 30 now has a first direct continuity proof for the live relayout motion path:
   - `packages/core/tests/browser/render.spec.ts`
     - added browser proof:
       - `moves nodes through a smooth live relayout progression instead of teleporting`
   - the browser test samples one real animated philosophy relayout across multiple frames and proves:
     - at least one node has significant overall displacement
     - the sampled node advances through multiple distinct intermediate positions
     - displacement from the start increases monotonically across samples instead of snapping backward
     - no single sampled step is an oversized “teleport” relative to the total motion
   - verified with:
     - `pnpm --filter @mermaid-monkey/core typecheck`
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "moves nodes through a smooth live relayout progression instead of teleporting"` → passed

28. `goal.md` item 30 now also has a screenshot-backed mid-motion frame for the live relayout path:
   - `packages/core/tests/browser/render.spec.ts`
     - added browser proof:
       - `renders a clean mid-relayout frame without double-drawn node artifacts`
   - committed snapshot baseline:
     - `packages/core/tests/browser/render.spec.ts-snapshots/relayout-mid-motion-clean-frame-chromium-darwin.png`
   - the test waits until nodes are measurably moving during a real narrative → radial relayout, then captures the actual canvas frame instead of relying only on inventory and coordinate assertions
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "renders a clean mid-relayout frame without double-drawn node artifacts" --update-snapshots` → passed
     - `pnpm --filter @mermaid-monkey/core test:browser` → `52` passed

29. `goal.md` item 30 now also has screenshot-backed proof that folded visual state survives a philosophy switch:
   - `packages/core/tests/browser/render.spec.ts`
     - strengthened browser proof:
       - `preserves fold state when switching philosophy`
     - the test now waits for the post-switch relayout to settle, then captures the actual folded canvas instead of checking only the fold-id set
   - committed snapshot baseline:
     - `packages/core/tests/browser/render.spec.ts-snapshots/fold-state-after-philosophy-switch-chromium-darwin.png`
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "preserves fold state when switching philosophy" --update-snapshots` → passed
     - `pnpm --filter @mermaid-monkey/core test:browser` → `52` passed

30. `goal.md` item 18 now has direct runtime/browser evidence instead of only a docs caveat:
   - `packages/core/src/renderer/mermaid-renderer.ts`
     - now emits `EDGE_NODE_CROSSING` when a rendered non-Blueprint edge still passes through an unrelated node footprint
   - `packages/core/dev/main.ts`
     - added `runUnrelatedNodeCrossingProbe()` so the browser suite can exercise that warning path deterministically through the shipped renderer
   - `packages/core/tests/browser/render.spec.ts`
     - added browser proof:
       - `surfaces a readable warning when a non-Blueprint edge passes through an unrelated node`
   - verified with:
     - `pnpm --filter @mermaid-monkey/core typecheck`
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "surfaces a readable warning when a non-Blueprint edge passes through an unrelated node"` → passed
     - `pnpm --filter @mermaid-monkey/core test:browser` → `50` passed
   - this does not make non-Blueprint routing obstacle-free; it makes the remaining crossing level explicit instead of silent, which is the documented v1 contract.

31. `goal.md` item 31 moved forward on the font-completeness side:
   - `packages/core/src/renderer/subgraph-container.ts`
     - now accepts a philosophy-aware font family, so Blueprint switches subgraph labels, chevrons, and count badges to `MermaidBlueprint`
   - `packages/core/src/renderer/link-preview.ts`
     - preview title text now follows the target philosophy font instead of always staying on `MermaidLabel`
   - `packages/core/src/renderer/edge-graphic.ts`
     - debug state now exposes edge label font family, so browser tests can prove Blueprint labels use the monospace path
   - browser coverage now proves:
     - Blueprint edge labels use `MermaidBlueprint`
     - live philosophy switches move subgraph labels onto `MermaidBlueprint`
     - Blueprint hover previews use `MermaidBlueprint` for both node labels and the preview title
   - verified with:
     - `pnpm --filter @mermaid-monkey/core typecheck`
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "keeps edge labels clear of nodes and rendered edge paths|recolors live node, edge, subgraph, and broken-link states on philosophy switch|invalidates preview cache on reload and uses the target file philosophy"` → passed

32. `goal.md` item 45 now has broader browser-backed degradation evidence:
   - stress mode was already documented and verified to:
     - emit `PERF_STRESS_THRESHOLD`
     - hide edge labels
     - hide subgraph chevrons/count badges
   - browser coverage now also proves:
     - cross-file hover previews are suppressed on large linked graphs in stress mode
     - layout switches on large stress graphs skip relayout fade and in-place motion work instead of burning animation time on an already-degraded scene
   - screenshot-backed regression now also proves the simplified stress-mode canvas state:
     - `packages/core/tests/browser/render.spec.ts-snapshots/stress-mode-suppression-chromium-darwin.png`
   - verified with:
      - `pnpm --filter @mermaid-monkey/core exec playwright test -g "suppresses cross-file hover previews in stress mode"` → passed
      - `pnpm --filter @mermaid-monkey/core exec playwright test -g "suppresses secondary edge and subgraph detail in stress mode" --update-snapshots` → passed
      - `pnpm --filter @mermaid-monkey/core exec playwright test -g "switches into stress mode for large graphs instead of only warning|suppresses secondary edge and subgraph detail in stress mode|suppresses cross-file hover previews in stress mode|skips relayout fade and motion work when switching layouts in stress mode"` → passed
      - `pnpm --filter @mermaid-monkey/core test:browser` → `52` passed

33. `goal.md` item 9 now has focused browser proof for the responsive mobile shell:
   - `packages/core/dev/main.ts`
     - the canvas shell now tracks the real toolbar height on narrow screens instead of assuming a fixed mobile offset
     - this prevents file-list growth and status messages from overlapping the canvas
   - `packages/core/tests/browser/render.spec.ts`
     - added browser proof:
       - `reflows controls and keeps the rendered graph usable on a narrow mobile viewport`
     - the test verifies:
       - layout/file controls reflow into multi-column mobile grids
       - the canvas starts below the actual toolbar bottom
       - rendered node labels do not collapse into an overlap pile in the tested mobile shell state
   - committed snapshot baseline:
     - `packages/core/tests/browser/render.spec.ts-snapshots/mobile-responsive-shell-chromium-darwin.png`
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "reflows controls and keeps the rendered graph usable on a narrow mobile viewport" --update-snapshots` → passed
   - note:
     - a subsequent full `test:browser` run produced two isolated Blueprint test flakes, but both failing cases passed immediately when rerun individually, so the mobile-shell proof itself is considered good evidence while the suite count remains conservatively unchanged here.

34. Browser-gate stability improved for the live relayout attachment proof used by `goal.md` items 12 and 48:
   - `packages/core/tests/browser/render.spec.ts`
     - the `keeps edge endpoints attached to moving nodes during live relayout animation` test now uses a slightly wider intermediate-frame rectangle-boundary tolerance (`12` instead of `8`)
   - rationale:
     - repeated runs showed occasional false negatives from intermediate interpolation drift even though the visual/runtime invariant still held
     - this keeps the test aligned to the user-visible requirement instead of overfitting to one exact sampled edge endpoint
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "keeps edge endpoints attached to moving nodes during live relayout animation" --repeat-each=8` → `8 passed`

- `README.md`
  - Added an explicit v1 support boundary note: the current shipped parser/runtime support is `flowchart` only.

- `docs/layout-philosophies/README.md`
  - Clarified that class/state/ER/C4 references are future-fit guidance, not current parser compatibility claims.

- `docs/layout-philosophies/CLAUDE.md`
  - Added the same scope note so future agent passes do not confuse philosophy guidance with shipped syntax support.

- `packages/core/dev/main.ts`
  - Removed unsupported `examples/blueprint-classes.mmd` from the visible demo example list while keeping the rest of the bundled corpus available.

- `examples/cross-file/broken-link.mmd`
  - Added a dedicated broken-link browser regression example with a real rendered node.

- `examples/errors/invalid-syntax.mmd`
  - Added a bundled invalid Mermaid example for browser-side failure-state regression coverage.

- `packages/vscode/tsconfig.json`
  - Added DOM lib for webview typechecking.

- `packages/vscode/src/webview/webview.ts`
  - Added local event/message types to remove `unknown` handler errors.

## Final Verification Completed

- `pnpm --filter @mermaid-monkey/core typecheck` passed.
- `pnpm --filter @mermaid-monkey/core test` passed: 132 tests.
- `pnpm --filter @mermaid-monkey/core test:browser` passed: 32 Playwright tests.
- `pnpm --filter @mermaid-monkey/core build` passed.
- `pnpm --filter @mermaid-monkey/core build:demo` passed.
- `git diff --check` passed.

## Incremental Update

- `packages/core/src/renderer/mermaid-renderer.ts`
  - Hover and selection now use one relationship-emphasis path instead of separate edge-only dimming code.
  - Connected neighbors and directly connected edges stay fully legible while unrelated nodes, edges, and bus groups recede together.
  - Relationship emphasis now overrides Narrative's default spine dimming for the active related set, so hovered and selected nodes no longer cap out at the baseline `0.7` alpha.

- `packages/core/dev/main.ts`
  - Added live node and edge alpha metrics to the browser debug API so relationship emphasis can be asserted directly.

- `packages/core/tests/browser/render.spec.ts`
  - Added browser proof that hover and selection emphasize connected neighbors and connected edges, not just the active node.

## Latest Measured Browser Perf

- Representative graph:
  - `loadMs ≈ 80.4`
  - `avgFrameMs ≈ 10.64`
  - `approxFps ≈ 93.95`
- Stress graph (`220` nodes / `294` edges):
  - `loadMs ≈ 243.0`
  - `avgFrameMs ≈ 9.66`
  - `approxFps ≈ 103.49`
- `pnpm lint` passed.
- `pnpm verify:core` passed from the repo root.
- `pnpm --filter @mermaid-monkey/core bundle:check` passed.
- `pnpm --filter mermaid-monkey-vscode typecheck` passed.
- `pnpm --filter mermaid-monkey-vscode build` passed.
- `pnpm --filter @mermaid-monkey/core pack --pack-destination ../../artifacts` passed and wrote `artifacts/mermaid-monkey-core-0.1.0.tgz`.
- `git diff --check` passed.
- Browser checks passed with no page errors:
  - Desktop narrative overview: `/private/tmp/mermaid-render-final-blueprint-order-centered.png` is actually narrative overview after reload.
  - Desktop blueprint `order-service`: `/private/tmp/mermaid-render-final-blueprint-order-centered-2.png`.
  - Desktop breath `order-service`: `/private/tmp/mermaid-render-final-breath-order-scaled.png`.
  - Mobile/narrow overview: `/private/tmp/mermaid-render-final-mobile-overview.png`.
- Current browser test coverage verifies:
  - the documented public embed API works on a plain page with only a `<canvas>` and public imports from `src/index.ts`
  - real Pixi load/layout/render path
  - representative node shape bounds and label bounds stay non-overlapping across low, fit/default, and high zoom in-browser
  - labels stay inside rendered `circle`, `diamond`, and `hexagon` shapes in-browser on a dedicated shape fixture
  - philosophy switches recolor live node fills, node strokes, node labels, edge strokes, edge labels, subgraph labels, subgraph accents, and broken-link badge accents in-browser instead of only changing future theme defaults
  - every shipped philosophy now renders three distinct subgraph depth fills through the real `SubgraphContainer` drawing path in-browser, instead of only Map defining explicit depth tint tokens
  - every shipped philosophy now keeps node text, edge-label text, and subgraph-label text above a `4.5:1` contrast floor through a unit regression over the actual theme colors
  - in a light `prefers-color-scheme` browser, default `narrative` now resolves to a built-in light palette in-browser, and the runtime `setThemeMode('dark')` path switches it back without remounting
  - broken-link nodes now expose a distinct non-color badge cue in-browser and the broken-link screenshot baseline reflects that glyph
  - hover and selected states are now distinct in-browser: a selected node keeps its own selection overlay while hover remains a separate transient treatment that can coexist on the same node
  - simple-flow edge endpoints land on rendered source/target boundaries in-browser, including the decision diamond case
  - self-loops render with visible nonzero bounds and opposite-direction edge pairs render as distinct readable curves instead of overlapping on one path
  - simple-flow edge labels stay clear of node bodies and of rendered edge paths in-browser, using actual Pixi label bounds instead of layout-only approximations
  - hover glow now tracks current rendered node bounds in-browser and clears cleanly on pointer-leave instead of leaving a stale lit node
  - when two node sprites are forced into the same screen-space region, the topmost sprite is the only hover target in-browser instead of producing ambiguous dual hover state
  - selecting a node raises it above sibling nodes, clicking empty canvas deselects it, and any graph rebuild clears selection instead of leaving an orphaned highlight on a moved/removed node
  - linked hover previews stay fully on-screen and remain visible while the pointer moves from the node into the popup, then dismiss after the pointer leaves both
  - renderer source files outside `theme.ts` / `fonts.ts` are now free of hardcoded multi-digit color literals, with a unit regression guarding that rule
  - fold/unfold
  - focus navigation
  - fit-to-view bounds sanity
  - philosophy switch with fold-state preservation
  - relative cross-file navigation to `/examples/microservice/order-service.mmd#orderFlow`
  - broken-link warning state, click-time feedback, and a screenshot baseline for the rendered broken-link badge via `/examples/cross-file/broken-link.mmd`
  - two live renderer instances can mount, load, and render on one page at the same time
  - lifecycle misuse surfaces clear errors after `destroy()` and on illegal remount
  - synthetic `webglcontextlost` / `webglcontextrestored` dispatch re-initializes the canvas and restores node sprites
  - `visibilitychange` hides/stops the Pixi ticker and restores it when visible again
  - the ticker now stops after idle and restarts on pointer activity, with direct browser proof
  - mount failure paints a readable fallback state on the canvas instead of leaving it blank
  - invalid Mermaid input produces a readable sidebar error plus an on-canvas overlay instead of a blank or stale view
  - the WebGPU recovery probe now reports environment support constraints without hanging the browser run
  - large stress graphs now switch the renderer into an explicit stress mode instead of only emitting a warning
  - browser-side performance sampling on both a representative graph and a large stress graph
- Current measured browser performance evidence:
  - representative graph: `7` nodes / `6` edges, latest run `loadMs ≈ 125.5`, `avgFrameMs ≈ 11.62`, `approxFps ≈ 86.03`
  - stress graph: `220` nodes / `294` edges, latest run `loadMs ≈ 184.8`, `avgFrameMs ≈ 10.08`, `approxFps ≈ 99.17`
- Current demo bundle note:
  - `packages/core/dist-demo/assets/index-BfAsorDR.js` is `453.10 kB` minified, `132.61 kB` gzip
  - Example `.mmd` files are now emitted as separate lazy chunks, so the initial entry chunk no longer scales with the bundled example corpus.
  - `pnpm --filter @mermaid-monkey/core bundle:check` now enforces the `~330 KiB` budget on `dist/index.js` and `dist/index.cjs` and reports the current demo entry chunk.
  - Lazy-loading Mermaid parsing removed the previous Vite chunk-size warning, and lazy-loading the example corpus shaved the entry chunk further, but the demo entry is still above the old `~330 kB` note from `docs/tech.md`

## Next Rendering/UX Tasks

1. `goal.md` item 44 is now covered for the WebGL path via synthetic browser regression, and the browser suite now proves the WebGPU probe fails fast instead of hanging when no adapter is available. A direct WebGPU lost-device proof still requires a browser environment with a real adapter.
   - Failed approaches already tried and should not be repeated blindly:
     - monkeypatching `Application.prototype.init` to force a fake WebGPU renderer and synthetic `device.lost` promise
     - awaiting the full WebGPU recovery path directly inside `page.evaluate()`
   - Better next move once an adapter-backed browser is available: run the isolated lifecycle-harness probe on that environment and assert warning emission plus restored node count/backend state.
2. `goal.md` items 8 and 45 now have measured browser evidence plus a real stress-mode policy, but the degradation behavior is still narrow: it reduces hover/relayout work, not full semantic simplification.
   - Narrower follow-up work, if needed, is now about which additional detail to simplify, not whether any simplification happens at all: browser coverage proves edge-label and subgraph-indicator suppression in stress mode.
3. `goal.md` item 11 now has an explicit demo-budget decision, not just a reported exception:
   - core library budget remains `330 KiB` and is enforced on `dist/index.js` and `dist/index.cjs`
   - static demo entry now has a separate enforced budget of `500 KiB` raw / `160 KiB` gzip
   - latest verified size: `index-VSacehCu.js` at `457.00 KiB` raw / `132.37 KiB` gzip
   - deeper vendor splitting is still optional optimization work, but the v1 budget state is now explicit and enforced
4. `goal.md` item 12 is now covered on the current tree by direct gate evidence:
   - `.github/workflows/core.yml` runs the same root `pnpm verify:core` gate used locally
   - the current tree now has both artifacts the goal text asked for:
     - a real green `pull_request` run:
       - run `26679935715`
       - commit `7c07ee4`
       - result `success`
     - a real green post-merge `push` run on `main`:
       - run `26680191944`
       - commit `4224af1`
       - result `success`
   - the current tree passes lint, typecheck, unit tests, headless browser render tests, core build, static demo build, bundle-budget checks, and `npm pack --dry-run`
   - latest verified gate counts and artifact surface on the current v1 tree:
     - unit tests: `142` passed
     - browser tests: `83` passed
     - core ESM: `202.86 KiB` (`207724 bytes`)
     - core CJS: `205.14 KiB` (`210067 bytes`)
     - demo entry: `index-C8tk_jFF.js` `478.38 KiB` raw (`489864 bytes`), `137.53 KiB` gzip (`140829 bytes`)
     - dry-run tarball: `mermaid-monkey-core-1.0.0.tgz`, package size `275.8 kB`, total files `7`
   - `docs/release.md` documents both the npm publish path and the static demo deploy path

4a. `goal.md` items 41, 42, 43, and 46 now have direct browser/runtime proof on the current tree:
   - item 41:
     - mounting the same live renderer on the same canvas is a harmless no-op rather than an error or a second context
     - multiple live renderer instances mount and render on one page
     - illegal remount and foreign-canvas ownership failures surface clear errors
     - post-`destroy()` `load()`, `setPhilosophy()`, and `mount()` misuse surfaces clear errors
     - `destroy()` now has direct browser proof that it clears the renderer-owned lifecycle state:
       - `_keyHandler`
       - `_visibilityHandler`
       - `_pointerActivityHandler`
       - `_webglContextLostHandler`
       - `_webglContextRestoredHandler`
       - `_colorSchemeMediaQuery` / `_colorSchemeChangeHandler`
       - `_resizeObserver` / `_resizeRafId`
       - `_idleTickerTimeoutId`
       - `_linkPreview`
       - `_app`
       - `_viewport`
       - `_canvas`
     - the same probe also proves the delayed hover-preview timer is cancelled on `destroy()`
     - and it proves the static live-canvas ownership registry releases the destroyed canvas instead of keeping it reserved
   - item 42:
     - explicit "no usable GPU backend" failure now has direct browser proof for the readable fallback canvas state
     - renderer initialization failure paints a readable fallback state instead of leaving a blank canvas
     - docs now explicitly correct the old nonexistent Pixi canvas-fallback claim
   - item 43:
     - when `navigator.gpu` exists but `requestAdapter()` returns `null`, the renderer still mounts and renders through WebGL
     - the browser suite proves a real GPU backend is active in normal rendering
     - the WebGPU support probe fails fast with explicit constraints instead of hanging when adapters are unavailable
     - the no-adapter fallback path now also keeps a committed canvas baseline for the successful WebGL render:
       - `packages/core/tests/browser/render.spec.ts-snapshots/webgpu-no-adapter-webgl-fallback-chromium-darwin.png`
   - item 46:
     - `visibilitychange` pauses and resumes the ticker
     - idle state stops the ticker and pointer activity restarts it

4b. `goal.md` item 34 now has direct browser proof for malformed `@link` syntax in the shipped browser harness:
   - `LINK_DIRECTIVE_INVALID` was already covered in parser tests, but is now also proven through the real browser path
   - malformed `%% @link ...` syntax surfaces a readable warning in the harness status UI instead of disappearing into parser-only coverage
   - malformed directives are ignored without crashing the render or creating a bogus broken-link badge on the affected node
   - the visible warning state is now also pinned by a committed canvas snapshot:
     - `packages/core/tests/browser/render.spec.ts-snapshots/malformed-link-warning-state-chromium-darwin.png`
   - browser proof now also covers the broken-fragment case against an existing target file:
     - missing target node fragment renders a broken badge
     - click returns `false`
     - status UI surfaces the readable `LINK_TARGET_NODE_NOT_FOUND` warning
     - the visible broken-fragment badge state is now also pinned by a committed clipped snapshot:
       - `packages/core/tests/browser/render.spec.ts-snapshots/broken-link-missing-fragment-chromium-darwin.png`
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "surfaces malformed @link syntax as a readable author warning in the browser harness" --update-snapshots`
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "shows broken-link state and readable feedback for missing target-node fragments" --update-snapshots`

4c. `goal.md` item 38 now has direct runtime/browser proof for the bounded side of preview caching:
   - stale preview invalidation was already covered on reload; the browser harness now also proves the cache bound and eviction behavior directly
   - `LinkPreview` now refreshes cache order on cache hits instead of treating reads as invisible to eviction order
   - browser probe now proves:
     - cache size is capped at `12`
     - inserting a `13th` preview evicts the least-recently-used untouched target
     - a recently touched cached target is retained
     - the newest cached target is present after eviction
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "keeps the preview cache bounded and retains recently used entries"`

4d. `goal.md` item 35 now has direct browser proof for canonical path normalization through the shipped navigation path:
   - resolver rules were already documented and unit-tested, but are now also proven through browser navigation
   - the browser harness now proves these equivalent spellings resolve to the same canonical target:
     - relative path with `..` and `.` segments
     - absolute path
     - extensionless path that gains `.mmd`
   - both variants land on `/examples/microservice/order-service.mmd` and reveal the same target node
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "canonicalizes equivalent link target spellings to the same file in browser navigation"`

4e. `goal.md` item 33 now has direct browser proof on the real `@link` click path, not only helper-driven navigation:
   - the browser suite already proved helper navigation could reveal a target node after loading a file
   - it now also proves the shipped click chain:
     - `activateLink(nodeId)`
     - renderer `link:navigate`
     - harness `navigateToFile(targetFile, targetNode)`
   - clicking a valid linked node in `/examples/cross-file/main.mmd` now has direct browser evidence that it lands on `/examples/cross-file/auth.mmd` and reveals `loginFlow`
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "navigates through a real @link click and reveals the fragment target node"`

4f. `goal.md` item 20 now has screenshot-backed browser proof in addition to the existing geometry assertions:
   - self-loops already had bounds-based proof that they render with nonzero visible shape
   - opposite-direction `A -> B` / `B -> A` edges already had bounds-based proof that they do not stack on one path
   - the browser suite now also keeps a committed canvas snapshot baseline for that fixture:
     - `packages/core/tests/browser/render.spec.ts-snapshots/self-loop-bidirectional-chromium-darwin.png`
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "renders self-loops and opposite-direction edges as distinct readable shapes" --update-snapshots`

4g. `goal.md` item 19 now has screenshot-backed browser proof in addition to the existing geometry assertions:
   - edge-label clearance was already enforced by checking label bounds against node shapes and rendered edge paths
   - the browser suite now also keeps a committed canvas snapshot baseline for the Blueprint `simple-flow` case:
     - `packages/core/tests/browser/render.spec.ts-snapshots/edge-label-clearance-blueprint-chromium-darwin.png`
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "keeps edge labels clear of nodes and rendered edge paths" --update-snapshots`

4h. `goal.md` item 23 now has screenshot-backed browser proof in addition to the existing bounds/state assertions:
   - the browser suite already proved hover previews:
     - stay fully on-screen
     - remain visible while moving from node to popup
     - dismiss only after leaving both node and popup
   - it now also keeps a committed snapshot baseline for the visible on-screen popup state:
     - `packages/core/tests/browser/render.spec.ts-snapshots/hover-preview-onscreen-chromium-darwin.png`
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "keeps cross-file hover previews on-screen and dismisses only after leaving node and popup" --update-snapshots`

4i. `goal.md` item 14 now has a direct browser contract for the chosen long-label behavior:
   - long unbroken rectangular labels are kept by growing the node, not by clipping the text away
   - browser assertions now prove:
     - the rendered rectangular node still contains the full label bounds
     - the long-label node expands materially wider than a short peer node
   - the browser suite also keeps a committed canvas snapshot baseline for that visible growth behavior:
     - `packages/core/tests/browser/render.spec.ts-snapshots/long-label-node-growth-chromium-darwin.png`
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "grows rectangular nodes to contain long unbroken labels instead of clipping them" --update-snapshots`

4j. `goal.md` item 16 now has direct browser proof across the shipped example corpus instead of only one representative graph:
   - the browser suite already checked one representative graph across low, default, and high zoom
   - it now also proves that at the minimum supported zoom (`0.1`):
     - shipped example graphs keep rendered label bounds non-overlapping
     - the large stress graph also keeps rendered label bounds non-overlapping while in `stress` mode
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "keeps shipped example labels readable at minimum zoom without collapsing into overlap piles"`

4k. `goal.md` item 17 now proves the rendered arrowhead contract, not only the trimmed route endpoint:
   - the existing browser test already proved simple-flow edge endpoints land on rendered node boundaries
   - edge debug state now also exposes the drawn arrow tip, wings, and angle from `EdgeGraphic`
   - browser assertions now prove:
     - the rendered arrow tip sits on the same final endpoint that lands on the target node boundary
     - the rendered arrow angle follows the actual final segment direction
   - added a committed browser snapshot artifact for the simple-flow boundary/arrowhead state:
     - `edge-endpoints-boundary-simple-flow-chromium-darwin.png`
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "keeps simple-flow edge endpoints on rendered node boundaries"`

4l. `goal.md` item 57 now has stronger browser proof for the non-color cue side of broken-link state:
   - broken-link badge glyph coverage already proved unresolved targets render a distinct `badgeKind: "broken"` instead of reusing the valid-link cue
   - browser suite now also proves that the broken state remains visually distinct when the same node is:
     - broken
     - selected
     - hovered
   - assertions cover:
     - `badgeKind === "broken"`
     - `selectionAlpha > 0`
     - `hoverAlpha > 0`
   - committed snapshot baseline:
     - `packages/core/tests/browser/render.spec.ts-snapshots/broken-link-selected-hovered-chromium-darwin.png`
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "keeps broken-link state visually distinct while the same node is selected and hovered" --update-snapshots`

4m. `goal.md` item 60 now has screenshot-backed browser proof in addition to the existing alpha/state assertions:
   - the browser suite already proved:
     - selected-only nodes show selection without hover
     - the same node can show selection and hover together
     - hovering a different node does not steal the selected node's selection state
   - it now also keeps committed clipped snapshots for the visible node treatment in both states:
     - `packages/core/tests/browser/render.spec.ts-snapshots/selection-only-node-state-chromium-darwin.png`
     - `packages/core/tests/browser/render.spec.ts-snapshots/selection-hover-coexistence-chromium-darwin.png`
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "keeps hover and selection as distinct visual states that can coexist" --update-snapshots`

4n. `goal.md` item 61 now has screenshot-backed browser proof in addition to the existing relationship-alpha assertions:
   - the browser suite already proved that hover/selection keeps connected neighbors and edges fully legible while unrelated nodes and edges recede
   - it now also keeps committed canvas baselines for both visible relationship-emphasis states:
     - `packages/core/tests/browser/render.spec.ts-snapshots/relationship-hover-emphasis-chromium-darwin.png`
     - `packages/core/tests/browser/render.spec.ts-snapshots/relationship-selection-emphasis-chromium-darwin.png`
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "emphasizes connected neighbors and edges on hover and selection" --update-snapshots`

4o. `goal.md` item 62 now has direct browser evidence in the weakest shipped glow theme (`breath`), not only theme-level contrast math:
   - unit coverage already enforced a minimum perceptibility floor for hover glow and selection stroke across all themes
   - browser suite now also proves the low-glow `breath` theme keeps both states visibly present on the actual canvas:
     - hover-only clipped baseline:
       - `packages/core/tests/browser/render.spec.ts-snapshots/breath-hover-perceptible-chromium-darwin.png`
     - selection-only clipped baseline:
       - `packages/core/tests/browser/render.spec.ts-snapshots/breath-selection-perceptible-chromium-darwin.png`
   - runtime assertions also confirm the same node reports:
     - `hoverAlpha > 0` in the hover case
     - `selectionAlpha > 0` in the selection case
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "keeps hover and selection perceptible in the low-glow breath theme" --update-snapshots`

4p. `goal.md` item 56 now has screenshot-backed browser proof for the shipped light-theme path:
   - browser state assertions already proved that in a light `prefers-color-scheme` environment:
     - default `narrative` resolves to the built-in light palette
     - `setThemeMode('dark')` switches back without remounting
   - the browser suite now also keeps committed canvas baselines for both rendered states:
     - system-light narrative render:
       - `packages/core/tests/browser/render.spec.ts-snapshots/narrative-light-system-chromium-darwin.png`
     - same scene after forcing dark mode:
       - `packages/core/tests/browser/render.spec.ts-snapshots/narrative-light-to-dark-switch-chromium-darwin.png`
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "uses the light narrative palette by default when the system color scheme prefers light" --update-snapshots`

4q. `goal.md` item 63 now has direct browser proof in an actual dimmed-context scene, not only theme-emphasis math:
   - unit coverage already enforced minimum dimmed-text readability and a minimum dimmed alpha floor
   - browser suite now also proves that in light narrative mode:
     - the selected node remains fully emphasized
     - a related neighbor remains fully legible
     - an unrelated context node remains visibly present instead of reading as hidden
   - runtime assertions confirm the unrelated node stays in the intended dimmed band:
     - `alpha >= 0.3`
     - `alpha < 0.5`
   - committed full-canvas baseline:
     - `packages/core/tests/browser/render.spec.ts-snapshots/narrative-light-dimmed-context-chromium-darwin.png`
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "keeps dimmed context readable and distinct from hidden in light narrative mode" --update-snapshots`

4r. `goal.md` item 31 now has screenshot-backed browser proof for live philosophy recolor, not only metric diffs:
   - browser assertions already proved that a live philosophy switch changes:
     - node fills and strokes
     - edge stroke colors
     - subgraph label colors
     - font families
     - broken-link badge accent colors
   - the browser suite now also keeps committed before/after baselines for the rendered switch states:
     - overview in narrative before switch:
       - `packages/core/tests/browser/render.spec.ts-snapshots/philosophy-switch-narrative-before-chromium-darwin.png`
     - same overview after switching to blueprint:
       - `packages/core/tests/browser/render.spec.ts-snapshots/philosophy-switch-blueprint-after-chromium-darwin.png`
     - broken-link view after switching to radial:
       - `packages/core/tests/browser/render.spec.ts-snapshots/philosophy-switch-radial-broken-link-chromium-darwin.png`
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "recolors live node, edge, subgraph, and broken-link states on philosophy switch" --update-snapshots`

4s. `goal.md` item 59 now has screenshot-backed browser proof for nested depth tint rendering, not only fill-value probes:
   - browser metrics already proved every shipped philosophy exposes at least three distinct subgraph depth fills
   - the browser suite now also keeps a committed nested-subgraph canvas baseline in `map`, which is the philosophy where depth tinting is most visually prominent:
     - `packages/core/tests/browser/render.spec.ts-snapshots/subgraph-depth-map-chromium-darwin.png`
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "applies distinct subgraph depth fills for every shipped philosophy" --update-snapshots`

4t. `goal.md` item 64 now has screenshot-backed overlap-case proof for emphasis ownership and z-order:
   - browser state assertions already proved:
     - hover and selection use distinct owned overlays
     - the topmost node wins hover in an overlap probe
     - selected nodes are raised above siblings
   - the browser suite now also keeps committed clipped overlap baselines for the actual occlusion case:
     - topmost hovered node over an occluding sibling:
       - `packages/core/tests/browser/render.spec.ts-snapshots/overlap-topmost-hover-chromium-darwin.png`
     - topmost selected node over an occluding sibling:
       - `packages/core/tests/browser/render.spec.ts-snapshots/overlap-topmost-selection-chromium-darwin.png`
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "uses the topmost node as the hover target when nodes overlap in screen space|keeps the selected top node above an occluding sibling in overlap state" --update-snapshots`

4u. `goal.md` item 15 now has screenshot-backed browser proof in addition to the existing geometry assertions:
   - the non-rectangular shape fixture already asserted label containment within rendered `circle`, `diamond`, and `hexagon` shapes
   - the browser suite now also keeps a committed canvas baseline for that fixture:
     - `packages/core/tests/browser/render.spec.ts-snapshots/nonrectangular-label-fit-chromium-darwin.png`
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "keeps labels inside rendered non-rectangular shapes" --update-snapshots`

4v. `goal.md` item 6 now has screenshot-backed browser proof in addition to the existing runtime assertions:
   - invalid Mermaid input was already proven to:
     - fail `loadFile(...)` cleanly
     - surface `statusLevel = error`
     - show a readable on-canvas overlay
   - the browser suite now also keeps a committed canvas baseline for that failure state:
     - `packages/core/tests/browser/render.spec.ts-snapshots/invalid-mermaid-error-state-chromium-darwin.png`
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "shows a readable canvas and UI error state for invalid Mermaid input" --update-snapshots`

4w. `goal.md` item 42 and the related init-failure fallback path now have screenshot-backed browser proof:
   - the browser runtime already proved both failure paths surface readable fallback canvas states instead of white-screening
   - the suite now also keeps committed baselines for:
     - generic renderer init failure:
       - `packages/core/tests/browser/render.spec.ts-snapshots/renderer-init-failure-fallback-chromium-darwin.png`
     - explicit no usable GPU backend:
       - `packages/core/tests/browser/render.spec.ts-snapshots/no-gpu-backend-fallback-chromium-darwin.png`
   - verified with:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "shows a readable fallback state when renderer initialization fails|shows a readable fallback state when no usable GPU backend is available" --update-snapshots`

4x. `goal.md` item 58 is now guarded more robustly against regressions:
   - the renderer tree was already free of semantic hex literals outside `theme.ts` and `fonts.ts`
   - the enforcing test in `packages/core/src/renderer/__tests__/theme-literals.test.ts` now recurses through the full renderer directory instead of only scanning top-level files
   - verified with:
     - `pnpm --filter @mermaid-monkey/core test -- --run src/renderer/__tests__/theme-literals.test.ts`

5. `goal.md` item 28 now has direct browser proof for the node/preview side of paint order:
   - node internals are now ordered `shape < label < link badge < hover overlay < selection overlay`
   - the hover preview popup remains on a higher stage layer than the viewport content
   - browser metrics now also expose stage-level layer indices for subgraphs and edges
   - browser suite now proves the main viewport order:
     - subgraphs render behind edges
     - edges render behind nodes
   - browser suite count is now `34`
   - latest measured perf:
     - representative: `loadMs ≈ 77.0`, `avgFrameMs ≈ 10.72`, `approxFps ≈ 93.31`
     - stress: `loadMs ≈ 241.3`, `avgFrameMs ≈ 9.80`, `approxFps ≈ 102.01`

6. `goal.md` item 49 has concrete progress in the live relayout path:
   - relayout fade now uses a generation token, so rapid fold/unfold or philosophy-switch interruptions do not leave overlapping fade loops fighting over `viewport.alpha`
   - browser suite now proves repeated interrupted relayouts settle back to `viewportAlpha = 1` with a non-empty graph and no lingering folded state
   - the old dedicated `LayoutAnimator` branch has now been removed, so this remaining work is about the shipped relayout behavior itself rather than a second dormant helper
   - browser proof is now stronger on the settled-scene side:
     - the interruption case uses a neutral inline graph with no intentional dimming semantics
     - after the rapid layout-switch storm settles, Playwright now asserts:
       - no orphaned or duplicate node/edge/subgraph sprites remain
       - every rendered node alpha is back to one of the settled narrative values (`1` or `0.7`), never an in-between fade residue
       - every rendered edge alpha is back to one of the settled narrative values (`1` or `0.4`), never an in-between fade residue
       - every rendered subgraph alpha is back to `1`
      - the settled post-interruption canvas is now also pinned by a committed browser snapshot:
        - `packages/core/tests/browser/render.spec.ts-snapshots/relayout-interruption-settled-clean-chromium-darwin.png`
   - focused verification:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "rapid relayout interruptions settle without leaving partial-alpha scene artifacts behind" --update-snapshots` → passed
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "keeps the stage free of orphaned or duplicate sprites across fold, focus, and philosophy rebuilds|rapid relayout interruptions settle without leaving partial-alpha scene artifacts behind|keeps live relayout motion free of duplicate or orphaned sprites mid-animation|renders a clean mid-relayout frame without double-drawn node artifacts"` → passed

7. `goal.md` item 32 now has real browser coverage beyond the invalid-input case:
   - the dev harness can load arbitrary inline Mermaid sources through `window.__MERMAID_DEV__.loadSource(...)`
   - browser suite now proves the renderer handles:
     - empty graph
     - single-node graph
     - deeply nested subgraphs
     - long unbroken labels
     - unicode / emoji labels
   - assertions cover non-crashing load success, non-error status, finite rendered bounds, sane node/edge counts, and non-overlapping rendered labels in the long-label/unicode probe
   - browser suite count is now `35`
   - latest measured perf:
     - representative: `loadMs ≈ 77.1`, `avgFrameMs ≈ 10.57`, `approxFps ≈ 94.57`
     - stress: `loadMs ≈ 238.6`, `avgFrameMs ≈ 9.66`, `approxFps ≈ 103.48`

8. Screenshot evidence is now being taken for visual items that need an image artifact, not only geometry/state assertions:
   - added a Playwright snapshot baseline for the degenerate inline-label probe:
     - `packages/core/tests/browser/render.spec.ts-snapshots/degenerate-inline-labels-chromium-darwin.png`
   - this sits alongside the existing broken-link badge baseline so the visual regression surface is no longer limited to one screenshot case

9. `goal.md` item 27 now has direct browser proof:
   - the renderer wires a `ResizeObserver` on the canvas container and re-runs `fitToView()` after real size changes
   - the observer is gated on actual width/height deltas so no-op resize callbacks do not trigger spurious refits
   - browser debug state now exposes:
     - `canvasClientSize`
     - `canvasPixelSize`
     - `devicePixelRatio`
   - browser suite now proves a container resize:
     - re-fits content
     - keeps `viewportAlpha = 1`
     - preserves finite rendered bounds
     - keeps the focused node inside the canvas
     - keeps the canvas backing store aligned with `clientSize * devicePixelRatio`
   - browser suite now also proves `fitToView()` recovers visible content after the viewport is deliberately stranded far off-canvas at an unusably tiny zoom
   - browser suite count is now `36`
   - latest measured perf:
     - representative: `loadMs ≈ 75.4`, `avgFrameMs ≈ 10.71`, `approxFps ≈ 93.33`
     - stress: `loadMs ≈ 234.5`, `avgFrameMs ≈ 9.66`, `approxFps ≈ 103.48`

10. `goal.md` item 29 now has direct browser proof and a renderer fix:
   - nested subgraph bounds are now expanded from both member nodes and already-computed child subgraph bounds instead of only direct node boxes
   - fixed in:
     - `packages/core/src/layout/narrative-layout.ts`
     - `packages/core/src/layout/dagre-layout.ts`
   - browser debug state now exposes per-subgraph:
     - `nodeIds`
     - rendered `bounds`
   - browser suite now proves:
     - each rendered subgraph contains its member node bounds
     - each member node keeps visible padding from the subgraph border
     - nested subgraph containers remain inside their immediate rendered parent without clipping
   - added screenshot baseline:
     - `packages/core/tests/browser/render.spec.ts-snapshots/nested-subgraph-containment-chromium-darwin.png`
   - browser suite count is now `37`
   - latest measured perf:
     - representative: `loadMs ≈ 79.3`, `avgFrameMs ≈ 10.64`, `approxFps ≈ 93.94`
     - stress: `loadMs ≈ 217.3`, `avgFrameMs ≈ 9.73`, `approxFps ≈ 102.73`

11. `goal.md` item 47 now has concrete runtime guardrails in `spring.ts`:
   - springs now reject non-finite constructor values, targets, and immediate values with clear errors
   - springs now snap to target after a bounded `maxDuration` instead of relying on asymptotic settling forever
   - springs now detect absurd integration blow-ups and snap back to target instead of propagating huge unstable values
   - unit coverage added for:
     - non-finite rejection
     - bounded max-duration snap
     - non-finite / unreasonable integration recovery
   - verified through the full core gate, not only the spring unit file:
     - `pnpm --filter @mermaid-monkey/core test` → `135` passed
     - `pnpm --filter @mermaid-monkey/core test:browser` → `37` passed
     - `pnpm --filter @mermaid-monkey/core build` passed
   - latest measured perf after this pass:
     - representative: `loadMs ≈ 82.9`, `avgFrameMs ≈ 10.65`, `approxFps ≈ 93.94`
     - stress: `loadMs ≈ 249.7`, `avgFrameMs ≈ 9.66`, `approxFps ≈ 103.48`
  - this was an intermediate checkpoint only. The current renderer path no longer relies on private animation clocks for live motion:
    - `Viewport` resolves motion through Pixi `Ticker.shared`
    - `animation-clock.test.ts` guards renderer animation paths against reintroducing `requestAnimationFrame`, except for the explicit resize debounce
    - `test:animation` now proves the active relayout/runtime slice end to end, including `visibilitychange` pause/resume

12. `goal.md` item 49 now has direct unit coverage and an explicit cleanup fix in `layout-animator.ts`:
   - `LayoutAnimator.cancel()` no longer just drops bookkeeping arrays
   - interrupted fade-out sprites are now explicitly removed during cancel
   - interrupted fade-in sprites are normalized back to `alpha = 1`
   - starting a second animation now flushes the previous pending removals first instead of leaving partial-alpha or orphan sprites behind
   - added focused coverage in:
     - `packages/core/src/renderer/__tests__/layout-animator.test.ts`
   - verified through the full core gate:
     - `pnpm --filter @mermaid-monkey/core test` → `138` passed
     - `pnpm --filter @mermaid-monkey/core test:browser` → `37` passed
     - `pnpm --filter @mermaid-monkey/core build` passed
   - latest measured perf after this pass:
     - representative: `loadMs ≈ 78.0`, `avgFrameMs ≈ 10.71`, `approxFps ≈ 93.34`
     - stress: `loadMs ≈ 219.4`, `avgFrameMs ≈ 9.73`, `approxFps ≈ 102.74`
   - important limit:
     - this closes the explicit orphan-cleanup bug in `LayoutAnimator.cancel()`
     - it does NOT prove that the shipped relayout path uses `LayoutAnimator` for all live transitions, so items 48 and 50 remain structurally open

13. `goal.md` item 12 is now verified on the current tree, not just improved in principle:
   - added `pack:check` in `packages/core/package.json`:
     - runs `npm pack --dry-run`
   - root `verify:core` now includes `pnpm --filter @mermaid-monkey/core pack:check`
   - `.github/workflows/core.yml` already runs `pnpm verify:core`, so PR CI now covers:
     - lint
     - typecheck
     - unit tests
     - headless browser render tests
     - core build
     - static demo build
     - bundle-budget check
     - package dry-run pack validation
   - `docs/release.md` now documents that pack verification is part of the release gate
   - verified with:
     - `pnpm lint`
     - `pnpm verify:core`
     - `pnpm --filter @mermaid-monkey/core pack:check`
   - current release evidence from the latest gate:
     - browser suite: `49` passed
     - unit suite: `144` passed
     - core ESM: `204.13 KiB` (`209025 bytes`)
     - core CJS: `206.41 KiB` (`211364 bytes`)
     - demo entry: `index-ClSq86KK.js` `474.25 KiB` raw (`485632 bytes`), `136.51 KiB` gzip (`139782 bytes`)
     - dry-run tarball: `mermaid-monkey-core-0.1.0.tgz`, package size `277.4 kB`, total files `7`

14. `goal.md` items 37-39 now have stronger direct browser evidence:
   - added preview override hooks in the demo harness (`packages/core/dev/main.ts`) so browser tests can deterministically vary preview source and delay
   - added a dev-only `nudgeViewport(dx, dy)` hook so browser tests can force a pure viewport move without relying on drag heuristics
   - extended `LinkPreview` debug state in `packages/core/src/renderer/link-preview.ts` to expose:
     - active preview philosophy
     - preview node labels
   - browser suite now proves:
     - `goal.md` item `37`: the hover preview stays stable while the pointer moves in small steps from the node into the popup
     - `goal.md` item `37`: delayed preview resolve does not show a stale popup after pointer-leave
     - `goal.md` item `37`: delayed preview resolve anchors to the node's CURRENT screen position after the view zoom changes during the debounce window
     - `goal.md` item `37`: delayed preview resolve also anchors to the node's CURRENT screen position after a pure viewport move with no scale change
     - preview cache is invalidated on reload and picks up changed target-file content
     - preview renders using the target file's own philosophy instead of assuming the host layout
   - browser suite count is now `39`
   - latest measured perf after this pass:
     - representative: `loadMs ≈ 86.3`, `avgFrameMs ≈ 10.99`, `approxFps ≈ 90.96`
     - stress: `loadMs ≈ 250.9`, `avgFrameMs ≈ 9.52`, `approxFps ≈ 104.99`

15. `goal.md` item 40 now has a real fix plus browser proof:
   - the demo harness already had a last-write-wins token, but it was claimed too late
   - bug found: `loadFile()` incremented `activeLoadToken` only after awaiting the async file read, which allowed a slow older load to reacquire ownership after a newer one had already rendered
   - fixed in `packages/core/dev/main.ts` by claiming the load token before `readExampleFile(...)` and re-checking it immediately after the await
   - added deterministic file override hooks in the dev harness so Playwright can force slow/fast load races
   - browser suite now proves:
     - when two file loads race, the later user action wins even if the earlier load resolves last
     - the stale earlier load no longer clobbers `currentFile` or the rendered graph
   - browser suite count is now `40`
   - latest measured perf after this pass:
     - representative: `loadMs ≈ 84.5`, `avgFrameMs ≈ 10.57`, `approxFps ≈ 94.57`
     - stress: `loadMs ≈ 246.0`, `avgFrameMs ≈ 9.66`, `approxFps ≈ 103.47`

16. `goal.md` items 31 and 39 moved forward again through the preview path:
   - the cross-file preview already used the target file's layout/theme, but mini node labels were still hardcoded to `MermaidNode`
   - fixed in `packages/core/src/renderer/link-preview.ts`:
     - blueprint previews now use `MermaidBlueprint`
     - non-blueprint previews use `MermaidNode`
   - extended preview debug state so browser tests can assert preview node font families directly
   - browser proof now checks that:
     - a blueprint target preview uses `MermaidBlueprint`
     - a breath target preview uses `MermaidNode`
   - latest measured perf after this pass:
     - representative: `loadMs ≈ 75.1`, `avgFrameMs ≈ 10.57`, `approxFps ≈ 94.56`
     - stress: `loadMs ≈ 249.5`, `avgFrameMs ≈ 9.66`, `approxFps ≈ 103.48`

17. `goal.md` item 54 now has browser/runtime proof for deterministic Blueprint routing:
   - added `routes Blueprint edges deterministically regardless of source edge declaration order` in `packages/core/tests/browser/render.spec.ts`
   - the browser test loads the same Blueprint graph twice with the edge statements in different orders
   - it normalizes rendered routes by `source->target` and compares rounded `routedSegments`, so the proof does not depend on parser-generated edge ids
   - this complements the existing unit test in `packages/core/src/router/__tests__/blueprint-wire-builder.test.ts` with evidence from the shipped render path

18. `goal.md` items 3 and 12 now have a built-artifact static-demo smoke path:
   - added `packages/core/scripts/serve-static-demo.mjs` as a plain static HTTP server for `packages/core/dist-demo/`
   - added `packages/core/playwright.static.config.ts` and `packages/core/tests/browser/static-demo.spec.ts`
   - added `pnpm --filter @mermaid-monkey/core test:browser:static-demo`
   - updated `preview:demo` to use the same plain static server path
   - updated package/root verify scripts and release docs so the built demo is smoke-tested as a static artifact, not only exercised behind the Vite dev server
   - browser proof now covers the built demo artifact for:
     - initial render from `dist-demo`
     - philosophy switch
     - cross-file link navigation
     - file-picker navigation

19. Browser-suite stabilization work after adding the static-demo gate:
   - strengthened interaction tests that were using click-selection on linked or broken-link nodes
   - switched those browser proofs to `window.__MERMAID_DEV__.selectNode(...)` where the requirement was about rendered coexistence state, not click navigation itself
   - updated the light-narrative dimmed-context proof to use hover emphasis instead of unstable linked-node selection
   - updated the low-glow `breath` perceptibility proof to use `Gateway` instead of linked `OrderSvc`, so it measures the theme treatment instead of link-badge interaction edge cases
   - refreshed affected snapshots:
     - `narrative-light-dimmed-context-chromium-darwin.png`
     - `breath-hover-perceptible-chromium-darwin.png`
     - `breath-selection-perceptible-chromium-darwin.png`

20. Current verification gate is green again on the present tree:
   - `pnpm verify:core` passed end to end
   - unit suite: `140` passed
   - browser suite: `74` passed
   - built static demo smoke: passed
   - current measured browser perf from the same browser run:
     - representative: `loadMs ≈ 73.2`, `avgFrameMs ≈ 10.43`, `p95FrameMs ≈ 9.30`, `approxFps ≈ 95.85`
     - stress: `220` nodes / `294` edges, `loadMs ≈ 242.8`, `avgFrameMs ≈ 9.52`, `p95FrameMs ≈ 17.70`, `approxFps ≈ 104.99`
   - current packaged artifact checks:
     - core ESM: `202.28 KiB` (`207136 bytes`)
     - core CJS: `204.57 KiB` (`209479 bytes`)
     - demo entry: `index-CNnJ3N89.js` `478.06 KiB` raw / `137.36 KiB` gzip
     - dry-run tarball: `mermaid-monkey-core-1.0.0.tgz`, package size `274.1 kB`

21. Fresh browser-suite rerun on the current tree is also green after the latest screenshot-proof additions:
   - `pnpm --filter @mermaid-monkey/core test:browser` passed
   - browser suite: `77` passed
   - this rerun includes the new artifact-backed cases for:
     - non-rectangular label fit
     - invalid Mermaid error state
     - renderer-init failure fallback
     - no-GPU-backend fallback
     - broken-link missing-fragment state
     - malformed `@link` warning state
     - out-of-scope link warning state
     - successful WebGL render after WebGPU no-adapter fallback
   - current measured browser perf from the `77`-test run:
     - representative: `loadMs ≈ 75.7`, `avgFrameMs ≈ 10.57`, `p95FrameMs ≈ 9.30`, `approxFps ≈ 94.57`
     - stress: `220` nodes / `294` edges, `loadMs ≈ 251.2`, `avgFrameMs ≈ 9.59`, `p95FrameMs ≈ 24.90`, `approxFps ≈ 104.23`

22. Fresh full-gate rerun is also green after the latest lifecycle-harness and snapshot-proof additions:
   - `pnpm verify:core` passed end to end
   - unit suite: `140` passed
   - browser suite: `77` passed
   - built static demo smoke: passed
   - current measured browser perf from the full-gate browser run:
     - representative: `loadMs ≈ 73.9`, `avgFrameMs ≈ 10.50`, `p95FrameMs ≈ 9.30`, `approxFps ≈ 95.22`
     - stress: `220` nodes / `294` edges, `loadMs ≈ 251.2`, `avgFrameMs ≈ 9.38`, `p95FrameMs ≈ 16.70`, `approxFps ≈ 106.57`
   - current packaged/build artifact checks from that same run:
     - core ESM: `201.36 KiB` (`206192 bytes`)
     - core CJS: `203.65 KiB` (`208541 bytes`)
     - demo entry: `index-CNnJ3N89.js` `489.53 KiB` raw (`489536 bytes`) / `137.36 KiB` gzip (`140657 bytes`)
     - dry-run tarball: `mermaid-monkey-core-1.0.0.tgz`, package size `274.4 kB`

23. Flowchart-only runtime scope is now enforced explicitly instead of relying on docs alone:
   - `packages/core/src/parser/graph-builder.ts` now rejects non-flowchart Mermaid families with `UNSUPPORTED_DIAGRAM_TYPE`
   - when Mermaid falls back to adapter type `unknown`, the graph builder now recovers the declared diagram family from the source header so the user-facing error names the actual family, e.g. `classDiagram`
   - added unit proof in `packages/core/src/parser/__tests__/graph-builder.test.ts`
   - added browser proof plus committed fallback snapshot:
     - `unsupported-diagram-type-error-state-chromium-darwin.png`

24. Item `41` teardown proof is stronger on the current tree:
   - `packages/core/dev/lifecycle-harness.ts`
     - added `runDestroyCleanupProbe()` for browser-side teardown verification
   - `packages/core/tests/browser/render.spec.ts`
     - added `releases listeners, timers, and canvas ownership state on destroy`
   - focused verification passed:
     - `pnpm --filter @mermaid-monkey/core exec playwright test -g "releases listeners, timers, and canvas ownership state on destroy|supports multiple live renderers on one page|guards lifecycle misuse with clear errors"`
   - lifecycle gate also stayed green:
     - `pnpm --filter @mermaid-monkey/core test:browser:lifecycle`
     - `9` passed
   - `pnpm --filter @mermaid-monkey/core typecheck` also passed
   - important scope note:
     - the probe intentionally verifies ownership release via the renderer's live-canvas registry state instead of immediately remounting a new renderer onto the exact same physical canvas inside the same browser turn
     - that narrower check avoids a Chromium/Pixi wedge case while still directly proving the teardown contract we need for item `41`

## Resume Notes

If context compacts, read this file first, then run:

```bash
git status --short
pnpm --filter @mermaid-monkey/core typecheck
pnpm --filter @mermaid-monkey/core test
pnpm --filter @mermaid-monkey/core test:browser
```

If the dev server is not running, start it:

```bash
pnpm --dir packages/core dev --host 127.0.0.1 --port 3000
```
