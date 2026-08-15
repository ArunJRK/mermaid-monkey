# Release and Deploy

This repo ships two v1 artifacts from the current goal scope:

1. `@mermaid-monkey/core` as a public npm package
2. `packages/core/dist-demo/` as a static web app

## Core Release Verification

Run the full pre-release gate from the repo root:

```bash
pnpm install --frozen-lockfile
pnpm verify:core
```

That gate runs:

- lint
- typecheck
- unit tests
- headless browser render tests
- core library build
- static demo build
- built static demo smoke test from a plain file host
- core bundle-budget check and demo-entry size report
- npm package dry-run pack verification

Latest verified current-tree result:

- unit tests: `152` passed
- browser tests: `84` passed; `1` pre-existing mid-relayout screenshot flake on the verifying darwin machine (fails identically on the unchanged `1.0.1` tree and passes when run in isolation)
- built static demo smoke test: passed
- core ESM: `206.40 KiB`
- core CJS: `208.69 KiB`
- demo entry: `479.84 KiB` raw / `138.18 KiB` gzip
- dry-run tarball: `mermaid-monkey-core-1.0.2.tgz`, package size `284.8 kB`

GitHub Actions PR / mainline gate:

- workflow: `.github/workflows/core.yml`
- triggers: pull requests and pushes that touch the core/docs/example/release surface
- command executed in CI: `pnpm verify:core`
- latest externally verified green `pull_request` run:
  - workflow: `Core Verify`
  - run: `26679935715`
  - commit: `7c07ee4`
  - trigger: `pull_request`
  - result: `success`
- latest externally verified green post-merge `push` run:
  - workflow: `Core Verify`
  - run: `26680191944`
  - commit: `4224af1`
  - trigger: push to `main`
  - result: `success`
- release-audit closeout should keep both artifacts when possible:
  - one green `pull_request` run on the candidate branch
  - one green post-merge `push` run on `main`

## Dry-Run the npm Package

From the repo root:

```bash
pnpm --filter @mermaid-monkey/core pack --pack-destination ../../artifacts
```

Or inspect the publish payload without writing a tarball:

```bash
cd packages/core
npm pack --dry-run
```

The package is scoped and configured for public publish via:

```json
"publishConfig": {
"access": "public"
}
```

## Bundle Budget Check

After building, verify the publishable core stays inside the `~330 KiB` budget and the static demo stays inside its separate release budget:

```bash
pnpm --filter @mermaid-monkey/core bundle:check
```

This check:

- fails if `dist/index.js` or `dist/index.cjs` exceed the core budget
- fails if the demo entry chunk exceeds `500 KiB` raw or `160 KiB` gzip
- prints the current measured sizes for release tracking

## Publish `@mermaid-monkey/core`

After verification on the current `1.0.0` release tree:

```bash
cd packages/core
npm publish
```

Expected publish surface:

- `dist/index.js`
- `dist/index.cjs`
- `dist/index.d.ts`

`prepack` runs `pnpm build`, so the tarball is built from fresh output.

Latest verified dry-run package artifact:

- `mermaid-monkey-core-1.0.0.tgz`

## Pack Verification in CI / Local Gate

The v1 release gate also verifies that the package can be packed without publishing:

```bash
pnpm --filter @mermaid-monkey/core pack:check
```

This runs:

```bash
npm pack --dry-run
```

So the CI/release path checks the actual publish surface, not only TypeScript/build output.

## Build the Static Demo

```bash
pnpm --filter @mermaid-monkey/core build:demo
```

Output:

```text
packages/core/dist-demo/
```

## Preview the Static Demo Locally

```bash
pnpm --filter @mermaid-monkey/core preview:demo
```

That command rebuilds `packages/core/dist-demo/` and serves it from a plain static HTTP server on `127.0.0.1:4173`.

The same built-artifact smoke path is also available directly:

```bash
pnpm --filter @mermaid-monkey/core test:browser:static-demo
```

Or serve the built folder with any static file host.

## GPU and Lifecycle Verification

There is also a focused browser gate for renderer lifecycle and backend recovery behavior:

```bash
pnpm --filter @mermaid-monkey/core test:browser:lifecycle
```

That focused run covers:

- multi-instance coexistence
- lifecycle misuse errors
- destroy-time cleanup of handlers, timers, preview state, and live-canvas ownership
- synthetic WebGL context loss / restore
- WebGPU-present-but-no-adapter fallback to WebGL
- visibility pause / resume
- idle ticker shutdown / wake-up
- readable renderer-init and no-backend fallback states
- WebGPU device-loss probe behavior

There is also a focused browser gate for the relayout and animation proof surface:

```bash
pnpm --filter @mermaid-monkey/core test:browser:relayout
```

That focused run covers:

- fold state surviving a philosophy switch
- no orphaned or duplicate sprites across rebuilds
- clean settled state after rapid relayout interruptions
- edge endpoints staying attached during live relayout motion
- clean mid-motion inventory
- clean mid-relayout canvas frame
- smooth node progression instead of teleporting
- hidden-tab pause / visible-tab resume during active relayout
- stress-mode relayout fast path

Current result on the present tree:

- render-quality browser slice: `22` passed

- `pnpm --filter @mermaid-monkey/core test:browser:relayout` -> `9` passed

There is also a focused mixed unit + browser gate for the spring/runtime animation contract:

```bash
pnpm --filter @mermaid-monkey/core test:animation
```

That command covers:

- spring guardrails against non-finite values and unbounded runtime
- the renderer animation-clock fence
- the relayout browser slice for items `48` through `50`

Current result on the present tree:

- spring + animation-clock unit slice: `12` passed
- relayout browser slice: `9` passed

There is also a focused mixed unit + browser gate for the theme and emphasis contract:

```bash
pnpm --filter @mermaid-monkey/core test:theme
```

That command covers:

- theme contrast floor
- theme emphasis perceptibility math
- theme depth-tint availability
- renderer hardcoded-color fence
- light-theme resolution
- browser theme/emphasis states across light mode, depth tints, hover/selection distinction, relationship emphasis, broken-link distinction, and overlap z-order

Current result on the present tree:

- theme unit slice: `7` passed
- theme/emphasis browser slice: `10` passed

There is also a focused mixed unit + browser gate for the cross-file linking and preview contract:

```bash
pnpm --filter @mermaid-monkey/core test:linking
```

That command covers:

- `@link` directive parsing and malformed-directive warnings
- graph-builder link attachment and broken-target validation
- path normalization and trust-boundary rejection
- real cross-file navigation and fragment reveal
- last-write-wins async load behavior
- hover preview placement, stability, race-safety, and target-philosophy rendering
- preview cache bounding and invalidation
- broken-link, malformed-link, and out-of-scope warning states
- stress-mode preview suppression

Current result on the present tree:

- parser/resolver unit slice: `20` passed
- linking/preview browser slice: `16` passed

There is also a focused browser gate for the render-quality and viewport contract:

```bash
pnpm --filter @mermaid-monkey/core test:render-quality
```

That command covers:

- node overlap and low-zoom label overlap invariants
- non-rectangular and long-label node fit
- hover bounds, edge trimming, edge-label clearance, self-loop/bidirectional rendering
- Blueprint rendered-footprint routing, deterministic ordering, and fallback-wire behavior
- fit-to-view, resize, recovery, and zoom clamp behavior
- responsive narrow-layout behavior
- paint order and stage layering
- subgraph containment and degenerate-graph stability

Current result on the present tree:

- render-quality browser slice: `22` passed

There is also a focused browser + built-artifact gate for the web/demo surface:

```bash
pnpm --filter @mermaid-monkey/core test:web
```

That command covers:

- real browser load -> layout -> render on shipped examples and the stress graph
- fold/unfold behavior
- focus navigation
- fold-state preservation across philosophy switches
- fit-to-view sanity after reload
- documented plain-page embed mounting
- readable invalid-input and unsupported-diagram error states
- built static demo artifact rendering and navigation

Current result on the present tree:

- browser integration/embed slice: `8` passed
- built static demo smoke: `1` passed

There is also a focused browser gate for performance and stress-mode behavior:

```bash
pnpm --filter @mermaid-monkey/core test:performance
```

That command covers:

- representative and stress browser-side perf sampling
- explicit stress-mode activation on large graphs
- current stress-mode detail suppression
- stress-mode cross-file preview suppression
- stress-mode relayout fast path

Current result on the present tree:

- performance/stress browser slice: `5` passed
- latest focused run measurements:
  - representative: `7` nodes / `6` edges, `loadMs ≈ 97.6`, `avgFrameMs ≈ 11.41`, `p95FrameMs ≈ 8.5`, `approxFps ≈ 87.62`
  - stress: `220` nodes / `294` edges, `loadMs ≈ 297.2`, `avgFrameMs ≈ 9.87`, `p95FrameMs ≈ 25.0`, `approxFps ≈ 101.27`

There is also a focused ship-surface gate for release artifacts:

```bash
pnpm --filter @mermaid-monkey/core test:ship
```

That command covers:

- fresh core library build
- fresh static demo build
- built static demo smoke from a plain static host
- bundle-budget enforcement
- publish-surface `npm pack --dry-run` verification

Current result on the present tree:

- built static demo smoke: `1` passed
- bundle budget check: passed
- `npm pack --dry-run`: passed
- latest focused run artifact measurements:
  - core ESM: `201.94 KiB`
  - core CJS: `204.23 KiB`
  - demo entry: `478.38 KiB` raw / `137.53 KiB` gzip
  - dry-run tarball: `mermaid-monkey-core-1.0.0.tgz`, package size `277.8 kB`

Current environment expectation:

- in ordinary CI or headless Chromium without a usable WebGPU adapter, the WebGPU probe should finish quickly with an explicit adapter-unavailable result instead of hanging
- in a browser with a real WebGPU adapter, the same probe should exercise the WebGPU device-loss recovery path and re-render successfully

## Static Deploy Contract

The demo build is static-only:

- no Node server runtime
- no filesystem dependency
- bundled example `.mmd` files are compiled into the app
- cross-file navigation resolves through the in-browser virtual file map

Any static host that can serve `packages/core/dist-demo/` is valid.
