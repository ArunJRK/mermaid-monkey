import type { PositionedNode } from './types'
import { computeNodeLabelLayout } from './layout/text-measure'
import { computeErEntityTableLayout } from './er-table-layout'
import { computeClassCompartmentLayout } from './class-compartment-layout'

const RENDERED_LABEL_PADDING_X = 40
const RENDERED_LABEL_PADDING_Y = 20

export interface NodeFootprint {
  width: number
  height: number
}

export function estimateRenderedNodeFootprint(
  node: Pick<PositionedNode, 'label' | 'width' | 'height'> & Partial<Pick<PositionedNode, 'id' | 'metadata'>>,
  monospace: boolean = false,
): NodeFootprint {
  const erTableLayout = computeErEntityTableLayout(node, monospace)
  if (erTableLayout) {
    return {
      width: erTableLayout.width,
      height: erTableLayout.height,
    }
  }

  const classCompartmentLayout = computeClassCompartmentLayout(node, monospace)
  if (classCompartmentLayout) {
    return {
      width: classCompartmentLayout.width,
      height: classCompartmentLayout.height,
    }
  }

  const labelLayout = computeNodeLabelLayout(
    node.label,
    node.width,
    node.height,
    RENDERED_LABEL_PADDING_X / 2,
    monospace,
  )
  return {
    width: Math.max(node.width, labelLayout.width),
    height: Math.max(node.height, labelLayout.height + RENDERED_LABEL_PADDING_Y / 2),
  }
}
