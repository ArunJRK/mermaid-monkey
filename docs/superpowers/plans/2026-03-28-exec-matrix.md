# mermaid-monkey Execution Matrix

**Source plan:** `docs/superpowers/plans/2026-03-28-mermaid-render-impl.md`
**Spec:** `docs/superpowers/specs/2026-03-28-mermaid-render-design.md`
**BDD features:** `tests/features/*.feature`

---

## TDD + BDD Protocol

**Every chunk follows Red-Green-Refactor:**

1. **RED:** Write failing test(s) derived from BDD feature scenarios
2. **Verify RED:** Run test, confirm it fails because feature is missing (not typo)
3. **GREEN:** Write minimal code to pass the test
4. **Verify GREEN:** Run test, confirm it passes + all other tests still pass
5. **REFACTOR:** Clean up, then repeat for next scenario

**No production code without a failing test first.** Agents that skip TDD have their work rejected.

**BDD feature files** define the expected behavior in plain language. Each chunk's context brief references the relevant `.feature` file. The agent translates scenarios into vitest unit tests before writing any implementation.

**Exception:** PixiJS visual layer (renderer-pixi chunk) — WebGL code can't run in Node.js. This chunk type-checks only. Its logic is already tested via renderer-logic chunk. The dev harness provides visual verification.

---

## Quick Index

| Theme | Key Deliverable |
|-------|----------------|
| **1. Foundation** | Monorepo scaffold + types + build toolchain |
| **2. Parser Pipeline** | Mermaid text → RenderGraph with directives |
| **3. Layout Engine** | Positioned graph with philosophy presets + fold support |
| **4. Renderer** | PixiJS scene graph + interaction + dev harness |
| **5. VS Code Extension** | Extension + webview panel + file explorer |
| **6. Integration** | End-to-end wiring + example files |

---

## Theme 1: Foundation

| Task | Description | Chunk | Done When |
|------|-------------|-------|-----------|
| 1.1 | Create root `package.json`, `pnpm-workspace.yaml`, base `tsconfig.json`, `.gitignore` | foundation | `cat package.json \| jq .name` → `"mermaid-monkey"` |
| 1.2 | Create `packages/core/package.json` with dependencies (mermaid, dagre, pixi.js), `tsconfig.json`, `tsup.config.ts` | foundation | `cat packages/core/package.json \| jq .name` → `"@mermaid-monkey/core"` |
| 1.3 | Run `pnpm install` and verify lockfile | foundation | `test -f pnpm-lock.yaml && echo ok` → `ok` |
| 1.4 | Create `packages/core/src/types.ts` with all interfaces (RenderGraph, RenderNode, RenderEdge, RenderSubgraph, Directive types, PositionedGraph, LoadResult, NodeEvent) | foundation | `pnpm --filter @mermaid-monkey/core typecheck` → exit 0 |
| 1.5 | Create `packages/core/vitest.config.ts` (with `environment: 'jsdom'`) and type validation tests | foundation | `pnpm --filter @mermaid-monkey/core test` → PASS |
| 1.6 | Create `packages/core/src/index.ts` with placeholder exports, verify build | foundation | `pnpm --filter @mermaid-monkey/core build && test -f packages/core/dist/index.js` → true |

### Theme 1 Gate
`pnpm install && pnpm build && pnpm test` — all pass from repo root.

---

## Theme 2: Parser Pipeline

| Task | Description | Chunk | Done When |
|------|-------------|-------|-----------|
| 2.1 | Implement `directive-extractor.ts` — regex extraction of `@link`, `@layout`, `@pin`, `@rank`, `@spacing` from `%%` comments | parser-pipeline | `pnpm --filter @mermaid-monkey/core test -- directive-extractor` → 8/8 PASS |
| 2.2 | Mermaid API spike — run `_spike.ts` to discover `Diagram.fromText()` and `db.getData()` shape for mermaid 11.4.x | parser-pipeline | Spike script runs without errors and logs db structure to console |
| 2.3 | Implement `mermaid-adapter.ts` — thin wrapper around mermaid, returns `{ diagramType, db, direction }` | parser-pipeline | `pnpm --filter @mermaid-monkey/core test -- mermaid-adapter` → PASS |
| 2.4 | Implement `adapters/flowchart.ts` — transforms mermaid flowchart db into RenderGraph (nodes, edges, subgraphs) | parser-pipeline | `pnpm --filter @mermaid-monkey/core test -- graph-builder` → 7/7 PASS |
| 2.5 | Implement `graph-builder.ts` — orchestrator: extractDirectives → parseMermaid → buildFlowchartGraph → attach links | parser-pipeline | `pnpm --filter @mermaid-monkey/core test -- graph-builder` → includes directive attachment test PASS |

### Theme 2 Gate
```bash
pnpm --filter @mermaid-monkey/core test -- parser
```
All parser tests pass. `buildGraph('graph TD\n A --> B')` returns `{ success: true, graph: { nodes: Map(2), edges: [1] } }`.

---

## Theme 3: Layout Engine

| Task | Description | Chunk | Done When |
|------|-------------|-------|-----------|
| 3.1 | Create `layout-engine.ts` interface and `philosophy-config.ts` with Narrative/Map/Blueprint/Breath presets | layout-engine | `pnpm --filter @mermaid-monkey/core typecheck` → exit 0 |
| 3.2 | Implement `dagre-layout.ts` — wraps dagre, applies philosophy spacing, handles fold (hidden nodes + summary nodes + edge rerouting) | layout-engine | `pnpm --filter @mermaid-monkey/core test -- dagre-layout` → 5/5 PASS |
| 3.3 | Verify philosophy spacing works: Breath produces larger layout than Blueprint for same graph | layout-engine | `pnpm --filter @mermaid-monkey/core test -- "applies philosophy"` → PASS |

### Theme 3 Gate
```bash
pnpm --filter @mermaid-monkey/core test -- layout
```
All layout tests pass. `DagreLayout.compute(graph)` returns `PositionedGraph` with non-overlapping nodes.

---

## Theme 4: Renderer

**TDD approach:** Separate testable logic from PixiJS visuals. The renderer's logic (scene construction, event routing, fold state, selection state, load cancellation) is tested in Node.js via unit tests. PixiJS visual output is verified in the dev harness.

**BDD features:** `tests/features/renderer.feature`, `tests/features/interaction.feature`

| Task | Description | Chunk | Done When |
|------|-------------|-------|-----------|
| 4.1 | **TDD: Fold Manager** — Write tests for toggle, foldAll, unfoldAll, collapseDescendants. Then implement `interaction/fold-manager.ts`. | renderer-logic | `pnpm --filter @mermaid-monkey/core test -- fold-manager` → 6/6 PASS |
| 4.2 | **TDD: Keyboard handler** — Write tests for key→action mapping (F, R, unknown keys). Then implement `interaction/keyboard.ts`. | renderer-logic | `pnpm --filter @mermaid-monkey/core test -- keyboard` → 3/3 PASS |
| 4.3 | **TDD: Scene model** — Write tests for scene construction from PositionedGraph: correct number of nodes/edges, selection state changes, event emission (node:click, fold:change, error, warn), off() unsubscription, concurrent load cancellation. Then implement `renderer/scene-model.ts`. | renderer-logic | `pnpm --filter @mermaid-monkey/core test -- scene-model` → 10+ PASS |
| 4.4 | **TDD: Load pipeline** — Write integration test: mermaid source string → buildGraph → layout → scene model produces correct node/edge count. Test error path (invalid source → error event + previous graph preserved). Then implement `renderer/load-pipeline.ts`. | renderer-logic | `pnpm --filter @mermaid-monkey/core test -- load-pipeline` → 4/4 PASS |
| 4.5 | Implement PixiJS visual layer: `viewport.ts`, `node-sprite.ts`, `edge-graphic.ts`, `subgraph-container.ts` — thin wrappers that read from scene model. | renderer-pixi | `pnpm --filter @mermaid-monkey/core build` → exit 0 |
| 4.6 | Implement `mermaid-renderer.ts` — composes scene model + PixiJS layer. Public API delegates to tested logic. | renderer-pixi | `pnpm --filter @mermaid-monkey/core build` → exit 0 |
| 4.7 | Create dev harness (`packages/core/dev/index.html` + `dev/main.ts` + `vite.config.ts`) | renderer-harness | `cd packages/core && pnpm dev` → Vite serves at localhost:3000, diagram visible |
| 4.8 | Wire fold-manager + keyboard into mermaid-renderer. Double-click subgraph header toggles fold. | renderer-pixi | Open dev harness → double-click subgraph → children collapse |

### Theme 4 Gate
`pnpm --filter @mermaid-monkey/core test` → ALL PASS (unit tests for fold-manager, keyboard, scene-model, load-pipeline). Dev harness at localhost:3000 renders interactive diagram.

---

## Theme 5: VS Code Extension

| Task | Description | Chunk | Done When |
|------|-------------|-------|-----------|
| 5.1 | Create `packages/vscode/package.json` with contributes (commands, keybindings, languages, views), `tsconfig.json`, `.vscodeignore` | vscode-scaffold | `cat packages/vscode/package.json \| jq .contributes.commands[0].command` → `"mermaidRender.openPreview"` |
| 5.2 | Implement `extension.ts` — activate, register commands (openPreview, foldAll, unfoldAll), register TreeDataProvider, watch `.mmd` saves | vscode-scaffold | `pnpm --filter mermaid-monkey-vscode build` → exit 0 |
| 5.3 | Implement `file-explorer.ts` — TreeDataProvider that lists `.mmd` files in workspace | vscode-scaffold | `pnpm --filter mermaid-monkey-vscode typecheck` → exit 0 |
| 5.4 | Implement `renderer-panel.ts` — WebviewPanel with retainContextWhenHidden, message passing (load, foldAll, unfoldAll, navigate), cross-file navigation handler | vscode-webview | `pnpm --filter mermaid-monkey-vscode build` → exit 0 |
| 5.5 | Implement `webview/webview.ts` — imports @mermaid-monkey/core, mounts renderer, handles postMessage load/fold/navigate | vscode-webview | `pnpm --filter mermaid-monkey-vscode build` → `dist/webview.js` exists |
| 5.6 | Add `build:webview` esbuild step (iife, browser platform), update renderer-panel.ts to load bundled webview.js via webview URI | vscode-webview | `pnpm --filter mermaid-monkey-vscode build && test -f packages/vscode/dist/webview.js && test -f packages/vscode/dist/extension.js` → true |

### Theme 5 Gate
Press F5 in VS Code → Extension Development Host opens. Create a `.mmd` file → run "Mermaid: Open Preview" → webview panel opens showing rendered diagram. File explorer shows `.mmd` files in sidebar.

---

## Theme 6: Integration

| Task | Description | Chunk | Done When |
|------|-------------|-------|-----------|
| 6.1 | Create `examples/` directory with test .mmd files: simple-flow, with-subgraphs, cross-file (3 linked files), each layout philosophy | integration-verify | `ls examples/*.mmd examples/cross-file/*.mmd \| wc -l` → ≥6 |
| 6.2 | End-to-end manual verification: open each example in dev harness + VS Code extension, test zoom/pan/fold/cross-file-nav/layout-switching | integration-verify | All 4 philosophies render differently. Cross-file click navigates. Fold/unfold works. |
| 6.3 | Run full test suite, fix any failures | integration-verify | `pnpm test` from repo root → ALL PASS |
| 6.4 | Final commit and push | integration-verify | `git log --oneline -1` shows integration commit. `git status` is clean. |

### Theme 6 Gate
`pnpm build && pnpm test` → clean. Dev harness renders all examples. VS Code extension activates and previews `.mmd` files.

---

## Chunk Plan

### Chunk: foundation
**Tasks:** 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
**Agent:** JR | Haiku (config)
**Human:** no
**Context brief:**
  - Read `docs/superpowers/plans/2026-03-28-mermaid-render-impl.md` Task 1 and Task 2
  - Read `docs/tech.md` §Architecture and §Bundle Size Budget
**Shared files:** `package.json`, `tsconfig.json`, `packages/core/package.json`, `packages/core/src/types.ts`, `packages/core/src/index.ts`
**Rollback:** `rm -rf packages/ node_modules/ pnpm-lock.yaml` and revert root config files
**Done when:** `pnpm install && pnpm build && pnpm test` → all exit 0

---

### Chunk: parser-pipeline (TDD)
**Tasks:** 2.1, 2.2, 2.3, 2.4, 2.5
**Agent:** SR | Sonnet (integration)
**Human:** no
**TDD discipline:** Write failing test → verify RED → implement → verify GREEN → refactor.
**Context brief:**
  - Read `tests/features/parsing.feature` — these BDD scenarios define the expected behavior. Translate into vitest tests FIRST.
  - Read `docs/superpowers/plans/2026-03-28-mermaid-render-impl.md` Tasks 3 + 4
  - Read `docs/superpowers/specs/2026-03-28-mermaid-render-design.md` §3.1 Parser Layer, §5 Cross-File Linking, §12 Parser Stability
  - Read `packages/core/src/types.ts` for graph model interfaces
  - **Critical:** Task 2.2 is a spike. Run the spike script FIRST to discover mermaid's actual internal API before writing adapter code. Do not skip this.
**Shared files:** `packages/core/src/parser/*`, `packages/core/src/types.ts`
**Rollback:** Delete `packages/core/src/parser/` directory
**Done when:** `pnpm --filter @mermaid-monkey/core test` → all parser tests PASS including flowchart with subgraphs and directive attachment

---

### Chunk: layout-engine (TDD)
**Tasks:** 3.1, 3.2, 3.3
**Agent:** SR | Sonnet (multi-file)
**Human:** no
**TDD discipline:** Write failing test → verify RED → implement → verify GREEN → refactor.
**Context brief:**
  - Read `tests/features/layout.feature` — these BDD scenarios define the expected behavior. Translate into vitest tests FIRST.
  - Read `docs/superpowers/plans/2026-03-28-mermaid-render-impl.md` Task 5
  - Read `docs/layout-philosophies/*.md` for spacing/grouping philosophy details
  - Read `docs/superpowers/specs/2026-03-28-mermaid-render-design.md` §3.2 Layout Engine, §6 Node Folding, §15.3 Deep Nesting
  - Read `packages/core/src/types.ts` for PositionedGraph interfaces
**Shared files:** `packages/core/src/layout/*`
**Rollback:** Delete `packages/core/src/layout/` directory
**Done when:** `pnpm --filter @mermaid-monkey/core test -- layout` → 5/5 PASS. Breath layout dimensions > Blueprint for same input graph.

---

### Chunk: renderer-logic (TDD)
**Tasks:** 4.1, 4.2, 4.3, 4.4
**Agent:** SR | Sonnet (multi-file)
**Human:** no
**TDD discipline:** Write failing test → verify RED → implement → verify GREEN → refactor. No production code without a failing test.
**Context brief:**
  - Read `tests/features/renderer.feature` and `tests/features/interaction.feature` — these are the BDD specs to implement as unit tests
  - Read `docs/superpowers/specs/2026-03-28-mermaid-render-design.md` §3.4 Interaction Model, §6 Node Folding, §10 Error Handling
  - Read `packages/core/src/types.ts` for all interfaces
  - Read `packages/core/src/layout/dagre-layout.ts` for `DagreLayout` API
  - Read `packages/core/src/parser/graph-builder.ts` for `buildGraph()` API
**Shared files:** `packages/core/src/interaction/*`, `packages/core/src/renderer/scene-model.ts`, `packages/core/src/renderer/load-pipeline.ts`
**Rollback:** Delete `packages/core/src/interaction/` and `packages/core/src/renderer/scene-model.ts`, `packages/core/src/renderer/load-pipeline.ts`
**Done when:** `pnpm --filter @mermaid-monkey/core test -- "(fold-manager|keyboard|scene-model|load-pipeline)"` → 20+ tests PASS

Key tests to write (from BDD features):
- Fold manager: toggle, foldAll, unfoldAll, collapseDescendants, non-existent subgraph
- Keyboard: F→fitToView, R→resetView, unknown key→no-op
- Scene model: construct from PositionedGraph, selection state, event emit/unsubscribe, concurrent load cancel
- Load pipeline: source→graph→layout→scene, error path preserves previous, directive-driven philosophy

---

### Chunk: renderer-pixi
**Tasks:** 4.5, 4.6, 4.8
**Agent:** SR | Opus (arch)
**Human:** approve (manual verification in browser)
**Context brief:**
  - Read `docs/superpowers/plans/2026-03-28-mermaid-render-impl.md` Task 6 (PixiJS code)
  - Read PixiJS 8 docs — verify `Application`, `Container`, `Graphics`, `Text`, `TextStyle` APIs
  - Read `packages/core/src/renderer/scene-model.ts` — the PixiJS layer reads from this
  - Read `packages/core/src/renderer/load-pipeline.ts` — the load path
  - Read `packages/core/src/interaction/fold-manager.ts` and `keyboard.ts` — wire these in
**Shared files:** `packages/core/src/renderer/viewport.ts`, `packages/core/src/renderer/node-sprite.ts`, `packages/core/src/renderer/edge-graphic.ts`, `packages/core/src/renderer/subgraph-container.ts`, `packages/core/src/renderer/mermaid-renderer.ts`, `packages/core/dev/*`
**Rollback:** Delete `packages/core/src/renderer/viewport.ts`, `node-sprite.ts`, `edge-graphic.ts`, `subgraph-container.ts`, `mermaid-renderer.ts`, `packages/core/dev/`
**Done when:** `pnpm --filter @mermaid-monkey/core build` → exit 0. Dev harness at localhost:3000 renders interactive diagram with fold/unfold and keyboard shortcuts.

---

### Chunk: renderer-harness
**Tasks:** 4.7
**Agent:** JR | Haiku (config)
**Human:** no
**Context brief:**
  - Read `packages/core/src/index.ts` for available exports
**Shared files:** `packages/core/dev/*`, `packages/core/vite.config.ts`
**Rollback:** Delete `packages/core/dev/` and `packages/core/vite.config.ts`
**Done when:** `cd packages/core && pnpm dev` → Vite starts on localhost:3000

---

### Chunk: vscode-scaffold
**Tasks:** 5.1, 5.2, 5.3
**Agent:** SR | Sonnet (multi-file)
**Human:** no
**Context brief:**
  - Read `docs/superpowers/plans/2026-03-28-mermaid-render-impl.md` Tasks 9 + 11
  - Read `docs/superpowers/specs/2026-03-28-mermaid-render-design.md` §4 VS Code Extension
  - Read VS Code Extension API docs for WebviewPanel, TreeDataProvider, commands
**Shared files:** `packages/vscode/*`
**Rollback:** Delete `packages/vscode/` directory
**Done when:** `pnpm --filter mermaid-monkey-vscode build` → `dist/extension.js` exists

---

### Chunk: vscode-webview
**Tasks:** 5.4, 5.5, 5.6
**Agent:** SR | Opus (arch)
**Human:** approve (manual verification in Extension Development Host)
**Context brief:**
  - Read `docs/superpowers/plans/2026-03-28-mermaid-render-impl.md` Tasks 10 + 12
  - Read `docs/superpowers/specs/2026-03-28-mermaid-render-design.md` §4.2 Renderer Panel, §4.3 Directive Resolution, §14 Cross-File Path Resolution, §15.1 Circular Cross-File Links
  - Read `packages/core/src/index.ts` for the public API surface
  - Read `packages/vscode/src/extension.ts` for message types expected
  - **Key complexity:** Bundling @mermaid-monkey/core + PixiJS + mermaid for the webview context (browser, iife). May need esbuild `define` or `alias` for mermaid's Node.js polyfills.
**Shared files:** `packages/vscode/src/renderer-panel.ts`, `packages/vscode/src/webview/webview.ts`, `packages/vscode/package.json`
**Rollback:** Revert renderer-panel.ts to placeholder HTML. Delete webview.ts.
**Done when:** F5 in VS Code → open `.mmd` file → "Mermaid: Open Preview" → diagram renders in webview panel. Saving file triggers hot-reload.

---

### Chunk: integration-verify
**Tasks:** 6.1, 6.2, 6.3, 6.4
**Agent:** SR | Sonnet (integration)
**Human:** approve (manual e2e verification)
**Context brief:**
  - Read all layout philosophy files in `docs/layout-philosophies/`
  - Read `docs/superpowers/specs/2026-03-28-mermaid-render-design.md` §5 Cross-File Linking for example syntax
  - Browse the full `packages/core/src/` and `packages/vscode/src/` to understand what's built
**Shared files:** `examples/*`
**Rollback:** Delete `examples/` directory
**Done when:** `pnpm build && pnpm test` → all pass. Dev harness renders all examples. VS Code extension previews all examples.

---

## Cross-Chunk Dependencies

```
parser-pipeline    requires  foundation
layout-engine      requires  foundation
renderer-logic     requires  parser-pipeline AND layout-engine
renderer-pixi      requires  renderer-logic
renderer-harness   requires  renderer-pixi
vscode-scaffold    requires  foundation
vscode-webview     requires  vscode-scaffold AND renderer-pixi
integration-verify requires  renderer-harness AND vscode-webview
```

---

## Concurrency Map

```
Wave 1: [foundation]
         ↓
Wave 2: [parser-pipeline || layout-engine || vscode-scaffold]
         ↓
Wave 3: [renderer-logic]        ← TDD: all logic tests written + passing
         ↓
Wave 4: [renderer-pixi]         ← thin PixiJS layer on top of tested logic
         ↓
Wave 5: [renderer-harness || vscode-webview]    ← 2 parallel
         ↓
Wave 6: [integration-verify]
```

**Max concurrent chunks:** 3 (Wave 2)
**Total chunks:** 10
**Estimated context cost:** 10 chunks x ~3K avg = ~30K tokens

---

## Token Budget Estimate

| Chunk | Tasks | Agent | Model | Est. Tokens |
|-------|-------|-------|-------|-------------|
| foundation | 6 | JR | Haiku | ~2K |
| parser-pipeline | 5 | SR | Sonnet | ~5K |
| layout-engine | 3 | SR | Sonnet | ~3K |
| renderer-core | 5 | SR | Opus | ~5K |
| renderer-harness | 1 | JR | Haiku | ~1K |
| renderer-interaction | 3 | SR | Sonnet | ~3K |
| vscode-scaffold | 3 | SR | Sonnet | ~3K |
| vscode-webview | 3 | SR | Opus | ~4K |
| integration-verify | 4 | SR | Sonnet | ~2K |
| **Total** | **33** | | | **~28K** |

---

## Overall Go/No-Go

- [ ] `pnpm build` — both packages build clean
- [ ] `pnpm test` — all unit tests pass
- [ ] Dev harness at localhost:3000 renders flowcharts with subgraphs
- [ ] All 4 layout philosophies produce visually distinct results
- [ ] Zoom, pan, fold/unfold, keyboard shortcuts work in dev harness
- [ ] VS Code extension activates, file explorer shows .mmd files
- [ ] VS Code preview panel renders diagrams with hot-reload on save
- [ ] Cross-file link click navigates to target file
- [ ] `git status` is clean, all work committed and pushed
