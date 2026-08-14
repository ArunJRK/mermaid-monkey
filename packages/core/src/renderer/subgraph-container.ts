import { Container, Graphics, BitmapText } from 'pixi.js'
import type { PositionedSubgraph } from '../types'
import { ensureFontsInstalled } from './fonts'
import { getSubgraphDepthFill, type Theme } from './theme'
import { measureTextWidth } from '../layout/text-measure'
import {
  type CalloutBadgeSlot,
  calloutBadgeSlotAtGlobalPoint,
  type CalloutBadgeState,
  computeSubgraphCalloutBadgePosition,
  rebuildCalloutBadgeSlots,
  wireCalloutBadgeHoverRouting,
} from './callout-badge'
import type { CalloutBadgeKind } from '../types'

const LABEL_PADDING = 10
const HEADER_HEIGHT = 28
const LABEL_LEFT_OFFSET = LABEL_PADDING + 16
const BADGE_HEIGHT = 18
const BADGE_TOP_OFFSET = 6
const BADGE_TEXT_CENTER_OFFSET = BADGE_TOP_OFFSET + BADGE_HEIGHT / 2
const BADGE_GAP = 8

export class SubgraphContainer extends Container {
  data: PositionedSubgraph
  private _bg: Graphics
  private _label: BitmapText
  private _chevron: BitmapText
  private _badge: BitmapText | null = null
  private _calloutSlots: CalloutBadgeSlot[] = []
  private _calloutStates: CalloutBadgeState[] = []
  private _theme: Theme
  private _depth: number
  private _collapsed: boolean
  private _stressMode = false
  private _fontName: string

  constructor(subgraph: PositionedSubgraph, theme: Theme, depth: number = 0, fontName = 'MermaidLabel') {
    super()
    this.data = subgraph
    this._theme = theme
    this._depth = depth
    this._collapsed = subgraph.collapsed
    this._fontName = fontName

    this.x = subgraph.x
    this.y = subgraph.y

    const hw = subgraph.width / 2
    const hh = subgraph.height / 2

    // Background — deeper subgraphs are brighter
    this._bg = new Graphics()
    this._drawBg(hw, hh, false)
    this.addChild(this._bg)

    // Label
    ensureFontsInstalled()
    const labelFontSize = fontName === 'MermaidBlueprint' ? 13 : 12
    this._label = new BitmapText({
      text: this._fitLabelText(subgraph.label, hw, labelFontSize),
      style: { fontFamily: fontName, fontSize: labelFontSize, fill: theme.subgraphLabel },
    })
    this._label.x = -hw + LABEL_LEFT_OFFSET // leave room for chevron
    this._label.y = -hh + 8
    this.addChild(this._label)

    // Chevron indicator (fold state)
    this._chevron = new BitmapText({
      text: subgraph.collapsed ? '\u25B6' : '\u25BC', // right-pointing or down-pointing triangle
      style: { fontFamily: fontName, fontSize: labelFontSize, fill: theme.subgraphLabel },
    })
    this._chevron.x = -hw + LABEL_PADDING
    this._chevron.y = -hh + 8
    this.addChild(this._chevron)

    // Count badge — pill at top-right showing node count
    const nodeCount = subgraph.nodeIds.length
    if (nodeCount > 0) {
      const badgeWidth = this._badgeWidth(nodeCount)
      this._badge = new BitmapText({
        text: String(nodeCount),
        style: { fontFamily: fontName, fontSize: fontName === 'MermaidBlueprint' ? 11 : 10, fill: theme.subgraphLabel },
      })
      this._badge.anchor.set(0.5)
      this._badge.x = hw - LABEL_PADDING - badgeWidth / 2
      this._badge.y = -hh + BADGE_TEXT_CENTER_OFFSET
      this.addChild(this._badge)
    }

    // Interactive
    this.eventMode = 'static'
    this.cursor = 'pointer'
    this.hitArea = {
      contains: (x: number, y: number) => {
        // Only respond in the label/border area, not the full interior
        // This prevents stealing clicks from child nodes
        const inOuter = x >= -hw && x <= hw && y >= -hh && y <= hh
        const inInner = x >= -hw + 15 && x <= hw - 15 && y >= -hh + 30 && y <= hh - 15
        return inOuter && !inInner // border + label strip only
      },
    }

    // Hover — brighten border
    this.on('pointerover', () => {
      this._bg.clear()
      this._drawBg(hw, hh, true)
    })
    this.on('pointerout', () => {
      this._bg.clear()
      this._drawBg(hw, hh, false)
    })

    // Badge hover is routed by the HOST (the badge is not a pointer target):
    // pointer movement over the container consults the badge hit test, scales
    // the badge, and emits callout:hover / callout:hoverend transitions.
    wireCalloutBadgeHoverRouting(this, {
      getSlots: () => this._calloutSlots,
      hitTest: (globalX, globalY) => this.getCalloutBadgeAt(globalX, globalY)?.kind ?? null,
      onHover: (kind, originalEvent) => this._emitCalloutEvent('callout:hover', kind, originalEvent),
      onHoverEnd: (kind, originalEvent) => this._emitCalloutEvent('callout:hoverend', kind, originalEvent),
    })
  }

  updateLayout(subgraph: PositionedSubgraph, depth: number = this._depth, theme: Theme = this._theme, fontName: string = this._fontName): void {
    this.data = subgraph
    this._theme = theme
    this._depth = depth
    this._collapsed = subgraph.collapsed
    this._fontName = fontName
    this.x = subgraph.x
    this.y = subgraph.y

    const hw = subgraph.width / 2
    const hh = subgraph.height / 2

    this._bg.clear()
    this._drawBg(hw, hh, false)

    this._label.style.fontFamily = fontName
    this._label.style.fontSize = fontName === 'MermaidBlueprint' ? 13 : 12
    this._label.style.fill = theme.subgraphLabel
    this._label.text = this._fitLabelText(subgraph.label, hw, this._label.style.fontSize as number)
    this._label.x = -hw + LABEL_LEFT_OFFSET
    this._label.y = -hh + 8

    this._chevron.text = subgraph.collapsed ? '\u25B6' : '\u25BC'
    this._chevron.style.fontFamily = fontName
    this._chevron.style.fontSize = fontName === 'MermaidBlueprint' ? 13 : 12
    this._chevron.style.fill = theme.subgraphLabel
    this._chevron.x = -hw + LABEL_PADDING
    this._chevron.y = -hh + 8

    const nodeCount = subgraph.nodeIds.length
    if (nodeCount > 0) {
      const badgeWidth = this._badgeWidth(nodeCount)
      if (!this._badge) {
        this._badge = new BitmapText({
          text: String(nodeCount),
          style: { fontFamily: fontName, fontSize: fontName === 'MermaidBlueprint' ? 11 : 10, fill: theme.subgraphLabel },
        })
        this._badge.anchor.set(0.5)
        this.addChild(this._badge)
      }
      this._badge.text = String(nodeCount)
      this._badge.style.fontFamily = fontName
      this._badge.style.fontSize = fontName === 'MermaidBlueprint' ? 11 : 10
      this._badge.style.fill = theme.subgraphLabel
      this._badge.x = hw - LABEL_PADDING - badgeWidth / 2
      this._badge.y = -hh + BADGE_TEXT_CENTER_OFFSET
    } else if (this._badge) {
      this._badge.removeFromParent()
      this._badge.destroy()
      this._badge = null
    }

    this.hitArea = {
      contains: (x: number, y: number) => {
        const inOuter = x >= -hw && x <= hw && y >= -hh && y <= hh
        const inInner = x >= -hw + 15 && x <= hw - 15 && y >= -hh + 30 && y <= hh - 15
        return inOuter && !inInner
      },
    }

    // Reposition the annotation markers for the new dimensions/theme.
    this._syncCalloutBadges()
  }

  /**
   * Attach this subgraph's annotation markers (empty array detaches them
   * all). At most one marker per kind; slots step left of the node-count
   * pill so a callout badge and a comment pin never overlap.
   *
   * Each marker is a child of the container, positioned in the header band
   * at the top-right in LOCAL coordinates, so it tracks pan/zoom/relayout
   * via the display tree.
   */
  setCalloutBadges(states: CalloutBadgeState[]): void {
    this._calloutStates = states.map((state) => ({ ...state }))
    this._syncCalloutBadges()
  }

  hasCalloutBadge(kind?: CalloutBadgeKind): boolean {
    if (kind === undefined) return this._calloutSlots.length > 0
    return this._calloutSlots.some((slot) => slot.state.kind === kind)
  }

  /**
   * Global-coordinate marker hit test, consulted by the renderer's own
   * `pointertap` handler (and this container's hover routing) BEFORE any
   * fold/focus behaviour — same idiom as `NodeSprite.getSemanticSubitemAt`.
   */
  getCalloutBadgeAt(globalX: number, globalY: number): CalloutBadgeState | null {
    return calloutBadgeSlotAtGlobalPoint(this, this._calloutSlots, globalX, globalY)
      ?.state ?? null
  }

  /** Emit a marker's `callout:click` (host-routed tap; see callout-badge doc). */
  dispatchCalloutTap(kind: CalloutBadgeKind, originalEvent?: Event): void {
    this._emitCalloutEvent('callout:click', kind, originalEvent)
  }

  getCalloutBadgeDebug(
    kind: CalloutBadgeKind = 'callout',
  ): { x: number; y: number; count?: number } | null {
    const slot = this._calloutSlots.find((candidate) => candidate.state.kind === kind)
    if (!slot) return null
    return {
      x: slot.badge.x,
      y: slot.badge.y,
      ...(slot.state.count !== undefined ? { count: slot.state.count } : {}),
    }
  }

  /** Current marker scale (hover feedback), for tests/debug. */
  getCalloutBadgeHoverScale(kind: CalloutBadgeKind = 'callout'): number | null {
    const slot = this._calloutSlots.find((candidate) => candidate.state.kind === kind)
    return slot ? slot.badge.scale.x : null
  }

  private _syncCalloutBadges(): void {
    const nodeCount = this.data.nodeIds.length
    this._calloutSlots = rebuildCalloutBadgeSlots(this._calloutSlots, this._calloutStates, {
      accents: this._theme,
      surface: this._theme.background,
      fontName: this._fontName === 'MermaidBlueprint' ? 'MermaidBlueprint' : 'MermaidLabel',
      positionFor: (slotIndex) => computeSubgraphCalloutBadgePosition(
        this.data.width,
        this.data.height,
        nodeCount > 0 ? this._badgeWidth(nodeCount) : 0,
        slotIndex,
      ),
      addChild: (badge) => this.addChild(badge),
    })
  }

  private _emitCalloutEvent(
    event: string,
    kind: CalloutBadgeKind,
    originalEvent?: Event,
  ): void {
    const slot = this._calloutSlots.find((candidate) => candidate.state.kind === kind)
    if (!slot) return
    const global = slot.badge.getGlobalPosition()
    this.emit(event as 'callout:click', {
      kind,
      x: global.x,
      y: global.y,
      originalEvent,
    })
  }

  /**
   * Update the fold indicator to reflect collapsed/expanded state.
   */
  setCollapsed(collapsed: boolean): void {
    this._collapsed = collapsed
    this._chevron.text = collapsed ? '\u25B6' : '\u25BC'
  }

  /**
   * Update visibility of detail elements based on semantic zoom level.
   * @param zoom Current viewport zoom level.
   */
  /**
   * zoom is RELATIVE to fitToView (1.0 = default, everything shows).
   * Subgraph labels always show at default zoom.
   */
  updateDetailLevel(zoom: number): void {
    // Labels and indicators always visible at default zoom and above
    this._label.visible = true
    this._label.alpha = zoom < 0.4 ? 0.5 : 1
    this._chevron.visible = !this._stressMode && zoom >= 0.5
    if (this._badge) this._badge.visible = !this._stressMode && zoom >= 0.5
  }

  setStressMode(stressMode: boolean): void {
    this._stressMode = stressMode
    if (stressMode) {
      this._chevron.visible = false
      if (this._badge) this._badge.visible = false
    }
  }

  getDebugStyle(): {
    depth: number
    fillColor: number
    labelFill: number
    labelFontFamily: string
    labelText: string
    labelBounds: { x: number; y: number; width: number; height: number }
    accent: number
    chevronVisible: boolean
    badgeVisible: boolean
    badgeText: string | null
    badgeBounds: { x: number; y: number; width: number; height: number } | null
    badgeTextBounds: { x: number; y: number; width: number; height: number } | null
  } {
    const hw = this.data.width / 2
    const hh = this.data.height / 2
    const badgeWidth = this._badgeWidth(this.data.nodeIds.length)
    const labelBounds = this._label.getBounds()
    const badgeTextBounds = this._badge?.getBounds() ?? null
    const badgeLocalLeft = hw - LABEL_PADDING - badgeWidth
    const badgeLocalTop = -hh + BADGE_TOP_OFFSET
    const badgeTopLeft = this.toGlobal({ x: badgeLocalLeft, y: badgeLocalTop })
    const badgeBottomRight = this.toGlobal({
      x: badgeLocalLeft + badgeWidth,
      y: badgeLocalTop + BADGE_HEIGHT,
    })

    return {
      depth: this._depth,
      fillColor: getSubgraphDepthFill(this._theme, this._depth),
      labelFill: this._theme.subgraphLabel,
      labelFontFamily: this._fontName,
      labelText: this._label.text,
      labelBounds: { x: labelBounds.x, y: labelBounds.y, width: labelBounds.width, height: labelBounds.height },
      accent: this._theme.accent,
      chevronVisible: this._chevron.visible,
      badgeVisible: this._badge?.visible ?? false,
      badgeText: this._badge?.text ?? null,
      badgeBounds: this._badge
        ? {
            x: badgeTopLeft.x,
            y: badgeTopLeft.y,
            width: badgeBottomRight.x - badgeTopLeft.x,
            height: badgeBottomRight.y - badgeTopLeft.y,
          }
        : null,
      badgeTextBounds: badgeTextBounds
        ? { x: badgeTextBounds.x, y: badgeTextBounds.y, width: badgeTextBounds.width, height: badgeTextBounds.height }
        : null,
    }
  }

  private _drawBg(hw: number, hh: number, hovered: boolean): void {
    const t = this._theme
    const w = hw * 2
    const h = hh * 2
    const d = this._depth

    // Determine fill color — Map philosophy uses depth tints
    const fillColor = getSubgraphDepthFill(t, d)

    // Deeper nesting = slightly higher fill opacity + thicker border
    const fillAlpha = t.subgraphFillAlpha + d * 0.08
    const strokeAlpha = hovered ? 0.95 : t.subgraphStrokeAlpha + d * 0.1
    const strokeWidth = hovered ? 2.5 + d * 0.5 : 1.5 + d * 0.5
    const cornerRadius = Math.max(4, t.cornerRadius - d * 2) // tighter corners for deeper nesting

    // Collapsed subgraphs get dashed-style border (simulated with lower alpha) and different fill
    const effectiveFillAlpha = this._collapsed ? fillAlpha * 0.7 : fillAlpha
    const effectiveStrokeAlpha = this._collapsed ? strokeAlpha * 0.8 : strokeAlpha

    this._bg
      .roundRect(-hw, -hh, w, h, cornerRadius)
      .fill({ color: fillColor, alpha: effectiveFillAlpha })
      .stroke({ width: strokeWidth, color: t.subgraphStroke, alpha: effectiveStrokeAlpha })

    this._bg
      .rect(-hw + 1, -hh + 1, Math.max(0, w - 2), Math.min(HEADER_HEIGHT, h))
      .fill({ color: t.subgraphStroke, alpha: hovered ? 0.24 : 0.15 + d * 0.03 })

    if (this.data.nodeIds.length > 0) {
      const badgeWidth = this._badgeWidth(this.data.nodeIds.length)
      this._bg
        .roundRect(hw - LABEL_PADDING - badgeWidth, -hh + BADGE_TOP_OFFSET, badgeWidth, BADGE_HEIGHT, 9)
        .fill({ color: t.accent, alpha: hovered ? 0.22 : 0.16 })
        .stroke({ width: 1, color: t.accent, alpha: hovered ? 0.8 : 0.48 })
    }

    // Depth indicator — subtle left accent bar for nested subgraphs
    if (d > 0) {
      const barWidth = 3
      this._bg
        .roundRect(-hw, -hh, barWidth, h, cornerRadius)
        .fill({ color: t.accent, alpha: 0.4 + d * 0.1 })
    }
  }

  private _badgeWidth(nodeCount: number): number {
    const badgeText = String(nodeCount)
    return Math.max(24, badgeText.length * 7 + 14)
  }

  private _fitLabelText(label: string, hw: number, fontSize: number): string {
    const nodeCount = this.data.nodeIds.length
    const labelX = -hw + LABEL_LEFT_OFFSET
    const rightLimit = nodeCount > 0
      ? hw - LABEL_PADDING - this._badgeWidth(nodeCount) - BADGE_GAP
      : hw - LABEL_PADDING
    const maxWidth = rightLimit - labelX

    if (maxWidth <= 0) return ''
    if (measureTextWidth(label, fontSize, this._fontName === 'MermaidBlueprint') <= maxWidth) {
      return label
    }

    const ellipsis = '...'
    const ellipsisWidth = measureTextWidth(ellipsis, fontSize, this._fontName === 'MermaidBlueprint')
    const textBudget = maxWidth - ellipsisWidth
    if (textBudget <= 0) return ellipsis

    let fitted = ''
    for (const char of label) {
      const candidate = fitted + char
      if (measureTextWidth(candidate, fontSize, this._fontName === 'MermaidBlueprint') > textBudget) break
      fitted = candidate
    }

    return `${fitted.trimEnd()}${ellipsis}`
  }
}
