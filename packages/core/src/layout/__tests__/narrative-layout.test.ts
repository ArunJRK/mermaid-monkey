import { describe, it, expect } from 'vitest'
import { NarrativeLayout } from '../narrative-layout'
import type { RenderGraph, RenderNode, RenderEdge } from '../../types'

/** Helper: build a RenderGraph from a compact description. */
function makeGraph(
  nodeIds: string[],
  edgePairs: Array<[string, string, string?]>,
  opts?: {
    shapes?: Record<string, RenderNode['shape']>
    direction?: string
    labels?: Record<string, string>
  },
): RenderGraph {
  const nodes = new Map<string, RenderNode>()
  for (const id of nodeIds) {
    nodes.set(id, {
      id,
      label: opts?.labels?.[id] ?? `Node ${id}`,
      shape: opts?.shapes?.[id] ?? 'rectangle',
      metadata: {},
    })
  }
  const edges: RenderEdge[] = edgePairs.map(([src, tgt, label], i) => ({
    id: `e${i}`,
    source: src,
    target: tgt,
    style: 'solid' as const,
    label,
  }))
  return {
    nodes,
    edges,
    subgraphs: new Map(),
    directives: [],
    direction: opts?.direction ?? 'TD',
    diagramType: 'flowchart',
  }
}

// ─── Spine Detection ───────────────────────────────────────────────

describe('NarrativeLayout — spine detection', () => {
  it('finds the single path as spine in a linear graph', () => {
    // A -> B -> C -> D
    const graph = makeGraph(['A', 'B', 'C', 'D'], [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'D'],
    ])
    const layout = new NarrativeLayout()
    const result = layout.compute(graph)

    // All nodes should exist and have positions
    expect(result.nodes.size).toBe(4)
    for (const [, node] of result.nodes) {
      expect(node.x).toBeDefined()
      expect(node.y).toBeDefined()
    }
  })

  it('selects the longest path as spine in a graph with branches', () => {
    // A -> B -> C -> D (spine, length 4)
    // B -> E (branch, length 2)
    const graph = makeGraph(['A', 'B', 'C', 'D', 'E'], [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'D'],
      ['B', 'E'],
    ])
    const layout = new NarrativeLayout()
    const spine = layout.detectSpine(graph)

    expect(spine).toEqual(['A', 'B', 'C', 'D'])
  })

  it('detects spine on a complex diamond graph', () => {
    // A -> B -> C -> F (top path, length 4)
    // A -> B -> D -> F (bottom path, also length 4 through B)
    // B -> E           (dead end, branch)
    // Either path through B->C->F or B->D->F is 4 nodes. spine picks longest.
    const graph = makeGraph(['A', 'B', 'C', 'D', 'E', 'F'], [
      ['A', 'B'],
      ['B', 'C'],
      ['B', 'D'],
      ['C', 'F'],
      ['D', 'F'],
      ['B', 'E'],
    ])
    const layout = new NarrativeLayout()
    const spine = layout.detectSpine(graph)

    // Spine should be length 4 and include A, B, and F
    expect(spine.length).toBe(4)
    expect(spine[0]).toBe('A')
    expect(spine[1]).toBe('B')
    expect(spine[spine.length - 1]).toBe('F')
  })
})

// ─── Lane Assignment ───────────────────────────────────────────────

describe('NarrativeLayout — lane assignment', () => {
  it('assigns all nodes to CENTER lane in a linear graph', () => {
    const graph = makeGraph(['A', 'B', 'C'], [
      ['A', 'B'],
      ['B', 'C'],
    ])
    const layout = new NarrativeLayout()
    const lanes = layout.assignLanes(graph)

    expect(lanes.get('A')).toBe('CENTER')
    expect(lanes.get('B')).toBe('CENTER')
    expect(lanes.get('C')).toBe('CENTER')
  })

  it('assigns decision branches: spine-continuation CENTER, off-spine LEFT', () => {
    // A -> B{decision} -> C (yes) -> E
    //                   -> D (no)  -> E
    // Spine: A -> B -> C -> E (C is on spine, stays CENTER)
    // D is off-spine, gets LEFT
    const graph = makeGraph(
      ['A', 'B', 'C', 'D', 'E'],
      [
        ['A', 'B'],
        ['B', 'C', 'Yes'],
        ['B', 'D', 'No'],
        ['C', 'E'],
        ['D', 'E'],
      ],
      { shapes: { B: 'diamond' } },
    )
    const layout = new NarrativeLayout()
    const lanes = layout.assignLanes(graph)

    // A and B on the spine -> CENTER
    expect(lanes.get('A')).toBe('CENTER')
    expect(lanes.get('B')).toBe('CENTER')
    // C is the spine-continuation -> CENTER
    expect(lanes.get('C')).toBe('CENTER')
    // D is off-spine -> LEFT
    expect(lanes.get('D')).toBe('LEFT')
    // Merge node E goes back to CENTER
    expect(lanes.get('E')).toBe('CENTER')
  })

  it('returns merge node to CENTER after decision', () => {
    // A -> B(decision) -> C -> D(merge)
    //                  -> E -> D
    const graph = makeGraph(
      ['A', 'B', 'C', 'D', 'E'],
      [
        ['A', 'B'],
        ['B', 'C'],
        ['B', 'E'],
        ['C', 'D'],
        ['E', 'D'],
      ],
      { shapes: { B: 'diamond' } },
    )
    const layout = new NarrativeLayout()
    const lanes = layout.assignLanes(graph)

    expect(lanes.get('D')).toBe('CENTER')
  })
})

// ─── Position Layout ───────────────────────────────────────────────

describe('NarrativeLayout — positioning', () => {
  it('places linear graph nodes in a vertical line (same x)', () => {
    const graph = makeGraph(['A', 'B', 'C'], [
      ['A', 'B'],
      ['B', 'C'],
    ])
    const layout = new NarrativeLayout()
    const result = layout.compute(graph)

    const a = result.nodes.get('A')!
    const b = result.nodes.get('B')!
    const c = result.nodes.get('C')!

    // All should share the same x (center lane)
    expect(a.x).toBe(b.x)
    expect(b.x).toBe(c.x)

    // Y should increase top-to-bottom
    expect(a.y).toBeLessThan(b.y)
    expect(b.y).toBeLessThan(c.y)
  })

  it('offsets off-spine branch nodes away from center lane', () => {
    // A -> B{decision} -> C (spine-continuation) -> E
    //                   -> D (branch)             -> E
    // Spine: A -> B -> C -> E. C stays CENTER. D is off-spine -> LEFT.
    const graph = makeGraph(
      ['A', 'B', 'C', 'D', 'E'],
      [
        ['A', 'B'],
        ['B', 'C'],
        ['B', 'D'],
        ['C', 'E'],
        ['D', 'E'],
      ],
      { shapes: { B: 'diamond' } },
    )
    const layout = new NarrativeLayout()
    const result = layout.compute(graph)

    const a = result.nodes.get('A')!
    const b = result.nodes.get('B')!
    const c = result.nodes.get('C')!
    const d = result.nodes.get('D')!

    // A, B, C are on the spine -> same x (center)
    expect(a.x).toBe(b.x)
    expect(b.x).toBe(c.x)

    // D is off-spine -> different x (left of center)
    expect(d.x).not.toBe(b.x)
    expect(d.x).toBeLessThan(b.x)
  })

  it('produces edges with waypoints', () => {
    const graph = makeGraph(['A', 'B', 'C'], [
      ['A', 'B'],
      ['B', 'C'],
    ])
    const layout = new NarrativeLayout()
    const result = layout.compute(graph)

    expect(result.edges.length).toBe(2)
    for (const edge of result.edges) {
      expect(edge.points.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('returns merge node to center x after branching', () => {
    const graph = makeGraph(
      ['A', 'B', 'C', 'D', 'E'],
      [
        ['A', 'B'],
        ['B', 'C'],
        ['B', 'D'],
        ['C', 'E'],
        ['D', 'E'],
      ],
      { shapes: { B: 'diamond' } },
    )
    const layout = new NarrativeLayout()
    const result = layout.compute(graph)

    const a = result.nodes.get('A')!
    const e = result.nodes.get('E')!

    // Merge node E should be back at center x (same as A)
    expect(e.x).toBe(a.x)
  })

  it('handles empty graph', () => {
    const graph = makeGraph([], [])
    const layout = new NarrativeLayout()
    const result = layout.compute(graph)

    expect(result.nodes.size).toBe(0)
    expect(result.edges.length).toBe(0)
    expect(result.width).toBe(0)
    expect(result.height).toBe(0)
  })

  it('handles single node graph', () => {
    const graph = makeGraph(['A'], [])
    const layout = new NarrativeLayout()
    const result = layout.compute(graph)

    expect(result.nodes.size).toBe(1)
    expect(result.nodes.get('A')).toBeDefined()
  })
})

// ─── Horizontal Flows (LR / RL) ────────────────────────────────────

/**
 * Reproduction graph from a real production doc: a linear chain with a
 * review-notes feedback loop and a decision branch.
 *
 *   script --> vo --> review{...} --notes--> vo
 *   review --> motion --> assemble --> render
 */
function makeProductionPipelineGraph(direction: string): RenderGraph {
  return makeGraph(
    ['script', 'vo', 'review', 'motion', 'assemble', 'render'],
    [
      ['script', 'vo'],
      ['vo', 'review'],
      ['review', 'vo', 'notes'],
      ['review', 'motion'],
      ['motion', 'assemble'],
      ['assemble', 'render'],
    ],
    { shapes: { review: 'diamond' }, direction },
  )
}

const PIPELINE_CHAIN = ['script', 'vo', 'review', 'motion', 'assemble', 'render']

describe('NarrativeLayout — horizontal flows (LR/RL)', () => {
  it('spreads an LR chain along x instead of stacking nodes at one point', () => {
    const graph = makeProductionPipelineGraph('LR')
    const layout = new NarrativeLayout()
    const result = layout.compute(graph)

    const nodes = PIPELINE_CHAIN.map((id) => result.nodes.get(id)!)

    // No two nodes may share the same point
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const samePoint = nodes[i].x === nodes[j].x && nodes[i].y === nodes[j].y
        expect(samePoint, `${PIPELINE_CHAIN[i]} and ${PIPELINE_CHAIN[j]} share one point`).toBe(false)
      }
    }

    // The chain advances monotonically along x (left to right)
    for (let i = 1; i < nodes.length; i++) {
      expect(nodes[i].x, `${PIPELINE_CHAIN[i]} should be right of ${PIPELINE_CHAIN[i - 1]}`)
        .toBeGreaterThan(nodes[i - 1].x)
    }

    // All chain nodes are on the CENTER lane: lane discipline holds on y
    for (let i = 1; i < nodes.length; i++) {
      expect(nodes[i].y).toBe(nodes[0].y)
    }
  })

  it('spreads an RL chain along x (right to left) without stacking', () => {
    const graph = makeProductionPipelineGraph('RL')
    const layout = new NarrativeLayout()
    const result = layout.compute(graph)

    const nodes = PIPELINE_CHAIN.map((id) => result.nodes.get(id)!)

    // The chain advances monotonically along x (right to left)
    for (let i = 1; i < nodes.length; i++) {
      expect(nodes[i].x, `${PIPELINE_CHAIN[i]} should be left of ${PIPELINE_CHAIN[i - 1]}`)
        .toBeLessThan(nodes[i - 1].x)
    }

    // Lane discipline still holds on y
    for (let i = 1; i < nodes.length; i++) {
      expect(nodes[i].y).toBe(nodes[0].y)
    }
  })

  it('offsets off-spine branches on the y axis for LR flows and keeps dagre x', () => {
    // A -> B{decision} -> C (spine-continuation) -> E
    //                   -> D (branch)             -> E
    const graph = makeGraph(
      ['A', 'B', 'C', 'D', 'E'],
      [
        ['A', 'B'],
        ['B', 'C'],
        ['B', 'D'],
        ['C', 'E'],
        ['D', 'E'],
      ],
      { shapes: { B: 'diamond' }, direction: 'LR' },
    )
    const layout = new NarrativeLayout()
    const result = layout.compute(graph)

    const a = result.nodes.get('A')!
    const b = result.nodes.get('B')!
    const c = result.nodes.get('C')!
    const d = result.nodes.get('D')!
    const e = result.nodes.get('E')!

    // Spine nodes share the CENTER lane on y
    expect(a.y).toBe(b.y)
    expect(b.y).toBe(c.y)

    // Off-spine branch D is offset away from the center lane on y
    expect(d.y).not.toBe(b.y)

    // Merge node E returns to the center lane
    expect(e.y).toBe(a.y)

    // The flow still advances along x
    expect(a.x).toBeLessThan(b.x)
    expect(b.x).toBeLessThan(c.x)
    expect(c.x).toBeLessThan(e.x)
  })

  it('keeps the TD reproduction chain on a single vertical lane (regression pin)', () => {
    const graph = makeProductionPipelineGraph('TD')
    const layout = new NarrativeLayout()
    const result = layout.compute(graph)

    const nodes = PIPELINE_CHAIN.map((id) => result.nodes.get(id)!)

    // All chain nodes share the CENTER lane on x
    for (let i = 1; i < nodes.length; i++) {
      expect(nodes[i].x).toBe(nodes[0].x)
    }

    // The chain advances monotonically along y (top to bottom)
    for (let i = 1; i < nodes.length; i++) {
      expect(nodes[i].y, `${PIPELINE_CHAIN[i]} should be below ${PIPELINE_CHAIN[i - 1]}`)
        .toBeGreaterThan(nodes[i - 1].y)
    }
  })
})

// ─── Edge Routing ──────────────────────────────────────────────────

describe('NarrativeLayout — edge routing', () => {
  it('spine edges are straight vertical (same x for start and end)', () => {
    const graph = makeGraph(['A', 'B', 'C'], [
      ['A', 'B'],
      ['B', 'C'],
    ])
    const layout = new NarrativeLayout()
    const result = layout.compute(graph)

    for (const edge of result.edges) {
      const first = edge.points[0]
      const last = edge.points[edge.points.length - 1]
      // Both endpoints should share the same x (straight vertical)
      expect(first.x).toBe(last.x)
    }
  })

  it('cross-lane edges have bezier control points with different x', () => {
    const graph = makeGraph(
      ['A', 'B', 'C', 'D', 'E'],
      [
        ['A', 'B'],
        ['B', 'C'],
        ['B', 'D'],
        ['C', 'E'],
        ['D', 'E'],
      ],
      { shapes: { B: 'diamond' } },
    )
    const layout = new NarrativeLayout()
    const result = layout.compute(graph)

    // Find cross-lane edges (B->C or B->D where one goes to a different lane)
    const crossLaneEdges = result.edges.filter((e) => {
      const src = result.nodes.get(e.source)!
      const tgt = result.nodes.get(e.target)!
      return src.x !== tgt.x
    })

    expect(crossLaneEdges.length).toBeGreaterThan(0)

    for (const edge of crossLaneEdges) {
      // Cross-lane edges should have at least 3 points (start, control, end)
      expect(edge.points.length).toBeGreaterThanOrEqual(3)
    }
  })
})
