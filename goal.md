GOAL: Ship @mermaid-monkey/core v1.0.0 as a publishable, embeddable WEB rendering
  engine + a deployable demo web app. VS Code extension is OUT OF SCOPE this run.

  CONTEXT
  - Monorepo; this run touches only @mermaid-monkey/core (PixiJS engine) and its
    web harness (packages/core/dev/index.html, vite dev server on 127.0.0.1:3000).
  - Currently v0.1.0. 116 unit tests pass; core typechecks and builds clean
    (tsup → ~139KB ESM). Branch `main` is ahead of origin; working tree is dirty
    with in-flight visual fixes (see TASKS.md).
  - v1 web scope (docs/vision.md): interactive canvas (zoom/pan/fold), multi-file
    .mmd projects in-browser, cross-file %% @link navigation, backward-compatible
    Mermaid syntax, embeddable in any page with a <canvas>.
  - Deferred to v2 (DO NOT build): inline editing, collaboration, accessibility,
    export to image/PDF.

  DEFINITION OF DONE — every item verified by real command/browser output, not asserted:

  ENGINE CORRECTNESS
  1. Render-layer integration tests exercising the real PixiJS path in a headless
     browser (Playwright or vitest browser mode — jsdom cannot do getContext).
     Cover: load → layout → render, fold/unfold, focus navigation, fitToView bounds,
     philosophy switch preserving fold state. Fix the wire-hops test that currently
     logs a getContext error rather than ignoring it.
  2. Docs match code. Only `narrative` and `blueprint` are real layout engines;
     `map`, `radial`, `mosaic`, `breath` silently fall back to dagre
     (load-pipeline.ts createLayoutEngine). Resolve the gap: implement the missing
     layouts OR scope v1 to the 2 real ones and rewrite layout-philosophies/README.md
     + CLAUDE.md so no doc describes behavior the code lacks. Surface this scope call
     before large rewrites.

  WEB APP / EMBED
  3. Promote dev/index.html into a real, deployable static demo web app: loads the
     bundled examples/*.mmd, file selector for multi-file projects, philosophy
     switcher, fold/unfold + fit controls. Builds to static assets via `vite build`
     and serves from a plain static host (no server runtime).
  4. Documented public embed API in index.ts: a stable `MermaidRenderer` mount/load/
     destroy surface, plus a copy-paste embed snippet in the README showing how to
     render a diagram into a <canvas> on an arbitrary page. Pin the exported surface.
     README must also link to the explicit list of user/product problems this repo
     is trying to solve, so the project pitch and the release work stay connected.
  5. In-browser multi-file + cross-file @link resolution works without a filesystem:
     define and implement a browser resolver (fetch/virtual file map), and prove a
     click on a linked node navigates across files in the demo.
  6. Graceful failure in the browser: invalid/unparseable Mermaid shows a readable
     error state in the canvas/UI, never a blank screen or uncaught exception.

  BROWSER / RUNTIME QUALITY
  7. WebGPU-preferred with verified WebGL fallback: test and confirm the engine
     renders correctly in a browser context without WebGPU. Log which backend is
     active. No hard crash on either path.
  8. Performance: confirm the 60fps interaction target on a representative diagram,
     plus one large-graph stress example (hundreds of nodes) that still pans/zooms
     smoothly. Record the numbers.
  9. Responsive web layout: demo works on narrow/mobile viewports (controls reflow,
     labels don't collapse into a pile) — finish the responsive work started in
     TASKS.md and verify in a resized browser.
  10. Resolve the in-flight visual issues in TASKS.md so the example set renders
      correctly (no overlapping labels, edges trimmed to node boundaries, fit works).
      Commit the dirty tree intentionally, not as drift.

  RELEASE
  11. Bundle stays within the ~330KB core budget (tech.md), or the budget is updated
      with justification. Report final web bundle size.
  12. CI green on PR: lint + typecheck + unit tests + headless render tests + build +
      `vite build` of the demo. Documented, reproducible npm publish path for
      @mermaid-monkey/core and a static-deploy path for the demo app.

  VISUAL & RENDERING QUALITY
  Every item below is a visual invariant that must hold for the example set
  (examples/*.mmd) at min zoom, 1x, and high zoom, plus the large-graph stress
  example. Verify in-browser, capture before/after screenshots, and add a
  regression test (headless screenshot/bounds assertion) where feasible — a
  passing unit test that never touched a pixel does not count. These formalize the
  in-flight fixes in TASKS.md so they cannot silently regress.

  NODES & LABELS
  13. No node overlaps another node after layout in any philosophy. INVARIANT:
      for any two nodes, their rendered bounding boxes do not intersect (subgraph
      containment excepted). Assert on positioned bounds, not eyeballing.
  14. Every label is fully contained within its node's rendered shape — no text
      clipped at edges, no text spilling past the boundary. Long unbroken labels
      either wrap, truncate with ellipsis, or grow the node; pick one rule and
      apply it everywhere.
  15. Non-rectangular shapes (diamond, circle, hexagon) size to fit their label's
      inscribed area, not the bounding box — text never pokes outside the visible
      shape. (dagre/narrative already do shape-aware sizing; confirm it holds at
      render time, not just in layout.)
  16. Low-zoom legibility: labels scale with nodes instead of counter-scaling into
      an overlapping pile. INVARIANT: at min zoom, no two labels' rendered rects
      overlap. (Direct continuation of the TASKS.md node-sprite fix.)

  EDGES & WIRES
  17. Edges are trimmed to the node boundary and NEVER terminate at the label
      center. Arrowheads sit on the boundary and point along the final segment.
  18. No edge passes through an unrelated node. Blueprint guarantees this via the
      A* router; for narrative/dagre, either route around or explicitly document
      and accept the crossing level — no silent "spaghetti through boxes".
  19. Edge labels do not overlap their edge, other edges, or nodes. Multiple
      parallel edges between the same node pair are visually separated (offset or
      curved), not drawn on top of each other.
  20. Self-loops and bidirectional edges render as distinct, readable shapes (not
      a degenerate zero-length line or two arrowheads stacked at one point).

  HOVER
  21. Hover glow/highlight matches the node's ACTUAL current rendered bounds
      (including expanded label width), never a stale or pre-expansion size.
  22. Hover state always clears on pointer-leave — no stuck highlight. With
      overlapping or zoomed nodes, the topmost node under the cursor is the hover
      target, unambiguously.
  23. The cross-file @link hover preview popup positions fully on-screen (flips
      near canvas edges), does not flicker on small pointer moves, and dismisses
      reliably when the pointer leaves both the node and the popup.

  SELECTION
  24. Selection redraw uses the node's current bounds (the TASKS.md fix). Define
      and enforce one rule for selection lifetime: whether it survives or is
      cleared across re-layout, fold/unfold, focus navigation, and philosophy
      switch — and apply it consistently, no orphaned highlight on a moved/removed
      node.
  25. Clicking empty canvas deselects (the existing click-to-deselect toggle). The
      selected node's highlight renders above sibling nodes and edges, never hidden
      behind them. One coherent selection model — no two competing highlight paths.

  VIEWPORT / ZOOM / FIT
  26. fitToView fits the ACTUAL rendered bounds (nodes + edges + subgraphs), not an
      assumed (0,0) origin. Min/max zoom are clamped so labels never collapse into
      a pile (min) and text stays crisp via atlas re-render past ~4x (max).
  27. Pan/zoom can never strand all content off-canvas with no way back (a reset/
      fit affordance always recovers). On container resize the view re-fits and the
      canvas re-rasterizes at devicePixelRatio so text is crisp on retina/HiDPI.

  LAYERING / Z-ORDER
  28. Stable, documented paint order with no element hidden behind a layer it
      should sit above: subgraph backgrounds < edges < nodes < labels < link
      badges < hover/selection highlight < hover preview popup.

  SUBGRAPHS / FOLD / FOCUS
  29. Subgraph container bounds enclose all child content with consistent padding;
      nested containers don't clip their children or each other.
  30. Fold/unfold and focus navigation leave NO orphaned or stale sprites on the
      stage. Positions transition via spring easing without jumps, flicker, or
      double-drawn nodes. Fold state stays visually consistent after a philosophy
      switch (the existing setPhilosophy guarantee, verified visually).

  THEME / ROBUSTNESS
  31. A theme/philosophy switch recolors EVERY element — nodes, edges, edge labels,
      background, badges, highlights — with no element left in the previous theme.
      Font swaps (e.g. blueprint monospace) apply to all text.
  32. Degenerate inputs render cleanly with no overflow, crash, or NaN positions:
      empty graph, single node, deeply nested subgraphs, very long unbroken labels,
      unicode/emoji labels, and the hundreds-of-node stress graph.

  CROSS-FILE LINKING & EMBED LIFECYCLE
  Grounded in the current code: directive-extractor.ts parses @link into
  {targetFile, targetNode}; mermaid-renderer emits `link:navigate` with both; the
  dev harness (dev/main.ts) resolves against a hardcoded FILES map and warns to
  console on a miss. These items close the gaps that make cross-file linking the
  most half-built v1 feature.
  33. 🔴 The `#fragment` (targetNode) MUST drive navigation, not just file load.
      Today targetNode is parsed and emitted but the harness ignores it — clicking a
      link lands on the file but never focuses the node. INVARIANT: navigating a
      @link with a fragment ends with the target node focused/centered/highlighted;
      a @link without a fragment loads the file at its default fit. The headline
      cross-file feature is not "done" until fragment focus works.
  34. Broken links are VISIBLE, never silent. Today a missing file is a console.warn
      and a malformed @link line is silently dropped by the regex.
      WHEN a @link target file or fragment cannot be resolved:
        DETECT: at load (validate every @link against the resolver) and at click.
        USER SEES: the link badge rendered in a distinct "broken" state + a readable
                   message on click; never a dead click with no feedback.
        AUTHOR SEES: a parse/validation warning surfaced through the public API
                   (not only console), including malformed @link syntax.
  35. Define and document the link RESOLVER CONTRACT — there is currently none, the
      raw targetFile string is used as a map key. Specify: base path, how relative
      (`./`, `../`) vs absolute (`/`) paths resolve, `.mmd` extension handling, and
      normalization. INVARIANT: two links that point at the same file by different
      spellings resolve to the same canonical key.
  36. 🔴 The resolver is a TRUST BOUNDARY. targetFile is author-controlled; a web
      embed that fetch()es it raw is exposed to path traversal, SSRF, and arbitrary
      cross-origin/URL fetches. INVARIANT: the engine never fetches a raw
      author-supplied path. Resolution goes through a consumer-provided resolver or
      an explicit allowlist/virtual file map; out-of-scope targets are rejected, not
      fetched.
  37. The hover-preview async path is race-safe. link-preview.ts scheduleShow()
      awaits resolveGraph() then calls _show() with NO check that the component is
      still alive or still hovering the same node, and uses screenX/screenY captured
      300ms earlier.
      WHEN the resolve completes after the pointer left, the node changed, or the
      view moved/zoomed, OR the renderer was destroyed:
        the preview MUST NOT show (or must reposition to current coordinates).
        No operation on a destroyed container, no stale preview.
  38. Preview cache is bounded and not stale. link-preview.ts `_cache` is an
      unbounded Map, never evicted, and keyed only by file so it serves stale
      content after a file reloads. Add an eviction policy (size cap / LRU) and an
      invalidation hook on reload.
  39. The hover preview renders the target with the TARGET's own layout/theme, not
      hardcoded DagreLayout 'narrative' (current behavior) — a preview must not
      misrepresent how the target actually renders.
  40. Rapid/concurrent load() is last-write-wins. Clicking files quickly fires
      overlapping async loads (dev/main.ts loadFile); a slow earlier load resolving
      after a newer one MUST NOT clobber the current view. Use a load generation
      token; stale loads are discarded.
  41. Embed lifecycle is defined and safe:
      - mount() is idempotent/guarded — a second mount() on a live instance, or
        mounting an already-owned canvas, does not leak a second PixiJS app/context.
      - destroy() fully releases the WebGL/WebGPU context, the LinkPreview, the
        hover timer, and all listeners (verify with the browser's context counter /
        no leaked event handlers).
      - The post-destroy contract is explicit: calling load()/setPhilosophy()/mount()
        after destroy() either cleanly re-initializes or throws a clear error — never
        silently no-ops or operates on a dead context.
      - Multiple renderer instances on one page coexist (global font install in
        fonts.ts ensureFontsInstalled() must be safe under N instances).

  BROWSER / GPU RUNTIME ROBUSTNESS
  42. 🟠 No-GPU path never white-screens. Today init uses preference webgpu/webgl
      (mermaid-renderer.ts ~L76-86); if neither is available app.init() throws and
      mount() rejects. WHEN no usable GPU backend exists (locked-down browser,
      blocklisted GPU, headless): show a readable "rendering unavailable" state.
      ALSO: tech.md promises a "Canvas 2D fallback" — PixiJS v8 dropped the built-in
      canvas renderer, so either implement/secure a real fallback or correct the doc.
      No claim of a fallback that doesn't exist.
  43. WebGPU detection is real, not `'gpu' in navigator`. Presence of the API ≠ a
      usable adapter (requestAdapter() can return null on blocklisted hardware).
      Probe the adapter or rely on PixiJS's preference-with-fallback AND verify the
      active backend is logged/queryable. Preferring webgpu must never fail where
      webgl would have worked.
  44. GPU context loss is recoverable. Split the proof surface and close both:
      44a. WebGL context loss / restore and the no-adapter fallback path are
      recoverable. Register webglcontextlost/restored handlers and verify that
      WHEN the context is lost (tab backgrounded long, GPU reset, driver crash),
      the canvas re-initializes and re-renders on restore instead of going
      permanently blank.
      44b. On a real adapter-backed WebGPU runtime, the device-lost equivalent is
      recoverable too. Verify that a true WebGPU device-lost event re-initializes
      and re-renders instead of leaving the canvas blank.
  45. Documented performance ceiling + graceful degradation. Define the supported
      node/edge count for the 60fps target and what happens past it (the stress
      example from item 8 sets the floor) — no silent frame-rate collapse with no
      signal to the user.
  46. Backgrounded-tab and idle behavior: spring/ticker animations pause on
      visibilitychange and when no animation is in flight (no permanent
      render-loop burn).

  PHYSICS, ANIMATION & COLLISION
  Grounded in spring.ts (semi-implicit Euler, dt clamped to 1/30, isSettled at
  0.01), layout-animator.ts (its own requestAnimationFrame loop), and
  occupancy-grid.ts (Blueprint-only A* collision). Partially touched by items 13,
  18, 30 — these make the physics/collision contract explicit and verifiable.
  47. Springs never run forever or emit NaN. spring.ts has no guard against a NaN
      or non-finite target (a degenerate layout coordinate), and no max-duration
      cap — an unsettling spring loops requestAnimationFrame indefinitely.
      INVARIANT: a non-finite target is rejected/snapped; every animation settles
      within a bounded time, then the loop stops.
  48. Edges track their nodes DURING animation, not just after. Today
      LayoutAnimator springs node x/y but edges are not in the animation set, so
      wires visibly detach and float while nodes move, snapping back only at
      onComplete. INVARIANT: an edge's endpoints stay attached to its (moving)
      nodes every frame of the animation.
  49. Interrupted/cancelled animations leave no orphans. LayoutAnimator.cancel()
      empties _fadingSprites without calling removeSprite, so a fade-out
      interrupted by a new load() strands a half-transparent sprite on the stage.
      INVARIANT: cancel/interrupt either completes pending removals or hands them
      to the new animation; no orphaned or partial-alpha sprite survives.
  50. One coordinated animation clock. layout-animator.ts runs a private rAF loop
      independent of the PixiJS ticker — unify them (or document why two), and
      ensure both honor the item-46 idle/hidden pause so animations don't run
      frame-rate-dependent (the dt clamp makes sub-30fps animations wall-clock
      slow) or burn CPU when nothing moves.
  51. Collision-avoidance scope is explicit per philosophy, not implied. Only
      Blueprint routes around nodes (OccupancyGrid + A*); narrative/dagre/others
      draw through nodes. State the guarantee level for each philosophy in docs and
      code — no philosophy may silently imply collision-free routing it doesn't do.
  52. The occupancy grid reserves the RENDERED node footprint, not the layout one.
      node-sprite.ts expands a node's display width to fit an overflowing label
      (_displayWidth = labelWidth + 24), but occupancy-grid.ts markNode() uses the
      pre-expansion layout width — so wires route through the visible expanded
      label region. INVARIANT: the footprint marked occupied equals the footprint
      actually drawn (including label expansion and stroke width).
  53. Defined fallback when no route exists. When nodes are closer than
      2·COMPONENT_CLEARANCE (no free cell between them) or src/tgt are boxed in, A*
      returns no path. Specify the fallback (direct segment, nudge clearance, widen
      grid) and guarantee a wire is always drawn — never a dropped/invisible edge.
  54. Routing has a documented cost ceiling and deterministic ordering. The grid is
      a cols×rows Uint8Array over layout bounds (large/sparse graphs = large
      allocation), and wires are routed greedily in edge order (markPath blocks
      later wires), so output depends on edge order. Document the node/edge ceiling
      for routing and make ordering deterministic (stable sort), so the same graph
      always routes identically.

  COLOR & CONTRAST
  Grounded in theme.ts — six hand-tuned DARK themes, no contrast validation, plus
  a hardcoded broken-link red in node-sprite.ts. Extends item 31.
  55. Text meets a contrast floor. No theme currently validates nodeText/nodeFill,
      edgeLabelColor/background, or subgraphLabel/subgraphFill. INVARIANT: all text
      colors meet a documented contrast ratio (target WCAG AA ~4.5:1 for labels)
      against their actual backing color, verified per theme by a test.
  56. A light option exists and system preference is respected. All six themes are
      dark-only; an embeddable library on a light host page has no fit. Provide at
      least one light theme (or a documented custom-palette API) and honor
      prefers-color-scheme by default.
  57. Semantic colors are mutually distinguishable and never color-only. selected,
      hover, accent, broken-link, and nodeFill must be distinguishable from each
      other within every theme (e.g. Map's selected red 0xe94560 vs broken red
      0xf85149 are nearly identical). Status must also carry a non-color cue (icon,
      stroke, shape) so colorblind users can tell selected/broken/normal apart.
  58. All semantic colors come from the theme, not hardcoded. node-sprite.ts
      hardcodes broken-link 0xf85149 regardless of theme, clashing with non-red
      palettes (Blueprint, Radial). INVARIANT: every drawn color resolves from the
      active Theme; grep finds no literal hex color in render code.
  59. Depth tints exist for all themes and theme switch recolors LIVE sprites.
      subgraphDepthTints is defined only for Map, so deep nesting in other themes
      is flat. And NodeSprite captures `_theme` at construction — a setPhilosophy
      switch must propagate the new theme to existing sprites (or rebuild them);
      verify no element stays in the old palette (the mechanism behind item 31).

  HIGHLIGHT & EMPHASIS
  Grounded in node-sprite.ts: hover and selection share one _hoverGfx glow;
  selection adds only a stroke-color swap; no neighbor/edge emphasis exists.
  Extends items 21–25.
  60. Hover and selected are visually DISTINCT states. Today both light the same
      glow and selection adds only a stroke recolor (e.g. Blueprint's 1.5px stroke
      change is nearly invisible). Define a distinct visual language: hover = one
      treatment, selected = a clearly stronger/different treatment, and hovering an
      already-selected node still reads as both.
  61. Hovering/selecting a node emphasizes its connected edges and neighbors
      (BACKLOG P2). For a graph tool this is core: the node's edges and adjacent
      nodes highlight while the rest recede, so relationships are legible.
  62. Every highlight is perceptible in every theme. hoverGlowAlpha as low as 0.15
      (Breath) on a near-black fill may be imperceptible. INVARIANT: hover and
      selection affordances clear a minimum perceptible-difference threshold against
      each theme's node fill and background.
  63. Focus-dim keeps context readable and distinct from hidden. dimmedAlpha is 0.2
      everywhere; dimmed nodes/labels must stay legible enough to read as "context"
      and be visually distinct from removed/folded (alpha 0) elements — define the
      dim level against contrast, don't hardcode one alpha.
  64. One owner of emphasis, with correct z-order. Resolve the shared-_hoverGfx
      coupling so hover and selection don't fight over one graphic, and raise a
      hovered/selected node above occluding siblings (ties item 25) so its
      highlight is never hidden behind a neighbor.

  CONSTRAINTS
  - TDD: failing test before fix/feature. Verify with real output before any "done".
  - Engine stays framework-agnostic; no DOM-shell assumptions leak into core beyond a
    canvas element.
  - Every .mmd file remains valid standard Mermaid (cross-file links are comments).
  - Feature branch; surface the philosophy-scope decision (item 2) before rewriting.

  DELIVERABLE: a PR taking core from 0.1.0 to a tagged, tested, documented,
  npm-publishable 1.0.0 with an embeddable API and a deployable demo web app, CI green.
