import { describe, it, expect } from 'vitest'
import { buildGraph } from '../../graph-builder'

describe('journey diagrams (buildJourneyGraph)', () => {
  it('parses sections, steps, actors, and scores into a semantic graph', async () => {
    const source = `journey
    title My working day
    section Go to work
      Make tea: 5: Me
      Go upstairs: 3: Me
    section At work
      Do work: 1: Me, Boss`

    const result = await buildGraph(source)

    expect(result.success, JSON.stringify(result.errors)).toBe(true)
    expect(result.graph!.diagramType).toBe('journey')
    expect([...result.graph!.nodes.keys()]).toEqual([
      'journey:Go to work:Make tea:0',
      'journey:Go to work:Go upstairs:1',
      'journey:At work:Do work:2',
    ])

    expect(result.graph!.nodes.get('journey:Go to work:Make tea:0')).toMatchObject({
      label: 'Make tea',
      shape: 'rounded',
      metadata: {
        diagramFamily: 'journey',
        journey: { kind: 'step', section: 'Go to work', order: 0, score: 5, people: ['Me'] },
      },
    })
    // A step can list multiple actors.
    expect(result.graph!.nodes.get('journey:At work:Do work:2')).toMatchObject({
      metadata: { journey: { score: 1, people: ['Me', 'Boss'] } },
    })

    // Steps chain sequentially into "next" edges, even across a section boundary.
    expect(result.graph!.edges).toEqual([
      expect.objectContaining({
        id: 'journey:journey:Go_to_work:Make_tea:0:journey:Go_to_work:Go_upstairs:1',
        source: 'journey:Go to work:Make tea:0',
        target: 'journey:Go to work:Go upstairs:1',
        metadata: { diagramFamily: 'journey', journey: { kind: 'next', order: 0 } },
      }),
      expect.objectContaining({
        id: 'journey:journey:Go_to_work:Go_upstairs:1:journey:At_work:Do_work:2',
        source: 'journey:Go to work:Go upstairs:1',
        target: 'journey:At work:Do work:2',
      }),
    ])

    expect(result.graph!.subgraphs.get('journey:section:Go to work')).toMatchObject({
      label: 'Go to work',
      nodeIds: ['journey:Go to work:Make tea:0', 'journey:Go to work:Go upstairs:1'],
    })
  })

  it('degrades gracefully for a journey diagram with no sections or steps', async () => {
    const source = `journey
    title Empty`

    const result = await buildGraph(source)

    expect(result.success).toBe(true)
    expect(result.graph!.nodes.size).toBe(0)
    expect(result.graph!.edges).toHaveLength(0)
    expect(result.graph!.subgraphs.size).toBe(0)
  })

  it('reports a readable parse error instead of throwing for a step with no name', async () => {
    const source = `journey
    title Broken
    section
      : 4: Me`

    const result = await buildGraph(source)

    expect(result.success).toBe(false)
    expect(result.graph).toBeUndefined()
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe('PARSE_FAILED')
  })
})
