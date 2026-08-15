import { describe, it, expect } from 'vitest'
import { computeSelfLoopGeometry } from '../self-loop-geometry'
import { measureTextWidth } from '../../layout/text-measure'

// Matches a typical dagre/narrative-sized state node (see philosophy-config.ts).
const NODE = { x: 163, y: 342 }
const FOOTPRINT = { width: 160, height: 48 }

describe('computeSelfLoopGeometry', () => {
  it('keeps a short label fully clear of the node on both edges', () => {
    const geometry = computeSelfLoopGeometry(NODE, FOOTPRINT, 'retry')
    const labelWidth = measureTextWidth('retry', 11)
    const labelLeftEdge = geometry.labelPosition.x - labelWidth / 2
    const nodeRightEdge = NODE.x + FOOTPRINT.width / 2

    expect(labelLeftEdge).toBeGreaterThan(nodeRightEdge)
  })

  it('keeps a long transition label from overlapping (truncating against) its own node', () => {
    // Mirrors the reported bug: a realistic long self-loop transition label
    // (e.g. "authoring continues, serving unchanged - INV-VIEW-038").
    const label = 'authoring continues, serving unchanged - INV-VIEW-038'
    const geometry = computeSelfLoopGeometry(NODE, FOOTPRINT, label)
    const labelWidth = measureTextWidth(label, 11)
    const labelLeftEdge = geometry.labelPosition.x - labelWidth / 2
    const nodeRightEdge = NODE.x + FOOTPRINT.width / 2

    expect(labelLeftEdge).toBeGreaterThan(nodeRightEdge)
  })

  it('scales the loop bulge reach with label length, bounded by a maximum', () => {
    const shortGeometry = computeSelfLoopGeometry(NODE, FOOTPRINT, 'ok')
    const longGeometry = computeSelfLoopGeometry(
      NODE,
      FOOTPRINT,
      'authoring continues, serving unchanged - INV-VIEW-038',
    )

    // The long-label loop must reach further right than the short-label loop...
    expect(longGeometry.cp1.x).toBeGreaterThan(shortGeometry.cp1.x)
    // ...but the reach is bounded, not unbounded proportional growth.
    expect(longGeometry.cp1.x).toBeLessThan(NODE.x + FOOTPRINT.width / 2 + 300)
  })
})
