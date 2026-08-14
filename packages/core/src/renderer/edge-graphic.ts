import { Graphics, BitmapText } from 'pixi.js'
import type { PositionedEdge, PositionedNode, EdgeStyle } from '../types'
import { ensureFontsInstalled } from './fonts'
import { lineIntersectsRect, computeWaypoint } from '../layout/blueprint-layout'
import type { Theme } from './theme'
import type { WireSegment } from './wire-crossings'
import type { WireSegment as RouterWireSegment } from '../router/types'
import type { WireRegistry } from './wire-registry'
import { estimateRenderedNodeFootprint } from '../node-footprint'
import { computeSelfLoopGeometry } from './self-loop-geometry'
import {
  CALLOUT_BADGE_HIT_RADIUS,
  type CalloutBadgeSlot,
  calloutBadgeSlotAtGlobalPoint,
  type CalloutBadgeState,
  computeEdgeCalloutBadgePosition,
  rebuildCalloutBadgeSlots,
  wireCalloutBadgeHoverRouting,
} from './callout-badge'
import type { CalloutBadgeKind } from '../types'

const DIMMED_ALPHA = 0.12
const ARROW_SIZE = 8
const EDGE_HIT_PADDING = 14

type Rect = { x: number; y: number; width: number; height: number }
type Point = { x: number; y: number }

type ResolvedEdgeStyle = {
  color: number
  labelColor: number
  width: number
  alpha: number
  dashPattern?: number[]
}

type ErCardinality = 'ONLY_ONE' | 'ZERO_OR_ONE' | 'ONE_OR_MORE' | 'ZERO_OR_MORE'

class PolylineHitArea {
  constructor(
    private readonly points: Array<{ x: number; y: number }>,
    private readonly padding: number,
  ) {}

  contains(x: number, y: number): boolean {
    for (let index = 0; index < this.points.length - 1; index++) {
      const start = this.points[index]
      const end = this.points[index + 1]
      if (distanceToSegment(x, y, start.x, start.y, end.x, end.y) <= this.padding) {
        return true
      }
    }
    return false
  }
}

function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= 1e-6) return Math.hypot(px - x1, py - y1)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared))
  const projectionX = x1 + t * dx
  const projectionY = y1 + t * dy
  return Math.hypot(px - projectionX, py - projectionY)
}

export class EdgeGraphic extends Graphics {
  data: PositionedEdge
  private _labelText: BitmapText | null = null
  private _labelPlate: Graphics | null = null
  private _theme: Theme
  private _strokeColor: number
  private _stressMode = false
  private _hovered = false
  private _selected = false
  private _hitBounds: Rect | null = null
  private _hitPadding = EDGE_HIT_PADDING
  private _anchorPoint: Point | null = null
  private _calloutSlots: CalloutBadgeSlot[] = []
  private _calloutStates: CalloutBadgeState[] = []
  private _labelFontFamily: string | null = null
  private _arrowDebug: {
    tip: { x: number; y: number }
    wingA: { x: number; y: number }
    wingB: { x: number; y: number }
    angle: number
  } | null = null
  private _erCardinalityDebug: {
    source: string | null
    target: string | null
  } | null = null
  /** Orthogonal wire segments (set by Blueprint mode, read by wire-hop detector) */
  orthogonalSegments?: WireSegment[]

  /**
   * @param edgeIndex — unique index for this edge, used by Blueprint to offset parallel routes
   * @param totalEdges — total edges in the graph, used for channel spacing
   */
  constructor(edge: PositionedEdge, theme: Theme, allNodes?: Map<string, PositionedNode>, philosophy?: string, edgeIndex = 0, totalEdges = 1, allSubgraphs?: Map<string, { x: number; y: number; width: number; height: number }> | undefined, wireRegistry?: WireRegistry, reversePairOffset = 0) {
    super()
    this._theme = theme
    this._strokeColor = theme.edgeColor
    this.data = edge
    this.redraw(edge, theme, allNodes, philosophy, edgeIndex, totalEdges, allSubgraphs, wireRegistry, reversePairOffset)

    // Badge hover is routed by the HOST (the badge is not a pointer target):
    // pointer movement over the edge consults the badge hit test, scales the
    // badge, and emits callout:hover / callout:hoverend transitions.
    wireCalloutBadgeHoverRouting(this, {
      getSlots: () => this._calloutSlots,
      hitTest: (globalX, globalY) => this.getCalloutBadgeAt(globalX, globalY)?.kind ?? null,
      onHover: (kind, originalEvent) => this._emitCalloutEvent('callout:hover', kind, originalEvent),
      onHoverEnd: (kind, originalEvent) => this._emitCalloutEvent('callout:hoverend', kind, originalEvent),
    })
  }

  redraw(
    edge: PositionedEdge,
    theme: Theme,
    allNodes?: Map<string, PositionedNode>,
    philosophy?: string,
    edgeIndex = 0,
    totalEdges = 1,
    allSubgraphs?: Map<string, { x: number; y: number; width: number; height: number }> | undefined,
    wireRegistry?: WireRegistry,
    reversePairOffset = 0,
  ): void {
    void allSubgraphs
    this.clear()
    this.removeChildren()
    this._labelText = null
    this._labelPlate = null
    this._labelFontFamily = null
    this._arrowDebug = null
    this._erCardinalityDebug = null
    this._hovered = false
    this._selected = false
    this._hitBounds = null
    this._anchorPoint = null
    this.hitArea = null
    this.eventMode = 'none'
    this.interactive = false
    this.cursor = 'default'
    this.orthogonalSegments = undefined
    this._theme = theme
    this._strokeColor = this._resolveEdgeStyle(edge, theme).color

    // Self-loops are rendered as explicit loop shapes for non-blueprint modes.
    if (edge.source === edge.target) {
      this.data = edge
      if (allNodes) {
        const node = allNodes.get(edge.source)
        if (node && philosophy !== 'blueprint' && philosophy !== 'blueprint-routed') {
          this._drawSelfLoop(edge, node, theme)
        }
      }
      this._syncCalloutBadges()
      return
    }

    if (allNodes && philosophy !== 'blueprint') {
      edge = this._trimToNodeBounds(edge, allNodes)
      edge = this._applyCollisionAvoidance(edge, allNodes)
    }
    this.data = edge

    switch (philosophy) {
      case 'blueprint':
        this._drawOrthogonal(edge, theme, edgeIndex, totalEdges, allNodes, wireRegistry)
        break
      case 'blueprint-routed':
        // Segments will be drawn via drawFromSegments() after construction
        break
      case 'breath':
        this._drawWhisper(edge, theme)
        break
      default:
        this._draw(edge, theme, reversePairOffset)
    }

    // Re-attach the callout badge after `removeChildren()` wiped the previous
    // one, so it survives every redraw (relayout ticks included).
    this._syncCalloutBadges()
  }

  /**
   * Attach this edge's annotation markers (empty array detaches them all).
   * At most one marker per kind; additional slots step right along the
   * lifted line so a callout badge and a comment pin never overlap.
   *
   * Each marker is a child of the edge graphic, positioned just above the
   * path's midpoint in LOCAL coordinates, so it tracks pan/zoom/relayout via
   * the display tree. State is stored so every redraw re-creates it.
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
   * `pointertap` handler (and this graphic's hover routing) BEFORE the
   * edge:click behaviour — same idiom as `NodeSprite.getSemanticSubitemAt`.
   */
  getCalloutBadgeAt(globalX: number, globalY: number): CalloutBadgeState | null {
    return calloutBadgeSlotAtGlobalPoint(this, this._calloutSlots, globalX, globalY)
      ?.state ?? null
  }

  /** Emit a marker's `callout:click` (host-routed tap; see callout-badge doc). */
  dispatchCalloutTap(kind: CalloutBadgeKind, originalEvent?: Event): void {
    this._emitCalloutEvent('callout:click', kind, originalEvent)
  }

  /** Current marker scale (hover feedback), for tests/debug. */
  getCalloutBadgeHoverScale(kind: CalloutBadgeKind = 'callout'): number | null {
    const slot = this._calloutSlots.find((candidate) => candidate.state.kind === kind)
    return slot ? slot.badge.scale.x : null
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

  private _syncCalloutBadges(): void {
    this._calloutSlots = rebuildCalloutBadgeSlots(
      this._calloutSlots,
      this._anchorPoint ? this._calloutStates : [],
      {
        accents: this._theme,
        surface: this._theme.background,
        fontName: 'MermaidLabel',
        positionFor: (slotIndex) =>
          computeEdgeCalloutBadgePosition(this._anchorPoint as Point, slotIndex),
        addChild: (badge) => this.addChild(badge),
      },
    )
    this._applyCalloutHitArea()
  }

  /**
   * The polyline hit area prunes hit-testing for everything outside the wire
   * corridor — including the marker children. When markers are present,
   * extend the hit area with each marker's circle so they stay clickable;
   * when all are removed, restore the plain polyline hit area.
   */
  private _applyCalloutHitArea(): void {
    type HitAreaLike = { contains(x: number, y: number): boolean }
    type CompositeHitArea = HitAreaLike & { _calloutBase: HitAreaLike | null }
    const current = this.hitArea as (HitAreaLike & { _calloutBase?: HitAreaLike | null }) | null
    const base = current && current._calloutBase !== undefined
      ? current._calloutBase
      : current

    if (this._calloutSlots.length === 0) {
      this.hitArea = base
      return
    }

    const slots = this._calloutSlots
    const composite: CompositeHitArea = {
      _calloutBase: base,
      contains: (x: number, y: number) => {
        for (const slot of slots) {
          const dx = x - slot.badge.x
          const dy = y - slot.badge.y
          if (dx * dx + dy * dy <= CALLOUT_BADGE_HIT_RADIUS * CALLOUT_BADGE_HIT_RADIUS) {
            return true
          }
        }
        return base ? base.contains(x, y) : false
      },
    }
    this.hitArea = composite
    if (this.eventMode === 'none') {
      this.eventMode = 'static'
      this.interactive = true
    }
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
   * Check if the edge's straight-line path collides with any non-endpoint node,
   * and if so, insert a waypoint to route around it.
   */
  private _applyCollisionAvoidance(
    edge: PositionedEdge,
    allNodes: Map<string, PositionedNode>,
  ): PositionedEdge {
    const points = edge.points
    if (points.length < 2) return edge

    const srcPt = points[0]
    const tgtPt = points[points.length - 1]

    for (const [id, node] of allNodes) {
      if (id === edge.source || id === edge.target) continue

      const footprint = estimateRenderedNodeFootprint(node, false)
      const hw = footprint.width / 2
      const hh = footprint.height / 2

      if (lineIntersectsRect(srcPt.x, srcPt.y, tgtPt.x, tgtPt.y, node.x, node.y, hw, hh)) {
        const waypoint = computeWaypoint(
          srcPt.x, srcPt.y, tgtPt.x, tgtPt.y,
          node.x, node.y, node.width, node.height,
        )
        return {
          ...edge,
          points: [srcPt, waypoint, tgtPt],
        }
      }
    }

    return edge
  }

  private _trimToNodeBounds(
    edge: PositionedEdge,
    allNodes: Map<string, PositionedNode>,
  ): PositionedEdge {
    const points = edge.points
    if (points.length < 2) return edge

    const srcNode = allNodes.get(edge.source)
    const tgtNode = allNodes.get(edge.target)
    if (!srcNode || !tgtNode) return edge

    const nextFromSource = points[1]
    const prevToTarget = points[points.length - 2]

    const trimmed = points.slice()
    trimmed[0] = this._pointOnNodeBoundary(srcNode, nextFromSource)
    trimmed[trimmed.length - 1] = this._pointOnNodeBoundary(tgtNode, prevToTarget)

    return { ...edge, points: trimmed }
  }

  private _pointOnNodeBoundary(
    node: PositionedNode,
    toward: { x: number; y: number },
  ): { x: number; y: number } {
    const dx = toward.x - node.x
    const dy = toward.y - node.y
    if (dx === 0 && dy === 0) return { x: node.x, y: node.y }

    const footprint = estimateRenderedNodeFootprint(node, false)
    const hw = footprint.width / 2
    const hh = footprint.height / 2

    if (node.shape === 'circle') {
      const radius = Math.max(hw, hh)
      const length = Math.hypot(dx, dy) || 1
      return {
        x: node.x + (dx / length) * radius,
        y: node.y + (dy / length) * radius,
      }
    }

    if (node.shape === 'diamond') {
      const scale = 1 / ((Math.abs(dx) / hw) + (Math.abs(dy) / hh))
      return {
        x: node.x + dx * scale,
        y: node.y + dy * scale,
      }
    }

    if (node.shape === 'hexagon') {
      const inset = hw * 0.25
      const vertices = [
        { x: node.x - hw + inset, y: node.y - hh },
        { x: node.x + hw - inset, y: node.y - hh },
        { x: node.x + hw, y: node.y },
        { x: node.x + hw - inset, y: node.y + hh },
        { x: node.x - hw + inset, y: node.y + hh },
        { x: node.x - hw, y: node.y },
      ]
      const hit = this._intersectRayWithPolygon({ x: node.x, y: node.y }, toward, vertices)
      if (hit) return hit
    }

    const scale = 1 / Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh)

    return {
      x: node.x + dx * scale,
      y: node.y + dy * scale,
    }
  }

  private _intersectRayWithPolygon(
    origin: { x: number; y: number },
    toward: { x: number; y: number },
    vertices: Array<{ x: number; y: number }>,
  ): { x: number; y: number } | null {
    const ray = {
      x: toward.x - origin.x,
      y: toward.y - origin.y,
    }
    let bestT = Infinity
    let bestPoint: { x: number; y: number } | null = null

    for (let index = 0; index < vertices.length; index++) {
      const a = vertices[index]
      const b = vertices[(index + 1) % vertices.length]
      const segment = { x: b.x - a.x, y: b.y - a.y }
      const denom = ray.x * segment.y - ray.y * segment.x
      if (Math.abs(denom) < 1e-6) continue

      const ax = a.x - origin.x
      const ay = a.y - origin.y
      const t = (ax * segment.y - ay * segment.x) / denom
      const u = (ax * ray.y - ay * ray.x) / denom
      if (t < 0 || u < 0 || u > 1) continue
      if (t < bestT) {
        bestT = t
        bestPoint = {
          x: origin.x + ray.x * t,
          y: origin.y + ray.y * t,
        }
      }
    }

    return bestPoint
  }

  /**
   * Blueprint A* mode: draw pre-computed wire segments.
   * Called instead of constructor's _drawOrthogonal when router provides segments.
   */
  drawFromSegments(segments: RouterWireSegment[], theme: Theme): void {
    if (segments.length === 0) return
    const edgeStyle = this._resolveEdgeStyle(this.data, theme)
    const color = edgeStyle.color
    this._strokeColor = color

    const points = [{ x: segments[0].x1, y: segments[0].y1 }]
    for (const seg of segments) {
      points.push({ x: seg.x2, y: seg.y2 })
    }
    this._anchorPoint = this._pathMidpoint(points)
    this._strokePolyline(points, edgeStyle)
    this._setEdgeHitPath(points)

    // Record for hop detection
    this.orthogonalSegments = segments as WireSegment[]

    if (!this._drawErEndpointMarkers(points, edgeStyle)) {
      // Arrow at final segment end
      const last = segments[segments.length - 1]
      this._drawArrow([{ x: last.x1, y: last.y1 }, { x: last.x2, y: last.y2 }], edgeStyle)
    }

    // Label at midpoint
    if (this.data.label && segments.length > 0) {
      const midSeg = segments[Math.floor(segments.length / 2)]
      const mx = (midSeg.x1 + midSeg.x2) / 2
      const my = (midSeg.y1 + midSeg.y2) / 2
      this._addLabel(this.data.label, 'MermaidBlueprint', 10, edgeStyle.labelColor, mx, my - 12, true, color)
    }

    this._syncCalloutBadges()
  }

  dim(on: boolean): void {
    this.alpha = on ? DIMMED_ALPHA : 1
  }

  setHovered(hovered: boolean): void {
    this._hovered = hovered
  }

  isHovered(): boolean {
    return this._hovered
  }

  setSelected(selected: boolean): void {
    this._selected = selected
  }

  isSelected(): boolean {
    return this._selected
  }

  getHitBounds(): Rect | null {
    return this._hitBounds ? { ...this._hitBounds } : null
  }

  getHitPadding(): number {
    return this._hitPadding
  }

  getAnchorPoint(): Point | null {
    if (!this._anchorPoint) return null
    const point = this.toGlobal(this._anchorPoint)
    return { x: point.x, y: point.y }
  }

  setStressMode(stressMode: boolean): void {
    this._stressMode = stressMode
    if (this._labelText) this._labelText.visible = !stressMode
    if (this._labelPlate) this._labelPlate.visible = !stressMode
  }

  getLabelBounds(): { x: number; y: number; width: number; height: number } | null {
    if (!this._labelText) return null
    const bounds = this._labelText.getBounds()
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    }
  }

  getDebugStyle(): {
    strokeColor: number
    labelFill: number | null
    labelVisible: boolean
    labelFontFamily: string | null
    selected: boolean
    arrowTip: { x: number; y: number } | null
    arrowWingA: { x: number; y: number } | null
    arrowWingB: { x: number; y: number } | null
    arrowAngle: number | null
    erSourceCardinality: string | null
    erTargetCardinality: string | null
  } {
    return {
      strokeColor: this._strokeColor,
      labelFill: this._labelText ? (this._labelText.style.fill as number | undefined) ?? null : null,
      labelVisible: this._labelText?.visible ?? false,
      labelFontFamily: this._labelFontFamily,
      selected: this._selected,
      arrowTip: this._arrowDebug?.tip ?? null,
      arrowWingA: this._arrowDebug?.wingA ?? null,
      arrowWingB: this._arrowDebug?.wingB ?? null,
      arrowAngle: this._arrowDebug?.angle ?? null,
      erSourceCardinality: this._erCardinalityDebug?.source ?? null,
      erTargetCardinality: this._erCardinalityDebug?.target ?? null,
    }
  }

  private _draw(edge: PositionedEdge, theme: Theme, reversePairOffset = 0): void {
    const points = edge.points
    if (points.length < 2) return

    const edgeStyle = this._resolveEdgeStyle(edge, theme)
    this._strokeColor = edgeStyle.color
    const hitPoints = points.length === 2 && reversePairOffset !== 0
      ? [points[0], this._reversePairControlPoint(points[0], points[1], reversePairOffset), points[1]]
      : points
    this._anchorPoint = this._pathMidpoint(hitPoints)

    this.moveTo(points[0].x, points[0].y)

    if (points.length === 2 && reversePairOffset !== 0) {
      const start = points[0]
      const end = points[1]
      const control = this._reversePairControlPoint(start, end, reversePairOffset)
      this.quadraticCurveTo(control.x, control.y, end.x, end.y)
    } else if (points.length === 2) {
      this.lineTo(points[1].x, points[1].y)
    } else if (points.length === 3) {
      this.quadraticCurveTo(points[1].x, points[1].y, points[2].x, points[2].y)
    } else {
      for (let i = 1; i < points.length - 2; i += 2) {
        const cp1 = points[i]
        const cp2 = points[i + 1]
        const end = points[Math.min(i + 2, points.length - 1)]
        this.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y)
      }
      const lastDrawn = points.length % 2 === 0 ? points.length - 2 : points.length - 1
      for (let i = lastDrawn; i < points.length; i++) {
        this.lineTo(points[i].x, points[i].y)
      }
    }

    this.stroke({ width: edgeStyle.width, color: edgeStyle.color, alpha: edgeStyle.alpha })
    this._setEdgeHitPath(hitPoints)
    if (!this._drawErEndpointMarkers(points, edgeStyle)) {
      this._drawArrow(points, edgeStyle)
    }

    if (edge.label) {
      const mid = this._labelPlacement(points, reversePairOffset)
      this._addLabel(edge.label, 'MermaidEdge', 11, edgeStyle.labelColor, mid.x, mid.y, false)
    }
  }

  private _addLabel(
    text: string,
    fontFamily: string,
    fontSize: number,
    fill: number,
    x: number,
    y: number,
    withPlate: boolean,
    plateStrokeColor: number = this._theme.edgeColor,
  ): void {
    ensureFontsInstalled()
    this._labelText = new BitmapText({
      text,
      style: { fontFamily, fontSize, fill },
    })
    this._labelFontFamily = fontFamily
    this._labelText.anchor.set(0.5)
    this._labelText.x = x
    this._labelText.y = y
    this._labelText.visible = !this._stressMode

    if (withPlate) {
      const plateWidth = this._labelText.width + 14
      const plateHeight = this._labelText.height + 6
      this._labelPlate = new Graphics()
      this._labelPlate
        .roundRect(x - plateWidth / 2, y - plateHeight / 2, plateWidth, plateHeight, 4)
        .fill({ color: this._theme.background, alpha: 0.78 })
        .stroke({ width: 1, color: plateStrokeColor, alpha: 0.5 })
      this._labelPlate.visible = !this._stressMode
      this.addChild(this._labelPlate)
    }

    this.addChild(this._labelText)
  }

  private _drawArrow(points: Array<{ x: number; y: number }>, edgeStyle: ResolvedEdgeStyle): void {
    const last = points[points.length - 1]
    const prev = points[points.length - 2]
    const angle = Math.atan2(last.y - prev.y, last.x - prev.x)
    const wingA = {
      x: last.x - ARROW_SIZE * Math.cos(angle - Math.PI / 6),
      y: last.y - ARROW_SIZE * Math.sin(angle - Math.PI / 6),
    }
    const wingB = {
      x: last.x - ARROW_SIZE * Math.cos(angle + Math.PI / 6),
      y: last.y - ARROW_SIZE * Math.sin(angle + Math.PI / 6),
    }
    this._arrowDebug = {
      tip: { x: last.x, y: last.y },
      wingA,
      wingB,
      angle,
    }

    this.moveTo(last.x, last.y)
    this.lineTo(wingA.x, wingA.y)
    this.moveTo(last.x, last.y)
    this.lineTo(wingB.x, wingB.y)
    this.stroke({ width: Math.max(1.8, edgeStyle.width), color: edgeStyle.color, alpha: edgeStyle.alpha })
  }

  private _drawErEndpointMarkers(points: Array<{ x: number; y: number }>, edgeStyle: ResolvedEdgeStyle): boolean {
    const cardinalities = this._erCardinalities()
    if (!cardinalities || points.length < 2) return false

    this._erCardinalityDebug = {
      source: cardinalities.source,
      target: cardinalities.target,
    }

    this._drawErCardinalityMarker(points[0], points[1], cardinalities.source, edgeStyle)
    this._drawErCardinalityMarker(points[points.length - 1], points[points.length - 2], cardinalities.target, edgeStyle)
    return true
  }

  private _erCardinalities(): { source: ErCardinality; target: ErCardinality } | null {
    const metadata = this.data.metadata
    if (!metadata || metadata.diagramFamily !== 'er') return null
    const er = metadata.er as Record<string, unknown> | undefined
    const source = this._erCardinality(er?.sourceCardinality)
    const target = this._erCardinality(er?.targetCardinality)
    return source && target ? { source, target } : null
  }

  private _erCardinality(value: unknown): ErCardinality | null {
    switch (value) {
      case 'ONLY_ONE':
      case 'ZERO_OR_ONE':
      case 'ONE_OR_MORE':
      case 'ZERO_OR_MORE':
        return value
      default:
        return null
    }
  }

  private _drawErCardinalityMarker(
    endpoint: { x: number; y: number },
    inwardPoint: { x: number; y: number },
    cardinality: ErCardinality,
    edgeStyle: ResolvedEdgeStyle,
  ): void {
    const dx = inwardPoint.x - endpoint.x
    const dy = inwardPoint.y - endpoint.y
    const length = Math.hypot(dx, dy) || 1
    const ux = dx / length
    const uy = dy / length
    const px = -uy
    const py = ux
    const alpha = Math.min(1, edgeStyle.alpha + 0.12)
    const lineWidth = Math.max(1.8, edgeStyle.width)

    const pointAt = (distance: number, side = 0) => ({
      x: endpoint.x + ux * distance + px * side,
      y: endpoint.y + uy * distance + py * side,
    })

    const drawBar = (distance: number) => {
      const a = pointAt(distance, -6)
      const b = pointAt(distance, 6)
      this.moveTo(a.x, a.y)
      this.lineTo(b.x, b.y)
      this.stroke({ width: lineWidth, color: edgeStyle.color, alpha })
    }

    const drawCircle = (distance: number) => {
      const center = pointAt(distance)
      this.circle(center.x, center.y, 4.2)
      this.stroke({ width: lineWidth, color: edgeStyle.color, alpha })
    }

    const drawCrowFoot = (baseDistance: number, tipDistance: number) => {
      const base = pointAt(baseDistance)
      for (const side of [-7, 0, 7]) {
        const tip = pointAt(tipDistance, side)
        this.moveTo(base.x, base.y)
        this.lineTo(tip.x, tip.y)
      }
      this.stroke({ width: lineWidth, color: edgeStyle.color, alpha })
    }

    switch (cardinality) {
      case 'ONLY_ONE':
        drawBar(9)
        break
      case 'ZERO_OR_ONE':
        drawCircle(7)
        drawBar(17)
        break
      case 'ONE_OR_MORE':
        drawBar(7)
        drawCrowFoot(12, 22)
        break
      case 'ZERO_OR_MORE':
        drawCircle(7)
        drawCrowFoot(15, 25)
        break
    }
  }

  private _resolveEdgeStyle(edge: PositionedEdge, theme: Theme): ResolvedEdgeStyle {
    const params = this._styleParams(edge.style)
    return {
      color: edge.renderStyle?.stroke ?? theme.edgeColor,
      labelColor: edge.renderStyle?.text ?? theme.edgeLabelColor,
      width: edge.renderStyle?.strokeWidth ?? params.width,
      alpha: params.alpha,
      dashPattern: edge.renderStyle?.strokeDasharray ?? params.dashPattern,
    }
  }

  private _styleParams(style: EdgeStyle): { width: number; alpha: number; dashPattern?: number[] } {
    switch (style) {
      case 'dotted': return { width: 1.5, alpha: 0.82, dashPattern: [4, 6] }
      case 'thick': return { width: 3, alpha: 1 }
      default: return { width: 1.5, alpha: 1 }
    }
  }

  private _strokePolyline(points: Array<{ x: number; y: number }>, edgeStyle: ResolvedEdgeStyle): void {
    if (points.length < 2) return

    if (!edgeStyle.dashPattern) {
      this.moveTo(points[0].x, points[0].y)
      for (let index = 1; index < points.length; index++) {
        this.lineTo(points[index].x, points[index].y)
      }
      this.stroke({ width: edgeStyle.width, color: edgeStyle.color, alpha: edgeStyle.alpha })
      return
    }

    const pattern = edgeStyle.dashPattern
    let patternIndex = 0
    let drawDash = true
    let remaining = pattern[0] ?? 1

    for (let index = 0; index < points.length - 1; index++) {
      const start = points[index]
      const end = points[index + 1]
      const dx = end.x - start.x
      const dy = end.y - start.y
      const length = Math.hypot(dx, dy)
      if (length <= 1e-6) continue

      let travelled = 0
      while (travelled < length) {
        const step = Math.min(remaining, length - travelled)
        const fromRatio = travelled / length
        const toRatio = (travelled + step) / length
        const from = { x: start.x + dx * fromRatio, y: start.y + dy * fromRatio }
        const to = { x: start.x + dx * toRatio, y: start.y + dy * toRatio }

        if (drawDash) {
          this.moveTo(from.x, from.y)
          this.lineTo(to.x, to.y)
        }

        travelled += step
        remaining -= step
        if (remaining <= 1e-6) {
          patternIndex = (patternIndex + 1) % pattern.length
          remaining = pattern[patternIndex] ?? 1
          drawDash = !drawDash
        }
      }
    }

    this.stroke({ width: edgeStyle.width, color: edgeStyle.color, alpha: edgeStyle.alpha })
  }

  private _reversePairControlPoint(
    start: { x: number; y: number },
    end: { x: number; y: number },
    offset: number,
  ): { x: number; y: number } {
    const { nx, ny } = this._canonicalNormal(start, end)
    return {
      x: (start.x + end.x) / 2 + nx * offset,
      y: (start.y + end.y) / 2 + ny * offset,
    }
  }

  private _labelPlacement(
    points: Array<{ x: number; y: number }>,
    reversePairOffset: number,
  ): { x: number; y: number } {
    const labelPath = points.length === 2 && reversePairOffset !== 0
      ? [points[0], this._reversePairControlPoint(points[0], points[1], reversePairOffset), points[1]]
      : points

    if (labelPath.length < 2) return labelPath[0] ?? { x: 0, y: 0 }

    let totalLength = 0
    const segmentLengths: number[] = []
    for (let index = 0; index < labelPath.length - 1; index++) {
      const start = labelPath[index]
      const end = labelPath[index + 1]
      const length = Math.hypot(end.x - start.x, end.y - start.y)
      segmentLengths.push(length)
      totalLength += length
    }

    if (totalLength <= 1e-6) return labelPath[Math.floor(labelPath.length / 2)]

    const target = totalLength / 2
    let traversed = 0
    for (let index = 0; index < segmentLengths.length; index++) {
      const length = segmentLengths[index]
      if (traversed + length < target) {
        traversed += length
        continue
      }

      const start = labelPath[index]
      const end = labelPath[index + 1]
      const ratio = length > 1e-6 ? (target - traversed) / length : 0.5
      const dx = end.x - start.x
      const dy = end.y - start.y
      const { nx, ny } = this._preferredLabelNormal(dx, dy)
      return {
        x: start.x + dx * ratio + nx * 14,
        y: start.y + dy * ratio + ny * 14,
      }
    }

    return labelPath[labelPath.length - 1]
  }

  private _canonicalNormal(
    start: { x: number; y: number },
    end: { x: number; y: number },
  ): { nx: number; ny: number } {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const length = Math.hypot(dx, dy) || 1
    let nx = -dy / length
    let ny = dx / length
    if (start.y > end.y || (start.y === end.y && start.x > end.x)) {
      nx *= -1
      ny *= -1
    }
    return { nx, ny }
  }

  private _preferredLabelNormal(dx: number, dy: number): { nx: number; ny: number } {
    const length = Math.hypot(dx, dy) || 1
    let nx = -dy / length
    let ny = dx / length
    if (ny > 0 || (Math.abs(ny) < 1e-6 && nx > 0)) {
      nx *= -1
      ny *= -1
    }
    return { nx, ny }
  }

  private _drawSelfLoop(edge: PositionedEdge, node: PositionedNode, theme: Theme): void {
    const edgeStyle = this._resolveEdgeStyle(edge, theme)
    const color = edgeStyle.color
    this._strokeColor = color
    const footprint = estimateRenderedNodeFootprint(node, false)
    const { start, cp1, cp2, end, labelPosition } = computeSelfLoopGeometry(node, footprint, edge.label)

    this.moveTo(start.x, start.y)
    this.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y)
    this.stroke({ width: edgeStyle.width, color, alpha: edgeStyle.alpha })
    this._anchorPoint = this._pathMidpoint([start, cp1, cp2, end])
    this._setEdgeHitPath([start, cp1, cp2, end])
    this._drawArrow([cp2, end], edgeStyle)

    if (edge.label) {
      this._addLabel(
        edge.label,
        'MermaidEdge',
        11,
        edgeStyle.labelColor,
        labelPosition.x,
        labelPosition.y,
        false,
      )
    }
  }

  /**
   * Blueprint: orthogonal edges with right-angle routing.
   * Goes horizontal to midpoint x, then vertical to target y, then horizontal to target.
   * Snaps to 20px grid.
   *
   * Port-based attachment: wires exit from the BOTTOM of the source node and
   * enter at the TOP of the target node (in TD layout).
   *
   * Junction dots are drawn at bend points where the wire changes direction.
   */
  private _drawOrthogonal(edge: PositionedEdge, theme: Theme, edgeIndex: number, totalEdges: number, allNodes?: Map<string, PositionedNode>, wireRegistry?: WireRegistry): void {
    const points = edge.points
    if (points.length < 2) return

    const src = points[0]
    const tgt = points[points.length - 1]
    const edgeStyle = this._resolveEdgeStyle(edge, theme)
    const color = edgeStyle.color
    this._strokeColor = color
    const gridSize = (theme as any).gridSize ?? 20

    // Port-based attachment: exit from bottom of source, enter top of target
    const srcNode = allNodes?.get(edge.source)
    const tgtNode = allNodes?.get(edge.target)
    const srcFootprint = srcNode ? estimateRenderedNodeFootprint(srcNode, true) : null
    const tgtFootprint = tgtNode ? estimateRenderedNodeFootprint(tgtNode, true) : null
    const srcPort = { x: src.x, y: srcNode && srcFootprint ? srcNode.y + srcFootprint.height / 2 : src.y }
    const tgtPort = { x: tgt.x, y: tgtNode && tgtFootprint ? tgtNode.y - tgtFootprint.height / 2 : tgt.y }

    // Find a horizontal channel Y that doesn't pass through any node
    const baseMidY = (srcPort.y + tgtPort.y) / 2
    const channelOffset = (edgeIndex - totalEdges / 2) * gridSize * 0.6
    const baseMid = Math.round((baseMidY + channelOffset) / gridSize) * gridSize
    const minX = Math.min(srcPort.x, tgtPort.x)
    const maxX = Math.max(srcPort.x, tgtPort.x)

    let midY: number
    if (wireRegistry) {
      midY = wireRegistry.findFreeHorizontal(baseMid, minX, maxX)
    } else {
      // Fallback: ad-hoc node scan (when no registry available)
      midY = baseMid
      if (allNodes) {
        let attempts = 0
        while (attempts < 20) {
          let blocked = false
          for (const [id, node] of allNodes) {
            if (id === edge.source || id === edge.target) continue
            const footprint = estimateRenderedNodeFootprint(node, true)
            const hw = footprint.width / 2 + 4
            const hh = footprint.height / 2 + 4
            if (midY >= node.y - hh && midY <= node.y + hh &&
                maxX >= node.x - hw && minX <= node.x + hw) {
              blocked = true
              break
            }
          }
          if (!blocked) break
          attempts++
          midY += (attempts % 2 === 0 ? 1 : -1) * attempts * gridSize
          midY = Math.round(midY / gridSize) * gridSize
        }
      }
    }

    // I15: enforce minimum bend separation — no zero-length vertical segments
    if (Math.abs(midY - srcPort.y) < gridSize) {
      midY = srcPort.y + (tgtPort.y >= srcPort.y ? gridSize : -gridSize)
      midY = Math.round(midY / gridSize) * gridSize
    }
    if (Math.abs(midY - tgtPort.y) < gridSize) {
      midY = tgtPort.y + (srcPort.y >= tgtPort.y ? gridSize : -gridSize)
      midY = Math.round(midY / gridSize) * gridSize
    }

    // Find free vertical lanes for source and target segments
    let srcExitX: number
    let tgtEntryX: number

    if (wireRegistry) {
      srcExitX = wireRegistry.findFreeVertical(srcPort.x, srcPort.y, midY)
      tgtEntryX = wireRegistry.findFreeVertical(tgtPort.x, midY, tgtPort.y)
    } else {
      // Fallback: ad-hoc node scan
      srcExitX = srcPort.x
      tgtEntryX = tgtPort.x
      if (allNodes) {
        for (const [id, node] of allNodes) {
          if (id === edge.source || id === edge.target) continue
          const footprint = estimateRenderedNodeFootprint(node, true)
          const hw = footprint.width / 2 + 6
          const hh = footprint.height / 2 + 6
          const minSegY = Math.min(srcPort.y, midY)
          const maxSegY = Math.max(srcPort.y, midY)
          if (srcExitX >= node.x - hw && srcExitX <= node.x + hw &&
              maxSegY >= node.y - hh && minSegY <= node.y + hh) {
            srcExitX = srcExitX < node.x ? node.x - hw - gridSize : node.x + hw + gridSize
            srcExitX = Math.round(srcExitX / gridSize) * gridSize
          }
        }
        for (const [id, node] of allNodes) {
          if (id === edge.source || id === edge.target) continue
          const footprint = estimateRenderedNodeFootprint(node, true)
          const hw = footprint.width / 2 + 6
          const hh = footprint.height / 2 + 6
          const minSegY = Math.min(midY, tgtPort.y)
          const maxSegY = Math.max(midY, tgtPort.y)
          if (tgtEntryX >= node.x - hw && tgtEntryX <= node.x + hw &&
              maxSegY >= node.y - hh && minSegY <= node.y + hh) {
            tgtEntryX = tgtEntryX < node.x ? node.x - hw - gridSize : node.x + hw + gridSize
            tgtEntryX = Math.round(tgtEntryX / gridSize) * gridSize
          }
        }
      }
    }

    // Route with potentially offset vertical segments
    const routePoints: Array<{ x: number; y: number }> = [srcPort]
    if (srcExitX !== srcPort.x) {
      // Jog horizontally to clear, then go vertical
      routePoints.push({ x: srcExitX, y: srcPort.y })
    }
    routePoints.push({ x: srcExitX, y: midY })
    routePoints.push({ x: tgtEntryX, y: midY })
    if (tgtEntryX !== tgtPort.x) {
      routePoints.push({ x: tgtEntryX, y: tgtPort.y })
      routePoints.push(tgtPort)
    } else {
      routePoints.push(tgtPort)
    }

    this._strokePolyline(routePoints, edgeStyle)
    this._anchorPoint = this._pathMidpoint(routePoints)
    this._setEdgeHitPath(routePoints)

    // Claim all segments in registry so future edges avoid them
    if (wireRegistry) {
      if (srcExitX !== srcPort.x) {
        wireRegistry.claimHorizontal(srcPort.y, srcPort.x, srcExitX)
      }
      wireRegistry.claimVertical(srcExitX, srcPort.y, midY)
      wireRegistry.claimHorizontal(midY, srcExitX, tgtEntryX)
      wireRegistry.claimVertical(tgtEntryX, midY, tgtPort.y)
      if (tgtEntryX !== tgtPort.x) {
        wireRegistry.claimHorizontal(tgtPort.y, tgtEntryX, tgtPort.x)
      }
    }

    // Record orthogonal segments for wire-hop detection (use actual routed positions)
    this.orthogonalSegments = []
    if (srcExitX !== srcPort.x) {
      this.orthogonalSegments.push({ x1: srcPort.x, y1: srcPort.y, x2: srcExitX, y2: srcPort.y, isHorizontal: true, edgeId: edge.id })
    }
    this.orthogonalSegments.push(
      { x1: srcExitX, y1: srcPort.y, x2: srcExitX, y2: midY, isHorizontal: false, edgeId: edge.id },
      { x1: srcExitX, y1: midY, x2: tgtEntryX, y2: midY, isHorizontal: true, edgeId: edge.id },
      { x1: tgtEntryX, y1: midY, x2: tgtEntryX, y2: tgtPort.y, isHorizontal: false, edgeId: edge.id },
    )
    if (tgtEntryX !== tgtPort.x) {
      this.orthogonalSegments.push({ x1: tgtEntryX, y1: tgtPort.y, x2: tgtPort.x, y2: tgtPort.y, isHorizontal: true, edgeId: edge.id })
    }

    if (!this._drawErEndpointMarkers(routePoints, edgeStyle)) {
      // Arrow pointing into target
      this._drawArrow([{ x: tgtEntryX, y: midY }, tgtPort], edgeStyle)
    }

    // Label at the horizontal segment midpoint
    if (edge.label) {
      const labelX = (srcPort.x + tgtPort.x) / 2
      this._addLabel(edge.label, 'MermaidBlueprint', 10, edgeStyle.labelColor, labelX, midY - 12, true, color)
    }
  }

  /**
   * Breath: whisper lines — barely visible, thin, low opacity.
   * No labels by default.
   */
  private _drawWhisper(edge: PositionedEdge, theme: Theme): void {
    const points = edge.points
    if (points.length < 2) return

    const edgeStyle = this._resolveEdgeStyle(edge, theme)
    const color = edgeStyle.color
    this._strokeColor = color

    this.moveTo(points[0].x, points[0].y)
    if (points.length === 2) {
      this.lineTo(points[1].x, points[1].y)
    } else {
      // Gentle quadratic through midpoints
      for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2
        const yc = (points[i].y + points[i + 1].y) / 2
        this.quadraticCurveTo(points[i].x, points[i].y, xc, yc)
      }
      this.lineTo(points[points.length - 1].x, points[points.length - 1].y)
    }

    // Whisper: thin, low opacity
    this.stroke({ width: 1, color, alpha: 0.25 })
    this._anchorPoint = this._pathMidpoint(points)
    this._setEdgeHitPath(points)

    // Small subtle arrow
    const last = points[points.length - 1]
    const prev = points[points.length - 2]
    const angle = Math.atan2(last.y - prev.y, last.x - prev.x)
    const s = 5
    this.moveTo(last.x, last.y)
    this.lineTo(last.x - s * Math.cos(angle - Math.PI / 6), last.y - s * Math.sin(angle - Math.PI / 6))
    this.moveTo(last.x, last.y)
    this.lineTo(last.x - s * Math.cos(angle + Math.PI / 6), last.y - s * Math.sin(angle + Math.PI / 6))
    this.stroke({ width: 0.8, color, alpha: 0.25 })

    // No label for whisper lines (shown on hover only — future feature)
  }

  private _setEdgeHitPath(points: Array<{ x: number; y: number }>): void {
    const hitPoints = points.filter((point, index) => (
      index === 0
      || Math.hypot(point.x - points[index - 1].x, point.y - points[index - 1].y) > 1e-6
    ))
    if (hitPoints.length < 2) return

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const point of hitPoints) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }

    const padding = this._hitPadding
    this._hitBounds = {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    }
    this.hitArea = new PolylineHitArea(hitPoints, padding)
    this.eventMode = 'static'
    this.interactive = true
    this.cursor = 'pointer'
  }

  private _pathMidpoint(points: Point[]): Point | null {
    const path = points.filter((point, index) => (
      index === 0
      || Math.hypot(point.x - points[index - 1].x, point.y - points[index - 1].y) > 1e-6
    ))
    if (path.length === 0) return null
    if (path.length === 1) return { ...path[0] }

    let totalLength = 0
    const lengths: number[] = []
    for (let index = 0; index < path.length - 1; index++) {
      const start = path[index]
      const end = path[index + 1]
      const length = Math.hypot(end.x - start.x, end.y - start.y)
      lengths.push(length)
      totalLength += length
    }

    if (totalLength <= 1e-6) return { ...path[Math.floor(path.length / 2)] }

    const target = totalLength / 2
    let traversed = 0
    for (let index = 0; index < lengths.length; index++) {
      const length = lengths[index]
      if (traversed + length < target) {
        traversed += length
        continue
      }

      const start = path[index]
      const end = path[index + 1]
      const ratio = length > 1e-6 ? (target - traversed) / length : 0.5
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      }
    }

    return { ...path[path.length - 1] }
  }
}
