import { describe, expect, it, vi } from 'vitest'

/**
 * Regression cover for roughdraft-markdown issue #7: `getSubgraphAnchors` was
 * never implemented, so host UIs optional-chaining it always received `[]` and
 * every subgraph-anchored callout collapsed onto one hardcoded canvas point.
 *
 * The host contract is the same `{ id, x, y, width, height }` shape that
 * `getNodeAnchors` returns, in post-transform canvas space.
 */
describe('MermaidRenderer.getSubgraphAnchors', () => {
  function fakeContainer(bounds: { x: number; y: number; width: number; height: number }) {
    return { getBounds: () => bounds }
  }

  it('returns a screen-space rect for every rendered subgraph container', async () => {
    const { MermaidRenderer } = await import('../mermaid-renderer')
    const renderer = new MermaidRenderer() as any

    renderer._subgraphContainers = new Map([
      ['CloudRuntime', fakeContainer({ x: 120, y: 80, width: 3078, height: 407 })],
      ['CustomerRuntime', fakeContainer({ x: 3300, y: 96, width: 940, height: 380 })],
    ])

    const anchors = renderer.getSubgraphAnchors()

    expect(anchors).toHaveLength(2)
    expect(anchors).toContainEqual({
      id: 'CloudRuntime',
      x: 120,
      y: 80,
      width: 3078,
      height: 407,
    })
    expect(anchors).toContainEqual({
      id: 'CustomerRuntime',
      x: 3300,
      y: 96,
      width: 940,
      height: 380,
    })
  })

  it('returns an empty list when nothing is rendered rather than throwing', async () => {
    const { MermaidRenderer } = await import('../mermaid-renderer')
    const renderer = new MermaidRenderer() as any

    renderer._subgraphContainers = new Map()

    expect(renderer.getSubgraphAnchors()).toEqual([])
  })

  it('reflects live container bounds so pan/zoom moves the anchor', async () => {
    const { MermaidRenderer } = await import('../mermaid-renderer')
    const renderer = new MermaidRenderer() as any

    const bounds = { x: 10, y: 20, width: 200, height: 100 }
    const getBounds = vi.fn(() => bounds)
    renderer._subgraphContainers = new Map([['A', { getBounds }]])

    expect(renderer.getSubgraphAnchors()[0]).toMatchObject({ id: 'A', x: 10, y: 20 })

    // Simulate a viewport transform moving the rendered container.
    bounds.x = 55
    bounds.y = 65

    expect(renderer.getSubgraphAnchors()[0]).toMatchObject({ id: 'A', x: 55, y: 65 })
    expect(getBounds).toHaveBeenCalledTimes(2)
  })
})
