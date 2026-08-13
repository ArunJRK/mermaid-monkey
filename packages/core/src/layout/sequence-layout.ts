import { computeNodeLabelLayout } from './text-measure'
import type {
  RenderGraph,
  RenderEdge,
  PositionedGraph,
  PositionedNode,
  PositionedEdge,
} from '../types'
import type { LayoutEngine, LayoutOptions } from './layout-engine'
import { getPhilosophyConfig, type PhilosophyConfig } from './philosophy-config'

/**
 * Sequence diagrams are not a generic directed graph: participants form
 * fixed left-to-right lanes (declaration order), and messages form a
 * strict top-to-bottom timeline (send order). Handing this graph shape to
 * a generic ranked-DAG layout (dagre, or dagre-backed Narrative/Blueprint)
 * lets it reorder participants to minimize edge crossings and collapse
 * same-rank messages onto the same row — producing the "jumbled, rotated"
 * layout reported for sequence diagrams. This engine positions lanes and
 * message rows directly instead of delegating to a ranking algorithm.
 */
export class SequenceLayout implements LayoutEngine {
  private readonly config: PhilosophyConfig
  private readonly multiplier: number

  constructor(options?: LayoutOptions) {
    this.config = getPhilosophyConfig(options?.philosophy ?? 'narrative')
    this.multiplier = options?.spacingMultiplier ?? 1.0
  }

  compute(graph: RenderGraph): PositionedGraph {
    if (graph.nodes.size === 0) {
      return { nodes: new Map(), edges: [], subgraphs: new Map(), width: 0, height: 0 }
    }

    const cfg = this.config
    const m = this.multiplier

    // Lanes: one per actor, in declaration order (Map insertion order),
    // never reordered by message topology.
    const actorIds = Array.from(graph.nodes.keys())
    const boxSizes = new Map(
      actorIds.map((id) => {
        const node = graph.nodes.get(id)!
        const layout = computeNodeLabelLayout(node.label, cfg.nodeMinWidth, cfg.nodeMinHeight, cfg.nodePadding)
        return [id, layout] as const
      }),
    )

    const maxBoxWidth = Math.max(...actorIds.map((id) => boxSizes.get(id)!.width))
    const maxBoxHeight = Math.max(...actorIds.map((id) => boxSizes.get(id)!.height))
    const laneGap = maxBoxWidth + cfg.nodeSep * m * 2

    const laneX = new Map<string, number>()
    actorIds.forEach((id, index) => {
      laneX.set(id, cfg.marginX * m + laneGap * index + laneGap / 2)
    })

    const headerY = cfg.marginY * m + maxBoxHeight / 2

    const positionedNodes = new Map<string, PositionedNode>()
    for (const id of actorIds) {
      const node = graph.nodes.get(id)!
      const size = boxSizes.get(id)!
      positionedNodes.set(id, {
        ...node,
        x: laneX.get(id)!,
        y: headerY,
        width: size.width,
        height: size.height,
      })
    }

    // Messages: one dedicated row per message, ordered by send order —
    // never collapsed onto a shared row the way a ranked DAG would.
    const orderedMessages = this._orderedMessages(graph.edges)
    const rowHeight = cfg.rankSep * m
    const firstRowY = headerY + maxBoxHeight / 2 + rowHeight

    const positionedEdges: PositionedEdge[] = []
    orderedMessages.forEach((edge, index) => {
      const srcX = laneX.get(edge.source)
      const tgtX = laneX.get(edge.target)
      if (srcX === undefined || tgtX === undefined) return

      const y = firstRowY + index * rowHeight

      if (edge.source === edge.target) {
        // Self-message: short stub loop to the right of the lane, kept on
        // its own row so it can never share vertical space with another
        // message.
        const stub = Math.max(30, laneGap * 0.25)
        positionedEdges.push({
          ...edge,
          points: [
            { x: srcX, y },
            { x: srcX + stub, y },
            { x: srcX + stub, y: y + rowHeight * 0.4 },
            { x: srcX, y: y + rowHeight * 0.4 },
          ],
        })
        return
      }

      positionedEdges.push({
        ...edge,
        points: [
          { x: srcX, y },
          { x: tgtX, y },
        ],
      })
    })

    const lastRowY = orderedMessages.length > 0
      ? firstRowY + (orderedMessages.length - 1) * rowHeight
      : firstRowY
    const totalWidth = laneGap * actorIds.length + cfg.marginX * m * 2
    const totalHeight = lastRowY + maxBoxHeight / 2 + cfg.marginY * m

    return {
      nodes: positionedNodes,
      edges: positionedEdges,
      subgraphs: new Map(),
      width: totalWidth,
      height: totalHeight,
    }
  }

  /**
   * Sort messages by their authored send order. `buildSequenceGraph` already
   * appends edges in message order, but sort defensively by the metadata
   * `order` field (falling back to array position) so this engine doesn't
   * silently depend on upstream array ordering being preserved.
   */
  private _orderedMessages(edges: RenderEdge[]): RenderEdge[] {
    return edges
      .map((edge, index) => ({ edge, index }))
      .sort((a, b) => this._messageOrder(a.edge, a.index) - this._messageOrder(b.edge, b.index))
      .map(({ edge }) => edge)
  }

  private _messageOrder(edge: RenderEdge, fallback: number): number {
    const sequenceMeta = edge.metadata?.sequence as Record<string, unknown> | undefined
    const order = sequenceMeta?.order
    return typeof order === 'number' && Number.isFinite(order) ? order : fallback
  }
}
