import type { PositionedGraph, PositionedNode, PositionedEdge } from '../types'
import type { RouteDiagnostic, RoutedWire, RouteResult, WireSegment } from './types'
import { COMPONENT_CLEARANCE, GRID_SIZE } from './types'
import { OccupancyGrid } from './occupancy-grid'
import { manhattanRoute, pathToSegments } from './manhattan-router'
import { estimateRenderedNodeFootprint } from '../node-footprint'

export class BlueprintWireBuilder {
  private _graph: PositionedGraph
  private _grid!: OccupancyGrid
  private _g: number
  private _usedFallbackRoute = false
  private _fallbackEdgeIds = new Set<string>()

  constructor(graph: PositionedGraph, gridSize: number = GRID_SIZE) {
    this._graph = graph
    this._g = gridSize
  }

  route(): RouteResult {
    const wires: RoutedWire[] = []
    this._usedFallbackRoute = false
    this._fallbackEdgeIds.clear()
    this._buildGrid()
    const orderedEdges = [...this._graph.edges]
      .sort((left, right) => this._compareEdges(left, right))

    // Compute degree maps
    const outDegree = new Map<string, string[]>()
    const inDegree = new Map<string, string[]>()
    for (const edge of orderedEdges) {
      if (edge.source === edge.target) continue // I15: reject self-loops
      if (!outDegree.has(edge.source)) outDegree.set(edge.source, [])
      outDegree.get(edge.source)!.push(edge.id)
      if (!inDegree.has(edge.target)) inDegree.set(edge.target, [])
      inDegree.get(edge.target)!.push(edge.id)
    }

    // Fan-out sources (outDegree >= 2)
    const fanOutSources = new Set<string>()
    for (const [src, edges] of outDegree) {
      if (edges.length >= 2) fanOutSources.add(src)
    }

    // Fan-in targets (inDegree >= 2)
    const fanInTargets = new Set<string>()
    for (const [tgt, edges] of inDegree) {
      if (edges.length >= 2) fanInTargets.add(tgt)
    }

    // Track which edges are handled by bus/merge
    const handled = new Set<string>()

    // Phase 1: Fan-out buses
    for (const srcId of fanOutSources) {
      const srcNode = this._graph.nodes.get(srcId)
      if (!srcNode) continue
      const edges = orderedEdges.filter(e => e.source === srcId)
      const busWires = this._routeFanOut(srcId, srcNode, edges)
      for (const w of busWires) {
        wires.push(w)
        handled.add(w.edgeId)
      }
    }

    // Phase 2: Fan-in merges (for edges not already handled by fan-out)
    for (const tgtId of fanInTargets) {
      const tgtNode = this._graph.nodes.get(tgtId)
      if (!tgtNode) continue
      const edges = orderedEdges.filter(e => e.target === tgtId && !handled.has(e.id))
      if (edges.length < 2) continue
      const mergeWires = this._routeFanIn(tgtId, tgtNode, edges)
      for (const w of mergeWires) {
        wires.push(w)
        handled.add(w.edgeId)
      }
    }

    // Phase 3: Direct routes for remaining single edges
    for (const edge of orderedEdges) {
      if (handled.has(edge.id)) continue
      if (edge.source === edge.target) continue
      const wire = this._routeDirect(edge)
      if (wire) {
        wires.push(wire)
      }
    }

    const diagnostics: RouteDiagnostic[] = []
    for (const edge of orderedEdges) {
      if (edge.source === edge.target) {
        diagnostics.push({
          edgeId: edge.id,
          source: edge.source,
          target: edge.target,
          code: 'SELF_LOOP_SKIPPED',
          reason: 'Blueprint routing does not render self-loop wires.',
        })
      } else if (this._fallbackEdgeIds.has(edge.id)) {
        diagnostics.push({
          edgeId: edge.id,
          source: edge.source,
          target: edge.target,
          code: 'FALLBACK_ROUTE',
          reason: 'No clear orthogonal path was found; a visible fallback route was used.',
        })
      }
    }
    return { wires, congested: this._usedFallbackRoute, diagnostics }
  }

  private _buildGrid(): void {
    const nodes = Array.from(this._graph.nodes.values())
    if (nodes.length === 0) {
      this._grid = new OccupancyGrid(0, 0, 100, 100, this._g)
      return
    }
    const footprints = nodes.map((node) => estimateRenderedNodeFootprint(node, true))
    const xs = nodes.map(n => n.x)
    const ys = nodes.map(n => n.y)
    const minX = Math.min(...xs.map((x, i) => x - footprints[i].width / 2))
    const minY = Math.min(...ys.map((y, i) => y - footprints[i].height / 2))
    const maxX = Math.max(...xs.map((x, i) => x + footprints[i].width / 2))
    const maxY = Math.max(...ys.map((y, i) => y + footprints[i].height / 2))
    this._grid = new OccupancyGrid(minX, minY, maxX, maxY, this._g)
    for (const node of nodes) {
      this._grid.markNode(node, true)
    }
  }

  private _exitPort(node: PositionedNode, target?: PositionedNode): { x: number; y: number } {
    const footprint = estimateRenderedNodeFootprint(node, true)
    if (target) {
      const dx = target.x - node.x
      const dy = target.y - node.y
      if (this._portAxis(node, target) === 'horizontal') {
        return { x: node.x + Math.sign(dx) * footprint.width / 2, y: node.y }
      }
      if (dy < 0) {
        return { x: node.x, y: node.y - footprint.height / 2 }
      }
    }
    return { x: node.x, y: node.y + footprint.height / 2 }
  }

  private _entryPort(node: PositionedNode, source?: PositionedNode): { x: number; y: number } {
    const footprint = estimateRenderedNodeFootprint(node, true)
    if (source) {
      const dx = node.x - source.x
      const dy = node.y - source.y
      if (this._portAxis(node, source) === 'horizontal') {
        return { x: node.x - Math.sign(dx) * footprint.width / 2, y: node.y }
      }
      if (dy < 0) {
        return { x: node.x, y: node.y + footprint.height / 2 }
      }
    }
    return { x: node.x, y: node.y - footprint.height / 2 }
  }

  private _portAxis(node: PositionedNode, other: PositionedNode): 'horizontal' | 'vertical' {
    const deltaX = other.x - node.x
    const deltaY = other.y - node.y
    if (deltaX === 0) return 'vertical'
    if (deltaY === 0) return 'horizontal'

    const nodeFootprint = estimateRenderedNodeFootprint(node, true)
    const otherFootprint = estimateRenderedNodeFootprint(other, true)
    const horizontalGap = Math.abs(deltaX)
      - (nodeFootprint.width + otherFootprint.width) / 2
    const verticalGap = Math.abs(deltaY)
      - (nodeFootprint.height + otherFootprint.height) / 2

    return horizontalGap > verticalGap ? 'horizontal' : 'vertical'
  }

  private _routeAstar(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    edgeId: string,
    options?: {
      reservePath?: boolean
      sourceNode?: PositionedNode
      targetNode?: PositionedNode
    },
  ): WireSegment[] | null {
    const targetPort = { x: toX, y: toY }
    const src = this._grid.worldToCell(fromX, fromY)
    const tgt = this._grid.worldToCell(toX, toY)
    const clearedCells = new Map<string, { gx: number; gy: number; occupied: boolean }>()
    const clearTemporarily = (gx: number, gy: number): void => {
      const key = `${gx},${gy}`
      if (clearedCells.has(key)) return
      clearedCells.set(key, {
        gx,
        gy,
        occupied: this._grid.clearCell(gx, gy),
      })
    }

    if (options?.sourceNode) {
      this._clearPortEscape(options.sourceNode, { x: fromX, y: fromY }, clearTemporarily)
    }
    if (options?.targetNode) {
      this._clearPortEscape(options.targetNode, targetPort, clearTemporarily)
    }

    for (const cell of [src, tgt]) {
      clearTemporarily(cell.gx, cell.gy)
      clearTemporarily(cell.gx, cell.gy - 1)
      clearTemporarily(cell.gx, cell.gy + 1)
      clearTemporarily(cell.gx - 1, cell.gy)
      clearTemporarily(cell.gx + 1, cell.gy)
    }

    let path
    try {
      path = manhattanRoute(this._grid, src, tgt)
    } finally {
      for (const cell of clearedCells.values()) {
        this._grid.restoreCell(cell.gx, cell.gy, cell.occupied)
      }
    }
    if (!path) return null

    if (options?.reservePath !== false) {
      // Mark interior cells only — keep first 2 and last 2 free for shared ports
      const markStart = Math.min(2, path.length - 1)
      const markEnd = Math.max(markStart, path.length - 2)
      for (let i = markStart; i < markEnd; i++) {
        this._grid.markPath([path[i]])
      }
    }

    const segments = pathToSegments(path, this._grid, edgeId)
    return options?.targetNode
      ? this._alignTargetApproach(segments, targetPort, options.targetNode, edgeId)
      : segments
  }

  private _clearPortEscape(
    node: PositionedNode,
    port: { x: number; y: number },
    clearCell: (gx: number, gy: number) => void,
  ): void {
    const footprint = estimateRenderedNodeFootprint(node, true)
    const portCell = this._grid.worldToCell(port.x, port.y)
    const isSidePort = Math.abs(port.x - node.x) >= Math.abs(port.y - node.y)

    if (isSidePort) {
      const min = this._grid.worldToCell(
        port.x,
        node.y - footprint.height / 2 - COMPONENT_CLEARANCE,
      )
      const max = this._grid.worldToCell(
        port.x,
        node.y + footprint.height / 2 + COMPONENT_CLEARANCE,
      )
      for (let gy = min.gy; gy <= max.gy; gy++) {
        clearCell(portCell.gx, gy)
      }
      return
    }

    const min = this._grid.worldToCell(
      node.x - footprint.width / 2 - COMPONENT_CLEARANCE,
      port.y,
    )
    const max = this._grid.worldToCell(
      node.x + footprint.width / 2 + COMPONENT_CLEARANCE,
      port.y,
    )
    for (let gx = min.gx; gx <= max.gx; gx++) {
      clearCell(gx, portCell.gy)
    }
  }

  private _portNormal(
    node: PositionedNode,
    port: { x: number; y: number },
  ): { x: number; y: number } {
    const isSidePort = Math.abs(port.x - node.x) >= Math.abs(port.y - node.y)
    if (isSidePort) {
      return { x: Math.sign(port.x - node.x), y: 0 }
    }
    return { x: 0, y: Math.sign(port.y - node.y) }
  }

  private _alignTargetApproach(
    segments: WireSegment[],
    targetPort: { x: number; y: number },
    targetNode: PositionedNode,
    edgeId: string,
  ): WireSegment[] {
    if (segments.length === 0) return segments
    const last = segments[segments.length - 1]
    const normal = this._portNormal(targetNode, targetPort)
    const approach = {
      x: Math.sign(last.x2 - last.x1),
      y: Math.sign(last.y2 - last.y1),
    }
    if (approach.x === -normal.x && approach.y === -normal.y) return segments

    const stub = {
      x: targetPort.x + normal.x * this._g,
      y: targetPort.y + normal.y * this._g,
    }
    const start = { x: last.x1, y: last.y1 }
    const replacement = normal.x !== 0
      ? [
          this._segment(start, { x: stub.x, y: start.y }, edgeId),
          this._segment({ x: stub.x, y: start.y }, stub, edgeId),
          this._segment(stub, targetPort, edgeId),
        ]
      : [
          this._segment(start, { x: start.x, y: stub.y }, edgeId),
          this._segment({ x: start.x, y: stub.y }, stub, edgeId),
          this._segment(stub, targetPort, edgeId),
        ]

    return this._compactSegments([
      ...segments.slice(0, -1),
      ...replacement,
    ])
  }

  private _compactSegments(segments: WireSegment[]): WireSegment[] {
    const merged: WireSegment[] = []
    for (const segment of segments) {
      if (segment.x1 === segment.x2 && segment.y1 === segment.y2) continue
      const previous = merged[merged.length - 1]
      const contiguous = previous
        && previous.x2 === segment.x1
        && previous.y2 === segment.y1
      if (contiguous && previous.isHorizontal === segment.isHorizontal) {
        previous.x2 = segment.x2
        previous.y2 = segment.y2
      } else {
        merged.push(segment)
      }
    }
    return merged
  }

  private _segment(
    start: { x: number; y: number },
    end: { x: number; y: number },
    edgeId: string,
  ): WireSegment {
    return {
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      isHorizontal: start.y === end.y,
      edgeId,
    }
  }

  private _routeDirect(edge: PositionedEdge): RoutedWire | null {
    const srcNode = this._graph.nodes.get(edge.source)
    const tgtNode = this._graph.nodes.get(edge.target)
    if (!srcNode || !tgtNode) return null
    const src = this._exitPort(srcNode, tgtNode)
    const tgt = this._entryPort(tgtNode, srcNode)
    const segments = this._routeAstar(src.x, src.y, tgt.x, tgt.y, edge.id, {
      sourceNode: srcNode,
      targetNode: tgtNode,
    })
      ?? this._alignTargetApproach(
        this._fallbackSegments(src, tgt, edge.id),
        tgt,
        tgtNode,
        edge.id,
      )
    return { edgeId: edge.id, segments, source: edge.source, target: edge.target }
  }

  private _routeFanOut(_srcId: string, srcNode: PositionedNode, edges: PositionedEdge[]): RoutedWire[] {
    const wires: RoutedWire[] = []

    for (const edge of edges) {
      const tgtNode = this._graph.nodes.get(edge.target)
      if (!tgtNode) continue
      const src = this._exitPort(srcNode, tgtNode)
      const tgt = this._entryPort(tgtNode, srcNode)
      const segments = this._routeAstar(src.x, src.y, tgt.x, tgt.y, edge.id, {
        reservePath: false,
        sourceNode: srcNode,
        targetNode: tgtNode,
      })
        ?? this._alignTargetApproach(
          this._fallbackSegments(src, tgt, edge.id),
          tgt,
          tgtNode,
          edge.id,
        )
      wires.push({ edgeId: edge.id, segments, source: edge.source, target: edge.target })
    }
    return wires
  }

  private _routeFanIn(_tgtId: string, tgtNode: PositionedNode, edges: PositionedEdge[]): RoutedWire[] {
    const wires: RoutedWire[] = []

    for (const edge of edges) {
      const srcNode = this._graph.nodes.get(edge.source)
      if (!srcNode) continue
      const src = this._exitPort(srcNode, tgtNode)
      const tgt = this._entryPort(tgtNode, srcNode)
      const segments = this._routeAstar(src.x, src.y, tgt.x, tgt.y, edge.id, {
        reservePath: false,
        sourceNode: srcNode,
        targetNode: tgtNode,
      })
        ?? this._alignTargetApproach(
          this._fallbackSegments(src, tgt, edge.id),
          tgt,
          tgtNode,
          edge.id,
        )
      wires.push({ edgeId: edge.id, segments, source: edge.source, target: edge.target })
    }
    return wires
  }

  private _fallbackSegments(
    src: { x: number; y: number },
    tgt: { x: number; y: number },
    edgeId: string,
  ): WireSegment[] {
    this._usedFallbackRoute = true
    this._fallbackEdgeIds.add(edgeId)
    if (src.x === tgt.x || src.y === tgt.y) {
      return [{
        x1: src.x,
        y1: src.y,
        x2: tgt.x,
        y2: tgt.y,
        isHorizontal: src.y === tgt.y,
        edgeId,
      }]
    }

    const midY = Math.round(((src.y + tgt.y) / 2) / this._g) * this._g
    return [
      { x1: src.x, y1: src.y, x2: src.x, y2: midY, isHorizontal: false, edgeId },
      { x1: src.x, y1: midY, x2: tgt.x, y2: midY, isHorizontal: true, edgeId },
      { x1: tgt.x, y1: midY, x2: tgt.x, y2: tgt.y, isHorizontal: false, edgeId },
    ]
  }

  private _compareEdges(left: PositionedEdge, right: PositionedEdge): number {
    return left.id.localeCompare(right.id)
      || left.source.localeCompare(right.source)
      || left.target.localeCompare(right.target)
  }
}
