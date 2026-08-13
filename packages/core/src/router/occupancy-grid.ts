import { GRID_SIZE, COMPONENT_CLEARANCE, GRID_PADDING, type GridCell } from './types'
import { estimateRenderedNodeFootprint } from '../node-footprint'

export class OccupancyGrid {
  private _cells: Uint8Array
  private _cols: number
  private _rows: number
  private _originX: number
  private _originY: number
  private _g: number

  constructor(minX: number, minY: number, maxX: number, maxY: number, gridSize: number = GRID_SIZE) {
    this._g = gridSize
    const pad = GRID_PADDING * gridSize
    this._originX = Math.floor((minX - pad) / gridSize) * gridSize
    this._originY = Math.floor((minY - pad) / gridSize) * gridSize
    const endX = Math.ceil((maxX + pad) / gridSize) * gridSize
    const endY = Math.ceil((maxY + pad) / gridSize) * gridSize
    this._cols = Math.round((endX - this._originX) / gridSize) + 1
    this._rows = Math.round((endY - this._originY) / gridSize) + 1
    this._cells = new Uint8Array(this._cols * this._rows) // 0 = free, 1 = occupied
  }

  get width(): number { return this._cols }
  get height(): number { return this._rows }

  worldToCell(x: number, y: number): GridCell {
    return {
      gx: Math.round((x - this._originX) / this._g),
      gy: Math.round((y - this._originY) / this._g),
    }
  }

  cellToWorld(gx: number, gy: number): { x: number; y: number } {
    return {
      x: this._originX + gx * this._g,
      y: this._originY + gy * this._g,
    }
  }

  private _inBounds(gx: number, gy: number): boolean {
    return gx >= 0 && gx < this._cols && gy >= 0 && gy < this._rows
  }

  isFreeCell(gx: number, gy: number): boolean {
    if (!this._inBounds(gx, gy)) return false
    return this._cells[gy * this._cols + gx] === 0
  }

  cellPenalty(gx: number, gy: number): number {
    if (!this._inBounds(gx, gy)) return Infinity
    if (!this.isFreeCell(gx, gy)) return Infinity

    let penalty = 0
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dy === 0) continue
        const nx = gx + dx
        const ny = gy + dy
        if (!this._inBounds(nx, ny)) continue
        if (this._cells[ny * this._cols + nx] === 0) continue

        const distance = Math.max(Math.abs(dx), Math.abs(dy))
        penalty = Math.max(penalty, distance === 1 ? 6 : 2)
      }
    }

    return penalty
  }

  isFree(worldX: number, worldY: number): boolean {
    const c = this.worldToCell(worldX, worldY)
    return this.isFreeCell(c.gx, c.gy)
  }

  private _markCell(gx: number, gy: number): void {
    if (this._inBounds(gx, gy)) {
      this._cells[gy * this._cols + gx] = 1
    }
  }

  markNode(node: { x: number; y: number; width: number; height: number; label?: string }, monospace: boolean = false): void {
    const footprint = node.label
      ? estimateRenderedNodeFootprint({
        label: node.label,
        width: node.width,
        height: node.height,
      }, monospace)
      : { width: node.width, height: node.height }
    const hw = footprint.width / 2 + COMPONENT_CLEARANCE
    const hh = footprint.height / 2 + COMPONENT_CLEARANCE
    const min = this.worldToCell(node.x - hw, node.y - hh)
    const max = this.worldToCell(node.x + hw, node.y + hh)
    for (let gy = min.gy; gy <= max.gy; gy++) {
      for (let gx = min.gx; gx <= max.gx; gx++) {
        this._markCell(gx, gy)
      }
    }
  }

  markPath(path: GridCell[]): void {
    for (const c of path) {
      this._markCell(c.gx, c.gy)
    }
  }

  /** Clear a specific cell and return whether it was occupied. */
  clearCell(gx: number, gy: number): boolean {
    if (!this._inBounds(gx, gy)) return false
    const index = gy * this._cols + gx
    const wasOccupied = this._cells[index] === 1
    this._cells[index] = 0
    return wasOccupied
  }

  /** Restore a cell after a scoped routing operation. */
  restoreCell(gx: number, gy: number, occupied: boolean): void {
    if (this._inBounds(gx, gy)) {
      this._cells[gy * this._cols + gx] = occupied ? 1 : 0
    }
  }

  neighbors(cell: GridCell): GridCell[] {
    const result: GridCell[] = []
    const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }]
    for (const { dx, dy } of dirs) {
      const nx = cell.gx + dx
      const ny = cell.gy + dy
      if (this.isFreeCell(nx, ny)) {
        result.push({ gx: nx, gy: ny })
      }
    }
    return result
  }
}
