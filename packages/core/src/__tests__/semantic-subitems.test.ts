import { describe, expect, it } from 'vitest'
import { computeNodeSemanticSubitems } from '../semantic-subitems'

describe('computeNodeSemanticSubitems', () => {
  it('exposes ER attributes as individually addressable rows', () => {
    const layout = computeNodeSemanticSubitems({
      id: 'PRODUCT',
      label: 'PRODUCT',
      width: 240,
      height: 80,
      metadata: {
        diagramFamily: 'er',
        er: {
          kind: 'entity',
          attributes: [
            { name: 'id', type: 'uuid', keys: ['PK'] },
            { name: 'owner_id', type: 'uuid', keys: ['FK'] },
          ],
        },
      },
    })

    expect(layout?.items).toMatchObject([
      {
        id: 'er:PRODUCT:attribute:id',
        parentKind: 'node',
        parentId: 'PRODUCT',
        itemKind: 'er-attribute',
        label: 'id',
      },
      {
        id: 'er:PRODUCT:attribute:owner_id',
        itemKind: 'er-attribute',
        label: 'owner_id',
      },
    ])
    expect(layout?.items[1]?.y).toBeGreaterThan(layout?.items[0]?.y ?? 0)
  })

  it('keeps class attributes and methods in distinct semantic compartments', () => {
    const layout = computeNodeSemanticSubitems({
      id: 'Product',
      label: 'Product',
      width: 260,
      height: 100,
      metadata: {
        diagramFamily: 'class',
        class: {
          kind: 'class',
          attributes: [{ display: '+id: uuid' }],
          methods: [{ display: '+publish(): void' }],
        },
      },
    })

    expect(layout?.items.map(({ id, itemKind }) => ({ id, itemKind }))).toEqual([
      {
        id: 'class:Product:attribute:+id: uuid',
        itemKind: 'class-attribute',
      },
      {
        id: 'class:Product:method:+publish(): void',
        itemKind: 'class-method',
      },
    ])
  })
})
