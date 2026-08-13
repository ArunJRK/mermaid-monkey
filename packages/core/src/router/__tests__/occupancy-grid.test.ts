import { describe, it, expect } from 'vitest'
import { OccupancyGrid } from '../occupancy-grid'

describe('OccupancyGrid', () => {
  it('creates grid from bounds', () => {
    const grid = new OccupancyGrid(0, 0, 200, 200, 20)
    expect(grid.width).toBeGreaterThan(0)
    expect(grid.height).toBeGreaterThan(0)
  })

  it('marks node cells as occupied', () => {
    const grid = new OccupancyGrid(0, 0, 200, 200, 20)
    grid.markNode({ x: 100, y: 100, width: 40, height: 40 })
    // Center cell occupied
    expect(grid.isFree(100, 100)).toBe(false)
    // Cell far away is free
    expect(grid.isFree(0, 0)).toBe(true)
  })

  it('inflates nodes by Cc', () => {
    const grid = new OccupancyGrid(0, 0, 200, 200, 20)
    grid.markNode({ x: 100, y: 100, width: 40, height: 40 })
    // 8px outside node edge should still be occupied (Cc inflation)
    // Node edge at x=120 (100+40/2), inflated to x=128 -> grid cell at x=120 blocked
    expect(grid.isFree(120, 100)).toBe(false)
    // Well outside inflation
    expect(grid.isFree(160, 100)).toBe(true)
  })

  it('marks the rendered label-expanded footprint, not only the layout box', () => {
    const grid = new OccupancyGrid(0, 0, 500, 500, 20)
    grid.markNode({
      x: 200,
      y: 200,
      width: 160,
      height: 44,
      label: 'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
    } as any)

    // The layout box alone would stop around x≈288 with clearance.
    // A rendered long-label blueprint node expands wider and must still block routing here.
    expect(grid.isFree(300, 200)).toBe(false)
  })

  it('marks wire path cells as occupied', () => {
    const grid = new OccupancyGrid(0, 0, 200, 200, 20)
    grid.markPath([
      { gx: 1, gy: 1 }, { gx: 1, gy: 2 }, { gx: 1, gy: 3 },
    ])
    expect(grid.isFreeCell(1, 1)).toBe(false)
    expect(grid.isFreeCell(1, 2)).toBe(false)
    expect(grid.isFreeCell(0, 1)).toBe(true)
  })

  it('adds a soft penalty near occupied cells without blocking clear cells', () => {
    const grid = new OccupancyGrid(0, 0, 200, 200, 20)
    grid.markPath([{ gx: 5, gy: 5 }])

    expect(grid.cellPenalty(5, 5)).toBe(Infinity)
    expect(grid.cellPenalty(6, 5)).toBeGreaterThan(grid.cellPenalty(8, 5))
    expect(grid.isFreeCell(6, 5)).toBe(true)
  })

  it('converts between world coords and grid cells', () => {
    const grid = new OccupancyGrid(0, 0, 200, 200, 20)
    const cell = grid.worldToCell(100, 60)
    const world = grid.cellToWorld(cell.gx, cell.gy)
    expect(world.x).toBe(100)
    expect(world.y).toBe(60)
  })

  it('returns neighbors for a cell', () => {
    const grid = new OccupancyGrid(0, 0, 200, 200, 20)
    const neighbors = grid.neighbors({ gx: 5, gy: 5 })
    expect(neighbors).toHaveLength(4) // up, down, left, right
  })

  it('excludes occupied and out-of-bounds neighbors', () => {
    const grid = new OccupancyGrid(0, 0, 200, 200, 20)
    grid.markNode({ x: 120, y: 100, width: 40, height: 40 })
    const neighbors = grid.neighbors({ gx: 5, gy: 5 })
    // Some neighbors may be blocked by the node
    for (const n of neighbors) {
      expect(grid.isFreeCell(n.gx, n.gy)).toBe(true)
    }
  })
})
