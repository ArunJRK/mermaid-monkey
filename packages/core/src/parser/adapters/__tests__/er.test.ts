import { describe, it, expect } from 'vitest'
import { buildGraph } from '../../graph-builder'

describe('ER diagrams (buildErGraph)', () => {
  it('parses entities, attributes, and relationship cardinality into a semantic graph', async () => {
    const source = `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER }o..|| SHIPPER : "shipped via"
    CUSTOMER {
      string id PK
      string name
    }`

    const result = await buildGraph(source)

    expect(result.success, JSON.stringify(result.errors)).toBe(true)
    expect(result.graph!.diagramType).toBe('erDiagram')
    expect([...result.graph!.nodes.keys()]).toEqual(['CUSTOMER', 'ORDER', 'SHIPPER'])

    expect(result.graph!.nodes.get('CUSTOMER')).toMatchObject({
      label: 'CUSTOMER\nid: string PK\nname: string',
      shape: 'subroutine',
      metadata: {
        diagramFamily: 'er',
        er: {
          kind: 'entity',
          attributes: [
            { type: 'string', name: 'id', keys: ['PK'] },
            { type: 'string', name: 'name', keys: [] },
          ],
        },
      },
    })

    // An entity referenced only by a relationship, with no attribute block, still
    // becomes a node whose label falls back to its bare id.
    expect(result.graph!.nodes.get('ORDER')).toMatchObject({
      label: 'ORDER',
      metadata: { er: { kind: 'entity', attributes: [] } },
    })

    expect(result.graph!.edges).toHaveLength(2)

    const places = result.graph!.edges.find((edge) => edge.source === 'CUSTOMER')
    expect(places).toMatchObject({
      id: 'er:CUSTOMER:ORDER:places:ONLY_ONE:ZERO_OR_MORE:IDENTIFYING',
      target: 'ORDER',
      style: 'solid',
      label: 'places',
      metadata: {
        er: {
          role: 'places',
          cardinality: '1 -> 0..*',
          sourceCardinality: 'ONLY_ONE',
          targetCardinality: 'ZERO_OR_MORE',
          relType: 'IDENTIFYING',
        },
      },
    })

    // A non-identifying ("..") relationship renders as a dotted edge.
    const shippedVia = result.graph!.edges.find((edge) => edge.source === 'ORDER')
    expect(shippedVia).toMatchObject({
      id: 'er:ORDER:SHIPPER:shipped_via:ZERO_OR_MORE:ONLY_ONE:NON_IDENTIFYING',
      target: 'SHIPPER',
      style: 'dotted',
      label: 'shipped via',
      metadata: { er: { relType: 'NON_IDENTIFYING' } },
    })
  })

  it('degrades gracefully for an ER diagram with no entities', async () => {
    const source = `erDiagram`

    const result = await buildGraph(source)

    expect(result.success).toBe(true)
    expect(result.graph!.diagramType).toBe('erDiagram')
    expect(result.graph!.nodes.size).toBe(0)
    expect(result.graph!.edges).toHaveLength(0)
  })

  it('reports a readable parse error instead of throwing for malformed ER syntax', async () => {
    const source = `erDiagram
    CUSTOMER []] ORDER`

    const result = await buildGraph(source)

    expect(result.success).toBe(false)
    expect(result.graph).toBeUndefined()
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe('PARSE_FAILED')
  })
})
