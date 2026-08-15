import { computeClassCompartmentLayout } from './class-compartment-layout'
import { computeErEntityTableLayout } from './er-table-layout'

interface SemanticSubitemNode {
  id: string
  label: string
  width?: number
  height?: number
  metadata?: Record<string, unknown>
}

export interface NodeSemanticSubitem {
  id: string
  parentKind: 'node'
  parentId: string
  itemKind: 'er-attribute' | 'class-attribute' | 'class-method'
  label: string
  x: number
  y: number
  width: number
  height: number
}

export interface NodeSemanticSubitemLayout {
  width: number
  height: number
  items: NodeSemanticSubitem[]
}

function uniqueSemanticId(
  prefix: string,
  label: string,
  occurrences: Map<string, number>,
): string {
  const occurrence = occurrences.get(label) ?? 0
  occurrences.set(label, occurrence + 1)
  return `${prefix}:${label}${occurrence > 0 ? `#${occurrence + 1}` : ''}`
}

export function computeNodeSemanticSubitems(
  node: SemanticSubitemNode,
  monospace = false,
): NodeSemanticSubitemLayout | null {
  const er = computeErEntityTableLayout(node, monospace)
  if (er) {
    const occurrences = new Map<string, number>()
    return {
      width: er.width,
      height: er.height,
      items: er.rows.map((row, index) => ({
        id: uniqueSemanticId(
          `er:${node.id}:attribute`,
          row.name,
          occurrences,
        ),
        parentKind: 'node',
        parentId: node.id,
        itemKind: 'er-attribute',
        label: row.name,
        x: 0,
        y: er.headerHeight + index * er.rowHeight,
        width: er.width,
        height: er.rowHeight,
      })),
    }
  }

  const classLayout = computeClassCompartmentLayout(node, monospace)
  if (!classLayout) return null

  const occurrences = new Map<string, number>()
  const items: NodeSemanticSubitem[] = []
  for (const section of classLayout.sections) {
    const itemKind =
      section.kind === 'attributes' ? 'class-attribute' : 'class-method'
    const idKind = section.kind === 'attributes' ? 'attribute' : 'method'
    for (const [index, row] of section.rows.entries()) {
      items.push({
        id: uniqueSemanticId(
          `class:${node.id}:${idKind}`,
          row.text,
          occurrences,
        ),
        parentKind: 'node',
        parentId: node.id,
        itemKind,
        label: row.text,
        x: 0,
        y:
          section.top +
          classLayout.sectionHeaderHeight +
          index * classLayout.rowHeight,
        width: classLayout.width,
        height: classLayout.rowHeight,
      })
    }
  }

  return {
    width: classLayout.width,
    height: classLayout.height,
    items,
  }
}
