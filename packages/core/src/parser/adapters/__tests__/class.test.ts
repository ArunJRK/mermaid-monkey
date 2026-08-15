import { describe, it, expect } from 'vitest'
import { buildGraph } from '../../graph-builder'

describe('class diagrams (buildClassGraph)', () => {
  it('parses class members, stereotypes, and relationships into a semantic graph', async () => {
    const source = `classDiagram
    class Animal {
      +String name
      +makeSound() void
    }
    class Dog
    class Shape {
      <<abstract>>
    }
    class Color {
      <<enumeration>>
      RED
      GREEN
    }
    Animal <|-- Dog
    Dog --> Color`

    const result = await buildGraph(source)

    expect(result.success, JSON.stringify(result.errors)).toBe(true)
    expect(result.graph!.diagramType).toBe('classDiagram')
    expect(result.graph!.direction).toBe('TB')
    expect([...result.graph!.nodes.keys()]).toEqual(['Animal', 'Dog', 'Shape', 'Color'])

    expect(result.graph!.nodes.get('Animal')).toMatchObject({
      label: 'Animal\n+ String name\n+ makeSound(): void',
      shape: 'subroutine',
      metadata: {
        diagramFamily: 'class',
        class: {
          kind: 'class',
          attributes: [{ name: 'String name', visibility: '+' }],
          methods: [{ name: 'makeSound', visibility: '+', parameters: '', returnType: 'void' }],
        },
      },
    })

    // A class with no members still becomes a node with empty attribute/method lists.
    expect(result.graph!.nodes.get('Dog')).toMatchObject({
      label: 'Dog',
      metadata: { class: { kind: 'class', attributes: [], methods: [] } },
    })

    // <<abstract>> stereotype is surfaced as both kind and stereotypes.
    expect(result.graph!.nodes.get('Shape')).toMatchObject({
      metadata: { class: { kind: 'abstract', stereotypes: ['abstract'] } },
    })

    // <<enumeration>> members are exposed as attributes without a visibility marker.
    expect(result.graph!.nodes.get('Color')).toMatchObject({
      label: 'Color\nRED\nGREEN',
      metadata: {
        class: {
          stereotypes: ['enumeration'],
          attributes: [
            { name: 'RED', visibility: '' },
            { name: 'GREEN', visibility: '' },
          ],
        },
      },
    })

    expect(result.graph!.edges).toEqual([
      expect.objectContaining({
        id: 'class:Animal:Dog:inheritance:relationship',
        source: 'Animal',
        target: 'Dog',
        style: 'solid',
        metadata: {
          diagramFamily: 'class',
          class: expect.objectContaining({
            kind: 'relationship',
            relationshipKind: 'inheritance',
            sourceMarker: 'extension',
            targetMarker: 'none',
          }),
        },
      }),
      expect.objectContaining({
        id: 'class:Dog:Color:dependency:relationship',
        source: 'Dog',
        target: 'Color',
        metadata: expect.objectContaining({
          class: expect.objectContaining({ relationshipKind: 'dependency' }),
        }),
      }),
    ])
  })

  it('reports a readable parse error instead of throwing for a class diagram with no body', async () => {
    const source = `classDiagram`

    const result = await buildGraph(source)

    expect(result.success).toBe(false)
    expect(result.graph).toBeUndefined()
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe('PARSE_FAILED')
  })

  it('reports a readable parse error instead of throwing for an unterminated class body', async () => {
    const source = `classDiagram
    class Foo {
    +++broken`

    const result = await buildGraph(source)

    expect(result.success).toBe(false)
    expect(result.errors[0].code).toBe('PARSE_FAILED')
  })
})
