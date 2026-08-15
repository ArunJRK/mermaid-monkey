import { describe, expect, it } from 'vitest'
import type { PositionedEdge, PositionedGraph, PositionedNode } from '../../types'
import { BlueprintWireBuilder } from '../blueprint-wire-builder'

function makeGraph(): PositionedGraph {
  const nodes = new Map<string, PositionedNode>([
    ['source', {
      id: 'source',
      label: 'source',
      shape: 'rectangle',
      metadata: {},
      x: 100,
      y: 100,
      width: 80,
      height: 40,
    }],
    ['blocker', {
      id: 'blocker',
      label: 'blocker',
      shape: 'rectangle',
      metadata: {},
      x: 240,
      y: 100,
      width: 80,
      height: 40,
    }],
    ['target', {
      id: 'target',
      label: 'target',
      shape: 'rectangle',
      metadata: {},
      x: 400,
      y: 100,
      width: 80,
      height: 40,
    }],
  ])
  const edges: PositionedEdge[] = [{
    id: 'edge',
    source: 'source',
    target: 'target',
    style: 'solid',
    points: [{ x: 100, y: 100 }, { x: 400, y: 100 }],
  }]

  return {
    nodes,
    edges,
    subgraphs: new Map(),
    width: 500,
    height: 200,
  }
}

describe('Blueprint routing congestion', () => {
  it('uses a clear orthogonal corridor instead of falling back through a blocking node', () => {
    const result = new BlueprintWireBuilder(makeGraph()).route()

    // The blocker has open space above and below it, so this route is not congested.
    expect(result.congested).toBe(false)
  })
})
