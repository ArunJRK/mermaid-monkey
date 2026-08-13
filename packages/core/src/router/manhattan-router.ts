import type { GridCell, WireSegment } from './types'
import { BEND_PENALTY } from './types'
import type { OccupancyGrid } from './occupancy-grid'

interface AStarNode {
  gx: number
  gy: number
  steps: number     // primary cost: path length in grid steps
  penalty: number   // secondary cost: bends + clearance
  f: number         // steps + h
  parent: AStarNode | null
  dir: number       // 0=none, 1=up, 2=down, 3=left, 4=right
}

interface BestCellCost {
  steps: number
  penalty: number
}

const DIRS = [
  { dx: 0, dy: -1, dir: 1 },  // up
  { dx: 0, dy: 1, dir: 2 },   // down
  { dx: -1, dy: 0, dir: 3 },  // left
  { dx: 1, dy: 0, dir: 4 },   // right
]

function manhattan(a: GridCell, b: GridCell): number {
  return Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy)
}

/**
 * A* pathfinding on the occupancy grid with bend penalty.
 * Returns cell path from src to tgt, or null if unreachable.
 */
export function manhattanRoute(
  grid: OccupancyGrid,
  src: GridCell,
  tgt: GridCell,
  bendPenalty: number = BEND_PENALTY,
): GridCell[] | null {
  const key = (gx: number, gy: number) => `${gx},${gy}`

  const open: AStarNode[] = [{
    gx: src.gx, gy: src.gy, steps: 0, penalty: 0, f: manhattan(src, tgt), parent: null, dir: 0,
  }]
  const closed = new Map<string, BestCellCost>() // key -> best lexicographic cost

  while (open.length > 0) {
    // Find node with lowest primary f; use readability costs only as tie-breakers.
    let bestIdx = 0
    for (let i = 1; i < open.length; i++) {
      if (
        open[i].f < open[bestIdx].f ||
        (open[i].f === open[bestIdx].f && open[i].penalty < open[bestIdx].penalty)
      ) {
        bestIdx = i
      }
    }
    const current = open[bestIdx]
    open.splice(bestIdx, 1)

    // Goal reached
    if (current.gx === tgt.gx && current.gy === tgt.gy) {
      // Reconstruct path
      const path: GridCell[] = []
      let node: AStarNode | null = current
      while (node) {
        path.push({ gx: node.gx, gy: node.gy })
        node = node.parent
      }
      return path.reverse()
    }

    const ck = key(current.gx, current.gy)
    const prevBest = closed.get(ck)
    if (
      prevBest !== undefined &&
      (prevBest.steps < current.steps ||
        (prevBest.steps === current.steps && prevBest.penalty <= current.penalty))
    ) continue
    closed.set(ck, { steps: current.steps, penalty: current.penalty })

    // Expand neighbors
    for (const { dx, dy, dir } of DIRS) {
      const nx = current.gx + dx
      const ny = current.gy + dy

      // Allow target cell even if occupied (port is inside node inflation zone)
      const isTarget = nx === tgt.gx && ny === tgt.gy
      if (!isTarget && !grid.isFreeCell(nx, ny)) continue

      const isBend = current.dir !== 0 && current.dir !== dir
      const clearancePenalty = isTarget ? 0 : grid.cellPenalty(nx, ny)
      const nsteps = current.steps + 1
      const npenalty = current.penalty + (isBend ? bendPenalty : 0) + clearancePenalty

      const nk = key(nx, ny)
      const existing = closed.get(nk)
      if (
        existing !== undefined &&
        (existing.steps < nsteps ||
          (existing.steps === nsteps && existing.penalty <= npenalty))
      ) continue

      open.push({
        gx: nx, gy: ny, steps: nsteps, penalty: npenalty,
        f: nsteps + manhattan({ gx: nx, gy: ny }, tgt),
        parent: current, dir,
      })
    }
  }

  return null // no path found — CONGESTED
}

/**
 * Convert a grid cell path to wire segments in world coordinates.
 */
export function pathToSegments(path: GridCell[], grid: OccupancyGrid, edgeId: string): WireSegment[] {
  if (path.length < 2) return []

  const segments: WireSegment[] = []
  let segStart = grid.cellToWorld(path[0].gx, path[0].gy)
  let prevDir: 'H' | 'V' = path[1].gx === path[0].gx ? 'V' : 'H'

  for (let i = 2; i < path.length; i++) {
    const dir: 'H' | 'V' = path[i].gx === path[i - 1].gx ? 'V' : 'H'
    if (dir !== prevDir) {
      // Direction changed — close current segment
      const segEnd = grid.cellToWorld(path[i - 1].gx, path[i - 1].gy)
      segments.push({
        x1: segStart.x, y1: segStart.y,
        x2: segEnd.x, y2: segEnd.y,
        isHorizontal: prevDir === 'H',
        edgeId,
      })
      segStart = segEnd
      prevDir = dir
    }
  }

  // Close final segment
  const last = grid.cellToWorld(path[path.length - 1].gx, path[path.length - 1].gy)
  segments.push({
    x1: segStart.x, y1: segStart.y,
    x2: last.x, y2: last.y,
    isHorizontal: prevDir === 'H',
    edgeId,
  })

  return segments
}
