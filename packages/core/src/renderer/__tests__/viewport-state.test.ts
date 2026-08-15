import { beforeAll, describe, expect, it, vi } from 'vitest'

let Viewport: typeof import('../viewport').Viewport

beforeAll(async () => {
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
  ;({ Viewport } = await import('../viewport'))
})

describe('Viewport state', () => {
  it('round-trips a finite pan and zoom state immediately', () => {
    const viewport = new Viewport()
    viewport.onZoomChange = vi.fn()
    viewport.onActivity = vi.fn()

    expect(viewport.restoreState({ x: 120, y: -48, zoom: 1.75 })).toBe(true)
    expect(viewport.getState()).toEqual({ x: 120, y: -48, zoom: 1.75 })
    expect(viewport.onZoomChange).toHaveBeenCalledWith(1.75)
  })

  it('rejects invalid state and clamps zoom to the supported range', () => {
    const viewport = new Viewport()

    expect(viewport.restoreState({ x: 0, y: 0, zoom: Number.NaN })).toBe(false)
    expect(viewport.restoreState({ x: 0, y: 0, zoom: 100 })).toBe(true)
    expect(viewport.getState().zoom).toBe(5)
  })
})
