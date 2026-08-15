# Blueprint Path Contract

**Date:** 2026-07-25  
**Status:** Draft for exhaustive behavioral coverage

## Purpose

Every rendered Blueprint edge must be the result of a named route plan. The
router may choose among planned alternatives, but it may not silently invent a
path, penetrate an obstacle, reverse hierarchy, or draw an unexplained fallback.

This contract complements the existing wire invariants. The invariants define
what every valid wire must satisfy; this document enumerates the route families
and input conditions that the implementation and tests must cover.

## Route Plan

Every routed edge must expose or internally produce this conceptual plan:

```ts
interface RoutePlan {
  edgeId: string
  routeClass:
    | 'direct'
    | 'single-bend'
    | 'dogleg'
    | 'fan-out-branch'
    | 'fan-in-branch'
    | 'feedback-loop'
    | 'parallel-lane'
    | 'explicit-fallback'
  sourceSide: 'top' | 'right' | 'bottom' | 'left'
  targetSide: 'top' | 'right' | 'bottom' | 'left'
  hierarchy: 'forward' | 'lateral' | 'feedback' | 'annotation'
  outcome: 'planned' | 'diagnosed-fallback' | 'rejected'
  diagnostic?: RouteDiagnostic
}
```

The public type may differ, but tests and diagnostics must be able to establish
the same facts.

## Selection Order

Candidate paths are compared lexicographically. A later criterion must never
win by violating an earlier one.

1. **Validity:** connected, orthogonal, finite, non-degenerate.
2. **Endpoint correctness:** starts and ends at the selected boundary ports;
   first and final segments follow those ports' outward/inward normals.
3. **Obstacle clearance:** avoids every non-endpoint rendered footprint plus
   component clearance.
4. **Hierarchy:** structural forward edges preserve the declared layout
   direction; feedback and annotation edges do not reorder structural stages.
5. **Route class:** use the planned class for the edge's topology and semantics.
6. **Locality:** stay inside the source-target corridor unless blocked or the
   edge is a planned feedback loop.
7. **Length:** minimize Manhattan length among candidates satisfying 1-6.
8. **Bends:** minimize bends among equal-length candidates.
9. **Crossings:** minimize new crossings, then make unavoidable crossings
   explicit with hops.
10. **Parallel separation:** reserve distinct lanes and avoid collinear overlap.
11. **Determinism:** stable result independent of input declaration order.

## Universal Assertions

Every accepted case below inherits these assertions.

| ID | Assertion |
|---|---|
| U-01 | Every segment is horizontal or vertical. |
| U-02 | The path is continuous from source port to target port. |
| U-03 | Every segment has positive length after simplification. |
| U-04 | The first segment follows the source port's outward normal. |
| U-05 | The final segment follows the target port's inward normal. |
| U-06 | The arrowhead points along the final segment into the target. |
| U-07 | No segment intersects a non-endpoint rendered footprint plus clearance. |
| U-08 | No two unrelated wires overlap collinearly. |
| U-09 | Parallel wires occupy distinct grid lanes. |
| U-10 | Every perpendicular crossing has exactly one visible hop treatment. |
| U-11 | Grid-aligned runs remain on grid; only boundary stubs may be off-grid. |
| U-12 | Consecutive collinear segments are collapsed. |
| U-13 | Consecutive bends are at least one grid step apart. |
| U-14 | Reordering input edges does not change geometry by edge ID. |
| U-15 | The renderer draws every planned wire exactly once. |
| U-16 | Any non-planned outcome carries a stable diagnostic code and edge ID. |

## Port-Pair Matrix

All 16 ordered source-side/target-side pairs are first-class cases. `S` is the
source side and `T` is the target side.

| ID | S | T | Required terminal behavior |
|---|---|---|---|
| P-PORT-01 | top | top | Exit upward; return to target from above. |
| P-PORT-02 | top | right | Exit upward; approach target from the right. |
| P-PORT-03 | top | bottom | Exit upward; approach target from below. |
| P-PORT-04 | top | left | Exit upward; approach target from the left. |
| P-PORT-05 | right | top | Exit rightward; approach target from above. |
| P-PORT-06 | right | right | Exit rightward; return to target from the right. |
| P-PORT-07 | right | bottom | Exit rightward; approach target from below. |
| P-PORT-08 | right | left | Exit rightward; approach target from the left. |
| P-PORT-09 | bottom | top | Exit downward; approach target from above. |
| P-PORT-10 | bottom | right | Exit downward; approach target from the right. |
| P-PORT-11 | bottom | bottom | Exit downward; return to target from below. |
| P-PORT-12 | bottom | left | Exit downward; approach target from the left. |
| P-PORT-13 | left | top | Exit leftward; approach target from above. |
| P-PORT-14 | left | right | Exit leftward; approach target from the right. |
| P-PORT-15 | left | bottom | Exit leftward; approach target from below. |
| P-PORT-16 | left | left | Exit leftward; return to target from the left. |

For same-side pairs, the path must leave the endpoint clearance zone before
turning back. For opposite-facing aligned pairs, a direct segment is preferred.

## Relative Geometry

Each port-pair family must be exercised against the geometry classes that can
change routing.

| ID | Geometry class | Required behavior |
|---|---|---|
| P-GEO-01 | Same x, target forward | Straight vertical when ports face each other. |
| P-GEO-02 | Same y, target forward | Straight horizontal when ports face each other. |
| P-GEO-03 | Offset in both axes | One bend if terminal normals permit; otherwise shortest dogleg. |
| P-GEO-04 | Target behind source | Planned return path outside endpoint clearances. |
| P-GEO-05 | Centers coincide, footprints differ | Deterministic non-degenerate route or explicit rejection. |
| P-GEO-06 | Ports snap to same cell | Preserve real boundary endpoints; no zero-length wire. |
| P-GEO-07 | Very close nodes | Respect clearance or diagnose insufficient corridor. |
| P-GEO-08 | Very distant nodes | Stay local; no diagram-perimeter detour without cause. |
| P-GEO-09 | Wide source or target | Use rendered footprint, not parser width. |
| P-GEO-10 | Tall source or target | Classify side from rendered boundaries, not center delta alone. |
| P-GEO-11 | Unequal dimensions | Correct boundary attachment on both nodes. |
| P-GEO-12 | Negative world coordinates | Same result after translation into positive coordinates. |

## Layout Directions And Hierarchy

| ID | Case | Required behavior |
|---|---|---|
| P-DIR-01 | `TD` structural edge | Forward path exits bottom and enters top when geometrically valid. |
| P-DIR-02 | `BT` structural edge | Forward path exits top and enters bottom. |
| P-DIR-03 | `LR` structural edge | Forward path exits right and enters left. |
| P-DIR-04 | `RL` structural edge | Forward path exits left and enters right. |
| P-DIR-05 | Lateral same-rank edge | Uses side ports and does not create a false stage. |
| P-DIR-06 | Structural edge declared backward | Classified as feedback or explicitly constrained; never silently reverses the main hierarchy. |
| P-DIR-07 | Dotted feedback edge | Uses an outer feedback lane and does not constrain rank. |
| P-DIR-08 | Dotted annotation edge | Remains local to its annotated node and does not move a structural sink. |
| P-DIR-09 | Mixed solid and dotted incident edges | Solid structure determines rank; dotted edges adapt around it. |
| P-DIR-10 | Direction change under responsive re-layout | Recomputes ports and paths for the new declared direction. |

## Topology Families

| ID | Topology | Required behavior |
|---|---|---|
| P-TOP-01 | Single edge | Direct, single-bend, or shortest dogleg route. |
| P-TOP-02 | Linear chain | Monotonic structural spine with local stage-to-stage paths. |
| P-TOP-03 | Diamond split/join | Symmetric fan-out and fan-in without overlapping branches. |
| P-TOP-04 | One-to-many fan-out | One trunk/bus plan; distinct target drops. |
| P-TOP-05 | Many-to-one fan-in | Distinct arrivals; one merge/trunk plan. |
| P-TOP-06 | Many-to-many | Stable lane allocation without accidental shared segments. |
| P-TOP-07 | Parallel edges, same endpoints | Each edge remains visible on a distinct planned lane. |
| P-TOP-08 | Opposite directed pair | Two distinguishable routes and arrow directions. |
| P-TOP-09 | Structural cycle | One edge is explicitly classified as feedback; main spine remains monotonic. |
| P-TOP-10 | Multiple nested cycles | Feedback lanes are ordered and non-overlapping. |
| P-TOP-11 | Self-loop | Planned self-loop geometry or explicit `SELF_LOOP_UNSUPPORTED`; never silently omitted. |
| P-TOP-12 | Disconnected components | Routing in one component does not distort another. |
| P-TOP-13 | Shared source plus shared target | Fan-out and fan-in zones compose without gaps. |
| P-TOP-14 | Dense bipartite block | Deterministic congestion outcome with explicit diagnostics. |
| P-TOP-15 | Long skip-stage edge | Uses an outer lane without obscuring intervening stages. |
| P-TOP-16 | Short edge beside long feedback edge | Short path remains local; feedback owns the perimeter lane. |

## Obstacle And Corridor Families

| ID | Case | Required behavior |
|---|---|---|
| P-OBS-01 | No obstacle | Select shortest valid path. |
| P-OBS-02 | Single blocker on direct axis | Use shortest clear side with deterministic tie-break. |
| P-OBS-03 | Equidistant upper/lower corridors | Stable documented tie-break independent of declaration order. |
| P-OBS-04 | Multiple staggered blockers | Shortest valid orthogonal maze path without micro-zigzags. |
| P-OBS-05 | Narrow one-track corridor | Use it when clearance permits. |
| P-OBS-06 | Corridor narrower than clearance | Do not penetrate; diagnose congestion. |
| P-OBS-07 | Closed wall | Explicit fallback/rejection; no line through the wall. |
| P-OBS-08 | Cul-de-sac | Backtrack and choose another corridor. |
| P-OBS-09 | Blocker adjacent to source | Preserve outward port escape without clearing the blocker globally. |
| P-OBS-10 | Blocker adjacent to target | Preserve inward terminal normal. |
| P-OBS-11 | Prior edge's endpoint node | Later wire cannot use another endpoint's temporary escape corridor. |
| P-OBS-12 | Rendered label exceeds node model | Route around rendered footprint. |
| P-OBS-13 | Decision diamond | Route around actual diamond bounds plus clearance. |
| P-OBS-14 | ER/class/table node | Route around compartment/table footprint. |
| P-OBS-15 | Annotation card | Treat it according to explicit annotation policy, never accidentally. |
| P-OBS-16 | Diagram boundary | Expand planned grid bounds before falling back. |

## Group And Subgraph Families

Subgraph borders are semantic containers, not node obstacles, unless a future
mode explicitly declares a strict boundary.

| ID | Case | Required behavior |
|---|---|---|
| P-GRP-01 | Edge within one subgraph | Local route inside the group where possible. |
| P-GRP-02 | Edge crossing one boundary | Cross the border once per necessary entry/exit. |
| P-GRP-03 | Edge between sibling subgraphs | Exit source group, traverse inter-group corridor, enter target group. |
| P-GRP-04 | Nested subgraph to ancestor | Cross only required nested boundaries. |
| P-GRP-05 | Nested subgraph to external node | Cross each containing boundary once. |
| P-GRP-06 | External node to nested target | Symmetric boundary behavior. |
| P-GRP-07 | Local subgraph direction differs | Honor local direction for member hierarchy and ports. |
| P-GRP-08 | Mixed local directions | Route each internal edge by its owning direction; inter-group edge by parent direction. |
| P-GRP-09 | Dotted cluster feedback | Does not invert solid cluster order. |
| P-GRP-10 | Empty or collapsed group | Stable route or explicit unavailable-anchor diagnostic. |
| P-GRP-11 | Overlapping group bounds after layout | Layout resolves overlap before routing. |
| P-GRP-12 | Group title/label footprint | Wires avoid the title region only if declared as an obstacle. |

## Wire Interaction Families

| ID | Case | Required behavior |
|---|---|---|
| P-WIRE-01 | Parallel horizontal runs | Separate by at least one grid lane. |
| P-WIRE-02 | Parallel vertical runs | Separate by at least one grid lane. |
| P-WIRE-03 | Collinear partial overlap | Prohibited for unrelated edges. |
| P-WIRE-04 | Collinear full overlap | Prohibited unless represented as an explicit shared bus. |
| P-WIRE-05 | Perpendicular crossing | One hop; stable over selection/hover. |
| P-WIRE-06 | Crossing at a bend | Reroute or unambiguously render; no malformed hop. |
| P-WIRE-07 | Crossing at a port | Prohibited for unrelated edges. |
| P-WIRE-08 | Touching without crossing | Must not be misread as connectivity. |
| P-WIRE-09 | Shared fan-out bus | Shared segment is explicit and branches remain attributable. |
| P-WIRE-10 | Shared fan-in merge | Shared segment is explicit and incoming edges remain attributable. |
| P-WIRE-11 | Route reservation | Every accepted path reserves its complete occupancy before the next edge. |
| P-WIRE-12 | Input edge order permutation | Same geometry by edge ID. |
| P-WIRE-13 | Node order permutation | Same geometry by node ID. |
| P-WIRE-14 | Translation of whole graph | Geometry translates exactly; route class is unchanged. |
| P-WIRE-15 | Uniform scaling of node gaps by grid multiples | Topology and port choices remain stable. |

## Edge Semantics And Decoration

| ID | Case | Required behavior |
|---|---|---|
| P-SEM-01 | Solid structural edge | Constrains hierarchy and receives normal emphasis. |
| P-SEM-02 | Dotted annotation edge | Does not constrain hierarchy; local annotation route. |
| P-SEM-03 | Dotted feedback edge | Does not constrain hierarchy; outer feedback route. |
| P-SEM-04 | Labeled edge | Label sits on a stable straight run without covering a node or bend. |
| P-SEM-05 | Long label | Allocate label clearance or diagnose overlap. |
| P-SEM-06 | Arrow at top port | Points down into target. |
| P-SEM-07 | Arrow at right port | Points left into target. |
| P-SEM-08 | Arrow at bottom port | Points up into target. |
| P-SEM-09 | Arrow at left port | Points right into target. |
| P-SEM-10 | Bidirectional or alternate Mermaid arrow type | Preserve authored endpoint semantics or diagnose unsupported syntax. |
| P-SEM-11 | Hovered edge | Increase emphasis and connected-node emphasis without changing geometry. |
| P-SEM-12 | Selected edge | Persist emphasis without changing route or z-order. |
| P-SEM-13 | Commented edge | Comment icon avoids label, arrowhead, bend, and crossing. |
| P-SEM-14 | AI/reply/resolved comment states | Marker changes state without changing the routed path. |

## Dynamic And Viewport Cases

| ID | Case | Required behavior |
|---|---|---|
| P-DYN-01 | Host grows | Canvas/grid covers host; existing pan/zoom remains unchanged. |
| P-DYN-02 | Host shrinks | Canvas/grid clips cleanly; no layout stretch or route mutation. |
| P-DYN-03 | Split divider moves | Each canvas resizes independently; no stale backing dimensions. |
| P-DYN-04 | Focus mode enter/exit | Same route geometry and viewport state are restored. |
| P-DYN-05 | Theme switch | Colors change; geometry and hit areas do not. |
| P-DYN-06 | Node hover/select | Z-order emphasis does not alter path ownership. |
| P-DYN-07 | Node collapse/expand | Re-layout and reroute once from the new declared graph state. |
| P-DYN-08 | Linked-tab switch | Each tab retains its own viewport and deterministic routes. |
| P-DYN-09 | Re-render same source | Bitwise-equivalent route plan and coordinates. |
| P-DYN-10 | Font readiness changes footprint | Perform one planned re-layout; never stretch existing geometry. |

## Invalid Input And Failure Outcomes

| ID | Case | Required outcome |
|---|---|---|
| P-ERR-01 | Missing source node | Reject edge with `SOURCE_NOT_FOUND`. |
| P-ERR-02 | Missing target node | Reject edge with `TARGET_NOT_FOUND`. |
| P-ERR-03 | Non-finite node coordinates | Reject graph with `INVALID_NODE_GEOMETRY`. |
| P-ERR-04 | Non-positive footprint | Reject or normalize with an explicit diagnostic. |
| P-ERR-05 | Unknown port side | Reject route plan; do not assume a side silently. |
| P-ERR-06 | No clear path in current bounds | Expand planned bounds and retry. |
| P-ERR-07 | No clear path after bounded retries | Produce `NO_CLEAR_PATH`; do not cross a node. |
| P-ERR-08 | Occupancy conflict after reservation | Re-plan deterministically or emit `LANE_CONFLICT`. |
| P-ERR-09 | Unsupported self-loop | Emit `SELF_LOOP_UNSUPPORTED`, not a missing wire. |
| P-ERR-10 | Unsupported edge semantics | Preserve a visible diagnosed edge or reject explicitly. |
| P-ERR-11 | Router iteration limit | Emit `ROUTE_SEARCH_EXHAUSTED` with edge ID. |
| P-ERR-12 | Layout hierarchy conflict | Emit `HIERARCHY_CONFLICT`; do not reorder silently. |

## Explicitly Prohibited Rendering

| ID | Prohibited output |
|---|---|
| P-NO-01 | A wire passing through any non-endpoint node body. |
| P-NO-02 | A side-port target receiving a perpendicular final segment. |
| P-NO-03 | An arrowhead pointing away from the target. |
| P-NO-04 | A structural happy-path edge taking the diagram perimeter without an obstacle reason. |
| P-NO-05 | A dotted annotation moving a structurally ranked node or cluster. |
| P-NO-06 | A feedback edge reversing the main stage order. |
| P-NO-07 | Two unrelated wires sharing a collinear run. |
| P-NO-08 | A zero-length segment or repeated point. |
| P-NO-09 | A micro-zigzag when a shorter equal-validity path exists. |
| P-NO-10 | A route that changes when input arrays are permuted. |
| P-NO-11 | A missing edge without a diagnostic. |
| P-NO-12 | A visible fallback using the same visual treatment as a valid planned route. |
| P-NO-13 | A grid or wire field ending inside the visible canvas after resize. |
| P-NO-14 | A hover, selection, comment, or theme action changing path geometry. |

## Test Mapping

The suite must use these IDs in test names or table rows.

1. **Generated unit matrices**
   - `P-PORT-01..16`: terminal-normal tests.
   - `P-SEM-06..09`: arrow-direction tests.
   - `P-DIR-01..04`: layout-direction tests.
   - `P-WIRE-12..15`: property/permutation/translation tests.
2. **Router integration fixtures**
   - `P-GEO-*`, `P-TOP-*`, `P-OBS-*`, `P-WIRE-*`.
3. **Layout plus router fixtures**
   - `P-DIR-*`, `P-GRP-*`, structural/annotation/feedback semantics.
4. **Renderer integration fixtures**
   - crossings, hops, arrows, labels, hit areas, comments, theme invariance.
5. **Browser acceptance fixtures**
   - `P-DYN-*`, especially split resize, focus restore, linked tabs, and grid
     coverage.

No case may be marked covered solely because a lower-level helper passes. The
coverage ledger must name the highest realistic boundary that proves the
behavior.

## Test Execution Policy

The exhaustive path matrix is an opt-in diagnostic suite. It must not run as
part of ordinary application tests, the normal core package test command, or
the default local pre-commit loop.

The routing tests are split into two tiers:

1. **Always-on route smoke**
   - Universal route validity and diagnostics.
   - One representative direct edge, obstacle detour, fan-out, fan-in,
     feedback loop, side-port arrow, and resize/grid case.
   - Runs in normal core tests and CI.
2. **Exhaustive route contract**
   - Every `P-*` matrix case and permutation/property expansion.
   - Runs only through a dedicated command such as
     `pnpm test:routing:exhaustive`.
   - Used while debugging or changing routing, for scheduled CI, and before a
     routing-focused release.

The exhaustive files must use a distinct filename or Vitest project/include
pattern so `pnpm test` cannot discover them accidentally. Dedicated CI may run
the exhaustive command separately without delaying unrelated pull requests.
