import type { RenderGraph, PositionedGraph, PositionedNode, PositionedEdge, PositionedSubgraph } from '../types'
import type { LayoutEngine, LayoutOptions } from './layout-engine'
import { DagreLayout } from './dagre-layout'
import { estimateRenderedNodeFootprint } from '../node-footprint'

const GRID_SIZE = 20
const ANNOTATION_GAP = GRID_SIZE * 4

/**
 * Snap a value to the nearest grid point.
 */
export function snapToGrid(value: number, gridSize: number = GRID_SIZE): number {
  return Math.round(value / gridSize) * gridSize
}

/**
 * Check if a line segment from p1 to p2 intersects a rectangle defined by
 * center (cx, cy) and half-dimensions (hw, hh). Uses Liang-Barsky clipping.
 */
export function lineIntersectsRect(
  p1x: number, p1y: number,
  p2x: number, p2y: number,
  cx: number, cy: number,
  hw: number, hh: number,
): boolean {
  const dx = p2x - p1x
  const dy = p2y - p1y
  const minX = cx - hw
  const maxX = cx + hw
  const minY = cy - hh
  const maxY = cy + hh

  // Parametric clipping (Liang-Barsky)
  const p = [-dx, dx, -dy, dy]
  const q = [p1x - minX, maxX - p1x, p1y - minY, maxY - p1y]

  let tMin = 0
  let tMax = 1

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false // parallel and outside
    } else {
      const t = q[i] / p[i]
      if (p[i] < 0) {
        tMin = Math.max(tMin, t)
      } else {
        tMax = Math.min(tMax, t)
      }
      if (tMin > tMax) return false
    }
  }

  return tMin <= tMax
}

/**
 * Compute a waypoint that routes around an obstructing node.
 * Offsets perpendicular to the source-target line by nodeWidth/2 + margin.
 */
export function computeWaypoint(
  srcX: number, srcY: number,
  tgtX: number, tgtY: number,
  obstacleX: number, obstacleY: number,
  obstacleWidth: number,
  _obstacleHeight: number,
  margin: number = 10,
): { x: number; y: number } {
  const dx = tgtX - srcX
  const dy = tgtY - srcY
  const len = Math.sqrt(dx * dx + dy * dy)

  if (len === 0) return { x: obstacleX + obstacleWidth / 2 + margin, y: obstacleY }

  // Perpendicular direction (normalized)
  const perpX = -dy / len
  const perpY = dx / len

  // Determine which side of the line the obstacle center falls on
  // to route on the opposite side
  const cross = dx * (obstacleY - srcY) - dy * (obstacleX - srcX)
  const sign = cross >= 0 ? -1 : 1

  const offset = obstacleWidth / 2 + margin
  return {
    x: obstacleX + sign * perpX * offset,
    y: obstacleY + sign * perpY * offset,
  }
}

function segmentPathCollides(
  points: Array<{ x: number; y: number }>,
  nodes: PositionedNode[],
  edge: PositionedEdge,
): boolean {
  for (let pointIndex = 0; pointIndex < points.length - 1; pointIndex += 1) {
    const start = points[pointIndex]
    const end = points[pointIndex + 1]

    for (const node of nodes) {
      if (node.id === edge.source || node.id === edge.target) continue
      if (lineIntersectsRect(
        start.x, start.y,
        end.x, end.y,
        node.x, node.y,
        node.width / 2,
        node.height / 2,
      )) {
        return true
      }
    }
  }

  return false
}

function pathLength(points: Array<{ x: number; y: number }>): number {
  let total = 0
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]
    total += Math.abs(end.x - start.x) + Math.abs(end.y - start.y)
  }
  return total
}

function shortestClearOrthogonalDetour(
  edge: PositionedEdge,
  node: PositionedNode,
  nodes: PositionedNode[],
  margin: number = GRID_SIZE,
): Array<{ x: number; y: number }> | null {
  const src = nodes.find((candidate) => candidate.id === edge.source)
  const tgt = nodes.find((candidate) => candidate.id === edge.target)
  if (!src || !tgt) return null

  const srcPoint = { x: src.x, y: src.y }
  const tgtPoint = { x: tgt.x, y: tgt.y }
  const topY = snapToGrid(node.y - node.height / 2 - margin)
  const bottomY = snapToGrid(node.y + node.height / 2 + margin)
  const leftX = snapToGrid(node.x - node.width / 2 - margin)
  const rightX = snapToGrid(node.x + node.width / 2 + margin)

  const candidates = [
    [srcPoint, { x: src.x, y: topY }, { x: tgt.x, y: topY }, tgtPoint],
    [srcPoint, { x: src.x, y: bottomY }, { x: tgt.x, y: bottomY }, tgtPoint],
    [srcPoint, { x: leftX, y: src.y }, { x: leftX, y: tgt.y }, tgtPoint],
    [srcPoint, { x: rightX, y: src.y }, { x: rightX, y: tgt.y }, tgtPoint],
  ]

  return candidates
    .filter((candidate) => !segmentPathCollides(candidate, nodes, edge))
    .sort((a, b) => pathLength(a) - pathLength(b))[0] ?? null
}

/**
 * Given positioned edges and all positioned nodes, check each edge for
 * collisions with non-endpoint nodes and insert waypoints to avoid them.
 */
export function avoidEdgeCollisions(
  edges: PositionedEdge[],
  nodes: Map<string, PositionedNode>,
): PositionedEdge[] {
  const nodeList = Array.from(nodes.values())

  return edges.map((edge) => {
    const srcNode = nodes.get(edge.source)
    const tgtNode = nodes.get(edge.target)
    if (!srcNode || !tgtNode) return edge

    const srcX = srcNode.x
    const srcY = srcNode.y
    const tgtX = tgtNode.x
    const tgtY = tgtNode.y

    // Check all non-endpoint nodes for collision
    for (const node of nodeList) {
      if (node.id === edge.source || node.id === edge.target) continue

      const hw = node.width / 2
      const hh = node.height / 2

      if (lineIntersectsRect(srcX, srcY, tgtX, tgtY, node.x, node.y, hw, hh)) {
        // Route around this node
        const waypoint = computeWaypoint(
          srcX, srcY, tgtX, tgtY,
          node.x, node.y, node.width, node.height,
        )
        const waypointPath = [
          { x: srcX, y: srcY },
          waypoint,
          { x: tgtX, y: tgtY },
        ]
        const detour = segmentPathCollides(waypointPath, nodeList, edge)
          ? shortestClearOrthogonalDetour(edge, node, nodeList)
          : null

        return {
          ...edge,
          points: detour ?? waypointPath,
        }
      }
    }

    return edge
  })
}

/**
 * Blueprint layout: Dagre + grid snapping + edge collision avoidance.
 *
 * After dagre computes positions, snaps each node to the nearest 20px grid
 * point and resolves overlaps from snapping. Then checks edges for collisions
 * with non-endpoint nodes and routes around them.
 */
export class BlueprintLayout implements LayoutEngine {
  private _dagre: DagreLayout

  constructor(options?: LayoutOptions) {
    this._dagre = new DagreLayout({ ...options, philosophy: 'blueprint' })
  }

  compute(graph: RenderGraph): PositionedGraph {
    // Run standard dagre layout first
    const result = this._dagre.compute(graph)

    // Snap nodes to grid
    this._snapNodesToGrid(result.nodes)

    // Keep dotted annotation targets close to the source they explain.
    this._placeDottedAnnotationTargets(result)

    // Resolve overlaps caused by snapping
    this._resolveOverlaps(result.nodes)

    // Rebuild edge points to match snapped positions
    const updatedEdges = this._rebuildEdgePoints(result.edges, result.nodes)

    // Apply edge collision avoidance
    const finalEdges = avoidEdgeCollisions(updatedEdges, result.nodes)

    return {
      ...result,
      edges: finalEdges,
      ...this._dimensionsFor(result.nodes, result.subgraphs),
    }
  }

  private _snapNodesToGrid(nodes: Map<string, PositionedNode>): void {
    for (const [, node] of nodes) {
      node.x = snapToGrid(node.x)
      node.y = snapToGrid(node.y)
    }
  }

  private _resolveOverlaps(nodes: Map<string, PositionedNode>): void {
    const nodeList = Array.from(nodes.values())
    const footprints = new Map(
      nodeList.map((node) => [
        node.id,
        estimateRenderedNodeFootprint(node, true),
      ]),
    )
    const maxIterations = 20
    const MIN_MARGIN = GRID_SIZE * 2 // minimum 40px gap between any two nodes

    for (let iter = 0; iter < maxIterations; iter++) {
      let hasOverlap = false

      for (let i = 0; i < nodeList.length; i++) {
        for (let j = i + 1; j < nodeList.length; j++) {
          const a = nodeList[i]
          const b = nodeList[j]
          const aFootprint = footprints.get(a.id)!
          const bFootprint = footprints.get(b.id)!

          // Check overlap including minimum margin
          const requiredX = (aFootprint.width + bFootprint.width) / 2 + MIN_MARGIN
          const requiredY = (aFootprint.height + bFootprint.height) / 2 + MIN_MARGIN
          const overlapX = Math.abs(a.x - b.x) < requiredX
          const overlapY = Math.abs(a.y - b.y) < requiredY

          if (overlapX && overlapY) {
            hasOverlap = true
            const gapX = requiredX - Math.abs(a.x - b.x)
            const gapY = requiredY - Math.abs(a.y - b.y)

            if (gapX <= gapY) {
              // Push apart horizontally
              const pushDir = b.x >= a.x ? 1 : -1
              const pushAmount = Math.ceil(gapX / GRID_SIZE) * GRID_SIZE
              b.x += pushDir * Math.max(GRID_SIZE, pushAmount)
            } else {
              // Push apart vertically
              const pushDir = b.y >= a.y ? 1 : -1
              const pushAmount = Math.ceil(gapY / GRID_SIZE) * GRID_SIZE
              b.y += pushDir * Math.max(GRID_SIZE, pushAmount)
            }

            b.x = snapToGrid(b.x)
            b.y = snapToGrid(b.y)
          }
        }
      }

      if (!hasOverlap) break
    }
  }

  private _placeDottedAnnotationTargets(graph: PositionedGraph): void {
    const targetIdsInSubgraphs = new Set<string>()
    const structuralNodeIds = new Set<string>()
    for (const edge of graph.edges) {
      structuralNodeIds.add(edge.source)
      if (edge.style !== 'dotted') {
        structuralNodeIds.add(edge.target)
      }
    }
    for (const subgraph of graph.subgraphs.values()) {
      for (const nodeId of subgraph.nodeIds) {
        targetIdsInSubgraphs.add(nodeId)
      }
    }

    const placedAnnotations: PositionedNode[] = []

    for (const edge of graph.edges) {
      if (edge.style !== 'dotted') continue
      if (targetIdsInSubgraphs.has(edge.target)) continue
      if (structuralNodeIds.has(edge.target)) continue

      const source = graph.nodes.get(edge.source)
      const target = graph.nodes.get(edge.target)
      if (!source || !target) continue
      if (placedAnnotations.some((node) => node.id === target.id)) continue

      const sourceSubgraph = this._nearestSubgraphForNode(edge.source, graph.subgraphs)
      const sourceOrientation = sourceSubgraph
        ? this._subgraphOrientation(sourceSubgraph, graph.nodes)
        : 'vertical'

      if (sourceOrientation === 'horizontal') {
        this._placeAnnotationBelowSourceGroup(target, source, sourceSubgraph, graph.nodes, graph.subgraphs)
        this._nudgeAnnotation(target, placedAnnotations, 'horizontal')
      } else {
        this._placeAnnotationBesideSourceNode(target, source)
        this._nudgeAnnotation(target, placedAnnotations, 'vertical')
      }

      placedAnnotations.push(target)
    }
  }

  private _nearestSubgraphForNode(
    nodeId: string,
    subgraphs: Map<string, PositionedSubgraph>,
  ): PositionedSubgraph | null {
    const candidates = Array.from(subgraphs.values())
      .filter((subgraph) => subgraph.nodeIds.includes(nodeId))
      .sort((left, right) => (left.width * left.height) - (right.width * right.height))
    return candidates[0] ?? null
  }

  private _subgraphOrientation(
    subgraph: PositionedSubgraph,
    nodes: Map<string, PositionedNode>,
  ): 'horizontal' | 'vertical' {
    const members = subgraph.nodeIds
      .map((nodeId) => nodes.get(nodeId))
      .filter((node): node is PositionedNode => node !== undefined)

    if (members.length >= 2) {
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      for (const member of members) {
        const footprint = estimateRenderedNodeFootprint(member, true)
        minX = Math.min(minX, member.x - footprint.width / 2)
        minY = Math.min(minY, member.y - footprint.height / 2)
        maxX = Math.max(maxX, member.x + footprint.width / 2)
        maxY = Math.max(maxY, member.y + footprint.height / 2)
      }

      const spanX = maxX - minX
      const spanY = maxY - minY
      if (spanX > spanY * 1.35) return 'horizontal'
    }

    return 'vertical'
  }

  private _placeAnnotationBelowSourceGroup(
    target: PositionedNode,
    source: PositionedNode,
    sourceSubgraph: PositionedSubgraph | null,
    nodes: Map<string, PositionedNode>,
    subgraphs: Map<string, PositionedSubgraph>,
  ): void {
    const targetFootprint = estimateRenderedNodeFootprint(target, true)
    const sourceFootprint = estimateRenderedNodeFootprint(source, true)
    const groupBounds = sourceSubgraph
      ? this._memberBounds(sourceSubgraph, nodes)
      : {
          top: source.y - sourceFootprint.height / 2,
          right: source.x + sourceFootprint.width / 2,
          bottom: source.y + sourceFootprint.height / 2,
        }

    target.x = snapToGrid(source.x)
    target.y = snapToGrid(groupBounds.bottom + ANNOTATION_GAP + targetFootprint.height / 2)

    if (
      sourceSubgraph
      && this._annotationCollidesWithSiblingSubgraph(target, sourceSubgraph, subgraphs)
    ) {
      target.y = snapToGrid(groupBounds.top - ANNOTATION_GAP - targetFootprint.height / 2)
    }
  }

  private _placeAnnotationBesideSourceNode(
    target: PositionedNode,
    source: PositionedNode,
  ): void {
    const targetFootprint = estimateRenderedNodeFootprint(target, true)
    const sourceFootprint = estimateRenderedNodeFootprint(source, true)

    target.x = snapToGrid(source.x + sourceFootprint.width / 2 + ANNOTATION_GAP + targetFootprint.width / 2)
    target.y = snapToGrid(source.y)
  }

  private _memberBounds(
    subgraph: PositionedSubgraph,
    nodes: Map<string, PositionedNode>,
  ): { top: number; right: number; bottom: number } {
    let top = subgraph.y - subgraph.height / 2
    let right = subgraph.x + subgraph.width / 2
    let bottom = subgraph.y + subgraph.height / 2

    for (const nodeId of subgraph.nodeIds) {
      const node = nodes.get(nodeId)
      if (!node) continue
      const footprint = estimateRenderedNodeFootprint(node, true)
      top = Math.min(top, node.y - footprint.height / 2)
      right = Math.max(right, node.x + footprint.width / 2)
      bottom = Math.max(bottom, node.y + footprint.height / 2)
    }

    return { top, right, bottom }
  }

  private _annotationCollidesWithSiblingSubgraph(
    target: PositionedNode,
    sourceSubgraph: PositionedSubgraph,
    subgraphs: Map<string, PositionedSubgraph>,
  ): boolean {
    const targetFootprint = estimateRenderedNodeFootprint(target, true)

    for (const subgraph of subgraphs.values()) {
      if (subgraph.id === sourceSubgraph.id) continue
      if (subgraph.nodeIds.includes(sourceSubgraph.id)) continue
      if (!this._rectsOverlap(
        target.x, target.y, targetFootprint.width, targetFootprint.height,
        subgraph.x, subgraph.y, subgraph.width, subgraph.height,
        GRID_SIZE,
      )) continue
      return true
    }

    return false
  }

  private _rectsOverlap(
    leftX: number,
    leftY: number,
    leftWidth: number,
    leftHeight: number,
    rightX: number,
    rightY: number,
    rightWidth: number,
    rightHeight: number,
    margin: number = 0,
  ): boolean {
    const overlapX = Math.abs(leftX - rightX) < (leftWidth + rightWidth) / 2 + margin
    const overlapY = Math.abs(leftY - rightY) < (leftHeight + rightHeight) / 2 + margin
    return overlapX && overlapY
  }

  private _nudgeAnnotation(
    target: PositionedNode,
    placedAnnotations: PositionedNode[],
    axis: 'horizontal' | 'vertical',
  ): void {
    const margin = GRID_SIZE * 2
    let attempts = 0

    while (attempts < 20 && placedAnnotations.some((placed) => this._nodesOverlap(target, placed, margin))) {
      if (axis === 'horizontal') {
        target.x = snapToGrid(target.x + GRID_SIZE)
      } else {
        target.y = snapToGrid(target.y + GRID_SIZE)
      }
      attempts += 1
    }
  }

  private _nodesOverlap(left: PositionedNode, right: PositionedNode, margin: number): boolean {
    const leftFootprint = estimateRenderedNodeFootprint(left, true)
    const rightFootprint = estimateRenderedNodeFootprint(right, true)
    const overlapX = Math.abs(left.x - right.x) < (leftFootprint.width + rightFootprint.width) / 2 + margin
    const overlapY = Math.abs(left.y - right.y) < (leftFootprint.height + rightFootprint.height) / 2 + margin
    return overlapX && overlapY
  }

  private _dimensionsFor(
    nodes: Map<string, PositionedNode>,
    subgraphs: Map<string, PositionedSubgraph>,
  ): Pick<PositionedGraph, 'width' | 'height'> {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    const includeRect = (x: number, y: number, width: number, height: number) => {
      minX = Math.min(minX, x - width / 2)
      minY = Math.min(minY, y - height / 2)
      maxX = Math.max(maxX, x + width / 2)
      maxY = Math.max(maxY, y + height / 2)
    }

    for (const node of nodes.values()) {
      const footprint = estimateRenderedNodeFootprint(node, true)
      includeRect(node.x, node.y, footprint.width, footprint.height)
    }

    for (const subgraph of subgraphs.values()) {
      includeRect(subgraph.x, subgraph.y, subgraph.width, subgraph.height)
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return { width: 0, height: 0 }
    }

    return {
      width: Math.ceil(maxX - minX),
      height: Math.ceil(maxY - minY),
    }
  }

  private _rebuildEdgePoints(
    edges: PositionedEdge[],
    nodes: Map<string, PositionedNode>,
  ): PositionedEdge[] {
    return edges.map((edge) => {
      const src = nodes.get(edge.source)
      const tgt = nodes.get(edge.target)
      if (!src || !tgt) return edge

      return {
        ...edge,
        points: [
          { x: src.x, y: src.y },
          { x: (src.x + tgt.x) / 2, y: (src.y + tgt.y) / 2 },
          { x: tgt.x, y: tgt.y },
        ],
      }
    })
  }
}
