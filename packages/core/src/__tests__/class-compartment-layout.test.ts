import { describe, expect, it } from 'vitest'
import { computeClassCompartmentLayout } from '../class-compartment-layout'
import { estimateRenderedNodeFootprint } from '../node-footprint'
import type { PositionedNode } from '../types'

const CLASS_NODE: PositionedNode = {
  id: 'UserService',
  label: 'UserService\n- repo: Repository<User>\n+ activate(userId: string): Result',
  shape: 'subroutine',
  x: 0,
  y: 0,
  width: 80,
  height: 36,
  metadata: {
    diagramFamily: 'class',
    class: {
      kind: 'class',
      attributes: [
        { name: 'repo: Repository<User>', visibility: '-', classifier: '', display: '- repo: Repository<User>' },
      ],
      methods: [
        {
          name: 'activate',
          visibility: '+',
          classifier: '',
          parameters: 'userId: string',
          returnType: 'Result',
          display: '+ activate(userId: string): Result',
        },
      ],
    },
  },
}

describe('class compartment layout', () => {
  it('computes a compartment footprint from class metadata', () => {
    const layout = computeClassCompartmentLayout(CLASS_NODE)

    expect(layout).toMatchObject({
      className: 'UserService',
      kind: 'class',
      headerHeight: 38,
      rowHeight: 22,
    })
    expect(layout?.sections.map((section) => ({
      kind: section.kind,
      rows: section.rows.map((row) => row.text),
    }))).toEqual([
      { kind: 'attributes', rows: ['- repo: Repository<User>'] },
      { kind: 'methods', rows: ['+ activate(userId: string): Result'] },
    ])
  })

  it('uses class compartment dimensions for rendered node footprint', () => {
    const layout = computeClassCompartmentLayout(CLASS_NODE)
    const footprint = estimateRenderedNodeFootprint(CLASS_NODE)

    expect(footprint).toEqual({
      width: layout?.width,
      height: layout?.height,
    })
  })
})
