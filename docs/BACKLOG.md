# mermaid-monkey Backlog

Central tracking for all pending work. Ordered by priority within each section.

---

## P0 — Critical (Blocks Usability)

- [ ] **Narrative flow lanes** — Detect longest path as spine. Decision nodes split: Yes→right, No→left. After merge, return to center. Currently all philosophies use same dagre layout.
- [ ] **Map force-directed layout** — Add d3-force dependency. Implement force simulation with attraction, repulsion, cluster gravity. Replace dagre for Map philosophy.
- [ ] **Blueprint visual identity** — Grid background (#001a33 with #003366 lines at 20px), monospace font (JetBrains Mono via BitmapFont), actual blueprint blue colors, grid-snap node positions.
- [ ] **Blueprint edge collision avoidance** — Straight/diagonal lines that route around nodes when they would intersect. Physics-based path finding.
- [ ] **Edge routing quality** — Current edges are straight spaghetti lines. Need bezier curves for Narrative, bundled curves for Map, straight+collision for Blueprint, whisper lines for Breath.
- [ ] **Spring animation on state changes** — Philosophy switch, fold/unfold, focus navigation, fitToView should all use spring physics easing. PixiJS ticker-based spring formula.

## P1 — Important (Improves Experience)

- [ ] **Breath whisper lines** — Edges at 1px, 0.3 opacity. Edge labels hidden by default, shown on hover.
- [ ] **Breath 3-4x spacing** — Larger nodes (200x60), bigger fonts (18px), massive gaps. Presentation mode.
- [ ] **Radial layout** — New philosophy. Central node with concentric rings. Curved arc edges. d3-hierarchy or custom radial positioning.
- [ ] **Mosaic layout** — New philosophy. Masonry card grid. No visible edges. Proximity = connection. 300x100 cards.
- [ ] **Focus dim modes** — Provide all 4 as toggleable options: fade, hide, blur, push-to-edges.
- [ ] **Collapsed card mini preview** — Folded subgraphs show tiny dot-layout of internal structure (thumbnail).
- [ ] **@rank directive enforcement** — Force nodes to same y-coordinate in layout.
- [ ] **@pin directive enforcement** — Lock node at fixed position, layout flows around it.
- [ ] **Swimlanes for Map** — Detect lane-like subgraph arrangements, render divider lines.

## P2 — Polish

- [ ] **Orthogonal edges option** — Right-angle routing with rounded corners for Blueprint.
- [ ] **Edge bundling for Map** — Multiple edges between same cluster pair merge visually.
- [ ] **Hover connection highlight** — Hovering a node highlights all its edges and connected nodes.
- [ ] **Zoom animation on philosophy switch** — Crossfade between old and new rendering.
- [ ] **Breathing simulation for Map** — Force sim stays alive, nodes gently drift.
- [ ] **BitmapText at arbitrary zoom** — Re-render font atlas at higher resolution when zoom exceeds 4x.
- [ ] **Minimap** — Small overview in corner showing full diagram with viewport rectangle.

## P3 — Future

- [ ] **Inline editing** — Add/modify nodes visually.
- [ ] **Real-time collaboration** — Multi-user editing via CRDT.
- [ ] **Export to image/PDF** — Render to PNG/SVG/PDF.
- [ ] **Custom themes** — User-defined color palettes beyond the 6 philosophies.
- [ ] **Accessibility** — Parallel ARIA tree for screen readers.
- [ ] **Server-side rendering** — Headless rendering for CI/thumbnails.

---

## Completed

- [x] Monorepo scaffold (pnpm, tsup, esbuild, vitest)
- [x] Core types (RenderGraph, PositionedGraph, directives)
- [x] Directive extractor (@link, @layout, @pin, @rank, @spacing)
- [x] Mermaid parser adapter (flowchart graph builder)
- [x] Dagre layout engine with philosophy spacing configs
- [x] Two-pass layout (cluster-level + internal, no overlap)
- [x] PixiJS renderer (viewport, node sprites, edges, subgraphs)
- [x] Zoom/pan interaction
- [x] Node folding (collapse/expand subgraphs)
- [x] Focus navigation (re-render subgraph contents)
- [x] Breadcrumb bar with back navigation
- [x] Semantic zoom (progressive disclosure)
- [x] 4 monochrome themes (Ink, Atlas, Grid, Void)
- [x] Cross-file @link directives + badge indicators
- [x] Wiki-style hover preview (single PixiJS context)
- [x] Multi-file dev harness with file selector
- [x] VS Code extension scaffold (commands, file explorer, webview)
- [x] WebGPU preference with WebGL fallback
- [x] Click-to-deselect toggle
- [x] setPhilosophy preserves fold state
- [x] 43 unit tests + 5 BDD feature files
- [x] 6 philosophy specs (Narrative, Map, Blueprint, Breath, Radial, Mosaic)
- [x] CLAUDE.md for philosophy contributor guide
