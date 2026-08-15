# Blueprint

> Precise, technical, aligned. Every pixel communicates structure.

## Intent

The diagram is a technical reference for live review. It will be read carefully, discussed, selected, folded, and revisited by a team. Alignment, symmetry, and precision communicate that "this is authoritative, this is exact." Nothing is accidental — if two nodes are at the same level, that means something. If an edge is horizontal, that means something.

Today, think: technical flowcharts, service dependency views, topology maps, and precise architecture relationships. Future fit includes class diagrams, ER diagrams, C4 Component/Code level, database schemas, API relationship maps, and type hierarchies once parser scope expands beyond `flowchart`.

## Gestalt Principles

### Symmetry & Order (Pragnanz)
The law of good form. The layout should feel intentional and ordered. The viewer's brain should immediately sense "this is organized" before reading any label. Alignment is the primary tool — columns, rows, baselines.

### Similarity
Shape encodes type. Rectangles for classes. Rounded rectangles for interfaces. Diamonds for abstract types. The viewer learns the visual vocabulary once and then reads the diagram through shape recognition alone.

### Continuity
Edges follow straight, predictable paths. Orthogonal routing (right angles only) creates a wiring-diagram feel. The viewer's eye can trace any connection without losing it in a tangle of curves.

### Closure
Related attributes or methods within a node are visually complete — bordered sections, dividing lines. A class node with properties and methods has clear internal structure, not just a blob of text.

## Layout Algorithm

Dagre with grid snapping. Nodes align to 20px grid positions after dagre layout.

- **Strict rank alignment.** Nodes at the same hierarchical depth share a baseline. If `User` and `Account` are both one level below `System`, they are at exactly the same Y-coordinate (in TD) or X-coordinate (in LR). No exceptions.
- **Column/row snapping.** Nodes align to the 20px grid. This creates visual columns (in TD layouts) or rows (in LR layouts) that the eye can scan.
- **Inheritance flows one direction.** Parent-child relationships (extends, implements) always flow in the primary direction. No backtracking.
- **Associations are horizontal.** Peer relationships (has-a, uses, references) are laid out horizontally between nodes at the same rank when possible.
- **Compact packing.** Minimize wasted space. Nodes should be close enough that relationships are obvious, but with enough gap that edges don't overlap nodes.

## Edge Routing

Current v1 shipped behavior: occupancy-grid-backed orthogonal routing on top of the Blueprint layout pass.

Today this means:

- node occupancy is based on the rendered node footprint, including long-label expansion
- the router uses a grid + A* search for collision-aware orthogonal paths
- routing order is deterministic rather than source-order dependent
- when no clear orthogonal path exists, the renderer still draws a visible fallback wire and surfaces congestion instead of dropping the edge silently

- **Port-based attachment.** Edges attach to specific ports on node borders (top, bottom, left, right), not to the nearest point. This creates predictable, clean connections.
- **Edge labels centered on segments.** Relationship labels (1..*, belongs_to, extends) sit on the horizontal or vertical segment of the edge, never at an angle.
- **No edge crossings when possible.** Reorder nodes within a rank to minimize crossings. When crossings are unavoidable, add a small gap at the crossing point for clarity.

## Visual Identity

Deep blueprint background (#00111f), secondary grid lines (#0c416d at 20px intervals), monospace font (JetBrains Mono / Fira Code via BitmapFont), nodes #063b70, white node text, and cyan interaction accents. Groups use a visible header band and count badge so a meeting can move by region before drilling into individual nodes.

## Spacing

- **Discussion-dense, not cramped.** Same gap between all adjacent nodes in a rank. Same gap between all ranks. The regularity communicates precision, but the default spacing leaves enough room for edge labels, routed wires, and group headers to stay readable in a shared topology review.
- **Compact node sizing.** Nodes are only as large as their content requires. No padding for aesthetics — padding is for readability.
- **Edge spacing consistent.** Parallel edges maintain consistent gaps between them.

## Node Sizing

- Driven entirely by content. A class with 10 methods is taller than one with 2. No artificial normalization.
- Internal structure is visible — properties section, methods section, separated by lines.
- Font is monospaced for type names and attributes. This is a technical document, not a poster.

## When To Use

Current v1 shipping parser/runtime support is `flowchart` only. The first three bullets below are the concrete shipped cases; the rest describe future fit once parser scope expands.

- Technical flowcharts that benefit from orthogonal routing and strict alignment
- Service dependency views rendered with current `flowchart` syntax
- Architecture relationship maps where precise spacing matters more than story flow
- Future class diagrams
- Future ER diagrams
- Future C4 Component and Code level diagrams
- Future database schema diagrams
- Future API relationship maps
- Future type hierarchies and inheritance trees
- Any future parser-supported diagram where precision and alignment are the primary value

## When NOT To Use

- Diagrams that tell a story (use **Narrative**)
- High-level overviews where regions matter more than individual nodes (use **Map**)
- Presentations where you want visual breathing room (use **Breath**)

## Directive

```mermaid
%% @layout blueprint
```

Directive: `%% @layout blueprint`
