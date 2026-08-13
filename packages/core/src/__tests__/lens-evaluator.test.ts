import { describe, expect, it } from 'vitest'

import { evaluateGraphLenses } from '../lens-evaluator'
import type { RenderGraph } from '../types'

describe('evaluateGraphLenses', () => {
  it('scores matching nodes and edges and propagates edge relevance to connected nodes', () => {
    const graph: RenderGraph = {
      nodes: new Map([
        [
          'api',
          {
            id: 'api',
            label: 'API',
            shape: 'rectangle',
            metadata: { tags: ['runtime', 'risk'], owner: 'platform' },
          },
        ],
        [
          'audit',
          {
            id: 'audit',
            label: 'Audit',
            shape: 'rectangle',
            metadata: { tags: ['governance'] },
          },
        ],
        [
          'docs',
          {
            id: 'docs',
            label: 'Docs',
            shape: 'rectangle',
            metadata: {},
          },
        ],
      ]),
      edges: [
        {
          id: 'api->audit',
          source: 'api',
          target: 'audit',
          style: 'dotted',
          metadata: { status: 'unpinned', severity: 'critical' },
        },
      ],
      subgraphs: new Map(),
      directives: [
        {
          type: 'lens',
          name: 'risk',
          metadata: {
            include: ['tag:risk', 'status:unpinned', 'severity:critical'],
          },
        },
      ],
      direction: 'LR',
      diagramType: 'flowchart',
    }

    const [risk] = evaluateGraphLenses(graph)

    expect(risk.name).toBe('risk')
    expect(risk.edgeScores.get('api->audit')).toBeCloseTo(2 / 3)
    expect(risk.nodeScores.get('api')).toBeCloseTo((2 / 3) * 0.85)
    expect(risk.nodeScores.get('audit')).toBeCloseTo((2 / 3) * 0.85)
    expect(risk.nodeScores.get('docs')).toBe(0)
    expect(risk.matchedNodeIds).toEqual(['api', 'audit'])
    expect(risk.matchedEdgeIds).toEqual(['api->audit'])
  })

  it('preserves authored lens order and treats bare flags as truthy metadata matches', () => {
    const graph: RenderGraph = {
      nodes: new Map([
        [
          'gateway',
          {
            id: 'gateway',
            label: 'Gateway',
            shape: 'rectangle',
            metadata: { critical: true, kind: 'api' },
          },
        ],
      ]),
      edges: [],
      subgraphs: new Map(),
      directives: [
        { type: 'lens', name: 'critical', metadata: { include: 'critical' } },
        { type: 'lens', name: 'runtime', metadata: { include: 'kind:api' } },
      ],
      direction: 'LR',
      diagramType: 'flowchart',
    }

    expect(evaluateGraphLenses(graph).map((lens) => lens.name)).toEqual([
      'critical',
      'runtime',
    ])
  })
})
