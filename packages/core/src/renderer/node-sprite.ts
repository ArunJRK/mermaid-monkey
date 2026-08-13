import { Container, Graphics, BitmapText } from 'pixi.js'
import type { PositionedNode, NodeShape } from '../types'
import { ensureFontsInstalled } from './fonts'
import type { Theme } from './theme'
import { estimateRenderedNodeFootprint } from '../node-footprint'
import {
  computeErEntityTableLayout,
  type ErEntityTableLayout,
  type ErTableAttributeRow,
} from '../er-table-layout'
import {
  computeClassCompartmentLayout,
  type ClassCompartmentLayout,
} from '../class-compartment-layout'
import { computeNodeLabelLayout } from '../layout/text-measure'
import { splitRenderedLabelIntoRichLines } from '../label-markup'
import {
  computeNodeSemanticSubitems,
  type NodeSemanticSubitem,
} from '../semantic-subitems'

const RENDERED_LABEL_PADDING_X = 40
const RENDERED_LABEL_PADDING_Y = 24

type BoundsRect = {
  x: number
  y: number
  width: number
  height: number
}

export type ScreenSemanticSubitem = NodeSemanticSubitem

type ResolvedNodeStyle = {
  fill: number
  stroke: number
  text: number
  strokeWidth: number
  strokeDasharray?: number[]
}

export class NodeSprite extends Container {
  data: PositionedNode
  private _gfx!: Graphics
  private _hoverGfx!: Graphics
  private _selectionGfx!: Graphics
  private _label!: Container
  private _labelTexts: BitmapText[] = []
  private _labelTextBaseFontSizes: number[] = []
  private _linkBadge: Graphics | null = null
  private _linkState: false | 'valid' | 'broken' = false
  private _hovered = false
  private _selected = false
  private _theme: Theme
  private _displayWidth: number
  private _displayHeight: number
  private _fontName: string
  private _badgeAccent: number | null = null
  private _badgeKind: 'valid' | 'broken' | null = null

  constructor(
    node: PositionedNode,
    theme: Theme,
    linkState: false | 'valid' | 'broken' = false,
    fontName = 'MermaidNode',
  ) {
    super()
    this.data = node
    this._theme = theme
    this._displayWidth = estimateRenderedNodeFootprint(node, fontName === 'MermaidBlueprint').width
    this._displayHeight = estimateRenderedNodeFootprint(node, fontName === 'MermaidBlueprint').height
    this._fontName = fontName

    this.x = node.x
    this.y = node.y

    this.eventMode = 'static'
    this.cursor = 'pointer'

    this._rebuildVisuals(node, theme, linkState, fontName)

    // Hover events
    this.on('pointerover', () => {
      this._hovered = true
      this._hoverGfx.alpha = 1
    })
    this.on('pointerout', () => {
      this._hovered = false
      this._hoverGfx.alpha = 0
    })
  }

  updateAppearance(
    theme: Theme,
    linkState: false | 'valid' | 'broken' = false,
    fontName = this._fontName,
  ): void {
    this._rebuildVisuals(this.data, theme, linkState, fontName)
  }

  private _rebuildVisuals(
    node: PositionedNode,
    theme: Theme,
    linkState: false | 'valid' | 'broken',
    fontName: string,
  ): void {
    this.data = node
    this._theme = theme
    this._fontName = fontName
    this._linkState = linkState
    const usesBlueprintFont = fontName === 'MermaidBlueprint'
    const renderedFootprint = estimateRenderedNodeFootprint(node, fontName === 'MermaidBlueprint')
    const erTableLayout = computeErEntityTableLayout(node, usesBlueprintFont)
    const classCompartmentLayout = computeClassCompartmentLayout(node, usesBlueprintFont)
    const labelLayout = erTableLayout || classCompartmentLayout
      ? null
      : computeNodeLabelLayout(
        node.label,
        node.width,
        node.height,
        RENDERED_LABEL_PADDING_X / 2,
        usesBlueprintFont,
      )
    this._displayWidth = renderedFootprint.width
    this._displayHeight = renderedFootprint.height
    this._badgeAccent = null
    this._badgeKind = null
    this.removeChildren()

    // Main shape
    this._gfx = new Graphics()
    const nodeStyle = this._resolveNodeStyle(node, theme)
    if (erTableLayout) {
      this._drawErEntityTable(erTableLayout, nodeStyle)
    } else if (classCompartmentLayout) {
      this._drawClassCompartment(classCompartmentLayout, nodeStyle)
    } else {
      this._drawShape(node.shape, this._displayWidth, this._displayHeight, nodeStyle)
    }
    this.addChild(this._gfx)

    // Label — sanitized rich text, node must be sized to fit.
    ensureFontsInstalled()
    const labelMetrics = erTableLayout
      ? this._buildErEntityTableLabel(erTableLayout, fontName, nodeStyle)
      : classCompartmentLayout
        ? this._buildClassCompartmentLabel(classCompartmentLayout, fontName, nodeStyle)
      : this._buildLabel(labelLayout!.label, node, fontName, nodeStyle.text, 14)
    this.addChild(this._label)

    // If label is wider than node, expand the node shape to fit
    if (!erTableLayout && !classCompartmentLayout) {
      const labelWidth = labelMetrics.width
      if (labelWidth + RENDERED_LABEL_PADDING_X > this._displayWidth) {
        const expandedWidth = labelWidth + RENDERED_LABEL_PADDING_X
        this._displayWidth = expandedWidth
        this._gfx.clear()
        this._drawShape(node.shape, expandedWidth, this._displayHeight, nodeStyle)
      }
      if (labelMetrics.height + RENDERED_LABEL_PADDING_Y > this._displayHeight) {
        this._displayHeight = labelMetrics.height + RENDERED_LABEL_PADDING_Y
        this._gfx.clear()
        this._drawShape(node.shape, this._displayWidth, this._displayHeight, nodeStyle)
      }
    }

    // Link badge — interactive icon at top-right indicating "has linked file"
    if (linkState) {
      const bx = this._displayWidth / 2 - 6
      const by = -this._displayHeight / 2 + 6
      const accent = linkState === 'broken' ? theme.brokenLinkAccent : theme.accent
      const badgeKind = linkState === 'broken' ? 'broken' : 'valid'
      this._badgeAccent = accent
      this._badgeKind = badgeKind
      this._linkBadge = new Graphics()
      this._linkBadge.eventMode = 'static'
      this._linkBadge.cursor = 'pointer'

      // Draw badge circle + arrow
      this._drawLinkBadge(bx, by, accent, nodeStyle.fill, 1.0, badgeKind)

      // Badge hit area (larger than visual for easier clicking)
      this._linkBadge.hitArea = {
        contains: (x: number, y: number) => {
          const dx = x - bx, dy = y - by
          return dx * dx + dy * dy <= 14 * 14
        },
      }

      // Hover: enlarge badge
      this._linkBadge.on('pointerover', () => {
        this._linkBadge!.clear()
        this._drawLinkBadge(bx, by, accent, nodeStyle.fill, 1.3, badgeKind)
      })
      this._linkBadge.on('pointerout', () => {
        this._linkBadge!.clear()
        this._drawLinkBadge(bx, by, accent, nodeStyle.fill, 1.0, badgeKind)
      })

      // Click badge emits 'badge:click' — renderer wires this to link:navigate
      this._linkBadge.on('pointertap', (e) => {
        e.stopPropagation() // don't trigger node click
        this.emit('badge:click')
      })

      this.addChild(this._linkBadge)
    }

    // Hover/selection overlays stay above labels and badges.
    this._hoverGfx = new Graphics()
    this._hoverGfx.alpha = 0
    this.addChild(this._hoverGfx)
    this._drawHoverGlow(node.shape, this._displayWidth + 12, this._displayHeight + 12)

    this._selectionGfx = new Graphics()
    this._selectionGfx.alpha = 0
    this.addChild(this._selectionGfx)
    this._drawSelectionRing(node.shape, this._displayWidth + 10, this._displayHeight + 10)

    // Hit area
    this.hitArea = {
      contains: (x: number, y: number) => {
        const hw = this._displayWidth / 2 + 4
        const hh = this._displayHeight / 2 + 4
        return x >= -hw && x <= hw && y >= -hh && y <= hh
      },
    }

    this._selectionGfx.alpha = this._selected ? 1 : 0
    this._hoverGfx.alpha = this._hovered ? 1 : 0
  }

  private _buildLabel(
    renderedText: string,
    node: PositionedNode,
    fontName: string,
    fill: number,
    fontSize: number,
  ): { width: number; height: number } {
    this._label = new Container()
    this._labelTexts = []
    this._labelTextBaseFontSizes = []

    const lines = splitRenderedLabelIntoRichLines(renderedText, node.labelMarkup)
    const lineHeight = Math.ceil(fontSize * 1.35)
    const startY = -((lines.length - 1) * lineHeight) / 2
    let maxWidth = 0

    lines.forEach((line, lineIndex) => {
      const segmentTexts = line.length > 0 ? line : [{ text: '', bold: false }]
      const created: BitmapText[] = []
      let width = 0

      for (const segment of segmentTexts) {
        if (segment.text.length === 0) continue
        const text = new BitmapText({
          text: segment.text,
          style: {
            fontFamily: segment.bold ? this._boldFontName(fontName) : fontName,
            fontSize,
            fill,
          },
        })
        text.anchor.set(0, 0.5)
        text.x = width
        text.y = startY + lineIndex * lineHeight
        width += text.width
        created.push(text)
        this._trackLabelText(text, fontSize)
      }

      const offsetX = -width / 2
      for (const text of created) {
        text.x += offsetX
        this._label.addChild(text)
      }
      maxWidth = Math.max(maxWidth, width)
    })

    return {
      width: maxWidth,
      height: Math.max(lineHeight, lines.length * lineHeight),
    }
  }

  private _boldFontName(fontName: string): string {
    return fontName === 'MermaidBlueprint' ? 'MermaidBlueprintBold' : 'MermaidNodeBold'
  }

  private _trackLabelText(text: BitmapText, baseFontSize: number): void {
    this._labelTexts.push(text)
    this._labelTextBaseFontSizes.push(baseFontSize)
  }

  private _drawErEntityTable(layout: ErEntityTableLayout, nodeStyle: ResolvedNodeStyle): void {
    const g = this._gfx
    const left = -layout.width / 2
    const top = -layout.height / 2
    const right = layout.width / 2
    const bottom = layout.height / 2
    const rowTop = top + layout.headerHeight
    const r = this._theme.cornerRadius

    g.roundRect(left, top, layout.width, layout.height, r)
    g.fill({ color: nodeStyle.fill })
    g.roundRect(left, top, layout.width, layout.headerHeight, r)
    g.fill({ color: nodeStyle.stroke, alpha: 0.18 })

    g.moveTo(left, rowTop).lineTo(right, rowTop)
    g.stroke({ width: nodeStyle.strokeWidth, color: nodeStyle.stroke, alpha: 0.9 })

    if (layout.rows.length > 0) {
      const dividerX = left + layout.typeDividerLeft
      g.moveTo(dividerX, rowTop).lineTo(dividerX, bottom)
      g.stroke({ width: 1, color: this._theme.edgeColor, alpha: 0.48 })
    }

    for (let rowIndex = 0; rowIndex < layout.rows.length; rowIndex += 1) {
      const y = rowTop + rowIndex * layout.rowHeight
      if (rowIndex % 2 === 1) {
        g.rect(left, y, layout.width, layout.rowHeight)
        g.fill({ color: this._theme.background, alpha: 0.12 })
      }

      if (rowIndex > 0) {
        g.moveTo(left, y).lineTo(right, y)
        g.stroke({ width: 1, color: this._theme.edgeColor, alpha: 0.34 })
      }

      this._drawErKeyBadge(layout, layout.rows[rowIndex], y)
    }

    g.roundRect(left, top, layout.width, layout.height, r)
    g.stroke({ width: nodeStyle.strokeWidth, color: nodeStyle.stroke })
  }

  private _drawErKeyBadge(
    layout: ErEntityTableLayout,
    row: ErTableAttributeRow,
    rowY: number,
  ): void {
    if (!row.keyLabel) return

    const left = -layout.width / 2
    const badgeWidth = Math.max(22, layout.keyColumnWidth - 6)
    const badgeHeight = 14
    const badgeX = left + layout.paddingX
    const badgeY = rowY + (layout.rowHeight - badgeHeight) / 2
    const badgeFill = row.isPrimaryKey
      ? this._theme.accent
      : row.isForeignKey
        ? this._theme.edgeColor
        : this._theme.nodeStroke

    this._gfx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 3)
    this._gfx.fill({ color: badgeFill, alpha: 0.9 })
  }

  private _buildErEntityTableLabel(
    layout: ErEntityTableLayout,
    fontName: string,
    nodeStyle: ResolvedNodeStyle,
  ): { width: number; height: number } {
    this._label = new Container()
    this._labelTexts = []
    this._labelTextBaseFontSizes = []

    const left = -layout.width / 2
    const top = -layout.height / 2
    const header = new BitmapText({
      text: layout.entityName,
      style: {
        fontFamily: this._boldFontName(fontName),
        fontSize: 15,
        fill: nodeStyle.text,
      },
    })
    header.anchor.set(0.5)
    header.x = 0
    header.y = top + layout.headerHeight / 2
    this._trackLabelText(header, 15)
    this._label.addChild(header)

    for (let rowIndex = 0; rowIndex < layout.rows.length; rowIndex += 1) {
      const row = layout.rows[rowIndex]
      const centerY = top + layout.headerHeight + rowIndex * layout.rowHeight + layout.rowHeight / 2

      if (row.keyLabel) {
        const key = new BitmapText({
          text: row.keyLabel,
          style: {
            fontFamily: this._boldFontName(fontName),
            fontSize: 10,
            fill: this._theme.background,
          },
        })
        key.anchor.set(0.5)
        key.x = left + layout.paddingX + Math.max(22, layout.keyColumnWidth - 6) / 2
        key.y = centerY
        this._trackLabelText(key, 10)
        this._label.addChild(key)
      }

      const name = new BitmapText({
        text: row.name,
        style: {
          fontFamily: row.isPrimaryKey ? this._boldFontName(fontName) : fontName,
          fontSize: 13,
          fill: nodeStyle.text,
        },
      })
      name.anchor.set(0, 0.5)
      name.x = left + layout.nameColumnLeft
      name.y = centerY
      this._trackLabelText(name, 13)
      this._label.addChild(name)

      const type = new BitmapText({
        text: row.type,
        style: {
          fontFamily: fontName,
          fontSize: 12,
          fill: this._theme.edgeLabelColor,
        },
      })
      type.anchor.set(0, 0.5)
      type.x = left + layout.typeColumnLeft
      type.y = centerY
      this._trackLabelText(type, 12)
      this._label.addChild(type)
    }

    return {
      width: layout.width,
      height: layout.height,
    }
  }

  private _drawClassCompartment(layout: ClassCompartmentLayout, nodeStyle: ResolvedNodeStyle): void {
    const g = this._gfx
    const left = -layout.width / 2
    const top = -layout.height / 2
    const right = layout.width / 2
    const r = this._theme.cornerRadius

    g.roundRect(left, top, layout.width, layout.height, r)
    g.fill({ color: nodeStyle.fill })
    g.roundRect(left, top, layout.width, layout.headerHeight, r)
    g.fill({ color: nodeStyle.stroke, alpha: 0.18 })
    g.moveTo(left, top + layout.headerHeight).lineTo(right, top + layout.headerHeight)
    g.stroke({ width: nodeStyle.strokeWidth, color: nodeStyle.stroke, alpha: 0.9 })

    for (const section of layout.sections) {
      const sectionTop = top + section.top
      g.rect(left, sectionTop, layout.width, layout.sectionHeaderHeight)
      g.fill({ color: this._theme.background, alpha: 0.16 })
      g.moveTo(left, sectionTop).lineTo(right, sectionTop)
      g.stroke({ width: 1, color: this._theme.edgeColor, alpha: 0.38 })
      g.moveTo(left, sectionTop + layout.sectionHeaderHeight).lineTo(right, sectionTop + layout.sectionHeaderHeight)
      g.stroke({ width: 1, color: this._theme.edgeColor, alpha: 0.34 })

      for (let rowIndex = 0; rowIndex < section.rows.length; rowIndex += 1) {
        const rowTop = sectionTop + layout.sectionHeaderHeight + rowIndex * layout.rowHeight
        if (rowIndex % 2 === 1) {
          g.rect(left, rowTop, layout.width, layout.rowHeight)
          g.fill({ color: this._theme.background, alpha: 0.1 })
        }
      }
    }

    g.roundRect(left, top, layout.width, layout.height, r)
    g.stroke({ width: nodeStyle.strokeWidth, color: nodeStyle.stroke })
  }

  private _buildClassCompartmentLabel(
    layout: ClassCompartmentLayout,
    fontName: string,
    nodeStyle: ResolvedNodeStyle,
  ): { width: number; height: number } {
    this._label = new Container()
    this._labelTexts = []
    this._labelTextBaseFontSizes = []

    const left = -layout.width / 2
    const top = -layout.height / 2
    const titleY = top + (layout.stereotypeLabel ? 15 : layout.headerHeight / 2)
    const header = new BitmapText({
      text: layout.className,
      style: {
        fontFamily: this._boldFontName(fontName),
        fontSize: 15,
        fill: nodeStyle.text,
      },
    })
    header.anchor.set(0.5)
    header.x = 0
    header.y = titleY
    this._trackLabelText(header, 15)
    this._label.addChild(header)

    if (layout.stereotypeLabel) {
      const stereotype = new BitmapText({
        text: layout.stereotypeLabel,
        style: {
          fontFamily: fontName,
          fontSize: 10,
          fill: this._theme.edgeLabelColor,
        },
      })
      stereotype.anchor.set(0.5)
      stereotype.x = 0
      stereotype.y = top + 29
      this._trackLabelText(stereotype, 10)
      this._label.addChild(stereotype)
    }

    for (const section of layout.sections) {
      const sectionTop = top + section.top
      const sectionTitle = new BitmapText({
        text: section.title.toUpperCase(),
        style: {
          fontFamily: this._boldFontName(fontName),
          fontSize: 10,
          fill: this._theme.edgeLabelColor,
        },
      })
      sectionTitle.anchor.set(0, 0.5)
      sectionTitle.x = left + layout.paddingX
      sectionTitle.y = sectionTop + layout.sectionHeaderHeight / 2
      this._trackLabelText(sectionTitle, 10)
      this._label.addChild(sectionTitle)

      for (let rowIndex = 0; rowIndex < section.rows.length; rowIndex += 1) {
        const row = section.rows[rowIndex]
        const rowText = new BitmapText({
          text: row.text,
          style: {
            fontFamily: fontName,
            fontSize: 12,
            fill: nodeStyle.text,
          },
        })
        rowText.anchor.set(0, 0.5)
        rowText.x = left + layout.paddingX
        rowText.y = sectionTop + layout.sectionHeaderHeight + rowIndex * layout.rowHeight + layout.rowHeight / 2
        this._trackLabelText(rowText, 12)
        this._label.addChild(rowText)
      }
    }

    return {
      width: layout.width,
      height: layout.height,
    }
  }

  private _drawLinkBadge(
    bx: number,
    by: number,
    accent: number,
    fill: number,
    scale: number,
    kind: 'valid' | 'broken',
  ): void {
    const g = this._linkBadge!
    const r = 8 * scale
    g.circle(bx, by, r)
    g.fill({ color: accent, alpha: 0.9 })
    if (kind === 'broken') {
      const slash = 3.6 * scale
      g.moveTo(bx - slash, by - slash).lineTo(bx + slash, by + slash)
      g.stroke({ width: 1.9 * scale, color: fill, cap: 'round' })
      g.circle(bx - 1.4 * scale, by + 1.4 * scale, 0.9 * scale)
      g.fill({ color: fill, alpha: 1 })
      return
    }

    const s = 3 * scale
    g.moveTo(bx - s, by + s * 0.6).lineTo(bx, by - s * 0.8).lineTo(bx + s, by + s * 0.6)
    g.stroke({ width: 1.5 * scale, color: fill })
  }

  setSelected(selected: boolean): void {
    if (this._selected === selected) return
    this._selected = selected
    if (
      computeErEntityTableLayout(this.data, this._fontName === 'MermaidBlueprint') ||
      computeClassCompartmentLayout(this.data, this._fontName === 'MermaidBlueprint')
    ) {
      this._rebuildVisuals(this.data, this._theme, this._linkState, this._fontName)
      return
    }
    this._gfx.clear()
    this._drawShape(
      this.data.shape, this._displayWidth, this._displayHeight,
      this._resolveNodeStyle(
        this.data,
        this._theme,
        selected ? this._theme.nodeStrokeSelected : undefined,
      ),
    )
    this._selectionGfx.alpha = selected ? 1 : 0
    this._hoverGfx.alpha = this._hovered ? 1 : 0
  }

  /**
   * Update visibility of detail elements based on semantic zoom level.
   * @param zoom Current viewport zoom level.
   */
  /**
   * Coggle-style: text always stays readable regardless of zoom.
   * Counter-scales font size so it maintains a constant screen size,
   * clamped between min (8px) and max (20px screen pixels).
   * @param absoluteZoom The actual viewport zoom level (not relative)
   */
  updateDetailLevel(absoluteZoom: number): void {
    // Always visible
    this._label.visible = true
    this._gfx.alpha = 1

    if (absoluteZoom < 0.7) {
      this._setLabelFontSize(14)
      this._label.alpha = absoluteZoom < 0.28 ? 0.55 : 0.9
      return
    }

    this._label.alpha = 1

    // Counter-scale: as viewport zooms in, make label smaller in world space
    // so it stays ~14px on screen. Clamp to min/max.
    const baseFontSize = 14
    const minScreenPx = 8
    const maxScreenPx = 22
    const desiredWorldSize = baseFontSize / Math.max(absoluteZoom, 0.05)
    const screenSize = desiredWorldSize * absoluteZoom
    const clampedScreenSize = Math.max(minScreenPx, Math.min(maxScreenPx, screenSize))
    const finalWorldSize = clampedScreenSize / Math.max(absoluteZoom, 0.05)

    this._setLabelFontSize(finalWorldSize)
  }

  private _setLabelFontSize(fontSize: number): void {
    const scale = fontSize / 14
    for (const [index, labelText] of this._labelTexts.entries()) {
      labelText.style.fontSize = (this._labelTextBaseFontSizes[index] ?? 14) * scale
    }
  }

  getShapeBounds(): BoundsRect {
    const bounds = this._gfx.getBounds()
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
  }

  getLabelBounds(): BoundsRect {
    const bounds = this._label.getBounds()
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
  }

  getHoverBounds(): BoundsRect {
    const bounds = this._hoverGfx.getBounds()
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
  }

  getSemanticSubitemAnchors(): ScreenSemanticSubitem[] {
    const layout = computeNodeSemanticSubitems(
      this.data,
      this._fontName === 'MermaidBlueprint',
    )
    if (!layout) return []

    const bounds = this.getShapeBounds()
    const scaleX = bounds.width / layout.width
    const scaleY = bounds.height / layout.height
    return layout.items.map((item) => ({
      ...item,
      x: bounds.x + item.x * scaleX,
      y: bounds.y + item.y * scaleY,
      width: item.width * scaleX,
      height: item.height * scaleY,
    }))
  }

  getSemanticSubitemAt(
    screenX: number,
    screenY: number,
  ): ScreenSemanticSubitem | null {
    return (
      this.getSemanticSubitemAnchors().find(
        (item) =>
          screenX >= item.x &&
          screenX <= item.x + item.width &&
          screenY >= item.y &&
          screenY <= item.y + item.height,
      ) ?? null
    )
  }

  isHovered(): boolean {
    return this._hovered
  }

  getDebugStyle(): {
    nodeFill: number
    nodeStroke: number
    labelFill: number
    labelFontFamily: string
    labelText: string
    labelSegmentFontFamilies: string[]
    brokenBadgeAccent: number | null
    badgeKind: 'valid' | 'broken' | null
    hoverAlpha: number
    selectionAlpha: number
    shapeLayerIndex: number
    labelLayerIndex: number
    badgeLayerIndex: number | null
    hoverLayerIndex: number
    selectionLayerIndex: number
  } {
    const nodeStyle = this._resolveNodeStyle(
      this.data,
      this._theme,
      this._selected ? this._theme.nodeStrokeSelected : undefined,
    )
    return {
      nodeFill: nodeStyle.fill,
      nodeStroke: nodeStyle.stroke,
      labelFill: nodeStyle.text,
      labelFontFamily: this._fontName,
      labelText: this._labelTexts.map((text) => text.text).join(''),
      labelSegmentFontFamilies: this._labelTexts.map((text) => text.style.fontFamily as string),
      brokenBadgeAccent: this._badgeAccent,
      badgeKind: this._badgeKind,
      hoverAlpha: this._hoverGfx.alpha,
      selectionAlpha: this._selectionGfx.alpha,
      shapeLayerIndex: this.getChildIndex(this._gfx),
      labelLayerIndex: this.getChildIndex(this._label),
      badgeLayerIndex: this._linkBadge ? this.getChildIndex(this._linkBadge) : null,
      hoverLayerIndex: this.getChildIndex(this._hoverGfx),
      selectionLayerIndex: this.getChildIndex(this._selectionGfx),
    }
  }

  private _resolveNodeStyle(
    node: PositionedNode,
    theme: Theme,
    strokeOverride?: number,
  ): ResolvedNodeStyle {
    const style = node.style
    return {
      fill: style?.fill ?? theme.nodeFill,
      stroke: strokeOverride ?? style?.stroke ?? theme.nodeStroke,
      text: style?.text ?? theme.nodeText,
      strokeWidth: style?.strokeWidth ?? theme.strokeWidth,
      ...(style?.strokeDasharray ? { strokeDasharray: style.strokeDasharray } : {}),
    }
  }

  private _drawHoverGlow(shape: NodeShape, w: number, h: number): void {
    const hw = w / 2
    const hh = h / 2
    const g = this._hoverGfx

    if (shape === 'circle') {
      g.circle(0, 0, Math.max(hw, hh))
    } else if (shape === 'diamond') {
      g.moveTo(0, -hh).lineTo(hw, 0).lineTo(0, hh).lineTo(-hw, 0).closePath()
    } else {
      g.roundRect(-hw, -hh, w, h, this._theme.cornerRadius + 4)
    }
    g.fill({ color: this._theme.hoverGlow, alpha: this._theme.hoverGlowAlpha })
  }

  private _drawSelectionRing(shape: NodeShape, w: number, h: number): void {
    const hw = w / 2
    const hh = h / 2
    const g = this._selectionGfx

    if (shape === 'circle') {
      g.circle(0, 0, Math.max(hw, hh))
    } else if (shape === 'diamond') {
      g.moveTo(0, -hh).lineTo(hw, 0).lineTo(0, hh).lineTo(-hw, 0).closePath()
    } else if (shape === 'hexagon') {
      const inset = hw * 0.25
      g.moveTo(-hw + inset, -hh).lineTo(hw - inset, -hh).lineTo(hw, 0)
        .lineTo(hw - inset, hh).lineTo(-hw + inset, hh).lineTo(-hw, 0).closePath()
    } else {
      g.roundRect(-hw, -hh, w, h, this._theme.cornerRadius + 5)
    }

    g.fill({
      color: this._theme.nodeStrokeSelected,
      alpha: this._theme.hoverGlowAlpha * 0.22,
    })
    g.stroke({
      width: Math.max(2, this._theme.strokeWidth + 1.5),
      color: this._theme.nodeStrokeSelected,
      alpha: 1,
    })
  }

  private _drawShape(shape: NodeShape, w: number, h: number, nodeStyle: ResolvedNodeStyle): void {
    const hw = w / 2
    const hh = h / 2
    const g = this._gfx
    const r = this._theme.cornerRadius

    this._drawShapePath(g, shape, w, h, hw, hh, r)
    g.fill({ color: nodeStyle.fill })

    if (nodeStyle.strokeDasharray && this._canDrawDashedRect(shape)) {
      this._drawDashedRect(
        g,
        -hw,
        -hh,
        w,
        h,
        nodeStyle.strokeDasharray,
        nodeStyle.stroke,
        nodeStyle.strokeWidth,
      )
    } else {
      this._drawShapePath(g, shape, w, h, hw, hh, r)
      g.stroke({ width: nodeStyle.strokeWidth, color: nodeStyle.stroke })
    }

    if (shape === 'subroutine') {
      const inset = 6
      g.moveTo(-hw + inset, -hh).lineTo(-hw + inset, hh)
        .moveTo(hw - inset, -hh).lineTo(hw - inset, hh)
        .stroke({ width: 1, color: nodeStyle.stroke })
    }
  }

  private _drawShapePath(
    g: Graphics,
    shape: NodeShape,
    w: number,
    h: number,
    hw: number,
    hh: number,
    r: number,
  ): void {
    switch (shape) {
      case 'diamond':
        g.moveTo(0, -hh).lineTo(hw, 0).lineTo(0, hh).lineTo(-hw, 0).closePath()
        break
      case 'circle':
        g.circle(0, 0, Math.max(hw, hh))
        break
      case 'stadium':
        g.roundRect(-hw, -hh, w, h, hh)
        break
      case 'hexagon': {
        const inset = hw * 0.25
        g.moveTo(-hw + inset, -hh).lineTo(hw - inset, -hh).lineTo(hw, 0)
          .lineTo(hw - inset, hh).lineTo(-hw + inset, hh).lineTo(-hw, 0).closePath()
        break
      }
      case 'rounded':
        g.roundRect(-hw, -hh, w, h, r)
        break
      case 'subroutine':
        g.rect(-hw, -hh, w, h)
        break
      case 'cylinder':
        g.roundRect(-hw, -hh, w, h, r)
        break
      case 'rectangle':
      default:
        g.rect(-hw, -hh, w, h)
        break
    }
  }

  private _canDrawDashedRect(shape: NodeShape): boolean {
    return shape !== 'circle' && shape !== 'diamond' && shape !== 'hexagon'
  }

  private _drawDashedRect(
    g: Graphics,
    left: number,
    top: number,
    width: number,
    height: number,
    dasharray: number[],
    color: number,
    strokeWidth: number,
  ): void {
    const pattern = dasharray.filter((value) => Number.isFinite(value) && value > 0)
    if (pattern.length === 0) {
      g.rect(left, top, width, height)
      g.stroke({ width: strokeWidth, color })
      return
    }

    let patternIndex = 0
    let remaining = pattern[patternIndex]
    let drawing = true

    const drawSide = (x1: number, y1: number, x2: number, y2: number) => {
      const dx = x2 - x1
      const dy = y2 - y1
      const length = Math.sqrt(dx * dx + dy * dy)
      if (length === 0) return

      let covered = 0
      while (covered < length) {
        const step = Math.min(remaining, length - covered)
        const start = covered / length
        const end = (covered + step) / length
        if (drawing) {
          g.moveTo(x1 + dx * start, y1 + dy * start)
          g.lineTo(x1 + dx * end, y1 + dy * end)
        }
        covered += step
        remaining -= step
        if (remaining <= 0) {
          patternIndex = (patternIndex + 1) % pattern.length
          remaining = pattern[patternIndex]
          drawing = !drawing
        }
      }
    }

    drawSide(left, top, left + width, top)
    drawSide(left + width, top, left + width, top + height)
    drawSide(left + width, top + height, left, top + height)
    drawSide(left, top + height, left, top)
    g.stroke({ width: strokeWidth, color })
  }
}
