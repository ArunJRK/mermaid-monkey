import { expect, test, type Page } from '@playwright/test'

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
  erSourceCardinality: string | null
  erTargetCardinality: string | null
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

type MultiInstanceProbe = {
  multiInstanceMounted: boolean
  multiInstanceBackendCount: number
  bothRenderersLoaded: boolean
  firstRendererNodeCount: number
  secondRendererNodeCount: number
}

type DestroyDuringMountProbe = {
  mountErrorMessage: string | null
  appReleased: boolean
  keyHandlerReleased: boolean
  resizeObserverReleased: boolean
  canvasOwnershipReleased: boolean
  keydownListenersReleased: boolean
  fitCallsAfterKeydown: number
  remountSucceeded: boolean
  remountNodeCount: number
}

type KeyboardScopeProbeCounts = {
  fitCalls: number
  resetCalls: number
  editorText: string
  activeElementId: string
}

type DestroyCleanupProbe = {
  keyHandlerReleased: boolean
  visibilityHandlerReleased: boolean
  pointerActivityHandlerReleased: boolean
  contextLostHandlerReleased: boolean
  contextRestoredHandlerReleased: boolean
  colorSchemeListenerReleased: boolean
  resizeObserverReleased: boolean
  resizeRafCleared: boolean
  previewTimerCancelled: boolean
  idleTimerCleared: boolean
  linkPreviewReleased: boolean
  appReleased: boolean
  viewportReleased: boolean
  canvasReleased: boolean
  canvasOwnershipReleased: boolean
}

type ContextRecoveryProbe = {
  initialNodeCount: number
  recoveredNodeCount: number
  contextLossPrevented: boolean
  contextRestoredDispatched: boolean
}

type ContextRecoveryVisualProbe = ContextRecoveryProbe & {
  canvasId: string
  screenshotBase64: string
}

type BackendUnavailableProbe = {
  mountError: string | null
  sampledAlphaSum: number
}

type AdapterFallbackProbe = {
  mountSucceeded: boolean
  backend: string | null
  nodeCount: number
  requestAdapterCalls: number
}

type VisibilityPauseProbe = {
  initiallyRunning: boolean
  hiddenRunning: boolean
  restoredRunning: boolean
}

type RelayoutVisibilityPauseProbe = {
  nodeMovedBeforeHide: boolean
  stayedStillWhileHidden: boolean
  resumedAfterVisible: boolean
}

type IdlePauseProbe = {
  runningImmediatelyAfterLoad: boolean
  stoppedAfterIdle: boolean
  runningAfterPointerMove: boolean
  stoppedAgainAfterIdle: boolean
}

type WebGpuRecoveryHarnessProbe = {
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

type MountFailureProbe = {
  mountError: string | null
  sampledAlphaSum: number
}

type EmbedHarnessSnapshot = {
  ready: boolean
  destroyed: boolean
  nodeCount: number
  selectedNodeId: string | null
  backend: string | null
  status: string
}

type PerfSample = {
  name: string
  nodeCount: number
  edgeCount: number
  loadMs: number
  avgFrameMs: number
  p95FrameMs: number
  approxFps: number
}

type PerfHarnessResult = {
  representative: PerfSample
  stress: PerfSample
}

type GraphClickOptions = Parameters<Page['mouse']['click']>[2] & {
  modifiers?: string[]
}

async function attachPageErrorTracking(page: Page) {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(msg.text())
  })
  return pageErrors
}

test.use({ colorScheme: 'dark' })
test.setTimeout(60000)

async function waitForDevApi(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => Boolean(window.__MERMAID_DEV__))
  await expect.poll(async () => {
    const snapshot = await page.evaluate(() => window.__MERMAID_DEV__!.snapshot())
    return snapshot.nodeCount
  }, { timeout: 10000 }).toBeGreaterThan(0)
}

async function snapshot(page: Page): Promise<DevSnapshot> {
  return await page.evaluate(() => window.__MERMAID_DEV__!.snapshot())
}

function finiteBounds(bounds: DevSnapshot['renderedBounds']) {
  return bounds === null || (
    Number.isFinite(bounds.minX)
    && Number.isFinite(bounds.minY)
    && Number.isFinite(bounds.maxX)
    && Number.isFinite(bounds.maxY)
  )
}

function pointOnNodeRectBoundary(
  point: { x: number; y: number },
  center: { x: number; y: number },
  width: number,
  height: number,
  epsilon = 8,
) {
  const left = center.x - width / 2
  const right = center.x + width / 2
  const top = center.y - height / 2
  const bottom = center.y + height / 2
  const withinX = point.x >= left - epsilon && point.x <= right + epsilon
  const withinY = point.y >= top - epsilon && point.y <= bottom + epsilon
  const nearVertical = Math.abs(point.x - left) <= epsilon || Math.abs(point.x - right) <= epsilon
  const nearHorizontal = Math.abs(point.y - top) <= epsilon || Math.abs(point.y - bottom) <= epsilon
  return withinX && withinY && (nearVertical || nearHorizontal)
}

async function clickGraphPoint(page: Page, x: number, y: number, options: GraphClickOptions = {}) {
  const { modifiers = [], ...mouseOptions } = options
  for (const modifier of modifiers) {
    await page.keyboard.down(modifier)
  }
  try {
    await page.mouse.click(x, y, { ...mouseOptions, modifiers })
  } finally {
    for (const modifier of modifiers.slice().reverse()) {
      await page.keyboard.up(modifier)
    }
  }
}

async function clickNode(page: Page, nodeId: string, options: GraphClickOptions = {}) {
  const bounds = await page.evaluate((id) => window.__MERMAID_DEV__!.getNodeScreenBounds(id), nodeId)
  expect(bounds).not.toBeNull()
  await clickGraphPoint(page, bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2, options)
}

async function hoverNode(page: Page, nodeId: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const bounds = await page.evaluate((id) => window.__MERMAID_DEV__!.getNodeScreenBounds(id), nodeId)
    expect(bounds).not.toBeNull()
    await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2)
    await page.waitForTimeout(50)
    const hovered = await page.evaluate((id) => {
      const metrics = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return metrics.some((node) => node.id === id && node.hoverVisible)
    }, nodeId)
    if (hovered) return
  }
}

async function nodeIds(page: Page): Promise<string[]> {
  const nodes = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
  return nodes.map((node) => node.id)
}

async function findEmptyCanvasPoint(page: Page): Promise<{ x: number; y: number }> {
  const canvas = page.locator('#canvas')
  const canvasBox = await canvas.boundingBox()
  expect(canvasBox).not.toBeNull()

  const nodes = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
  const candidates = [
    { x: 12, y: 12 },
    { x: canvasBox!.width - 12, y: 12 },
    { x: 12, y: canvasBox!.height - 12 },
    { x: canvasBox!.width - 12, y: canvasBox!.height - 12 },
  ]

  for (const candidate of candidates) {
    const blocked = nodes.some((node) => pointInRect(candidate, expandedRect(node.shapeBounds, 8)))
    if (!blocked) {
      return {
        x: canvasBox!.x + candidate.x,
        y: canvasBox!.y + candidate.y,
      }
    }
  }

  return {
    x: canvasBox!.x + 12,
    y: canvasBox!.y + 12,
  }
}

function overlaps(a: Rect, b: Rect) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y
}

function findOverlapPairs(metrics: RenderedNodeMetrics[], key: 'shapeBounds' | 'labelBounds') {
  const overlapsFound: Array<[string, string]> = []
  for (let i = 0; i < metrics.length; i++) {
    for (let j = i + 1; j < metrics.length; j++) {
      if (overlaps(metrics[i][key], metrics[j][key])) {
        overlapsFound.push([metrics[i].id, metrics[j].id])
      }
    }
  }
  return overlapsFound
}

function findNonContainedShapeOverlapPairs(metrics: RenderedNodeMetrics[]) {
  const overlapsFound: Array<[string, string]> = []
  for (let i = 0; i < metrics.length; i++) {
    for (let j = i + 1; j < metrics.length; j++) {
      if (!overlaps(metrics[i].shapeBounds, metrics[j].shapeBounds)) continue
      const contained =
        rectContainsRect(metrics[i].shapeBounds, metrics[j].shapeBounds, 1.5)
        || rectContainsRect(metrics[j].shapeBounds, metrics[i].shapeBounds, 1.5)
      if (!contained) {
        overlapsFound.push([metrics[i].id, metrics[j].id])
      }
    }
  }
  return overlapsFound
}

function rectCorners(rect: Rect) {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x, y: rect.y + rect.height },
    { x: rect.x + rect.width, y: rect.y + rect.height },
  ]
}

function labelContainedByShape(metric: RenderedNodeMetrics) {
  const corners = rectCorners(metric.labelBounds)
  const cx = metric.shapeBounds.x + metric.shapeBounds.width / 2
  const cy = metric.shapeBounds.y + metric.shapeBounds.height / 2
  const hw = metric.shapeBounds.width / 2
  const hh = metric.shapeBounds.height / 2

  switch (metric.shape) {
    case 'circle': {
      const r = Math.max(hw, hh)
      return corners.every((point) => ((point.x - cx) ** 2 + (point.y - cy) ** 2) <= r ** 2 + 0.5)
    }
    case 'diamond': {
      return corners.every((point) => {
        const dx = Math.abs(point.x - cx) / Math.max(hw, 1)
        const dy = Math.abs(point.y - cy) / Math.max(hh, 1)
        return dx + dy <= 1.02
      })
    }
    case 'hexagon': {
      const inset = hw * 0.25
      return corners.every((point) => {
        const localX = Math.abs(point.x - cx)
        const localY = Math.abs(point.y - cy)
        if (localX <= hw - inset) return localY <= hh + 0.5
        const xIntoSlope = localX - (hw - inset)
        const allowedY = hh * (1 - xIntoSlope / Math.max(inset, 1))
        return localY <= allowedY + 0.75
      })
    }
    default:
      return corners.every((point) => (
        point.x >= metric.shapeBounds.x - 0.5
        && point.x <= metric.shapeBounds.x + metric.shapeBounds.width + 0.5
        && point.y >= metric.shapeBounds.y - 0.5
        && point.y <= metric.shapeBounds.y + metric.shapeBounds.height + 0.5
      ))
  }
}

function pointOnRectBoundary(point: { x: number; y: number }, rect: Rect, tolerance = 1.5) {
  const left = rect.x
  const right = rect.x + rect.width
  const top = rect.y
  const bottom = rect.y + rect.height

  const withinVerticalSpan = point.y >= top - tolerance && point.y <= bottom + tolerance
  const withinHorizontalSpan = point.x >= left - tolerance && point.x <= right + tolerance

  const onLeft = Math.abs(point.x - left) <= tolerance && withinVerticalSpan
  const onRight = Math.abs(point.x - right) <= tolerance && withinVerticalSpan
  const onTop = Math.abs(point.y - top) <= tolerance && withinHorizontalSpan
  const onBottom = Math.abs(point.y - bottom) <= tolerance && withinHorizontalSpan
  return onLeft || onRight || onTop || onBottom
}

function pointOnWorldBoundary(metric: RenderedNodeMetrics, point: { x: number; y: number }, tolerance = 1.5) {
  const cx = metric.center.x
  const cy = metric.center.y
  const hw = metric.displayWidth / 2
  const hh = metric.displayHeight / 2
  const dx = point.x - cx
  const dy = point.y - cy

  if (metric.shape === 'diamond') {
    const normalized = Math.abs(dx) / Math.max(hw, 1) + Math.abs(dy) / Math.max(hh, 1)
    return Math.abs(normalized - 1) <= 0.04
  }

  if (metric.shape === 'circle') {
    const radius = Math.max(hw, hh)
    return Math.abs(Math.hypot(dx, dy) - radius) <= tolerance
  }

  if (metric.shape === 'hexagon') {
    const inset = hw * 0.25
    const vertices = [
      { x: cx - hw + inset, y: cy - hh },
      { x: cx + hw - inset, y: cy - hh },
      { x: cx + hw, y: cy },
      { x: cx + hw - inset, y: cy + hh },
      { x: cx - hw + inset, y: cy + hh },
      { x: cx - hw, y: cy },
    ]
    for (let index = 0; index < vertices.length; index++) {
      const a = vertices[index]
      const b = vertices[(index + 1) % vertices.length]
      const segDx = b.x - a.x
      const segDy = b.y - a.y
      const segLenSq = segDx * segDx + segDy * segDy
      const t = Math.max(0, Math.min(1, ((point.x - a.x) * segDx + (point.y - a.y) * segDy) / Math.max(segLenSq, 1)))
      const projX = a.x + segDx * t
      const projY = a.y + segDy * t
      if (Math.hypot(point.x - projX, point.y - projY) <= tolerance) return true
    }
    return false
  }

  const rect = {
    x: cx - hw,
    y: cy - hh,
    width: metric.displayWidth,
    height: metric.displayHeight,
  }
  return pointOnRectBoundary(point, rect, tolerance)
}

function angleDelta(a: number, b: number) {
  let delta = a - b
  while (delta <= -Math.PI) delta += Math.PI * 2
  while (delta > Math.PI) delta -= Math.PI * 2
  return Math.abs(delta)
}

function expandedRect(rect: Rect, padding: number): Rect {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  }
}

function rectContainsRect(outer: Rect, inner: Rect, tolerance = 0) {
  return (
    inner.x >= outer.x - tolerance
    && inner.y >= outer.y - tolerance
    && inner.x + inner.width <= outer.x + outer.width + tolerance
    && inner.y + inner.height <= outer.y + outer.height + tolerance
  )
}

function minRectInset(outer: Rect, inner: Rect) {
  return Math.min(
    inner.x - outer.x,
    inner.y - outer.y,
    outer.x + outer.width - (inner.x + inner.width),
    outer.y + outer.height - (inner.y + inner.height),
  )
}

function pointInRect(point: { x: number; y: number }, rect: Rect) {
  return (
    point.x >= rect.x
    && point.x <= rect.x + rect.width
    && point.y >= rect.y
    && point.y <= rect.y + rect.height
  )
}

function ccw(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) {
  return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x)
}

function segmentsIntersect(
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number },
) {
  return ccw(a1, b1, b2) !== ccw(a2, b1, b2) && ccw(a1, a2, b1) !== ccw(a1, a2, b2)
}

function segmentIntersectsRect(start: { x: number; y: number }, end: { x: number; y: number }, rect: Rect) {
  if (pointInRect(start, rect) || pointInRect(end, rect)) return true

  const corners = rectCorners(rect)
  const edges: Array<[{ x: number; y: number }, { x: number; y: number }]> = [
    [corners[0], corners[1]],
    [corners[1], corners[3]],
    [corners[3], corners[2]],
    [corners[2], corners[0]],
  ]
  return edges.some(([a, b]) => segmentsIntersect(start, end, a, b))
}

function edgePathIntersectsRect(points: Array<{ x: number; y: number }>, rect: Rect) {
  for (let index = 0; index < points.length - 1; index++) {
    if (segmentIntersectsRect(points[index], points[index + 1], rect)) return true
  }
  return false
}

function expandClip(bounds: NodeScreenBounds) {
  return {
    x: Math.max(0, Math.floor(bounds.x - 20)),
    y: Math.max(0, Math.floor(bounds.y - 20)),
    width: Math.ceil(bounds.width + 56),
    height: Math.ceil(bounds.height + 48),
  }
}

function centeredClip(bounds: NodeScreenBounds, width: number, height: number) {
  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2
  return {
    x: Math.max(0, Math.floor(centerX - width / 2)),
    y: Math.max(0, Math.floor(centerY - height / 2)),
    width,
    height,
  }
}

test.describe('demo render pipeline', () => {
  test('loads and renders the overview graph with a real GPU backend', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const state = await snapshot(page)
    expect(state.currentFile).toBe('/examples/microservice/overview.mmd')
    expect(state.currentLayout).toBe('narrative')
    expect(state.nodeCount).toBeGreaterThan(0)
    expect(state.edgeCount).toBeGreaterThan(0)
    expect(state.subgraphCount).toBeGreaterThan(0)
    expect(state.backend === 'WebGL' || state.backend === 'WebGPU').toBeTruthy()
    expect(state.renderedBounds).not.toBeNull()
    expect(state.viewportScale).toBeGreaterThan(0)

    const canvas = page.locator('#canvas')
    await expect(canvas).toBeVisible()
    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThan(200)
    expect(box!.height).toBeGreaterThan(200)
    expect(pageErrors).toEqual([])
  })

  test('renders a stable narrative overview screenshot for README/docs use', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      await window.__MERMAID_DEV__!.loadFile('/examples/microservice/overview.mmd')
      window.__MERMAID_DEV__!.fitToView()
    })
    await expect.poll(async () => (await snapshot(page)).currentFile).toBe('/examples/microservice/overview.mmd')
    await expect.poll(async () => (await snapshot(page)).currentLayout).toBe('narrative')
    await expect.poll(async () => (await snapshot(page)).viewportAlpha).toBe(1)

    const canvas = page.locator('#canvas')
    await expect(canvas).toHaveScreenshot('readme-overview-narrative.png')
    expect(pageErrors).toEqual([])
  })

  test('renders a stable blueprint screenshot for README/docs use', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      window.__MERMAID_DEV__!.setLayout('blueprint')
      await window.__MERMAID_DEV__!.loadFile('/examples/simple-flow.mmd')
      window.__MERMAID_DEV__!.fitToView()
    })
    await expect.poll(async () => (await snapshot(page)).currentFile).toBe('/examples/simple-flow.mmd')
    await expect.poll(async () => (await snapshot(page)).currentLayout).toBe('blueprint')
    await expect.poll(async () => (await snapshot(page)).viewportAlpha).toBe(1)

    const canvas = page.locator('#canvas')
    await expect(canvas).toHaveScreenshot('readme-blueprint-simple-flow.png')
    expect(pageErrors).toEqual([])
  })

  test('renders a stable mobile screenshot for README/docs use', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      await window.__MERMAID_DEV__!.loadFile('/examples/microservice/overview.mmd')
      window.__MERMAID_DEV__!.fitToView()
    })

    await page.setViewportSize({ width: 390, height: 844 })

    await expect.poll(async () => (await snapshot(page)).currentFile).toBe('/examples/microservice/overview.mmd')
    await expect.poll(async () => (await snapshot(page)).currentLayout).toBe('narrative')
    await expect.poll(async () => (await snapshot(page)).viewportAlpha).toBe(1)
    await page.waitForTimeout(180)

    const mobileShell = await page.screenshot()
    expect(mobileShell).toMatchSnapshot('readme-mobile-responsive.png', {
      maxDiffPixelRatio: 0.035,
    })
    expect(pageErrors).toEqual([])
  })

  test('keeps shipped example graphs and the stress graph free of node-on-node overlap', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const examplePaths = [
      '/examples/breath-overview.mmd',
      '/examples/cross-file/auth.mmd',
      '/examples/cross-file/data.mmd',
      '/examples/cross-file/main.mmd',
      '/examples/microservice/auth-service.mmd',
      '/examples/microservice/order-service.mmd',
      '/examples/microservice/overview.mmd',
      '/examples/microservice/payment-service.mmd',
      '/examples/narrative-flow.mmd',
      '/examples/self-loop-bidirectional.mmd',
      '/examples/shape-showcase.mmd',
      '/examples/simple-flow.mmd',
      '/examples/with-subgraphs.mmd',
    ]

    for (const path of examplePaths) {
      const loaded = await page.evaluate((nextPath) => window.__MERMAID_DEV__!.loadFile(nextPath), path)
      expect(loaded, `${path} should load`).toBeTruthy()

      const state = await snapshot(page)
      expect(state.statusLevel, `${path} should not be in error state`).not.toBe('error')
      expect(finiteBounds(state.renderedBounds), `${path} should keep finite rendered bounds`).toBe(true)

      const metrics = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
      expect(findNonContainedShapeOverlapPairs(metrics), `${path} should not have overlapping node shapes`).toEqual([])
    }

    const stressLoaded = await page.evaluate(() => window.__MERMAID_DEV__!.loadStressGraph(240))
    expect(stressLoaded).toBeTruthy()
    const stressState = await snapshot(page)
    expect(stressState.statusLevel).not.toBe('error')
    expect(stressState.performanceMode).toBe('stress')
    const stressMetrics = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
    expect(findNonContainedShapeOverlapPairs(stressMetrics)).toEqual([])

    expect(pageErrors).toEqual([])
  })

  test('uses the light narrative palette by default when the system color scheme prefers light', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      await window.__MERMAID_DEV__!.loadFile('/examples/simple-flow.mmd')
    })
    await expect.poll(async () => (await snapshot(page)).currentFile).toBe('/examples/simple-flow.mmd')

    const lightState = await snapshot(page)
    expect(lightState.currentLayout).toBe('narrative')
    expect(lightState.backgroundColor).toBe(0xf6f8fa)

    const lightNode = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.find((node) => node.id === 'A')!
    })
    expect(lightNode.nodeFill).toBe(0xffffff)
    expect(lightNode.labelFill).toBe(0x1f2328)
    const canvas = page.locator('#canvas')
    await expect(canvas).toHaveScreenshot('narrative-light-system.png')

    await page.evaluate(() => window.__MERMAID_DEV__!.setThemeMode('dark'))
    await expect.poll(async () => (await snapshot(page)).backgroundColor).toBe(0x0d1117)

    const darkNode = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.find((node) => node.id === 'A')!
    })
    expect(darkNode.nodeFill).toBe(0x161b22)
    expect(darkNode.labelFill).toBe(0xe6edf3)
    await expect(canvas).toHaveScreenshot('narrative-light-to-dark-switch.png')
    expect(pageErrors).toEqual([])
  })

  test('preserves fold state when switching philosophy', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(() => window.__MERMAID_DEV__!.foldNode('core'))
    await expect.poll(async () => (await snapshot(page)).foldedSubgraphs).toContain('core')

    await page.evaluate(() => window.__MERMAID_DEV__!.setLayout('blueprint'))
    await expect.poll(async () => (await snapshot(page)).currentLayout).toBe('blueprint')
    await expect.poll(async () => (await snapshot(page)).viewportAlpha).toBe(1)
    await page.waitForTimeout(180)

    const state = await snapshot(page)
    expect(state.foldedSubgraphs).toContain('core')
    expect(state.nodeCount).toBeGreaterThan(0)

    const foldedCanvas = await page.locator('#canvas').screenshot()
    expect(foldedCanvas).toMatchSnapshot('fold-state-after-philosophy-switch.png')
    expect(pageErrors).toEqual([])
  })

  test('supports focus navigation in the browser renderer', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(() => window.__MERMAID_DEV__!.focusSubgraph('core'))
    await expect.poll(async () => (await snapshot(page)).focusStack).toEqual(['core'])

    await page.evaluate(() => window.__MERMAID_DEV__!.focusOut())
    await expect.poll(async () => (await snapshot(page)).focusStack).toEqual([])
    expect(pageErrors).toEqual([])
  })

  test('keeps representative node and label bounds non-overlapping across zoom levels', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      await window.__MERMAID_DEV__!.loadFile('/examples/narrative-flow.mmd')
    })

    for (const zoom of [0.65, 1, 1.8]) {
      await page.evaluate((value) => {
        window.__MERMAID_DEV__!.setRelativeZoom(value)
      }, zoom)

      const metrics = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
      expect(findOverlapPairs(metrics, 'shapeBounds')).toEqual([])
      expect(findOverlapPairs(metrics, 'labelBounds')).toEqual([])
    }

    expect(pageErrors).toEqual([])
  })

  test('keeps shipped example labels readable at minimum zoom without collapsing into overlap piles', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const examplePaths = [
      '/examples/breath-overview.mmd',
      '/examples/cross-file/auth.mmd',
      '/examples/cross-file/data.mmd',
      '/examples/cross-file/main.mmd',
      '/examples/microservice/auth-service.mmd',
      '/examples/microservice/order-service.mmd',
      '/examples/microservice/overview.mmd',
      '/examples/microservice/payment-service.mmd',
      '/examples/narrative-flow.mmd',
      '/examples/self-loop-bidirectional.mmd',
      '/examples/shape-showcase.mmd',
      '/examples/simple-flow.mmd',
      '/examples/with-subgraphs.mmd',
    ]

    for (const path of examplePaths) {
      const loaded = await page.evaluate((nextPath) => window.__MERMAID_DEV__!.loadFile(nextPath), path)
      expect(loaded, `${path} should load`).toBeTruthy()

      await page.evaluate(() => {
        window.__MERMAID_DEV__!.setRelativeZoom(0.1)
      })

      const state = await snapshot(page)
      expect(state.statusLevel, `${path} should not enter an error state at minimum zoom`).not.toBe('error')

      const metrics = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
      expect(findOverlapPairs(metrics, 'labelBounds'), `${path} should keep labels readable at minimum zoom`).toEqual([])
    }

    const stressLoaded = await page.evaluate(() => window.__MERMAID_DEV__!.loadStressGraph(240))
    expect(stressLoaded).toBeTruthy()
    await page.evaluate(() => {
      window.__MERMAID_DEV__!.setRelativeZoom(0.1)
    })

    const stressState = await snapshot(page)
    expect(stressState.statusLevel).not.toBe('error')
    expect(stressState.performanceMode).toBe('stress')
    const stressMetrics = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
    expect(findOverlapPairs(stressMetrics, 'labelBounds')).toEqual([])

    expect(pageErrors).toEqual([])
  })

  test('clamps extreme zoom requests to the supported min/max range', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      await window.__MERMAID_DEV__!.loadFile('/examples/narrative-flow.mmd')
      window.__MERMAID_DEV__!.fitToView()
    })

    const maxZoom = await page.evaluate(() => window.__MERMAID_DEV__!.setRelativeZoom(1000))
    const maxState = await snapshot(page)
    expect(maxZoom).toBe(5)
    expect(maxState.viewportScale).toBe(5)
    const maxZoomCanvas = await page.locator('#canvas').screenshot()
    expect(maxZoomCanvas).toMatchSnapshot('zoom-clamp-max.png')

    const minZoom = await page.evaluate(() => window.__MERMAID_DEV__!.setRelativeZoom(0.0001))
    const minState = await snapshot(page)
    expect(minZoom).toBe(0.1)
    expect(minState.viewportScale).toBe(0.1)
    const minZoomCanvas = await page.locator('#canvas').screenshot()
    expect(minZoomCanvas).toMatchSnapshot('zoom-clamp-min.png', {
      maxDiffPixelRatio: 0.015,
    })
    expect(pageErrors).toEqual([])
  })

  test('keeps labels inside rendered non-rectangular shapes', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      await window.__MERMAID_DEV__!.loadFile('/examples/shape-showcase.mmd')
    })

    const metrics = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
    const shapesToCheck = metrics.filter((metric) => ['circle', 'diamond', 'hexagon'].includes(metric.shape))

    expect(shapesToCheck.map((metric) => metric.shape).sort()).toEqual(['circle', 'diamond', 'hexagon'])
    for (const metric of shapesToCheck) {
      expect(labelContainedByShape(metric)).toBeTruthy()
    }

    const canvas = page.locator('#canvas')
    await expect(canvas).toHaveScreenshot('nonrectangular-label-fit.png')

    expect(pageErrors).toEqual([])
  })

  test('grows rectangular nodes to contain long unbroken labels instead of clipping them', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      await window.__MERMAID_DEV__!.loadSource(`graph TD
        Long[SupercalifragilisticexpialidociousSupercalifragilisticexpialidocious]
        Short[Short]
        Long --> Short
      `, '/__long-label-growth__.mmd')
    })

    const metrics = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
    const longNode = metrics.find((node) => node.id === 'Long')
    const shortNode = metrics.find((node) => node.id === 'Short')

    expect(longNode).toBeDefined()
    expect(shortNode).toBeDefined()
    expect(rectContainsRect(longNode!.shapeBounds, longNode!.labelBounds, 1.5)).toBe(true)
    expect(longNode!.shapeBounds.width).toBeGreaterThan(longNode!.labelBounds.width + 16)
    expect(longNode!.displayWidth).toBeGreaterThan(shortNode!.displayWidth * 2)
    expect(longNode!.labelBounds.width).toBeGreaterThan(shortNode!.labelBounds.width * 2)

    const canvas = page.locator('#canvas')
    await expect(canvas).toHaveScreenshot('long-label-node-growth.png')

    expect(pageErrors).toEqual([])
  })

  test('uses current expanded node bounds for hover glow and clears hover on pointer leave', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      await window.__MERMAID_DEV__!.loadFile('/examples/microservice/overview.mmd')
    })

    await expect.poll(async () => (await snapshot(page)).viewportAlpha).toBe(1)
    await hoverNode(page, 'OrderSvc')

    await expect.poll(async () => {
      const metrics = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
      return metrics.some((node) => node.id === 'OrderSvc' && node.hoverVisible)
    }).toBeTruthy()
    const resolvedHoveredMetrics = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
    const hoveredNode = resolvedHoveredMetrics.find((node) => node.id === 'OrderSvc')
    expect(hoveredNode).toBeDefined()
    expect(hoveredNode!.hoverVisible).toBeTruthy()
    expect(hoveredNode!.displayWidth).toBeGreaterThan(100)
    expect(hoveredNode!.hoverBounds.width).toBeGreaterThanOrEqual(hoveredNode!.shapeBounds.width - 1)
    expect(hoveredNode!.hoverBounds.height).toBeGreaterThanOrEqual(hoveredNode!.shapeBounds.height - 1)
    expect(hoveredNode!.hoverBounds.x).toBeLessThanOrEqual(hoveredNode!.shapeBounds.x + 1)
    expect(hoveredNode!.hoverBounds.y).toBeLessThanOrEqual(hoveredNode!.shapeBounds.y + 1)
    const hoveredNodeBounds = await page.evaluate(() => window.__MERMAID_DEV__!.getNodeScreenBounds('OrderSvc'))
    expect(hoveredNodeBounds).not.toBeNull()

    const canvas = page.locator('#canvas')
    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()
    const hoverShot = await page.screenshot({
      clip: {
        x: Math.max(0, hoveredNodeBounds!.x - 24),
        y: Math.max(0, hoveredNodeBounds!.y - 24),
        width: hoveredNodeBounds!.width + 48,
        height: hoveredNodeBounds!.height + 48,
      },
    })
    expect(hoverShot).toMatchSnapshot('hover-glow-expanded-bounds.png')
    await page.mouse.move(box!.x + 8, box!.y + 8)

    await expect.poll(async () => {
      const metrics = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
      return metrics.some((node) => node.hoverVisible)
    }).toBeFalsy()

    expect(pageErrors).toEqual([])
  })

  test('keeps simple-flow edge endpoints on rendered node boundaries', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      await window.__MERMAID_DEV__!.loadFile('/examples/simple-flow.mmd')
    })

    const nodes = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
    const edges = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedEdgeMetrics() as RenderedEdgeMetrics[])
    const nodeMap = new Map(nodes.map((node) => [node.id, node]))

    for (const edge of edges) {
      const source = nodeMap.get(edge.source)
      const target = nodeMap.get(edge.target)
      expect(source).toBeDefined()
      expect(target).toBeDefined()
      expect(edge.points.length).toBeGreaterThanOrEqual(2)

      const start = edge.points[0]
      const end = edge.points[edge.points.length - 1]
      const prevToEnd = edge.points[edge.points.length - 2]
      const finalAngle = Math.atan2(end.y - prevToEnd.y, end.x - prevToEnd.x)

      expect(pointOnWorldBoundary(source!, start)).toBeTruthy()
      expect(pointOnWorldBoundary(target!, end)).toBeTruthy()
      expect(edge.arrowTip).not.toBeNull()
      expect(edge.arrowWingA).not.toBeNull()
      expect(edge.arrowWingB).not.toBeNull()
      expect(edge.arrowAngle).not.toBeNull()
      expect(Math.hypot(edge.arrowTip!.x - end.x, edge.arrowTip!.y - end.y)).toBeLessThanOrEqual(0.5)
      expect(angleDelta(edge.arrowAngle!, finalAngle)).toBeLessThanOrEqual(0.02)
    }

    await expect(page.locator('#canvas')).toHaveScreenshot('edge-endpoints-boundary-simple-flow.png')

    expect(pageErrors).toEqual([])
  })

  test('surfaces a readable warning when a non-Blueprint edge passes through an unrelated node', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const loaded = await page.evaluate(async () => {
      return await window.__MERMAID_DEV__!.runUnrelatedNodeCrossingProbe()
    })

    expect(loaded).toBe(true)

    const state = await snapshot(page)
    expect(state.statusLevel).toBe('warn')
    expect(state.statusMessage).toContain('Collision-free routing is only guaranteed for blueprint')
    expect(state.nodeCount).toBe(3)
    expect(state.edgeCount).toBe(1)
    await expect(page.locator('#canvas')).toHaveScreenshot('nonblueprint-crossing-warning-state.png')
    expect(pageErrors).toEqual([])
  })

  test('keeps Blueprint wires out of rendered long-label node footprints', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const loaded = await page.evaluate(() => window.__MERMAID_DEV__!.runBlueprintRenderedFootprintProbe())
    expect(loaded).toBe(true)

    const nodes = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
    const edges = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedEdgeMetrics() as RenderedEdgeMetrics[])

    const blocker = nodes.find((node) => node.id === 'B')
    expect(blocker).toBeDefined()
    const edge = edges.find((candidate) => candidate.id === 'e1')
    expect(edge).toBeDefined()
    expect(edge!.routedSegments.length).toBeGreaterThan(0)

    const blockerRect = expandedRect(blocker!.shapeBounds, -2)
    const intersectsBlocker = edge!.routedSegments.some((segment) => segmentIntersectsRect(
      { x: segment.x1, y: segment.y1 },
      { x: segment.x2, y: segment.y2 },
      blockerRect,
    ))

    expect(intersectsBlocker).toBe(false)
    await expect(page.locator('#canvas')).toHaveScreenshot('blueprint-rendered-footprint-routing.png')
    expect(pageErrors).toEqual([])
  })

  test('renders a visible Blueprint fallback wire and surfaces congestion when routing cannot find a path', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const loaded = await page.evaluate(() => window.__MERMAID_DEV__!.runBlueprintFallbackProbe())
    expect(loaded).toBe(true)

    const edges = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedEdgeMetrics() as RenderedEdgeMetrics[])
    const state = await snapshot(page)

    const edge = edges.find((candidate) => candidate.id === 'e1')
    expect(edge).toBeDefined()
    expect(edge!.routedSegments.length).toBeGreaterThan(0)
    expect(edge!.bounds.height + edge!.bounds.width).toBeGreaterThan(20)
    expect(state.edgeCount).toBeGreaterThan(0)
    expect(state.statusLevel).toBe('warn')
    expect(state.statusMessage).toContain('direct wire segments')
    await expect(page.locator('#canvas')).toHaveScreenshot('blueprint-routing-fallback-warning.png')
    expect(pageErrors).toEqual([])
  })

  test('routes Blueprint edges deterministically regardless of source edge declaration order', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const normalizeRoutes = (edges: RenderedEdgeMetrics[]) =>
      Object.fromEntries(
        edges
          .map((edge) => [
            `${edge.source}->${edge.target}`,
            edge.routedSegments.map((segment) => ({
              x1: Number(segment.x1.toFixed(2)),
              y1: Number(segment.y1.toFixed(2)),
              x2: Number(segment.x2.toFixed(2)),
              y2: Number(segment.y2.toFixed(2)),
              isHorizontal: segment.isHorizontal,
            })),
          ] as const)
          .sort(([left], [right]) => left.localeCompare(right)),
      )

    const loadOrderedGraph = async (edgeLines: string[]) => {
      const loaded = await page.evaluate(async (lines) => {
        return await window.__MERMAID_DEV__!.loadSource(`%% @layout blueprint
graph TD
  A[Gateway]
  B[Billing]
  C[Catalog]
  D[Fulfillment]
${lines.map((line) => `  ${line}`).join('\n')}`, '/__blueprint-deterministic__.mmd')
      }, edgeLines)
      expect(loaded).toBe(true)
      return await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedEdgeMetrics() as RenderedEdgeMetrics[])
    }

    const forwardEdges = await loadOrderedGraph([
      'A --> D',
      'A --> B',
      'A --> C',
    ])
    const reversedEdges = await loadOrderedGraph([
      'A --> C',
      'A --> B',
      'A --> D',
    ])

    expect(normalizeRoutes(forwardEdges)).toEqual(normalizeRoutes(reversedEdges))
    expect(pageErrors).toEqual([])
  })

  test('renders self-loops and opposite-direction edges as distinct readable shapes', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      await window.__MERMAID_DEV__!.loadFile('/examples/self-loop-bidirectional.mmd')
    })

    const edges = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedEdgeMetrics() as RenderedEdgeMetrics[])
    const selfLoop = edges.find((edge) => edge.source === 'A' && edge.target === 'A')
    const forward = edges.find((edge) => edge.source === 'A' && edge.target === 'B')
    const backward = edges.find((edge) => edge.source === 'B' && edge.target === 'A')

    expect(selfLoop).toBeDefined()
    expect(selfLoop!.bounds.width).toBeGreaterThan(30)
    expect(selfLoop!.bounds.height).toBeGreaterThan(20)

    expect(forward).toBeDefined()
    expect(backward).toBeDefined()
    expect(forward!.bounds.x).not.toBe(backward!.bounds.x)
    expect(Math.abs(forward!.bounds.x - backward!.bounds.x)).toBeGreaterThan(8)

    const canvas = page.locator('#canvas')
    await expect(canvas).toHaveScreenshot('self-loop-bidirectional.png')

    expect(pageErrors).toEqual([])
  })

  test('keeps edge labels clear of nodes and rendered edge paths', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      await window.__MERMAID_DEV__!.loadFile('/examples/simple-flow.mmd')
    })

    const nodes = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
    const edges = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedEdgeMetrics() as RenderedEdgeMetrics[])
    const labeledEdges = edges.filter((edge) => edge.labelBounds)

    expect(labeledEdges.length).toBeGreaterThan(0)

    for (const edge of labeledEdges) {
      const labelBounds = expandedRect(edge.labelBounds!, 2)

      for (const node of nodes) {
        expect(overlaps(labelBounds, node.shapeBounds)).toBeFalsy()
      }

      for (const otherEdge of edges) {
        expect(edgePathIntersectsRect(otherEdge.screenPoints, labelBounds)).toBeFalsy()
      }
    }

    await page.evaluate(() => window.__MERMAID_DEV__!.setLayout('blueprint'))
    await expect.poll(async () => (await snapshot(page)).currentLayout).toBe('blueprint')
    await page.evaluate(async () => {
      await window.__MERMAID_DEV__!.loadFile('/examples/simple-flow.mmd')
    })

    const blueprintEdges = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedEdgeMetrics() as RenderedEdgeMetrics[])
    const blueprintLabeledEdges = blueprintEdges.filter((edge) => edge.labelBounds)
    expect(blueprintLabeledEdges.length).toBeGreaterThan(0)
    expect(blueprintLabeledEdges.every((edge) => edge.labelFontFamily === 'MermaidBlueprint')).toBe(true)

    const canvas = page.locator('#canvas')
    await expect(canvas).toHaveScreenshot('edge-label-clearance-blueprint.png')

    expect(pageErrors).toEqual([])
  })

  test('fitToView produces finite viewport bounds after reload', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      await window.__MERMAID_DEV__!.loadFile('/examples/microservice/order-service.mmd')
      window.__MERMAID_DEV__!.fitToView()
    })

    const state = await snapshot(page)
    expect(state.currentFile).toBe('/examples/microservice/order-service.mmd')
    expect(state.renderedBounds).not.toBeNull()
    expect(state.renderedBounds!.maxX).toBeGreaterThan(state.renderedBounds!.minX)
    expect(state.renderedBounds!.maxY).toBeGreaterThan(state.renderedBounds!.minY)
    expect(state.viewportScale).toBeGreaterThan(0)
    expect(Number.isFinite(state.viewportPosition?.x)).toBeTruthy()
    expect(Number.isFinite(state.viewportPosition?.y)).toBeTruthy()

    const fitCanvas = await page.locator('#canvas').screenshot()
    expect(fitCanvas).toMatchSnapshot('fit-to-view-reload.png')

    expect(pageErrors).toEqual([])
  })

  test('fitToView contains wide Blueprint diagrams instead of cropping at readable zoom', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await page.setViewportSize({ width: 1200, height: 800 })
    await waitForDevApi(page)

    const loaded = await page.evaluate(async () => {
      const nodes = Array.from({ length: 18 }, (_, index) => {
        return `  n${index}[Wide topology stage ${index} with contract label]`
      })
      const edges = Array.from({ length: 17 }, (_, index) => `  n${index} --> n${index + 1}`)
      return await window.__MERMAID_DEV__!.loadSource(
        ['%% @layout blueprint', 'graph LR', ...nodes, ...edges].join('\n'),
        '/__wide-blueprint-fit__.mmd',
      )
    })
    expect(loaded).toBeTruthy()

    await page.evaluate(() => window.__MERMAID_DEV__!.fitToView())
    await expect.poll(async () => (await snapshot(page)).viewportAlpha).toBe(1)

    const state = await snapshot(page)
    expect(state.renderedBounds).not.toBeNull()
    expect(state.canvasClientSize).not.toBeNull()
    expect(state.viewportScale).toBeGreaterThan(0)
    expect(state.viewportScale).toBeLessThan(0.5)

    const canvasBox = await page.locator('#canvas').boundingBox()
    expect(canvasBox).not.toBeNull()

    const first = await page.evaluate(() => window.__MERMAID_DEV__!.getNodeScreenBounds('n0'))
    const last = await page.evaluate(() => window.__MERMAID_DEV__!.getNodeScreenBounds('n17'))
    expect(first).not.toBeNull()
    expect(last).not.toBeNull()
    expect(first!.x).toBeGreaterThanOrEqual(canvasBox!.x - 1)
    expect(last!.x + last!.width).toBeLessThanOrEqual(canvasBox!.x + canvasBox!.width + 1)

    expect(pageErrors).toEqual([])
  })

  test('fitToView keeps small grouped Blueprint maps readable instead of over-shrinking them', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await page.setViewportSize({ width: 520, height: 420 })
    await waitForDevApi(page)

    const loaded = await page.evaluate(async () => {
      window.__MERMAID_DEV__!.setLayout('blueprint')
      return await window.__MERMAID_DEV__!.loadSource(`flowchart LR
  subgraph MOVE["MOVE / bronze"]
    direction TB
    Source["Source"]
    UploadFile["UploadFile"]
    Sheet["Sheet"]
    Source --> UploadFile --> Sheet
  end
  subgraph SHAPE["SHAPE / silver"]
    direction TB
    Table["Table"]
    Column["Column"]
    Entity["Entity"]
    Table --> Column
    Table --> Entity
  end
  subgraph SERVE["SERVE / gold"]
    direction TB
    View["View"]
    Dataset["Dataset"]
  end
  Sheet --> Table
  Table --> View
  Table --> Dataset`, '/__small-grouped-blueprint-fit__.mmd')
    })
    expect(loaded).toBe(true)

    await expect.poll(async () => (await snapshot(page)).viewportAlpha).toBe(1)

    const state = await snapshot(page)
    expect(state.viewportScale).not.toBeNull()
    expect(state.viewportScale!).toBeGreaterThanOrEqual(0.42)
    expect(state.subgraphCount).toBe(3)

    expect(pageErrors).toEqual([])
  })

  test('re-fits content and keeps the canvas crisp after container resize', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const before = await snapshot(page)
    expect(before.canvasClientSize).not.toBeNull()
    expect(before.canvasPixelSize).not.toBeNull()

    await page.setViewportSize({ width: 980, height: 720 })

    await expect.poll(async () => {
      const state = await snapshot(page)
      return state.canvasClientSize?.width ?? 0
    }).toBeLessThan(before.canvasClientSize!.width)

    await expect.poll(async () => (await snapshot(page)).viewportAlpha).toBe(1)

    const after = await snapshot(page)
    expect(after.canvasClientSize).not.toBeNull()
    expect(after.canvasPixelSize).not.toBeNull()
    expect(after.devicePixelRatio).not.toBeNull()
    expect(after.renderedBounds).not.toBeNull()
    expect(finiteBounds(after.renderedBounds)).toBe(true)

    const expectedPixelWidth = after.canvasClientSize!.width * after.devicePixelRatio!
    const expectedPixelHeight = after.canvasClientSize!.height * after.devicePixelRatio!
    expect(Math.abs(after.canvasPixelSize!.width - expectedPixelWidth)).toBeLessThanOrEqual(2)
    expect(Math.abs(after.canvasPixelSize!.height - expectedPixelHeight)).toBeLessThanOrEqual(2)

    const nodeBounds = await page.evaluate(() => window.__MERMAID_DEV__!.getNodeScreenBounds('OrderSvc'))
    expect(nodeBounds).not.toBeNull()
    const canvasBox = await page.locator('#canvas').boundingBox()
    expect(canvasBox).not.toBeNull()
    expect(nodeBounds!.x).toBeGreaterThanOrEqual(canvasBox!.x - 1)
    expect(nodeBounds!.y).toBeGreaterThanOrEqual(canvasBox!.y - 1)
    expect(nodeBounds!.x + nodeBounds!.width).toBeLessThanOrEqual(canvasBox!.x + canvasBox!.width + 1)
    expect(nodeBounds!.y + nodeBounds!.height).toBeLessThanOrEqual(canvasBox!.y + canvasBox!.height + 1)

    expect(pageErrors).toEqual([])
  })

  test('fitToView recovers content after the viewport is deliberately stranded off-canvas', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      await window.__MERMAID_DEV__!.loadFile('/examples/microservice/order-service.mmd')
    })
    await expect.poll(async () => (await snapshot(page)).currentFile).toBe('/examples/microservice/order-service.mmd')

    const probe = await page.evaluate(async () => {
      return await window.__MERMAID_DEV__!.runViewportRecoveryProbe('orderFlow') as ViewportRecoveryProbe
    })

    expect(probe.strandedOffscreen).toBe(true)
    expect(probe.recoveredScale).not.toBeNull()
    expect(probe.recoveredScale!).toBeGreaterThan(0.1)
    expect(Number.isFinite(probe.recoveredPosition?.x)).toBeTruthy()
    expect(Number.isFinite(probe.recoveredPosition?.y)).toBeTruthy()

    const recoveredBounds = await page.evaluate(() => window.__MERMAID_DEV__!.getNodeScreenBounds('orderFlow'))
    const canvasBox = await page.locator('#canvas').boundingBox()
    expect(recoveredBounds).not.toBeNull()
    expect(canvasBox).not.toBeNull()
    expect(recoveredBounds!.x + recoveredBounds!.width).toBeGreaterThan(canvasBox!.x)
    expect(recoveredBounds!.y + recoveredBounds!.height).toBeGreaterThan(canvasBox!.y)
    expect(recoveredBounds!.x).toBeLessThan(canvasBox!.x + canvasBox!.width)
    expect(recoveredBounds!.y).toBeLessThan(canvasBox!.y + canvasBox!.height)

    const recoveredCanvas = await page.locator('#canvas').screenshot()
    expect(recoveredCanvas).toMatchSnapshot('fit-to-view-recovery.png')

    expect(pageErrors).toEqual([])
  })

  test('reflows controls and keeps the rendered graph usable on a narrow mobile viewport', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      await window.__MERMAID_DEV__!.loadFile('/examples/microservice/overview.mmd')
      window.__MERMAID_DEV__!.fitToView()
    })

    await page.setViewportSize({ width: 390, height: 844 })

    await expect.poll(async () => {
      const state = await snapshot(page)
      return state.canvasClientSize?.width ?? 0
    }).toBeGreaterThan(200)
    await expect.poll(async () => (await snapshot(page)).viewportAlpha).toBe(1)
    await page.waitForTimeout(180)

    const layout = await page.evaluate(() => {
      const toolbar = document.getElementById('toolbar')!
      const controls = document.getElementById('controls')!
      const files = document.getElementById('files')!
      const canvasWrap = document.getElementById('canvas-wrap')!
      const toolbarRect = toolbar.getBoundingClientRect()
      const controlsStyle = getComputedStyle(controls)
      const filesStyle = getComputedStyle(files)
      const canvasWrapStyle = getComputedStyle(canvasWrap)
      return {
        toolbarRect: {
          left: toolbarRect.left,
          top: toolbarRect.top,
          right: toolbarRect.right,
          bottom: toolbarRect.bottom,
          width: toolbarRect.width,
          height: toolbarRect.height,
        },
        controlsColumns: controlsStyle.gridTemplateColumns.split(' ').filter(Boolean).length,
        filesColumns: filesStyle.gridTemplateColumns.split(' ').filter(Boolean).length,
        canvasWrapTop: canvasWrapStyle.top,
      }
    })

    expect(layout.toolbarRect.width).toBeGreaterThan(300)
    expect(layout.controlsColumns).toBeGreaterThanOrEqual(2)
    expect(layout.filesColumns).toBeGreaterThanOrEqual(2)
    expect(layout.canvasWrapTop).toBe(`${Math.ceil(layout.toolbarRect.bottom)}px`)

    const canvasBox = await page.locator('#canvas').boundingBox()
    expect(canvasBox).not.toBeNull()
    expect(layout.toolbarRect.bottom).toBeLessThanOrEqual(canvasBox!.y + 1)

    const metrics = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
    expect(findOverlapPairs(metrics, 'labelBounds')).toEqual([])

    const mobileShell = await page.screenshot()
    expect(mobileShell).toMatchSnapshot('mobile-responsive-shell.png', {
      maxDiffPixelRatio: 0.035,
    })
    expect(pageErrors).toEqual([])
  })

  test('can unfold after folding without losing the graph', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(() => window.__MERMAID_DEV__!.foldNode('core'))
    await expect.poll(async () => (await snapshot(page)).foldedSubgraphs).toContain('core')

    await page.evaluate(() => window.__MERMAID_DEV__!.unfoldNode('core'))
    await expect.poll(async () => (await snapshot(page)).foldedSubgraphs).not.toContain('core')

    const state = await snapshot(page)
    expect(state.nodeCount).toBeGreaterThan(0)
    expect(state.edgeCount).toBeGreaterThan(0)
    expect(pageErrors).toEqual([])
  })

  test('can expand a collapsed blueprint subgraph from the canvas', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const loaded = await page.evaluate(() => window.__MERMAID_DEV__!.loadSource(`%% @layout blueprint
graph TD
  subgraph core[Core Services]
    A[API]
    B[Service]
    C[Worker]
    A --> B
    C --> B
  end
`, '/__subgraph-toggle__.mmd'))
    expect(loaded).toBe(true)
    await page.evaluate(() => window.__MERMAID_DEV__!.setLayout('blueprint'))
    await expect.poll(async () => (await snapshot(page)).currentLayout).toBe('blueprint')

    const subgraphMembers = await page.evaluate(() => {
      const subgraph = window.__MERMAID_DEV__!.getRenderedSubgraphMetrics() as RenderedSubgraphMetrics[]
      return subgraph.find((entry) => entry.id === 'core')?.nodeIds ?? []
    })
    expect(subgraphMembers.length).toBeGreaterThan(0)

    const expandedNodeIds = await nodeIds(page)
    for (const id of subgraphMembers) {
      expect(expandedNodeIds).toContain(id)
    }

    await page.evaluate(() => window.__MERMAID_DEV__!.foldNode('core'))
    await expect.poll(async () => (await snapshot(page)).foldedSubgraphs).toContain('core')

    const collapsedNodeIds = await nodeIds(page)
    expect(collapsedNodeIds).toContain('core')
    for (const id of subgraphMembers) {
      expect(collapsedNodeIds).not.toContain(id)
    }

    const summaryBounds = await page.evaluate(() => window.__MERMAID_DEV__!.getNodeScreenBounds('core'))
    expect(summaryBounds).not.toBeNull()
    await page.mouse.click(summaryBounds!.x + summaryBounds!.width / 2, summaryBounds!.y + summaryBounds!.height / 2)

    await expect.poll(async () => (await snapshot(page)).foldedSubgraphs).not.toContain('core')

    const expandedAgainNodeIds = await nodeIds(page)
    for (const id of subgraphMembers) {
      expect(expandedAgainNodeIds).toContain(id)
    }

    expect(pageErrors).toEqual([])
  })

  test('keeps the stage free of orphaned or duplicate sprites across fold, focus, and philosophy rebuilds', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(() => {
      window.__MERMAID_DEV__!.foldNode('core')
      window.__MERMAID_DEV__!.unfoldNode('core')
      window.__MERMAID_DEV__!.focusSubgraph('core')
      window.__MERMAID_DEV__!.focusOut()
      window.__MERMAID_DEV__!.setLayout('blueprint')
      window.__MERMAID_DEV__!.setLayout('narrative')
    })

    await expect.poll(async () => (await snapshot(page)).currentLayout).toBe('narrative')
    await expect.poll(async () => (await snapshot(page)).focusStack).toEqual([])
    await expect.poll(async () => (await snapshot(page)).foldedSubgraphs).toEqual([])

    const state = await snapshot(page)
    const inventory = await page.evaluate(() => window.__MERMAID_DEV__!.getSceneInventory() as SceneInventory)

    expect(inventory.nodeSpriteChildren).toBe(state.nodeCount)
    expect(inventory.edgeGraphicChildren).toBe(state.edgeCount)
    expect(inventory.subgraphChildren).toBe(state.subgraphCount)
    expect(inventory.orphanNodeSprites).toEqual([])
    expect(inventory.orphanEdgeGraphics).toEqual([])
    expect(inventory.orphanSubgraphs).toEqual([])
    expect(inventory.duplicateNodeSpriteIds).toEqual([])
    expect(inventory.duplicateEdgeGraphicIds).toEqual([])
    expect(inventory.duplicateSubgraphIds).toEqual([])
    expect(pageErrors).toEqual([])
  })

  test('rapid relayout interruptions settle without leaving partial-alpha scene artifacts behind', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const loaded = await page.evaluate(async () => {
      return await window.__MERMAID_DEV__!.loadSource(`%% @layout narrative
graph TD
  A[Start]
  B[Plan]
  C[Build]
  D[Ship]
  E[Review]
  A --> B
  A --> C
  B --> D
  C --> D
  C --> E
`)
    })
    expect(loaded).toBe(true)

    await page.evaluate(() => {
      window.__MERMAID_DEV__!.setLayout('blueprint')
      window.__MERMAID_DEV__!.setLayout('map')
      window.__MERMAID_DEV__!.setLayout('radial')
      window.__MERMAID_DEV__!.setLayout('narrative')
    })

    await expect.poll(async () => (await snapshot(page)).currentLayout).toBe('narrative')
    await expect.poll(async () => (await snapshot(page)).viewportAlpha).toBe(1)
    const settled = await snapshot(page)
    const inventory = await page.evaluate(() => window.__MERMAID_DEV__!.getSceneInventory() as SceneInventory)
    const settledScene = await page.evaluate(() => ({
      nodes: window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[],
      edges: window.__MERMAID_DEV__!.getRenderedEdgeMetrics() as RenderedEdgeMetrics[],
      subgraphs: window.__MERMAID_DEV__!.getRenderedSubgraphMetrics() as RenderedSubgraphMetrics[],
    }))

    expect(settled.nodeCount).toBeGreaterThan(0)
    expect(settled.edgeCount).toBeGreaterThan(0)
    expect(inventory.orphanNodeSprites).toEqual([])
    expect(inventory.orphanEdgeGraphics).toEqual([])
    expect(inventory.orphanSubgraphs).toEqual([])
    expect(inventory.duplicateNodeSpriteIds).toEqual([])
    expect(inventory.duplicateEdgeGraphicIds).toEqual([])
    expect(inventory.duplicateSubgraphIds).toEqual([])

    for (const node of settledScene.nodes) {
      const allowed = [1, 0.7]
      expect(allowed.some((candidate) => Math.abs(node.alpha - candidate) < 0.001)).toBe(true)
    }
    for (const edge of settledScene.edges) {
      const allowed = [1, 0.4]
      expect(allowed.some((candidate) => Math.abs(edge.alpha - candidate) < 0.001)).toBe(true)
    }
    for (const subgraph of settledScene.subgraphs) {
      expect(subgraph.alpha).toBeCloseTo(1, 3)
      expect(subgraph.layerIndex).toBeGreaterThanOrEqual(0)
      expect(subgraph.bounds.width).toBeGreaterThan(0)
      expect(subgraph.bounds.height).toBeGreaterThan(0)
    }

    const settledCanvas = await page.locator('#canvas').screenshot()
    expect(settledCanvas).toMatchSnapshot('relayout-interruption-settled-clean.png', {
      maxDiffPixelRatio: 0.015,
    })

    expect(pageErrors).toEqual([])
  })

  test('keeps edge endpoints attached to moving nodes during live relayout animation', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const loaded = await page.evaluate(async () => {
      return await window.__MERMAID_DEV__!.loadSource(`%% @layout narrative
graph TD
  A[Start]
  B[Plan]
  C[Build]
  D[Ship]
  E[Review]
  A --> B
  A --> C
  B --> D
  C --> D
  C --> E
`)
    })
    expect(loaded).toBe(true)

    const startNodes = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
    const startEdges = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedEdgeMetrics() as RenderedEdgeMetrics[])

    await page.evaluate(() => {
      window.__MERMAID_DEV__!.setLayout('radial')
    })

    await page.waitForTimeout(110)

    const midNodes = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
    const midEdges = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedEdgeMetrics() as RenderedEdgeMetrics[])

    await page.waitForTimeout(220)

    const endNodes = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])

    const movedNode = midNodes.find((node) => {
      const start = startNodes.find((candidate) => candidate.id === node.id)
      const end = endNodes.find((candidate) => candidate.id === node.id)
      if (!start || !end) return false
      const midShift = Math.hypot(node.center.x - start.center.x, node.center.y - start.center.y)
      const finalShift = Math.hypot(end.center.x - start.center.x, end.center.y - start.center.y)
      return midShift > 6 && finalShift > 20
    })
    expect(movedNode).toBeDefined()

    const movedEdge = midEdges.find((edge) => {
      const start = startEdges.find((candidate) => candidate.id === edge.id)
      if (!start) return false
      const startPoint = start.points[0]
      const midPoint = edge.points[0]
      const endPoint = edge.points[edge.points.length - 1]
      const startEndPoint = start.points[start.points.length - 1]
      return (
        Math.hypot(midPoint.x - startPoint.x, midPoint.y - startPoint.y) > 4
        || Math.hypot(endPoint.x - startEndPoint.x, endPoint.y - startEndPoint.y) > 4
      )
    })
    expect(movedEdge).toBeDefined()

    for (const edge of midEdges) {
      const sourceNode = midNodes.find((node) => node.id === edge.source)
      const targetNode = midNodes.find((node) => node.id === edge.target)
      expect(sourceNode).toBeDefined()
      expect(targetNode).toBeDefined()
      expect(edge.points.length).toBeGreaterThanOrEqual(2)
      expect(pointOnNodeRectBoundary(edge.points[0], sourceNode!.center, sourceNode!.displayWidth, sourceNode!.displayHeight, 12)).toBe(true)
      expect(pointOnNodeRectBoundary(edge.points[edge.points.length - 1], targetNode!.center, targetNode!.displayWidth, targetNode!.displayHeight, 12)).toBe(true)
    }

    const sourceBounds = await page.evaluate((nodeId) => window.__MERMAID_DEV__!.getNodeScreenBounds(nodeId), movedEdge!.source)
    const targetBounds = await page.evaluate((nodeId) => window.__MERMAID_DEV__!.getNodeScreenBounds(nodeId), movedEdge!.target)
    expect(sourceBounds).not.toBeNull()
    expect(targetBounds).not.toBeNull()

    const xs = [
      sourceBounds!.x,
      sourceBounds!.x + sourceBounds!.width,
      targetBounds!.x,
      targetBounds!.x + targetBounds!.width,
      ...movedEdge!.screenPoints.map((point) => point.x),
    ]
    const ys = [
      sourceBounds!.y,
      sourceBounds!.y + sourceBounds!.height,
      targetBounds!.y,
      targetBounds!.y + targetBounds!.height,
      ...movedEdge!.screenPoints.map((point) => point.y),
    ]
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const clipWidth = 560
    const clipHeight = 400
    const clipCenterX = (minX + maxX) / 2
    const clipCenterY = (minY + maxY) / 2
    const attachedMotionShot = await page.screenshot({
      clip: {
        x: Math.max(0, Math.floor(clipCenterX - clipWidth / 2)),
        y: Math.max(0, Math.floor(clipCenterY - clipHeight / 2)),
        width: clipWidth,
        height: clipHeight,
      },
    })
    expect(attachedMotionShot).toMatchSnapshot('relayout-moving-edge-attached.png', {
      maxDiffPixelRatio: 0.015,
    })

    expect(pageErrors).toEqual([])
  })

  test('keeps live relayout motion free of duplicate or orphaned sprites mid-animation', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const loaded = await page.evaluate(async () => {
      return await window.__MERMAID_DEV__!.loadSource(`%% @layout narrative
graph TD
  A[Start]
  B[Plan]
  C[Build]
  D[Ship]
  E[Review]
  A --> B
  A --> C
  B --> D
  C --> D
  C --> E
`)
    })
    expect(loaded).toBe(true)

    const before = await snapshot(page)
    const beforeNodes = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.map((node) => ({ id: node.id, x: node.center.x, y: node.center.y }))
    })
    await page.evaluate(() => {
      window.__MERMAID_DEV__!.setLayout('radial')
    })

    await page.waitForTimeout(110)

    const mid = await snapshot(page)
    const inventory = await page.evaluate(() => window.__MERMAID_DEV__!.getSceneInventory() as SceneInventory)
    const movedNodes = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.map((node) => ({ id: node.id, x: node.center.x, y: node.center.y }))
    })

    expect(mid.currentLayout).toBe('radial')
    expect(mid.nodeCount).toBe(before.nodeCount)
    expect(mid.edgeCount).toBe(before.edgeCount)
    expect(inventory.nodeSpriteChildren).toBe(mid.nodeCount)
    expect(inventory.edgeGraphicChildren).toBe(mid.edgeCount)
    expect(inventory.subgraphChildren).toBe(mid.subgraphCount)
    expect(inventory.unknownChildren).toBe(0)
    expect(inventory.orphanNodeSprites).toEqual([])
    expect(inventory.orphanEdgeGraphics).toEqual([])
    expect(inventory.orphanSubgraphs).toEqual([])
    expect(inventory.duplicateNodeSpriteIds).toEqual([])
    expect(inventory.duplicateEdgeGraphicIds).toEqual([])
    expect(inventory.duplicateSubgraphIds).toEqual([])

    const movedCount = movedNodes.filter((node) => {
      const prior = beforeNodes.find((candidate) => candidate.id === node.id)
      if (!prior) return false
      return Math.hypot(node.x - prior.x, node.y - prior.y) > 6
    }).length
    expect(movedCount).toBeGreaterThan(0)

    expect(pageErrors).toEqual([])
  })

  test('renders a clean mid-relayout frame without double-drawn node artifacts', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const loaded = await page.evaluate(async () => {
      return await window.__MERMAID_DEV__!.loadSource(`%% @layout narrative
graph TD
  A[Start]
  B[Plan]
  C[Build]
  D[Ship]
  E[Review]
  A --> B
  A --> C
  B --> D
  C --> D
  C --> E
`)
    })
    expect(loaded).toBe(true)

    const beforeNodes = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.map((node) => ({ id: node.id, x: node.center.x, y: node.center.y }))
    })

    await page.evaluate(() => {
      window.__MERMAID_DEV__!.setLayout('radial')
    })

    await page.waitForTimeout(110)

    const movingNodes = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.map((node) => ({ id: node.id, x: node.center.x, y: node.center.y }))
    })

    const movedCount = movingNodes.filter((node) => {
      const prior = beforeNodes.find((candidate) => candidate.id === node.id)
      if (!prior) return false
      return Math.hypot(node.x - prior.x, node.y - prior.y) > 6
    }).length
    expect(movedCount).toBeGreaterThan(0)

    const motionCanvas = await page.locator('#canvas').screenshot()
    expect(motionCanvas).toMatchSnapshot('relayout-mid-motion-clean-frame.png', {
      maxDiffPixelRatio: 0.015,
    })
    expect(pageErrors).toEqual([])
  })

  test('moves nodes through a smooth live relayout progression instead of teleporting', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const loaded = await page.evaluate(async () => {
      return await window.__MERMAID_DEV__!.loadSource(`%% @layout narrative
graph TD
  A[Start]
  B[Plan]
  C[Build]
  D[Ship]
  E[Review]
  A --> B
  A --> C
  B --> D
  C --> D
  C --> E
`)
    })
    expect(loaded).toBe(true)

    const startNodes = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.map((node) => ({ id: node.id, x: node.center.x, y: node.center.y }))
    })

    await page.evaluate(() => {
      window.__MERMAID_DEV__!.setLayout('radial')
    })

    await page.waitForTimeout(45)
    const sample1 = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.map((node) => ({ id: node.id, x: node.center.x, y: node.center.y }))
    })

    await page.waitForTimeout(45)
    const sample2 = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.map((node) => ({ id: node.id, x: node.center.x, y: node.center.y }))
    })

    await page.waitForTimeout(45)
    const sample3 = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.map((node) => ({ id: node.id, x: node.center.x, y: node.center.y }))
    })

    await page.waitForTimeout(140)
    const endNodes = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.map((node) => ({ id: node.id, x: node.center.x, y: node.center.y }))
    })

    const movement = startNodes.map((startNode) => {
      const endNode = endNodes.find((candidate) => candidate.id === startNode.id)!
      return {
        id: startNode.id,
        start: startNode,
        end: endNode,
        total: Math.hypot(endNode.x - startNode.x, endNode.y - startNode.y),
      }
    })
    const target = movement.sort((a, b) => b.total - a.total)[0]
    expect(target.total).toBeGreaterThan(40)

    const sampleFor = (nodes: Array<{ id: string; x: number; y: number }>) =>
      nodes.find((node) => node.id === target.id)!
    const distFromStart = (node: { x: number; y: number }) =>
      Math.hypot(node.x - target.start.x, node.y - target.start.y)

    const p1 = sampleFor(sample1)
    const p2 = sampleFor(sample2)
    const p3 = sampleFor(sample3)

    const d1 = distFromStart(p1)
    const d2 = distFromStart(p2)
    const d3 = distFromStart(p3)

    expect(d1).toBeGreaterThan(1)
    expect(d2).toBeGreaterThan(d1 + 1)
    expect(d3).toBeGreaterThan(d2 + 1)
    expect(d3).toBeLessThan(target.total + 0.5)

    const step12 = Math.hypot(p2.x - p1.x, p2.y - p1.y)
    const step23 = Math.hypot(p3.x - p2.x, p3.y - p2.y)
    expect(step12).toBeLessThan(target.total * 0.7)
    expect(step23).toBeLessThan(target.total * 0.7)

    expect(pageErrors).toEqual([])
  })

  test('resolves relative cross-file navigation and reveals the target node', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const success = await page.evaluate(() =>
      window.__MERMAID_DEV__!.navigateTo('./order-service', 'orderFlow'),
    )

    expect(success).toBeTruthy()
    await expect.poll(async () => (await snapshot(page)).currentFile)
      .toBe('/examples/microservice/order-service.mmd')

    const state = await snapshot(page)
    expect(state.selectedNodeId).toBe('orderFlow')
    expect(state.fileHistory).toContain('/examples/microservice/overview.mmd')
    expect(pageErrors).toEqual([])
  })

  test('canonicalizes equivalent link target spellings to the same file in browser navigation', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      await window.__MERMAID_DEV__!.loadFile('/examples/cross-file/main.mmd')
    })
    await expect.poll(async () => (await snapshot(page)).currentFile).toBe('/examples/cross-file/main.mmd')

    const relativeSuccess = await page.evaluate(() =>
      window.__MERMAID_DEV__!.navigateTo('../microservice/./order-service.mmd', 'orderFlow'),
    )
    expect(relativeSuccess).toBeTruthy()
    await expect.poll(async () => (await snapshot(page)).currentFile)
      .toBe('/examples/microservice/order-service.mmd')

    let state = await snapshot(page)
    expect(state.selectedNodeId).toBe('orderFlow')

    await page.evaluate(() => window.__MERMAID_DEV__!.navigateTo('/examples/cross-file/main.mmd'))
    await expect.poll(async () => (await snapshot(page)).currentFile).toBe('/examples/cross-file/main.mmd')

    const absoluteSuccess = await page.evaluate(() =>
      window.__MERMAID_DEV__!.navigateTo('/examples/microservice/order-service', 'orderFlow'),
    )
    expect(absoluteSuccess).toBeTruthy()
    await expect.poll(async () => (await snapshot(page)).currentFile)
      .toBe('/examples/microservice/order-service.mmd')

    state = await snapshot(page)
    expect(state.selectedNodeId).toBe('orderFlow')
    expect(pageErrors).toEqual([])
  })

  test('navigates through a real @link click and reveals the fragment target node', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      await window.__MERMAID_DEV__!.loadFile('/examples/cross-file/main.mmd')
    })
    await expect.poll(async () => (await snapshot(page)).currentFile).toBe('/examples/cross-file/main.mmd')

    const activated = await page.evaluate(() => window.__MERMAID_DEV__!.clickLink('auth'))
    expect(activated).toBe(true)

    await expect.poll(async () => (await snapshot(page)).currentFile)
      .toBe('/examples/cross-file/auth.mmd')

    const state = await snapshot(page)
    expect(state.selectedNodeId).toBe('loginFlow')
    expect(state.fileHistory).toContain('/examples/cross-file/main.mmd')
    expect(pageErrors).toEqual([])
  })

  test('keeps the newest async file load when an earlier load resolves later', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(() => {
      window.__MERMAID_DEV__!.setFileOverride(
        '/examples/microservice/order-service.mmd',
        `%% @layout narrative
graph TD
  orderFlow[Slow Order]
  orderFlow --> later[Later]
`,
        600,
      )
      window.__MERMAID_DEV__!.setFileOverride(
        '/examples/cross-file/auth.mmd',
        `%% @layout narrative
graph TD
  loginFlow[Fast Auth]
  loginFlow --> token[Token]
`,
      )
    })

    await page.evaluate(() => {
      void window.__MERMAID_DEV__!.loadFile('/examples/microservice/order-service.mmd')
      void window.__MERMAID_DEV__!.loadFile('/examples/cross-file/auth.mmd')
    })

    await expect.poll(async () => (await snapshot(page)).currentFile)
      .toBe('/examples/cross-file/auth.mmd')

    const state = await snapshot(page)
    expect(state.statusLevel).not.toBe('error')

    const labels = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.map((node) => node.id)
    })
    expect(labels).toContain('loginFlow')
    expect(labels).not.toContain('orderFlow')

    await page.waitForTimeout(800)
    await expect.poll(async () => (await snapshot(page)).currentFile)
      .toBe('/examples/cross-file/auth.mmd')

    await page.evaluate(() => window.__MERMAID_DEV__!.clearFileOverrides())
    expect(pageErrors).toEqual([])
  })

  test('keeps cross-file hover previews on-screen and dismisses only after leaving node and popup', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await hoverNode(page, 'OrderSvc')

    const nodeBounds = await page.evaluate(() => window.__MERMAID_DEV__!.getNodeScreenBounds('OrderSvc'))
    expect(nodeBounds).not.toBeNull()

    await expect.poll(async () => {
      return await page.evaluate(() => window.__MERMAID_DEV__!.getPreviewState() as PreviewState)
    }).toMatchObject({ visible: true, targetFile: '/examples/microservice/order-service.mmd' })

    const previewState = await page.evaluate(() => window.__MERMAID_DEV__!.getPreviewState() as PreviewState)
    expect(previewState.bounds).not.toBeNull()

    const canvas = page.locator('#canvas')
    const canvasBox = await canvas.boundingBox()
    expect(canvasBox).not.toBeNull()
    const bounds = previewState.bounds!

    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.y).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(canvasBox!.width + 1)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(canvasBox!.height + 1)

    await expect(page.locator('body')).toHaveScreenshot('hover-preview-onscreen.png')

    const nodeCenterX = nodeBounds!.x + nodeBounds!.width / 2 - canvasBox!.x
    const previewCenterX = bounds.x + bounds.width / 2
    if (nodeCenterX > canvasBox!.width / 2) {
      expect(previewCenterX).toBeLessThan(nodeCenterX)
    }

    await page.mouse.move(
      canvasBox!.x + bounds.x + bounds.width / 2,
      canvasBox!.y + bounds.y + bounds.height / 2,
    )
    await expect.poll(async () => {
      return await page.evaluate(() => window.__MERMAID_DEV__!.getPreviewState() as PreviewState)
    }).toMatchObject({ visible: true, popupHovered: true })

    await page.mouse.move(canvasBox!.x + 12, canvasBox!.y + 12)
    await expect.poll(async () => {
      const state = await page.evaluate(() => window.__MERMAID_DEV__!.getPreviewState() as PreviewState)
      return state.visible
    }).toBeFalsy()

    expect(pageErrors).toEqual([])
  })

  test('keeps the hover preview stable while the pointer moves in small steps from node to popup', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await hoverNode(page, 'OrderSvc')

    const nodeBounds = await page.evaluate(() => window.__MERMAID_DEV__!.getNodeScreenBounds('OrderSvc'))
    expect(nodeBounds).not.toBeNull()

    await expect.poll(async () => {
      return await page.evaluate(() => window.__MERMAID_DEV__!.getPreviewState() as PreviewState)
    }).toMatchObject({ visible: true, targetFile: '/examples/microservice/order-service.mmd' })

    const previewState = await page.evaluate(() => window.__MERMAID_DEV__!.getPreviewState() as PreviewState)
    expect(previewState.bounds).not.toBeNull()

    const canvas = page.locator('#canvas')
    const canvasBox = await canvas.boundingBox()
    expect(canvasBox).not.toBeNull()

    const startX = nodeBounds!.x + nodeBounds!.width / 2
    const startY = nodeBounds!.y + nodeBounds!.height / 2
    const targetX = canvasBox!.x + previewState.bounds!.x + 24
    const targetY = canvasBox!.y + previewState.bounds!.y + 24

    for (let step = 1; step <= 6; step++) {
      const t = step / 6
      await page.mouse.move(
        startX + (targetX - startX) * t,
        startY + (targetY - startY) * t,
      )
      await page.waitForTimeout(35)
      const movingState = await page.evaluate(() => window.__MERMAID_DEV__!.getPreviewState() as PreviewState)
      expect(movingState.visible).toBe(true)
      expect(movingState.targetFile).toBe('/examples/microservice/order-service.mmd')
    }

    await expect.poll(async () => {
      return await page.evaluate(() => window.__MERMAID_DEV__!.getPreviewState() as PreviewState)
    }).toMatchObject({ visible: true, popupHovered: true, targetFile: '/examples/microservice/order-service.mmd' })

    expect(pageErrors).toEqual([])
  })

  test('does not show a stale preview after pointer leave before delayed resolve completes', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(() => {
      window.__MERMAID_DEV__!.setPreviewOverride(
        '/examples/microservice/order-service.mmd',
        `%% @layout blueprint
graph TD
  orderFlow[Slow Preview]
  orderFlow --> orderDone[Done]
`,
        500,
      )
    })

    await hoverNode(page, 'OrderSvc')
    const canvas = page.locator('#canvas')
    const canvasBox = await canvas.boundingBox()
    expect(canvasBox).not.toBeNull()
    await page.mouse.move(canvasBox!.x + 12, canvasBox!.y + 12)

    await page.waitForTimeout(950)

    const previewState = await page.evaluate(() => window.__MERMAID_DEV__!.getPreviewState() as PreviewState)
    expect(previewState.visible).toBeFalsy()

    await page.evaluate(() => window.__MERMAID_DEV__!.clearPreviewOverrides())
    expect(pageErrors).toEqual([])
  })

  test('anchors a delayed hover preview to the node current position after the view zoom changes', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(() => {
      window.__MERMAID_DEV__!.setPreviewOverride(
        '/examples/microservice/order-service.mmd',
        `%% @layout blueprint
graph TD
  orderFlow[Zoomed Preview]
  orderFlow --> orderDone[Done]
`,
        500,
      )
    })

    const beforeBounds = await page.evaluate(() => window.__MERMAID_DEV__!.getNodeScreenBounds('OrderSvc'))
    expect(beforeBounds).not.toBeNull()

    await hoverNode(page, 'OrderSvc')
    await page.waitForTimeout(120)
    const appliedZoom = await page.evaluate(() => window.__MERMAID_DEV__!.setRelativeZoom(1.8))
    expect(appliedZoom).not.toBeNull()

    const canvas = page.locator('#canvas')
    const canvasBox = await canvas.boundingBox()
    expect(canvasBox).not.toBeNull()

    await expect.poll(async () => {
      const bounds = await page.evaluate(() => window.__MERMAID_DEV__!.getNodeScreenBounds('OrderSvc'))
      if (!bounds || !beforeBounds) return 0
      const beforeCenterX = beforeBounds.x + beforeBounds.width / 2
      const beforeCenterY = beforeBounds.y + beforeBounds.height / 2
      const afterCenterX = bounds.x + bounds.width / 2
      const afterCenterY = bounds.y + bounds.height / 2
      return Math.hypot(afterCenterX - beforeCenterX, afterCenterY - beforeCenterY)
    }).toBeGreaterThan(40)

    await expect.poll(async () => {
      return await page.evaluate(() => window.__MERMAID_DEV__!.getPreviewState() as PreviewState)
    }).toMatchObject({ visible: true, targetFile: '/examples/microservice/order-service.mmd' })

    const previewState = await page.evaluate(() => window.__MERMAID_DEV__!.getPreviewState() as PreviewState)
    const currentBounds = await page.evaluate(() => window.__MERMAID_DEV__!.getNodeScreenBounds('OrderSvc'))
    expect(currentBounds).not.toBeNull()
    expect(previewState.bounds).not.toBeNull()

    const anchorX = currentBounds!.x + currentBounds!.width - canvasBox!.x
    const anchorY = currentBounds!.y - canvasBox!.y
    const previewWidth = 420
    const previewHeight = 280
    let expectedX = anchorX + 20
    let expectedY = anchorY - 20
    if (expectedX + previewWidth > canvasBox!.width - 20) expectedX = anchorX - previewWidth - 20
    if (expectedY + previewHeight > canvasBox!.height - 20) expectedY = canvasBox!.height - previewHeight - 20
    expectedX = Math.max(20, Math.min(expectedX, canvasBox!.width - previewWidth - 20))
    expectedY = Math.max(20, Math.min(expectedY, canvasBox!.height - previewHeight - 20))

    expect(previewState.bounds!.x).toBeCloseTo(expectedX, 1)
    expect(previewState.bounds!.y).toBeCloseTo(expectedY, 1)

    await page.evaluate(() => window.__MERMAID_DEV__!.clearPreviewOverrides())
    expect(pageErrors).toEqual([])
  })

  test('anchors a delayed hover preview to the node current position after the viewport moves', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(() => {
      window.__MERMAID_DEV__!.setPreviewOverride(
        '/examples/microservice/order-service.mmd',
        `%% @layout blueprint
graph TD
  orderFlow[Moved Preview]
  orderFlow --> orderDone[Done]
`,
        500,
      )
    })

    const beforeBounds = await page.evaluate(() => window.__MERMAID_DEV__!.getNodeScreenBounds('OrderSvc'))
    expect(beforeBounds).not.toBeNull()

    await hoverNode(page, 'OrderSvc')
    await page.waitForTimeout(120)
    const nudged = await page.evaluate(() => window.__MERMAID_DEV__!.nudgeViewport(-180, 110))
    expect(nudged).not.toBeNull()

    const canvas = page.locator('#canvas')
    const canvasBox = await canvas.boundingBox()
    expect(canvasBox).not.toBeNull()

    await expect.poll(async () => {
      const bounds = await page.evaluate(() => window.__MERMAID_DEV__!.getNodeScreenBounds('OrderSvc'))
      if (!bounds || !beforeBounds) return 0
      const beforeCenterX = beforeBounds.x + beforeBounds.width / 2
      const beforeCenterY = beforeBounds.y + beforeBounds.height / 2
      const afterCenterX = bounds.x + bounds.width / 2
      const afterCenterY = bounds.y + bounds.height / 2
      return Math.hypot(afterCenterX - beforeCenterX, afterCenterY - beforeCenterY)
    }).toBeGreaterThan(120)

    await expect.poll(async () => {
      return await page.evaluate(() => window.__MERMAID_DEV__!.getPreviewState() as PreviewState)
    }).toMatchObject({ visible: true, targetFile: '/examples/microservice/order-service.mmd' })

    const previewState = await page.evaluate(() => window.__MERMAID_DEV__!.getPreviewState() as PreviewState)
    const currentBounds = await page.evaluate(() => window.__MERMAID_DEV__!.getNodeScreenBounds('OrderSvc'))
    expect(currentBounds).not.toBeNull()
    expect(previewState.bounds).not.toBeNull()

    const anchorX = currentBounds!.x + currentBounds!.width - canvasBox!.x
    const anchorY = currentBounds!.y - canvasBox!.y
    const previewWidth = 420
    const previewHeight = 280
    let expectedX = anchorX + 20
    let expectedY = anchorY - 20
    if (expectedX + previewWidth > canvasBox!.width - 20) expectedX = anchorX - previewWidth - 20
    if (expectedY + previewHeight > canvasBox!.height - 20) expectedY = canvasBox!.height - previewHeight - 20
    expectedX = Math.max(20, Math.min(expectedX, canvasBox!.width - previewWidth - 20))
    expectedY = Math.max(20, Math.min(expectedY, canvasBox!.height - previewHeight - 20))

    expect(previewState.bounds!.x).toBeCloseTo(expectedX, 1)
    expect(previewState.bounds!.y).toBeCloseTo(expectedY, 1)

    await page.evaluate(() => window.__MERMAID_DEV__!.clearPreviewOverrides())
    expect(pageErrors).toEqual([])
  })

  test('invalidates preview cache on reload and uses the target file philosophy', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)
    const canvas = page.locator('#canvas')
    const canvasBox = await canvas.boundingBox()
    expect(canvasBox).not.toBeNull()

    await page.evaluate(() => {
      window.__MERMAID_DEV__!.setPreviewOverride(
        '/examples/cross-file/auth.mmd',
        `%% @layout blueprint
graph TD
  loginFlow[Preview A]
  loginFlow --> doneA[Done A]
`,
      )
    })

    await page.evaluate(() => window.__MERMAID_DEV__!.loadFile('/examples/cross-file/main.mmd'))
    await expect.poll(async () => (await snapshot(page)).currentFile).toBe('/examples/cross-file/main.mmd')

    await hoverNode(page, 'auth')
    await expect.poll(async () => {
      return await page.evaluate(() => window.__MERMAID_DEV__!.getPreviewState() as PreviewState)
    }).toMatchObject({
      visible: true,
      targetFile: '/examples/cross-file/auth.mmd',
      philosophy: 'blueprint',
    })

    const firstPreview = await page.evaluate(() => window.__MERMAID_DEV__!.getPreviewState() as PreviewState)
    expect(firstPreview.nodeLabels).toContain('Preview A')
    expect(new Set(firstPreview.nodeFontFamilies)).toEqual(new Set(['MermaidBlueprint']))
    expect(firstPreview.titleFontFamily).toBe('MermaidBlueprint')
    const firstPreviewShot = await page.screenshot({
      clip: {
        x: Math.max(0, canvasBox!.x + firstPreview.bounds!.x - 16),
        y: Math.max(0, canvasBox!.y + firstPreview.bounds!.y - 16),
        width: firstPreview.bounds!.width + 32,
        height: firstPreview.bounds!.height + 32,
      },
    })
    expect(firstPreviewShot).toMatchSnapshot('preview-target-philosophy-blueprint.png')

    await page.evaluate(() => {
      window.__MERMAID_DEV__!.setPreviewOverride(
        '/examples/cross-file/auth.mmd',
        `%% @layout breath
graph TD
  loginFlow[Preview B]
  loginFlow --> doneB[Done B]
`,
      )
    })

    await page.evaluate(() => window.__MERMAID_DEV__!.loadFile('/examples/cross-file/main.mmd'))
    await expect.poll(async () => (await snapshot(page)).currentFile).toBe('/examples/cross-file/main.mmd')

    await page.mouse.move(canvasBox!.x + 12, canvasBox!.y + 12)
    await expect.poll(async () => {
      const state = await page.evaluate(() => window.__MERMAID_DEV__!.getPreviewState() as PreviewState)
      return state.visible
    }).toBeFalsy()

    await hoverNode(page, 'auth')
    await expect.poll(async () => {
      return await page.evaluate(() => window.__MERMAID_DEV__!.getPreviewState() as PreviewState)
    }).toMatchObject({
      visible: true,
      targetFile: '/examples/cross-file/auth.mmd',
      philosophy: 'breath',
    })

    const secondPreview = await page.evaluate(() => window.__MERMAID_DEV__!.getPreviewState() as PreviewState)
    expect(secondPreview.nodeLabels).toContain('Preview B')
    expect(secondPreview.nodeLabels).not.toContain('Preview A')
    expect(new Set(secondPreview.nodeFontFamilies)).toEqual(new Set(['MermaidNode']))
    expect(secondPreview.titleFontFamily).toBe('MermaidLabel')
    const secondPreviewShot = await page.screenshot({
      clip: {
        x: Math.max(0, canvasBox!.x + secondPreview.bounds!.x - 16),
        y: Math.max(0, canvasBox!.y + secondPreview.bounds!.y - 16),
        width: secondPreview.bounds!.width + 32,
        height: secondPreview.bounds!.height + 32,
      },
    })
    expect(secondPreviewShot).toMatchSnapshot('preview-target-philosophy-breath.png')

    await page.evaluate(() => window.__MERMAID_DEV__!.clearPreviewOverrides())
    expect(pageErrors).toEqual([])
  })

  test('keeps the preview cache bounded and retains recently used entries', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const probe = await page.evaluate(async () => {
      return await window.__MERMAID_DEV__!.runPreviewCacheProbe() as PreviewCacheProbe
    })

    expect(probe.cacheSize).toBe(12)
    expect(probe.evictedOldest).toBe(true)
    expect(probe.touchedTargetRetained).toBe(true)
    expect(probe.newestTargetPresent).toBe(true)
    expect(probe.cachedTargets).not.toContain('/__preview-cache__/target-1.mmd')
    expect(probe.cachedTargets).toContain('/__preview-cache__/target-0.mmd')
    expect(probe.cachedTargets).toContain('/__preview-cache__/target-12.mmd')
    expect(pageErrors).toEqual([])
  })

  test('keeps a stable paint order for node internals and preview popup layers', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await hoverNode(page, 'OrderSvc')
    await expect.poll(async () => {
      const nodes = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
      return nodes.some((node) => node.id === 'OrderSvc' && node.hoverVisible)
    }).toBe(true)

    const selected = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.find((node) => node.id === 'OrderSvc')!
    })
    expect(selected.shapeLayerIndex).toBeLessThan(selected.labelLayerIndex)
    expect(selected.labelLayerIndex).toBeLessThan(selected.badgeLayerIndex!)
    expect(selected.badgeLayerIndex!).toBeLessThan(selected.hoverLayerIndex)
    expect(selected.hoverLayerIndex).toBeLessThan(selected.selectionLayerIndex)

    await expect.poll(async () => {
      const preview = await page.evaluate(() => window.__MERMAID_DEV__!.getPreviewState() as PreviewState)
      return preview.visible
    }).toBe(true)
    const previewState = await page.evaluate(() => window.__MERMAID_DEV__!.getPreviewState() as PreviewState)
    const stageSnapshot = await snapshot(page)
    expect(stageSnapshot.viewportLayerIndex).not.toBeNull()
    expect(previewState.stageLayerIndex).not.toBeNull()
    expect(previewState.stageLayerIndex!).toBeGreaterThan(stageSnapshot.viewportLayerIndex!)

    expect(pageErrors).toEqual([])
  })

  test('keeps subgraphs behind edges and edges behind nodes on the main viewport stage', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      await window.__MERMAID_DEV__!.loadFile('/examples/with-subgraphs.mmd')
    })

    const { nodes, edges, subgraphs } = await page.evaluate(() => ({
      nodes: window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[],
      edges: window.__MERMAID_DEV__!.getRenderedEdgeMetrics() as RenderedEdgeMetrics[],
      subgraphs: window.__MERMAID_DEV__!.getRenderedSubgraphMetrics() as RenderedSubgraphMetrics[],
    }))

    expect(nodes.length).toBeGreaterThan(0)
    expect(edges.length).toBeGreaterThan(0)
    expect(subgraphs.length).toBeGreaterThan(0)

    const highestSubgraphLayer = Math.max(...subgraphs.map((subgraph) => subgraph.layerIndex))
    const lowestEdgeLayer = Math.min(...edges.map((edge) => edge.layerIndex))
    const highestEdgeLayer = Math.max(...edges.map((edge) => edge.layerIndex))
    const lowestNodeLayer = Math.min(...nodes.map((node) => node.layerIndex))

    expect(highestSubgraphLayer).toBeLessThan(lowestEdgeLayer)
    expect(highestEdgeLayer).toBeLessThan(lowestNodeLayer)
    expect(pageErrors).toEqual([])
  })

  test('uses the topmost node as the hover target when nodes overlap in screen space', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const probe = await page.evaluate(() => window.__MERMAID_DEV__!.loadHoverOverlapProbe() as Promise<OverlapProbeState>)
    expect(probe.loaded).toBeTruthy()
    expect(probe.topNodeId).toBe('B')
    expect(probe.bottomNodeId).toBe('A')

    const topBounds = await page.evaluate(() => window.__MERMAID_DEV__!.getNodeScreenBounds('B'))
    expect(topBounds).not.toBeNull()

    const canvas = page.locator('#canvas')
    const canvasBox = await canvas.boundingBox()
    expect(canvasBox).not.toBeNull()
    await page.mouse.move(canvasBox!.x + 8, canvasBox!.y + 8)
    await expect.poll(async () => {
      const metrics = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
      return metrics.some((node) => node.hoverVisible)
    }).toBeFalsy()

    await page.mouse.move(topBounds!.x + topBounds!.width / 2, topBounds!.y + topBounds!.height / 2)

    await expect.poll(async () => {
      const metrics = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
      const top = metrics.find((node) => node.id === 'B')
      const bottom = metrics.find((node) => node.id === 'A')
      return Boolean(top?.hoverVisible) && !bottom?.hoverVisible
    }).toBeTruthy()

    const metrics = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
    const top = metrics.find((node) => node.id === 'B')
    const bottom = metrics.find((node) => node.id === 'A')
    expect(top).toBeDefined()
    expect(bottom).toBeDefined()
    expect(top!.layerIndex).toBeGreaterThan(bottom!.layerIndex)
    const overlapHoverShot = await page.screenshot({ clip: expandClip(topBounds!) })
    expect(overlapHoverShot).toMatchSnapshot('overlap-topmost-hover.png')

    expect(pageErrors).toEqual([])
  })

  test('keeps the selected top node above an occluding sibling in overlap state', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const probe = await page.evaluate(() => window.__MERMAID_DEV__!.loadHoverOverlapProbe() as Promise<OverlapProbeState>)
    expect(probe.loaded).toBeTruthy()
    expect(probe.topNodeId).toBe('B')
    expect(probe.bottomNodeId).toBe('A')

    const topBounds = await page.evaluate(() => window.__MERMAID_DEV__!.getNodeScreenBounds('B'))
    expect(topBounds).not.toBeNull()

    await page.evaluate(() => window.__MERMAID_DEV__!.selectNode('B'))
    await expect.poll(async () => (await snapshot(page)).selectedNodeId).toBe('B')

    const metrics = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
    const top = metrics.find((node) => node.id === 'B')
    const bottom = metrics.find((node) => node.id === 'A')
    expect(top).toBeDefined()
    expect(bottom).toBeDefined()
    expect(top!.selectionAlpha).toBeGreaterThan(0)
    expect(top!.layerIndex).toBeGreaterThan(bottom!.layerIndex)

    const overlapSelectionShot = await page.screenshot({ clip: expandClip(topBounds!) })
    expect(overlapSelectionShot).toMatchSnapshot('overlap-topmost-selection.png')
    expect(pageErrors).toEqual([])
  })

  test('recolors live node, edge, subgraph, and broken-link states on philosophy switch', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const canvas = page.locator('#canvas')
    await expect(canvas).toHaveScreenshot('philosophy-switch-narrative-before.png')

    const overviewNodeBefore = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.find((node) => node.id === 'OrderSvc')!
    })
    const overviewEdgeBefore = await page.evaluate(() => {
      const edges = window.__MERMAID_DEV__!.getRenderedEdgeMetrics() as RenderedEdgeMetrics[]
      return edges.find((edge) => edge.source === 'Gateway' && edge.target === 'OrderSvc')!
    })
    const overviewSubgraphBefore = await page.evaluate(() => {
      const subgraphs = window.__MERMAID_DEV__!.getRenderedSubgraphMetrics() as RenderedSubgraphMetrics[]
      return subgraphs.find((subgraph) => subgraph.id === 'core')!
    })

    await page.evaluate(() => window.__MERMAID_DEV__!.setLayout('blueprint'))
    await expect.poll(async () => (await snapshot(page)).currentLayout).toBe('blueprint')

    const overviewNodeAfter = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.find((node) => node.id === 'OrderSvc')!
    })
    const overviewEdgeAfter = await page.evaluate(() => {
      const edges = window.__MERMAID_DEV__!.getRenderedEdgeMetrics() as RenderedEdgeMetrics[]
      return edges.find((edge) => edge.source === 'Gateway' && edge.target === 'OrderSvc')!
    })
    const overviewSubgraphAfter = await page.evaluate(() => {
      const subgraphs = window.__MERMAID_DEV__!.getRenderedSubgraphMetrics() as RenderedSubgraphMetrics[]
      return subgraphs.find((subgraph) => subgraph.id === 'core')!
    })

    expect(overviewNodeBefore.labelFill).not.toBe(overviewNodeAfter.labelFill)
    expect(overviewNodeBefore.nodeFill).not.toBe(overviewNodeAfter.nodeFill)
    expect(overviewNodeBefore.nodeStroke).not.toBe(overviewNodeAfter.nodeStroke)
    expect(overviewNodeBefore.labelFontFamily).not.toBe(overviewNodeAfter.labelFontFamily)
    expect(overviewNodeAfter.labelFontFamily).toBe('MermaidBlueprint')
    expect(overviewEdgeBefore.strokeColor).not.toBe(overviewEdgeAfter.strokeColor)
    expect(overviewSubgraphBefore.labelFill).not.toBe(overviewSubgraphAfter.labelFill)
    expect(overviewSubgraphBefore.labelFontFamily).not.toBe(overviewSubgraphAfter.labelFontFamily)
    expect(overviewSubgraphAfter.labelFontFamily).toBe('MermaidBlueprint')
    expect(overviewSubgraphBefore.accent).not.toBe(overviewSubgraphAfter.accent)
    await expect(canvas).toHaveScreenshot('philosophy-switch-blueprint-after.png')

    await page.evaluate(async () => {
      await window.__MERMAID_DEV__!.loadFile('/examples/cross-file/broken-link.mmd')
    })
    const brokenBefore = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.find((node) => node.id === 'missing')!
    })

    await page.evaluate(() => window.__MERMAID_DEV__!.setLayout('radial'))
    await expect.poll(async () => (await snapshot(page)).currentLayout).toBe('radial')

    const brokenAfter = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.find((node) => node.id === 'missing')!
    })

    expect(brokenBefore.brokenBadgeAccent).not.toBeNull()
    expect(brokenAfter.brokenBadgeAccent).not.toBeNull()
    expect(brokenBefore.brokenBadgeAccent).not.toBe(brokenAfter.brokenBadgeAccent)
    await expect(canvas).toHaveScreenshot('philosophy-switch-radial-broken-link.png')
    expect(pageErrors).toEqual([])
  })

  test('preserves authored Mermaid class colors in Blueprint', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      window.__MERMAID_DEV__!.setLayout('blueprint')
      return await window.__MERMAID_DEV__!.loadSource(`flowchart LR
classDef canon fill:#e6f7ee,stroke:#2e9e6b,color:#0b3d26;
classDef note fill:#fff7e6,stroke:#d9a521,color:#6b4e00,stroke-dasharray:3 2;
S["Source / Connector"]:::canon
N["Wrong name"]:::note
S -.-> N`, '/__blueprint-class-colors__.mmd')
    })

    await expect.poll(async () => (await snapshot(page)).currentLayout).toBe('blueprint')
    const metrics = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
    const source = metrics.find((node) => node.id === 'S')
    const note = metrics.find((node) => node.id === 'N')

    expect(source).toBeDefined()
    expect(note).toBeDefined()
    expect(source).toMatchObject({
      nodeFill: 0xe6f7ee,
      nodeStroke: 0x2e9e6b,
      labelFill: 0x0b3d26,
      labelFontFamily: 'MermaidBlueprint',
    })
    expect(note).toMatchObject({
      nodeFill: 0xfff7e6,
      nodeStroke: 0xd9a521,
      labelFill: 0x6b4e00,
      labelFontFamily: 'MermaidBlueprint',
    })
    expect(pageErrors).toEqual([])
  })

  test('sanitizes Mermaid HTML labels and renders allowed bold spans in Blueprint nodes', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      window.__MERMAID_DEV__!.setLayout('blueprint')
      return await window.__MERMAID_DEV__!.loadSource(`flowchart LR
A["<b>Upload + config panel</b><br/><script>alert(1)</script><em>CSV/Excel</em> · admin"]
B["Plain target"]
A --> B`, '/__blueprint-rich-label__.mmd')
    })

    await expect.poll(async () => (await snapshot(page)).currentLayout).toBe('blueprint')
    const metrics = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
    const source = metrics.find((node) => node.id === 'A')

    expect(source).toBeDefined()
    expect(source!.labelText).toContain('Upload + config panel')
    expect(source!.labelText).toContain('CSV/Excel')
    expect(source!.labelText).not.toContain('<')
    expect(source!.labelText).not.toContain('alert')
    expect(source!.labelSegmentFontFamilies).toContain('MermaidBlueprintBold')
    expect(source!.labelSegmentFontFamilies).toContain('MermaidBlueprint')
    expect(rectContainsRect(source!.shapeBounds, source!.labelBounds, 1.5)).toBe(true)
    expect(pageErrors).toEqual([])
  })

  test('renders class diagrams as Blueprint compartments with relationship wires', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      window.__MERMAID_DEV__!.setLayout('blueprint')
      return await window.__MERMAID_DEV__!.loadSource(`classDiagram
direction LR
class Repository~T~ {
  +find(id: string) T
  +save(entity: T) void
}
class UserService {
  -repo: Repository~User~
  +activate(userId: string) Result
}
UserService --> Repository : uses`, '/__blueprint-class-compartments__.mmd')
    })

    await expect.poll(async () => (await snapshot(page)).currentLayout).toBe('blueprint')
    const state = await snapshot(page)
    expect(state.nodeCount).toBe(2)
    expect(state.edgeCount).toBe(1)

    const nodes = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
    const edges = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedEdgeMetrics() as RenderedEdgeMetrics[])
    const service = nodes.find((node) => node.id === 'UserService')
    const repository = nodes.find((node) => node.id === 'Repository')
    const dependency = edges.find((edge) => edge.source === 'UserService' && edge.target === 'Repository')

    expect(service).toBeDefined()
    expect(repository).toBeDefined()
    expect(dependency).toBeDefined()
    expect(service!.labelText).toContain('UserService')
    expect(service!.labelText).toContain('- repo: Repository<User>')
    expect(service!.labelText).toContain('+ activate(userId: string): Result')
    expect(repository!.labelText).toContain('Repository')
    expect(repository!.labelText).toContain('+ find(id: string): T')
    expect(rectContainsRect(service!.shapeBounds, service!.labelBounds, 1.5)).toBe(true)
    expect(rectContainsRect(repository!.shapeBounds, repository!.labelBounds, 1.5)).toBe(true)
    expect(dependency!.bounds.width + dependency!.bounds.height).toBeGreaterThan(20)
    expect(pageErrors).toEqual([])
  })

  test('renders state diagrams as Blueprint transition maps with composite states', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      window.__MERMAID_DEV__!.setLayout('blueprint')
      return await window.__MERMAID_DEV__!.loadSource(`stateDiagram-v2
direction LR
[*] --> Draft
Draft --> InReview: submit
InReview --> Approved: approve
InReview --> Draft: request changes
Approved --> [*]
state InReview {
  [*] --> Waiting
  Waiting --> Escalated: stale
  Escalated --> Waiting: owner responds
}`, '/__blueprint-state-transitions__.mmd')
    })

    await expect.poll(async () => (await snapshot(page)).currentLayout).toBe('blueprint')
    const state = await snapshot(page)
    expect(state.nodeCount).toBe(8)
    expect(state.edgeCount).toBe(8)
    expect(state.subgraphCount).toBe(1)

    const nodes = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
    const edges = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedEdgeMetrics() as RenderedEdgeMetrics[])
    const subgraphs = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedSubgraphMetrics() as RenderedSubgraphMetrics[])
    const draft = nodes.find((node) => node.id === 'Draft')
    const review = nodes.find((node) => node.id === 'InReview')
    const composite = subgraphs.find((subgraph) => subgraph.id === 'state:InReview')
    const submit = edges.find((edge) => edge.id === 'state:Draft:InReview:submit')

    expect(draft).toBeDefined()
    expect(review).toBeDefined()
    expect(composite).toBeDefined()
    expect(submit).toBeDefined()
    expect(draft!.labelText).toContain('Draft')
    expect(review!.labelText).toContain('InReview')
    expect(composite!.labelText).toContain('InReview')
    expect(composite!.nodeIds).toEqual(['InReview_start', 'Waiting', 'Escalated'])
    expect(submit!.labelVisible).toBe(true)
    expect(submit!.labelBounds?.width ?? 0).toBeGreaterThan(10)
    expect(rectContainsRect(draft!.shapeBounds, draft!.labelBounds, 1.5)).toBe(true)
    expect(pageErrors).toEqual([])
  })

  test('renders ER cardinality as endpoint glyphs instead of label clutter', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      window.__MERMAID_DEV__!.setLayout('blueprint')
      return await window.__MERMAID_DEV__!.loadSource(`erDiagram
CUSTOMER ||--o{ ORDER : places
ORDER }o--|| ACCOUNT : billed_to
CUSTOMER {
  string id PK
  string name
}
ORDER {
  string id PK
  string customer_id FK
}
ACCOUNT {
  string id PK
  string status
}`, '/__blueprint-er-cardinality-glyphs__.mmd')
    })

    await expect.poll(async () => (await snapshot(page)).currentLayout).toBe('blueprint')
    const edges = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedEdgeMetrics() as RenderedEdgeMetrics[])
    const places = edges.find((edge) => edge.id === 'er:CUSTOMER:ORDER:places:ONLY_ONE:ZERO_OR_MORE:IDENTIFYING')
    const billed = edges.find((edge) => edge.id === 'er:ORDER:ACCOUNT:billed_to:ZERO_OR_MORE:ONLY_ONE:IDENTIFYING')

    expect(places).toBeDefined()
    expect(billed).toBeDefined()
    expect(places!.erSourceCardinality).toBe('ONLY_ONE')
    expect(places!.erTargetCardinality).toBe('ZERO_OR_MORE')
    expect(billed!.erSourceCardinality).toBe('ZERO_OR_MORE')
    expect(billed!.erTargetCardinality).toBe('ONLY_ONE')
    expect(places!.labelVisible).toBe(true)
    expect(places!.arrowTip).toBeNull()
    expect(billed!.arrowTip).toBeNull()
    expect(pageErrors).toEqual([])
  })

  test('preserves authored Mermaid linkStyle colors in Blueprint wires', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      window.__MERMAID_DEV__!.setLayout('blueprint')
      return await window.__MERMAID_DEV__!.loadSource(`flowchart LR
A["Source"] --> B["Model"]
B -.-> C["Annotation"]
linkStyle 0 stroke:#00ffcc,stroke-width:4px;
linkStyle 1 stroke:#d9a521,stroke-width:2px,stroke-dasharray:3 2;`, '/__blueprint-linkstyle-colors__.mmd')
    })

    await expect.poll(async () => (await snapshot(page)).currentLayout).toBe('blueprint')
    const edges = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedEdgeMetrics() as RenderedEdgeMetrics[])
    const primary = edges.find((edge) => edge.source === 'A' && edge.target === 'B')
    const note = edges.find((edge) => edge.source === 'B' && edge.target === 'C')

    expect(primary).toBeDefined()
    expect(note).toBeDefined()
    expect(primary!.strokeColor).toBe(0x00ffcc)
    expect(note!.strokeColor).toBe(0xd9a521)
    expect(primary!.bounds.width + primary!.bounds.height).toBeGreaterThan(20)
    expect(note!.bounds.width + note!.bounds.height).toBeGreaterThan(20)
    expect(pageErrors).toEqual([])
  })

  test('applies distinct subgraph depth fills for every shipped philosophy', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const philosophies = ['narrative', 'map', 'blueprint', 'breath', 'radial', 'mosaic']

    for (const philosophy of philosophies) {
      const probe = await page.evaluate((next) => {
        return window.__MERMAID_DEV__!.runSubgraphDepthProbe(next) as RenderedSubgraphMetrics[]
      }, philosophy)
      expect(probe.map((entry) => entry.depth)).toEqual([0, 1, 2])
      expect(new Set(probe.map((entry) => entry.fillColor)).size, `${philosophy} should tint subgraph depths distinctly`).toBeGreaterThanOrEqual(3)
    }

    await page.evaluate(() => {
      return window.__MERMAID_DEV__!.loadSource(`graph TD
        Root[Entry]
        subgraph Outer
          O1[Outer Step]
          subgraph Middle
            M1[Middle Step]
            subgraph Inner
              I1[Inner Start]
              I2[Inner End]
            end
          end
          O2[Outer Exit]
        end
        Root --> O1 --> M1 --> I1 --> I2 --> O2
      `, '/__subgraph-depth-visual__.mmd')
    })
    await expect.poll(async () => (await snapshot(page)).subgraphCount).toBeGreaterThanOrEqual(3)

    await page.evaluate(() => window.__MERMAID_DEV__!.setLayout('map'))
    await expect.poll(async () => (await snapshot(page)).currentLayout).toBe('map')
    await expect(page.locator('#canvas')).toHaveScreenshot('subgraph-depth-map.png')

    expect(pageErrors).toEqual([])
  })

  test('keeps subgraph containers around child content with visible padding', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const nestedLoaded = await page.evaluate(() => {
      return window.__MERMAID_DEV__!.loadSource(`graph TD
        Root[Entry]
        subgraph Outer
          O1[Outer Step]
          subgraph Middle
            M1[Middle Step]
            subgraph Inner
              I1[Inner Start]
              I2[Inner End]
            end
          end
          O2[Outer Exit]
        end
        Root --> O1 --> M1 --> I1 --> I2 --> O2
      `, '/__subgraph-containment__.mmd')
    })
    expect(nestedLoaded).toBe(true)
    await expect.poll(async () => (await snapshot(page)).subgraphCount).toBeGreaterThanOrEqual(3)

    const { nodes, subgraphs } = await page.evaluate(() => ({
      nodes: window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[],
      subgraphs: window.__MERMAID_DEV__!.getRenderedSubgraphMetrics() as RenderedSubgraphMetrics[],
    }))

    expect(subgraphs.length).toBeGreaterThanOrEqual(3)

    for (const subgraph of subgraphs) {
      const memberNodes = nodes.filter((node) => subgraph.nodeIds.includes(node.id))
      expect(memberNodes.length, `${subgraph.id} should expose its member nodes`).toBeGreaterThan(0)
      for (const node of memberNodes) {
        expect(
          rectContainsRect(subgraph.bounds, node.shapeBounds, 1.5),
          `${subgraph.id} should contain node ${node.id}`,
        ).toBe(true)
        expect(
          minRectInset(subgraph.bounds, node.shapeBounds),
          `${subgraph.id} should keep visible padding around node ${node.id}`,
        ).toBeGreaterThanOrEqual(6)
        expect(
          node.shapeBounds.y - subgraph.bounds.y,
          `${subgraph.id} should keep node ${node.id} below the readable group header`,
        ).toBeGreaterThanOrEqual(32)
      }
    }

    const immediateParents = subgraphs
      .map((child) => {
        const candidates = subgraphs
          .filter((parent) => parent.id !== child.id && rectContainsRect(parent.bounds, child.bounds, 1.5))
          .map((parent) => ({
            parentId: parent.id,
            childId: child.id,
            inset: minRectInset(parent.bounds, child.bounds),
            area: parent.bounds.width * parent.bounds.height,
          }))
          .sort((a, b) => a.area - b.area)
        return candidates[0] ?? null
      })
      .filter((pair): pair is NonNullable<typeof pair> => pair !== null)

    expect(immediateParents.length).toBeGreaterThanOrEqual(2)
    for (const pair of immediateParents) {
      expect(pair.inset, `${pair.parentId} should not clip nested subgraph ${pair.childId}`).toBeGreaterThanOrEqual(4)
    }

    const nestedCanvas = await page.locator('#canvas').screenshot()
    expect(nestedCanvas).toMatchSnapshot('nested-subgraph-containment.png')

    expect(pageErrors).toEqual([])
  })

  test('keeps long subgraph headers and count badges inside the container', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const loaded = await page.evaluate(async () => {
      window.__MERMAID_DEV__!.setLayout('blueprint')
      return await window.__MERMAID_DEV__!.loadSource(`flowchart TD
        subgraph CANON["Canonical source to gold transformation controls"]
          direction TB
          N01["Extract"]
          N02["Normalize"]
          N03["Validate"]
          N04["Version"]
          N05["Map"]
          N06["Enrich"]
          N07["Dedupe"]
          N08["Classify"]
          N09["Score"]
          N10["Review"]
          N11["Publish"]
          N12["Audit"]
        end
        N01 --> N02 --> N03 --> N04 --> N05 --> N06 --> N07 --> N08 --> N09 --> N10 --> N11 --> N12
      `, '/__subgraph-header-badge-fit__.mmd')
    })
    expect(loaded).toBe(true)
    await expect.poll(async () => (await snapshot(page)).currentLayout).toBe('blueprint')
    await expect.poll(async () => (await snapshot(page)).subgraphCount).toBeGreaterThanOrEqual(1)

    const subgraphs = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedSubgraphMetrics() as RenderedSubgraphMetrics[])
    const canon = subgraphs.find((subgraph) => subgraph.id === 'CANON')

    expect(canon).toBeDefined()
    expect(canon!.labelText).toBe('Canonical source to gold transformation controls')
    expect(canon!.badgeText).toBe('12')
    expect(canon!.badgeBounds).not.toBeNull()
    expect(canon!.badgeTextBounds).not.toBeNull()
    expect(rectContainsRect(canon!.bounds, canon!.labelBounds, 1.5)).toBe(true)
    expect(rectContainsRect(canon!.bounds, canon!.badgeBounds!, 1.5)).toBe(true)
    expect(rectContainsRect(canon!.badgeBounds!, canon!.badgeTextBounds!, 2)).toBe(true)
    expect(canon!.labelBounds.x + canon!.labelBounds.width).toBeLessThanOrEqual(canon!.badgeBounds!.x - 2)
    expect(pageErrors).toEqual([])
  })

  test('deselects on empty canvas click and clears selection across graph rebuilds', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(() => window.__MERMAID_DEV__!.selectNode('OrderSvc'))
    await expect.poll(async () => (await snapshot(page)).selectedNodeId).toBe('OrderSvc')

    const selectedMetrics = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
    const selectedNode = selectedMetrics.find((node) => node.id === 'OrderSvc')
    expect(selectedNode).toBeDefined()
    expect(selectedNode!.layerIndex).toBe(Math.max(...selectedMetrics.map((node) => node.layerIndex)))

    const emptyPoint = await findEmptyCanvasPoint(page)
    await page.mouse.click(emptyPoint.x, emptyPoint.y)
    await expect.poll(async () => (await snapshot(page)).selectedNodeId).toBeNull()

    await clickNode(page, 'OrderSvc')
    await expect.poll(async () => (await snapshot(page)).selectedNodeId).toBe('OrderSvc')

    await page.evaluate(() => window.__MERMAID_DEV__!.foldNode('core'))
    await expect.poll(async () => (await snapshot(page)).foldedSubgraphs).toContain('core')
    await expect.poll(async () => (await snapshot(page)).selectedNodeId).toBeNull()

    await page.evaluate(() => window.__MERMAID_DEV__!.setLayout('blueprint'))
    await expect.poll(async () => (await snapshot(page)).currentLayout).toBe('blueprint')
    await expect.poll(async () => (await snapshot(page)).selectedNodeId).toBeNull()

    const clearedSelectionCanvas = await page.locator('#canvas').screenshot()
    expect(clearedSelectionCanvas).toMatchSnapshot('selection-cleared-after-rebuild.png', {
      maxDiffPixelRatio: 0.015,
    })

    expect(pageErrors).toEqual([])
  })

  test('keeps hover and selection as distinct visual states that can coexist', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await clickNode(page, 'OrderSvc')
    await expect.poll(async () => (await snapshot(page)).selectedNodeId).toBe('OrderSvc')
    const emptyPoint = await findEmptyCanvasPoint(page)
    await page.mouse.move(emptyPoint.x, emptyPoint.y)
    await expect.poll(async () => {
      const nodes = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
      return nodes.find((node) => node.id === 'OrderSvc')?.hoverAlpha ?? 0
    }).toBe(0)

    const selectedOnly = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.find((node) => node.id === 'OrderSvc')!
    })
    expect(selectedOnly.selectionAlpha).toBeGreaterThan(0)
    expect(selectedOnly.hoverAlpha).toBe(0)
    const selectedOnlyBounds = await page.evaluate(() => window.__MERMAID_DEV__!.getNodeScreenBounds('OrderSvc'))
    expect(selectedOnlyBounds).not.toBeNull()
    const selectedOnlyShot = await page.screenshot({ clip: expandClip(selectedOnlyBounds!) })
    expect(selectedOnlyShot).toMatchSnapshot('selection-only-node-state.png', {
      maxDiffPixelRatio: 0.065,
    })

    await hoverNode(page, 'OrderSvc')
    const selectedAndHovered = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.find((node) => node.id === 'OrderSvc')!
    })
    expect(selectedAndHovered.selectionAlpha).toBeGreaterThan(0)
    expect(selectedAndHovered.hoverAlpha).toBeGreaterThan(0)
    const selectedHoveredBounds = await page.evaluate(() => window.__MERMAID_DEV__!.getNodeScreenBounds('OrderSvc'))
    expect(selectedHoveredBounds).not.toBeNull()
    const selectedHoveredShot = await page.screenshot({ clip: expandClip(selectedHoveredBounds!) })
    expect(selectedHoveredShot).toMatchSnapshot('selection-hover-coexistence.png')

    await hoverNode(page, 'Auth')
    const metrics = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
    const selectedNode = metrics.find((node) => node.id === 'OrderSvc')!
    const hoveredNode = metrics.find((node) => node.id === 'Auth')!
    expect(selectedNode.selectionAlpha).toBeGreaterThan(0)
    expect(selectedNode.hoverAlpha).toBe(0)
    expect(hoveredNode.selectionAlpha).toBe(0)
    expect(hoveredNode.hoverAlpha).toBeGreaterThan(0)

    expect(pageErrors).toEqual([])
  })

  test('keeps every shift-clicked node and edge visually selected', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      window.__MERMAID_DEV__!.setLayout('blueprint')
      await window.__MERMAID_DEV__!.loadSource(`flowchart LR
        Gateway[Gateway] --> OrderSvc[Order Service]
        OrderSvc --> PaymentSvc[Payment Service]
        NotifSvc[Notification Service] --> Email[Email]
      `, '/__multi-selection__.mmd')
    })
    await expect.poll(async () => (await snapshot(page)).currentLayout).toBe('blueprint')

    const gatewayOrderEdgeId = await page.evaluate(() => {
      const edges = window.__MERMAID_DEV__!.getRenderedEdgeMetrics() as RenderedEdgeMetrics[]
      return edges.find((edge) => edge.source === 'Gateway' && edge.target === 'OrderSvc')!.id
    })

    await page.evaluate(() => window.__MERMAID_DEV__!.selectNode('Gateway'))
    await expect.poll(async () => (await snapshot(page)).selectedNodeIds).toEqual(['Gateway'])
    await page.evaluate(() => window.__MERMAID_DEV__!.selectNode('OrderSvc', { additive: true }))
    await expect.poll(async () => (await snapshot(page)).selectedNodeIds.sort()).toEqual(['Gateway', 'OrderSvc'])
    await page.evaluate((edgeId) => window.__MERMAID_DEV__!.selectEdge(edgeId, { additive: true }), gatewayOrderEdgeId)

    const selectionState = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      const edges = window.__MERMAID_DEV__!.getRenderedEdgeMetrics() as RenderedEdgeMetrics[]
      return {
        snapshot: window.__MERMAID_DEV__!.snapshot(),
        gateway: nodes.find((node) => node.id === 'Gateway')!,
        orderSvc: nodes.find((node) => node.id === 'OrderSvc')!,
        unrelated: nodes.find((node) => node.id === 'Email')!,
        gatewayOrderEdge: edges.find((edge) => edge.source === 'Gateway' && edge.target === 'OrderSvc')!,
        unrelatedEdge: edges.find((edge) => edge.source === 'NotifSvc' && edge.target === 'Email')!,
      }
    })

    expect(selectionState.snapshot.selectedNodeIds.sort()).toEqual(['Gateway', 'OrderSvc'])
    expect(selectionState.snapshot.selectedEdgeIds).toContain(selectionState.gatewayOrderEdge.id)
    expect(selectionState.gateway.selectionAlpha).toBeGreaterThan(0)
    expect(selectionState.orderSvc.selectionAlpha).toBeGreaterThan(0)
    expect(selectionState.unrelated.selectionAlpha).toBe(0)
    expect(selectionState.gatewayOrderEdge.selected).toBe(true)
    expect(selectionState.gatewayOrderEdge.alpha).toBeGreaterThan(0.95)
    expect(selectionState.unrelatedEdge.selected).toBe(false)

    expect(pageErrors).toEqual([])
  })

  test('emphasizes connected neighbors and edges on hover and selection', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await hoverNode(page, 'OrderSvc')
    await expect.poll(async () => {
      const nodes = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
      return nodes.some((node) => node.id === 'OrderSvc' && node.hoverVisible)
    }).toBe(true)
    const hoverState = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      const edges = window.__MERMAID_DEV__!.getRenderedEdgeMetrics() as RenderedEdgeMetrics[]
      return {
        hovered: nodes.find((node) => node.id === 'OrderSvc')!,
        upstream: nodes.find((node) => node.id === 'Gateway')!,
        downstream: nodes.find((node) => node.id === 'PaymentSvc')!,
        unrelated: nodes.find((node) => node.id === 'Email')!,
        incomingEdge: edges.find((edge) => edge.source === 'Gateway' && edge.target === 'OrderSvc')!,
        outgoingEdge: edges.find((edge) => edge.source === 'OrderSvc' && edge.target === 'PaymentSvc')!,
        unrelatedEdge: edges.find((edge) => edge.source === 'NotifSvc' && edge.target === 'Email')!,
      }
    })

    expect(hoverState.hovered!.alpha).toBeGreaterThan(0.95)
    expect(hoverState.upstream!.alpha).toBeGreaterThan(0.95)
    expect(hoverState.downstream!.alpha).toBeGreaterThan(0.95)
    expect(hoverState.unrelated!.alpha).toBeLessThanOrEqual(0.24)
    expect(hoverState.incomingEdge!.alpha).toBeGreaterThan(0.95)
    expect(hoverState.outgoingEdge!.alpha).toBeGreaterThan(0.95)
    expect(hoverState.unrelatedEdge!.alpha).toBeLessThanOrEqual(0.24)
    const canvas = page.locator('#canvas')
    await expect(canvas).toHaveScreenshot('relationship-hover-emphasis.png')

    await clickNode(page, 'OrderSvc')
    await expect.poll(async () => (await snapshot(page)).selectedNodeId).toBe('OrderSvc')
    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.move(box!.x + 8, box!.y + 8)

    const selectionState = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      const edges = window.__MERMAID_DEV__!.getRenderedEdgeMetrics() as RenderedEdgeMetrics[]
      return {
        selected: nodes.find((node) => node.id === 'OrderSvc')!,
        upstream: nodes.find((node) => node.id === 'Gateway')!,
        downstream: nodes.find((node) => node.id === 'PaymentSvc')!,
        unrelated: nodes.find((node) => node.id === 'Email')!,
        incomingEdge: edges.find((edge) => edge.source === 'Gateway' && edge.target === 'OrderSvc')!,
        unrelatedEdge: edges.find((edge) => edge.source === 'NotifSvc' && edge.target === 'Email')!,
      }
    })

    expect(selectionState.selected.selectionAlpha).toBeGreaterThan(0)
    expect(selectionState.selected.alpha).toBeGreaterThan(0.95)
    expect(selectionState.upstream.alpha).toBeGreaterThan(0.95)
    expect(selectionState.downstream.alpha).toBeGreaterThan(0.95)
    expect(selectionState.unrelated.alpha).toBeLessThan(0.5)
    expect(selectionState.incomingEdge.alpha).toBeGreaterThan(0.95)
    expect(selectionState.unrelatedEdge.alpha).toBeLessThan(0.5)
    await expect(canvas).toHaveScreenshot('relationship-selection-emphasis.png')

    expect(pageErrors).toEqual([])
  })

  test('emphasizes edge endpoints when hovering the widened edge hit area', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(() => window.__MERMAID_DEV__!.setLayout('blueprint'))
    const loaded = await page.evaluate(async () => {
      return await window.__MERMAID_DEV__!.loadSource(`flowchart TD
  A[Source] --> B[Target]
  B --> C[Next]
  X[Unrelated] --> Y[Other]
`)
    })
    expect(loaded).toBe(true)
    await expect.poll(async () => (await snapshot(page)).currentLayout).toBe('blueprint')

    const edge = await page.evaluate(() => {
      const edges = window.__MERMAID_DEV__!.getRenderedEdgeMetrics() as RenderedEdgeMetrics[]
      return edges.find((candidate) => candidate.source === 'A' && candidate.target === 'B')!
    })
    expect(edge.hitBounds).not.toBeNull()
    expect(edge.hitPadding).toBeGreaterThanOrEqual(10)
    expect(edge.hitBounds!.width).toBeGreaterThanOrEqual(edge.bounds.width)
    expect(edge.hitBounds!.height).toBeGreaterThanOrEqual(edge.bounds.height)

    const canvasBox = await page.locator('#canvas').boundingBox()
    expect(canvasBox).not.toBeNull()
    const hoverPoint = {
      x: canvasBox!.x + edge.screenPoints[0].x + Math.min(10, edge.hitPadding - 2),
      y: canvasBox!.y + edge.screenPoints[0].y + (edge.screenPoints[1].y - edge.screenPoints[0].y) * 0.5,
    }
    await page.mouse.move(hoverPoint.x, hoverPoint.y)

    await expect.poll(async () => {
      const edges = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedEdgeMetrics() as RenderedEdgeMetrics[])
      return edges.find((candidate) => candidate.source === 'A' && candidate.target === 'B')?.hovered ?? false
    }).toBe(true)

    const hoverState = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      const edges = window.__MERMAID_DEV__!.getRenderedEdgeMetrics() as RenderedEdgeMetrics[]
      return {
        source: nodes.find((node) => node.id === 'A')!,
        target: nodes.find((node) => node.id === 'B')!,
        unrelated: nodes.find((node) => node.id === 'X')!,
        hoveredEdge: edges.find((edge) => edge.source === 'A' && edge.target === 'B')!,
        unrelatedEdge: edges.find((edge) => edge.source === 'X' && edge.target === 'Y')!,
      }
    })

    expect(hoverState.source.alpha).toBeGreaterThan(0.95)
    expect(hoverState.target.alpha).toBeGreaterThan(0.95)
    expect(hoverState.unrelated.alpha).toBeLessThanOrEqual(0.24)
    expect(hoverState.hoveredEdge.alpha).toBeGreaterThan(0.95)
    expect(hoverState.unrelatedEdge.alpha).toBeLessThanOrEqual(0.24)

    expect(pageErrors).toEqual([])
  })

  test('keeps hover and selection perceptible in the low-glow breath theme', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const loaded = await page.evaluate(async () => {
      return await window.__MERMAID_DEV__!.loadSource(`graph TD
  Gateway[API Gateway]
`)
    })
    expect(loaded).toBe(true)

    await page.evaluate(() => window.__MERMAID_DEV__!.setLayout('breath'))
    await expect.poll(async () => (await snapshot(page)).currentLayout).toBe('breath')
    await expect.poll(async () => (await snapshot(page)).viewportAlpha).toBe(1)
    await page.evaluate(() => window.__MERMAID_DEV__!.fitToView())

    await page.evaluate(() => window.__MERMAID_DEV__!.forceHoverNode('Gateway'))
    const hovered = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.find((node) => node.id === 'Gateway')!
    })
    expect(hovered.selectionAlpha).toBe(0)
    const hoverBounds = await page.evaluate(() => window.__MERMAID_DEV__!.getNodeScreenBounds('Gateway'))
    expect(hoverBounds).not.toBeNull()
    const hoverShot = await page.screenshot({ clip: centeredClip(hoverBounds!, 180, 120) })
    expect(hoverShot).toMatchSnapshot('breath-hover-perceptible.png', {
      maxDiffPixelRatio: 0.02,
    })

    await page.evaluate(() => window.__MERMAID_DEV__!.selectNode('Gateway'))
    await expect.poll(async () => (await snapshot(page)).selectedNodeId).toBe('Gateway')
    await page.evaluate(() => window.__MERMAID_DEV__!.forceHoverNode(null))
    await expect.poll(async () => {
      const nodes = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
      return nodes.find((node) => node.id === 'Gateway')?.hoverAlpha ?? 0
    }).toBe(0)

    const selected = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.find((node) => node.id === 'Gateway')!
    })
    expect(selected.selectionAlpha).toBeGreaterThan(0)
    const selectionBounds = await page.evaluate(() => window.__MERMAID_DEV__!.getNodeScreenBounds('Gateway'))
    expect(selectionBounds).not.toBeNull()
    const selectionShot = await page.screenshot({ clip: centeredClip(selectionBounds!, 180, 120) })
    expect(selectionShot).toMatchSnapshot('breath-selection-perceptible.png', {
      maxDiffPixelRatio: 0.02,
    })

    expect(pageErrors).toEqual([])
  })

  test('keeps dimmed context readable and distinct from hidden in light narrative mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(() => window.__MERMAID_DEV__!.setLayout('narrative'))
    await expect.poll(async () => (await snapshot(page)).currentLayout).toBe('narrative')
    await expect.poll(async () => (await snapshot(page)).viewportAlpha).toBe(1)

    await page.evaluate(async () => {
      await window.__MERMAID_DEV__!.loadFile('/examples/microservice/overview.mmd')
    })
    await expect.poll(async () => (await snapshot(page)).currentFile).toBe('/examples/microservice/overview.mmd')
    await expect.poll(async () => (await snapshot(page)).viewportAlpha).toBe(1)

    await page.evaluate(() => window.__MERMAID_DEV__!.selectNode('OrderSvc'))
    await expect.poll(async () => (await snapshot(page)).selectedNodeId).toBe('OrderSvc')

    const canvas = page.locator('#canvas')

    const dimmedState = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return {
        active: nodes.find((node) => node.id === 'OrderSvc')!,
        related: nodes.find((node) => node.id === 'Gateway')!,
        dimmed: nodes.find((node) => node.id === 'Email')!,
      }
    })

    expect(dimmedState.dimmed.alpha).toBeGreaterThanOrEqual(0.3)
    expect(dimmedState.dimmed.alpha).toBeLessThan(0.5)
    expect(dimmedState.active.alpha).toBeGreaterThan(dimmedState.dimmed.alpha)
    expect(dimmedState.related.alpha).toBeGreaterThan(dimmedState.dimmed.alpha)
    await expect(canvas).toHaveScreenshot('narrative-light-dimmed-context.png', {
      maxDiffPixelRatio: 0.015,
    })

    expect(pageErrors).toEqual([])
  })

  test('shows broken-link state and readable feedback for unresolved targets', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      await window.__MERMAID_DEV__!.loadFile('/examples/cross-file/broken-link.mmd')
    })

    await expect.poll(async () => (await snapshot(page)).brokenLinks).toContain('missing')
    await expect.poll(async () => (await snapshot(page)).statusLevel).toBe('warn')

    const activated = await page.evaluate(() => window.__MERMAID_DEV__!.clickLink('missing'))
    expect(activated).toBeFalsy()

    const state = await snapshot(page)
    expect(state.currentFile).toBe('/examples/cross-file/broken-link.mmd')
    expect(state.statusLevel).toBe('warn')
    expect(state.statusMessage).toContain('Linked Mermaid file not found')

    const brokenNode = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.find((node) => node.id === 'missing')!
    })
    expect(brokenNode.badgeKind).toBe('broken')

    await page.evaluate(async () => {
      await window.__MERMAID_DEV__!.loadFile('/examples/microservice/overview.mmd')
    })
    const validNode = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.find((node) => node.id === 'OrderSvc')!
    })
    expect(validNode.badgeKind).toBe('valid')

    await page.evaluate(async () => {
      await window.__MERMAID_DEV__!.loadFile('/examples/cross-file/broken-link.mmd')
    })
    await expect.poll(async () => (await snapshot(page)).currentFile).toBe('/examples/cross-file/broken-link.mmd')

    const nodeBounds = await page.evaluate(() => window.__MERMAID_DEV__!.getNodeScreenBounds('missing'))
    expect(nodeBounds).not.toBeNull()
    const clipped = await page.screenshot({ clip: expandClip(nodeBounds!) })
    expect(clipped).toMatchSnapshot('broken-link-node-badge.png')
    expect(pageErrors).toEqual([])
  })

  test('keeps broken-link state visually distinct while the same node is selected and hovered', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    await page.evaluate(async () => {
      await window.__MERMAID_DEV__!.loadFile('/examples/cross-file/broken-link.mmd')
    })

    await expect.poll(async () => (await snapshot(page)).brokenLinks).toContain('missing')
    await page.evaluate(() => window.__MERMAID_DEV__!.selectNode('missing'))
    await expect.poll(async () => (await snapshot(page)).selectedNodeId).toBe('missing')
    await hoverNode(page, 'missing')

    const brokenNode = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.find((node) => node.id === 'missing')!
    })

    expect(brokenNode.badgeKind).toBe('broken')
    expect(brokenNode.selectionAlpha).toBeGreaterThan(0)
    expect(brokenNode.hoverAlpha).toBeGreaterThan(0)

    const nodeBounds = await page.evaluate(() => window.__MERMAID_DEV__!.getNodeScreenBounds('missing'))
    expect(nodeBounds).not.toBeNull()
    const clipped = await page.screenshot({ clip: expandClip(nodeBounds!) })
    expect(clipped).toMatchSnapshot('broken-link-selected-hovered.png')
    expect(pageErrors).toEqual([])
  })

  test('shows broken-link state and readable feedback for missing target-node fragments', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const loaded = await page.evaluate(async () => {
      return await window.__MERMAID_DEV__!.loadSource(`%% @link bad -> /examples/cross-file/auth.mmd#missingNode
graph TD
  bad[Broken Fragment]
`)
    })

    expect(loaded).toBe(true)
    await expect.poll(async () => (await snapshot(page)).statusLevel).toBe('warn')

    const activated = await page.evaluate(() => window.__MERMAID_DEV__!.clickLink('bad'))
    expect(activated).toBeFalsy()

    const state = await snapshot(page)
    expect(state.statusLevel).toBe('warn')
    expect(state.statusMessage).toContain('Linked node "missingNode" was not found')

    const brokenNode = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.find((node) => node.id === 'bad')!
    })
    expect(brokenNode.badgeKind).toBe('broken')

    const nodeBounds = await page.evaluate(() => window.__MERMAID_DEV__!.getNodeScreenBounds('bad'))
    expect(nodeBounds).not.toBeNull()
    const clipped = await page.screenshot({ clip: expandClip(nodeBounds!) })
    expect(clipped).toMatchSnapshot('broken-link-missing-fragment.png')

    expect(pageErrors).toEqual([])
  })

  test('surfaces malformed @link syntax as a readable author warning in the browser harness', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const loaded = await page.evaluate(async () => {
      return await window.__MERMAID_DEV__!.loadSource(`%% @link bad missing-arrow /examples/other.mmd#target
graph TD
  bad[Broken Directive]
`)
    })

    expect(loaded).toBe(true)

    const state = await snapshot(page)
    const nodeMetrics = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])

    expect(state.statusLevel).toBe('warn')
    expect(state.statusMessage).toContain('Malformed @link directive ignored')
    expect(nodeMetrics.some((node) => node.id === 'bad')).toBe(true)
    expect(nodeMetrics.find((node) => node.id === 'bad')?.badgeKind).toBeNull()

    const canvas = page.locator('#canvas')
    await expect(canvas).toHaveScreenshot('malformed-link-warning-state.png')

    expect(pageErrors).toEqual([])
  })

  test('rejects out-of-scope link targets without raw fetch and surfaces the broken state', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const loaded = await page.evaluate(async () => {
      let fetchCount = 0
      const originalFetch = window.fetch.bind(window)
      ;(window as any).__fetchCount = 0
      window.fetch = (async (...args: Parameters<typeof fetch>) => {
        fetchCount += 1
        ;(window as any).__fetchCount = fetchCount
        return await originalFetch(...args)
      }) as typeof window.fetch

      try {
        return await window.__MERMAID_DEV__!.loadSource(`%% @link bad -> https://evil.example/secret#x
graph TD
  bad[Out Of Scope]
`)
      } finally {
        window.fetch = originalFetch
      }
    })

    expect(loaded).toBe(true)

    const state = await snapshot(page)
    const metrics = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
    const navigationResult = await page.evaluate(() => window.__MERMAID_DEV__!.clickLink('bad'))
    const fetchCount = await page.evaluate(() => (window as any).__fetchCount as number)
    const afterClick = await snapshot(page)

    const brokenNode = metrics.find((node) => node.id === 'bad')
    expect(brokenNode).toBeDefined()
    expect(brokenNode!.badgeKind).toBe('broken')
    expect(state.statusLevel).toBe('warn')
    expect(state.statusMessage).toContain('outside the configured resolver scope')
    expect(navigationResult).toBe(false)
    expect(afterClick.statusLevel).toBe('warn')
    expect(afterClick.statusMessage).toContain('outside the configured resolver scope')
    expect(fetchCount).toBe(0)

    const canvas = page.locator('#canvas')
    await expect(canvas).toHaveScreenshot('out-of-scope-link-warning-state.png')

    expect(pageErrors).toEqual([])
  })

  test('switches into stress mode for large graphs instead of only warning', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const success = await page.evaluate(async () => {
      return await window.__MERMAID_DEV__!.loadStressGraph(240)
    })

    expect(success).toBeTruthy()
    await expect.poll(async () => (await snapshot(page)).performanceMode).toBe('stress')

    const state = await snapshot(page)
    expect(state.nodeCount).toBeGreaterThan(200)
    expect(state.statusLevel).toBe('warn')
    expect(state.statusMessage).toContain('verified interactive floor')
    expect(pageErrors).toEqual([])
  })

  test('suppresses secondary edge and subgraph detail in stress mode', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const loaded = await page.evaluate(async () => {
      const lines: string[] = ['%% @layout narrative', 'graph TD', 'subgraph core[Core Systems]']
      for (let index = 0; index < 40; index++) {
        lines.push(`  C${index}[Core ${index}]`)
      }
      lines.push('end')
      for (let index = 40; index < 230; index++) {
        lines.push(`N${index}[Node ${index}]`)
      }
      for (let index = 0; index < 229; index++) {
        const source = index < 40 ? `C${index}` : `N${index}`
        const targetIndex = index + 1
        const target = targetIndex < 40 ? `C${targetIndex}` : `N${targetIndex}`
        if (index % 25 === 0) {
          lines.push(`${source} -->|Edge ${index}| ${target}`)
        } else {
          lines.push(`${source} --> ${target}`)
        }
      }
      return await window.__MERMAID_DEV__!.loadSource(lines.join('\n'))
    })

    expect(loaded).toBe(true)
    await expect.poll(async () => (await snapshot(page)).performanceMode).toBe('stress')

    const edges = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedEdgeMetrics() as RenderedEdgeMetrics[])
    const subgraphs = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedSubgraphMetrics() as RenderedSubgraphMetrics[])

    const labeledEdges = edges.filter((edge) => edge.labelBounds !== null)
    expect(labeledEdges.length).toBeGreaterThan(0)
    expect(labeledEdges.every((edge) => edge.labelVisible === false)).toBe(true)

    const core = subgraphs.find((subgraph) => subgraph.id === 'core')
    expect(core).toBeDefined()
    expect(core!.chevronVisible).toBe(false)
    expect(core!.badgeVisible).toBe(false)

    const stressCanvas = await page.locator('#canvas').screenshot()
    expect(stressCanvas).toMatchSnapshot('stress-mode-suppression.png')
    expect(pageErrors).toEqual([])
  })

  test('suppresses cross-file hover previews in stress mode', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const loaded = await page.evaluate(async () => {
      const lines: string[] = [
        '%% @layout narrative',
        '%% @link N0 -> /examples/cross-file/auth.mmd#loginFlow',
        'graph TD',
      ]

      for (let index = 0; index < 230; index++) {
        lines.push(`N${index}[Node ${index}]`)
      }
      for (let index = 0; index < 229; index++) {
        lines.push(`N${index} --> N${index + 1}`)
      }

      return await window.__MERMAID_DEV__!.loadSource(lines.join('\n'))
    })

    expect(loaded).toBe(true)
    await expect.poll(async () => (await snapshot(page)).performanceMode).toBe('stress')

    await hoverNode(page, 'N0')
    await page.waitForTimeout(700)

    const previewState = await page.evaluate(() => window.__MERMAID_DEV__!.getPreviewState() as PreviewState)
    expect(previewState.visible).toBe(false)
    expect(pageErrors).toEqual([])
  })

  test('skips relayout fade and motion work when switching layouts in stress mode', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const loaded = await page.evaluate(async () => {
      return await window.__MERMAID_DEV__!.loadStressGraph(240)
    })

    expect(loaded).toBe(true)
    await expect.poll(async () => (await snapshot(page)).performanceMode).toBe('stress')

    const before = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.slice(0, 8).map((node) => ({ id: node.id, x: node.center.x, y: node.center.y }))
    })

    await page.evaluate(() => {
      window.__MERMAID_DEV__!.setLayout('radial')
    })

    const immediateState = await snapshot(page)
    const immediate = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.slice(0, 8).map((node) => ({ id: node.id, x: node.center.x, y: node.center.y }))
    })

    await page.waitForTimeout(180)

    const laterState = await snapshot(page)
    const later = await page.evaluate(() => {
      const nodes = window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[]
      return nodes.slice(0, 8).map((node) => ({ id: node.id, x: node.center.x, y: node.center.y }))
    })

    expect(immediateState.performanceMode).toBe('stress')
    expect(immediateState.currentLayout).toBe('radial')
    expect(immediateState.viewportAlpha).toBe(1)
    expect(laterState.viewportAlpha).toBe(1)

    const movedOnSwitch = immediate.some((node) => {
      const prior = before.find((candidate) => candidate.id === node.id)
      if (!prior) return false
      return Math.hypot(node.x - prior.x, node.y - prior.y) > 10
    })
    expect(movedOnSwitch).toBe(true)

    const keptMovingAfterSwitch = later.some((node) => {
      const earlier = immediate.find((candidate) => candidate.id === node.id)
      if (!earlier) return false
      return Math.hypot(node.x - earlier.x, node.y - earlier.y) > 0.5
    })
    expect(keptMovingAfterSwitch).toBe(false)

    expect(pageErrors).toEqual([])
  })

  test('mounts through the documented embed API on a plain page', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await page.goto('/embed-harness.html')
    await page.waitForFunction(() => Boolean((window as any).__EMBED_HARNESS__))

    await expect.poll(async () => {
      const state = await page.evaluate(() => (window as any).__EMBED_HARNESS__.snapshot() as EmbedHarnessSnapshot)
      return state.ready
    }).toBeTruthy()

    const state = await page.evaluate(() => (window as any).__EMBED_HARNESS__.snapshot() as EmbedHarnessSnapshot)
    expect(state.nodeCount).toBeGreaterThan(0)
    expect(state.backend === 'WebGL' || state.backend === 'WebGPU').toBeTruthy()
    expect(state.status).toContain('Renderer ready')

    const canvas = page.locator('#embed-canvas')
    await expect(canvas).toBeVisible()

    await page.evaluate(async () => {
      await (window as any).__EMBED_HARNESS__.destroy()
    })

    const destroyed = await page.evaluate(() => (window as any).__EMBED_HARNESS__.snapshot() as EmbedHarnessSnapshot)
    expect(destroyed.destroyed).toBeTruthy()
    expect(destroyed.status).toContain('destroyed')
    expect(pageErrors).toEqual([])
  })

  test('supports multiple live renderers on one page', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await page.goto('/lifecycle-harness.html')
    await page.waitForFunction(() => Boolean((window as any).__LIFECYCLE_HARNESS__))

    const probe = await page.evaluate(async (): Promise<MultiInstanceProbe> => {
      return await (window as any).__LIFECYCLE_HARNESS__.runMultiInstanceProbe()
    })

    expect(probe.multiInstanceMounted).toBeTruthy()
    expect(probe.multiInstanceBackendCount).toBe(2)
    expect(probe.bothRenderersLoaded).toBeTruthy()
    expect(probe.firstRendererNodeCount).toBeGreaterThan(0)
    expect(probe.secondRendererNodeCount).toBeGreaterThan(0)
    expect(pageErrors).toEqual([])
  })

  test('guards lifecycle misuse with clear errors', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const probe = await page.evaluate(async (): Promise<LifecycleProbe> => {
      return await (window as any).__MERMAID_DEV__.runLifecycleProbe()
    })

    expect(probe.sameCanvasRemountSucceeded).toBe(true)
    expect(probe.secondMountOtherCanvasError).toContain('already mounted')
    expect(probe.foreignCanvasOwnershipError).toContain('already owned')
    expect(probe.loadAfterDestroyError).toContain('after destroy()')
    expect(probe.setPhilosophyAfterDestroyError).toContain('after destroy()')
    expect(probe.mountAfterDestroyError).toContain('destroyed')
    expect(pageErrors).toEqual([])
  })

  test('releases listeners, timers, and canvas ownership state on destroy', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await page.goto('/lifecycle-harness.html')
    await page.waitForFunction(() => Boolean((window as any).__LIFECYCLE_HARNESS__))

    const probe = await page.evaluate(async (): Promise<DestroyCleanupProbe> => {
      return await (window as any).__LIFECYCLE_HARNESS__.runDestroyCleanupProbe()
    })

    expect(probe.keyHandlerReleased).toBeTruthy()
    expect(probe.visibilityHandlerReleased).toBeTruthy()
    expect(probe.pointerActivityHandlerReleased).toBeTruthy()
    expect(probe.contextLostHandlerReleased).toBeTruthy()
    expect(probe.contextRestoredHandlerReleased).toBeTruthy()
    expect(probe.colorSchemeListenerReleased).toBeTruthy()
    expect(probe.resizeObserverReleased).toBeTruthy()
    expect(probe.resizeRafCleared).toBeTruthy()
    expect(probe.previewTimerCancelled).toBeTruthy()
    expect(probe.idleTimerCleared).toBeTruthy()
    expect(probe.linkPreviewReleased).toBeTruthy()
    expect(probe.appReleased).toBeTruthy()
    expect(probe.viewportReleased).toBeTruthy()
    expect(probe.canvasReleased).toBeTruthy()
    expect(probe.canvasOwnershipReleased).toBeTruthy()
    expect(pageErrors).toEqual([])
  })

  test('aborts an in-flight mount when destroy is called during initialization', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await page.goto('/lifecycle-harness.html')
    await page.waitForFunction(() => Boolean((window as any).__LIFECYCLE_HARNESS__))

    const probe = await page.evaluate(async (): Promise<DestroyDuringMountProbe> => {
      return await (window as any).__LIFECYCLE_HARNESS__.runDestroyDuringMountProbe()
    })

    expect(probe.mountErrorMessage).toBeNull()
    expect(probe.appReleased).toBeTruthy()
    expect(probe.keyHandlerReleased).toBeTruthy()
    expect(probe.resizeObserverReleased).toBeTruthy()
    expect(probe.canvasOwnershipReleased).toBeTruthy()
    expect(probe.keydownListenersReleased).toBeTruthy()
    expect(probe.fitCallsAfterKeydown).toBe(0)
    expect(probe.remountSucceeded).toBeTruthy()
    expect(probe.remountNodeCount).toBeGreaterThan(0)
    expect(pageErrors).toEqual([])
  })

  test('scopes keyboard shortcuts to the canvas and ignores editable embed hosts', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await page.goto('/lifecycle-harness.html')
    await page.waitForFunction(() => Boolean((window as any).__LIFECYCLE_HARNESS__))

    await page.evaluate(async () => {
      await (window as any).__LIFECYCLE_HARNESS__.setupKeyboardScopeProbe()
    })

    const readCounts = async (): Promise<KeyboardScopeProbeCounts> => {
      return await page.evaluate(() => {
        return (window as any).__LIFECYCLE_HARNESS__.getKeyboardScopeCounts() as KeyboardScopeProbeCounts
      })
    }

    try {
      // Typing inside a contenteditable rich-text host must not drive the diagram.
      await page.click('#keyboard-probe-editor')
      await page.keyboard.press('f')
      await page.keyboard.press('r')
      let counts = await readCounts()
      expect(counts.fitCalls).toBe(0)
      expect(counts.resetCalls).toBe(0)
      expect(counts.editorText).toContain('fr')

      // Keydown elsewhere on the page (body focused) stays with the embedding page.
      await page.evaluate(() => {
        ;(document.activeElement as HTMLElement | null)?.blur()
      })
      await page.keyboard.press('f')
      counts = await readCounts()
      expect(counts.fitCalls).toBe(0)

      // The focused canvas still receives fit and reset shortcuts.
      const canvasFocused = await page.evaluate(() => {
        return (window as any).__LIFECYCLE_HARNESS__.focusKeyboardScopeCanvas() as boolean
      })
      expect(canvasFocused).toBeTruthy()
      await page.keyboard.press('f')
      await page.keyboard.press('r')
      counts = await readCounts()
      expect(counts.fitCalls).toBe(1)
      expect(counts.resetCalls).toBe(1)
    } finally {
      await page.evaluate(() => {
        ;(window as any).__LIFECYCLE_HARNESS__.teardownKeyboardScopeProbe()
      })
    }

    expect(pageErrors).toEqual([])
  })

  test('recovers after synthetic WebGL context loss', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await page.goto('/lifecycle-harness.html')
    await page.waitForFunction(() => Boolean((window as any).__LIFECYCLE_HARNESS__))

    const probe = await page.evaluate(async (): Promise<ContextRecoveryProbe> => {
      return await (window as any).__LIFECYCLE_HARNESS__.runContextRecovery()
    })

    expect(probe.initialNodeCount).toBeGreaterThan(0)
    expect(probe.contextLossPrevented).toBeTruthy()
    expect(probe.contextRestoredDispatched).toBeTruthy()
    expect(probe.recoveredNodeCount).toBeGreaterThan(0)
    expect(pageErrors).toEqual([])
  })

  test('renders visibly after synthetic WebGL context loss recovery', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await page.goto('/lifecycle-harness.html')
    await page.waitForFunction(() => Boolean((window as any).__LIFECYCLE_HARNESS__))

    const probe = await page.evaluate(async (): Promise<ContextRecoveryVisualProbe> => {
      return await (window as any).__LIFECYCLE_HARNESS__.runContextRecoveryVisualProbe()
    })

    expect(probe.initialNodeCount).toBeGreaterThan(0)
    expect(probe.contextLossPrevented).toBeTruthy()
    expect(probe.contextRestoredDispatched).toBeTruthy()
    expect(probe.recoveredNodeCount).toBeGreaterThan(0)
    expect(probe.screenshotBase64.length).toBeGreaterThan(0)
    expect(Buffer.from(probe.screenshotBase64, 'base64')).toMatchSnapshot('webgl-context-recovery-restored.png')

    expect(pageErrors).toEqual([])
  })

  test('falls back to WebGL when the WebGPU API exists but no adapter is available', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await page.goto('/lifecycle-harness.html')
    await page.waitForFunction(() => Boolean((window as any).__LIFECYCLE_HARNESS__))

    const probe = await page.evaluate(async (): Promise<AdapterFallbackProbe> => {
      return await (window as any).__LIFECYCLE_HARNESS__.runAdapterFallbackProbe()
    })

    expect(probe.mountSucceeded).toBe(true)
    expect(probe.requestAdapterCalls).toBeGreaterThan(0)
    expect(probe.backend).toBe('WebGL')
    expect(probe.nodeCount).toBeGreaterThan(0)
    expect(pageErrors).toEqual([])
  })

  test('renders visibly through WebGL when the WebGPU API exists but no adapter is available', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await page.goto('/lifecycle-harness.html')
    await page.waitForFunction(() => Boolean((window as any).__LIFECYCLE_HARNESS__))

    const probe = await page.evaluate(async (): Promise<{ mountSucceeded: boolean, backend: string | null, nodeCount: number, requestAdapterCalls: number, canvasId: string }> => {
      return await (window as any).__LIFECYCLE_HARNESS__.runAdapterFallbackVisualProbe()
    })

    expect(probe.mountSucceeded).toBe(true)
    expect(probe.requestAdapterCalls).toBeGreaterThan(0)
    expect(probe.backend).toBe('WebGL')
    expect(probe.nodeCount).toBeGreaterThan(0)

    const canvas = page.locator(`#${probe.canvasId}`)
    await expect(canvas).toHaveScreenshot('webgpu-no-adapter-webgl-fallback.png')

    await page.evaluate(() => {
      ;(window as any).__LIFECYCLE_HARNESS__.cleanupAdapterFallbackVisualProbe()
    })

    expect(pageErrors).toEqual([])
  })

  test('pauses and resumes the ticker on visibility changes', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await page.goto('/lifecycle-harness.html')
    await page.waitForFunction(() => Boolean((window as any).__LIFECYCLE_HARNESS__))

    const probe = await page.evaluate(async (): Promise<VisibilityPauseProbe> => {
      return await (window as any).__LIFECYCLE_HARNESS__.runVisibilityPauseProbe()
    })

    expect(probe.initiallyRunning).toBeTruthy()
    expect(probe.hiddenRunning).toBeFalsy()
    expect(probe.restoredRunning).toBeTruthy()
    expect(pageErrors).toEqual([])
  })

  test('pauses active relayout motion while hidden and resumes it when visible again', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await page.goto('/lifecycle-harness.html')
    await page.waitForFunction(() => Boolean((window as any).__LIFECYCLE_HARNESS__))

    const probe = await page.evaluate(async (): Promise<RelayoutVisibilityPauseProbe> => {
      return await (window as any).__LIFECYCLE_HARNESS__.runRelayoutVisibilityPauseProbe()
    })

    expect(probe.nodeMovedBeforeHide).toBe(true)
    expect(probe.stayedStillWhileHidden).toBe(true)
    expect(probe.resumedAfterVisible).toBe(true)
    expect(pageErrors).toEqual([])
  })

  test('stops the ticker after idle and restarts on pointer activity', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await page.goto('/lifecycle-harness.html')
    await page.waitForFunction(() => Boolean((window as any).__LIFECYCLE_HARNESS__))

    const probe = await page.evaluate(async (): Promise<IdlePauseProbe> => {
      return await (window as any).__LIFECYCLE_HARNESS__.runIdlePauseProbe()
    })

    expect(probe.runningImmediatelyAfterLoad).toBeTruthy()
    expect(probe.stoppedAfterIdle).toBeTruthy()
    expect(probe.runningAfterPointerMove).toBeTruthy()
    expect(probe.stoppedAgainAfterIdle).toBeTruthy()
    expect(pageErrors).toEqual([])
  })

  test('shows a readable fallback state when renderer initialization fails', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const probe = await page.evaluate(async (): Promise<MountFailureProbe> => {
      return await window.__MERMAID_DEV__!.runMountFailureProbe()
    })

    expect(probe.mountError).toContain('Rendering unavailable')
    expect(probe.mountError).toContain('Simulated renderer init failure')
    expect(probe.sampledAlphaSum).toBeGreaterThan(0)

    const canvas = page.locator('#canvas')
    await expect(canvas).toHaveScreenshot('renderer-init-failure-fallback.png')

    expect(pageErrors).toEqual([])
  })

  test('shows a readable fallback state when no usable GPU backend is available', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const probe = await page.evaluate(async (): Promise<BackendUnavailableProbe> => {
      return await window.__MERMAID_DEV__!.runBackendUnavailableProbe()
    })

    expect(probe.mountError).toContain('Rendering unavailable')
    expect(probe.mountError).toContain('No supported GPU backend')
    expect(probe.sampledAlphaSum).toBeGreaterThan(0)

    const canvas = page.locator('#canvas')
    await expect(canvas).toHaveScreenshot('no-gpu-backend-fallback.png')

    expect(pageErrors).toEqual([])
  })

  test('shows a readable canvas and UI error state for invalid Mermaid input', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const success = await page.evaluate(async () => {
      return await window.__MERMAID_DEV__!.loadFile('/examples/errors/invalid-syntax.mmd')
    })

    expect(success).toBeFalsy()
    await expect.poll(async () => (await snapshot(page)).statusLevel).toBe('error')

    const overlay = await page.evaluate(() => window.__MERMAID_DEV__!.getOverlayState() as OverlayState)
    expect(overlay.visible).toBeTruthy()
    expect(overlay.text).toContain('Diagram failed to load')

    const state = await snapshot(page)
    expect(state.statusMessage.length).toBeGreaterThan(0)

    const canvas = page.locator('#canvas')
    await expect(canvas).toHaveScreenshot('invalid-mermaid-error-state.png')

    expect(pageErrors).toEqual([])
  })

  test('shows a readable canvas and UI error state for unsupported Mermaid diagram families', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    // `pie` has no adapter; sequenceDiagram/stateDiagram/etc. are supported now,
    // so this probe has to use a family the graph builder still rejects.
    const success = await page.evaluate(async () => {
      return await window.__MERMAID_DEV__!.loadSource(`pie title Pets
        "Dogs" : 386
        "Cats" : 85
      `, '/__unsupported-pie-diagram__.mmd')
    })

    expect(success).toBeFalsy()
    await expect.poll(async () => (await snapshot(page)).statusLevel).toBe('error')

    const overlay = await page.evaluate(() => window.__MERMAID_DEV__!.getOverlayState() as OverlayState)
    expect(overlay.visible).toBeTruthy()
    expect(overlay.text).toContain('Unsupported Mermaid diagram type')
    expect(overlay.text).toContain('flowchart, erDiagram, classDiagram, stateDiagram')

    const state = await snapshot(page)
    expect(state.statusMessage).toContain('Unsupported Mermaid diagram type')

    const canvas = page.locator('#canvas')
    await expect(canvas).toHaveScreenshot('unsupported-diagram-type-error-state.png')

    expect(pageErrors).toEqual([])
  })

  test('handles degenerate graphs without crashes or NaN render state', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await waitForDevApi(page)

    const emptyLoaded = await page.evaluate(() => {
      return window.__MERMAID_DEV__!.loadSource('graph TD', '/__degenerate-empty__.mmd')
    })
    expect(emptyLoaded).toBe(true)
    const emptyState = await snapshot(page)
    expect(emptyState.nodeCount).toBe(0)
    expect(emptyState.edgeCount).toBe(0)
    expect(emptyState.statusLevel).not.toBe('error')
    expect(finiteBounds(emptyState.renderedBounds)).toBe(true)

    const singleLoaded = await page.evaluate(() => {
      return window.__MERMAID_DEV__!.loadSource('graph TD\n  Solo[Only node]', '/__degenerate-single__.mmd')
    })
    expect(singleLoaded).toBe(true)
    const singleState = await snapshot(page)
    expect(singleState.nodeCount).toBe(1)
    expect(singleState.edgeCount).toBe(0)
    expect(singleState.statusLevel).not.toBe('error')
    expect(finiteBounds(singleState.renderedBounds)).toBe(true)

    const nestedLoaded = await page.evaluate(() => {
      return window.__MERMAID_DEV__!.loadSource(`graph TD
        subgraph Outer
          subgraph Middle
            subgraph Inner
              A[Leaf]
            end
          end
        end
      `, '/__degenerate-nested__.mmd')
    })
    expect(nestedLoaded).toBe(true)
    const nestedState = await snapshot(page)
    expect(nestedState.nodeCount).toBeGreaterThan(0)
    expect(nestedState.subgraphCount).toBeGreaterThanOrEqual(1)
    expect(nestedState.statusLevel).not.toBe('error')
    expect(finiteBounds(nestedState.renderedBounds)).toBe(true)

    const labelLoaded = await page.evaluate(() => {
      return window.__MERMAID_DEV__!.loadSource(`graph TD
        Long[SupercalifragilisticexpialidociousSupercalifragilisticexpialidocious]
        Emoji[Launch 🚀✨ Data ✅]
        Long --> Emoji
      `, '/__degenerate-labels__.mmd')
    })
    expect(labelLoaded).toBe(true)
    const labelState = await snapshot(page)
    expect(labelState.nodeCount).toBe(2)
    expect(labelState.edgeCount).toBe(1)
    expect(labelState.statusLevel).not.toBe('error')
    expect(finiteBounds(labelState.renderedBounds)).toBe(true)
    const labelMetrics = await page.evaluate(() => window.__MERMAID_DEV__!.getRenderedNodeMetrics() as RenderedNodeMetrics[])
    const longNode = labelMetrics.find((node) => node.id === 'Long')!
    const emojiNode = labelMetrics.find((node) => node.id === 'Emoji')!
    expect(longNode.labelBounds.width).toBeGreaterThan(0)
    expect(emojiNode.labelBounds.width).toBeGreaterThan(0)
    expect(overlaps(longNode.labelBounds, emojiNode.labelBounds)).toBe(false)

    const degenerateCanvas = await page.locator('#canvas').screenshot()
    expect(degenerateCanvas).toMatchSnapshot('degenerate-inline-labels.png')

    expect(pageErrors).toEqual([])
  })

  test('recovers from WebGPU device loss when available, or reports adapter constraints without hanging', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await page.goto('/lifecycle-harness.html')
    await page.waitForFunction(() => Boolean((window as any).__LIFECYCLE_HARNESS__))

    await page.evaluate(() => {
      ;(window as any).__LIFECYCLE_HARNESS__.startWebGpuRecoveryProbe()
    })

    await expect.poll(async () => {
      const probe = await page.evaluate(() => (window as any).__LIFECYCLE_HARNESS__.getWebGpuRecoveryProbe())
      return probe?.done ?? false
    }, { timeout: 15000 }).toBeTruthy()

    const probe = await page.evaluate(() => (window as any).__LIFECYCLE_HARNESS__.getWebGpuRecoveryProbe() as WebGpuRecoveryHarnessProbe | null)

    expect(probe).not.toBeNull()
    expect(probe!.initialBackend === 'WebGL' || probe!.initialBackend === 'WebGPU').toBeTruthy()
    expect(probe!.initialNodeCount).toBeGreaterThan(0)
    if (probe!.initialBackend === 'WebGPU') {
      expect(probe!.error).toBeNull()
      expect(probe!.warningMessages.some((message) => message.includes('WebGPU device lost'))).toBeTruthy()
      expect(probe!.recoveredBackend === 'WebGL' || probe!.recoveredBackend === 'WebGPU').toBeTruthy()
      expect(probe!.recoveredNodeCount).toBeGreaterThan(0)
      await expect(page.locator('body')).toHaveScreenshot('webgpu-device-loss-recovery-harness.png')
    } else {
      expect(probe!.error).toContain('WebGPU adapter unavailable')
      await expect(page.locator('body')).toHaveScreenshot('webgpu-device-loss-adapter-unavailable-harness.png')
    }
    expect(pageErrors).toEqual([])
  })

  test('records representative and stress performance metrics in-browser', async ({ page }) => {
    const pageErrors = await attachPageErrorTracking(page)
    await page.goto('/perf-harness.html')
    await page.waitForFunction(() => Boolean((window as any).__PERF_HARNESS__))

    const metrics = await page.evaluate(async (): Promise<PerfHarnessResult> => {
      return await (window as any).__PERF_HARNESS__.run()
    })

    console.log('Representative perf', metrics.representative)
    console.log('Stress perf', metrics.stress)

    expect(metrics.representative.nodeCount).toBeGreaterThan(4)
    expect(metrics.stress.nodeCount).toBeGreaterThan(200)
    expect(metrics.representative.loadMs).toBeLessThan(4000)
    expect(metrics.stress.loadMs).toBeLessThan(10000)
    expect(metrics.representative.approxFps).toBeGreaterThan(45)
    expect(metrics.stress.approxFps).toBeGreaterThan(30)
    expect(pageErrors).toEqual([])
  })
})
