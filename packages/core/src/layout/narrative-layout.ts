import dagre from '@dagrejs/dagre'
import { computeNodeLabelLayout } from './text-measure'
import { DagreLayout } from './dagre-layout'
import { estimateRenderedNodeFootprint } from '../node-footprint'
import type {
  RenderGraph,
  RenderEdge,
  RenderNode,
  PositionedGraph,
  PositionedNode,
  PositionedEdge,
  PositionedSubgraph,
} from '../types'
import type { LayoutEngine, LayoutOptions } from './layout-engine'
import { getPhilosophyConfig, type PhilosophyConfig } from './philosophy-config'

export type Lane = 'LEFT' | 'CENTER' | 'RIGHT'

/**
 * Maps graph direction strings to dagre rankdir values.
 */
function toRankDir(direction: string): 'TB' | 'LR' | 'BT' | 'RL' {
  const map: Record<string, 'TB' | 'LR' | 'BT' | 'RL'> = {
    TD: 'TB',
    TB: 'TB',
    LR: 'LR',
    BT: 'BT',
    RL: 'RL',
  }
  return map[direction] ?? 'TB'
}

/**
 * Narrative "flow lanes" layout engine.
 *
 * 1. Detect the spine — longest path from entry to exit node.
 * 2. Assign lanes — spine nodes go CENTER; at decision points (diamonds
 *    with multiple outgoing edges), the first branch stays on the spine
 *    path (RIGHT), and the second branch goes LEFT.
 * 3. After a merge (node with multiple incoming edges), return to CENTER.
 * 4. Use dagre for ordering along the flow axis, then override the
 *    cross-axis positions to enforce lanes. Lanes run parallel to the
 *    flow direction: vertical flows (TB/BT) keep dagre's y and constrain
 *    x into lane columns; horizontal flows (LR/RL) keep dagre's x and
 *    constrain y into lane rows. LEFT = -laneOffset, CENTER = 0,
 *    RIGHT = +laneOffset on the cross axis.
 * 5. Edge routing: spine edges are straight along the flow axis,
 *    cross-lane edges use smooth bezier curves.
 */
export class NarrativeLayout implements LayoutEngine {
  private readonly config: PhilosophyConfig
  private readonly multiplier: number
  private readonly laneWidth: number
  private readonly laneHeight: number

  constructor(options?: LayoutOptions) {
    const philosophy = options?.philosophy ?? 'narrative'
    this.config = getPhilosophyConfig(philosophy)
    this.multiplier = options?.spacingMultiplier ?? 1.0
    // Lane offsets: wide enough that nodes in adjacent lanes never overlap.
    // Vertical flows offset lanes along x, so node widths set the gap;
    // horizontal flows offset lanes along y, so node heights set the gap.
    this.laneWidth = (this.config.nodeMinWidth * 2 + this.config.nodeSep * 2) * this.multiplier
    this.laneHeight = (this.config.nodeMinHeight * 2 + this.config.nodeSep * 2) * this.multiplier
  }

  compute(graph: RenderGraph): PositionedGraph {
    // Handle empty graph
    if (graph.nodes.size === 0) {
      return {
        nodes: new Map(),
        edges: [],
        subgraphs: new Map(),
        width: 0,
        height: 0,
      }
    }

    // Narrative flow lanes have no notion of subgraph containment: the lane
    // projection collapses the cross axis to three rows, interleaving members
    // of different subgraphs and stacking same-rank nodes onto one point
    // (GH roughdraft#6: a 3-subgraph, ~40-node flowchart rendered as a pile).
    // Any subgraph diagram gets the standard two-pass dagre layout instead.
    if (graph.subgraphs.size > 0) {
      const fallback = new DagreLayout({ philosophy: 'narrative', spacingMultiplier: this.multiplier })
      return fallback.compute(graph)
    }

    // Step 1: Detect spine
    const spine = this.detectSpine(graph)

    // Step 2: Assign lanes
    const lanes = this.assignLanes(graph)

    // Step 3: Use dagre to get node ordering along the flow axis
    const dagrePositions = this._runDagre(graph)

    // Step 4: Override cross-axis positions based on lane assignment.
    // Vertical flows (TB/BT) constrain x and keep dagre's y; horizontal
    // flows (LR/RL) constrain y and keep dagre's x.
    const horizontal = this._isHorizontal(graph.direction)
    const laneOffset = horizontal ? this.laneHeight : this.laneWidth
    const cfg = this.config
    const m = this.multiplier
    const positionedNodes = new Map<string, PositionedNode>()

    // Compute the lane center on the cross axis from dagre's output
    // (use the average cross-axis position of spine nodes)
    let laneCenter = 0
    let spineCount = 0
    for (const nodeId of spine) {
      const pos = dagrePositions.get(nodeId)
      if (pos) {
        laneCenter += horizontal ? pos.y : pos.x
        spineCount++
      }
    }
    laneCenter = spineCount > 0 ? laneCenter / spineCount : 0

    for (const [id, node] of graph.nodes) {
      const dagrePos = dagrePositions.get(id)
      if (!dagrePos) continue

      const lane = lanes.get(id) ?? 'CENTER'
      let cross: number
      switch (lane) {
        case 'LEFT':
          cross = laneCenter - laneOffset
          break
        case 'RIGHT':
          cross = laneCenter + laneOffset
          break
        case 'CENTER':
        default:
          cross = laneCenter
          break
      }

      const { width, height } = this._nodeSize(node)

      positionedNodes.set(id, {
        ...node,
        x: horizontal ? dagrePos.x : cross,
        y: horizontal ? cross : dagrePos.y,
        width,
        height,
      })
    }

    // Lane projection is an opinionated squeeze of dagre's cross axis. On
    // graphs denser than the three-lane model can hold (e.g. several
    // same-rank branches forced into one lane), it stacks nodes onto each
    // other. The no-overlap invariant (goal.md item 13) outranks the lane
    // aesthetic, so delegate those graphs to the generic engine.
    if (this._hasRenderedOverlap(positionedNodes)) {
      const fallback = new DagreLayout({ philosophy: 'narrative', spacingMultiplier: this.multiplier })
      return fallback.compute(graph)
    }

    // Step 5: Route edges
    const positionedEdges = this._routeEdges(graph.edges, positionedNodes, lanes, horizontal)

    // Compute subgraph bounds
    const positionedSubgraphs = this._computeSubgraphBounds(graph, positionedNodes)

    // Compute total dimensions
    const allNodes = Array.from(positionedNodes.values())
    if (allNodes.length === 0) {
      return {
        nodes: positionedNodes,
        edges: positionedEdges,
        subgraphs: positionedSubgraphs,
        width: 0,
        height: 0,
      }
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const node of allNodes) {
      minX = Math.min(minX, node.x - node.width / 2)
      minY = Math.min(minY, node.y - node.height / 2)
      maxX = Math.max(maxX, node.x + node.width / 2)
      maxY = Math.max(maxY, node.y + node.height / 2)
    }

    const marginX = cfg.marginX * m
    const marginY = cfg.marginY * m

    return {
      nodes: positionedNodes,
      edges: positionedEdges,
      subgraphs: positionedSubgraphs,
      width: maxX - minX + marginX * 2,
      height: maxY - minY + marginY * 2,
    }
  }

  /**
   * Detect the spine: the longest path from an entry node (no incoming edges)
   * to an exit node (no outgoing edges).
   *
   * Uses DFS with memoization to find the longest path in the DAG.
   * For cyclic graphs, tracks visited nodes to avoid infinite loops.
   */
  detectSpine(graph: RenderGraph): string[] {
    if (graph.nodes.size === 0) return []

    // Build adjacency list
    const outgoing = new Map<string, string[]>()
    const incoming = new Map<string, string[]>()
    for (const [id] of graph.nodes) {
      outgoing.set(id, [])
      incoming.set(id, [])
    }
    for (const edge of graph.edges) {
      if (graph.nodes.has(edge.source) && graph.nodes.has(edge.target)) {
        outgoing.get(edge.source)!.push(edge.target)
        incoming.get(edge.target)!.push(edge.source)
      }
    }

    // Find entry nodes (no incoming edges)
    const entryNodes: string[] = []
    for (const [id] of graph.nodes) {
      if (incoming.get(id)!.length === 0) {
        entryNodes.push(id)
      }
    }

    // If no entry nodes (cycle), pick first node
    if (entryNodes.length === 0) {
      entryNodes.push(graph.nodes.keys().next().value as string)
    }

    // DFS with memoization to find longest path from each node
    const memo = new Map<string, string[]>()
    const inProgress = new Set<string>()

    const longestFrom = (nodeId: string): string[] => {
      if (memo.has(nodeId)) return memo.get(nodeId)!
      if (inProgress.has(nodeId)) return [nodeId] // cycle detected

      inProgress.add(nodeId)
      const neighbors = outgoing.get(nodeId) ?? []

      let bestPath: string[] = [nodeId]
      for (const next of neighbors) {
        const subpath = longestFrom(next)
        if (subpath.length + 1 > bestPath.length) {
          bestPath = [nodeId, ...subpath]
        }
      }

      inProgress.delete(nodeId)
      memo.set(nodeId, bestPath)
      return bestPath
    }

    // Find longest path from any entry node
    let spine: string[] = []
    for (const entry of entryNodes) {
      const path = longestFrom(entry)
      if (path.length > spine.length) {
        spine = path
      }
    }

    return spine
  }

  /**
   * Assign each node to a lane: LEFT, CENTER, or RIGHT.
   *
   * - Spine nodes -> CENTER
   * - At decision nodes (diamonds with 2+ outgoing), the branch that continues
   *   on the spine stays CENTER. The first off-spine branch -> RIGHT, second -> LEFT.
   * - Nodes with multiple incoming edges (merge nodes) -> CENTER.
   */
  assignLanes(graph: RenderGraph): Map<string, Lane> {
    const spine = this.detectSpine(graph)
    const spineSet = new Set(spine)
    const lanes = new Map<string, Lane>()

    // Build adjacency
    const outgoing = new Map<string, string[]>()
    const incoming = new Map<string, string[]>()
    for (const [id] of graph.nodes) {
      outgoing.set(id, [])
      incoming.set(id, [])
    }
    for (const edge of graph.edges) {
      if (graph.nodes.has(edge.source) && graph.nodes.has(edge.target)) {
        outgoing.get(edge.source)!.push(edge.target)
        incoming.get(edge.target)!.push(edge.source)
      }
    }

    // All spine nodes are CENTER
    for (const nodeId of spine) {
      lanes.set(nodeId, 'CENTER')
    }

    // Merge nodes (multiple incoming edges) are always CENTER
    for (const [id] of graph.nodes) {
      if (incoming.get(id)!.length > 1) {
        lanes.set(id, 'CENTER')
      }
    }

    // At decision nodes on the spine, assign off-spine branches
    for (const nodeId of spine) {
      const neighbors = outgoing.get(nodeId) ?? []
      if (neighbors.length <= 1) continue

      // Find which neighbor is on the spine (spine-continuation)
      const spineNext = neighbors.find((n) => spineSet.has(n))
      const offSpine = neighbors.filter((n) => n !== spineNext)

      // Assign off-spine branches
      let branchIndex = 0
      for (const branchTarget of offSpine) {
        if (lanes.has(branchTarget)) continue // already assigned (e.g., merge node)

        const lane: Lane = branchIndex === 0 ? 'LEFT' : 'RIGHT'
        branchIndex++

        // Assign this node and follow its chain until we hit a merge or spine node
        this._assignBranchLane(branchTarget, lane, lanes, outgoing, spineSet, incoming)
      }
    }

    // Any unassigned nodes default to CENTER
    for (const [id] of graph.nodes) {
      if (!lanes.has(id)) {
        lanes.set(id, 'CENTER')
      }
    }

    return lanes
  }

  /**
   * Recursively assign a lane to a branch chain until we hit a spine or merge node.
   */
  private _assignBranchLane(
    nodeId: string,
    lane: Lane,
    lanes: Map<string, Lane>,
    outgoing: Map<string, string[]>,
    spineSet: Set<string>,
    incoming: Map<string, string[]>,
  ): void {
    if (lanes.has(nodeId)) return // already assigned
    if (spineSet.has(nodeId)) return // spine node, keep CENTER

    // Merge nodes (multiple incoming) always go to CENTER
    if (incoming.get(nodeId)!.length > 1) {
      lanes.set(nodeId, 'CENTER')
      return
    }

    lanes.set(nodeId, lane)

    // Follow the chain
    const neighbors = outgoing.get(nodeId) ?? []
    for (const next of neighbors) {
      this._assignBranchLane(next, lane, lanes, outgoing, spineSet, incoming)
    }
  }

  /**
   * Whether the graph flows horizontally (LR/RL), meaning lanes constrain
   * y and dagre's x carries the flow ordering.
   */
  private _isHorizontal(direction: string): boolean {
    const rankDir = toRankDir(direction)
    return rankDir === 'LR' || rankDir === 'RL'
  }

  /**
   * Run dagre to get positions along the flow axis for all nodes.
   * Returns a map of nodeId -> { x, y, width, height } from dagre.
   */
  private _runDagre(graph: RenderGraph): Map<string, { x: number; y: number; width: number; height: number }> {
    const cfg = this.config
    const m = this.multiplier
    const g = new dagre.graphlib.Graph()

    g.setGraph({
      rankdir: toRankDir(graph.direction),
      nodesep: cfg.nodeSep * m,
      ranksep: cfg.rankSep * m,
      edgesep: cfg.edgeSep * m,
      marginx: cfg.marginX * m,
      marginy: cfg.marginY * m,
    })
    g.setDefaultEdgeLabel(() => ({}))

    for (const [id, node] of graph.nodes) {
      const size = this._nodeSize(node)
      g.setNode(id, {
        label: node.label,
        width: size.width,
        height: size.height,
      })
    }

    for (const edge of graph.edges) {
      if (graph.nodes.has(edge.source) && graph.nodes.has(edge.target)) {
        g.setEdge(edge.source, edge.target, {})
      }
    }

    dagre.layout(g)

    const positions = new Map<string, { x: number; y: number; width: number; height: number }>()
    for (const nodeId of g.nodes()) {
      const dagreNode = g.node(nodeId)
      if (dagreNode) {
        positions.set(nodeId, {
          x: dagreNode.x,
          y: dagreNode.y,
          width: dagreNode.width,
          height: dagreNode.height,
        })
      }
    }

    return positions
  }

  /**
   * Route edges with appropriate curves:
   * - Same-lane edges: straight line along the lane
   * - Cross-lane edges: smooth bezier with control points easing the
   *   cross-axis transition over the flow-axis distance
   */
  private _routeEdges(
    edges: RenderEdge[],
    nodes: Map<string, PositionedNode>,
    lanes: Map<string, Lane>,
    horizontal: boolean,
  ): PositionedEdge[] {
    const positionedEdges: PositionedEdge[] = []

    for (const edge of edges) {
      const srcNode = nodes.get(edge.source)
      const tgtNode = nodes.get(edge.target)
      if (!srcNode || !tgtNode) continue

      const srcLane = lanes.get(edge.source) ?? 'CENTER'
      const tgtLane = lanes.get(edge.target) ?? 'CENTER'
      const isSameLane = srcLane === tgtLane

      let points: Array<{ x: number; y: number }>

      if (isSameLane) {
        // Straight edge along the lane
        points = [
          { x: srcNode.x, y: srcNode.y },
          { x: tgtNode.x, y: tgtNode.y },
        ]
      } else {
        // Cross-lane: bezier curve with control points at 1/3 and 2/3 of
        // the flow-axis distance, easing the cross-axis transition
        const dy = tgtNode.y - srcNode.y
        const dx = tgtNode.x - srcNode.x

        points = horizontal
          ? [
              { x: srcNode.x, y: srcNode.y },
              { x: srcNode.x + dx * 0.33, y: srcNode.y + dy * 0.15 },
              { x: srcNode.x + dx * 0.5, y: srcNode.y + dy * 0.5 },
              { x: srcNode.x + dx * 0.67, y: srcNode.y + dy * 0.85 },
              { x: tgtNode.x, y: tgtNode.y },
            ]
          : [
              { x: srcNode.x, y: srcNode.y },
              { x: srcNode.x + dx * 0.15, y: srcNode.y + dy * 0.33 },
              { x: srcNode.x + dx * 0.5, y: srcNode.y + dy * 0.5 },
              { x: srcNode.x + dx * 0.85, y: srcNode.y + dy * 0.67 },
              { x: tgtNode.x, y: tgtNode.y },
            ]
      }

      positionedEdges.push({ ...edge, points })
    }

    return positionedEdges
  }

  /**
   * Compute subgraph bounding boxes from positioned member nodes.
   */
  private _computeSubgraphBounds(
    graph: RenderGraph,
    positionedNodes: Map<string, PositionedNode>,
  ): Map<string, PositionedSubgraph> {
    const positionedSubgraphs = new Map<string, PositionedSubgraph>()
    const m = this.multiplier
    const padding = 30 * m

    const pending = new Set(graph.subgraphs.keys())
    while (pending.size > 0) {
      let progressed = false

      for (const sgId of Array.from(pending)) {
        const sg = graph.subgraphs.get(sgId)!
        const memberNodes = sg.nodeIds
          .map((id) => positionedNodes.get(id))
          .filter((n): n is PositionedNode => n !== undefined)
        const childSubgraphs = sg.nodeIds
          .map((id) => positionedSubgraphs.get(id))
          .filter((subgraph): subgraph is PositionedSubgraph => subgraph !== undefined)
        const unresolvedChildren = sg.nodeIds
          .filter((id) => graph.subgraphs.has(id) && !positionedSubgraphs.has(id))

        if (memberNodes.length === 0 && childSubgraphs.length === 0) {
          pending.delete(sgId)
          progressed = true
          continue
        }

        if (unresolvedChildren.length > 0) continue

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const node of memberNodes) {
          minX = Math.min(minX, node.x - node.width / 2)
          minY = Math.min(minY, node.y - node.height / 2)
          maxX = Math.max(maxX, node.x + node.width / 2)
          maxY = Math.max(maxY, node.y + node.height / 2)
        }
        for (const subgraph of childSubgraphs) {
          minX = Math.min(minX, subgraph.x - subgraph.width / 2)
          minY = Math.min(minY, subgraph.y - subgraph.height / 2)
          maxX = Math.max(maxX, subgraph.x + subgraph.width / 2)
          maxY = Math.max(maxY, subgraph.y + subgraph.height / 2)
        }

        positionedSubgraphs.set(sgId, {
          ...sg,
          x: (minX + maxX) / 2,
          y: (minY + maxY) / 2,
          width: maxX - minX + padding * 2,
          height: maxY - minY + padding * 2 + 20,
        })
        pending.delete(sgId)
        progressed = true
      }

      if (!progressed) break
    }

    return positionedSubgraphs
  }

  /**
   * True when any two nodes' rendered footprints (layout size grown to the
   * true rendered label box) strictly intersect.
   */
  private _hasRenderedOverlap(nodes: Map<string, PositionedNode>): boolean {
    const rects: Array<{ left: number; right: number; top: number; bottom: number }> = []
    for (const node of nodes.values()) {
      const footprint = estimateRenderedNodeFootprint(node)
      rects.push({
        left: node.x - footprint.width / 2,
        right: node.x + footprint.width / 2,
        top: node.y - footprint.height / 2,
        bottom: node.y + footprint.height / 2,
      })
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]
        const b = rects[j]
        if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) {
          return true
        }
      }
    }
    return false
  }

  private _nodeSize(node: RenderNode): { width: number; height: number } {
    const labelLayout = computeNodeLabelLayout(
      node.label,
      this.config.nodeMinWidth,
      this.config.nodeMinHeight,
      this.config.nodePadding,
    )
    let width = labelLayout.width
    let height = labelLayout.height

    if (node.shape === 'diamond') {
      width = Math.ceil(width * 1.35)
      height = Math.ceil(height * 1.25)
    } else if (node.shape === 'circle') {
      const diameter = Math.max(width, height)
      width = diameter
      height = diameter
    } else if (node.shape === 'hexagon') {
      width = Math.ceil(width * 1.15)
    }

    return { width, height }
  }
}
