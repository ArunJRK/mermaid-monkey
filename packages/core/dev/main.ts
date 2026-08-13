import { Application } from 'pixi.js'
import { MermaidRenderer, buildGraph, normalizeDiagramPath } from '../src/index'
import type { LinkResolver } from '../src/index'
import { NodeSprite } from '../src/renderer/node-sprite'
import { EdgeGraphic } from '../src/renderer/edge-graphic'
import { SubgraphContainer } from '../src/renderer/subgraph-container'
import { getTheme } from '../src/renderer/theme'
import { BlueprintWireBuilder } from '../src/router/blueprint-wire-builder'

const canvas = document.getElementById('canvas') as HTMLCanvasElement
const canvasWrap = document.getElementById('canvas-wrap') as HTMLDivElement
const breadcrumbEl = document.getElementById('breadcrumb') as HTMLDivElement
const statusEl = document.getElementById('status') as HTMLDivElement
const toolbarEl = document.getElementById('toolbar') as HTMLDivElement
const renderer = new MermaidRenderer()

type DevSnapshot = {
  currentFile: string
  currentLayout: string
  backgroundColor: number | null
  fileHistory: string[]
  nodeCount: number
  edgeCount: number
  subgraphCount: number
  selectedNodeId: string | null
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  focusStack: string[]
  renderedBounds: { minX: number; minY: number; maxX: number; maxY: number } | null
  viewportScale: number | null
  viewportPosition: { x: number; y: number } | null
  backend: string | null
  foldedSubgraphs: string[]
  brokenLinks: string[]
  statusMessage: string
  statusLevel: string
  performanceMode: string
  viewportLayerIndex: number | null
  overlayLayerIndex: number | null
  viewportAlpha: number | null
  canvasClientSize: { width: number; height: number } | null
  canvasPixelSize: { width: number; height: number } | null
  devicePixelRatio: number | null
}

type Rect = {
  x: number
  y: number
  width: number
  height: number
}

type RenderedNodeMetrics = {
  id: string
  shape: string
  alpha: number
  center: { x: number; y: number }
  displayWidth: number
  displayHeight: number
  shapeBounds: Rect
  labelBounds: Rect
  hoverBounds: Rect
  hoverVisible: boolean
  layerIndex: number
  labelFill: number
  labelFontFamily: string
  labelText: string
  labelSegmentFontFamilies: string[]
  nodeFill: number
  nodeStroke: number
  brokenBadgeAccent: number | null
  badgeKind: 'valid' | 'broken' | null
  hoverAlpha: number
  selectionAlpha: number
  shapeLayerIndex: number
  labelLayerIndex: number
  badgeLayerIndex: number | null
  hoverLayerIndex: number
  selectionLayerIndex: number
}

type RenderedEdgeMetrics = {
  id: string
  source: string
  target: string
  alpha: number
  hovered: boolean
  selected: boolean
  layerIndex: number
  points: Array<{ x: number; y: number }>
  screenPoints: Array<{ x: number; y: number }>
  routedSegments: Array<{ x1: number; y1: number; x2: number; y2: number; isHorizontal: boolean }>
  bounds: Rect
  hitBounds: Rect | null
  hitPadding: number
  labelBounds: Rect | null
  strokeColor: number
  labelFill: number | null
  labelVisible: boolean
  labelFontFamily: string | null
  arrowTip: { x: number; y: number } | null
  arrowWingA: { x: number; y: number } | null
  arrowWingB: { x: number; y: number } | null
  arrowAngle: number | null
}

type RenderedSubgraphMetrics = {
  id: string
  depth: number
  nodeIds: string[]
  alpha: number
  layerIndex: number
  bounds: Rect
  fillColor: number
  labelFill: number
  labelFontFamily: string
  labelText: string
  labelBounds: Rect
  accent: number
  chevronVisible: boolean
  badgeVisible: boolean
  badgeText: string | null
  badgeBounds: Rect | null
  badgeTextBounds: Rect | null
}

type LifecycleProbe = {
  sameCanvasRemountSucceeded: boolean
  secondMountOtherCanvasError: string | null
  foreignCanvasOwnershipError: string | null
  loadAfterDestroyError: string | null
  setPhilosophyAfterDestroyError: string | null
  mountAfterDestroyError: string | null
}

type MountFailureProbe = {
  mountError: string | null
  sampledAlphaSum: number
}

type BackendUnavailableProbe = {
  mountError: string | null
  sampledAlphaSum: number
}

type WebGpuRecoveryProbe = {
  done: boolean
  error: string | null
  initialBackend: string | null
  recoveredBackend: string | null
  initialNodeCount: number
  recoveredNodeCount: number
  warningMessages: string[]
  steps: string[]
}

type NodeScreenBounds = {
  x: number
  y: number
  width: number
  height: number
}

type OverlayState = {
  visible: boolean
  text: string | null
}

type PreviewState = {
  visible: boolean
  targetFile: string | null
  bounds: Rect | null
  popupHovered: boolean
  stageLayerIndex: number | null
  philosophy: string | null
  nodeLabels: string[]
  nodeFontFamilies: string[]
  titleFontFamily: string | null
  cacheSize: number
  cachedTargets: string[]
}

type PreviewCacheProbe = {
  cacheSize: number
  cachedTargets: string[]
  evictedOldest: boolean
  touchedTargetRetained: boolean
  newestTargetPresent: boolean
}

type ViewportRecoveryProbe = {
  strandedOffscreen: boolean
  recoveredVisible: boolean
  recoveredScale: number | null
  recoveredPosition: { x: number; y: number } | null
}

type OverlapProbeState = {
  loaded: boolean
  topNodeId: string | null
  bottomNodeId: string | null
}

type SceneInventory = {
  viewportChildCount: number
  nodeSpriteChildren: number
  edgeGraphicChildren: number
  subgraphChildren: number
  unknownChildren: number
  orphanNodeSprites: string[]
  orphanEdgeGraphics: string[]
  orphanSubgraphs: string[]
  duplicateNodeSpriteIds: string[]
  duplicateEdgeGraphicIds: string[]
  duplicateSubgraphIds: string[]
}

declare global {
  interface Window {
    __MERMAID_DEV__?: {
      loadFile(filePath: string, targetNode?: string): Promise<boolean>
      loadSource(source: string, sourcePath?: string): Promise<boolean>
      navigateTo(filePath: string, targetNode?: string): Promise<boolean>
      clickLink(nodeId: string): boolean
      selectNode(nodeId: string | null, options?: { additive?: boolean }): void
      selectEdge(edgeId: string | null, options?: { additive?: boolean }): void
      forceHoverNode(nodeId: string | null): void
      setLayout(layout: string): void
      setThemeMode(mode: 'system' | 'dark' | 'light'): void
      foldNode(id: string): void
      unfoldNode(id: string): void
      foldAll(): void
      unfoldAll(): void
      focusSubgraph(id: string): void
      focusOut(): void
      fitToView(): void
      setRelativeZoom(multiplier: number): number | null
      nudgeViewport(dx: number, dy: number): { x: number; y: number } | null
      snapshot(): DevSnapshot
      getRenderedNodeMetrics(): RenderedNodeMetrics[]
      getRenderedEdgeMetrics(): RenderedEdgeMetrics[]
      getRenderedSubgraphMetrics(): RenderedSubgraphMetrics[]
      runSubgraphDepthProbe(layout: string): RenderedSubgraphMetrics[]
      runBlueprintRenderedFootprintProbe(): Promise<boolean>
      runBlueprintFallbackProbe(): Promise<boolean>
      runUnrelatedNodeCrossingProbe(): Promise<boolean>
      getNodeScreenBounds(nodeId: string): NodeScreenBounds | null
      getOverlayState(): OverlayState
      getPreviewState(): PreviewState
      runViewportRecoveryProbe(nodeId: string): Promise<ViewportRecoveryProbe>
      runPreviewCacheProbe(): Promise<PreviewCacheProbe>
      getSceneInventory(): SceneInventory
      setFileOverride(targetFile: string, source: string, delayMs?: number): void
      clearFileOverrides(targetFile?: string): void
      setPreviewOverride(targetFile: string, source: string, delayMs?: number): void
      clearPreviewOverrides(targetFile?: string): void
      loadHoverOverlapProbe(): Promise<OverlapProbeState>
      loadStressGraph(nodeCount?: number): Promise<boolean>
      runLifecycleProbe(): Promise<LifecycleProbe>
      runMountFailureProbe(): Promise<MountFailureProbe>
      runBackendUnavailableProbe(): Promise<BackendUnavailableProbe>
      startWebGpuRecoveryProbe(): void
      getWebGpuRecoveryProbe(): WebGpuRecoveryProbe | null
    }
  }
}

const RAW_EXAMPLES = import.meta.glob([
  '../../../examples/**/*.mmd',
  '!../../../examples/blueprint-classes.mmd',
], {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

function normalizeModulePath(modulePath: string): string {
  const marker = '/examples/'
  const idx = modulePath.lastIndexOf(marker)
  if (idx === -1) throw new Error(`Unexpected example module path: ${modulePath}`)
  return modulePath.slice(idx)
}

const EXAMPLE_LOADERS = new Map<string, () => Promise<string>>(
  Object.entries(RAW_EXAMPLES)
    .map(([modulePath, loadSource]) => [normalizeModulePath(modulePath), loadSource] as const)
    .sort(([a], [b]) => a.localeCompare(b)),
)
const DEMO_VISIBLE_EXAMPLES = Array.from(EXAMPLE_LOADERS.keys())
const fileCache = new Map<string, string>()
const fileInflight = new Map<string, Promise<string | null>>()
const fileOverrides = new Map<string, { source: string; delayMs: number }>()
const previewOverrides = new Map<string, { source: string; delayMs: number }>()

async function readExampleFile(path: string): Promise<string | null> {
  const override = fileOverrides.get(path)
  if (override) {
    if (override.delayMs > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, override.delayMs))
    }
    return override.source
  }

  const cached = fileCache.get(path)
  if (cached !== undefined) return cached

  const inflight = fileInflight.get(path)
  if (inflight) return inflight

  const loadSource = EXAMPLE_LOADERS.get(path)
  if (!loadSource) return null

  const pending = loadSource()
    .then((source) => {
      fileCache.set(path, source)
      fileInflight.delete(path)
      return source
    })
    .catch((error) => {
      fileInflight.delete(path)
      throw error
    })

  fileInflight.set(path, pending)
  return pending
}

const fileResolver: LinkResolver = {
  canonicalize(targetFile: string, fromFile: string): string | null {
    return normalizeDiagramPath(targetFile, fromFile)
  },
  async read(canonicalFile: string): Promise<string | null> {
    return await readExampleFile(canonicalFile)
  },
}

// ── Theme styles ────────────────────────────────────────────────────────────

const THEME_STYLES: Record<string, {
  bg: string; text: string; accent: string; border: string; bodyBg: string
}> = {
  narrative: { bg: '#0d1117', text: '#8b949e', accent: '#58a6ff', border: '#30363d', bodyBg: '#0d1117' },
  map:       { bg: '#1a1a2e', text: '#7a7a9e', accent: '#e94560', border: '#0f3460', bodyBg: '#1a1a2e' },
  blueprint: { bg: '#0a192f', text: '#8892b0', accent: '#64ffda', border: '#233554', bodyBg: '#0a192f' },
  breath:    { bg: '#111111', text: '#888888', accent: '#ffffff', border: '#333333', bodyBg: '#111111' },
  radial:    { bg: '#0f0f1a', text: '#9090b0', accent: '#b07aff', border: '#2a2a4a', bodyBg: '#0f0f1a' },
  mosaic:    { bg: '#121212', text: '#909090', accent: '#ff9f43', border: '#2a2a2a', bodyBg: '#121212' },
}

let currentLayout = 'narrative'
let currentFile = '/examples/microservice/overview.mmd'
const fileHistory: string[] = []
let activeLoadToken = 0
let webGpuRecoveryProbe: WebGpuRecoveryProbe | null = null
let shellLayoutObserver: ResizeObserver | null = null

function buildStressSource(nodeCount = 240): string {
  const lines = ['graph TD']
  for (let index = 0; index < nodeCount; index++) {
    lines.push(`N${index}[Node ${index}]`)
  }
  for (let index = 0; index < nodeCount - 1; index++) {
    lines.push(`N${index} --> N${index + 1}`)
    if (index + 3 < nodeCount) lines.push(`N${index} --> N${index + 3}`)
  }
  return lines.join('\n')
}

function syncResponsiveShellLayout() {
  if (!canvasWrap || !toolbarEl) return
  if (window.innerWidth <= 700) {
    const toolbarBottom = toolbarEl.getBoundingClientRect().bottom
    canvasWrap.style.top = `${Math.ceil(toolbarBottom)}px`
    canvasWrap.style.left = '0'
  } else {
    canvasWrap.style.top = '36px'
    canvasWrap.style.left = '224px'
  }
}

// ── UI helpers ──────────────────────────────────────────────────────────────

function applyThemeStyles(layout: string) {
  const s = THEME_STYLES[layout] ?? THEME_STYLES.narrative
  breadcrumbEl.style.background = s.bg
  breadcrumbEl.style.borderColor = s.border
  breadcrumbEl.style.color = s.text
  statusEl.style.background = s.bg
  statusEl.style.borderColor = s.border
  statusEl.style.color = s.text
  document.body.style.background = s.bodyBg

  document.querySelectorAll<HTMLButtonElement>('#controls button[data-layout]').forEach(btn => {
    const isActive = btn.getAttribute('data-layout') === layout
    btn.style.background = s.bg
    btn.style.borderColor = isActive ? s.accent : s.border
    btn.style.color = isActive ? s.accent : s.text
  })
}

function setStatus(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  statusEl.textContent = message
  statusEl.dataset.level = level
  syncResponsiveShellLayout()
}

function highlightActiveFile(filePath: string) {
  document.querySelectorAll<HTMLButtonElement>('#files button').forEach(btn => {
    const isActive = btn.getAttribute('data-file') === filePath
    const s = THEME_STYLES[currentLayout] ?? THEME_STYLES.narrative
    btn.style.borderColor = isActive ? s.accent : s.border
    btn.style.color = isActive ? s.accent : s.text
  })
  syncResponsiveShellLayout()
}

function updateBreadcrumb(segments: Array<{ id: string | null; label: string }>) {
  const s = THEME_STYLES[currentLayout] ?? THEME_STYLES.narrative
  while (breadcrumbEl.firstChild) breadcrumbEl.removeChild(breadcrumbEl.firstChild)

  // File path indicator
  const fileLabel = document.createElement('span')
  fileLabel.className = 'segment file-label'
  fileLabel.textContent = currentFile
  fileLabel.style.color = s.accent
  fileLabel.style.fontWeight = '600'
  fileLabel.style.opacity = '0.7'
  fileLabel.style.marginRight = '12px'
  breadcrumbEl.appendChild(fileLabel)

  // Breadcrumb segments
  segments.forEach((seg, i) => {
    if (i > 0) {
      const sep = document.createElement('span')
      sep.className = 'separator'
      sep.textContent = '>'
      breadcrumbEl.appendChild(sep)
    }
    const isCurrent = i === segments.length - 1
    const el = document.createElement('span')
    el.className = isCurrent ? 'segment current' : 'segment'
    el.textContent = seg.label
    if (isCurrent) el.style.color = s.accent
    el.addEventListener('click', () => renderer.focusTo(i))
    breadcrumbEl.appendChild(el)
  })

  // Back button (if we navigated from another file)
  if (fileHistory.length > 0) {
    const back = document.createElement('span')
    back.className = 'segment'
    back.textContent = '← Back'
    back.style.marginLeft = '16px'
    back.style.opacity = '0.6'
    back.addEventListener('click', () => navigateBack())
    breadcrumbEl.appendChild(back)
  }

  // Hint
  const hint = document.createElement('span')
  hint.className = 'hint'
  const keys = [['Esc', 'back'], ['F', 'fit'], ['R', 'reset']]
  keys.forEach(([key, label], i) => {
    if (i > 0) hint.appendChild(document.createTextNode(' · '))
    const kbd = document.createElement('kbd')
    kbd.textContent = key
    hint.appendChild(kbd)
    hint.appendChild(document.createTextNode(` ${label}`))
  })
  breadcrumbEl.appendChild(hint)
  syncResponsiveShellLayout()
}

function resolveExample(target: string, fromFile = currentFile): { path: string; source?: string } | null {
  const path = normalizeDiagramPath(target, fromFile)
  if (!path) return null
  return { path }
}

async function loadFile(filePath: string, targetNode?: string): Promise<boolean> {
  const loadToken = ++activeLoadToken
  const resolved = resolveExample(filePath, currentFile)
  const source = resolved ? await readExampleFile(resolved.path) : null
  if (loadToken !== activeLoadToken) return false
  if (!resolved || !source) {
    setStatus(`Missing diagram: ${filePath}`, 'error')
    console.warn(`File not found: ${filePath}`)
    return false
  }

  currentFile = resolved.path
  applyThemeStyles(currentLayout)
  highlightActiveFile(resolved.path)
  setStatus(`Loading ${resolved.path}`, 'info')

  const result = await renderer.load(`%% @layout ${currentLayout}\n${source}`, {
    sourcePath: resolved.path,
    linkResolver: fileResolver,
  })
  if (loadToken !== activeLoadToken) return false

  applyThemeStyles(currentLayout)
  highlightActiveFile(resolved.path)

  if (!result.success) {
    setStatus(
      result.errors.map((error) => error.message).join('\n') || `Failed to load ${resolved.path}`,
      'error',
    )
    console.warn(`[${resolved.path}] load failed`, result.errors)
    return false
  }

  if (targetNode) {
    renderer.revealNode(targetNode)
  }

  const warningText = result.warnings.map((warning) => warning.message).join('\n')
  setStatus(
    warningText || `Loaded ${resolved.path}${targetNode ? ` → ${targetNode}` : ''}`,
    result.warnings.length > 0 ? 'warn' : 'info',
  )
  console.log(`[${resolved.path}] loaded with ${currentLayout}: OK`)
  return true
}

async function loadSource(source: string, sourcePath = '/__inline__.mmd'): Promise<boolean> {
  const loadToken = ++activeLoadToken
  currentFile = sourcePath
  applyThemeStyles(currentLayout)
  highlightActiveFile('')
  setStatus(`Loading ${sourcePath}`, 'info')

  const result = await renderer.load(`%% @layout ${currentLayout}\n${source}`, {
    sourcePath,
    linkResolver: fileResolver,
  })
  if (loadToken !== activeLoadToken) return false

  applyThemeStyles(currentLayout)
  highlightActiveFile('')

  if (!result.success) {
    setStatus(
      result.errors.map((error) => error.message).join('\n') || `Failed to load ${sourcePath}`,
      'error',
    )
    console.warn(`[${sourcePath}] load failed`, result.errors)
    return false
  }

  const warningText = result.warnings.map((warning) => warning.message).join('\n')
  setStatus(
    warningText || `Loaded ${sourcePath}`,
    result.warnings.length > 0 ? 'warn' : 'info',
  )
  console.log(`[${sourcePath}] loaded with ${currentLayout}: OK`)
  return true
}

async function navigateToFile(filePath: string, targetNode?: string) {
  fileHistory.push(currentFile)
  const success = await loadFile(filePath, targetNode)
  if (!success) fileHistory.pop()
  return success
}

function navigateBack() {
  const prev = fileHistory.pop()
  if (prev) void loadFile(prev)
}

function getSnapshot(): DevSnapshot {
  const state = renderer as any
  const viewport = state._viewport as { scale?: { x: number }; position?: { x: number; y: number } } | null
  const app = state._app as { renderer?: { type?: number } } | null
  const backgroundColor = (app as any)?.renderer?.background?.color
  const backend = app?.renderer?.type === 0x1
    ? 'WebGL'
    : app?.renderer?.type === 0x2
      ? 'WebGPU'
      : null

  return {
    currentFile,
    currentLayout,
    backgroundColor: typeof backgroundColor === 'number'
      ? backgroundColor
      : backgroundColor?._value ?? null,
    fileHistory: [...fileHistory],
    nodeCount: state._nodeSprites.size,
    edgeCount: state._edgeGraphics.length,
    subgraphCount: state._subgraphContainers.size,
    selectedNodeId: state._selectedNodeId,
    selectedNodeIds: Array.from((state._selectedNodeIds as Set<string> | undefined) ?? []),
    selectedEdgeIds: Array.from((state._selectedEdgeIds as Set<string> | undefined) ?? []),
    focusStack: [...state._focusStack],
    renderedBounds: state._renderedBounds
      ? { ...state._renderedBounds }
      : null,
    viewportScale: viewport?.scale?.x ?? null,
    viewportPosition: viewport?.position
      ? { x: viewport.position.x, y: viewport.position.y }
      : null,
    backend,
    foldedSubgraphs: state._foldManager
      ? Array.from(state._graph?.subgraphs.keys() ?? []).filter((id) => state._graph?.subgraphs.get(id)?.collapsed)
      : [],
    brokenLinks: Array.from((state._linkStates as Map<string, { status: string }> | undefined)?.entries() ?? [])
      .filter(([, linkState]) => linkState.status === 'broken')
      .map(([nodeId]) => nodeId),
    statusMessage: statusEl.textContent ?? '',
    statusLevel: statusEl.dataset.level ?? '',
    performanceMode: state._performanceMode ?? 'normal',
    viewportLayerIndex: state._app?.stage && state._viewport
      ? state._app.stage.getChildIndex(state._viewport)
      : null,
    overlayLayerIndex: state._app?.stage && state._messageOverlay
      ? state._app.stage.getChildIndex(state._messageOverlay)
      : null,
    viewportAlpha: typeof viewport?.alpha === 'number' ? viewport.alpha : null,
    canvasClientSize: canvas
      ? { width: canvas.clientWidth, height: canvas.clientHeight }
      : null,
    canvasPixelSize: canvas
      ? { width: canvas.width, height: canvas.height }
      : null,
    devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio ?? null : null,
  }
}

function getNodeScreenBounds(nodeId: string): NodeScreenBounds | null {
  const state = renderer as any
  const sprite = (state._nodeSprites as Map<string, { getBounds(): { x: number; y: number; width: number; height: number } }> | undefined)?.get(nodeId)
  if (!sprite) return null

  const bounds = sprite.getBounds()
  const rect = canvas.getBoundingClientRect()
  return {
    x: rect.left + bounds.x,
    y: rect.top + bounds.y,
    width: bounds.width,
    height: bounds.height,
  }
}

function getOverlayState(): OverlayState {
  const state = renderer as any
  const overlay = state._messageOverlay as { children?: Array<{ text?: string }> } | null
  if (!overlay) {
    return { visible: false, text: null }
  }
  const text = overlay.children
    ?.map((child) => ('text' in child && typeof child.text === 'string' ? child.text : ''))
    .filter(Boolean)
    .join('\n') ?? null
  return {
    visible: true,
    text,
  }
}

function getRenderedNodeMetrics(): RenderedNodeMetrics[] {
  const state = renderer as any
  const sprites = state._nodeSprites as Map<string, {
    getShapeBounds(): Rect
    getLabelBounds(): Rect
    getHoverBounds(): Rect
    isHovered(): boolean
    getDebugStyle(): {
      labelFill: number
      labelFontFamily: string
      labelText: string
      labelSegmentFontFamilies: string[]
      nodeFill: number
      nodeStroke: number
      brokenBadgeAccent: number | null
      badgeKind: 'valid' | 'broken' | null
      hoverAlpha: number
      selectionAlpha: number
      shapeLayerIndex: number
      labelLayerIndex: number
      badgeLayerIndex: number | null
      hoverLayerIndex: number
      selectionLayerIndex: number
    }
  }> | undefined
  if (!sprites) return []
  return Array.from(sprites.entries()).map(([id, sprite]) => ({
    id,
    shape: (sprite as any).data?.shape ?? 'unknown',
    alpha: (sprite as any).alpha ?? 1,
    center: {
      x: (sprite as any).x ?? 0,
      y: (sprite as any).y ?? 0,
    },
    displayWidth: (sprite as any)._displayWidth ?? 0,
    displayHeight: (sprite as any)._displayHeight ?? 0,
    shapeBounds: sprite.getShapeBounds(),
    labelBounds: sprite.getLabelBounds(),
    hoverBounds: sprite.getHoverBounds(),
    hoverVisible: sprite.isHovered(),
    layerIndex: (sprite as any).parent?.getChildIndex(sprite as any) ?? -1,
    ...sprite.getDebugStyle(),
  }))
}

function getPreviewState(): PreviewState {
  const state = renderer as any
  const preview = state._linkPreview as {
    getDebugState?: () => PreviewState
  } | null
  return preview?.getDebugState?.() ?? {
    visible: false,
    targetFile: null,
    bounds: null,
    popupHovered: false,
    stageLayerIndex: null,
    philosophy: null,
    nodeLabels: [],
    nodeFontFamilies: [],
    titleFontFamily: null,
    cacheSize: 0,
    cachedTargets: [],
  }
}

async function runViewportRecoveryProbe(nodeId: string): Promise<ViewportRecoveryProbe> {
  const state = renderer as any
  const viewport = state._viewport as {
    x: number
    y: number
    _zoom: number
    scale: { set(value: number): void }
    onZoomChange?: ((zoom: number) => void) | null
  } | null

  if (!viewport) {
    return {
      strandedOffscreen: false,
      recoveredVisible: false,
      recoveredScale: null,
      recoveredPosition: null,
    }
  }

  viewport._zoom = 0.05
  viewport.scale.set(0.05)
  viewport.x = -20000
  viewport.y = -20000
  viewport.onZoomChange?.(viewport._zoom)

  const strandedBounds = getNodeScreenBounds(nodeId)
  const canvasRect = canvas.getBoundingClientRect()
  const strandedOffscreen = !strandedBounds
    || strandedBounds.x + strandedBounds.width < canvasRect.left
    || strandedBounds.y + strandedBounds.height < canvasRect.top
    || strandedBounds.x > canvasRect.right
    || strandedBounds.y > canvasRect.bottom

  renderer.fitToView()
  const app = state._app as { renderer?: { render(stage: unknown): void }; stage?: unknown } | null
  app?.renderer?.render(app.stage)
  await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)))

  const recoveredBounds = getNodeScreenBounds(nodeId)
  const recoveredVisible = Boolean(
    recoveredBounds
    && recoveredBounds.width > 0
    && recoveredBounds.height > 0
    && recoveredBounds.x + recoveredBounds.width > canvasRect.left
    && recoveredBounds.y + recoveredBounds.height > canvasRect.top
    && recoveredBounds.x < canvasRect.right
    && recoveredBounds.y < canvasRect.bottom,
  )

  return {
    strandedOffscreen,
    recoveredVisible,
    recoveredScale: state._viewport?.scale?.x ?? null,
    recoveredPosition: state._viewport?.position
      ? { x: state._viewport.position.x, y: state._viewport.position.y }
      : null,
  }
}

async function runPreviewCacheProbe(): Promise<PreviewCacheProbe> {
  const state = renderer as any
  const preview = state._linkPreview as {
    invalidate?: (targetFile?: string) => void
    cacheGraph?: (targetFile: string, graph: Awaited<ReturnType<typeof buildGraph>>) => void
    touchCachedTarget?: (targetFile: string) => boolean
    getDebugState?: () => PreviewState
  } | null

  if (!preview?.invalidate || !preview.cacheGraph || !preview.touchCachedTarget || !preview.getDebugState) {
    return {
      cacheSize: 0,
      cachedTargets: [],
      evictedOldest: false,
      touchedTargetRetained: false,
      newestTargetPresent: false,
    }
  }

  preview.invalidate()

  for (let index = 0; index < 12; index++) {
    const targetFile = `/__preview-cache__/target-${index}.mmd`
    const graph = await buildGraph(`graph TD
  N${index}[Node ${index}]
`, { sourcePath: targetFile })
    preview.cacheGraph(targetFile, graph)
  }

  const touchedTarget = '/__preview-cache__/target-0.mmd'
  preview.touchCachedTarget(touchedTarget)

  const newestTarget = '/__preview-cache__/target-12.mmd'
  const newestGraph = await buildGraph(`graph TD
  N12[Node 12]
`, { sourcePath: newestTarget })
  preview.cacheGraph(newestTarget, newestGraph)

  const debug = preview.getDebugState()
  return {
    cacheSize: debug.cacheSize,
    cachedTargets: debug.cachedTargets,
    evictedOldest: !debug.cachedTargets.includes('/__preview-cache__/target-1.mmd'),
    touchedTargetRetained: debug.cachedTargets.includes(touchedTarget),
    newestTargetPresent: debug.cachedTargets.includes(newestTarget),
  }
}

function getSceneInventory(): SceneInventory {
  const state = renderer as any
  const viewport = state._viewport as { children?: unknown[] } | null
  const nodeSprites = state._nodeSprites as Map<string, unknown> | undefined
  const edgeGraphics = state._edgeGraphics as Array<{ data?: { id?: string } }> | undefined
  const subgraphContainers = state._subgraphContainers as Map<string, unknown> | undefined
  const children = viewport?.children ?? []

  const nodeIds = new Set<string>()
  const edgeIds = new Set<string>()
  const subgraphIds = new Set<string>()
  const orphanNodeSprites: string[] = []
  const orphanEdgeGraphics: string[] = []
  const orphanSubgraphs: string[] = []
  const duplicateNodeSpriteIds: string[] = []
  const duplicateEdgeGraphicIds: string[] = []
  const duplicateSubgraphIds: string[] = []

  let nodeSpriteChildren = 0
  let edgeGraphicChildren = 0
  let subgraphChildren = 0
  let unknownChildren = 0

  for (const child of children) {
    if (child instanceof NodeSprite) {
      nodeSpriteChildren += 1
      const id = child.data.id
      if (nodeIds.has(id)) duplicateNodeSpriteIds.push(id)
      nodeIds.add(id)
      if (!nodeSprites?.has(id)) orphanNodeSprites.push(id)
      continue
    }
    if (child instanceof EdgeGraphic) {
      edgeGraphicChildren += 1
      const id = child.data.id
      if (edgeIds.has(id)) duplicateEdgeGraphicIds.push(id)
      edgeIds.add(id)
      const known = edgeGraphics?.some((graphic) => graphic === child || graphic.data?.id === id) ?? false
      if (!known) orphanEdgeGraphics.push(id)
      continue
    }
    if (child instanceof SubgraphContainer) {
      subgraphChildren += 1
      const id = child.data.id
      if (subgraphIds.has(id)) duplicateSubgraphIds.push(id)
      subgraphIds.add(id)
      if (!subgraphContainers?.has(id)) orphanSubgraphs.push(id)
      continue
    }
    unknownChildren += 1
  }

  return {
    viewportChildCount: children.length,
    nodeSpriteChildren,
    edgeGraphicChildren,
    subgraphChildren,
    unknownChildren,
    orphanNodeSprites,
    orphanEdgeGraphics,
    orphanSubgraphs,
    duplicateNodeSpriteIds,
    duplicateEdgeGraphicIds,
    duplicateSubgraphIds,
  }
}

async function loadHoverOverlapProbe(): Promise<OverlapProbeState> {
  fileHistory.length = 0
  currentFile = '/__hover-overlap__.mmd'
  highlightActiveFile('')
  setStatus('Loading hover overlap probe', 'info')

  const result = await renderer.load(`%% @layout narrative
graph TD
  A[Bottom Node]
  B[Top Node]
`, {
    sourcePath: currentFile,
    linkResolver: fileResolver,
  })

  if (!result.success) {
    setStatus(result.errors.map((error) => error.message).join('\n') || 'Hover overlap probe failed to load', 'error')
    return { loaded: false, topNodeId: null, bottomNodeId: null }
  }

  const state = renderer as any
  const sprites = state._nodeSprites as Map<string, { x: number; y: number; parent?: { addChild(sprite: unknown): void } }> | undefined
  const bottom = sprites?.get('A')
  const top = sprites?.get('B')
  if (!bottom || !top) {
    setStatus('Hover overlap probe missing nodes', 'error')
    return { loaded: false, topNodeId: null, bottomNodeId: null }
  }

  top.x = bottom.x
  top.y = bottom.y
  top.parent?.addChild(top)
  state._touchRuntimeActivity?.()
  setStatus('Loaded hover overlap probe', 'info')

  return {
    loaded: true,
    topNodeId: 'B',
    bottomNodeId: 'A',
  }
}

function getRenderedEdgeMetrics(): RenderedEdgeMetrics[] {
  const state = renderer as any
  const edges = state._edgeGraphics as Array<{
    data?: { id: string; source: string; target: string; points: Array<{ x: number; y: number }> }
    orthogonalSegments?: Array<{ x1: number; y1: number; x2: number; y2: number; isHorizontal: boolean }>
    getBounds(): Rect
    getHitBounds?: () => Rect | null
    getHitPadding?: () => number
    isHovered?: () => boolean
    getLabelBounds?: () => Rect | null
    getDebugStyle?: () => {
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
    }
  }> | undefined
  const viewport = state._viewport as { x: number; y: number; scale: { x: number; y: number } } | null
  if (!edges) return []
  const scaleX = viewport?.scale.x ?? 1
  const scaleY = viewport?.scale.y ?? 1
  const offsetX = viewport?.x ?? 0
  const offsetY = viewport?.y ?? 0
  return edges
    .map((edge) => edge.data)
    .filter((edge): edge is NonNullable<typeof edge> => Boolean(edge))
    .map((edge, index) => {
      const graphic = edges[index]
      const bounds = graphic.getBounds()
      const hitBounds = graphic.getHitBounds?.() ?? null
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        alpha: (graphic as any).alpha ?? 1,
        hovered: graphic.isHovered?.() ?? false,
        selected: graphic.getDebugStyle?.().selected ?? false,
        layerIndex: (graphic as any).parent?.getChildIndex(graphic as any) ?? -1,
        points: edge.points.map((point) => ({ x: point.x, y: point.y })),
        screenPoints: edge.points.map((point) => ({
          x: point.x * scaleX + offsetX,
          y: point.y * scaleY + offsetY,
        })),
        routedSegments: (graphic.orthogonalSegments ?? []).map((segment) => ({
          x1: segment.x1,
          y1: segment.y1,
          x2: segment.x2,
          y2: segment.y2,
          isHorizontal: segment.isHorizontal,
        })),
        bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
        hitBounds: hitBounds
          ? {
              x: hitBounds.x * scaleX + offsetX,
              y: hitBounds.y * scaleY + offsetY,
              width: hitBounds.width * Math.abs(scaleX),
              height: hitBounds.height * Math.abs(scaleY),
            }
          : null,
        hitPadding: graphic.getHitPadding?.() ?? 0,
        labelBounds: graphic.getLabelBounds?.() ?? null,
        strokeColor: graphic.getDebugStyle?.().strokeColor ?? 0,
        labelFill: graphic.getDebugStyle?.().labelFill ?? null,
        labelVisible: graphic.getDebugStyle?.().labelVisible ?? false,
        labelFontFamily: graphic.getDebugStyle?.().labelFontFamily ?? null,
        arrowTip: graphic.getDebugStyle?.().arrowTip ?? null,
        arrowWingA: graphic.getDebugStyle?.().arrowWingA ?? null,
        arrowWingB: graphic.getDebugStyle?.().arrowWingB ?? null,
        arrowAngle: graphic.getDebugStyle?.().arrowAngle ?? null,
        erSourceCardinality: graphic.getDebugStyle?.().erSourceCardinality ?? null,
        erTargetCardinality: graphic.getDebugStyle?.().erTargetCardinality ?? null,
      }
    })
}

async function runBlueprintRenderedFootprintProbe(): Promise<boolean> {
  fileHistory.length = 0
  currentFile = '/__blueprint-rendered-footprint__.mmd'
  currentLayout = 'blueprint'
  applyThemeStyles(currentLayout)
  highlightActiveFile('')

  const state = renderer as any
  const graph = {
    nodes: new Map([
      ['A', { id: 'A', label: 'Source', shape: 'rectangle', metadata: {}, x: 100, y: 60, width: 160, height: 44 }],
      ['B', { id: 'B', label: 'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM', shape: 'rectangle', metadata: {}, x: 100, y: 150, width: 160, height: 44 }],
      ['C', { id: 'C', label: 'Target', shape: 'rectangle', metadata: {}, x: 100, y: 240, width: 160, height: 44 }],
    ]),
    edges: [
      {
        id: 'e1',
        source: 'A',
        target: 'C',
        style: 'solid' as const,
        points: [{ x: 100, y: 60 }, { x: 100, y: 240 }],
      },
    ],
    subgraphs: new Map(),
    directives: [],
    direction: 'TD',
    diagramType: 'flowchart' as const,
  }
  const positioned = {
    nodes: new Map([
      ['A', { id: 'A', label: 'Source', shape: 'rectangle', metadata: {}, x: 100, y: 60, width: 160, height: 44 }],
      ['B', { id: 'B', label: 'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM', shape: 'rectangle', metadata: {}, x: 100, y: 150, width: 160, height: 44 }],
      ['C', { id: 'C', label: 'Target', shape: 'rectangle', metadata: {}, x: 100, y: 240, width: 160, height: 44 }],
    ]),
    edges: [
      {
        id: 'e1',
        source: 'A',
        target: 'C',
        style: 'solid' as const,
        points: [{ x: 100, y: 60 }, { x: 100, y: 240 }],
      },
    ],
    subgraphs: new Map(),
    width: 320,
    height: 320,
  }

  state._currentPhilosophy = 'blueprint'
  state._graph = graph
  state._positioned = positioned
  state._renderGraph(positioned)
  renderer.fitToView()
  setStatus('Loaded blueprint rendered-footprint probe', 'info')
  return true
}

async function runBlueprintFallbackProbe(): Promise<boolean> {
  fileHistory.length = 0
  currentFile = '/__blueprint-fallback__.mmd'
  currentLayout = 'blueprint'
  applyThemeStyles(currentLayout)
  highlightActiveFile('')

  const state = renderer as any
  const graph = {
    nodes: new Map([
      ['A', { id: 'A', label: 'Source', shape: 'rectangle', metadata: {}, x: 120, y: 80, width: 160, height: 44 }],
      ['B', { id: 'B', label: 'Target', shape: 'rectangle', metadata: {}, x: 120, y: 220, width: 160, height: 44 }],
    ]),
    edges: [
      {
        id: 'e1',
        source: 'A',
        target: 'B',
        style: 'solid' as const,
        points: [{ x: 120, y: 80 }, { x: 120, y: 220 }],
      },
    ],
    subgraphs: new Map(),
    directives: [],
    direction: 'TD',
    diagramType: 'flowchart' as const,
  }
  const positioned = {
    nodes: new Map([
      ['A', { id: 'A', label: 'Source', shape: 'rectangle', metadata: {}, x: 120, y: 80, width: 160, height: 44 }],
      ['B', { id: 'B', label: 'Target', shape: 'rectangle', metadata: {}, x: 120, y: 220, width: 160, height: 44 }],
    ]),
    edges: [
      {
        id: 'e1',
        source: 'A',
        target: 'B',
        style: 'solid' as const,
        points: [{ x: 120, y: 80 }, { x: 120, y: 220 }],
      },
    ],
    subgraphs: new Map(),
    width: 320,
    height: 320,
  }

  const originalRouteAstar = (BlueprintWireBuilder as any).prototype._routeAstar
  ;(BlueprintWireBuilder as any).prototype._routeAstar = function forcedNoPath() {
    return null
  }

  try {
    state._currentPhilosophy = 'blueprint'
    state._graph = graph
    state._positioned = positioned
    state._renderGraph(positioned)
    renderer.fitToView()
    return true
  } finally {
    ;(BlueprintWireBuilder as any).prototype._routeAstar = originalRouteAstar
  }
}

async function runUnrelatedNodeCrossingProbe(): Promise<boolean> {
  fileHistory.length = 0
  currentFile = '/__edge-node-crossing__.mmd'
  currentLayout = 'narrative'
  applyThemeStyles(currentLayout)
  highlightActiveFile('')
  setStatus('Loading edge/node crossing probe', 'info')

  const state = renderer as any
  const graph = {
    nodes: new Map([
      ['A', { id: 'A', label: 'Source', shape: 'rectangle', metadata: {}, x: 80, y: 80, width: 140, height: 44 }],
      ['B', { id: 'B', label: 'Blocker', shape: 'rectangle', metadata: {}, x: 200, y: 150, width: 160, height: 52 }],
      ['C', { id: 'C', label: 'Target', shape: 'rectangle', metadata: {}, x: 320, y: 80, width: 140, height: 44 }],
    ]),
    edges: [
      {
        id: 'e1',
        source: 'A',
        target: 'C',
        style: 'solid' as const,
        points: [{ x: 80, y: 80 }, { x: 200, y: 150 }, { x: 320, y: 80 }],
      },
    ],
    subgraphs: new Map(),
    directives: [],
    direction: 'TD',
    diagramType: 'flowchart' as const,
  }
  const positioned = {
    nodes: new Map([
      ['A', { id: 'A', label: 'Source', shape: 'rectangle', metadata: {}, x: 80, y: 80, width: 140, height: 44 }],
      ['B', { id: 'B', label: 'Blocker', shape: 'rectangle', metadata: {}, x: 200, y: 150, width: 160, height: 52 }],
      ['C', { id: 'C', label: 'Target', shape: 'rectangle', metadata: {}, x: 320, y: 80, width: 140, height: 44 }],
    ]),
    edges: [
      {
        id: 'e1',
        source: 'A',
        target: 'C',
        style: 'solid' as const,
        points: [{ x: 80, y: 80 }, { x: 200, y: 150 }, { x: 320, y: 80 }],
      },
    ],
    subgraphs: new Map(),
    width: 420,
    height: 260,
  }

  state._currentPhilosophy = 'narrative'
  state._graph = graph
  state._positioned = positioned
  state._renderGraph(positioned)
  renderer.fitToView()
  return true
}

function getRenderedSubgraphMetrics(): RenderedSubgraphMetrics[] {
  const state = renderer as any
  const subgraphs = state._subgraphContainers as Map<string, {
    data: { nodeIds: string[] }
    getBounds(): Rect
    getDebugStyle(): {
      depth: number
      fillColor: number
      labelFill: number
      labelFontFamily: string
      labelText: string
      labelBounds: Rect
      accent: number
      chevronVisible: boolean
      badgeVisible: boolean
      badgeText: string | null
      badgeBounds: Rect | null
      badgeTextBounds: Rect | null
    }
  }> | undefined
  if (!subgraphs) return []
  return Array.from(subgraphs.entries()).map(([id, subgraph]) => ({
    id,
    nodeIds: [...(subgraph.data?.nodeIds ?? [])],
    alpha: (subgraph as any).alpha ?? 1,
    layerIndex: (subgraph as any).parent?.getChildIndex(subgraph as any) ?? -1,
    bounds: (() => {
      const bounds = subgraph.getBounds()
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
    })(),
    ...subgraph.getDebugStyle(),
  }))
}

function runSubgraphDepthProbe(layout: string): RenderedSubgraphMetrics[] {
  const theme = getTheme(layout as any)
  return [0, 1, 2].map((depth) => {
    const probe = new SubgraphContainer({
      id: `probe-${depth}`,
      label: `Probe ${depth}`,
      nodeIds: [],
      collapsed: false,
      x: 0,
      y: 0,
      width: 240,
      height: 140,
    }, theme, depth)
    return {
      id: `probe-${depth}`,
      nodeIds: [],
      bounds: { x: -120, y: -70, width: 240, height: 140 },
      ...probe.getDebugStyle(),
    }
  })
}

function setRelativeZoom(multiplier: number): number | null {
  const state = renderer as any
  const viewport = state._viewport as {
    _zoom: number
    scale: { set(value: number): void }
    onZoomChange?: ((zoom: number) => void) | null
  } | null
  const fitZoom = state._fitZoom as number | undefined
  if (!viewport || !fitZoom || !Number.isFinite(multiplier) || multiplier <= 0) return null
  const nextZoom = Math.max(0.1, Math.min(5, fitZoom * multiplier))
  viewport._zoom = nextZoom
  viewport.scale.set(nextZoom)
  viewport.onZoomChange?.(nextZoom)
  return nextZoom
}

function nudgeViewport(dx: number, dy: number): { x: number; y: number } | null {
  const state = renderer as any
  const viewport = state._viewport as {
    x: number
    y: number
    position?: { x: number; y: number }
  } | null
  if (!viewport || !Number.isFinite(dx) || !Number.isFinite(dy)) return null
  viewport.x += dx
  viewport.y += dy
  return viewport.position
    ? { x: viewport.position.x, y: viewport.position.y }
    : { x: viewport.x, y: viewport.y }
}

function startWebGpuRecoveryProbe() {
  const wrapper = document.createElement('div')
  wrapper.style.position = 'fixed'
  wrapper.style.left = '-9999px'
  wrapper.style.top = '0'
  wrapper.style.width = '320px'
  wrapper.style.height = '180px'
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 180
  canvas.style.width = '320px'
  canvas.style.height = '180px'
  wrapper.appendChild(canvas)
  document.body.appendChild(wrapper)

  const probeRenderer = new MermaidRenderer()
  const source = 'graph TD\nA[Start] --> B[Done]'
  webGpuRecoveryProbe = {
    done: false,
    error: null,
    initialBackend: null,
    recoveredBackend: null,
    initialNodeCount: 0,
    recoveredNodeCount: 0,
    warningMessages: [],
    steps: [],
  }

  const finish = (error: string | null = null) => {
    if (!webGpuRecoveryProbe || webGpuRecoveryProbe.done) return
    if (error) webGpuRecoveryProbe.error = error
    webGpuRecoveryProbe.done = true
    probeRenderer.off('warn', onWarn)
    probeRenderer.destroy()
    wrapper.remove()
  }

  const onWarn = (warning: any) => {
    webGpuRecoveryProbe?.warningMessages.push(warning?.message ?? String(warning))
  }
  probeRenderer.on('warn', onWarn)

  const readBackend = () => {
    const app = (probeRenderer as any)._app as { renderer?: { type?: number } } | null
    return app?.renderer?.type === 0x2
      ? 'WebGPU'
      : app?.renderer?.type === 0x1
        ? 'WebGL'
        : null
  }

  void (async () => {
    try {
      webGpuRecoveryProbe?.steps.push('mount:start')
      await probeRenderer.mount(canvas)
      webGpuRecoveryProbe?.steps.push('mount:done')

      await probeRenderer.load(source)
      webGpuRecoveryProbe?.steps.push('load:done')

      if (!webGpuRecoveryProbe) return
      webGpuRecoveryProbe.initialBackend = readBackend()
      webGpuRecoveryProbe.initialNodeCount = (probeRenderer as any)._nodeSprites.size as number
      if (webGpuRecoveryProbe.initialBackend !== 'WebGPU') {
        finish('WebGPU adapter unavailable in current browser environment')
        return
      }

      const app = (probeRenderer as any)._app as Application | null
      const generation = (probeRenderer as any)._gpuLostGeneration as number
      webGpuRecoveryProbe.steps.push('deviceLost:invoke')
      void (probeRenderer as any)
        ._handleGpuDeviceLost(app, generation)
        .then(() => {
          webGpuRecoveryProbe?.steps.push('deviceLost:handled')
        })
        .catch((error: unknown) => {
          finish(error instanceof Error ? error.message : String(error))
        })

      const started = performance.now()
      const poll = () => {
        if (!webGpuRecoveryProbe || webGpuRecoveryProbe.done) return

        const nodeCount = (probeRenderer as any)._nodeSprites.size as number
        if (readBackend() && nodeCount > 0 && webGpuRecoveryProbe.warningMessages.some((message) => message.includes('WebGPU device lost'))) {
          webGpuRecoveryProbe.recoveredBackend = readBackend()
          webGpuRecoveryProbe.recoveredNodeCount = nodeCount
          webGpuRecoveryProbe.steps.push('recovery:done')
          finish()
          return
        }

        if (performance.now() - started > 10000) {
          finish('synthetic WebGPU recovery timed out')
          return
        }

        window.setTimeout(poll, 50)
      }

      poll()
    } catch (error) {
      finish(error instanceof Error ? error.message : String(error))
    }
  })()
}

// ── File selector buttons ───────────────────────────────────────────────────

function buildFileButtons() {
  const container = document.getElementById('files')!
  for (const path of DEMO_VISIBLE_EXAMPLES) {
    const btn = document.createElement('button')
    btn.textContent = path.replace('/examples/', '')
    btn.setAttribute('data-file', path)
    btn.addEventListener('click', () => {
      fileHistory.length = 0 // direct navigation, clear history
      void loadFile(path)
    })
    container.appendChild(btn)
  }
  syncResponsiveShellLayout()
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  syncResponsiveShellLayout()
  shellLayoutObserver?.disconnect()
  shellLayoutObserver = new ResizeObserver(() => syncResponsiveShellLayout())
  shellLayoutObserver.observe(toolbarEl)
  window.addEventListener('resize', syncResponsiveShellLayout)

  await renderer.mount(canvas)

  renderer.onBreadcrumbChange = updateBreadcrumb

  // Provide preview resolver — parses target file for hover preview
  renderer.onResolvePreview = async (targetFile: string) => {
    const resolved = resolveExample(targetFile)
    const override = resolved ? previewOverrides.get(resolved.path) : undefined
    if (override?.delayMs) {
      await new Promise((resolve) => window.setTimeout(resolve, override.delayMs))
    }
    const source = override?.source ?? (resolved ? await readExampleFile(resolved.path) : null)
    if (!resolved || !source) return null
    const result = await buildGraph(source, {
      sourcePath: resolved.path,
      linkResolver: fileResolver,
    })
    return result.success && result.graph ? result.graph : null
  }

  // Handle cross-file link clicks
  renderer.on('link:navigate', (link: any) => {
    const targetFile = link.targetFile as string
    const targetNode = link.targetNode as string | undefined
    void navigateToFile(targetFile, targetNode)
  })

  buildFileButtons()
  await loadFile(currentFile)

  // Philosophy switcher
  document.querySelectorAll('#controls button[data-layout]').forEach(btn => {
    btn.addEventListener('click', () => {
      const layout = btn.getAttribute('data-layout')
      if (layout) {
        currentLayout = layout
        renderer.setPhilosophy(layout)
        applyThemeStyles(layout)
      }
    })
  })

  renderer.on('node:click', (e: any) => console.log('Click:', e.nodeId))
  renderer.on('fold:change', (id: any, c: any) => console.log('Fold:', id, c))
  renderer.on('error', (err: any) => {
    setStatus(err?.message ?? String(err), 'error')
    console.warn('Error:', err)
  })
  renderer.on('warn', (warning: any) => {
    setStatus(warning?.message ?? String(warning), 'warn')
    console.warn('Warn:', warning)
  })

  window.__MERMAID_DEV__ = {
    loadFile,
    loadSource,
    setLayout(layout: string) {
      currentLayout = layout
      renderer.setPhilosophy(layout)
      applyThemeStyles(layout)
    },
    setThemeMode(mode) {
      renderer.setThemeMode(mode)
    },
    foldNode: (id: string) => renderer.foldNode(id),
    unfoldNode: (id: string) => renderer.unfoldNode(id),
    foldAll: () => renderer.foldAll(),
    unfoldAll: () => renderer.unfoldAll(),
    focusSubgraph: (id: string) => renderer.focusSubgraph(id),
    focusOut: () => renderer.focusOut(),
    fitToView: () => renderer.fitToView(),
    setRelativeZoom,
    nudgeViewport,
    clickLink(nodeId: string) {
      return renderer.activateLink(nodeId)
    },
    selectNode(nodeId: string | null, options?: { additive?: boolean }) {
      ;(renderer as any).selectNode(nodeId, options)
    },
    selectEdge(edgeId: string | null, options?: { additive?: boolean }) {
      ;(renderer as any).selectEdge(edgeId, options)
    },
    forceHoverNode(nodeId: string | null) {
      const rendererAny = renderer as any
      const nodeSprites = rendererAny._nodeSprites as Map<string, any> | undefined
      const previousId = rendererAny._hoveredNodeId as string | null | undefined
      if (previousId && previousId !== nodeId) {
        const previousSprite = nodeSprites?.get(previousId)
        if (previousSprite) {
          previousSprite.emit?.('pointerout')
        }
      }
      if (nodeId) {
        const sprite = nodeSprites?.get(nodeId)
        if (sprite) {
          sprite.emit?.('pointerover')
        }
      }
      rendererAny._setHoveredNode(nodeId)
    },
    navigateTo(filePath: string, targetNode?: string) {
      return navigateToFile(filePath, targetNode)
    },
    snapshot: () => getSnapshot(),
    getRenderedNodeMetrics,
    getRenderedEdgeMetrics,
    getRenderedSubgraphMetrics,
    runSubgraphDepthProbe,
    runBlueprintRenderedFootprintProbe,
    runBlueprintFallbackProbe,
    runUnrelatedNodeCrossingProbe,
    getNodeScreenBounds,
    getOverlayState,
    getPreviewState,
    runViewportRecoveryProbe,
    runPreviewCacheProbe,
    getSceneInventory,
    setFileOverride(targetFile: string, source: string, delayMs = 0) {
      const resolved = resolveExample(targetFile)
      if (!resolved) throw new Error(`Unresolvable file override target: ${targetFile}`)
      fileOverrides.set(resolved.path, { source, delayMs })
    },
    clearFileOverrides(targetFile?: string) {
      if (!targetFile) {
        fileOverrides.clear()
        return
      }
      const resolved = resolveExample(targetFile)
      if (!resolved) return
      fileOverrides.delete(resolved.path)
    },
    setPreviewOverride(targetFile: string, source: string, delayMs = 0) {
      const resolved = resolveExample(targetFile)
      if (!resolved) throw new Error(`Unresolvable preview override target: ${targetFile}`)
      previewOverrides.set(resolved.path, { source, delayMs })
    },
    clearPreviewOverrides(targetFile?: string) {
      if (!targetFile) {
        previewOverrides.clear()
        return
      }
      const resolved = resolveExample(targetFile)
      if (!resolved) return
      previewOverrides.delete(resolved.path)
    },
    loadHoverOverlapProbe,
    async loadStressGraph(nodeCount = 240) {
      fileHistory.length = 0
      currentFile = '/__stress__.mmd'
      highlightActiveFile('')
      setStatus('Loading stress graph', 'info')

      const result = await renderer.load(`%% @layout ${currentLayout}\n${buildStressSource(nodeCount)}`, {
        sourcePath: currentFile,
        linkResolver: fileResolver,
      })

      if (!result.success) {
        setStatus(result.errors.map((error) => error.message).join('\n') || 'Stress graph failed to load', 'error')
        return false
      }

      const warningText = result.warnings.map((warning) => warning.message).join('\n')
      setStatus(warningText || `Loaded stress graph (${nodeCount} nodes)`, result.warnings.length > 0 ? 'warn' : 'info')
      return true
    },
    async runLifecycleProbe() {
      const withTimeout = async <T>(promise: Promise<T>, label: string): Promise<T> => {
        return await Promise.race([
          promise,
          new Promise<T>((_, reject) => {
            window.setTimeout(() => reject(new Error(`${label} timed out`)), 5000)
          }),
        ])
      }

      const makeProbeCanvas = () => {
        const wrapper = document.createElement('div')
        wrapper.style.position = 'fixed'
        wrapper.style.left = '-9999px'
        wrapper.style.top = '0'
        wrapper.style.width = '320px'
        wrapper.style.height = '180px'
        const canvas = document.createElement('canvas')
        canvas.width = 320
        canvas.height = 180
        canvas.style.width = '320px'
        canvas.style.height = '180px'
        wrapper.appendChild(canvas)
        document.body.appendChild(wrapper)
        return { wrapper, canvas }
      }

      const probeA = makeProbeCanvas()
      const probeB = makeProbeCanvas()
      const source = `graph TD
        A[Start] --> B[Done]`

      const canvasA = probeA.canvas
      const canvasB = probeB.canvas

      let secondMountOtherCanvasError: string | null = null
      let foreignCanvasOwnershipError: string | null = null
      let loadAfterDestroyError: string | null = null
      let setPhilosophyAfterDestroyError: string | null = null
      let mountAfterDestroyError: string | null = null
      let sameCanvasRemountSucceeded = false
      const owner = new MermaidRenderer()
      const thief = new MermaidRenderer()
      const primary = new MermaidRenderer()

      try {
        await withTimeout(primary.mount(canvasA), 'primary mount')
        await withTimeout(primary.mount(canvasA), 'primary same-canvas remount')
        sameCanvasRemountSucceeded = true
      } catch {
        sameCanvasRemountSucceeded = false
      }

      try {
        await withTimeout(primary.mount(canvasB), 'primary remount')
      } catch (error) {
        secondMountOtherCanvasError = error instanceof Error ? error.message : String(error)
      }

      try {
        await withTimeout(owner.mount(canvasB), 'owner mount')
        await withTimeout(thief.mount(canvasB), 'thief mount')
      } catch (error) {
        foreignCanvasOwnershipError = error instanceof Error ? error.message : String(error)
      } finally {
        owner.destroy()
        thief.destroy()
      }
      primary.destroy()

      try {
        await primary.load(source)
      } catch (error) {
        loadAfterDestroyError = error instanceof Error ? error.message : String(error)
      }

      try {
        primary.setPhilosophy('blueprint')
      } catch (error) {
        setPhilosophyAfterDestroyError = error instanceof Error ? error.message : String(error)
      }

      try {
        await withTimeout(primary.mount(canvasA), 'mount after destroy')
      } catch (error) {
        mountAfterDestroyError = error instanceof Error ? error.message : String(error)
      }

      probeA.wrapper.remove()
      probeB.wrapper.remove()

      return {
        sameCanvasRemountSucceeded,
        secondMountOtherCanvasError,
        foreignCanvasOwnershipError,
        loadAfterDestroyError,
        setPhilosophyAfterDestroyError,
        mountAfterDestroyError,
      }
    },
    async runMountFailureProbe() {
      const wrapper = document.createElement('div')
      wrapper.style.position = 'fixed'
      wrapper.style.left = '-9999px'
      wrapper.style.top = '0'
      wrapper.style.width = '320px'
      wrapper.style.height = '180px'
      const canvas = document.createElement('canvas')
      canvas.width = 320
      canvas.height = 180
      canvas.style.width = '320px'
      canvas.style.height = '180px'
      wrapper.appendChild(canvas)
      document.body.appendChild(wrapper)

      const renderer = new MermaidRenderer()
      const originalInit = Application.prototype.init
      let mountError: string | null = null

      Application.prototype.init = async function initFailure() {
        throw new Error('Simulated renderer init failure')
      }

      try {
        await renderer.mount(canvas)
      } catch (error) {
        mountError = error instanceof Error ? error.message : String(error)
      } finally {
        Application.prototype.init = originalInit
      }

      const ctx = canvas.getContext('2d')
      let sampledAlphaSum = 0
      if (ctx) {
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
        for (let y = 0; y < canvas.height; y += 24) {
          for (let x = 0; x < canvas.width; x += 24) {
            sampledAlphaSum += image.data[(y * canvas.width + x) * 4 + 3]
          }
        }
      }

      wrapper.remove()

      return {
        mountError,
        sampledAlphaSum,
      }
    },
    async runBackendUnavailableProbe() {
      const wrapper = document.createElement('div')
      wrapper.style.position = 'fixed'
      wrapper.style.left = '-9999px'
      wrapper.style.top = '0'
      wrapper.style.width = '320px'
      wrapper.style.height = '180px'
      const canvas = document.createElement('canvas')
      canvas.width = 320
      canvas.height = 180
      canvas.style.width = '320px'
      canvas.style.height = '180px'
      wrapper.appendChild(canvas)
      document.body.appendChild(wrapper)

      const renderer = new MermaidRenderer()
      const originalInit = Application.prototype.init
      let mountError: string | null = null

      Application.prototype.init = async function backendUnavailable() {
        throw new Error('No supported GPU backend')
      }

      try {
        await renderer.mount(canvas)
      } catch (error) {
        mountError = error instanceof Error ? error.message : String(error)
      } finally {
        Application.prototype.init = originalInit
      }

      const ctx = canvas.getContext('2d')
      let sampledAlphaSum = 0
      if (ctx) {
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
        for (let y = 0; y < canvas.height; y += 24) {
          for (let x = 0; x < canvas.width; x += 24) {
            sampledAlphaSum += image.data[(y * canvas.width + x) * 4 + 3]
          }
        }
      }

      wrapper.remove()

      return {
        mountError,
        sampledAlphaSum,
      }
    },
    startWebGpuRecoveryProbe,
    getWebGpuRecoveryProbe: () => webGpuRecoveryProbe,
  }
}

main().catch((error) => {
  setStatus(error instanceof Error ? error.message : String(error), 'error')
  console.error(error)
})
