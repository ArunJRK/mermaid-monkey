import { describe, expect, it } from 'vitest'
import { computeErEntityTableLayout } from '../er-table-layout'
import { estimateRenderedNodeFootprint } from '../node-footprint'
import type { PositionedNode, RenderNode } from '../types'

function erEntityNode(overrides: Partial<RenderNode> = {}): RenderNode {
  return {
    id: 'FACT_ORDER',
    label: 'FACT_ORDER\norder_id: bigint PK\ncustomer_id: bigint FK\nnet_revenue: decimal',
    shape: 'subroutine',
    metadata: {
      diagramFamily: 'er',
      er: {
        kind: 'entity',
        attributes: [
          { name: 'order_id', type: 'bigint', keys: ['PK'] },
          { name: 'customer_id', type: 'bigint', keys: ['FK'] },
          { name: 'net_revenue', type: 'decimal', keys: [] },
        ],
      },
    },
    ...overrides,
  }
}

describe('ER table layout', () => {
  it('turns ER entity metadata into database-table columns', () => {
    const layout = computeErEntityTableLayout(erEntityNode())

    expect(layout).toMatchObject({
      entityName: 'FACT_ORDER',
      headerHeight: 32,
      rowHeight: 24,
    })
    expect(layout?.rows).toEqual([
      expect.objectContaining({ name: 'order_id', type: 'bigint', keyLabel: 'PK', isPrimaryKey: true }),
      expect.objectContaining({ name: 'customer_id', type: 'bigint', keyLabel: 'FK', isForeignKey: true }),
      expect.objectContaining({ name: 'net_revenue', type: 'decimal', keyLabel: '' }),
    ])
    expect(layout?.nameColumnLeft).toBeGreaterThan(layout?.paddingX ?? 0)
    expect(layout?.typeColumnLeft).toBeGreaterThan(layout?.nameColumnLeft ?? 0)
  })

  it('sizes the rendered footprint from ER table anatomy rather than multiline label text', () => {
    const node: PositionedNode = {
      ...erEntityNode(),
      x: 0,
      y: 0,
      width: 80,
      height: 36,
    }

    const tableLayout = computeErEntityTableLayout(node)
    const footprint = estimateRenderedNodeFootprint(node)

    expect(footprint).toEqual({
      width: tableLayout?.width,
      height: tableLayout?.height,
    })
  })

  it('leaves non-ER nodes on the normal label path', () => {
    expect(computeErEntityTableLayout({
      id: 'A',
      label: 'Plain',
      metadata: {},
    })).toBeNull()
  })
})
