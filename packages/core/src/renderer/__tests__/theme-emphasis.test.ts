import { describe, expect, it } from 'vitest'
import { getTheme, resolveTheme } from '../theme'

const DARK_PHILOSOPHIES = [
  'narrative',
  'map',
  'blueprint',
  'breath',
  'radial',
  'mosaic',
] as const

const MIN_HOVER_CONTRAST_DELTA = 1.12
const MIN_SELECTION_CONTRAST = 1.35
const MIN_DIMMED_TEXT_CONTRAST = 1.6
const MIN_DIMMED_ALPHA = 0.3
const MIN_BLUEPRINT_MEETING_HOVER_ALPHA = 0.28
const MIN_BLUEPRINT_GROUP_FILL_ALPHA = 0.4
const MIN_BLUEPRINT_GROUP_STROKE_ALPHA = 0.65
const MIN_BLUEPRINT_CONTEXT_ALPHA = 0.4
const MAX_BLUEPRINT_HOVER_BACKGROUND_ALPHA = 0.24

function toRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
}

function toHex([r, g, b]: [number, number, number]): number {
  return (r << 16) | (g << 8) | b
}

function linearize(channel: number): number {
  const normalized = channel / 255
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

function luminance(hex: number): number {
  const [r, g, b] = toRgb(hex)
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

function contrastRatio(foreground: number, background: number): number {
  const l1 = luminance(foreground)
  const l2 = luminance(background)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function composite(foreground: number, background: number, alpha: number): number {
  const fg = toRgb(foreground)
  const bg = toRgb(background)
  const blended: [number, number, number] = [0, 1, 2].map((index) => {
    return Math.round(fg[index] * alpha + bg[index] * (1 - alpha))
  }) as [number, number, number]
  return toHex(blended)
}

describe('theme emphasis perceptibility', () => {
  it('keeps hover and selection visually distinct from the base node fill', () => {
    const themes = [
      ...DARK_PHILOSOPHIES.map((philosophy) => [philosophy, getTheme(philosophy)] as const),
      ['narrative-light', resolveTheme('narrative', 'light', true)] as const,
    ]

    for (const [name, theme] of themes) {
      const hoverComposite = composite(theme.hoverGlow, theme.nodeFill, theme.hoverGlowAlpha)
      expect(
        contrastRatio(hoverComposite, theme.nodeFill),
        `${name} hover glow should remain perceptibly distinct from nodeFill`,
      ).toBeGreaterThanOrEqual(MIN_HOVER_CONTRAST_DELTA)

      expect(
        contrastRatio(theme.nodeStrokeSelected, theme.nodeFill),
        `${name} selected stroke should remain distinct from nodeFill`,
      ).toBeGreaterThanOrEqual(MIN_SELECTION_CONTRAST)
    }
  })

  it('keeps dimmed context readable and distinct from hidden', () => {
    const themes = [
      ...DARK_PHILOSOPHIES.map((philosophy) => [philosophy, getTheme(philosophy)] as const),
      ['narrative-light', resolveTheme('narrative', 'light', true)] as const,
    ]

    for (const [name, theme] of themes) {
      const dimmedFill = composite(theme.nodeFill, theme.background, theme.dimmedAlpha)
      const dimmedText = composite(theme.nodeText, theme.background, theme.dimmedAlpha)

      expect(
        contrastRatio(dimmedText, dimmedFill),
        `${name} dimmed text should remain readable against dimmed node fill`,
      ).toBeGreaterThanOrEqual(MIN_DIMMED_TEXT_CONTRAST)

      expect(
        theme.dimmedAlpha,
        `${name} dimmed alpha should remain visibly distinct from hidden (alpha 0)`,
      ).toBeGreaterThanOrEqual(MIN_DIMMED_ALPHA)

      expect(
        theme.hoverDimmedAlpha,
        `${name} hover background alpha should recede more than focus context`,
      ).toBeLessThan(theme.dimmedAlpha)
    }
  })

  it('keeps Blueprint strong enough for live topology discussion', () => {
    const theme = getTheme('blueprint')

    expect(theme.hoverGlowAlpha).toBeGreaterThanOrEqual(MIN_BLUEPRINT_MEETING_HOVER_ALPHA)
    expect(theme.dimmedAlpha).toBeGreaterThanOrEqual(MIN_BLUEPRINT_CONTEXT_ALPHA)
    expect(theme.hoverDimmedAlpha).toBeLessThanOrEqual(MAX_BLUEPRINT_HOVER_BACKGROUND_ALPHA)
    expect(theme.subgraphFillAlpha).toBeGreaterThanOrEqual(MIN_BLUEPRINT_GROUP_FILL_ALPHA)
    expect(theme.subgraphStrokeAlpha).toBeGreaterThanOrEqual(MIN_BLUEPRINT_GROUP_STROKE_ALPHA)
    expect(theme.gridAlpha ?? 1, 'blueprint grid should stay secondary to nodes and groups').toBeLessThanOrEqual(0.24)

    expect(
      contrastRatio(theme.subgraphLabel, theme.edgeLabelColor),
      'blueprint group labels should not collapse into passive edge labels',
    ).toBeGreaterThanOrEqual(1.15)
  })
})
