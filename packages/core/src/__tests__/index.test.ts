import { beforeAll, describe, expect, it } from 'vitest'

let api: typeof import('../index')

beforeAll(async () => {
  if (typeof HTMLCanvasElement !== 'undefined') {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: () => ({
        fillStyle: '',
        globalCompositeOperation: 'source-over',
        fillRect() {},
        drawImage() {},
        getImageData() {
          return { data: new Uint8ClampedArray(4) }
        },
      }),
      configurable: true,
    })
  }

  api = await import('../index')
})

describe('public api surface', () => {
  it('exports the pinned runtime entry points', () => {
    expect(Object.keys(api).sort()).toEqual([
      'BlueprintLayout',
      'DagreLayout',
      'FoldManager',
      'LoadPipeline',
      'MermaidRenderer',
      'buildGraph',
      'buildProjectIndex',
      'createVirtualFileResolver',
      'evaluateGraphLenses',
      'extractDirectives',
      'normalizeDiagramPath',
    ])
  })

  it('exposes the documented embed methods on MermaidRenderer', () => {
    const renderer = new api.MermaidRenderer()
    const proto = Object.getPrototypeOf(renderer) as Record<string, unknown>

    expect(typeof proto.mount).toBe('function')
    expect(typeof proto.load).toBe('function')
    expect(typeof proto.loadGraph).toBe('function')
    expect(typeof proto.activateLink).toBe('function')
    expect(typeof proto.setPhilosophy).toBe('function')
    expect(typeof proto.setThemeMode).toBe('function')
    expect(typeof proto.setThemeOverrides).toBe('function')
    expect(typeof proto.fitToView).toBe('function')
    expect(typeof proto.resetView).toBe('function')
    expect(typeof proto.getViewportState).toBe('function')
    expect(typeof proto.restoreViewportState).toBe('function')
    expect(typeof proto.setView).toBe('function')
    expect(typeof proto.foldNode).toBe('function')
    expect(typeof proto.unfoldNode).toBe('function')
    expect(typeof proto.foldAll).toBe('function')
    expect(typeof proto.unfoldAll).toBe('function')
    expect(typeof proto.focusSubgraph).toBe('function')
    expect(typeof proto.focusOut).toBe('function')
    expect(typeof proto.focusTo).toBe('function')
    expect(typeof proto.on).toBe('function')
    expect(typeof proto.off).toBe('function')
    expect(typeof proto.destroy).toBe('function')
  })
})
