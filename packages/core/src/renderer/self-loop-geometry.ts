import { measureTextWidth } from '../layout/text-measure'

export interface Point {
  x: number
  y: number
}

export interface SelfLoopGeometry {
  start: Point
  cp1: Point
  cp2: Point
  end: Point
  labelPosition: Point
}

const SELF_LOOP_MIN_WIDTH = 34
const SELF_LOOP_MIN_HEIGHT = 26
const SELF_LOOP_MAX_WIDTH = 220
const SELF_LOOP_LABEL_MARGIN = 12
const SELF_LOOP_LABEL_FONT_SIZE = 11

/**
 * Geometry for a self-loop edge (a state/node transitioning to itself).
 *
 * The loop always bulges out to the node's top-right. Its reach and the
 * label's placement scale with the label's measured width so that:
 *   - the label's left edge always clears the node's own boundary
 *     (a fixed small offset would truncate long labels against the node), and
 *   - the loop's outward reach is bounded (SELF_LOOP_MAX_WIDTH), so a
 *     pathologically long label can't push the loop arbitrarily far into
 *     neighboring nodes/edges.
 */
export function computeSelfLoopGeometry(
  node: Point,
  footprint: { width: number; height: number },
  label?: string,
): SelfLoopGeometry {
  const hw = footprint.width / 2
  const hh = footprint.height / 2
  const labelWidth = label ? measureTextWidth(label, SELF_LOOP_LABEL_FONT_SIZE) : 0

  const labelReach = labelWidth > 0 ? labelWidth / 2 + SELF_LOOP_LABEL_MARGIN : 0
  const loopWidth = Math.min(
    SELF_LOOP_MAX_WIDTH,
    Math.max(SELF_LOOP_MIN_WIDTH, hw * 0.9, labelReach),
  )
  const loopHeight = Math.max(SELF_LOOP_MIN_HEIGHT, hh * 0.9)

  const start = { x: node.x + hw * 0.55, y: node.y - hh * 0.25 }
  const cp1 = { x: node.x + hw + loopWidth, y: node.y - hh - loopHeight * 0.2 }
  const cp2 = { x: node.x + hw + loopWidth, y: node.y + hh + loopHeight * 0.1 }
  const end = { x: node.x + hw * 0.18, y: node.y + hh * 0.1 }

  // Guarantee the label's own left edge clears the node's right edge,
  // regardless of how the loop width above was capped.
  const labelCenterX = Math.max(
    node.x + hw + loopWidth * 0.55,
    node.x + hw + SELF_LOOP_LABEL_MARGIN + labelWidth / 2,
  )
  const labelPosition = {
    x: labelCenterX,
    y: node.y - hh - loopHeight * 0.15,
  }

  return { start, cp1, cp2, end, labelPosition }
}
