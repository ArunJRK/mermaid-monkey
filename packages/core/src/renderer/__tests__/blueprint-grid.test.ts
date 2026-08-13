import { beforeAll, describe, expect, it, vi } from 'vitest'

describe('Blueprint grid background', () => {
  beforeAll(() => {
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
  })

  const blueprintTheme = {
    gridColor: 0x0c416d,
    gridAlpha: 0.2,
    gridSize: 20,
    dimmedAlpha: 0.42,
    hoverDimmedAlpha: 0.2,
  }

  it('draws the grid once during the initial Blueprint render, behind everything else', async () => {
    const { MermaidRenderer } = await import('../mermaid-renderer')
    const renderer = new MermaidRenderer() as any

    renderer._viewport = {
      removeChildren: vi.fn(),
      addChild: vi.fn(),
      addChildAt: vi.fn(),
      setChildIndex: vi.fn(),
      scale: { x: 1, y: 1 },
      x: 0,
      y: 0,
      _zoom: 1,
    }
    renderer._app = { ticker: { started: true, start: vi.fn(), stop: vi.fn() } }
    renderer._currentPhilosophy = 'blueprint'
    renderer._graph = null
    renderer._focusStack = []
    renderer._getActiveTheme = () => blueprintTheme
    renderer.fitToView = vi.fn()
    renderer._updateDetailLevel = vi.fn()
    renderer._applyPerformanceModeDetails = vi.fn()

    const positioned = {
      width: 640,
      height: 480,
      nodes: new Map(),
      edges: [],
      subgraphs: new Map(),
    }

    renderer._renderGraph(positioned)

    // A grid Graphics instance was created and inserted at index 0 — behind
    // any subgraphs/edges/nodes that get added afterwards via `addChild`.
    expect(renderer._blueprintGridGfx).toBeTruthy()
    expect(renderer._viewport.addChildAt).toHaveBeenCalledWith(renderer._blueprintGridGfx, 0)
  })

  it('drops a leftover Blueprint grid when an animated relayout switches to another philosophy', async () => {
    const { MermaidRenderer } = await import('../mermaid-renderer')
    const renderer = new MermaidRenderer() as any

    const staleGrid = { destroy: vi.fn() }
    renderer._blueprintGridGfx = staleGrid
    renderer._viewport = { alpha: 1 }
    renderer._app = { ticker: { started: true, start: vi.fn(), add: vi.fn(), remove: vi.fn() } }
    renderer._currentPhilosophy = 'narrative' // already switched away from blueprint
    renderer._getActiveTheme = () => blueprintTheme

    const positioned = {
      width: 640,
      height: 480,
      nodes: new Map(),
      edges: [],
      subgraphs: new Map(),
    }

    renderer._animateRelayout(positioned, positioned, 1)

    expect(staleGrid.destroy).toHaveBeenCalledTimes(1)
    expect(renderer._blueprintGridGfx).toBeNull()
    expect(renderer._app.ticker.add).toHaveBeenCalledTimes(1)
  })
})
