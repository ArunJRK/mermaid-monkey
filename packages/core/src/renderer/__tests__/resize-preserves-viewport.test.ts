import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest'

describe('MermaidRenderer resize handling', () => {
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

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('preserves the viewport transform when the canvas container resizes', async () => {
    let resizeCallback: (() => void) | undefined
    const observe = vi.fn()
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    const fitToView = vi.fn()

    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) {
        resizeCallback = callback
      }

      observe = observe
    })
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)

    const { MermaidRenderer } = await import('../mermaid-renderer')
    const renderer = new MermaidRenderer() as any
    const target = document.createElement('div')
    let width = 800
    let height = 600
    Object.defineProperties(target, {
      clientWidth: { get: () => width },
      clientHeight: { get: () => height },
    })
    const canvas = document.createElement('canvas')
    Object.defineProperty(canvas, 'parentElement', { value: target })

    renderer._app = {}
    renderer._viewport = { x: 120, y: 80, scale: { x: 0.75, y: 0.75 } }
    renderer._renderedBounds = { minX: 0, minY: 0, maxX: 640, maxY: 480 }
    renderer.fitToView = fitToView

    renderer._wireResizeHandling(canvas)
    expect(observe).toHaveBeenCalledWith(target)

    width = 1000
    height = 700
    resizeCallback?.()

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
    expect(fitToView).not.toHaveBeenCalled()
    expect(renderer._viewport).toMatchObject({ x: 120, y: 80, scale: { x: 0.75, y: 0.75 } })
  })

  it('redraws the Blueprint grid for the grown host without changing the viewport transform', async () => {
    let resizeCallback: (() => void) | undefined
    const observe = vi.fn()
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })

    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) {
        resizeCallback = callback
      }

      observe = observe
    })
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)

    const { MermaidRenderer } = await import('../mermaid-renderer')
    const renderer = new MermaidRenderer() as any
    const target = document.createElement('div')
    let width = 640
    let height = 480
    Object.defineProperties(target, {
      clientWidth: { get: () => width },
      clientHeight: { get: () => height },
    })
    const canvas = document.createElement('canvas')
    Object.defineProperty(canvas, 'parentElement', { value: target })

    const positioned = {
      width: 640,
      height: 480,
      nodes: new Map(),
      edges: [],
      subgraphs: new Map(),
    }
    const redrawBlueprintGrid = vi.fn()
    renderer._app = { renderer: { width, height } }
    renderer._viewport = {
      x: 120,
      y: 80,
      scale: { x: 0.75, y: 0.75 },
    }
    renderer._positioned = positioned
    renderer._currentPhilosophy = 'blueprint'
    renderer._redrawBlueprintGrid = redrawBlueprintGrid

    renderer._wireResizeHandling(canvas)
    // A modest host layout change (well under the drastic-resize area
    // threshold) must keep the transform and only redraw the grid.
    width = 820
    height = 560
    resizeCallback?.()

    expect(redrawBlueprintGrid).toHaveBeenCalledWith(width, height, positioned)
    expect(renderer._viewport).toMatchObject({
      x: 120,
      y: 80,
      scale: { x: 0.75, y: 0.75 },
    })
  })

  it('refits the diagram when the canvas size changes drastically (fullscreen toggle)', async () => {
    let resizeCallback: (() => void) | undefined
    const observe = vi.fn()
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    const cancelAnimationFrame = vi.fn()
    const fitToView = vi.fn()

    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) {
        resizeCallback = callback
      }

      observe = observe
    })
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame)

    const { MermaidRenderer } = await import('../mermaid-renderer')
    const renderer = new MermaidRenderer() as any
    const target = document.createElement('div')
    let width = 800
    let height = 600
    Object.defineProperties(target, {
      clientWidth: { get: () => width },
      clientHeight: { get: () => height },
    })
    const canvas = document.createElement('canvas')
    Object.defineProperty(canvas, 'parentElement', { value: target })

    renderer._app = {}
    renderer._viewport = { x: 120, y: 80, scale: { x: 0.75, y: 0.75 } }
    renderer._renderedBounds = { minX: 0, minY: 0, maxX: 640, maxY: 480 }
    renderer.fitToView = fitToView

    renderer._wireResizeHandling(canvas)

    // Entering fullscreen: the viewport area explodes in a single step.
    width = 1920
    height = 1080
    resizeCallback?.()
    expect(fitToView).toHaveBeenCalledTimes(1)
    expect(fitToView).toHaveBeenCalledWith({ preserveReadableZoom: true })

    // Leaving fullscreen: the area collapses again — refit once more.
    width = 800
    height = 600
    resizeCallback?.()
    expect(fitToView).toHaveBeenCalledTimes(2)
  })

  it('still redraws the Blueprint grid alongside a drastic-resize refit', async () => {
    let resizeCallback: (() => void) | undefined
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })

    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) {
        resizeCallback = callback
      }

      observe = vi.fn()
    })
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)

    const { MermaidRenderer } = await import('../mermaid-renderer')
    const renderer = new MermaidRenderer() as any
    const target = document.createElement('div')
    let width = 640
    let height = 480
    Object.defineProperties(target, {
      clientWidth: { get: () => width },
      clientHeight: { get: () => height },
    })
    const canvas = document.createElement('canvas')
    Object.defineProperty(canvas, 'parentElement', { value: target })

    const positioned = {
      width: 640,
      height: 480,
      nodes: new Map(),
      edges: [],
      subgraphs: new Map(),
    }
    const redrawBlueprintGrid = vi.fn()
    const fitToView = vi.fn()
    renderer._app = { renderer: { width, height } }
    renderer._viewport = { x: 120, y: 80, scale: { x: 0.75, y: 0.75 } }
    renderer._renderedBounds = { minX: 0, minY: 0, maxX: 640, maxY: 480 }
    renderer._positioned = positioned
    renderer._currentPhilosophy = 'blueprint'
    renderer._redrawBlueprintGrid = redrawBlueprintGrid
    renderer.fitToView = fitToView

    renderer._wireResizeHandling(canvas)
    width = 1920
    height = 1080
    resizeCallback?.()

    expect(fitToView).toHaveBeenCalledWith({ preserveReadableZoom: true })
    expect(redrawBlueprintGrid).toHaveBeenCalledWith(width, height, positioned)
  })
})
