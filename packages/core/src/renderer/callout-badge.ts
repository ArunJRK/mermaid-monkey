import { BitmapText, Container, Graphics, type FederatedPointerEvent } from 'pixi.js'
import type { CalloutBadgeKind } from '../types'

/**
 * Shared annotation-marker (callout badge / comment pin) visual language.
 *
 * A marker is an in-canvas annotation drawn as a CHILD of the display object
 * it annotates (NodeSprite, SubgraphContainer, EdgeGraphic), in that parent's
 * LOCAL coordinate space. Because it is parented, it pans, zooms, and
 * relayouts with its anchor by construction — no screen-space compensation
 * anywhere. Visual style follows the link badge in `node-sprite.ts`
 * (`_drawLinkBadge`): accent circle, glyph in the parent's surface colour,
 * hit area larger than the visual, enlarge on hover.
 *
 * A host can carry at most one marker of EACH kind (`'callout'` and
 * `'comment'`). Markers occupy ordered slots — callout first, comment next —
 * each shifted by `CALLOUT_BADGE_LINK_CLEARANCE` so they never overlap each
 * other (or the link badge, which keeps the corner itself).
 *
 * Pointer routing: the marker itself is NOT a pointer target (`eventMode:
 * 'none'`). In real browser use the badge child never won Pixi's hit test —
 * pointer events targeted the host sprite — so the host owns all badge
 * interaction instead, the same idiom `getSemanticSubitemAt` already uses:
 * the host's own `pointertap` / `pointermove` handlers consult
 * `getCalloutBadgeAt(globalX, globalY)` and route to callout events before
 * falling through to node/subgraph/edge behaviour. The single source of
 * truth for the hit geometry is `CALLOUT_BADGE_HIT_RADIUS`.
 */

export const CALLOUT_BADGE_RADIUS = 8
export const CALLOUT_BADGE_HIT_RADIUS = 14
export const CALLOUT_BADGE_HOVER_SCALE = 1.3
/** Corner inset matching the link badge's `hw - 6 / -hh + 6` placement. */
export const CALLOUT_BADGE_CORNER_INSET = 6
/**
 * Horizontal clearance between corner occupants: shift when a link badge
 * already occupies the corner, and again per additional marker slot.
 */
export const CALLOUT_BADGE_LINK_CLEARANCE = 20
/** Lift above an edge's midpoint so the badge does not sit on the wire/label. */
export const CALLOUT_BADGE_EDGE_LIFT = 14

/** Deterministic slot order: callout keeps the corner, comment sits beside. */
const BADGE_KIND_ORDER: readonly CalloutBadgeKind[] = ['callout', 'comment']

/** Per-anchor, per-kind marker state pushed down from the renderer. */
export interface CalloutBadgeState {
  kind: CalloutBadgeKind
  count?: number
}

/** One attached marker: its state plus the display object rendered for it. */
export interface CalloutBadgeSlot {
  state: CalloutBadgeState
  badge: Container
}

/**
 * The accent colour for a marker kind: callout badges use the theme accent,
 * comment pins use the theme's dedicated (distinct) comment accent.
 */
export function calloutBadgeAccent(
  kind: CalloutBadgeKind,
  accents: { accent: number; commentAccent: number },
): number {
  return kind === 'comment' ? accents.commentAccent : accents.accent
}

/**
 * Normalize a pushed state list into render order: one state per kind (last
 * push wins), callout before comment so each kind has a stable slot.
 */
export function orderCalloutBadgeStates(states: CalloutBadgeState[]): CalloutBadgeState[] {
  const byKind = new Map<CalloutBadgeKind, CalloutBadgeState>()
  for (const state of states) byKind.set(state.kind, { ...state })
  return BADGE_KIND_ORDER.flatMap((kind) => {
    const state = byKind.get(kind)
    return state ? [state] : []
  })
}

/**
 * Global-coordinate hit test for a host's markers, shared by every host so
 * the geometry lives in exactly one place. Converts the global
 * (canvas-relative screen) point into the HOST's local space — the space
 * `badge.x`/`badge.y` are expressed in — and compares against
 * `CALLOUT_BADGE_HIT_RADIUS`. The radius is intentionally independent of the
 * hover scale so the hit region does not flicker while hovered.
 */
export function calloutBadgeContainsGlobalPoint(
  host: Container,
  badge: Container | null,
  globalX: number,
  globalY: number,
): boolean {
  if (!badge) return false
  const local = host.toLocal({ x: globalX, y: globalY })
  const dx = local.x - badge.x
  const dy = local.y - badge.y
  return dx * dx + dy * dy <= CALLOUT_BADGE_HIT_RADIUS * CALLOUT_BADGE_HIT_RADIUS
}

/** The first slot whose hit circle contains the global point, if any. */
export function calloutBadgeSlotAtGlobalPoint(
  host: Container,
  slots: readonly CalloutBadgeSlot[],
  globalX: number,
  globalY: number,
): CalloutBadgeSlot | null {
  for (const slot of slots) {
    if (calloutBadgeContainsGlobalPoint(host, slot.badge, globalX, globalY)) {
      return slot
    }
  }
  return null
}

/**
 * Each slot's centre in global (canvas-relative screen) coordinates — the
 * point a pointer event must land on to hit it. The inverse of
 * `calloutBadgeContainsGlobalPoint`, and the position to anchor a DOM
 * surface (a hover chip, an opening panel) to a marker.
 */
export function calloutBadgeGlobalPoints(
  host: Container,
  slots: readonly CalloutBadgeSlot[],
): { kind: CalloutBadgeKind; x: number; y: number }[] {
  return slots.map((slot) => {
    const global = host.toGlobal({ x: slot.badge.x, y: slot.badge.y })
    return { kind: slot.state.kind, x: global.x, y: global.y }
  })
}

/**
 * Host-side hover routing for the markers: tracks pointer movement over the
 * host, applies the hover scale while the pointer is inside a marker's hit
 * circle, and fires enter/leave callbacks exactly once per transition —
 * including moving directly between the two markers, the "left the marker
 * but still on the host" case (`pointermove`), and the "left the host
 * entirely" case (`pointerout`). Callbacks receive the marker kind so hosts
 * can emit kind-discriminated events.
 */
export function wireCalloutBadgeHoverRouting(
  host: Container,
  accessors: {
    getSlots: () => readonly CalloutBadgeSlot[]
    hitTest: (globalX: number, globalY: number) => CalloutBadgeKind | null
    onHover: (kind: CalloutBadgeKind, originalEvent?: Event) => void
    onHoverEnd: (kind: CalloutBadgeKind, originalEvent?: Event) => void
  },
): void {
  let hoveredKind: CalloutBadgeKind | null = null
  const track = (event: FederatedPointerEvent) => {
    const slots = accessors.getSlots()
    const nowKind = slots.length > 0
      ? accessors.hitTest(event.global.x, event.global.y)
      : null
    // Re-assert the scale even when the state did not change: markers are
    // destroyed and rebuilt on relayout/theme ticks, which resets scales.
    for (const slot of slots) {
      slot.badge.scale.set(slot.state.kind === nowKind ? CALLOUT_BADGE_HOVER_SCALE : 1)
    }
    if (nowKind === hoveredKind) return
    const previous = hoveredKind
    hoveredKind = nowKind
    if (previous !== null) accessors.onHoverEnd(previous, event.nativeEvent as Event | undefined)
    if (nowKind !== null) accessors.onHover(nowKind, event.nativeEvent as Event | undefined)
  }
  host.on('pointerover', track)
  host.on('pointermove', track)
  host.on('pointerout', (event: FederatedPointerEvent) => {
    if (hoveredKind === null) return
    const previous = hoveredKind
    hoveredKind = null
    for (const slot of accessors.getSlots()) slot.badge.scale.set(1)
    accessors.onHoverEnd(previous, event?.nativeEvent as Event | undefined)
  })
}

/**
 * Node marker position in the sprite's local space: top-right corner of the
 * rendered shape, shifted left when the link badge already sits there, and
 * again per occupied marker slot so a callout badge and a comment pin on the
 * same node sit side by side.
 */
export function computeNodeCalloutBadgePosition(
  displayWidth: number,
  displayHeight: number,
  hasLinkBadge: boolean,
  slotIndex = 0,
): { x: number; y: number } {
  return {
    x: displayWidth / 2 - CALLOUT_BADGE_CORNER_INSET
      - (hasLinkBadge ? CALLOUT_BADGE_LINK_CLEARANCE : 0)
      - CALLOUT_BADGE_LINK_CLEARANCE * slotIndex,
    y: -displayHeight / 2 + CALLOUT_BADGE_CORNER_INSET,
  }
}

/**
 * Subgraph marker position in the container's local space: in the header
 * band at the top-right, to the left of the node-count pill when one is
 * shown (`countPillWidth` 0 means no pill), shifted further left per
 * occupied marker slot.
 */
export function computeSubgraphCalloutBadgePosition(
  width: number,
  height: number,
  countPillWidth: number,
  slotIndex = 0,
): { x: number; y: number } {
  const pillClearance = countPillWidth > 0 ? countPillWidth + 8 : 0
  return {
    x: width / 2 - 10 - pillClearance - CALLOUT_BADGE_RADIUS
      - CALLOUT_BADGE_LINK_CLEARANCE * slotIndex,
    y: -height / 2 + 15,
  }
}

/**
 * Edge marker position in the graphic's local space: lifted off the
 * midpoint, with additional slots stepping right along the lifted line.
 */
export function computeEdgeCalloutBadgePosition(
  anchorPoint: { x: number; y: number },
  slotIndex = 0,
): { x: number; y: number } {
  return {
    x: anchorPoint.x + CALLOUT_BADGE_LINK_CLEARANCE * slotIndex,
    y: anchorPoint.y - CALLOUT_BADGE_EDGE_LIFT,
  }
}

/**
 * Build one marker display object. Children are drawn around the local
 * origin so hover enlargement is a plain scale around the marker centre; the
 * caller positions the returned container in its own local space and owns
 * adding it as a child.
 *
 * The marker is deliberately NOT interactive: pointer events always target
 * the host, whose handlers consult `getCalloutBadgeAt` (see the module doc).
 * `eventMode: 'none'` guarantees the marker never intercepts the host's hit
 * test in any environment.
 */
export function buildCalloutBadge(options: {
  accent: number
  surface: number
  count?: number
  fontName?: string
}): Container {
  const badge = new Container()
  badge.eventMode = 'none'

  const gfx = new Graphics()
  gfx.circle(0, 0, CALLOUT_BADGE_RADIUS)
  gfx.fill({ color: options.accent, alpha: 0.92 })
  gfx.circle(0, 0, CALLOUT_BADGE_RADIUS)
  gfx.stroke({ width: 1.2, color: options.surface, alpha: 0.85 })
  badge.addChild(gfx)

  if (typeof options.count === 'number' && options.count > 1) {
    const label = new BitmapText({
      text: options.count > 9 ? '9+' : String(options.count),
      style: {
        fontFamily: options.fontName ?? 'MermaidLabel',
        fontSize: 9,
        fill: options.surface,
      },
    })
    label.anchor.set(0.5)
    badge.addChild(label)
  } else {
    // Comment glyph: three dots, like a speech bubble's ellipsis.
    for (const dx of [-3.4, 0, 3.4]) {
      gfx.circle(dx, 0, 1.05)
    }
    gfx.fill({ color: options.surface, alpha: 1 })
  }

  return badge
}

/**
 * Rebuild a host's marker slots from a pushed state list: destroys the
 * previous slot badges, orders/dedupes the states, and builds + positions
 * one badge per kind. The host supplies its geometry through `positionFor`
 * and owns parenting via `addChild` (so it can control z-order).
 */
export function rebuildCalloutBadgeSlots(
  previous: readonly CalloutBadgeSlot[],
  states: CalloutBadgeState[],
  options: {
    accents: { accent: number; commentAccent: number }
    surface: number
    fontName?: string
    positionFor: (slotIndex: number) => { x: number; y: number }
    addChild: (badge: Container) => void
  },
): CalloutBadgeSlot[] {
  for (const slot of previous) {
    slot.badge.removeFromParent()
    slot.badge.destroy({ children: true })
  }
  return orderCalloutBadgeStates(states).map((state, slotIndex) => {
    const badge = buildCalloutBadge({
      accent: calloutBadgeAccent(state.kind, options.accents),
      surface: options.surface,
      ...(state.count !== undefined ? { count: state.count } : {}),
      ...(options.fontName !== undefined ? { fontName: options.fontName } : {}),
    })
    const position = options.positionFor(slotIndex)
    badge.x = position.x
    badge.y = position.y
    options.addChild(badge)
    return { state, badge }
  })
}
