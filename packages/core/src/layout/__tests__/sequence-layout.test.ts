import { describe, it, expect } from 'vitest'
import { SequenceLayout } from '../sequence-layout'
import type { RenderGraph, RenderNode, RenderEdge } from '../../types'

function actor(id: string, label: string): RenderNode {
  return { id, label, shape: 'rectangle', metadata: { diagramFamily: 'sequence', sequence: { kind: 'actor' } } }
}

function message(id: string, source: string, target: string, order: number, label?: string): RenderEdge {
  return {
    id,
    source,
    target,
    style: 'solid',
    ...(label ? { label } : {}),
    metadata: { diagramFamily: 'sequence', sequence: { kind: 'message', order } },
  }
}

/**
 * Mirrors the reported repro: a request/response pair between two actors,
 * followed by a nested call to a third actor. The V->C reply messages flow
 * "backwards" relative to declaration order — exactly the shape that
 * confuses a ranked-DAG layout (dagre) into reordering or collapsing rows.
 */
function makeReproGraph(): RenderGraph {
  const nodes = new Map<string, RenderNode>([
    ['C', actor('C', 'Client')],
    ['V', actor('V', 'Views (BKB)')],
    ['P', actor('P', 'ProbeRunner')],
  ])
  const edges: RenderEdge[] = [
    message('m0', 'C', 'V', 0, 'Publish (Idempotency-Key)'),
    message('m1', 'V', 'C', 1, '409 publication_in_progress'),
    message('m2', 'V', 'P', 2, 'await required Probe terminal results'),
    message('m3', 'V', 'C', 3, '200 final result'),
  ]
  return {
    nodes,
    edges,
    subgraphs: new Map(),
    directives: [],
    direction: 'LR',
    diagramType: 'sequenceDiagram',
  }
}

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    Math.abs(a.x - b.x) * 2 < a.width + b.width
    && Math.abs(a.y - b.y) * 2 < a.height + b.height
  )
}

describe('SequenceLayout', () => {
  it('keeps actor lanes in declaration order regardless of message direction', () => {
    const layout = new SequenceLayout()
    const result = layout.compute(makeReproGraph())

    const c = result.nodes.get('C')!
    const v = result.nodes.get('V')!
    const p = result.nodes.get('P')!

    // Declared order C, V, P must map to strictly ascending lane X —
    // a reply message (V -> C) must never pull C's lane out of order.
    expect(c.x).toBeLessThan(v.x)
    expect(v.x).toBeLessThan(p.x)
  })

  it('keeps every actor on the same header row (no rotated/zig-zag placement)', () => {
    const layout = new SequenceLayout()
    const result = layout.compute(makeReproGraph())

    const ys = Array.from(result.nodes.values()).map((node) => node.y)
    expect(new Set(ys).size).toBe(1)
  })

  it('gives each message its own row so same-pair messages never overlap', () => {
    const layout = new SequenceLayout()
    const result = layout.compute(makeReproGraph())

    const rowYs = result.edges.map((edge) => edge.points[0].y)
    expect(new Set(rowYs).size).toBe(rowYs.length)

    // Explicitly: the two V -> C replies (m1, m3) must not collapse onto
    // the same line, and message order must be preserved top-to-bottom.
    const m1 = result.edges.find((edge) => edge.id === 'm1')!
    const m3 = result.edges.find((edge) => edge.id === 'm3')!
    expect(m1.points[0].y).toBeLessThan(m3.points[0].y)
  })

  it('does not overlap any actor box with any other actor box', () => {
    const layout = new SequenceLayout()
    const result = layout.compute(makeReproGraph())
    const boxes = Array.from(result.nodes.values())

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(boxesOverlap(boxes[i], boxes[j])).toBe(false)
      }
    }
  })
})
