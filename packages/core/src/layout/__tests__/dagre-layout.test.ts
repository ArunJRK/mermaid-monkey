import { describe, it, expect } from 'vitest'
import { DagreLayout } from '../dagre-layout'
import type { RenderGraph, RenderNode, RenderEdge } from '../../types'

// Helper to make test graphs
function makeGraph(opts?: { collapsed?: string[] }): RenderGraph {
  const nodes = new Map<string, RenderNode>([
    ['A', { id: 'A', label: 'Node A', shape: 'rectangle', metadata: {} }],
    ['B', { id: 'B', label: 'Node B', shape: 'rectangle', metadata: {} }],
    ['C', { id: 'C', label: 'Node C', shape: 'rectangle', metadata: {} }],
  ])
  const edges: RenderEdge[] = [
    { id: 'e0', source: 'A', target: 'B', style: 'solid' },
    { id: 'e1', source: 'B', target: 'C', style: 'solid' },
  ]
  return {
    nodes,
    edges,
    subgraphs: new Map([
      [
        'sg1',
        {
          id: 'sg1',
          label: 'Group',
          nodeIds: ['B', 'C'],
          collapsed: opts?.collapsed?.includes('sg1') ?? false,
        },
      ],
    ]),
    directives: [],
    direction: 'TD',
    diagramType: 'flowchart',
  }
}

describe('DagreLayout', () => {
  it('positions all visible nodes', () => {
    const layout = new DagreLayout()
    const result = layout.compute(makeGraph())
    expect(result.nodes.size).toBe(3)
    for (const [, node] of result.nodes) {
      expect(node.x).toBeDefined()
      expect(node.y).toBeDefined()
      expect(node.width).toBeGreaterThan(0)
      expect(node.height).toBeGreaterThan(0)
    }
  })

  it('produces edges with at least 2 waypoints', () => {
    const layout = new DagreLayout()
    const result = layout.compute(makeGraph())
    expect(result.edges.length).toBe(2)
    for (const edge of result.edges) {
      expect(edge.points.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('does not overlap nodes', () => {
    const layout = new DagreLayout()
    const result = layout.compute(makeGraph())
    const positioned = Array.from(result.nodes.values())
    for (let i = 0; i < positioned.length; i++) {
      for (let j = i + 1; j < positioned.length; j++) {
        const a = positioned[i]
        const b = positioned[j]
        const overlapX = Math.abs(a.x - b.x) < (a.width + b.width) / 2
        const overlapY = Math.abs(a.y - b.y) < (a.height + b.height) / 2
        expect(overlapX && overlapY).toBe(false)
      }
    }
  })

  it('excludes folded children and shows summary node', () => {
    const layout = new DagreLayout()
    const graph = makeGraph({ collapsed: ['sg1'] })
    const result = layout.compute(graph)
    expect(result.nodes.has('B')).toBe(false)
    expect(result.nodes.has('C')).toBe(false)
    expect(result.nodes.has('sg1')).toBe(true)
  })

  it('deduplicates edges rerouted to summary node', () => {
    const layout = new DagreLayout()
    const nodes = new Map<string, RenderNode>([
      ['A', { id: 'A', label: 'A', shape: 'rectangle', metadata: {} }],
      ['B', { id: 'B', label: 'B', shape: 'rectangle', metadata: {} }],
      ['C', { id: 'C', label: 'C', shape: 'rectangle', metadata: {} }],
    ])
    const edges: RenderEdge[] = [
      { id: 'e0', source: 'A', target: 'B', style: 'solid' },
      { id: 'e1', source: 'A', target: 'C', style: 'solid' },
    ]
    const graph: RenderGraph = {
      nodes,
      edges,
      subgraphs: new Map([
        [
          'sg1',
          {
            id: 'sg1',
            label: 'Group',
            nodeIds: ['B', 'C'],
            collapsed: true,
          },
        ],
      ]),
      directives: [],
      direction: 'TD',
      diagramType: 'flowchart',
    }
    const result = layout.compute(graph)
    // A->B and A->C should collapse to single A->sg1
    expect(result.edges.length).toBe(1)
    expect(result.edges[0].source).toBe('A')
    expect(result.edges[0].target).toBe('sg1')
  })

  it('breath produces larger layout than blueprint', () => {
    const wide = new DagreLayout({ philosophy: 'breath' })
    const narrow = new DagreLayout({ philosophy: 'blueprint' })
    const wideResult = wide.compute(makeGraph())
    const narrowResult = narrow.compute(makeGraph())
    expect(wideResult.height).toBeGreaterThan(narrowResult.height)
  })

  it('spacing multiplier increases gaps', () => {
    const doubled = new DagreLayout({
      philosophy: 'narrative',
      spacingMultiplier: 2.0,
    })
    const normal = new DagreLayout({
      philosophy: 'narrative',
      spacingMultiplier: 1.0,
    })
    const doubledResult = doubled.compute(makeGraph())
    const normalResult = normal.compute(makeGraph())
    expect(doubledResult.height).toBeGreaterThan(normalResult.height)
  })

  it('handles empty graph', () => {
    const layout = new DagreLayout()
    const emptyGraph: RenderGraph = {
      nodes: new Map(),
      edges: [],
      subgraphs: new Map(),
      directives: [],
      direction: 'TD',
      diagramType: 'flowchart',
    }
    const result = layout.compute(emptyGraph)
    expect(result.nodes.size).toBe(0)
    expect(result.edges.length).toBe(0)
  })

  it('handles graph with cycle', () => {
    const layout = new DagreLayout()
    const nodes = new Map<string, RenderNode>([
      ['A', { id: 'A', label: 'A', shape: 'rectangle', metadata: {} }],
      ['B', { id: 'B', label: 'B', shape: 'rectangle', metadata: {} }],
      ['C', { id: 'C', label: 'C', shape: 'rectangle', metadata: {} }],
    ])
    const edges: RenderEdge[] = [
      { id: 'e0', source: 'A', target: 'B', style: 'solid' },
      { id: 'e1', source: 'B', target: 'C', style: 'solid' },
      { id: 'e2', source: 'C', target: 'A', style: 'solid' },
    ]
    const graph: RenderGraph = {
      nodes,
      edges,
      subgraphs: new Map(),
      directives: [],
      direction: 'TD',
      diagramType: 'flowchart',
    }
    const result = layout.compute(graph)
    expect(result.nodes.size).toBe(3)
  })

  it('keeps solid subgraph stages ordered when a dotted feedback edge returns to another node in the source cluster', () => {
    const nodes = new Map<string, RenderNode>([
      ['a1', { id: 'a1', label: 'a1', shape: 'rectangle', metadata: {} }],
      ['a2', { id: 'a2', label: 'a2', shape: 'rectangle', metadata: {} }],
      ['b1', { id: 'b1', label: 'b1', shape: 'rectangle', metadata: {} }],
      ['c1', { id: 'c1', label: 'c1', shape: 'rectangle', metadata: {} }],
    ])
    const graph: RenderGraph = {
      nodes,
      edges: [
        { id: 'a1-to-b1', source: 'a1', target: 'b1', style: 'solid' },
        { id: 'b1-to-c1', source: 'b1', target: 'c1', style: 'solid' },
        { id: 'c1-to-a2-feedback', source: 'c1', target: 'a2', style: 'dotted' },
      ],
      subgraphs: new Map([
        ['SG3', { id: 'SG3', label: 'Stage 3', nodeIds: ['c1'], collapsed: false }],
        ['SG1', { id: 'SG1', label: 'Stage 1', nodeIds: ['a1', 'a2'], collapsed: false }],
        ['SG2', { id: 'SG2', label: 'Stage 2', nodeIds: ['b1'], collapsed: false }],
      ]),
      directives: [],
      direction: 'TD',
      diagramType: 'flowchart',
    }

    const result = new DagreLayout({ philosophy: 'blueprint' }).compute(graph)
    const a1 = result.nodes.get('a1')!
    const b1 = result.nodes.get('b1')!
    const c1 = result.nodes.get('c1')!

    expect(b1.y, 'solid Stage 2 must follow Stage 1').toBeGreaterThan(a1.y)
    expect(c1.y, 'solid Stage 3 must follow Stage 2, regardless of feedback declaration order').toBeGreaterThan(b1.y)
  })

  it('computes subgraph bounds from member nodes', () => {
    const layout = new DagreLayout()
    const result = layout.compute(makeGraph())
    const sg = result.subgraphs.get('sg1')
    expect(sg).toBeDefined()
    expect(sg!.width).toBeGreaterThan(0)
    expect(sg!.height).toBeGreaterThan(0)
    // Subgraph should contain nodes B and C
    const nodeB = result.nodes.get('B')!
    const nodeC = result.nodes.get('C')!
    // Subgraph bounding box should encompass both nodes
    expect(sg!.x - sg!.width / 2).toBeLessThanOrEqual(
      Math.min(nodeB.x - nodeB.width / 2, nodeC.x - nodeC.width / 2),
    )
    expect(sg!.x + sg!.width / 2).toBeGreaterThanOrEqual(
      Math.max(nodeB.x + nodeB.width / 2, nodeC.x + nodeC.width / 2),
    )
  })
})
