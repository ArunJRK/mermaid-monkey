# mermaid-monkey

`@mermaid-monkey/core` is a framework-agnostic Mermaid rendering engine for the web. It mounts into a `<canvas>`, renders with PixiJS on a GPU backend, and adds zoom, pan, folding, and cross-file navigation.

Product landing page: [Mermaid Monkey](https://arunjrk.github.io/mermaid-monkey/)

## Why?

Mermaid is great for defining diagrams as code. But the output is a static SVG — no zoom, no folding, no way to handle complexity. Large diagrams become unreadable, and there's no way to split them across files.

Mermaid Monkey fixes this: Mermaid syntax in, interactive GPU-rendered canvas out.

For the concrete list of product problems this repo is trying to solve, see:

- [Pain Points](docs/pain-points.md) for the explicit issue-backed problem list
- [Problem Statement](docs/superpowers/specs/2026-03-28-mermaid-render-design.md#1-problem-statement) for the broader design framing

## Screenshots

Narrative overview:

![Narrative overview](docs/assets/readme-overview-narrative.png)

Blueprint flow:

![Blueprint flow](docs/assets/readme-blueprint-simple-flow.png)

Responsive mobile shell:

![Responsive mobile shell](docs/assets/readme-mobile-responsive.png)

## v1 Scope

- **Interactive canvas** — zoom, pan, fit, reset, fold, and focus navigation
- **Embeddable core** — mount into any page that provides a `<canvas>`
- **Browser demo app** — static Vite build using bundled examples
- **Cross-file linking** — `%% @link` directives for in-browser multi-file navigation
- **Supported layouts** — `narrative` and `blueprint`
- **Supported Mermaid syntax** — `flowchart` today

The following philosophy names currently map to theme/spacing presets on top of Dagre rather than dedicated layout engines: `map`, `breath`, `radial`, `mosaic`.

The parser/runtime does **not** currently ship production support for Mermaid `classDiagram`, `stateDiagram`, or `C4` syntax. Any docs that mention those diagram families as a long-term fit for a philosophy are design intent, not a v1 compatibility claim.

Routing guarantees are philosophy-specific:

- `blueprint` is the only shipped philosophy with collision-aware routing
- `narrative` trims edges to node boundaries and applies limited straight-line avoidance, but it does not guarantee obstacle-free routing
- `map`, `breath`, `radial`, and `mosaic` are visual presets on Dagre and should not be treated as collision-free routers

Performance and degradation are also explicit:

- The renderer is browser-verified for interactive use through at least roughly `220` nodes / `294` edges.
- Past that floor, rendering is best-effort rather than a hard 60fps guarantee.
- When a diagram exceeds the verified floor, `load()` emits `PERF_STRESS_THRESHOLD` and the renderer switches into a stress mode instead of degrading silently.
- Stress mode currently suppresses cross-file hover previews, hides edge labels, and hides subgraph chevrons/count badges so large graphs stay usable while authors lean on folding, focus navigation, or cross-file splits.

## Embed

```ts
import {
  MermaidRenderer,
  createVirtualFileResolver,
} from '@mermaid-monkey/core'

const canvas = document.querySelector('canvas')
if (!canvas) throw new Error('Missing canvas')

const files = {
  '/examples/overview.mmd': `
    %% @link auth -> ./auth#loginNode
    graph TD
      auth[Auth] --> db[(DB)]
  `,
  '/examples/auth.mmd': `
    graph TD
      loginNode[Login] --> done[Done]
  `,
}

const renderer = new MermaidRenderer({
  themeMode: 'system',
  themeOverrides: {
    accent: 0x0969da,
  },
})
const linkResolver = createVirtualFileResolver(files)

await renderer.mount(canvas)
await renderer.load(files['/examples/overview.mmd'], {
  sourcePath: '/examples/overview.mmd',
  linkResolver,
})

// later
renderer.destroy()
```

Pass `sourcePath` and `linkResolver` when the diagram contains `%% @link` directives. For single-file diagrams, `await renderer.load(source)` is enough.

Public surface for v1:

- `new MermaidRenderer()`
- `mount(canvas)`
- `load(source, options?)`
- `loadGraph(graph)`
- `activateLink(nodeId)`
- `setPhilosophy(philosophy)`
- `setThemeMode(mode)`
- `setThemeOverrides(overrides)`
- `fitToView()`
- `resetView()`
- `foldNode()`, `unfoldNode()`, `foldAll()`, `unfoldAll()`
- `focusSubgraph()`, `focusOut()`, `focusTo()`
- `on()`, `off()`
- `destroy()`

Lifecycle behavior:

- `mount(canvas)` is safe to call again on the same live instance and same canvas, but it throws if you try to remount that instance onto a different canvas.
- A canvas already owned by another live `MermaidRenderer` instance is rejected with a clear error instead of leaking a second Pixi app/context.
- After `destroy()`, the instance is finished: later `load()`, `setPhilosophy()`, or `mount()` calls throw clear errors instead of silently no-oping on a dead renderer.
- Multiple renderer instances can coexist on the same page as long as each owns its own canvas.

Theme behavior:

- Default `themeMode` is `system`.
- In system-light environments, the default `narrative` palette resolves to a built-in light variant.
- The other shipped philosophies keep their current dark palettes unless the embedder supplies `themeOverrides`.
- `themeOverrides` are applied on top of the resolved palette, so embedders can supply a host-matched light palette without forking the renderer.

Visual/theme guarantees:

- The shipped palettes enforce a tested contrast floor for node labels, edge labels, and subgraph labels against their actual backing colors.
- All shipped philosophies define nested subgraph depth tints; deep nesting is not a flat single-fill fallback.
- Broken-link state is not color-only: the renderer keeps a distinct badge cue in addition to the themed broken-link color treatment.
- Hover and selection are distinct states, and the same node can show both at once instead of collapsing into one shared glow.
- Focus dimming keeps unrelated context visible as context rather than treating dimmed nodes as effectively hidden.

Backend behavior:

- The renderer prefers WebGPU when a usable adapter is available and falls back to WebGL when it is not.
- The active backend is exposed through the browser/demo harness and covered by the release gate.
- If a browser exposes `navigator.gpu` but `requestAdapter()` returns `null`, the renderer still mounts and renders through WebGL.
- There is no built-in Canvas 2D fallback in the current PixiJS v8 path. If no usable GPU backend exists, v1 surfaces a readable "rendering unavailable" state instead of white-screening or claiming a fallback that is not there.

Runtime behavior:

- When the tab is backgrounded, active ticker-driven animation pauses and resumes on visibility restore.
- When no animation is in flight, the renderer lets the Pixi ticker go idle instead of burning a permanent render loop.

## Cross-File Linking

Link nodes across files using comment directives (ignored by standard Mermaid tools):

```mermaid
%% @link auth -> /services/auth/flow.mmd#loginNode
%% @link db -> /services/data/schema.mmd#userTable

graph TD
    auth[Auth Service] --> db[User Database]
```

Resolver contract for browser embeds:

- `load(..., { sourcePath, linkResolver })` enables link validation and canonical path handling.
- `linkResolver.canonicalize(targetFile, fromFile)` must turn author-provided paths into one canonical `.mmd` key or return `null` for out-of-scope targets.
- `linkResolver.read(canonicalFile)` must return Mermaid source from an allowlisted or virtual file map. Core never fetches a raw author-supplied URL.
- Relative paths resolve from the current file, absolute paths stay rooted, extensionless targets gain `.mmd`, and `.` / `..` segments are normalized.

Interaction contract:

- `activateLink(nodeId)` uses the same navigation path as clicking a linked node in the demo/runtime.
- A link target with `#nodeId` reveals and selects that target node after the destination file loads; a link without a fragment lands on the destination file's normal fit view.
- Broken targets are visible and actionable: unresolved files or fragments render a broken-link badge state and surface a readable warning instead of becoming a dead silent click.
- Selection is intentionally not sticky across graph rebuilds. Fold/unfold, focus changes, file loads, and philosophy relayouts clear selection rather than carrying a stale node id onto a rebuilt scene.
- Fold state is preserved across `setPhilosophy(...)` relayouts rather than being reset on every philosophy switch.

Philosophy/theme switch behavior:

- `setPhilosophy(...)` recolors the live scene instead of only affecting future renders: node fills/strokes/labels, edge strokes/labels, subgraph labels/accents, and broken-link badge accents switch together.
- Blueprint font treatment is applied across the whole live scene on switch, including node labels, edge labels, subgraph labels, and hover-preview title text.

For virtual in-memory projects, use the exported helper:

```ts
import { createVirtualFileResolver, normalizeDiagramPath } from '@mermaid-monkey/core'
```

## Demo

Local demo:

```bash
pnpm --dir packages/core dev --host 127.0.0.1
```

Static demo build:

```bash
pnpm --filter @mermaid-monkey/core build:demo
```

Marketing site:

```bash
pnpm build:site
pnpm preview:site
```

The marketing site output is written to `packages/site/dist/` and deployed to GitHub Pages by the `Site` workflow.

Preview the built core demo artifact locally:

```bash
pnpm --filter @mermaid-monkey/core preview:demo
```

The core demo output is written to `packages/core/dist-demo/` and can be served by any static host.

Release and deploy steps are documented in [docs/release.md](docs/release.md).

## Status

Active v1 web release work. See [goal.md](goal.md), [TASKS.md](TASKS.md), [docs/vision.md](docs/vision.md), [docs/tech.md](docs/tech.md), and [docs/release.md](docs/release.md) for the current scope and constraints.

## License

[MIT](LICENSE)
