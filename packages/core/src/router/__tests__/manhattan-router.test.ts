import { describe, it, expect } from 'vitest'
import { OccupancyGrid } from '../occupancy-grid'
import { manhattanRoute, pathToSegments } from '../manhattan-router'
import type { GridCell } from '../types'

function shortestStepCount(grid: OccupancyGrid, src: GridCell, tgt: GridCell): number | null {
  const key = (cell: GridCell) => `${cell.gx},${cell.gy}`
  const queue: Array<GridCell & { distance: number }> = [{ ...src, distance: 0 }]
  const seen = new Set([key(src)])
  const dirs = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ]

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]
    if (current.gx === tgt.gx && current.gy === tgt.gy) return current.distance

    for (const { dx, dy } of dirs) {
      const next = { gx: current.gx + dx, gy: current.gy + dy }
      const nextKey = key(next)
      const isTarget = next.gx === tgt.gx && next.gy === tgt.gy
      if (seen.has(nextKey) || (!isTarget && !grid.isFreeCell(next.gx, next.gy))) continue
      seen.add(nextKey)
      queue.push({ ...next, distance: current.distance + 1 })
    }
  }

  return null
}

describe('manhattanRoute', () => {
  it('finds straight vertical path', () => {
    const grid = new OccupancyGrid(0, 0, 200, 200, 20)
    const path = manhattanRoute(grid, { gx: 5, gy: 2 }, { gx: 5, gy: 8 })
    expect(path).not.toBeNull()
    expect(path![0]).toEqual({ gx: 5, gy: 2 })
    expect(path![path!.length - 1]).toEqual({ gx: 5, gy: 8 })
    // All cells should have same gx (straight vertical)
    for (const c of path!) expect(c.gx).toBe(5)
  })

  it('routes around an obstacle', () => {
    const grid = new OccupancyGrid(0, 0, 200, 200, 20)
    // Block a node in the middle
    grid.markNode({ x: 100, y: 100, width: 40, height: 40 })
    const src = grid.worldToCell(100, 40)
    const tgt = grid.worldToCell(100, 160)
    const path = manhattanRoute(grid, src, tgt)
    expect(path).not.toBeNull()
    expect(path!.length).toBeGreaterThan(7) // must detour around obstacle
  })

  it('returns null when no path exists', () => {
    const grid = new OccupancyGrid(0, 0, 100, 100, 20)
    // Wall off target completely — must span the FULL grid width (including padding)
    for (let gx = 0; gx < grid.width; gx++) {
      const gy = grid.worldToCell(0, 60).gy
      grid.markPath([{ gx, gy }])
    }
    const path = manhattanRoute(grid, grid.worldToCell(40, 20), grid.worldToCell(40, 80))
    expect(path).toBeNull()
  })

  it('prefers fewer bends (bend penalty)', () => {
    const grid = new OccupancyGrid(0, 0, 200, 200, 20)
    const path = manhattanRoute(grid, { gx: 2, gy: 2 }, { gx: 8, gy: 8 })
    expect(path).not.toBeNull()
    // Count bends: should be exactly 1 (L-shape, not zigzag)
    let bends = 0
    for (let i = 1; i < path!.length - 1; i++) {
      const prev = path![i - 1], curr = path![i], next = path![i + 1]
      const dirIn = curr.gx === prev.gx ? 'V' : 'H'
      const dirOut = next.gx === curr.gx ? 'V' : 'H'
      if (dirIn !== dirOut) bends++
    }
    expect(bends).toBeLessThanOrEqual(2) // at most 2 bends for a diagonal target
  })

  it('prefers the clearer shortest corridor when alternatives have equal length', () => {
    const grid = new OccupancyGrid(0, 0, 220, 160, 20)
    grid.markPath([
      { gx: 5, gy: 3 },
      { gx: 5, gy: 4 },
      { gx: 5, gy: 5 },
      { gx: 4, gy: 1 },
      { gx: 5, gy: 1 },
      { gx: 6, gy: 1 },
    ])

    const path = manhattanRoute(grid, { gx: 2, gy: 4 }, { gx: 8, gy: 4 })

    expect(path).not.toBeNull()
    expect(path!.some((cell) => cell.gy <= 2)).toBe(false)
    expect(path!.some((cell) => cell.gy >= 6)).toBe(true)
  })

  it('uses the shortest unobstructed Manhattan path before a longer lower-bend detour', () => {
    const grid = new OccupancyGrid(0, 0, 120, 120, 20)
    const src = { gx: 0, gy: 3 }
    const tgt = { gx: 6, gy: 3 }
    grid.markPath([
      { gx: 0, gy: 1 },
      { gx: 1, gy: 0 },
      { gx: 1, gy: 3 },
      { gx: 2, gy: 0 },
      { gx: 2, gy: 2 },
      { gx: 2, gy: 3 },
      { gx: 2, gy: 4 },
      { gx: 2, gy: 5 },
      { gx: 4, gy: 0 },
      { gx: 5, gy: 1 },
      { gx: 6, gy: 0 },
      { gx: 6, gy: 6 },
    ])

    const shortest = shortestStepCount(grid, src, tgt)
    const path = manhattanRoute(grid, src, tgt)

    expect(shortest, 'fixture should have a 10-step unobstructed Manhattan route').toBe(10)
    expect(path).not.toBeNull()
    expect(path!.length - 1).toBe(shortest)
  })
})

describe('pathToSegments', () => {
  it('converts straight path to one segment', () => {
    const grid = new OccupancyGrid(0, 0, 200, 200, 20)
    const path = [{ gx: 5, gy: 2 }, { gx: 5, gy: 3 }, { gx: 5, gy: 4 }, { gx: 5, gy: 5 }]
    const segs = pathToSegments(path, grid, 'e1')
    expect(segs).toHaveLength(1)
    expect(segs[0].isHorizontal).toBe(false)
    expect(segs[0].edgeId).toBe('e1')
  })

  it('converts L-shaped path to two segments', () => {
    const grid = new OccupancyGrid(0, 0, 200, 200, 20)
    const path = [
      { gx: 2, gy: 2 }, { gx: 2, gy: 3 }, { gx: 2, gy: 4 },
      { gx: 3, gy: 4 }, { gx: 4, gy: 4 },
    ]
    const segs = pathToSegments(path, grid, 'e1')
    expect(segs).toHaveLength(2)
    expect(segs[0].isHorizontal).toBe(false) // vertical
    expect(segs[1].isHorizontal).toBe(true)  // horizontal
  })
})
