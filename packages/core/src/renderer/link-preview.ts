import { Container, Graphics, BitmapText } from 'pixi.js'
import type { Application } from 'pixi.js'
import type { LayoutDirective, RenderGraph } from '../types'
import { createLayoutEngine } from './load-pipeline'
import { ensureFontsInstalled } from './fonts'
import { getTheme, type Theme } from './theme'

const PREVIEW_WIDTH = 420
const PREVIEW_HEIGHT = 280
const PADDING = 16
const MAX_CACHE_SIZE = 12

/**
 * Wiki-style hover preview rendered INSIDE the main PixiJS app.
 * Uses a Container overlay — no second WebGL context needed.
 */
export class LinkPreview {
  private _container: Container
  private _bg: Graphics
  private _content: Container
  private _titleText: BitmapText
  private _visible = false
  private _hoverTimer: ReturnType<typeof setTimeout> | null = null
  private _hideTimer: ReturnType<typeof setTimeout> | null = null
  private _cache = new Map<string, RenderGraph>()
  private _requestId = 0
  private _destroyed = false
  private _currentTargetFile: string | null = null
  private _currentPhilosophy: string | null = null
  private _currentNodeLabels: string[] = []
  private _currentNodeFontFamilies: string[] = []
  private _currentTitleFontFamily: string | null = null
  private _pointerX: number | null = null
  private _pointerY: number | null = null

  constructor(private _app: Application) {
    this._container = new Container()
    this._container.visible = false
    this._container.eventMode = 'static'
    this._container.cursor = 'default'
    this._container.hitArea = {
      contains: (x: number, y: number) =>
        x >= 0 && x <= PREVIEW_WIDTH && y >= 0 && y <= PREVIEW_HEIGHT,
    }

    // Background card
    this._bg = new Graphics()
    this._container.addChild(this._bg)

    // Title
    ensureFontsInstalled()
    this._titleText = new BitmapText({
      text: '',
      style: { fontFamily: 'MermaidLabel', fontSize: 11, fill: getTheme('narrative').subgraphLabel },
    })
    this._titleText.x = PADDING
    this._titleText.y = PADDING
    this._container.addChild(this._titleText)

    // Content container for the mini diagram
    this._content = new Container()
    this._content.y = PADDING + 20 // below title
    this._content.x = PADDING
    this._container.addChild(this._content)

    // Add to stage on top of everything
    this._app.stage.addChild(this._container)
  }

  cacheGraph(targetFile: string, graph: RenderGraph): void {
    this._cache.delete(targetFile)
    this._cache.set(targetFile, graph)
    while (this._cache.size > MAX_CACHE_SIZE) {
      const oldestKey = this._cache.keys().next().value
      if (!oldestKey) break
      this._cache.delete(oldestKey)
    }
  }

  invalidate(targetFile?: string): void {
    if (targetFile) {
      this._cache.delete(targetFile)
      return
    }
    this._cache.clear()
  }

  scheduleShow(
    getAnchor: () => { x: number; y: number } | null,
    targetFile: string,
    resolveGraph: () => Promise<RenderGraph | null>,
  ): void {
    this.cancelSchedule()
    this._cancelHide()
    const requestId = ++this._requestId
    this._hoverTimer = setTimeout(async () => {
      let graph = this._getCachedGraph(targetFile)
      if (!graph) {
        graph = await resolveGraph() ?? undefined
        if (graph) this.cacheGraph(targetFile, graph)
      }
      if (this._destroyed || requestId !== this._requestId || !graph) return

      const anchor = getAnchor()
      if (!anchor) return

      this._show(anchor.x, anchor.y, targetFile, graph)
    }, 300)
  }

  cancelSchedule(): void {
    this._requestId += 1
    if (this._hoverTimer) {
      clearTimeout(this._hoverTimer)
      this._hoverTimer = null
    }
  }

  requestHide(delayMs = 90): void {
    this.cancelSchedule()
    if (!this._visible) return
    this._cancelHide()
    this._hideTimer = setTimeout(() => {
      this._hideTimer = null
      if (this._pointerWithinPreview()) return
      this.hide()
    }, delayMs)
  }

  setPointerPosition(x: number, y: number): void {
    const wasInside = this._pointerWithinPreview()
    this._pointerX = x
    this._pointerY = y
    const isInside = this._pointerWithinPreview()
    if (isInside) {
      this._cancelHide()
    } else if (wasInside && this._visible) {
      this.requestHide()
    }
  }

  hide(): void {
    this.cancelSchedule()
    this._cancelHide()
    if (!this._visible) return
    this._visible = false
    this._container.visible = false
    this._currentTargetFile = null
    this._currentPhilosophy = null
    this._currentNodeLabels = []
    this._currentNodeFontFamilies = []
    this._currentTitleFontFamily = null
  }

  destroy(): void {
    this._destroyed = true
    this.hide()
    this.invalidate()
    this._container.destroy({ children: true })
  }

  getDebugState(): {
    visible: boolean
    targetFile: string | null
    bounds: { x: number; y: number; width: number; height: number } | null
    popupHovered: boolean
    stageLayerIndex: number | null
    philosophy: string | null
    nodeLabels: string[]
    nodeFontFamilies: string[]
    titleFontFamily: string | null
    cacheSize: number
    cachedTargets: string[]
  } {
    return {
      visible: this._visible,
      targetFile: this._currentTargetFile,
      bounds: this._visible
        ? {
            x: this._container.x,
            y: this._container.y,
            width: PREVIEW_WIDTH,
            height: PREVIEW_HEIGHT,
          }
        : null,
      popupHovered: this._pointerWithinPreview(),
      stageLayerIndex: this._container.parent ? this._container.parent.getChildIndex(this._container) : null,
      philosophy: this._currentPhilosophy,
      nodeLabels: [...this._currentNodeLabels],
      nodeFontFamilies: [...this._currentNodeFontFamilies],
      titleFontFamily: this._currentTitleFontFamily,
      cacheSize: this._cache.size,
      cachedTargets: Array.from(this._cache.keys()),
    }
  }

  touchCachedTarget(targetFile: string): boolean {
    return Boolean(this._getCachedGraph(targetFile))
  }

  private _show(
    screenX: number,
    screenY: number,
    targetFile: string,
    graph: RenderGraph,
  ): void {
    const layoutDirective = graph.directives.find(
      (directive): directive is LayoutDirective => directive.type === 'layout',
    )
    const philosophy = layoutDirective?.philosophy ?? 'narrative'
    const theme = getTheme(philosophy)
    const titleFontFamily = philosophy === 'blueprint' ? 'MermaidBlueprint' : 'MermaidLabel'

    this._visible = true
    this._container.visible = true
    this._currentTargetFile = targetFile
    this._currentPhilosophy = philosophy
    this._currentNodeLabels = Array.from(graph.nodes.values()).slice(0, 8).map((node) => node.label)
    this._currentNodeFontFamilies = []
    this._currentTitleFontFamily = titleFontFamily

    // Position in screen space (stage coordinates, not world)
    // The container is added to stage directly, so position = screen pixels
    const canvasW = this._app.screen.width
    const canvasH = this._app.screen.height

    let x = screenX + 20
    let y = screenY - 20
    if (x + PREVIEW_WIDTH > canvasW - 20) x = screenX - PREVIEW_WIDTH - 20
    if (y + PREVIEW_HEIGHT > canvasH - 20) y = canvasH - PREVIEW_HEIGHT - 20
    x = Math.max(20, Math.min(x, canvasW - PREVIEW_WIDTH - 20))
    y = Math.max(20, Math.min(y, canvasH - PREVIEW_HEIGHT - 20))

    this._container.x = x
    this._container.y = y

    // Draw background card
    this._bg.clear()
    this._bg.roundRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT, 10)
    this._bg.fill({ color: theme.nodeFill, alpha: 0.95 })
    this._bg.stroke({ width: 1, color: theme.nodeStroke })

    // Title
    this._titleText.text = targetFile.replace(/^\//, '')
    this._titleText.style.fontFamily = titleFontFamily
    this._titleText.style.fill = theme.subgraphLabel

    // Clear previous content
    this._content.removeChildren()

    // Render mini diagram
    this._renderMini(graph, theme, philosophy)
  }

  private _cancelHide(): void {
    if (this._hideTimer) {
      clearTimeout(this._hideTimer)
      this._hideTimer = null
    }
  }

  private _pointerWithinPreview(): boolean {
    if (!this._visible || this._pointerX === null || this._pointerY === null) return false
    return (
      this._pointerX >= this._container.x
      && this._pointerX <= this._container.x + PREVIEW_WIDTH
      && this._pointerY >= this._container.y
      && this._pointerY <= this._container.y + PREVIEW_HEIGHT
    )
  }

  private _getCachedGraph(targetFile: string): RenderGraph | undefined {
    const graph = this._cache.get(targetFile)
    if (!graph) return undefined
    this._cache.delete(targetFile)
    this._cache.set(targetFile, graph)
    return graph
  }

  private _renderMini(graph: RenderGraph, theme: Theme, philosophy: string): void {
    const layout = createLayoutEngine(philosophy, graph)
    const positioned = layout.compute(graph)
    const fontName = philosophy === 'blueprint' ? 'MermaidBlueprint' : 'MermaidNode'

    if (positioned.nodes.size === 0) return

    // Scale to fit inside the content area
    const contentW = PREVIEW_WIDTH - PADDING * 2
    const contentH = PREVIEW_HEIGHT - PADDING * 2 - 20 // minus title
    const scaleX = contentW / (positioned.width || 1)
    const scaleY = contentH / (positioned.height || 1)
    const scale = Math.min(scaleX, scaleY, 1.5)

    const root = new Container()
    root.scale.set(scale)
    // Center the diagram in the content area
    root.x = (contentW - positioned.width * scale) / 2
    root.y = (contentH - positioned.height * scale) / 2
    this._content.addChild(root)

    // Mini subgraphs
    for (const [, sg] of positioned.subgraphs) {
      const g = new Graphics()
      g.roundRect(sg.x - sg.width / 2, sg.y - sg.height / 2, sg.width, sg.height, 4)
      g.fill({ color: theme.subgraphFill, alpha: theme.subgraphFillAlpha })
      g.stroke({ width: 0.5, color: theme.subgraphStroke, alpha: 0.4 })
      root.addChild(g)
    }

    // Mini edges
    for (const edge of positioned.edges) {
      const g = new Graphics()
      if (edge.points.length >= 2) {
        g.moveTo(edge.points[0].x, edge.points[0].y)
        for (let i = 1; i < edge.points.length; i++) {
          g.lineTo(edge.points[i].x, edge.points[i].y)
        }
        g.stroke({ width: 0.8, color: theme.edgeColor, alpha: 0.5 })
      }
      root.addChild(g)
    }

    // Mini nodes
    ensureFontsInstalled()
    for (const [, node] of positioned.nodes) {
      const g = new Graphics()
      g.roundRect(node.x - node.width / 2, node.y - node.height / 2, node.width, node.height, 3)
      g.fill({ color: theme.nodeFill })
      g.stroke({ width: 0.8, color: theme.nodeStroke })
      root.addChild(g)

      if (scale > 0.3) {
        const label = new BitmapText({
          text: node.label.length > 18 ? node.label.slice(0, 16) + '..' : node.label,
          style: { fontFamily: fontName, fontSize: 7, fill: theme.nodeText },
        })
        label.anchor.set(0.5)
        label.x = node.x
        label.y = node.y
        root.addChild(label)
        this._currentNodeFontFamilies.push(fontName)
      }
    }
  }
}
