import { describe, it, expect } from 'vitest'
import { buildGraph } from '../../graph-builder'

describe('requirement diagrams (buildRequirementGraph)', () => {
  it('parses requirements, elements, and satisfies links into a semantic graph', async () => {
    const source = `requirementDiagram

    requirement test_req {
    id: 1
    text: the test text.
    risk: high
    verifymethod: test
    }

    element test_entity {
    type: simulation
    }

    test_entity - satisfies -> test_req`

    const result = await buildGraph(source)

    expect(result.success, JSON.stringify(result.errors)).toBe(true)
    expect(result.graph!.diagramType).toBe('requirementDiagram')
    expect([...result.graph!.nodes.keys()]).toEqual(['test_req', 'test_entity'])

    // The label combines the requirement id and text; risk/verifyMethod are
    // normalized to Mermaid's title-cased enum values.
    expect(result.graph!.nodes.get('test_req')).toMatchObject({
      label: '1\nthe test text.',
      shape: 'rounded',
      metadata: {
        diagramFamily: 'requirement',
        requirement: {
          kind: 'requirement',
          id: '1',
          requirementType: 'Requirement',
          text: 'the test text.',
          risk: 'High',
          verifyMethod: 'Test',
        },
      },
    })

    expect(result.graph!.nodes.get('test_entity')).toMatchObject({
      label: 'test_entity',
      shape: 'rectangle',
      metadata: {
        requirement: { kind: 'element', elementType: 'simulation', documentReference: '' },
      },
    })

    expect(result.graph!.edges).toEqual([
      expect.objectContaining({
        id: 'requirement:test_entity:test_req:satisfies',
        source: 'test_entity',
        target: 'test_req',
        label: 'satisfies',
        metadata: { diagramFamily: 'requirement', requirement: { kind: 'satisfies', order: 0 } },
      }),
    ])
  })

  it('degrades gracefully for a requirement diagram with no requirements or elements', async () => {
    const source = `requirementDiagram`

    const result = await buildGraph(source)

    expect(result.success).toBe(true)
    expect(result.graph!.nodes.size).toBe(0)
    expect(result.graph!.edges).toHaveLength(0)
  })

  it('reports a readable parse error instead of throwing for malformed requirement syntax', async () => {
    const source = `requirementDiagram
    requirement broken {
    id:`

    const result = await buildGraph(source)

    expect(result.success).toBe(false)
    expect(result.graph).toBeUndefined()
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe('PARSE_FAILED')
  })
})
