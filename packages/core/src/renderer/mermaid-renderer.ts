import { Application, BitmapText, Container, Graphics } from 'pixi.js'
import type {
  LoadResult,
  LoadOptions,
  RenderGraph,
  PositionedGraph,
  NodeEvent,
  LinkDirective,
  LayoutDirective,
  LinkState,
  RenderWarning,
  MermaidRendererOptions,
  ThemeMode,
} from '../types'
import type { FederatedPointerEvent } from 'pixi.js'
import { LoadPipeline, createLayoutEngine } from './load-pipeline'
import { EventEmitter } from './event-emitter'
import { Viewport } from './viewport'
import { NodeSprite } from './node-sprite'
import { EdgeGraphic } from './edge-graphic'
import { SubgraphContainer } from './subgraph-container'
import { FoldManager } from '../interaction/fold-manager'
import { isEditableShortcutTarget, mapKeyToAction } from '../interaction/keyboard'
import { NarrativeLayout } from '../layout/narrative-layout'
import { resolveTheme, type Theme } from './theme'
import { LinkPreview } from './link-preview'
import { WireRegistry } from './wire-registry'
import { drawWireHops } from './wire-hops'
import type { WireSegment } from './wire-crossings'
import { ensureFontsInstalled } from './fonts'
import { BlueprintWireBuilder } from '../router/blueprint-wire-builder'
import { estimateRenderedNodeFootprint } from '../node-footprint'
import { lineIntersectsRect } from '../layout/blueprint-layout'

const IDLE_TICKER_TIMEOUT_MS = 220
const RELAYOUT_MOTION_DURATION_MS = 220

type PerformanceMode = 'normal' | 'stress'

/**
 * Public API for the mermaid-render engine.
 *
 * Composes: LoadPipeline + PixiJS Application + Viewport + FoldManager + EventEmitter
 */
export class MermaidRenderer {
  private static _liveCanvases = new WeakSet<HTMLCanvasElement>()

  private _app: Application | null = null
  private _canvas: HTMLCanvasElement | null = null
  private _viewport: Viewport | null = null
  private _emitter = new EventEmitter()
  private _pipeline = new LoadPipeline()
  private _foldManager: FoldManager | null = null
  private _graph: RenderGraph | null = null
  private _positioned: PositionedGraph | null = null
  private _renderedBounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null
  private _selectedNodeId: string | null = null
  private _nodeSprites = new Map<string, NodeSprite>()
  private _edgeGraphics: EdgeGraphic[] = []
  private _subgraphContainers = new Map<string, SubgraphContainer>()
  private _currentPhilosophy: string = 'narrative'
  private _themeMode: ThemeMode
  private _themeOverrides: MermaidRendererOptions['themeOverrides']
  private _spineNodeIds: Set<string> = new Set()
  private _busGraphics = new Map<string, Graphics>() // Blueprint: source ID → bus graphic
  private _busSourceIds = new Set<string>() // sources that were merged into bus lines
  private _linkPreview: LinkPreview | null = null
  private _linkStates = new Map<string, LinkState>()
  private _messageOverlay: Container | null = null
  private _performanceMode: PerformanceMode = 'normal'
  private _hoveredNodeId: string | null = null

  // Focus navigation state
  private _focusStack: string[] = []

  // Breadcrumb callback — the consumer provides a function to update breadcrumb UI
  onBreadcrumbChange: ((segments: Array<{ id: string | null; label: string }>) => void) | null = null

  // Link preview resolver — consumer provides this to load target file graphs for hover preview
  onResolvePreview: ((targetFile: string) => Promise<RenderGraph | null>) | null = null

  // Bound handlers for cleanup
  private _keyHandler: ((e: KeyboardEvent) => void) | null = null
  private _webglContextLostHandler: ((e: Event) => void) | null = null
  private _webglContextRestoredHandler: (() => void) | null = null
  private _visibilityHandler: (() => void) | null = null
  private _pointerActivityHandler: ((event: Event) => void) | null = null
  private _resizeObserver: ResizeObserver | null = null
  private _resizeRafId: number | null = null
  private _canvasTabIndexAdded = false
  private _lastObservedCanvasSize: { width: number; height: number } | null = null
  private _colorSchemeMediaQuery: MediaQueryList | null = null
  private _colorSchemeChangeHandler: ((event: MediaQueryListEvent) => void) | null = null
  private _idleTickerTimeoutId: number | null = null
  private _runtimeActivityReasons = new Set<string>()
  private _resumeTickerOnVisible = false
  private _gpuLostGeneration = 0
  private _relayoutFadeGeneration = 0
  private _destroyed = false
  private _lastSource: string | null = null
  private _lastLoadOptions: LoadOptions | undefined

  // ── Lifecycle ────────────────────────────────────────────

  constructor(options: MermaidRendererOptions = {}) {
    this._themeMode = options.themeMode ?? 'system'
    this._themeOverrides = options.themeOverrides
  }

  /**
   * Initialise PixiJS and attach to the given canvas element.
   *
   * If destroy() is called while mount() is still awaiting GPU setup,
   * mount() aborts: it tears down whatever it had created, releases canvas
   * ownership, and resolves without mounting.
   */
  async mount(canvas: HTMLCanvasElement): Promise<void> {
    if (this._destroyed) {
      throw new Error('This MermaidRenderer instance was destroyed and cannot be mounted again. Create a new instance.')
    }
    if (this._app) {
      if (this._canvas === canvas) return
      throw new Error('This MermaidRenderer instance is already mounted on another canvas.')
    }
    if (MermaidRenderer._liveCanvases.has(canvas)) {
      throw new Error('This canvas is already owned by another MermaidRenderer instance.')
    }

    this._canvas = canvas
    MermaidRenderer._liveCanvases.add(canvas)

    // Prefer WebGPU only if an adapter is actually available, otherwise fall back to WebGL.
    let preferWebGPU = false
    if (typeof navigator !== 'undefined' && 'gpu' in navigator && navigator.gpu?.requestAdapter) {
      try {
        preferWebGPU = Boolean(await navigator.gpu.requestAdapter())
      } catch {
        preferWebGPU = false
      }
    }

    // destroy() may have been called while awaiting the adapter probe.
    if (this._destroyed) {
      await this._abortInFlightMount(canvas, null)
      return
    }

    const app = new Application()
    try {
      await app.init({
        canvas,
        background: this._getActiveTheme().background,
        resizeTo: canvas.parentElement ?? undefined,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio ?? 1,
        preference: preferWebGPU ? 'webgpu' : 'webgl',
      })
    } catch (error) {
      MermaidRenderer._liveCanvases.delete(canvas)
      if (this._destroyed) {
        this._canvas = null
        return
      }
      this._canvas = canvas
      const message = `Rendering unavailable: ${
        error instanceof Error ? error.message : String(error)
      }`
      this._drawUnavailableState(message)
      throw new Error(message)
    }

    // destroy() may have been called while the GPU context was initialising.
    if (this._destroyed) {
      await this._abortInFlightMount(canvas, app)
      return
    }

    this._app = app
    this._wireColorSchemeUpdates()
    this._wireResizeHandling(canvas)

    // Log which renderer backend is active
    const rendererType = app.renderer.type === 0x1 ? 'WebGL' : app.renderer.type === 0x2 ? 'WebGPU' : 'Unknown'
    console.log(`[mermaid-render] GPU backend: ${rendererType}`)
    this._wireRuntimeLifecycle(app, canvas, rendererType)

    // Create viewport as root container
    const viewport = new Viewport()
    viewport.attach(canvas)
    viewport.attachTicker(app.ticker)
    app.stage.addChild(viewport)
    this._viewport = viewport

    // Wire zoom change for semantic zoom
    viewport.onZoomChange = (zoom: number) => {
      this._updateDetailLevel(zoom)
    }
    viewport.onActivity = () => {
      this._touchRuntimeActivity()
    }
    viewport.onPanStateChange = (active: boolean) => {
      this._setRuntimeActivity('viewport-pan', active)
    }
    viewport.onAnimationStateChange = (active: boolean) => {
      this._setRuntimeActivity('viewport-animation', active)
    }

    // Wire up background pan: pointerdown on stage that doesn't hit a node
    app.stage.eventMode = 'static'
    app.stage.hitArea = app.screen
    app.stage.on('pointerdown', (e: FederatedPointerEvent) => {
      // Only start pan if the target is the stage itself (empty space)
      if (e.target === app.stage) {
        viewport.startPan(e.clientX, e.clientY)
      }
    })
    app.stage.on('pointertap', (e: FederatedPointerEvent) => {
      if (e.target === app.stage) {
        this.selectNode(null)
      }
    })

    // Keyboard shortcuts — scoped to the canvas (not the window) so embedding
    // hosts such as rich-text editors keep their own keystrokes. The canvas is
    // made focusable so it can receive keydown once the user interacts with it.
    if (!canvas.hasAttribute('tabindex')) {
      canvas.tabIndex = 0
      this._canvasTabIndexAdded = true
    }
    this._keyHandler = (e: KeyboardEvent) => {
      // Don't intercept typing in form controls or contenteditable hosts
      if (isEditableShortcutTarget(e.target)) return

      const action = mapKeyToAction(e.key)
      if (action === 'fitToView') this.fitToView()
      else if (action === 'resetView') this.resetView()
      else if (action === 'focusOut') this.focusOut()
    }
    canvas.addEventListener('keydown', this._keyHandler)

    // Link preview popup — rendered inside the same PixiJS app (no second WebGL context)
    this._linkPreview = new LinkPreview(app)
    this._touchRuntimeActivity()
  }

  /**
   * Tear everything down.
   */
  destroy(): void {
    this._destroyed = true
    this._gpuLostGeneration += 1
    this._relayoutFadeGeneration += 1

    // Keyboard
    if (this._keyHandler) {
      this._canvas?.removeEventListener('keydown', this._keyHandler)
      this._keyHandler = null
    }
    if (this._canvas && this._canvasTabIndexAdded) {
      this._canvas.removeAttribute('tabindex')
    }
    this._canvasTabIndexAdded = false
    if (this._webglContextLostHandler && this._canvas) {
      this._canvas.removeEventListener('webglcontextlost', this._webglContextLostHandler)
      this._webglContextLostHandler = null
    }
    if (this._webglContextRestoredHandler && this._canvas) {
      this._canvas.removeEventListener('webglcontextrestored', this._webglContextRestoredHandler)
      this._webglContextRestoredHandler = null
    }
    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler)
      this._visibilityHandler = null
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect()
      this._resizeObserver = null
    }
    if (this._resizeRafId !== null) {
      cancelAnimationFrame(this._resizeRafId)
      this._resizeRafId = null
    }
    this._lastObservedCanvasSize = null
    if (this._colorSchemeMediaQuery && this._colorSchemeChangeHandler) {
      this._colorSchemeMediaQuery.removeEventListener('change', this._colorSchemeChangeHandler)
      this._colorSchemeChangeHandler = null
      this._colorSchemeMediaQuery = null
    }
    if (this._pointerActivityHandler && this._canvas) {
      this._canvas.removeEventListener('pointermove', this._pointerActivityHandler)
      this._canvas.removeEventListener('pointerdown', this._pointerActivityHandler)
      this._canvas.removeEventListener('wheel', this._pointerActivityHandler)
      this._pointerActivityHandler = null
    }
    if (this._idleTickerTimeoutId !== null) {
      window.clearTimeout(this._idleTickerTimeoutId)
      this._idleTickerTimeoutId = null
    }

    // Viewport DOM listeners
    this._viewport?.cleanup()
    this._viewport = null

    // PixiJS
    if (this._app) {
      this._app.destroy(true, { children: true })
      this._app = null
    }

    // Layout animator

    // Link preview
    this._linkPreview?.destroy()
    this._linkPreview = null

    // Event emitter
    this._emitter.removeAll()

    if (this._canvas) MermaidRenderer._liveCanvases.delete(this._canvas)
    this._canvas = null
    this._graph = null
    this._positioned = null
    this._renderedBounds = null
    this._foldManager = null
    this._nodeSprites.clear()
    this._edgeGraphics = []
    this._subgraphContainers.clear()
    this._busGraphics.clear()
    this._busSourceIds.clear()
    this._linkStates.clear()
    this._focusStack = []
    this._runtimeActivityReasons.clear()
    this._resumeTickerOnVisible = false
  }

  // ── Loading ──────────────────────────────────────────────

  /**
   * Parse mermaid source, run layout, and render.
   */
  async load(source: string, options?: LoadOptions): Promise<LoadResult> {
    this._assertUsable('load')
    try {
      const pipelineOpts = options
        ? {
            layout: options.layout,
            sourcePath: options.sourcePath,
            linkResolver: options.linkResolver,
          }
        : undefined
      const result = await this._pipeline.load(source, pipelineOpts)
      this._lastSource = source
      this._lastLoadOptions = options

      if (!result.success || !result.graph || !result.positioned) {
        const loadResult: LoadResult = {
          success: false,
          errors: result.errors ?? [],
          warnings: result.warnings ?? [],
        }
        this._drawMessageState(
          'Diagram failed to load',
          loadResult.errors.map((error) => error.message).join('\n') || 'Unknown diagram load failure.',
        )
        for (const err of loadResult.errors) {
          this._emitter.emit('error', err)
        }
        return loadResult
      }

      this._graph = result.graph
      this._positioned = result.positioned
      this._foldManager = new FoldManager(result.graph)
      this._linkStates = result.linkStates ?? new Map()
      this._linkPreview?.invalidate()
      this._performanceMode = (result.warnings ?? []).some((warning) => warning.code === 'PERF_STRESS_THRESHOLD')
        ? 'stress'
        : 'normal'

      // Detect philosophy from directive or options
      const layoutDir = result.graph.directives.find((d) => d.type === 'layout') as LayoutDirective | undefined
      this._currentPhilosophy = (pipelineOpts?.layout ?? layoutDir?.philosophy ?? 'narrative')

      // Update background color to match theme
      if (this._app) {
        const theme = this._getActiveTheme()
        this._app.renderer.background.color = theme.background
      }
      this._clearMessageState()

      // Clear focus stack on load
      this._focusStack = []

      this._renderGraph(result.positioned)
      this._emitBreadcrumb()

      // Emit warnings
      for (const w of result.warnings ?? []) {
        this._emitter.emit('warn', w)
      }

      return {
        success: true,
        graph: result.graph,
        errors: [],
        warnings: result.warnings ?? [],
        linkStates: result.linkStates,
      }
    } catch (err: unknown) {
      const error = {
        code: 'LOAD_ERROR',
        message: err instanceof Error ? err.message : String(err),
      }
      this._emitter.emit('error', error)
      return { success: false, errors: [error], warnings: [] }
    }
  }

  /**
   * Render a pre-parsed and laid-out graph.
   */
  loadGraph(graph: RenderGraph): void {
    this._assertUsable('loadGraph')
    this._graph = graph
    this._foldManager = new FoldManager(graph)
    this._linkStates = new Map()

    const layout = createLayoutEngine(this._currentPhilosophy)
    this._positioned = layout.compute(graph)
    this._focusStack = []
    this._renderGraph(this._positioned)
    this._emitBreadcrumb()
  }

  // ── Focus Navigation ────────────────────────────────────

  /**
   * Focus on a subgraph: zoom/pan viewport to center on it,
   * dim all elements not in the subgraph.
   */
  /**
   * Focus into a subgraph: re-layout and re-render showing ONLY that
   * subgraph's nodes + their internal edges + stubs for external connections.
   */
  focusSubgraph(id: string): void {
    this._assertUsable('focusSubgraph')
    if (!this._graph) return
    const sg = this._graph.subgraphs.get(id)
    if (!sg) return

    this._focusStack.push(id)
    this._emitter.emit('focus:change', id, this._focusStack.slice())
    this._renderFocusedView()
    this._emitBreadcrumb()
  }

  /**
   * Pop the focus stack. If empty, return to full graph.
   */
  focusOut(): void {
    this._assertUsable('focusOut')
    if (this._focusStack.length === 0) return
    this._focusStack.pop()
    this._emitter.emit('focus:change', null, this._focusStack.slice())

    if (this._focusStack.length === 0) {
      // Back to root — show full graph
      if (this._positioned) {
        this._renderGraph(this._positioned)
      }
    } else {
      this._renderFocusedView()
    }
    this._emitBreadcrumb()
  }

  /**
   * Focus to a specific depth (for breadcrumb clicks).
   */
  focusTo(depth: number): void {
    this._assertUsable('focusTo')
    while (this._focusStack.length > depth) {
      this._focusStack.pop()
    }
    this._emitter.emit('focus:change', null, this._focusStack.slice())

    if (this._focusStack.length === 0) {
      if (this._positioned) this._renderGraph(this._positioned)
    } else {
      this._renderFocusedView()
    }
    this._emitBreadcrumb()
  }

  /**
   * Re-layout and render only the focused subgraph's contents.
   * External connections shown as stub nodes at the edges.
   */
  private _renderFocusedView(): void {
    if (!this._graph || !this._viewport || this._focusStack.length === 0) return

    const focusedId = this._focusStack[this._focusStack.length - 1]
    const sg = this._graph.subgraphs.get(focusedId)
    if (!sg) return

    const theme = this._getActiveTheme()
    const focusedNodeIds = new Set(sg.nodeIds)

    // Build a mini-graph with just this subgraph's nodes
    const miniNodes = new Map<string, any>()
    for (const nodeId of sg.nodeIds) {
      const node = this._graph.nodes.get(nodeId)
      if (node) miniNodes.set(nodeId, node)
    }

    // Find external connections and create stub nodes for them
    const stubNodes = new Map<string, any>()
    const allEdges: typeof this._graph.edges = []

    for (const edge of this._graph.edges) {
      const srcIn = focusedNodeIds.has(edge.source)
      const tgtIn = focusedNodeIds.has(edge.target)

      if (srcIn && tgtIn) {
        // Internal edge — keep as-is
        allEdges.push(edge)
      } else if (srcIn && !tgtIn) {
        // Outgoing edge — create stub for target
        const targetNode = this._graph.nodes.get(edge.target)
        const stubId = `_stub_${edge.target}`
        if (!stubNodes.has(stubId)) {
          stubNodes.set(stubId, {
            id: stubId,
            label: targetNode?.label ?? edge.target,
            shape: 'rectangle',
            metadata: { _isStub: true },
          })
        }
        allEdges.push({ ...edge, target: stubId })
      } else if (!srcIn && tgtIn) {
        // Incoming edge — create stub for source
        const sourceNode = this._graph.nodes.get(edge.source)
        const stubId = `_stub_${edge.source}`
        if (!stubNodes.has(stubId)) {
          stubNodes.set(stubId, {
            id: stubId,
            label: sourceNode?.label ?? edge.source,
            shape: 'rectangle',
            metadata: { _isStub: true },
          })
        }
        allEdges.push({ ...edge, source: stubId })
      }
    }

    // Merge real + stub nodes
    const combinedNodes = new Map(miniNodes)
    for (const [id, stub] of stubNodes) {
      combinedNodes.set(id, stub as any)
    }

    // Layout just this subset
    const miniGraph = {
      ...this._graph,
      nodes: combinedNodes,
      edges: allEdges,
      subgraphs: new Map(), // No subgraphs in focused view
    }

    const layout = createLayoutEngine(this._currentPhilosophy)
    const positioned = layout.compute(miniGraph)
    this._renderedBounds = this._computeRenderedBounds(positioned)
    const isBlueprint = this._currentPhilosophy === 'blueprint'

    // Clear and render
    this._viewport.removeChildren()
    this._nodeSprites.clear()
    this._edgeGraphics = []
    this._subgraphContainers.clear()
    this._busGraphics.clear()
    this._busSourceIds.clear()

    // Blueprint: create wire registry and draw bus lines
    let edgesToRender = positioned.edges
    let wireReg: WireRegistry | undefined
    if (isBlueprint && this._graph) {
      wireReg = new WireRegistry((theme as any).gridSize ?? 20)
      wireReg.registerNodeObstacles(positioned.nodes, undefined, true)

      const edgeCounts = new Map<string, number>()
      for (const e of positioned.edges) {
        edgeCounts.set(e.source, (edgeCounts.get(e.source) ?? 0) + 1)
      }
      const busSourceIds = new Set<string>()
      for (const [src, count] of edgeCounts) {
        if (count >= 2) busSourceIds.add(src)
      }
      this._busSourceIds = busSourceIds
      this._drawBlueprintBusLines(positioned, theme, busSourceIds, wireReg)
      edgesToRender = positioned.edges.filter(e => !busSourceIds.has(e.source))
    }

    // Draw edges — pass all nodes for Blueprint collision avoidance
    let edgeIdx = 0
    for (const edge of edgesToRender) {
      const eg = new EdgeGraphic(edge, theme, positioned.nodes, this._currentPhilosophy, edgeIdx, edgesToRender.length, undefined, wireReg); edgeIdx++
      this._edgeGraphics.push(eg)
      this._viewport.addChild(eg)
    }

    // Blueprint: wire crossing hops — drawn after all edges so we can detect crossings
    if (isBlueprint) {
      const edgeSegments = this._edgeGraphics
        .filter(eg => eg.orthogonalSegments != null)
        .map(eg => ({ edgeId: eg.data.id, segments: eg.orthogonalSegments! }))
      // Include bus line segments
      for (const [srcId, busGfx] of this._busGraphics) {
        const segs: WireSegment[] = (busGfx as any)._wireSegments ?? []
        if (segs.length > 0) {
          edgeSegments.push({ edgeId: `bus:${srcId}`, segments: segs })
        }
      }
      if (edgeSegments.length > 0) {
        const hopGraphic = drawWireHops(edgeSegments, theme)
        this._viewport.addChild(hopGraphic)
      }
    }

    // Determine font name based on philosophy
    const fontName = isBlueprint ? 'MermaidBlueprint' : 'MermaidNode'

    // Nodes
    for (const [id, node] of positioned.nodes) {
      const isStub = id.startsWith('_stub_')
      const sprite = new NodeSprite(node, theme, false, fontName)

      // Stubs are faded
      if (isStub) {
        sprite.alpha = 0.4
      }

      this._nodeSprites.set(id, sprite)
      this._viewport.addChild(sprite)

      // Click on stub navigates back or to the source subgraph
      if (!isStub) {
        sprite.on('pointertap', (e: FederatedPointerEvent) => {
          this._emitter.emit('node:click', {
            nodeId: id,
            eventType: 'click',
            originalEvent: e.nativeEvent as Event | undefined,
          })
          this.selectNode(id)
        })
      }
    }

    this._emitEdgeNodeCrossingWarning(positioned)

    // Fit the focused content
    this.fitToView()
    if (this._viewport) {
      this._updateDetailLevel(this._viewport._zoom)
    }
    this._applyPerformanceModeDetails()
  }

  // ── Philosophy ───────────────────────────────────────────

  /**
   * Switch layout philosophy without re-parsing. Preserves fold state.
   */
  setPhilosophy(philosophy: string): void {
    this._assertUsable('setPhilosophy')
    this._currentPhilosophy = philosophy

    // Update background
    if (this._app) {
      const theme = this._getActiveTheme()
      this._app.renderer.background.color = theme.background
    }

    // Re-layout with new philosophy, preserving fold state
    this._relayout()
  }

  setThemeMode(mode: ThemeMode): void {
    this._assertUsable('setThemeMode')
    this._themeMode = mode
    this._rerenderForThemeChange()
  }

  setThemeOverrides(overrides: MermaidRendererOptions['themeOverrides'] | null): void {
    this._assertUsable('setThemeOverrides')
    this._themeOverrides = overrides ?? undefined
    this._rerenderForThemeChange()
  }

  // ── Fold ─────────────────────────────────────────────────

  foldNode(id: string): void {
    if (!this._foldManager || !this._graph) return
    const sg = this._graph.subgraphs.get(id)
    if (!sg || sg.collapsed) return
    this._foldManager.toggle(id)
    this._emitter.emit('fold:change', id, true)
    this._relayout()
  }

  unfoldNode(id: string): void {
    if (!this._foldManager || !this._graph) return
    const sg = this._graph.subgraphs.get(id)
    if (!sg || !sg.collapsed) return
    this._foldManager.toggle(id)
    this._emitter.emit('fold:change', id, false)
    this._relayout()
  }

  foldAll(): void {
    if (!this._foldManager) return
    this._foldManager.foldAll()
    this._emitter.emit('fold:change', '*', true)
    this._relayout()
  }

  unfoldAll(): void {
    if (!this._foldManager) return
    this._foldManager.unfoldAll()
    this._emitter.emit('fold:change', '*', false)
    this._relayout()
  }

  // ── Selection ────────────────────────────────────────────

  /**
   * Highlight a node and emphasize its connected neighborhood.
   */
  selectNode(id: string | null): void {
    // Toggle: clicking same node deselects it
    if (id !== null && id === this._selectedNodeId) {
      id = null
    }

    // Deselect previous
    if (this._selectedNodeId) {
      const prev = this._nodeSprites.get(this._selectedNodeId)
      prev?.setSelected(false)
    }

    this._selectedNodeId = id

    if (id) {
      const sprite = this._nodeSprites.get(id)
      sprite?.setSelected(true)
      if (sprite?.parent) {
        sprite.parent.addChild(sprite)
      }
    }

    this._applySceneOpacityState()
  }

  // ── View ─────────────────────────────────────────────────

  revealNode(id: string): boolean {
    const node = this._positioned?.nodes.get(id)
    if (!node || !this._viewport) return false

    this.selectNode(id)
    this._viewport.animateToRegion(
      node.x,
      node.y,
      Math.max(node.width * 2.5, 220),
      Math.max(node.height * 2.5, 140),
    )
    return true
  }

  activateLink(nodeId: string): boolean {
    const linkDirective = this._graph?.directives.find(
      (directive): directive is LinkDirective => directive.type === 'link' && directive.nodeId === nodeId,
    )
    if (!linkDirective) return false

    this._linkPreview?.hide()
    const linkState = this._linkStates.get(nodeId)
    if (linkState?.status === 'broken') {
      this._emitter.emit('warn', {
        code: linkState.warningCode ?? 'LINK_TARGET_BROKEN',
        message: linkState.reason ?? `Broken link on node "${nodeId}"`,
      } satisfies RenderWarning)
      return false
    }

    this._emitter.emit('link:navigate', {
      targetFile: linkState?.canonicalTargetFile ?? linkDirective.targetFile,
      targetNode: linkDirective.targetNode,
      sourceNode: nodeId,
    })
    return true
  }

  fitToView(): void {
    this._assertUsable('fitToView')
    if (this._viewport && this._renderedBounds) {
      const b = this._renderedBounds
      this._viewport.fitToBounds(b.minX, b.minY, b.maxX, b.maxY)
      this._fitZoom = this._viewport._zoom
      this._touchRuntimeActivity()
    }
  }

  resetView(): void {
    this._assertUsable('resetView')
    this._viewport?.resetView()
    this._focusStack = []
    this._applySceneOpacityState()
    this._emitBreadcrumb()
  }

  // ── Events ───────────────────────────────────────────────

  on(event: string, handler: (...args: unknown[]) => void): void {
    this._emitter.on(event, handler)
  }

  off(event: string, handler: (...args: unknown[]) => void): void {
    this._emitter.off(event, handler)
  }

  // ── Private rendering ────────────────────────────────────

  private _renderGraph(positioned: PositionedGraph): void {
    if (!this._viewport) return

    const theme = this._getActiveTheme()
    this._renderedBounds = this._computeRenderedBounds(positioned)

    const isBlueprint = this._currentPhilosophy === 'blueprint'
    const subgraphFontName = isBlueprint ? 'MermaidBlueprint' : 'MermaidLabel'
    const reversePairOffsets = this._computeReversePairOffsets(positioned.edges)

    // Selection lifetime rule: any graph rebuild clears selection rather than
    // carrying a stale node id across fold/focus/layout/theme transitions.
    this._hoveredNodeId = null
    this.selectNode(null)

    // Clear previous children
    this._viewport.removeChildren()
    this._nodeSprites.clear()
    this._edgeGraphics = []
    this._subgraphContainers.clear()
    this._busGraphics.clear()
    this._busSourceIds.clear()

    // Draw blueprint grid background
    if (isBlueprint && theme.gridColor !== undefined) {
      const gridGfx = new Graphics()
      const gridSize = theme.gridSize ?? 20
      const gridColor = theme.gridColor
      const gridAlpha = theme.gridAlpha ?? 0.3
      // Extend grid beyond the graph bounds for visual completeness
      const padding = 100
      const startX = -padding
      const startY = -padding
      const endX = positioned.width + padding
      const endY = positioned.height + padding

      // Vertical lines
      for (let x = startX; x <= endX; x += gridSize) {
        gridGfx.moveTo(x, startY)
        gridGfx.lineTo(x, endY)
      }
      // Horizontal lines
      for (let y = startY; y <= endY; y += gridSize) {
        gridGfx.moveTo(startX, y)
        gridGfx.lineTo(endX, y)
      }
      gridGfx.stroke({ width: 1, color: gridColor, alpha: gridAlpha })
      this._viewport.addChild(gridGfx)
    }

    // Compute nesting depth from declared subgraph membership first, then
    // fall back to bounds containment if the parser data is too weak.
    const sgDepths = this._computeSubgraphDepths(positioned)
    const sortedSgs = Array.from(positioned.subgraphs.entries())
      .sort((a, b) => (b[1].width * b[1].height) - (a[1].width * a[1].height)) // largest first

    // Draw subgraphs — largest (depth 0) first, smallest (deepest) on top.
    // Single-click = fold/unfold (primary). Double-click = isolate/focus (secondary).
    for (const [sgId, sg] of sortedSgs) {
      const depth = sgDepths.get(sgId) ?? 0
      const sgc = new SubgraphContainer(sg, theme, depth, subgraphFontName)
      this._subgraphContainers.set(sgId, sgc)

      // Single click = fold/unfold
      let lastTapTime = 0
      sgc.on('pointertap', () => {
        const now = Date.now()
        if (now - lastTapTime < 400) {
          // Double-click = isolate/focus into subgraph
          if (!this._graph?.subgraphs.has(sgId)) return
          this.focusSubgraph(sgId)
          lastTapTime = 0
          return
        }
        lastTapTime = now

        // Delayed single-click = fold/unfold (wait to see if double-click follows)
        setTimeout(() => {
          if (lastTapTime !== now) return // double-click happened, skip
          if (!this._graph?.subgraphs.has(sgId)) return
          const sub = this._graph.subgraphs.get(sgId)!
          if (sub.collapsed) {
            this.unfoldNode(sgId)
          } else {
            this.foldNode(sgId)
          }
        }, 250) // wait 250ms to distinguish from double-click
      })

      this._viewport.addChild(sgc)
    }

    // Blueprint: A* grid routing
    if (isBlueprint && this._graph) {
      const builder = new BlueprintWireBuilder(positioned, (theme as any).gridSize ?? 20)
      const result = builder.route()
      if (result.congested) {
        this._emitter.emit('warn', {
          code: 'ROUTING_CONGESTED',
          message: 'Blueprint routing could not find a fully clear orthogonal path for every edge. Falling back to direct wire segments for the blocked routes.',
        } satisfies RenderWarning)
      }

      // Draw routed wires
      for (const wire of result.wires) {
        const edge = positioned.edges.find(e => e.id === wire.edgeId)
        if (!edge) continue
        const eg = new EdgeGraphic(edge, theme, positioned.nodes, 'blueprint-routed')
        eg.drawFromSegments(wire.segments, theme)
        this._edgeGraphics.push(eg)
        this._viewport.addChild(eg)
      }

      // Hop detection from all segments
      const allSegs = result.wires
        .filter(w => w.segments.length > 0)
        .map(w => ({ edgeId: w.edgeId, segments: w.segments as WireSegment[] }))
      if (allSegs.length > 0) {
        const hopGraphic = drawWireHops(allSegs, theme)
        this._viewport.addChild(hopGraphic)
      }
    } else {
      // Non-blueprint: original edge drawing
      let edgeIdx = 0
      for (const edge of positioned.edges) {
        const eg = new EdgeGraphic(
          edge,
          theme,
          positioned.nodes,
          this._currentPhilosophy,
          edgeIdx,
          positioned.edges.length,
          undefined,
          undefined,
          reversePairOffsets.get(edge.id) ?? 0,
        ); edgeIdx++
        this._edgeGraphics.push(eg)
        this._viewport.addChild(eg)
      }
    }

    // Build set of node IDs that have @link directives
    const linkedNodeIds = new Set<string>()
    if (this._graph) {
      for (const d of this._graph.directives) {
        if (d.type === 'link') linkedNodeIds.add(d.nodeId)
      }
    }

    // Determine font name based on philosophy
    const fontName = isBlueprint ? 'MermaidBlueprint' : 'MermaidNode'

    // Draw nodes (on top)
    for (const [id, node] of positioned.nodes) {
      const hasLink = linkedNodeIds.has(id)
      const linkState = this._linkStates.get(id)
      const sprite = new NodeSprite(
        node,
        theme,
        hasLink ? (linkState?.status === 'broken' ? 'broken' : 'valid') : false,
        fontName,
      )
      this._nodeSprites.set(id, sprite)
      this._viewport.addChild(sprite)

      // Hover: highlight connected edges + bus lines, dim unrelated
      sprite.on('pointerover', () => {
        if (this._performanceMode === 'stress') return
        this._setHoveredNode(id)
      })
      sprite.on('pointerout', () => {
        if (this._hoveredNodeId === id) {
          this._setHoveredNode(null)
        }
      })

      // Wire node click — select only, no navigation
      sprite.on('pointertap', (e: FederatedPointerEvent) => {
        // If this is a collapsed summary node, clicking expands it
        if (node.metadata?._isCollapsedSummary) {
          const sgId = node.metadata._subgraphId as string
          this.unfoldNode(sgId)
          return
        }

        const evt: NodeEvent = {
          nodeId: id,
          eventType: 'click',
          originalEvent: e.nativeEvent as Event | undefined,
        }
        this._emitter.emit('node:click', evt)
        this.selectNode(id)
      })

      // Wire badge click + hover preview for linked nodes
      if (hasLink) {
        const linkDirective = this._graph?.directives.find(
          (d): d is LinkDirective => d.type === 'link' && d.nodeId === id,
        )

        // Badge click navigates to the linked file
        sprite.on('badge:click', () => {
          if (linkDirective) this.activateLink(id)
        })

        // Hover shows wiki-style preview of the target file (debounced)
        sprite.on('pointerover', () => {
          if (this._performanceMode === 'stress') return
          const previewTarget = this._linkStates.get(id)?.canonicalTargetFile ?? linkDirective?.targetFile
          if (!linkDirective || !previewTarget || !this.onResolvePreview || !this._linkPreview) return
          if (this._linkStates.get(id)?.status === 'broken') return
          const resolver = this.onResolvePreview
          this._linkPreview.scheduleShow(
            () => {
              const bounds = sprite.getBounds()
              return { x: bounds.right, y: bounds.y }
            },
            previewTarget,
            () => resolver(previewTarget),
          )
        })

        sprite.on('pointerout', () => {
          this._linkPreview?.requestHide()
        })
      }

      // Wire double-click for fold toggle
      sprite.on('dblclick' as any, (e: any) => {
        const evt: NodeEvent = {
          nodeId: id,
          eventType: 'dblclick',
          originalEvent: e?.nativeEvent,
        }
        this._emitter.emit('node:dblclick', evt)

        // If this node ID is a subgraph, toggle fold
        if (this._graph?.subgraphs.has(id)) {
          const sg = this._graph.subgraphs.get(id)!
          if (sg.collapsed) {
            this.unfoldNode(id)
          } else {
            this.foldNode(id)
          }
        }
      })
    }

    this._emitEdgeNodeCrossingWarning(positioned)

    // Auto-fit first (sets _fitZoom baseline), then apply detail levels
    this.fitToView()

    // Now that fitToView set the zoom, apply detail levels (relative to fit zoom)
    if (this._viewport) {
      this._updateDetailLevel(this._viewport._zoom)
    }
    this._applyPerformanceModeDetails()

    // Re-apply focus dimming if we have an active focus
    if (this._focusStack.length > 0) {
      this._applyFocusDimming()
    }

    // For Narrative: detect and store spine for hover highlighting
    this._spineNodeIds.clear()
    if (this._currentPhilosophy === 'narrative' && this._graph) {
      const nl = new NarrativeLayout()
      const spine = nl.detectSpine(this._graph)
      for (const id of spine) this._spineNodeIds.add(id)

      // Build spine edge set
      const spineEdgeIds = new Set<string>()
      for (let i = 0; i < spine.length - 1; i++) {
        for (const eg of this._edgeGraphics) {
          if (eg.data.source === spine[i] && eg.data.target === spine[i + 1]) {
            spineEdgeIds.add(eg.data.id)
          }
        }
      }

      // Dim non-spine elements slightly by default
      for (const [id, sprite] of this._nodeSprites) {
        if (!this._spineNodeIds.has(id)) sprite.alpha = 0.7
      }
      for (const eg of this._edgeGraphics) {
        if (!spineEdgeIds.has(eg.data.id)) eg.alpha = 0.4
      }
    }

    this._applySceneOpacityState()

    this._touchRuntimeActivity()
  }

  private _emitEdgeNodeCrossingWarning(positioned: PositionedGraph): void {
    if (this._currentPhilosophy === 'blueprint') return

    const crossings: Array<{ edgeId: string; nodeId: string }> = []

    for (const edgeGraphic of this._edgeGraphics) {
      const edge = edgeGraphic.data
      const points = edge.points
      if (points.length < 2) continue

      for (const [nodeId, node] of positioned.nodes) {
        if (nodeId === edge.source || nodeId === edge.target) continue

        const footprint = estimateRenderedNodeFootprint(node, false)
        const hw = footprint.width / 2
        const hh = footprint.height / 2

        let intersects = false
        for (let index = 0; index < points.length - 1; index++) {
          const start = points[index]
          const end = points[index + 1]
          if (lineIntersectsRect(start.x, start.y, end.x, end.y, node.x, node.y, hw, hh)) {
            intersects = true
            break
          }
        }

        if (intersects) {
          crossings.push({ edgeId: edge.id, nodeId })
        }
      }
    }

    if (crossings.length === 0) return

    const uniqueEdges = new Set(crossings.map((crossing) => crossing.edgeId))
    const uniqueNodes = new Set(crossings.map((crossing) => crossing.nodeId))

    this._emitter.emit('warn', {
      code: 'EDGE_NODE_CROSSING',
      message: `${crossings.length} rendered edge/node crossing${crossings.length === 1 ? '' : 's'} detected across ${uniqueEdges.size} edge${uniqueEdges.size === 1 ? '' : 's'} and ${uniqueNodes.size} unrelated node${uniqueNodes.size === 1 ? '' : 's'}. Collision-free routing is only guaranteed for blueprint.`,
    } satisfies RenderWarning)
  }

  private _assertUsable(action: string): void {
    if (this._destroyed) {
      throw new Error(`Cannot ${action}() after destroy(). Create a new MermaidRenderer instance.`)
    }
    if (!this._app || !this._viewport) {
      throw new Error(`Cannot ${action}() before mount() completes.`)
    }
  }

  private _clearMessageState(): void {
    if (!this._messageOverlay) return
    this._messageOverlay.removeFromParent()
    this._messageOverlay.destroy({ children: true })
    this._messageOverlay = null
  }

  private _drawMessageState(title: string, message: string): void {
    if (this._app) {
      this._drawRendererMessageState(title, message)
      return
    }
    this._drawCanvasMessageState(title, message)
  }

  private _drawRendererMessageState(title: string, message: string): void {
    if (!this._app) return
    this._clearMessageState()
    ensureFontsInstalled()

    const overlay = new Container()
    const background = new Graphics()
    const width = this._app.screen.width
    const height = this._app.screen.height
    const theme = this._getActiveTheme()
    background
      .rect(0, 0, width, height)
      .fill({ color: theme.messageOverlayBg })

    const titleText = new BitmapText({
      text: title,
      style: {
        fontFamily: 'Inter',
        fontSize: 16,
        fill: theme.messageTitle,
        fontWeight: '600',
      },
    })
    titleText.x = 24
    titleText.y = 24

    const body = this._wrapMessage(message, 72).join('\n')
    const bodyText = new BitmapText({
      text: body,
      style: {
        fontFamily: 'Inter',
        fontSize: 13,
        fill: theme.messageBody,
      },
    })
    bodyText.x = 24
    bodyText.y = 56

    overlay.addChild(background, titleText, bodyText)
    this._app.stage.addChild(overlay)
    this._messageOverlay = overlay
  }

  private _drawCanvasMessageState(title: string, message: string): void {
    if (!this._canvas) return
    const canvas = this._canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio ?? 1
    const width = Math.max(canvas.clientWidth || canvas.width || 640, 320)
    const height = Math.max(canvas.clientHeight || canvas.height || 480, 180)
    const theme = this._getActiveTheme()
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = theme.messageOverlayBg.toString(16).padStart(6, '0').replace(/^/, '#')
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = theme.messageTitle
    ctx.font = '600 16px Inter, system-ui, sans-serif'
    ctx.fillText(title, 24, 36)
    ctx.fillStyle = theme.messageBody
    ctx.font = '13px Inter, system-ui, sans-serif'
    for (const [index, line] of this._wrapMessage(message, 72).entries()) {
      ctx.fillText(line, 24, 68 + index * 18)
    }
  }

  private _drawUnavailableState(message: string): void {
    this._drawMessageState('Rendering unavailable', message)
  }

  private _wrapMessage(message: string, maxLength: number): string[] {
    const words = message.split(/\s+/)
    const lines: string[] = []
    let current = ''
    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      if (next.length > maxLength && current) {
        lines.push(current)
        current = word
      } else {
        current = next
      }
    }
    if (current) lines.push(current)
    return lines
  }

  private _prefersLightColorScheme(): boolean {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-color-scheme: light)').matches
  }

  private _getActiveTheme(): Theme {
    return resolveTheme(
      this._currentPhilosophy as any,
      this._themeMode,
      this._prefersLightColorScheme(),
      this._themeOverrides,
    )
  }

  private _rerenderForThemeChange(): void {
    if (this._app) {
      this._app.renderer.background.color = this._getActiveTheme().background
    }
    if (this._positioned) {
      this._renderGraph(this._positioned)
      this._emitBreadcrumb()
    }
  }

  private _wireColorSchemeUpdates(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    this._colorSchemeMediaQuery = window.matchMedia('(prefers-color-scheme: light)')
    this._colorSchemeChangeHandler = () => {
      if (this._themeMode !== 'system') return
      this._rerenderForThemeChange()
    }
    this._colorSchemeMediaQuery.addEventListener('change', this._colorSchemeChangeHandler)
  }

  private _wireResizeHandling(canvas: HTMLCanvasElement): void {
    if (typeof ResizeObserver === 'undefined') return
    const target = canvas.parentElement ?? canvas
    this._lastObservedCanvasSize = {
      width: target.clientWidth,
      height: target.clientHeight,
    }
    this._resizeObserver = new ResizeObserver(() => {
      const nextSize = {
        width: target.clientWidth,
        height: target.clientHeight,
      }
      if (
        this._lastObservedCanvasSize
        && nextSize.width === this._lastObservedCanvasSize.width
        && nextSize.height === this._lastObservedCanvasSize.height
      ) {
        return
      }
      this._lastObservedCanvasSize = nextSize
      if (this._resizeRafId !== null) {
        cancelAnimationFrame(this._resizeRafId)
      }
      this._resizeRafId = requestAnimationFrame(() => {
        this._resizeRafId = null
        if (this._destroyed || !this._app || !this._viewport || !this._renderedBounds) return
        this.fitToView()
      })
    })
    this._resizeObserver.observe(target)
  }

  private _wireRuntimeLifecycle(app: Application, canvas: HTMLCanvasElement, rendererType: string): void {
    this._webglContextLostHandler = (event: Event) => {
      event.preventDefault()
      this._setRuntimeActivity('context-recovery', true)
      this._emitter.emit('warn', {
        code: 'RENDER_CONTEXT_LOST',
        message: 'WebGL context lost. Waiting for restoration.',
      } satisfies RenderWarning)
      this._drawUnavailableState('WebGL context lost. Waiting for restoration.')
    }
    this._webglContextRestoredHandler = () => {
      this._emitter.emit('warn', {
        code: 'RENDER_CONTEXT_RESTORED',
        message: 'WebGL context restored. Re-rendering diagram.',
      } satisfies RenderWarning)
      void this._recoverAfterContextLoss()
    }
    canvas.addEventListener('webglcontextlost', this._webglContextLostHandler)
    canvas.addEventListener('webglcontextrestored', this._webglContextRestoredHandler)

    this._pointerActivityHandler = (event: Event) => {
      if (event instanceof PointerEvent && this._canvas) {
        const rect = this._canvas.getBoundingClientRect()
        this._linkPreview?.setPointerPosition(
          event.clientX - rect.left,
          event.clientY - rect.top,
        )
      }
      this._touchRuntimeActivity()
    }
    canvas.addEventListener('pointermove', this._pointerActivityHandler)
    canvas.addEventListener('pointerdown', this._pointerActivityHandler)
    canvas.addEventListener('wheel', this._pointerActivityHandler, { passive: true })

    this._visibilityHandler = () => {
      if (!this._app) return
      if (document.visibilityState === 'hidden') {
        this._resumeTickerOnVisible = this._app.ticker.started
        this._app.ticker.stop()
        return
      }
      if (this._resumeTickerOnVisible || this._runtimeActivityReasons.size > 0) {
        this._ensureTickerRunning()
        this._scheduleIdleTickerStop()
      }
    }
    document.addEventListener('visibilitychange', this._visibilityHandler)

    if (rendererType === 'WebGPU') {
      const generation = ++this._gpuLostGeneration
      const gpuDevice = (app.renderer as any)?.gpu?.device as GPUDevice | undefined
      void gpuDevice?.lost.then(() => {
        void this._handleGpuDeviceLost(app, generation)
      })
    }
  }

  private async _handleGpuDeviceLost(app: Application, generation: number): Promise<void> {
    if (this._destroyed || this._app !== app || generation !== this._gpuLostGeneration) return
    if (app.renderer.type !== 0x2) return
    this._setRuntimeActivity('context-recovery', true)
    this._emitter.emit('warn', {
      code: 'RENDER_DEVICE_LOST',
      message: 'WebGPU device lost. Re-rendering diagram.',
    } satisfies RenderWarning)
    this._drawUnavailableState('WebGPU device lost. Re-rendering diagram.')
    await this._recoverAfterContextLoss()
  }

  private async _recoverAfterContextLoss(): Promise<void> {
    if (!this._app || !this._canvas || this._destroyed) return

    const canvas = this._canvas
    const source = this._lastSource
    const options = this._lastLoadOptions
    const handlers = this._keyHandler

    if (handlers) {
      canvas.removeEventListener('keydown', handlers)
      this._keyHandler = null
    }
    if (this._webglContextLostHandler) {
      canvas.removeEventListener('webglcontextlost', this._webglContextLostHandler)
      this._webglContextLostHandler = null
    }
    if (this._webglContextRestoredHandler) {
      canvas.removeEventListener('webglcontextrestored', this._webglContextRestoredHandler)
      this._webglContextRestoredHandler = null
    }
    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler)
      this._visibilityHandler = null
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect()
      this._resizeObserver = null
    }
    if (this._resizeRafId !== null) {
      cancelAnimationFrame(this._resizeRafId)
      this._resizeRafId = null
    }
    this._lastObservedCanvasSize = null
    if (this._colorSchemeMediaQuery && this._colorSchemeChangeHandler) {
      this._colorSchemeMediaQuery.removeEventListener('change', this._colorSchemeChangeHandler)
      this._colorSchemeChangeHandler = null
      this._colorSchemeMediaQuery = null
    }
    if (this._pointerActivityHandler) {
      canvas.removeEventListener('pointermove', this._pointerActivityHandler)
      canvas.removeEventListener('pointerdown', this._pointerActivityHandler)
      canvas.removeEventListener('wheel', this._pointerActivityHandler)
      this._pointerActivityHandler = null
    }
    if (this._idleTickerTimeoutId !== null) {
      window.clearTimeout(this._idleTickerTimeoutId)
      this._idleTickerTimeoutId = null
    }

    this._app.destroy(true, { children: true })
    this._app = null
    this._viewport = null
    MermaidRenderer._liveCanvases.delete(canvas)

    try {
      await this.mount(canvas)
      // mount() resolves without mounting when destroy() raced the remount.
      if (this._destroyed) return
      if (source) {
        await this.load(source, options)
      }
    } finally {
      this._setRuntimeActivity('context-recovery', false)
    }
  }

  /**
   * Best-effort teardown for a mount() that lost a race with destroy().
   * Mirrors destroy() for the resources mount() had created so far, then
   * restores the canvas's WebGL context so the embedder can mount a fresh
   * renderer on the same canvas. (Pixi deliberately loses the context when a
   * renderer is destroyed, and mounting onto a lost context hangs.)
   */
  private async _abortInFlightMount(canvas: HTMLCanvasElement, app: Application | null): Promise<void> {
    if (app) {
      const gl = (app.renderer as any)?.gl as WebGLRenderingContext | undefined
      const loseContextExt = gl?.getExtension('WEBGL_lose_context') ?? null
      const contextRestored = loseContextExt
        ? new Promise<void>((resolve) => {
            let settled = false
            const onLost = (event: Event) => {
              // Restoration is only allowed when the lost event is cancelled.
              event.preventDefault()
              window.setTimeout(() => loseContextExt.restoreContext(), 0)
            }
            const finish = () => {
              if (settled) return
              settled = true
              canvas.removeEventListener('webglcontextlost', onLost)
              canvas.removeEventListener('webglcontextrestored', finish)
              resolve()
            }
            canvas.addEventListener('webglcontextlost', onLost)
            canvas.addEventListener('webglcontextrestored', finish)
            // Safety net: never leave the aborted mount() hanging.
            window.setTimeout(finish, 1000)
          })
        : null
      app.destroy(true, { children: true })
      if (contextRestored) await contextRestored
    }
    MermaidRenderer._liveCanvases.delete(canvas)
    if (this._canvas === canvas) {
      this._canvas = null
    }
  }

  private _touchRuntimeActivity(): void {
    this._ensureTickerRunning()
    this._scheduleIdleTickerStop()
  }

  private _setRuntimeActivity(reason: string, active: boolean): void {
    if (active) {
      this._runtimeActivityReasons.add(reason)
      this._ensureTickerRunning()
      if (this._idleTickerTimeoutId !== null) {
        window.clearTimeout(this._idleTickerTimeoutId)
        this._idleTickerTimeoutId = null
      }
      return
    }

    this._runtimeActivityReasons.delete(reason)
    this._scheduleIdleTickerStop()
  }

  private _ensureTickerRunning(): void {
    if (!this._app || document.visibilityState === 'hidden') return
    if (!this._app.ticker.started) {
      this._app.ticker.start()
    }
  }

  private _scheduleIdleTickerStop(): void {
    if (!this._app || document.visibilityState === 'hidden') return
    if (this._runtimeActivityReasons.size > 0) return
    if (this._idleTickerTimeoutId !== null) {
      window.clearTimeout(this._idleTickerTimeoutId)
    }
    this._idleTickerTimeoutId = window.setTimeout(() => {
      this._idleTickerTimeoutId = null
      if (!this._app || document.visibilityState === 'hidden') return
      if (this._runtimeActivityReasons.size > 0) return
      this._app.ticker.stop()
    }, IDLE_TICKER_TIMEOUT_MS)
  }

  /**
   * Update semantic zoom detail levels on all elements.
   * Thresholds are relative to the fitToView zoom (the "default" zoom).
   * At default zoom everything should be fully visible.
   * Hiding only kicks in when user zooms OUT beyond the default.
   */
  private _updateDetailLevel(zoom: number): void {
    // Nodes get absolute zoom for Coggle-style font counter-scaling
    for (const sprite of this._nodeSprites.values()) {
      sprite.updateDetailLevel(zoom)
    }

    // Subgraphs use relative zoom for label visibility
    const fitZoom = this._fitZoom ?? 1
    const relativeZoom = fitZoom > 0 ? zoom / fitZoom : zoom
    for (const sgc of this._subgraphContainers.values()) {
      sgc.updateDetailLevel(relativeZoom)
    }

    // Edges always visible
    for (const eg of this._edgeGraphics) {
      eg.visible = true
      eg.alpha = 1
    }
  }

  private _applyPerformanceModeDetails(): void {
    const stressMode = this._performanceMode === 'stress'
    for (const eg of this._edgeGraphics) {
      eg.setStressMode(stressMode)
    }
    for (const sgc of this._subgraphContainers.values()) {
      sgc.setStressMode(stressMode)
    }
  }

  /** Cached fit-to-view zoom level — used as baseline for semantic zoom */
  private _fitZoom: number = 1

  /**
   * Apply focus dimming: dim all elements not in the currently focused subgraph.
   */
  private _applyFocusDimming(): void {
    this._applySceneOpacityState()
  }

  /**
   * Restore all element opacities to the current scene state.
   */
  private _restoreAllOpacities(): void {
    this._applySceneOpacityState()
  }

  private _setHoveredNode(id: string | null): void {
    if (this._hoveredNodeId === id) return
    this._hoveredNodeId = id
    this._applySceneOpacityState()
  }

  private _getFocusedNodeIds(): Set<string> | null {
    if (this._focusStack.length === 0) return null
    const focusedId = this._focusStack[this._focusStack.length - 1]
    const focusedSg = this._graph?.subgraphs.get(focusedId)
    return focusedSg ? new Set(focusedSg.nodeIds) : null
  }

  private _collectRelationshipState(activeNodeIds: Set<string>): {
    relatedNodeIds: Set<string>
    relatedEdgeIds: Set<string>
    relatedBusSourceIds: Set<string>
  } {
    const relatedNodeIds = new Set(activeNodeIds)
    const relatedEdgeIds = new Set<string>()
    const relatedBusSourceIds = new Set<string>()

    for (const eg of this._edgeGraphics) {
      const connected = activeNodeIds.has(eg.data.source) || activeNodeIds.has(eg.data.target)
      if (!connected) continue
      relatedEdgeIds.add(eg.data.id)
      relatedNodeIds.add(eg.data.source)
      relatedNodeIds.add(eg.data.target)
    }

    for (const [sourceId, busGfx] of this._busGraphics) {
      const targetIds: string[] = (busGfx as { _targetIds?: string[] })._targetIds ?? []
      const connected = activeNodeIds.has(sourceId) || targetIds.some((targetId) => activeNodeIds.has(targetId))
      if (!connected) continue
      relatedBusSourceIds.add(sourceId)
      relatedNodeIds.add(sourceId)
      for (const targetId of targetIds) relatedNodeIds.add(targetId)
    }

    return { relatedNodeIds, relatedEdgeIds, relatedBusSourceIds }
  }

  private _baseNodeAlpha(id: string, dimmedAlpha: number): number {
    if (this._currentPhilosophy !== 'narrative' || this._spineNodeIds.size === 0) return 1
    return this._spineNodeIds.has(id) ? 1 : Math.max(dimmedAlpha, 0.7)
  }

  private _baseEdgeAlpha(id: string, dimmedAlpha: number): number {
    if (this._currentPhilosophy !== 'narrative' || this._spineNodeIds.size === 0 || !this._graph) return 1
    const spine = Array.from(this._spineNodeIds)
    const spineEdgeIds = new Set<string>()
    for (let index = 0; index < spine.length - 1; index++) {
      for (const eg of this._edgeGraphics) {
        if (eg.data.source === spine[index] && eg.data.target === spine[index + 1]) {
          spineEdgeIds.add(eg.data.id)
        }
      }
    }
    return spineEdgeIds.has(id) ? 1 : Math.max(dimmedAlpha, 0.4)
  }

  private _applySceneOpacityState(): void {
    const theme = this._getActiveTheme()
    const focusedNodeIds = this._getFocusedNodeIds()
    const focusedSubgraphId = this._focusStack[this._focusStack.length - 1] ?? null
    const activeNodeIds = new Set<string>()
    if (this._selectedNodeId) activeNodeIds.add(this._selectedNodeId)
    if (this._hoveredNodeId) activeNodeIds.add(this._hoveredNodeId)
    const hasRelationshipFocus = activeNodeIds.size > 0
    const { relatedNodeIds, relatedEdgeIds, relatedBusSourceIds } = this._collectRelationshipState(activeNodeIds)

    for (const [id, sprite] of this._nodeSprites) {
      const focusAlpha = focusedNodeIds && !focusedNodeIds.has(id) ? theme.dimmedAlpha : 1
      const baseAlpha = this._baseNodeAlpha(id, theme.dimmedAlpha)
      const relationshipAlpha = hasRelationshipFocus
        ? (relatedNodeIds.has(id) ? 1 : Math.min(baseAlpha, theme.dimmedAlpha))
        : baseAlpha
      sprite.alpha = Math.min(focusAlpha, relationshipAlpha)
    }

    for (const [id, sgc] of this._subgraphContainers) {
      sgc.alpha = focusedSubgraphId && id !== focusedSubgraphId ? theme.dimmedAlpha : 1
    }

    for (const eg of this._edgeGraphics) {
      const focusAlpha = focusedNodeIds && (!focusedNodeIds.has(eg.data.source) || !focusedNodeIds.has(eg.data.target))
        ? theme.dimmedAlpha
        : 1
      const baseAlpha = this._baseEdgeAlpha(eg.data.id, theme.dimmedAlpha)
      const relationshipAlpha = hasRelationshipFocus
        ? (relatedEdgeIds.has(eg.data.id) ? 1 : Math.min(baseAlpha, theme.dimmedAlpha))
        : baseAlpha
      eg.alpha = Math.min(focusAlpha, relationshipAlpha)
    }

    for (const [sourceId, busGfx] of this._busGraphics) {
      const relationshipAlpha = hasRelationshipFocus && !relatedBusSourceIds.has(sourceId) ? theme.dimmedAlpha : 1
      busGfx.alpha = relationshipAlpha
    }
  }

  private _computeRenderedBounds(positioned: PositionedGraph): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    const includeRect = (x: number, y: number, width: number, height: number) => {
      minX = Math.min(minX, x - width / 2)
      minY = Math.min(minY, y - height / 2)
      maxX = Math.max(maxX, x + width / 2)
      maxY = Math.max(maxY, y + height / 2)
    }

    for (const node of positioned.nodes.values()) {
      includeRect(node.x, node.y, node.width, node.height)
    }

    for (const subgraph of positioned.subgraphs.values()) {
      includeRect(subgraph.x, subgraph.y, subgraph.width, subgraph.height)
    }

    for (const edge of positioned.edges) {
      for (const point of edge.points) {
        minX = Math.min(minX, point.x)
        minY = Math.min(minY, point.y)
        maxX = Math.max(maxX, point.x)
        maxY = Math.max(maxY, point.y)
      }
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return { minX: 0, minY: 0, maxX: positioned.width, maxY: positioned.height }
    }

    const padding = 20
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding,
    }
  }

  private _computeReversePairOffsets(edges: PositionedGraph['edges']): Map<string, number> {
    const offsets = new Map<string, number>()
    const grouped = new Map<string, typeof edges>()

    for (const edge of edges) {
      const key = edge.source < edge.target
        ? `${edge.source}<->${edge.target}`
        : `${edge.target}<->${edge.source}`
      const list = grouped.get(key) ?? []
      list.push(edge)
      grouped.set(key, list)
    }

    for (const list of grouped.values()) {
      const forward = list.filter((edge) => edge.source < edge.target)
      const backward = list.filter((edge) => edge.source > edge.target)
      if (forward.length === 0 || backward.length === 0) continue

      for (const edge of forward) offsets.set(edge.id, 24)
      for (const edge of backward) offsets.set(edge.id, -24)
    }

    return offsets
  }

  /**
   * Emit breadcrumb state to the consumer callback.
   */
  private _emitBreadcrumb(): void {
    if (!this.onBreadcrumbChange) return

    const segments: Array<{ id: string | null; label: string }> = [
      { id: null, label: 'Root' },
    ]

    for (const sgId of this._focusStack) {
      const sg = this._graph?.subgraphs.get(sgId)
      segments.push({
        id: sgId,
        label: sg?.label ?? sgId,
      })
    }

    this.onBreadcrumbChange(segments)
  }

  /**
   * Re-run layout on the current graph (after fold changes) and re-render.
   */
  private _relayout(): void {
    if (!this._graph || !this._viewport || !this._app) return
    this._relayoutFadeGeneration += 1
    const fadeGeneration = this._relayoutFadeGeneration

    const layout = createLayoutEngine(this._currentPhilosophy)
    const previousPositioned = this._positioned
    const newPositioned = layout.compute(this._graph)
    this._positioned = newPositioned

    if (this._performanceMode === 'stress') {
      this._renderGraph(newPositioned)
      return
    }

    if (previousPositioned && this._canAnimateRelayout(previousPositioned, newPositioned)) {
      this._hoveredNodeId = null
      this.selectNode(null)
      this._animateRelayout(previousPositioned, newPositioned, fadeGeneration)
      return
    }

    // Quick crossfade: fade out old content, render new, fade in
    // This keeps everything (nodes + edges + subgraphs) in sync as one organism
    const vp = this._viewport
    const app = this._app
    vp.alpha = 0.3
    this._renderGraph(newPositioned)
    this._setRuntimeActivity('relayout-fade', true)
    const fadeDurationMs = 150
    let elapsedMs = 0
    const fadeIn = () => {
      if (this._destroyed || fadeGeneration !== this._relayoutFadeGeneration || this._viewport !== vp) {
        app.ticker.remove(fadeIn)
        vp.alpha = 1
        this._setRuntimeActivity('relayout-fade', false)
        return
      }
      elapsedMs += app.ticker.deltaMS
      vp.alpha = 0.3 + 0.7 * Math.min(1, elapsedMs / fadeDurationMs)
      this._touchRuntimeActivity()
      if (elapsedMs >= fadeDurationMs) {
        app.ticker.remove(fadeIn)
        vp.alpha = 1
        this._setRuntimeActivity('relayout-fade', false)
      }
    }
    app.ticker.add(fadeIn)
  }

  private _canAnimateRelayout(previousPositioned: PositionedGraph, newPositioned: PositionedGraph): boolean {
    if (!this._app || !this._viewport) return false
    if (this._currentPhilosophy === 'blueprint') return false
    if (this._nodeSprites.size === 0 || this._edgeGraphics.length === 0) return false
    if (this._focusStack.length > 0) return false

    if (previousPositioned.nodes.size !== newPositioned.nodes.size) return false
    if (previousPositioned.edges.length !== newPositioned.edges.length) return false
    if (previousPositioned.subgraphs.size !== newPositioned.subgraphs.size) return false

    for (const id of previousPositioned.nodes.keys()) {
      if (!newPositioned.nodes.has(id) || !this._nodeSprites.has(id)) return false
    }

    const edgeIds = new Set(this._edgeGraphics.map((edgeGraphic) => edgeGraphic.data.id))
    const previousEdgeIds = new Set(previousPositioned.edges.map((edge) => edge.id))
    for (const edge of newPositioned.edges) {
      if (!edgeIds.has(edge.id) || !previousEdgeIds.has(edge.id)) return false
    }

    for (const id of previousPositioned.subgraphs.keys()) {
      if (!newPositioned.subgraphs.has(id) || !this._subgraphContainers.has(id)) return false
    }

    return true
  }

  private _animateRelayout(
    previousPositioned: PositionedGraph,
    newPositioned: PositionedGraph,
    generation: number,
  ): void {
    if (!this._app || !this._viewport) return

    const app = this._app
    const theme = this._getActiveTheme()
    const reversePairOffsets = this._computeReversePairOffsets(newPositioned.edges)
    const edgeById = new Map(this._edgeGraphics.map((edgeGraphic) => [edgeGraphic.data.id, edgeGraphic]))
    const linkedNodeIds = new Set(
      this._graph?.directives
        .filter((directive): directive is LinkDirective => directive.type === 'link')
        .map((directive) => directive.nodeId) ?? [],
    )
    const fontName = this._currentPhilosophy === 'blueprint' ? 'MermaidBlueprint' : 'MermaidNode'
    const subgraphFontName = this._currentPhilosophy === 'blueprint' ? 'MermaidBlueprint' : 'MermaidLabel'
    this._viewport.alpha = 1

    for (const [id, sprite] of this._nodeSprites) {
      const hasLink = linkedNodeIds.has(id)
      const linkState = this._linkStates.get(id)
      sprite.updateAppearance(
        theme,
        hasLink ? (linkState?.status === 'broken' ? 'broken' : 'valid') : false,
        fontName,
      )
    }

    this._setRuntimeActivity('relayout-motion', true)
    this._applySceneOpacityState()

    let elapsedMs = 0
    const tick = () => {
      if (this._destroyed || generation !== this._relayoutFadeGeneration || !this._viewport || this._app !== app) {
        app.ticker.remove(tick)
        if (this._viewport) this._viewport.alpha = 1
        this._setRuntimeActivity('relayout-motion', false)
        return
      }

      elapsedMs += app.ticker.deltaMS
      const rawProgress = Math.min(1, elapsedMs / RELAYOUT_MOTION_DURATION_MS)
      const progress = 1 - Math.pow(1 - rawProgress, 3)
      const animated = this._interpolatePositionedGraph(previousPositioned, newPositioned, progress)

      this._renderedBounds = this._computeRenderedBounds(animated)

      for (const [id, node] of animated.nodes) {
        const sprite = this._nodeSprites.get(id)
        if (!sprite) continue
        sprite.x = node.x
        sprite.y = node.y
      }

      const sgDepths = this._computeSubgraphDepths(animated)
      for (const [id, subgraph] of animated.subgraphs) {
        const container = this._subgraphContainers.get(id)
        if (!container) continue
        container.updateLayout(subgraph, sgDepths.get(id) ?? 0, theme, subgraphFontName)
      }

      for (const [index, edge] of animated.edges.entries()) {
        const edgeGraphic = edgeById.get(edge.id)
        if (!edgeGraphic) continue
        edgeGraphic.redraw(
          edge,
          theme,
          animated.nodes,
          this._currentPhilosophy,
          index,
          animated.edges.length,
          undefined,
          undefined,
          reversePairOffsets.get(edge.id) ?? 0,
        )
      }

      this._applySceneOpacityState()
      this._touchRuntimeActivity()

      if (rawProgress >= 1) {
        app.ticker.remove(tick)
        this._viewport.alpha = 1
        this._setRuntimeActivity('relayout-motion', false)
        this._renderGraph(newPositioned)
      }
    }

    app.ticker.add(tick)
  }

  private _interpolatePositionedGraph(
    previousPositioned: PositionedGraph,
    newPositioned: PositionedGraph,
    progress: number,
  ): PositionedGraph {
    const nodes = new Map<string, PositionedGraph['nodes'] extends Map<string, infer T> ? T : never>()
    for (const [id, nextNode] of newPositioned.nodes) {
      const prevNode = previousPositioned.nodes.get(id) ?? nextNode
      nodes.set(id, {
        ...nextNode,
        x: this._lerp(prevNode.x, nextNode.x, progress),
        y: this._lerp(prevNode.y, nextNode.y, progress),
        width: this._lerp(prevNode.width, nextNode.width, progress),
        height: this._lerp(prevNode.height, nextNode.height, progress),
      })
    }

    const edges = newPositioned.edges.map((nextEdge) => {
      const prevEdge = previousPositioned.edges.find((edge) => edge.id === nextEdge.id) ?? nextEdge
      return {
        ...nextEdge,
        points: this._interpolateEdgePoints(prevEdge.points, nextEdge.points, progress),
      }
    })

    const subgraphs = new Map<string, PositionedGraph['subgraphs'] extends Map<string, infer T> ? T : never>()
    for (const [id, nextSubgraph] of newPositioned.subgraphs) {
      const prevSubgraph = previousPositioned.subgraphs.get(id) ?? nextSubgraph
      subgraphs.set(id, {
        ...nextSubgraph,
        x: this._lerp(prevSubgraph.x, nextSubgraph.x, progress),
        y: this._lerp(prevSubgraph.y, nextSubgraph.y, progress),
        width: this._lerp(prevSubgraph.width, nextSubgraph.width, progress),
        height: this._lerp(prevSubgraph.height, nextSubgraph.height, progress),
      })
    }

    return {
      nodes,
      edges,
      subgraphs,
      width: this._lerp(previousPositioned.width, newPositioned.width, progress),
      height: this._lerp(previousPositioned.height, newPositioned.height, progress),
    }
  }

  private _interpolateEdgePoints(
    previousPoints: Array<{ x: number; y: number }>,
    nextPoints: Array<{ x: number; y: number }>,
    progress: number,
  ): Array<{ x: number; y: number }> {
    const count = Math.max(previousPoints.length, nextPoints.length, 2)
    const interpolated: Array<{ x: number; y: number }> = []
    for (let index = 0; index < count; index++) {
      const ratio = count === 1 ? 0 : index / (count - 1)
      const prevPoint = this._samplePathPoint(previousPoints, ratio)
      const nextPoint = this._samplePathPoint(nextPoints, ratio)
      interpolated.push({
        x: this._lerp(prevPoint.x, nextPoint.x, progress),
        y: this._lerp(prevPoint.y, nextPoint.y, progress),
      })
    }
    return interpolated
  }

  private _samplePathPoint(
    points: Array<{ x: number; y: number }>,
    ratio: number,
  ): { x: number; y: number } {
    if (points.length === 0) return { x: 0, y: 0 }
    if (points.length === 1) return points[0]

    const lengths: number[] = []
    let totalLength = 0
    for (let index = 0; index < points.length - 1; index++) {
      const start = points[index]
      const end = points[index + 1]
      const length = Math.hypot(end.x - start.x, end.y - start.y)
      lengths.push(length)
      totalLength += length
    }

    if (totalLength <= 1e-6) return points[Math.round((points.length - 1) * ratio)] ?? points[0]

    const target = totalLength * Math.max(0, Math.min(1, ratio))
    let traversed = 0
    for (let index = 0; index < lengths.length; index++) {
      const length = lengths[index]
      if (traversed + length < target) {
        traversed += length
        continue
      }
      const start = points[index]
      const end = points[index + 1]
      const localRatio = length > 1e-6 ? (target - traversed) / length : 0
      return {
        x: this._lerp(start.x, end.x, localRatio),
        y: this._lerp(start.y, end.y, localRatio),
      }
    }

    return points[points.length - 1]
  }

  private _computeSubgraphDepths(positioned: PositionedGraph): Map<string, number> {
    const sgDepths = new Map<string, number>()
    const graphSubgraphs = this._graph?.subgraphs
    const sortedSgs = Array.from(positioned.subgraphs.entries())
      .sort((a, b) => (b[1].width * b[1].height) - (a[1].width * a[1].height))

    for (const [sgId, sg] of sortedSgs) {
      let depth = 0
      for (const [otherId, other] of positioned.subgraphs) {
        if (otherId === sgId) continue
        const rawSubgraph = graphSubgraphs?.get(sgId)
        const rawOther = graphSubgraphs?.get(otherId)
        const nestedByMembership = rawSubgraph && rawOther && (
          rawOther.nodeIds.includes(sgId) ||
          (
            rawSubgraph.nodeIds.length > 0 &&
            rawSubgraph.nodeIds.every((nodeId) => rawOther.nodeIds.includes(nodeId)) &&
            rawSubgraph.nodeIds.length < rawOther.nodeIds.length
          )
        )
        if (nestedByMembership) {
          depth++
          continue
        }

        const sgLeft = sg.x - sg.width / 2
        const sgRight = sg.x + sg.width / 2
        const sgTop = sg.y - sg.height / 2
        const sgBottom = sg.y + sg.height / 2
        const otherLeft = other.x - other.width / 2
        const otherRight = other.x + other.width / 2
        const otherTop = other.y - other.height / 2
        const otherBottom = other.y + other.height / 2
        const fullyContained =
          sgLeft >= otherLeft &&
          sgRight <= otherRight &&
          sgTop >= otherTop &&
          sgBottom <= otherBottom
        const strictlySmaller = sg.width * sg.height < other.width * other.height
        if (fullyContained && strictlySmaller) {
          depth++
          continue
        }

        const centerContained =
          sg.x >= otherLeft &&
          sg.x <= otherRight &&
          sg.y >= otherTop &&
          sg.y <= otherBottom
        if (centerContained && strictlySmaller) {
          depth++
          continue
        }

        const overlapLeft = Math.max(sgLeft, otherLeft)
        const overlapRight = Math.min(sgRight, otherRight)
        const overlapTop = Math.max(sgTop, otherTop)
        const overlapBottom = Math.min(sgBottom, otherBottom)
        const overlapWidth = Math.max(0, overlapRight - overlapLeft)
        const overlapHeight = Math.max(0, overlapBottom - overlapTop)
        const overlapArea = overlapWidth * overlapHeight
        const sgArea = Math.max(1, sg.width * sg.height)
        const overlapRatio = overlapArea / sgArea
        if (overlapRatio >= 0.6 && strictlySmaller) {
          depth++
        }
      }
      sgDepths.set(sgId, depth)
    }

    return sgDepths
  }

  private _lerp(start: number, end: number, progress: number): number {
    return start + (end - start) * progress
  }

  /**
   * Blueprint bus lines: when one source node has multiple edges to different targets,
   * draw a single trunk wire from the source, then fan out horizontally to each target.
   * This prevents multiple parallel wires from the same source port.
   * Returns a Graphics object with the bus lines, or null if no buses needed.
   */
  /** Check if a vertical line at x from y1 to y2 hits any node (excluding given IDs) */
  private _verticalHitsNode(x: number, y1: number, y2: number, positioned: PositionedGraph, excludeIds: Set<string>): boolean {
    const minY = Math.min(y1, y2)
    const maxY = Math.max(y1, y2)
    for (const [id, node] of positioned.nodes) {
      if (excludeIds.has(id)) continue
      const hw = node.width / 2 + 8
      const hh = node.height / 2 + 8
      if (x >= node.x - hw && x <= node.x + hw && maxY >= node.y - hh && minY <= node.y + hh) {
        return true
      }
    }
    return false
  }

  /** Find a clear vertical X lane near targetX that doesn't hit nodes */
  private _findClearVerticalLane(targetX: number, y1: number, y2: number, positioned: PositionedGraph, excludeIds: Set<string>, gridSize: number): number {
    if (!this._verticalHitsNode(targetX, y1, y2, positioned, excludeIds)) return targetX
    // Try offsets left and right
    for (let i = 1; i <= 15; i++) {
      const leftX = Math.round((targetX - i * gridSize) / gridSize) * gridSize
      if (!this._verticalHitsNode(leftX, y1, y2, positioned, excludeIds)) return leftX
      const rightX = Math.round((targetX + i * gridSize) / gridSize) * gridSize
      if (!this._verticalHitsNode(rightX, y1, y2, positioned, excludeIds)) return rightX
    }
    return targetX // give up
  }

  /** Check if a horizontal line at y from x1 to x2 hits any node */
  private _horizontalHitsNode(y: number, x1: number, x2: number, positioned: PositionedGraph, excludeIds: Set<string>): boolean {
    const minX = Math.min(x1, x2)
    const maxX = Math.max(x1, x2)
    for (const [id, node] of positioned.nodes) {
      if (excludeIds.has(id)) continue
      const hw = node.width / 2 + 8
      const hh = node.height / 2 + 8
      if (y >= node.y - hh && y <= node.y + hh && maxX >= node.x - hw && minX <= node.x + hw) {
        return true
      }
    }
    return false
  }

  private _drawBlueprintBusLines(positioned: PositionedGraph, theme: Theme, busSourceIds: Set<string>, wireReg?: WireRegistry): void {
    if (!this._graph || !this._viewport) return

    const gridSize = (theme as any).gridSize ?? 20
    const color = theme.edgeColor

    const bySource = new Map<string, typeof positioned.edges>()
    for (const edge of positioned.edges) {
      const group = bySource.get(edge.source) ?? []
      group.push(edge)
      bySource.set(edge.source, group)
    }

    for (const [sourceId, edges] of bySource) {
      if (!busSourceIds.has(sourceId)) continue

      const srcNode = positioned.nodes.get(sourceId)
      if (!srcNode) continue

      const srcPortY = srcNode.y + srcNode.height / 2
      const targetIds = new Set(edges.map(e => e.target))
      const excludeIds = new Set([sourceId, ...targetIds])

      const targets = edges.map(e => {
        const tgt = positioned.nodes.get(e.target)
        return tgt ? { id: e.target, x: tgt.x, y: tgt.y - tgt.height / 2 } : null
      }).filter(Boolean) as Array<{ id: string; x: number; y: number }>

      if (targets.length < 2) continue

      const minTargetY = Math.min(...targets.map(t => t.y))

      // 1. Find trunkX
      const trunkX = wireReg
        ? wireReg.findFreeVertical(srcNode.x, srcPortY, minTargetY)
        : this._findClearVerticalLane(srcNode.x, srcPortY, minTargetY, positioned, excludeIds, gridSize)

      // 2. Find busY using estimated extent
      const estMinBusX = Math.min(trunkX, ...targets.map(t => t.x))
      const estMaxBusX = Math.max(trunkX, ...targets.map(t => t.x))
      const baseBusY = Math.round(((srcPortY + minTargetY) / 2) / gridSize) * gridSize
      const busY = wireReg
        ? wireReg.findFreeHorizontal(baseBusY, estMinBusX, estMaxBusX)
        : baseBusY

      // 3. Claim trunk vertical + horizontal jog
      wireReg?.claimVertical(trunkX, srcPortY, busY)
      if (trunkX !== srcNode.x) {
        wireReg?.claimHorizontal(srcPortY, srcNode.x, trunkX)
      }

      // 4. Find + claim each drop SEQUENTIALLY — store results
      const drops: Array<{ tgt: typeof targets[0]; dropX: number }> = []
      for (const tgt of targets) {
        const dropX = wireReg
          ? wireReg.findFreeVertical(tgt.x, busY, tgt.y)
          : tgt.x
        wireReg?.claimVertical(dropX, busY, tgt.y)
        if (dropX !== tgt.x) {
          wireReg?.claimHorizontal(tgt.y, dropX, tgt.x)
        }
        drops.push({ tgt, dropX })
      }

      // 5. Compute bus extent from actual drop positions (I16)
      const minBusX = Math.min(trunkX, ...drops.map(d => d.dropX))
      const maxBusX = Math.max(trunkX, ...drops.map(d => d.dropX))

      // 6. Claim the horizontal bus with corrected extent
      wireReg?.claimHorizontal(busY, minBusX, maxBusX)

      // 7. Draw everything using pre-computed positions
      const busGfx = new Graphics()
      const busSegments: WireSegment[] = []

      // Trunk: source → trunkX → busY
      busGfx.moveTo(srcNode.x, srcPortY)
      if (trunkX !== srcNode.x) busGfx.lineTo(trunkX, srcPortY)
      busGfx.lineTo(trunkX, busY)

      // Record trunk segments
      if (trunkX !== srcNode.x) {
        busSegments.push({ x1: srcNode.x, y1: srcPortY, x2: trunkX, y2: srcPortY, isHorizontal: true, edgeId: `bus:${sourceId}` })
      }
      busSegments.push({ x1: trunkX, y1: srcPortY, x2: trunkX, y2: busY, isHorizontal: false, edgeId: `bus:${sourceId}` })

      // Horizontal bus
      busGfx.moveTo(minBusX, busY)
      busGfx.lineTo(maxBusX, busY)

      busSegments.push({ x1: minBusX, y1: busY, x2: maxBusX, y2: busY, isHorizontal: true, edgeId: `bus:${sourceId}` })

      // Fan-out drops: draw using pre-computed positions
      for (const { tgt, dropX } of drops) {
        busGfx.moveTo(dropX, busY)
        busGfx.lineTo(dropX, tgt.y)
        if (dropX !== tgt.x) {
          busGfx.lineTo(tgt.x, tgt.y)
        }

        busSegments.push({ x1: dropX, y1: busY, x2: dropX, y2: tgt.y, isHorizontal: false, edgeId: `bus:${sourceId}` })
        if (dropX !== tgt.x) {
          busSegments.push({ x1: dropX, y1: tgt.y, x2: tgt.x, y2: tgt.y, isHorizontal: true, edgeId: `bus:${sourceId}` })
        }

        // Arrow at fan-out endpoint pointing into target
        const prevPt = dropX !== tgt.x
          ? { x: dropX, y: tgt.y }    // horizontal jog: arrow points right/left
          : { x: dropX, y: busY }     // straight drop: arrow points down
        const angle = Math.atan2(tgt.y - prevPt.y, tgt.x - prevPt.x)
        const arrowSize = 6
        busGfx.moveTo(tgt.x, tgt.y)
        busGfx.lineTo(tgt.x - arrowSize * Math.cos(angle - Math.PI / 6), tgt.y - arrowSize * Math.sin(angle - Math.PI / 6))
        busGfx.moveTo(tgt.x, tgt.y)
        busGfx.lineTo(tgt.x - arrowSize * Math.cos(angle + Math.PI / 6), tgt.y - arrowSize * Math.sin(angle + Math.PI / 6))
      }

      busGfx.stroke({ width: 1.5, color })
      ;(busGfx as any)._wireSegments = busSegments
      ;(busGfx as any)._targetIds = targets.map(t => t.id)
      this._busGraphics.set(sourceId, busGfx)
      this._viewport.addChild(busGfx)
    }
  }
}
