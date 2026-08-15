# Pain Points — User Validation

Evidence gathered from Mermaid.js GitHub issues (as of March 2026) confirming the problems Mermaid Monkey solves.

## Summary

The four core features of Mermaid Monkey each map to highly-requested, unresolved Mermaid issues that have been open for years.

## Zoom & Pan

Users cannot zoom or pan Mermaid diagrams. Large diagrams are shrunk to fit the page, becoming unreadable.

- **#1860 — "ZOOM!!!"** (open, 35 reactions, 22 comments)
  Large diagrams are unreadable, no zoom capability exists.
  https://github.com/mermaid-js/mermaid/issues/1860

- **#2162 — "Ability to zoom HTML diagram"** (open, 11 reactions, 13 comments)
  Page shrinks complex flowcharts to fit, unreadable on small screens.
  https://github.com/mermaid-js/mermaid/issues/2162

- **#399 — "Can't Zoom the flowchart?"** (open)
  Diagrams fill the screen with many nodes, can't zoom to see clearly.
  https://github.com/mermaid-js/mermaid/issues/399

- **#535 — "Add drag and zoom?"** (open)
  User created a large graph, needs pan and zoom.
  https://github.com/mermaid-js/mermaid/issues/535

- **#756 — "Text is too small to read when the diagram becomes bigger"** (open)
  Text becomes illegible as diagrams scale.
  https://github.com/mermaid-js/mermaid/issues/756

## Node Folding / Collapse

Complex diagrams overwhelm users. No way to collapse sections and progressively reveal detail.

- **#5508 — "Click/hover to Expand or collapse subgraphs"** (open, 20 reactions, 14 comments)
  Proposes CollapsedByDefault, Expand on hover/click for subgraph sections.
  https://github.com/mermaid-js/mermaid/issues/5508

- **#1123 — "Fold out / collapse flowchart"** (closed, unresolved, 3 reactions)
  "Complicated flow charts are hard to grasp." Wants to see only the start until the first split, then expand branches.
  https://github.com/mermaid-js/mermaid/issues/1123

## Multi-File / Import

No way to decompose large diagrams across files. Common components can't be reused.

- **#4673 — "import / include mmd syntax"** (open, 32 reactions, 8 comments)
  "Mermaid.js should add a syntax for including other mmd files, so that common actors/participants in Sequence and other diagrams can be referenced."
  https://github.com/mermaid-js/mermaid/issues/4673

## Performance on Large Diagrams

Mermaid's SVG renderer chokes on large inputs, freezing the entire browser page.

- **#1216 — "Mermaid hangs up current page on large inputs"** (open)
  Rendering large diagrams makes the page unresponsive.
  https://github.com/mermaid-js/mermaid/issues/1216

- **#6781 — "Excessive vertical space in complex diagrams"**
  Default node height and spacing cause complex diagrams to consume excessive space, impairing readability.
  https://github.com/mermaid-js/mermaid/issues/6781

## Layout Quality & Control

Users can't control how diagrams look. No way to adjust spacing, align nodes, choose edge styles, or group items visually. The auto-layout produces cluttered, illegible results with no recourse.

- **#2028 — "Use swimlanes in flowchart diagram"** (open, **392 reactions**)
  Can't group flows into lanes. Highest-voted layout request.
  https://github.com/mermaid-js/mermaid/issues/2028

- **#2817 — "Feature request: straight lines"** (open, **124 reactions**)
  Only curved edges available. Users want straight/orthogonal routing for cleaner diagrams.
  https://github.com/mermaid-js/mermaid/issues/2817

- **#3723 — "Support specifying that two nodes should be at the same level/rank"** (open, **84 reactions**)
  No way to align nodes horizontally. Layout decides arbitrarily.
  https://github.com/mermaid-js/mermaid/issues/3723

- **#2549 — "Right-angle arrows instead of curved"** (open, **74 reactions**)
  Want orthogonal edge routing for technical diagrams.
  https://github.com/mermaid-js/mermaid/issues/2549

- **#2977 — "Move subgraph label to bottom left corner"** (open, **71 reactions**)
  Subgraph labels cover content, no control over placement.
  https://github.com/mermaid-js/mermaid/issues/2977

- **#1209 — "Subgraph label spacing missing"** (open, **62 reactions**)
  No padding control around subgraph labels.
  https://github.com/mermaid-js/mermaid/issues/1209

- **#3806 — "Multiline title overlaps nodes"** (open, **50 reactions**)
  Long subgraph titles collide with node content.
  https://github.com/mermaid-js/mermaid/issues/3806

- **#5420 — "Add positioning for elk layout"** (open, **45 reactions**)
  No horizontal/vertical ordering control in ELK renderer.
  https://github.com/mermaid-js/mermaid/issues/5420

- **#5653 — "Layout configuration for mindmaps"** (open, **39 reactions**)
  Mindmap layout has no configuration, resulting in cluttered diagrams.
  https://github.com/mermaid-js/mermaid/issues/5653

- **#1984 — "Massive whitespace above and below graph"** (open, **39 reactions**)
  Wasted space makes diagrams hard to embed.
  https://github.com/mermaid-js/mermaid/issues/1984

- **#270 — "Allow user to designate node position"** (closed, **11 reactions**)
  Requested since 2015. Never implemented.
  https://github.com/mermaid-js/mermaid/issues/270

- **#1986 — "Wildly inconsistent spacing and object order"** (open, **5 reactions**)
  Layout produces unpredictable results.
  https://github.com/mermaid-js/mermaid/issues/1986

## Other Relevant Complaints

- Character encoding bugs in mindmaps
- No server-side rendering without a browser environment
- Accessibility: diagrams not accessible to screen readers

## Conclusion

The pain is real, documented, highly upvoted, and unresolved for years (some since 2015). Mermaid Monkey addresses the top 5 most-requested categories:

1. **Zoom & Pan** — 46+ reactions across multiple issues
2. **Node Folding** — 23+ reactions
3. **Multi-File Import** — 32 reactions
4. **Performance** — page-hanging on large diagrams
5. **Layout Quality & Control** — **392+ reactions** on the top issue alone, 600+ combined across all layout issues. This is the single biggest pain point in the entire Mermaid project.
