import { beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * goal.md items 14–15: every label is fully contained within its node's
 * rendered shape — at every zoom level. `updateDetailLevel` counter-scales
 * the label font to keep it readable on screen; these tests pin the
 * invariant that this counter-scaling can never push the rendered label
 * outside the rendered shape, and that the shape's own geometry stays
 * stable while zooming (hit areas, badges, and the layout footprint all
 * derive from it).
 */

// BitmapFont installation needs a real canvas 2D context, which jsdom lacks.
// The stub below feeds Pixi's dynamic bitmap font a deterministic,
// font-size-proportional glyph metric instead.
vi.mock('../fonts', () => ({ ensureFontsInstalled: () => {} }))

const nodeTheme = {
  accent: 0x3b82f6,
  background: 0x0b1220,
  cornerRadius: 8,
  nodeFill: 0x1e293b,
  nodeStroke: 0x475569,
  nodeStrokeSelected: 0x93c5fd,
  nodeText: 0xf1f5f9,
  strokeWidth: 1.5,
  hoverGlow: 0x60a5fa,
  hoverGlowAlpha: 0.35,
  edgeColor: 0x64748b,
  edgeLabelColor: 0xcbd5e1,
  dimmedAlpha: 0.42,
  hoverDimmedAlpha: 0.2,
} as any

type Rect = { x: number; y: number; width: number; height: number }

/** Half a pixel of slack for float noise; a real spill is tens of pixels. */
const EPSILON = 0.5

function expectContained(label: Rect, shape: Rect, context: string): void {
  expect(label.x, `${context}: label left edge`).toBeGreaterThanOrEqual(shape.x - EPSILON)
  expect(label.y, `${context}: label top edge`).toBeGreaterThanOrEqual(shape.y - EPSILON)
  expect(label.x + label.width, `${context}: label right edge`)
    .toBeLessThanOrEqual(shape.x + shape.width + EPSILON)
  expect(label.y + label.height, `${context}: label bottom edge`)
    .toBeLessThanOrEqual(shape.y + shape.height + EPSILON)
}

describe('NodeSprite label containment across zoom levels', () => {
  beforeAll(() => {
    // Pixi's dynamic bitmap font path measures glyphs at a large base font
    // size via a canvas 2D context and scales down. Parse the px size from
    // `context.font` so measurements stay proportional to the requested
    // font size — that is the property the containment invariant rides on.
    ;(globalThis as any).CanvasRenderingContext2D = class CanvasRenderingContext2D {}
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: () => ({
        fillStyle: '',
        strokeStyle: '',
        font: '',
        textBaseline: 'alphabetic',
        lineWidth: 1,
        globalCompositeOperation: 'source-over',
        fillRect() {},
        clearRect() {},
        drawImage() {},
        fillText() {},
        strokeText() {},
        scale() {},
        translate() {},
        rotate() {},
        transform() {},
        setTransform() {},
        resetTransform() {},
        save() {},
        restore() {},
        beginPath() {},
        closePath() {},
        moveTo() {},
        lineTo() {},
        rect() {},
        arc() {},
        fill() {},
        stroke() {},
        clip() {},
        createImageData(w: number, h: number) {
          return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }
        },
        putImageData() {},
        getImageData() {
          return { data: new Uint8ClampedArray(4) }
        },
        measureText(text: string) {
          const fontPx = Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? 14)
          const width = text.length * fontPx * 0.6
          return {
            width,
            actualBoundingBoxLeft: 0,
            actualBoundingBoxRight: width,
            actualBoundingBoxAscent: fontPx * 0.8,
            actualBoundingBoxDescent: fontPx * 0.25,
            fontBoundingBoxAscent: fontPx * 0.8,
            fontBoundingBoxDescent: fontPx * 0.25,
            alphabeticBaseline: 0,
          }
        },
      }),
      configurable: true,
    })
  })

  async function makeSprite(label: string, shape = 'rectangle') {
    const { NodeSprite } = await import('../node-sprite')
    const node = {
      id: 'a',
      label,
      shape,
      x: 0,
      y: 0,
      width: 120,
      height: 48,
    } as any
    return new NodeSprite(node, nodeTheme)
  }

  // Zoom 0.7 is where the counter-scale branch starts: it is the point
  // where the desired world font size peaks (base / 0.7), so it is the
  // worst case for overflow. 0.65 covers the pinned branch below it,
  // 0.85 the descending slope above it, 2 the deep zoom-in shrink.
  const ZOOM_LEVELS = [0.65, 0.7, 0.85, 1, 2]

  it('keeps a label-sized node containing its label at every zoom level', async () => {
    const sprite = await makeSprite('apex render sequence bar')

    for (const zoom of ZOOM_LEVELS) {
      sprite.updateDetailLevel(zoom)
      expectContained(sprite.getLabelBounds(), sprite.getShapeBounds(), `zoom ${zoom}`)
    }
  })

  it('keeps a non-rectangular (diamond) shape containing its label at every zoom level', async () => {
    const sprite = await makeSprite('apex render sequence bar', 'diamond')

    for (const zoom of ZOOM_LEVELS) {
      sprite.updateDetailLevel(zoom)
      expectContained(sprite.getLabelBounds(), sprite.getShapeBounds(), `diamond zoom ${zoom}`)
    }
  })

  it('keeps the shape geometry stable while the zoom level changes', async () => {
    const sprite = await makeSprite('apex render sequence bar')
    const baseline = sprite.getShapeBounds()

    for (const zoom of ZOOM_LEVELS) {
      sprite.updateDetailLevel(zoom)
      expect(sprite.getShapeBounds(), `zoom ${zoom}`).toEqual(baseline)
    }
  })

  it('still counter-shrinks the label when zooming in, keeping screen size steady', async () => {
    const sprite = await makeSprite('apex render sequence bar')

    sprite.updateDetailLevel(1)
    const atFit = sprite.getLabelBounds().width

    sprite.updateDetailLevel(2)
    const zoomedIn = sprite.getLabelBounds().width

    // World size halves at 2x zoom so the on-screen size stays constant.
    expect(zoomedIn).toBeCloseTo(atFit / 2, 1)
  })
})
