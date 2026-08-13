import dagre from '@dagrejs/dagre'
import { computeNodeLabelLayout, computeNodeWidth, measureTextWidth } from './text-measure'
import { computeErEntityTableLayout } from '../er-table-layout'
import { computeClassCompartmentLayout } from '../class-compartment-layout'
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

const SUBGRAPH_LABEL_FONT_SIZE = 13
const SUBGRAPH_LABEL_LEFT_INSET = 26
const SUBGRAPH_LABEL_RIGHT_INSET = 10
const SUBGRAPH_BADGE_GAP = 8
const SUBGRAPH_BADGE_MIN_WIDTH = 24
const SUBGRAPH_BADGE_PADDING = 14
const SUBGRAPH_BADGE_CHAR_WIDTH = 7
const SUBGRAPH_HEADER_EXTRA = 12

/**
 * Maps graph direction strings (TD, TB, LR, BT, RL) to dagre rankdir values.
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
 * Two-pass dagre layout engine that prevents subgraph overlap.
 *
 * Pass 1 — Cluster layout: each subgraph is treated as a single node.
 *   Dagre positions them with generous spacing.
 *
 * Pass 2 — Internal layout: for each subgraph, dagre runs independently
 *   on its internal nodes. Results are placed within the bounding box
 *   assigned by pass 1.
 *
 * Combine: internal node positions are translated to their subgraph's
 *   assigned global position. Edges are routed between clusters.
 *
 * Falls back to single-pass when there are no subgraphs or when all
 * subgraphs are collapsed.
 */
export class DagreLayout implements LayoutEngine {
  private readonly config: PhilosophyConfig
  private readonly multiplier: number
  private readonly philosophy: string

  constructor(options?: LayoutOptions) {
    const philosophy = options?.philosophy ?? 'narrative'
    this.philosophy = philosophy
    this.config = getPhilosophyConfig(philosophy)
    this.multiplier = options?.spacingMultiplier ?? 1.0
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

    // Determine which nodes are hidden due to collapsed subgraphs
    const hiddenNodeIds = new Set<string>()
    const collapsedSubgraphs = new Map<string, string[]>() // sgId -> nodeIds

    for (const [sgId, sg] of graph.subgraphs) {
      if (sg.collapsed) {
        collapsedSubgraphs.set(sgId, sg.nodeIds)
        for (const nodeId of sg.nodeIds) {
          hiddenNodeIds.add(nodeId)
        }
      }
    }

    const parentSubgraphIds = new Set<string>()
    for (const [sgId, sg] of graph.subgraphs) {
      if (sg.collapsed) continue
      if (sg.nodeIds.some((id) => graph.subgraphs.has(id))) {
        parentSubgraphIds.add(sgId)
      }
    }

    // Gather active (non-collapsed) leaf subgraphs. Parent wrappers are
    // derived from positioned descendants after cluster layout.
    const activeSubgraphs = new Map<string, { id: string; label: string; nodeIds: string[]; direction?: string }>()
    for (const [sgId, sg] of graph.subgraphs) {
      if (!sg.collapsed) {
        const visibleNodes = sg.nodeIds.filter((id) => graph.nodes.has(id) && !hiddenNodeIds.has(id))
        if (visibleNodes.length > 0 && !parentSubgraphIds.has(sgId)) {
          activeSubgraphs.set(sgId, { id: sgId, label: sg.label, nodeIds: visibleNodes, direction: sg.direction })
        }
      }
    }

    // Nodes whose id names a subgraph are cluster aliases: the parser creates
    // them for edges that point at the subgraph itself (e.g. `X -.-> Cluster`).
    // They must not participate as free nodes — adding one to the cluster
    // graph under the same id overwrites the cluster's computed dimensions,
    // collapsing the space dagre reserves for the cluster's members and piling
    // neighbors on top of them (GH roughdraft#6).
    const clusterAliasIds = this._clusterAliasIds(graph)

    // Identify orphan nodes (not in any active subgraph)
    const nodesInSubgraphs = new Set<string>()
    for (const sg of activeSubgraphs.values()) {
      for (const nid of sg.nodeIds) nodesInSubgraphs.add(nid)
    }
    const orphanNodeIds: string[] = []
    for (const [id] of graph.nodes) {
      if (!hiddenNodeIds.has(id) && !nodesInSubgraphs.has(id) && !clusterAliasIds.has(id)) {
        orphanNodeIds.push(id)
      }
    }

    // Also include collapsed subgraph summary nodes as orphans in cluster graph
    const collapsedSgIds = Array.from(collapsedSubgraphs.keys())

    // If no active subgraphs, use single-pass layout (original behavior)
    if (activeSubgraphs.size === 0) {
      return this._singlePassLayout(graph, hiddenNodeIds, collapsedSubgraphs)
    }

    if (
      this.philosophy === 'blueprint'
      && ['LR', 'RL'].includes(graph.direction)
      && graph.nodes.size >= 35
      && activeSubgraphs.size >= 5
    ) {
      return this._singlePassLayout(graph, hiddenNodeIds, collapsedSubgraphs)
    }

    // ═══════ PASS 1: Cluster-level layout ═══════
    // Each active subgraph becomes a single node. Orphan nodes and collapsed
    // subgraph summary nodes are also placed as individual nodes.

    const cfg = this.config
    const m = this.multiplier

    // First, compute the internal size of each subgraph
    const internalLayouts = new Map<string, {
      graph: { nodes: Map<string, PositionedNode> }
      width: number
      height: number
    }>()

    for (const [sgId, sg] of activeSubgraphs) {
      const internalEdges = this._getInternalEdges(graph.edges, sg.nodeIds, hiddenNodeIds)
      const internalDirection = this._internalDirectionForSubgraph(
        graph,
        sg.direction,
      )
      const internalResult = this._layoutInternalNodes(
        graph, sg.nodeIds, internalEdges, internalDirection,
      )
      internalLayouts.set(sgId, internalResult)
    }

    // Build the cluster graph
    const clusterG = new dagre.graphlib.Graph()
    clusterG.setGraph({
      rankdir: toRankDir(graph.direction),
      nodesep: cfg.nodeSep * m * 1.5, // generous cluster spacing
      ranksep: cfg.rankSep * m * 1.5,
      edgesep: cfg.edgeSep * m,
      marginx: cfg.marginX * m,
      marginy: cfg.marginY * m,
    })
    clusterG.setDefaultEdgeLabel(() => ({}))

    // Add active subgraphs as cluster nodes
    const CLUSTER_PADDING = 40 * m
    const LABEL_HEIGHT = 25
    for (const [sgId] of activeSubgraphs) {
      const internal = internalLayouts.get(sgId)!
      const sg = graph.subgraphs.get(sgId)!
      clusterG.setNode(sgId, {
        label: sgId,
        width: this._subgraphWidth(sg.label, sg.nodeIds.length, internal.width, CLUSTER_PADDING),
        height: internal.height + CLUSTER_PADDING * 2 + LABEL_HEIGHT,
      })
    }

    // Add orphan nodes as individual nodes in cluster graph
    for (const nid of orphanNodeIds) {
      const node = graph.nodes.get(nid)!
      const size = this._nodeSize(node)
      clusterG.setNode(nid, {
        label: node.label,
        width: size.width,
        height: size.height,
      })
    }

    // Add collapsed subgraph summary nodes
    for (const sgId of collapsedSgIds) {
      const sg = graph.subgraphs.get(sgId)!
      const summaryLabel = `▶ ${sg.label} (${sg.nodeIds.length})`
      clusterG.setNode(sgId, {
        label: summaryLabel,
        width: computeNodeWidth(summaryLabel, cfg.nodeMinWidth * 1.5, cfg.nodePadding),
        height: cfg.nodeMinHeight * 1.2,
      })
    }

    // Add cluster-level edges: edges that cross subgraph boundaries
    // Map each visible node to its cluster (subgraph ID, or self for orphans)
    const nodeToCluster = new Map<string, string>()
    for (const [sgId, sg] of activeSubgraphs) {
      for (const nid of sg.nodeIds) nodeToCluster.set(nid, sgId)
    }
    for (const nid of orphanNodeIds) nodeToCluster.set(nid, nid)
    for (const sgId of collapsedSgIds) nodeToCluster.set(sgId, sgId)
    // Cluster-alias endpoints resolve to the cluster they name, so their
    // edges still constrain cluster ranks.
    for (const aliasId of clusterAliasIds) {
      if (activeSubgraphs.has(aliasId)) nodeToCluster.set(aliasId, aliasId)
    }

    // Build a map from hidden nodes to their collapsed subgraph
    const nodeToSummary = new Map<string, string>()
    for (const [sgId, nodeIds] of collapsedSubgraphs) {
      for (const nodeId of nodeIds) {
        nodeToSummary.set(nodeId, sgId)
      }
    }

    const projectedClusterEdges: RenderEdge[] = []
    for (const edge of graph.edges) {
      const source = nodeToSummary.get(edge.source) ?? edge.source
      const target = nodeToSummary.get(edge.target) ?? edge.target
      const srcCluster = nodeToCluster.get(source)
      const tgtCluster = nodeToCluster.get(target)
      if (!srcCluster || !tgtCluster) continue
      if (srcCluster === tgtCluster) continue // internal edge
      projectedClusterEdges.push({
        ...edge,
        source: srcCluster,
        target: tgtCluster,
      })
    }

    const hierarchyEdgesByClusterPair = new Map<string, RenderEdge>()
    for (const edge of projectedClusterEdges) {
      if (!this._constrainsHierarchy(edge, projectedClusterEdges)) continue
      const key = `${edge.source}->${edge.target}`
      const existing = hierarchyEdgesByClusterPair.get(key)
      if (!existing || (existing.style === 'dotted' && edge.style !== 'dotted')) {
        hierarchyEdgesByClusterPair.set(key, edge)
      }
    }

    for (const edge of hierarchyEdgesByClusterPair.values()) {
      clusterG.setEdge(edge.source, edge.target, {})
    }

    dagre.layout(clusterG)

    // ═══════ PASS 2: Combine ═══════
    // Position internal nodes relative to their subgraph's cluster position.

    const positionedNodes = new Map<string, PositionedNode>()
    const positionedSubgraphs = new Map<string, PositionedSubgraph>()

    for (const [sgId] of activeSubgraphs) {
      const clusterNode = clusterG.node(sgId)
      const internal = internalLayouts.get(sgId)!

      // Cluster center position
      const cx = clusterNode.x
      const cy = clusterNode.y
      const clusterW = clusterNode.width
      const clusterH = clusterNode.height

      // Internal layout is centered at (internalCenterX, internalCenterY)
      // We need to offset it so it fits within the cluster bounding box
      const offsetX = cx
      const offsetY = cy + LABEL_HEIGHT / 2 // shift down for label

      for (const [nid, nodePos] of internal.graph.nodes) {
        positionedNodes.set(nid, {
          ...nodePos,
          x: nodePos.x + offsetX,
          y: nodePos.y + offsetY,
        })
      }

      // Record subgraph bounds
      const sgData = graph.subgraphs.get(sgId)!
      positionedSubgraphs.set(sgId, {
        ...sgData,
        x: cx,
        y: cy,
        width: clusterW,
        height: clusterH,
      })
    }

    // Place orphan nodes
    for (const nid of orphanNodeIds) {
      const dagreNode = clusterG.node(nid)
      const originalNode = graph.nodes.get(nid)!
      positionedNodes.set(nid, {
        ...originalNode,
        x: dagreNode.x,
        y: dagreNode.y,
        width: dagreNode.width,
        height: dagreNode.height,
      })
    }

    // Place collapsed subgraph summary nodes
    for (const sgId of collapsedSgIds) {
      const dagreNode = clusterG.node(sgId)
      const sg = graph.subgraphs.get(sgId)!
      const originalNode = graph.nodes.get(sgId)

      const summaryLabel = `▶ ${sg.label} (${sg.nodeIds.length})`
      const baseNode = originalNode ?? {
        id: sgId,
        label: summaryLabel,
        shape: 'rounded' as const,
        metadata: { _isCollapsedSummary: true, _subgraphId: sgId, _childCount: sg.nodeIds.length },
      }

      positionedNodes.set(sgId, {
        ...baseNode,
        x: dagreNode.x,
        y: dagreNode.y,
        width: dagreNode.width,
        height: dagreNode.height,
      })

      positionedSubgraphs.set(sgId, {
        ...sg,
        x: dagreNode.x,
        y: dagreNode.y,
        width: dagreNode.width,
        height: dagreNode.height,
      })
    }

    this._deriveNestedSubgraphBounds(graph, positionedNodes, positionedSubgraphs, 40 * m)

    // ═══════ Edge routing ═══════
    // Re-route edges using the final node positions.

    const rerouted = this.rerouteEdges(graph.edges, hiddenNodeIds, collapsedSubgraphs)
    const positionedEdges: PositionedEdge[] = []

    for (const edge of rerouted) {
      const srcNode = positionedNodes.get(edge.source)
      const tgtNode = positionedNodes.get(edge.target)

      if (srcNode && tgtNode) {
        positionedEdges.push({
          ...edge,
          points: [
            { x: srcNode.x, y: srcNode.y },
            { x: (srcNode.x + tgtNode.x) / 2, y: (srcNode.y + tgtNode.y) / 2 },
            { x: tgtNode.x, y: tgtNode.y },
          ],
        })
        continue
      }

      // Cluster-alias endpoint: anchor on the positioned subgraph's border.
      const clusterEdge = this._routeClusterAliasEdge(edge, srcNode, tgtNode, positionedSubgraphs)
      if (clusterEdge) positionedEdges.push(clusterEdge)
    }

    // Compute total dimensions
    const graphLabel = clusterG.graph()
    const totalWidth = graphLabel.width ?? 0
    const totalHeight = graphLabel.height ?? 0

    return {
      nodes: positionedNodes,
      edges: positionedEdges,
      subgraphs: positionedSubgraphs,
      width: totalWidth,
      height: totalHeight,
    }
  }

  private _deriveNestedSubgraphBounds(
    graph: RenderGraph,
    positionedNodes: Map<string, PositionedNode>,
    positionedSubgraphs: Map<string, PositionedSubgraph>,
    padding: number,
  ): void {
    const pending = new Set(
      Array.from(graph.subgraphs.entries())
        .filter(([, sg]) => !sg.collapsed && sg.nodeIds.some((id) => graph.subgraphs.has(id)))
        .map(([sgId]) => sgId),
    )
    const labelHeight = 25

    while (pending.size > 0) {
      let progressed = false

      for (const sgId of Array.from(pending)) {
        const sg = graph.subgraphs.get(sgId)!
        const unresolvedChildren = sg.nodeIds
          .filter((id) => graph.subgraphs.has(id) && !positionedSubgraphs.has(id))
        if (unresolvedChildren.length > 0) continue

        const childSubgraphs = sg.nodeIds
          .map((id) => positionedSubgraphs.get(id))
          .filter((subgraph): subgraph is PositionedSubgraph => subgraph !== undefined)
        const memberNodes = sg.nodeIds
          .map((id) => positionedNodes.get(id))
          .filter((node): node is PositionedNode => node !== undefined)

        if (childSubgraphs.length === 0 && memberNodes.length === 0) {
          pending.delete(sgId)
          progressed = true
          continue
        }

        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity

        for (const node of memberNodes) {
          minX = Math.min(minX, node.x - node.width / 2)
          minY = Math.min(minY, node.y - node.height / 2)
          maxX = Math.max(maxX, node.x + node.width / 2)
          maxY = Math.max(maxY, node.y + node.height / 2)
        }
        for (const child of childSubgraphs) {
          minX = Math.min(minX, child.x - child.width / 2)
          minY = Math.min(minY, child.y - child.height / 2)
          maxX = Math.max(maxX, child.x + child.width / 2)
          maxY = Math.max(maxY, child.y + child.height / 2)
        }

        if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
          pending.delete(sgId)
          progressed = true
          continue
        }

        const base = positionedSubgraphs.get(sgId)
        positionedSubgraphs.set(sgId, {
          ...sg,
          x: (minX + maxX) / 2,
          y: (minY + maxY) / 2,
          width: Math.max(
            base?.width ?? 0,
            this._subgraphWidth(sg.label, sg.nodeIds.length, maxX - minX, padding),
          ),
          height: Math.max(base?.height ?? 0, maxY - minY + padding * 2 + labelHeight),
        })
        pending.delete(sgId)
        progressed = true
      }

      if (!progressed) break
    }
  }

  /**
   * Layout internal nodes of a subgraph independently.
   * Returns centered positions (centered around 0,0).
   */
  private _layoutInternalNodes(
    graph: RenderGraph,
    nodeIds: string[],
    edges: RenderEdge[],
    direction: string,
  ): { graph: { nodes: Map<string, PositionedNode> }; width: number; height: number } {
    const cfg = this.config
    const m = this.multiplier
    const g = new dagre.graphlib.Graph()
    g.setGraph({
      rankdir: toRankDir(direction),
      nodesep: cfg.nodeSep * m,
      ranksep: cfg.rankSep * m,
      edgesep: cfg.edgeSep * m,
      marginx: 10,
      marginy: 10,
    })
    g.setDefaultEdgeLabel(() => ({}))

    for (const nid of nodeIds) {
      const node = graph.nodes.get(nid)
      if (!node) continue
      const size = this._nodeSize(node)
      g.setNode(nid, {
        label: node.label,
        width: size.width,
        height: size.height,
      })
    }

    const verticalDirection = ['TD', 'TB', 'BT'].includes(direction)
    const incidentNodeIds = new Set<string>()
    const edgeKeys = new Set<string>()

    for (const edge of edges) {
      if (!this._constrainsHierarchy(edge, edges)) continue
      g.setEdge(edge.source, edge.target, {})
      incidentNodeIds.add(edge.source)
      incidentNodeIds.add(edge.target)
      edgeKeys.add(`${edge.source}->${edge.target}`)
    }

    if (verticalDirection) {
      for (let index = 0; index < nodeIds.length - 1; index++) {
        const source = nodeIds[index]
        const target = nodeIds[index + 1]
        if (edgeKeys.has(`${source}->${target}`) || edgeKeys.has(`${target}->${source}`)) continue
        if (edges.length > 0 && incidentNodeIds.has(source) && incidentNodeIds.has(target)) continue
        g.setEdge(source, target, {})
      }
    }

    dagre.layout(g)

    const graphLabel = g.graph()
    const layoutWidth = graphLabel.width ?? 0
    const layoutHeight = graphLabel.height ?? 0

    // Center the layout around (0, 0)
    const centerX = layoutWidth / 2
    const centerY = layoutHeight / 2

    const nodes = new Map<string, PositionedNode>()
    for (const nid of g.nodes()) {
      const dagreNode = g.node(nid)
      if (!dagreNode) continue
      const originalNode = graph.nodes.get(nid)
      if (!originalNode) continue
      nodes.set(nid, {
        ...originalNode,
        x: dagreNode.x - centerX,
        y: dagreNode.y - centerY,
        width: dagreNode.width,
        height: dagreNode.height,
      })
    }

    return {
      graph: { nodes },
      width: layoutWidth,
      height: layoutHeight,
    }
  }

  /**
   * Get edges that are internal to a set of node IDs.
   */
  private _getInternalEdges(
    edges: RenderEdge[],
    nodeIds: string[],
    hiddenNodeIds: Set<string>,
  ): RenderEdge[] {
    const nodeSet = new Set(nodeIds)
    return edges.filter(
      (e) => nodeSet.has(e.source) && nodeSet.has(e.target)
        && !hiddenNodeIds.has(e.source) && !hiddenNodeIds.has(e.target),
    )
  }

  /**
   * Blueprint treats authored subgraph direction as local layout intent.
   * Native Mermaid ignores it when a subgraph links outside, but discussion
   * maps need vertical stage cards inside a horizontal story.
   */
  private _internalDirectionForSubgraph(
    graph: RenderGraph,
    localDirection: string | undefined,
  ): string {
    return localDirection ?? graph.direction
  }

  /**
   * Single-pass layout (fallback for when there are no active subgraphs).
   * Preserves the original dagre compound layout behavior.
   */
  private _singlePassLayout(
    graph: RenderGraph,
    hiddenNodeIds: Set<string>,
    collapsedSubgraphs: Map<string, string[]>,
  ): PositionedGraph {
    const g = new dagre.graphlib.Graph({ compound: true })
    const cfg = this.config
    const m = this.multiplier

    g.setGraph({
      rankdir: toRankDir(graph.direction),
      nodesep: cfg.nodeSep * m,
      ranksep: cfg.rankSep * m,
      edgesep: cfg.edgeSep * m,
      marginx: cfg.marginX * m,
      marginy: cfg.marginY * m,
    })
    g.setDefaultEdgeLabel(() => ({}))

    // Add subgraph group nodes (compound parents) for non-collapsed subgraphs
    for (const [sgId, sg] of graph.subgraphs) {
      if (sg.collapsed) continue
      const sgPadding = 30 * m
      g.setNode(sgId, {
        label: sg.label,
        clusterLabelPos: 'top',
        style: 'fill: none',
        paddingTop: sgPadding + 20,
        paddingBottom: sgPadding,
        paddingLeft: sgPadding,
        paddingRight: sgPadding,
      })
    }

    // Cluster-alias nodes (node id names a subgraph) must not be added as
    // regular nodes: setNode under a compound parent's id replaces the
    // parent's attributes and corrupts the cluster layout. Their edges are
    // routed against the positioned subgraph bounds after layout instead.
    // Aliases of collapsed subgraphs need no special routing — the summary
    // node under the same id already stands in for them.
    const clusterAliasIds = this._clusterAliasIds(graph)
    const activeAliasIds = new Set(
      Array.from(clusterAliasIds).filter((id) => !collapsedSubgraphs.has(id)),
    )

    // Add visible nodes
    for (const [id, node] of graph.nodes) {
      if (hiddenNodeIds.has(id) || clusterAliasIds.has(id)) continue
      const size = this._nodeSize(node)
      g.setNode(id, {
        label: node.label,
        width: size.width,
        height: size.height,
      })

      for (const [sgId, sg] of graph.subgraphs) {
        if (!sg.collapsed && sg.nodeIds.includes(id)) {
          g.setParent(id, sgId)
          break
        }
      }
    }

    // Add summary nodes for collapsed subgraphs
    for (const [sgId] of collapsedSubgraphs) {
      const sg = graph.subgraphs.get(sgId)!
      g.setNode(sgId, {
        label: sg.label,
        width: computeNodeWidth(sg.label, cfg.nodeMinWidth, cfg.nodePadding),
        height: cfg.nodeMinHeight,
      })
    }

    // Route edges
    const edgesToLayout = this.rerouteEdges(
      graph.edges, hiddenNodeIds, collapsedSubgraphs,
    )
    for (const edge of edgesToLayout) {
      if (activeAliasIds.has(edge.source) || activeAliasIds.has(edge.target)) continue
      if (!this._constrainsHierarchy(edge, edgesToLayout)) continue
      g.setEdge(edge.source, edge.target, {})
    }

    dagre.layout(g)

    // Collect non-collapsed subgraph IDs
    const compoundParentIds = new Set<string>()
    for (const [sgId, sg] of graph.subgraphs) {
      if (!sg.collapsed) compoundParentIds.add(sgId)
    }

    // Extract positioned nodes
    const positionedNodes = new Map<string, PositionedNode>()
    for (const nodeId of g.nodes()) {
      if (compoundParentIds.has(nodeId)) continue

      const dagreNode = g.node(nodeId)
      if (!dagreNode) continue

      const originalNode = graph.nodes.get(nodeId)
      const sg = graph.subgraphs.get(nodeId)

      const baseNode = collapsedSubgraphs.has(nodeId)
        ? {
            ...(originalNode ?? {
              id: nodeId,
              label: sg?.label ?? nodeId,
              shape: 'rounded' as const,
            }),
            metadata: {
              ...(originalNode?.metadata ?? {}),
              _isCollapsedSummary: true,
              _subgraphId: nodeId,
              _childCount: collapsedSubgraphs.get(nodeId)?.length ?? sg?.nodeIds.length ?? 0,
            },
          }
        : (originalNode ?? {
            id: nodeId,
            label: sg?.label ?? nodeId,
            shape: 'rectangle' as const,
            metadata: {},
          })

      positionedNodes.set(nodeId, {
        ...baseNode,
        x: dagreNode.x,
        y: dagreNode.y,
        width: dagreNode.width,
        height: dagreNode.height,
      })
    }

    // Extract edges (cluster-alias edges wait for positioned subgraph bounds)
    const positionedEdges: PositionedEdge[] = []
    const aliasEdges: RenderEdge[] = []
    for (const edge of edgesToLayout) {
      if (activeAliasIds.has(edge.source) || activeAliasIds.has(edge.target)) {
        aliasEdges.push(edge)
        continue
      }
      const dagreEdge = g.edge(edge.source, edge.target)
      const points =
        dagreEdge?.points && dagreEdge.points.length >= 2
          ? dagreEdge.points
          : [
              { x: g.node(edge.source).x, y: g.node(edge.source).y },
              { x: g.node(edge.target).x, y: g.node(edge.target).y },
            ]

      positionedEdges.push({ ...edge, points })
    }

    // Subgraph bounds
    const positionedSubgraphs = new Map<string, PositionedSubgraph>()
    for (const [sgId, sg] of graph.subgraphs) {
      if (sg.collapsed) {
        const summaryNode = positionedNodes.get(sgId)
        if (summaryNode) {
          positionedSubgraphs.set(sgId, {
            ...sg,
            x: summaryNode.x,
            y: summaryNode.y,
            width: summaryNode.width,
            height: summaryNode.height,
          })
        }
      } else {
        const dagreGroup = g.node(sgId)
        if (dagreGroup && dagreGroup.width > 0) {
          positionedSubgraphs.set(sgId, {
            ...sg,
            x: dagreGroup.x,
            y: dagreGroup.y,
            width: Math.max(dagreGroup.width, this._subgraphHeaderWidth(sg.label, sg.nodeIds.length)),
            height: dagreGroup.height,
          })
        }
      }
    }

    const padding = 30 * m
    const pending = new Set(
      Array.from(graph.subgraphs.entries())
        .filter(([, sg]) => !sg.collapsed)
        .map(([sgId]) => sgId),
    )
    while (pending.size > 0) {
      let progressed = false
      for (const sgId of Array.from(pending)) {
        const sg = graph.subgraphs.get(sgId)!
        const childSubgraphs = sg.nodeIds
          .map((id) => positionedSubgraphs.get(id))
          .filter((subgraph): subgraph is PositionedSubgraph => subgraph !== undefined)
        const unresolvedChildren = sg.nodeIds
          .filter((id) => graph.subgraphs.has(id) && !positionedSubgraphs.has(id))
        if (childSubgraphs.length === 0 || unresolvedChildren.length > 0) continue

        const memberNodes = sg.nodeIds
          .map((id) => positionedNodes.get(id))
          .filter((n): n is PositionedNode => n !== undefined)

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const node of memberNodes) {
          minX = Math.min(minX, node.x - node.width / 2)
          minY = Math.min(minY, node.y - node.height / 2)
          maxX = Math.max(maxX, node.x + node.width / 2)
          maxY = Math.max(maxY, node.y + node.height / 2)
        }
        for (const child of childSubgraphs) {
          minX = Math.min(minX, child.x - child.width / 2)
          minY = Math.min(minY, child.y - child.height / 2)
          maxX = Math.max(maxX, child.x + child.width / 2)
          maxY = Math.max(maxY, child.y + child.height / 2)
        }

        const base = positionedSubgraphs.get(sgId)
        positionedSubgraphs.set(sgId, {
          ...sg,
          x: (minX + maxX) / 2,
          y: (minY + maxY) / 2,
          width: Math.max(
            base?.width ?? 0,
            this._subgraphWidth(sg.label, sg.nodeIds.length, maxX - minX, padding),
          ),
          height: Math.max(base?.height ?? 0, maxY - minY + padding * 2 + 20),
        })
        pending.delete(sgId)
        progressed = true
      }

      if (!progressed) break
    }

    for (const edge of aliasEdges) {
      const routed = this._routeClusterAliasEdge(
        edge,
        positionedNodes.get(edge.source),
        positionedNodes.get(edge.target),
        positionedSubgraphs,
      )
      if (routed) positionedEdges.push(routed)
    }

    const graphLabel = g.graph()

    return {
      nodes: positionedNodes,
      edges: positionedEdges,
      subgraphs: positionedSubgraphs,
      width: graphLabel.width ?? 0,
      height: graphLabel.height ?? 0,
    }
  }

  /**
   * Node ids that alias a subgraph id. The parser materializes a node when an
   * edge endpoint names a subgraph (`X --> Cluster`); layout must treat such
   * endpoints as the cluster itself, never as a free node.
   */
  private _clusterAliasIds(graph: RenderGraph): Set<string> {
    const aliases = new Set<string>()
    for (const [id] of graph.nodes) {
      const sg = graph.subgraphs.get(id)
      if (sg && !sg.nodeIds.includes(id)) aliases.add(id)
    }
    return aliases
  }

  /**
   * Route an edge with at least one cluster-alias endpoint: anchor that end
   * on the positioned subgraph's border. Both endpoints are trimmed here
   * because the renderer can only trim endpoints it resolves to nodes.
   */
  private _routeClusterAliasEdge(
    edge: RenderEdge,
    srcNode: PositionedNode | undefined,
    tgtNode: PositionedNode | undefined,
    subgraphs: Map<string, PositionedSubgraph>,
  ): PositionedEdge | null {
    const src = srcNode ?? subgraphs.get(edge.source)
    const tgt = tgtNode ?? subgraphs.get(edge.target)
    if (!src || !tgt) return null

    const start = this._rectBoundaryPoint(src, tgt)
    const end = this._rectBoundaryPoint(tgt, src)
    return {
      ...edge,
      points: [
        start,
        { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
        end,
      ],
    }
  }

  private _rectBoundaryPoint(
    rect: { x: number; y: number; width: number; height: number },
    toward: { x: number; y: number },
  ): { x: number; y: number } {
    const dx = toward.x - rect.x
    const dy = toward.y - rect.y
    if (dx === 0 && dy === 0) return { x: rect.x, y: rect.y }
    const scale = 1 / Math.max(
      Math.abs(dx) / (rect.width / 2 || 1),
      Math.abs(dy) / (rect.height / 2 || 1),
    )
    return { x: rect.x + dx * scale, y: rect.y + dy * scale }
  }

  private _constrainsHierarchy(edge: RenderEdge, edges: RenderEdge[]): boolean {
    if (this.philosophy !== 'blueprint' || edge.style !== 'dotted') return true

    const adjacency = new Map<string, string[]>()
    for (const candidate of edges) {
      if (candidate.id === edge.id || candidate.style === 'dotted') continue
      const targets = adjacency.get(candidate.source) ?? []
      targets.push(candidate.target)
      adjacency.set(candidate.source, targets)
    }

    const pending = [edge.target]
    const visited = new Set<string>()
    while (pending.length > 0) {
      const current = pending.pop()!
      if (current === edge.source) return false
      if (visited.has(current)) continue
      visited.add(current)
      pending.push(...(adjacency.get(current) ?? []))
    }

    return true
  }

  /**
   * Reroute edges for collapsed subgraphs: replace references to hidden
   * nodes with the summary node ID, and deduplicate.
   */
  private rerouteEdges(
    edges: RenderEdge[],
    hiddenNodeIds: Set<string>,
    collapsedSubgraphs: Map<string, string[]>,
  ): RenderEdge[] {
    // Build a map from hidden node ID to its owning collapsed subgraph ID
    const nodeToSummary = new Map<string, string>()
    for (const [sgId, nodeIds] of collapsedSubgraphs) {
      for (const nodeId of nodeIds) {
        nodeToSummary.set(nodeId, sgId)
      }
    }

    const seen = new Set<string>()
    const result: RenderEdge[] = []

    for (const edge of edges) {
      const source = nodeToSummary.get(edge.source) ?? edge.source
      const target = nodeToSummary.get(edge.target) ?? edge.target

      // Skip self-loops created by collapsing
      if (source === target) continue

      // Deduplicate edges with same source-target pair
      const key = `${source}->${target}`
      if (seen.has(key)) continue
      seen.add(key)

      result.push({ ...edge, source, target })
    }

    return result
  }

  private _nodeSize(node: RenderNode): { width: number; height: number } {
    const erTableLayout = computeErEntityTableLayout({
      ...node,
      width: this.config.nodeMinWidth,
      height: this.config.nodeMinHeight,
    }, this.philosophy === 'blueprint')
    if (erTableLayout) {
      return {
        width: erTableLayout.width,
        height: erTableLayout.height,
      }
    }

    const classCompartmentLayout = computeClassCompartmentLayout({
      ...node,
      width: this.config.nodeMinWidth,
      height: this.config.nodeMinHeight,
    }, this.philosophy === 'blueprint')
    if (classCompartmentLayout) {
      return {
        width: classCompartmentLayout.width,
        height: classCompartmentLayout.height,
      }
    }

    const labelLayout = computeNodeLabelLayout(
      node.label,
      this.config.nodeMinWidth,
      this.config.nodeMinHeight,
      this.config.nodePadding,
      this.philosophy === 'blueprint',
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

  private _subgraphWidth(label: string, nodeCount: number, contentWidth: number, padding: number): number {
    return Math.max(contentWidth + padding * 2, this._subgraphHeaderWidth(label, nodeCount))
  }

  private _subgraphHeaderWidth(label: string, nodeCount: number): number {
    const labelWidth = measureTextWidth(label, SUBGRAPH_LABEL_FONT_SIZE, true)
    const badgeWidth = nodeCount > 0
      ? Math.max(SUBGRAPH_BADGE_MIN_WIDTH, String(nodeCount).length * SUBGRAPH_BADGE_CHAR_WIDTH + SUBGRAPH_BADGE_PADDING)
      : 0
    const badgeSpace = badgeWidth > 0 ? badgeWidth + SUBGRAPH_BADGE_GAP : 0

    return Math.ceil(
      SUBGRAPH_LABEL_LEFT_INSET +
      labelWidth +
      badgeSpace +
      SUBGRAPH_LABEL_RIGHT_INSET +
      SUBGRAPH_HEADER_EXTRA,
    )
  }
}
