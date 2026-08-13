import { describe, it, expect, vi } from 'vitest'
import { BlueprintWireBuilder } from '../blueprint-wire-builder'
import { BlueprintLayout } from '../../layout/blueprint-layout'
import { buildGraph } from '../../parser/graph-builder'
import { estimateRenderedNodeFootprint } from '../../node-footprint'
import { COMPONENT_CLEARANCE } from '../types'
import type { PositionedGraph, PositionedNode, PositionedEdge } from '../../types'

function makeGraph(
  nodes: Array<[string, number, number, number, number]>,
  edges: Array<[string, string, string]>,
): PositionedGraph {
  const nodeMap = new Map<string, PositionedNode>()
  for (const [id, x, y, w, h] of nodes) {
    nodeMap.set(id, { id, label: id, shape: 'rectangle', metadata: {}, x, y, width: w, height: h })
  }
  const edgeList: PositionedEdge[] = edges.map(([id, src, tgt]) => ({
    id, source: src, target: tgt, style: 'solid' as const,
    points: [{ x: nodeMap.get(src)!.x, y: nodeMap.get(src)!.y },
             { x: nodeMap.get(tgt)!.x, y: nodeMap.get(tgt)!.y }],
  }))
  return { nodes: nodeMap, edges: edgeList, subgraphs: new Map(), width: 500, height: 500 }
}

describe('BlueprintWireBuilder', () => {
  it('routes a simple two-node edge', () => {
    const graph = makeGraph(
      [['A', 100, 40, 80, 40], ['B', 100, 200, 80, 40]],
      [['e1', 'A', 'B']],
    )
    const builder = new BlueprintWireBuilder(graph)
    const result = builder.route()
    expect(result.congested).toBe(false)
    expect(result.wires).toHaveLength(1)
    expect(result.wires[0].segments.length).toBeGreaterThanOrEqual(1)
  })

  it('uses side ports for horizontally adjacent nodes', () => {
    const graph = makeGraph(
      [['A', 100, 100, 80, 40], ['B', 300, 100, 80, 40]],
      [['e1', 'A', 'B']],
    )
    const builder = new BlueprintWireBuilder(graph)
    const result = builder.route()
    const segments = result.wires[0].segments
    const first = segments[0]
    const last = segments[segments.length - 1]

    expect(first.x1).toBeGreaterThan(100)
    expect(first.y1).toBe(100)
    expect(last.x2).toBeLessThan(300)
    expect(last.y2).toBe(100)
  })

  it('does not use a center port when a same-x pair is classified as horizontal', () => {
    const graph = makeGraph(
      [['A', 100, 100, 20, 200], ['B', 100, 180, 20, 200]],
      [['e1', 'A', 'B']],
    )
    const builder = new BlueprintWireBuilder(graph) as any

    const exit = builder._exitPort(graph.nodes.get('A'), graph.nodes.get('B'))

    expect(exit).not.toEqual({ x: 100, y: 100 })
    expect(exit.x).toBe(100)
    expect(exit.y).toBeGreaterThan(100)
  })

  it('creates fan-out bus for source with outDegree >= 2', () => {
    const graph = makeGraph(
      [['A', 180, 40, 80, 40], ['B', 80, 260, 80, 40], ['C', 300, 260, 80, 40]],
      [['e1', 'A', 'B'], ['e2', 'A', 'C']],
    )
    const builder = new BlueprintWireBuilder(graph)
    const result = builder.route()
    expect(result.congested).toBe(false)
    // Should have wires for both edges
    expect(result.wires).toHaveLength(2)
  })

  it('creates fan-in merge for target with inDegree >= 2', () => {
    const graph = makeGraph(
      [['A', 80, 40, 80, 40], ['B', 300, 40, 80, 40], ['C', 180, 260, 80, 40]],
      [['e1', 'A', 'C'], ['e2', 'B', 'C']],
    )
    const builder = new BlueprintWireBuilder(graph)
    const result = builder.route()
    expect(result.congested).toBe(false)
    expect(result.wires).toHaveLength(2)
  })

  it('rejects self-loops', () => {
    const graph = makeGraph(
      [['A', 100, 100, 80, 40]],
      [['e1', 'A', 'A']],
    )
    const builder = new BlueprintWireBuilder(graph)
    const result = builder.route()
    expect(result.wires).toHaveLength(0)
    expect(result.diagnostics).toEqual([
      {
        edgeId: 'e1',
        source: 'A',
        target: 'A',
        code: 'SELF_LOOP_SKIPPED',
        reason: 'Blueprint routing does not render self-loop wires.',
      },
    ])
  })

  it('falls back to a visible direct route instead of dropping an edge when A* fails', () => {
    const graph = makeGraph(
      [['A', 100, 40, 80, 40], ['B', 100, 200, 80, 40]],
      [['e1', 'A', 'B']],
    )
    const builder = new BlueprintWireBuilder(graph)
    vi.spyOn(builder as any, '_routeAstar').mockReturnValueOnce(null)

    const result = builder.route()

    expect(result.congested).toBe(true)
    expect(result.wires).toHaveLength(1)
    expect(result.wires[0].edgeId).toBe('e1')
    expect(result.wires[0].segments.length).toBeGreaterThanOrEqual(1)
    expect(result.diagnostics).toEqual([
      {
        edgeId: 'e1',
        source: 'A',
        target: 'B',
        code: 'FALLBACK_ROUTE',
        reason: 'No clear orthogonal path was found; a visible fallback route was used.',
      },
    ])
  })

  it('routes in a deterministic order independent of input edge order', () => {
    const nodes: Array<[string, number, number, number, number]> = [
      ['A', 100, 40, 80, 40],
      ['B', 60, 200, 80, 40],
      ['C', 200, 200, 80, 40],
      ['D', 320, 200, 80, 40],
    ]

    const forward = makeGraph(nodes, [
      ['e3', 'A', 'D'],
      ['e1', 'A', 'B'],
      ['e2', 'A', 'C'],
    ])
    const reversed = makeGraph(nodes, [
      ['e2', 'A', 'C'],
      ['e1', 'A', 'B'],
      ['e3', 'A', 'D'],
    ])

    const forwardResult = new BlueprintWireBuilder(forward).route()
    const reversedResult = new BlueprintWireBuilder(reversed).route()

    expect(forwardResult.wires.map((wire) => wire.edgeId)).toEqual(['e1', 'e2', 'e3'])
    expect(reversedResult.wires.map((wire) => wire.edgeId)).toEqual(['e1', 'e2', 'e3'])
    expect(reversedResult.wires).toEqual(forwardResult.wires)
  })

  it('does not route a later wire through a prior port escape inside another node footprint', () => {
    const graph = makeGraph(
      [
        ['X', 300, 200, 80, 40],
        ['Y', 300, 440, 80, 40],
        ['A', 60, 200, 80, 40],
        ['B', 560, 200, 80, 40],
      ],
      [
        ['a-x-to-y', 'X', 'Y'],
        ['b-a-to-b', 'A', 'B'],
      ],
    )

    const result = new BlueprintWireBuilder(graph).route()
    const laterWire = result.wires.find((wire) => wire.edgeId === 'b-a-to-b')!
    const nonEndpointNodes = ['X', 'Y'].map((nodeId) => graph.nodes.get(nodeId)!)

    const crossings = laterWire.segments.filter((segment) =>
      nonEndpointNodes.some((node) => {
        const footprint = estimateRenderedNodeFootprint(node, true)
        const minX = node.x - footprint.width / 2 - COMPONENT_CLEARANCE
        const maxX = node.x + footprint.width / 2 + COMPONENT_CLEARANCE
        const minY = node.y - footprint.height / 2 - COMPONENT_CLEARANCE
        const maxY = node.y + footprint.height / 2 + COMPONENT_CLEARANCE

        if (segment.isHorizontal) {
          return segment.y1 >= minY && segment.y1 <= maxY
            && Math.max(segment.x1, segment.x2) >= minX
            && Math.min(segment.x1, segment.x2) <= maxX
        }

        return segment.x1 >= minX && segment.x1 <= maxX
          && Math.max(segment.y1, segment.y2) >= minY
          && Math.min(segment.y1, segment.y2) <= maxY
      }),
    )

    expect(crossings, 'later wire must avoid every non-endpoint rendered footprint plus clearance').toEqual([])
  })

  it('approaches a left-side target port horizontally along the port normal', () => {
    const graph = makeGraph(
      [
        ['Unrelated node', 340, 200, 80, 40],
        ['Prior edge target', 340, 440, 80, 40],
        ['Route source', 60, 200, 80, 40],
        ['Route target', 560, 200, 80, 40],
      ],
      [
        ['prior-edge', 'Unrelated node', 'Prior edge target'],
        ['route-under-test', 'Route source', 'Route target'],
      ],
    )

    const result = new BlueprintWireBuilder(graph).route()
    const wire = result.wires.find((candidate) => candidate.edgeId === 'route-under-test')!
    const finalSegment = wire.segments[wire.segments.length - 1]

    expect(
      finalSegment.isHorizontal,
      'a left-side target port must be approached horizontally, not with a down arrow',
    ).toBe(true)
    expect(
      finalSegment.x2,
      'the arrow must point rightward into the target node left side',
    ).toBeGreaterThan(finalSegment.x1)
  })

  it('keeps ordinary lifecycle exits local while reserving the outer lane for the feedback loop', async () => {
    const source = `flowchart TD
  ReceiveBatch["1. Receive batch and bind CurrentPlan"]
  ResolveBatch["2. Resolve commands on a private copy"]
  FinalizePlan["3. Normalize and validate final plan"]
  ComparePlan{"4. Is final plan different<br/>from the plan we loaded?"}
  CommitPlan["5. Recheck CurrentPlan version<br/>and commit"]
  RejectBatch["Rejected<br/>no write"]
  ClarifyMeaning["Clarification required<br/>resubmit complete batch"]
  ResubmitBatch["Caller adds the selected meaning<br/>and resubmits the complete batch"]
  UnchangedResult["Unchanged<br/>no write"]
  StaleResult["Stale<br/>CurrentPlan changed meanwhile<br/>no write"]
  ChangedResult["Changed<br/>compact plan + ID mapping"]

  ReceiveBatch -->|valid| ResolveBatch
  ReceiveBatch -->|invalid| RejectBatch
  ResolveBatch -->|first ambiguity| ClarifyMeaning
  ClarifyMeaning --> ResubmitBatch
  ResubmitBatch -.-> ReceiveBatch
  ResolveBatch -->|invalid| RejectBatch
  ResolveBatch -->|all resolved| FinalizePlan
  FinalizePlan -->|invalid| RejectBatch
  FinalizePlan -->|valid| ComparePlan
  ComparePlan -->|no| UnchangedResult
  ComparePlan -->|yes| CommitPlan
  CommitPlan -->|version changed| StaleResult
  CommitPlan -->|committed| ChangedResult`

    const parsed = await buildGraph(source)
    expect(parsed.success).toBe(true)
    const graph = new BlueprintLayout().compute(parsed.graph!)
    const feedbackEdge = graph.edges.find(
      (edge) => edge.source === 'ResubmitBatch' && edge.target === 'ReceiveBatch',
    )
    expect(feedbackEdge?.style).toBe('dotted')

    const happyPath = [
      'ReceiveBatch',
      'ResolveBatch',
      'FinalizePlan',
      'ComparePlan',
      'CommitPlan',
    ].map((nodeId) => graph.nodes.get(nodeId)!)
    for (let index = 1; index < happyPath.length; index += 1) {
      expect(
        happyPath[index].y,
        `${happyPath[index].id} must remain below ${happyPath[index - 1].id}`,
      ).toBeGreaterThan(happyPath[index - 1].y)
    }

    const routed = new BlueprintWireBuilder(graph).route()
    const ordinaryWires = routed.wires.filter((wire) => wire.edgeId !== feedbackEdge?.id)
    const locallyRoutedPairs = new Set([
      'ReceiveBatch->ResolveBatch',
      'ResolveBatch->FinalizePlan',
      'FinalizePlan->ComparePlan',
      'ComparePlan->CommitPlan',
      'CommitPlan->StaleResult',
      'CommitPlan->ChangedResult',
    ])

    for (const wire of ordinaryWires) {
      const sourceNode = graph.nodes.get(wire.source)!
      const targetNode = graph.nodes.get(wire.target)!
      const directDistance = Math.abs(sourceNode.x - targetNode.x)
        + Math.abs(sourceNode.y - targetNode.y)
      const routedDistance = wire.segments.reduce(
        (total, segment) => total
          + Math.abs(segment.x2 - segment.x1)
          + Math.abs(segment.y2 - segment.y1),
        0,
      )
      expect(
        routedDistance,
        `${wire.source} -> ${wire.target} used ${routedDistance}px for a ${directDistance}px direct span`,
      ).toBeLessThanOrEqual(directDistance + 160)

      if (locallyRoutedPairs.has(`${wire.source}->${wire.target}`)) {
        expect(
          wire.segments.length,
          `${wire.source} -> ${wire.target} should remain local after normal-aligning its terminal approach`,
        ).toBeLessThanOrEqual(5)
      }
    }
  })
})
