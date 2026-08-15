import { describe, expect, it } from 'vitest'

/**
 * `getZoom` exists so hosts can size DOM overlays proportionally to the
 * geometry the anchor getters report. Anchors are already post-transform, so a
 * host that reads anchors without the zoom can only guess at scale, and a
 * fixed-size marker ends up larger than the node it annotates at fit zoom.
 */
describe('MermaidRenderer.getZoom', () => {
  it('reports the current viewport zoom', async () => {
    const { MermaidRenderer } = await import('../mermaid-renderer')
    const renderer = new MermaidRenderer() as any

    renderer._viewport = { _zoom: 0.192 }

    expect(renderer.getZoom()).toBe(0.192)
  })

  it('reflects later zoom changes rather than a captured snapshot', async () => {
    const { MermaidRenderer } = await import('../mermaid-renderer')
    const renderer = new MermaidRenderer() as any

    const viewport = { _zoom: 1 }
    renderer._viewport = viewport

    expect(renderer.getZoom()).toBe(1)

    viewport._zoom = 2.5
    expect(renderer.getZoom()).toBe(2.5)
  })

  it('falls back to identity scale when no viewport exists yet', async () => {
    const { MermaidRenderer } = await import('../mermaid-renderer')
    const renderer = new MermaidRenderer() as any

    renderer._viewport = null

    expect(renderer.getZoom()).toBe(1)
  })
})
