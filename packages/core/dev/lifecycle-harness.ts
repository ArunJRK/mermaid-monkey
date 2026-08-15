import { MermaidRenderer } from '../src/index'

type LifecycleHarnessResult = {
  multiInstanceMounted: boolean
  multiInstanceBackendCount: number
  bothRenderersLoaded: boolean
  firstRendererNodeCount: number
  secondRendererNodeCount: number
}

type LifecycleMisuseResult = {
  secondMountOtherCanvasError: string | null
  foreignCanvasOwnershipError: string | null
  loadAfterDestroyError: string | null
  setPhilosophyAfterDestroyError: string | null
  mountAfterDestroyError: string | null
}

type DestroyCleanupResult = {
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

type DestroyDuringMountResult = {
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

type KeyboardScopeCounts = {
  fitCalls: number
  resetCalls: number
  editorText: string
  activeElementId: string
}

type ContextRecoveryResult = {
  initialNodeCount: number
  recoveredNodeCount: number
  contextLossPrevented: boolean
  contextRestoredDispatched: boolean
}

type ContextRecoveryVisualResult = ContextRecoveryResult & {
  canvasId: string
  screenshotBase64: string
}

type VisibilityPauseResult = {
  initiallyRunning: boolean
  hiddenRunning: boolean
  restoredRunning: boolean
}

type RelayoutVisibilityPauseResult = {
  nodeMovedBeforeHide: boolean
  stayedStillWhileHidden: boolean
  resumedAfterVisible: boolean
}

type IdlePauseResult = {
  runningImmediatelyAfterLoad: boolean
  stoppedAfterIdle: boolean
  runningAfterPointerMove: boolean
  stoppedAgainAfterIdle: boolean
}

type AdapterFallbackResult = {
  mountSucceeded: boolean
  backend: string | null
  nodeCount: number
  requestAdapterCalls: number
}

type AdapterFallbackVisualResult = AdapterFallbackResult & {
  canvasId: string
}

type WebGpuRecoveryResult = {
  done: boolean
  error: string | null
  initialBackend: string | null
  recoveredBackend: string | null
  initialNodeCount: number
  recoveredNodeCount: number
  warningMessages: string[]
  steps: string[]
}

declare global {
  interface Window {
    __LIFECYCLE_HARNESS__?: {
      runMultiInstanceProbe(): Promise<LifecycleHarnessResult>
      runLifecycleMisuseProbe(): Promise<LifecycleMisuseResult>
      runDestroyCleanupProbe(): Promise<DestroyCleanupResult>
      runDestroyDuringMountProbe(): Promise<DestroyDuringMountResult>
      setupKeyboardScopeProbe(): Promise<void>
      getKeyboardScopeCounts(): KeyboardScopeCounts
      focusKeyboardScopeCanvas(): boolean
      teardownKeyboardScopeProbe(): void
      runContextRecovery(): Promise<ContextRecoveryResult>
      runContextRecoveryVisualProbe(): Promise<ContextRecoveryVisualResult>
      runVisibilityPauseProbe(): Promise<VisibilityPauseResult>
      runRelayoutVisibilityPauseProbe(): Promise<RelayoutVisibilityPauseResult>
      runIdlePauseProbe(): Promise<IdlePauseResult>
      runAdapterFallbackProbe(): Promise<AdapterFallbackResult>
      runAdapterFallbackVisualProbe(): Promise<AdapterFallbackVisualResult>
      cleanupAdapterFallbackVisualProbe(): void
      startWebGpuRecoveryProbe(): void
      getWebGpuRecoveryProbe(): WebGpuRecoveryResult | null
    }
  }
}

const statusEl = document.getElementById('status') as HTMLPreElement
let webGpuRecoveryProbe: WebGpuRecoveryResult | null = null
let adapterFallbackVisualRenderer: MermaidRenderer | null = null
let adapterFallbackVisualGpuDescriptor: PropertyDescriptor | null = null
let keyboardScopeState: {
  renderer: MermaidRenderer
  editor: HTMLDivElement
  counts: { fit: number; reset: number }
  gpuDescriptor: PropertyDescriptor | null
} | null = null

function setStatus(message: string) {
  statusEl.textContent = message
}

function trackKeydownListeners(target: EventTarget) {
  const targetAny = target as unknown as Record<string, unknown>
  const originalAdd = targetAny.addEventListener as (...args: unknown[]) => unknown
  const originalRemove = targetAny.removeEventListener as (...args: unknown[]) => unknown
  // Track listener identity rather than raw add/remove call counts: the DOM
  // treats removeEventListener for a never-registered listener as a no-op
  // (PixiJS issues one unconditionally during destroy), so only listeners
  // still registered at observation time count as leaks.
  const registered = new Set<unknown>()
  targetAny.addEventListener = function (type: string, listener: unknown, ...rest: unknown[]) {
    if (type === 'keydown' && listener) registered.add(listener)
    return originalAdd.call(target, type, listener, ...rest)
  }
  targetAny.removeEventListener = function (type: string, listener: unknown, ...rest: unknown[]) {
    if (type === 'keydown') registered.delete(listener)
    return originalRemove.call(target, type, listener, ...rest)
  }
  return {
    liveCount: () => registered.size,
    restore: () => {
      delete targetAny.addEventListener
      delete targetAny.removeEventListener
    },
  }
}

function teardownKeyboardScope(): void {
  if (!keyboardScopeState) return
  keyboardScopeState.renderer.destroy()
  keyboardScopeState.editor.remove()
  if (keyboardScopeState.gpuDescriptor) {
    Object.defineProperty(navigator, 'gpu', keyboardScopeState.gpuDescriptor)
  }
  keyboardScopeState = null
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timed out`)), 5000)
    }),
  ])
}

window.__LIFECYCLE_HARNESS__ = {
  async runMultiInstanceProbe(): Promise<LifecycleHarnessResult> {
    const originalGpuDescriptor = Object.getOwnPropertyDescriptor(navigator, 'gpu')
    try {
      Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        value: undefined,
      })
    } catch {
      // ignore if the browser does not let us override this property
    }

    const canvasA = document.getElementById('canvas-a') as HTMLCanvasElement
    const canvasB = document.getElementById('canvas-b') as HTMLCanvasElement
    const graph = {
      nodes: new Map([
        ['A', { id: 'A', label: 'Start', shape: 'rectangle', metadata: {} }],
        ['B', { id: 'B', label: 'Done', shape: 'rectangle', metadata: {} }],
      ]),
      edges: [{ id: 'A->B', source: 'A', target: 'B', style: 'solid' as const }],
      subgraphs: new Map(),
      directives: [],
      direction: 'TD',
      diagramType: 'flowchart' as const,
    }

    let multiInstanceMounted = false
    let multiInstanceBackendCount = 0
    let bothRenderersLoaded = false
    let firstRendererNodeCount = 0
    let secondRendererNodeCount = 0
    const first = new MermaidRenderer()
    const second = new MermaidRenderer()
    try {
      await withTimeout(first.mount(canvasA), 'first mount')
      await withTimeout(second.mount(canvasB), 'second mount')
      first.loadGraph(graph)
      second.loadGraph(graph)
      multiInstanceMounted = true
      multiInstanceBackendCount = [first, second]
        .filter((instance: any) => instance._app?.renderer?.type === 0x1 || instance._app?.renderer?.type === 0x2)
        .length
      firstRendererNodeCount = (first as any)._nodeSprites.size
      secondRendererNodeCount = (second as any)._nodeSprites.size
      bothRenderersLoaded = firstRendererNodeCount > 0 && secondRendererNodeCount > 0
    } finally {
      first.destroy()
      second.destroy()
    }

    const result = {
      multiInstanceMounted,
      multiInstanceBackendCount,
      bothRenderersLoaded,
      firstRendererNodeCount,
      secondRendererNodeCount,
    }

    setStatus(JSON.stringify(result, null, 2))
    if (originalGpuDescriptor) {
      Object.defineProperty(navigator, 'gpu', originalGpuDescriptor)
    }
    return result
  },
  async runLifecycleMisuseProbe(): Promise<LifecycleMisuseResult> {
    const canvasA = document.getElementById('canvas-a') as HTMLCanvasElement
    const canvasB = document.getElementById('canvas-b') as HTMLCanvasElement
    const source = `graph TD
      A[Start] --> B[Done]`

    let secondMountOtherCanvasError: string | null = null
    let foreignCanvasOwnershipError: string | null = null
    let loadAfterDestroyError: string | null = null
    let setPhilosophyAfterDestroyError: string | null = null
    let mountAfterDestroyError: string | null = null

    const primary = new MermaidRenderer()
    try {
      await withTimeout(primary.mount(canvasA), 'primary mount')
      await withTimeout(primary.mount(canvasB), 'primary remount')
    } catch (error) {
      secondMountOtherCanvasError = error instanceof Error ? error.message : String(error)
    }
    primary.destroy()

    const owner = new MermaidRenderer()
    const thief = new MermaidRenderer()
    try {
      await withTimeout(owner.mount(canvasB), 'owner mount')
      await withTimeout(thief.mount(canvasB), 'thief mount')
    } catch (error) {
      foreignCanvasOwnershipError = error instanceof Error ? error.message : String(error)
    } finally {
      owner.destroy()
      thief.destroy()
    }

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
      await primary.mount(canvasA)
    } catch (error) {
      mountAfterDestroyError = error instanceof Error ? error.message : String(error)
    }

    const result = {
      secondMountOtherCanvasError,
      foreignCanvasOwnershipError,
      loadAfterDestroyError,
      setPhilosophyAfterDestroyError,
      mountAfterDestroyError,
    }

    setStatus(JSON.stringify(result, null, 2))
    return result
  },
  async runDestroyCleanupProbe(): Promise<DestroyCleanupResult> {
    const originalGpuDescriptor = Object.getOwnPropertyDescriptor(navigator, 'gpu')
    try {
      Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        value: undefined,
      })
    } catch {
      // ignore if the browser does not let us override this property
    }

    const probeWrapper = document.createElement('div')
    probeWrapper.style.position = 'fixed'
    probeWrapper.style.left = '-9999px'
    probeWrapper.style.top = '0'
    probeWrapper.style.width = '320px'
    probeWrapper.style.height = '180px'
    const probeCanvas = document.createElement('canvas')
    probeCanvas.width = 320
    probeCanvas.height = 180
    probeCanvas.style.width = '320px'
    probeCanvas.style.height = '180px'
    probeWrapper.appendChild(probeCanvas)
    document.body.appendChild(probeWrapper)

    const source = `graph TD
      A[Start] --> B[Done]`

    let previewResolved = false
    let keyHandlerReleased = false
    let visibilityHandlerReleased = false
    let pointerActivityHandlerReleased = false
    let contextLostHandlerReleased = false
    let contextRestoredHandlerReleased = false
    let colorSchemeListenerReleased = false
    let resizeObserverReleased = false
    let resizeRafCleared = false
    let idleTimerCleared = false
    let linkPreviewReleased = false
    let appReleased = false
    let viewportReleased = false
    let canvasReleased = false
    let canvasOwnershipReleased = false
    const steps: string[] = []
    const mark = (step: string) => {
      steps.push(step)
      setStatus(JSON.stringify({ steps }, null, 2))
    }

    const renderer = new MermaidRenderer()
    try {
      mark('mount:primary:start')
      await withTimeout(renderer.mount(probeCanvas), 'cleanup mount')
      mark('mount:primary:done')
      mark('load:primary:start')
      await withTimeout(renderer.load(source), 'cleanup load')
      mark('load:primary:done')

      const preview = (renderer as any)._linkPreview
      mark('preview:schedule')
      preview.scheduleShow(
        () => ({ x: 32, y: 32 }),
        'linked-file.mmd',
        async () => {
          previewResolved = true
          return null
        },
      )

      mark('destroy:primary:start')
      renderer.destroy()
      mark('destroy:primary:done')
      mark('preview:wait:start')
      await new Promise(resolve => window.setTimeout(resolve, 350))
      mark('preview:wait:done')

      keyHandlerReleased = (renderer as any)._keyHandler === null
      visibilityHandlerReleased = (renderer as any)._visibilityHandler === null
      pointerActivityHandlerReleased = (renderer as any)._pointerActivityHandler === null
      contextLostHandlerReleased = (renderer as any)._webglContextLostHandler === null
      contextRestoredHandlerReleased = (renderer as any)._webglContextRestoredHandler === null
      colorSchemeListenerReleased = (renderer as any)._colorSchemeMediaQuery === null
        && (renderer as any)._colorSchemeChangeHandler === null
      resizeObserverReleased = (renderer as any)._resizeObserver === null
      resizeRafCleared = (renderer as any)._resizeRafId === null
      idleTimerCleared = (renderer as any)._idleTickerTimeoutId === null
      linkPreviewReleased = (renderer as any)._linkPreview === null
      appReleased = (renderer as any)._app === null
      viewportReleased = (renderer as any)._viewport === null
      canvasReleased = (renderer as any)._canvas === null
      canvasOwnershipReleased = !(MermaidRenderer as any)._liveCanvases.has(probeCanvas)

      mark('probe:complete')
    } catch (error) {
      setStatus(JSON.stringify({
        steps,
        error: error instanceof Error ? error.message : String(error),
      }, null, 2))
      throw error
    } finally {
      renderer.destroy()
      probeWrapper.remove()
      if (originalGpuDescriptor) {
        Object.defineProperty(navigator, 'gpu', originalGpuDescriptor)
      }
    }

    const result = {
      keyHandlerReleased,
      visibilityHandlerReleased,
      pointerActivityHandlerReleased,
      contextLostHandlerReleased,
      contextRestoredHandlerReleased,
      colorSchemeListenerReleased,
      resizeObserverReleased,
      resizeRafCleared,
      previewTimerCancelled: !previewResolved,
      idleTimerCleared,
      linkPreviewReleased,
      appReleased,
      viewportReleased,
      canvasReleased,
      canvasOwnershipReleased,
    }

    setStatus(JSON.stringify(result, null, 2))
    return result
  },
  async runDestroyDuringMountProbe(): Promise<DestroyDuringMountResult> {
    const originalGpuDescriptor = Object.getOwnPropertyDescriptor(navigator, 'gpu')
    try {
      Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        value: undefined,
      })
    } catch {
      // ignore if the browser does not let us override this property
    }

    const probeWrapper = document.createElement('div')
    probeWrapper.style.position = 'fixed'
    probeWrapper.style.left = '-9999px'
    probeWrapper.style.top = '0'
    probeWrapper.style.width = '320px'
    probeWrapper.style.height = '180px'
    const probeCanvas = document.createElement('canvas')
    probeCanvas.width = 320
    probeCanvas.height = 180
    probeCanvas.style.width = '320px'
    probeCanvas.style.height = '180px'
    probeWrapper.appendChild(probeCanvas)
    document.body.appendChild(probeWrapper)

    const source = `graph TD
      A[Start] --> B[Done]`

    const windowTracker = trackKeydownListeners(window)
    const canvasTracker = trackKeydownListeners(probeCanvas)

    let mountErrorMessage: string | null = null
    let fitCallsAfterKeydown = 0
    const renderer = new MermaidRenderer()
    ;(renderer as any).fitToView = () => {
      fitCallsAfterKeydown += 1
    }

    const steps: string[] = []
    const mark = (step: string) => {
      steps.push(step)
      setStatus(JSON.stringify({ steps }, null, 2))
    }

    try {
      mark('mount:start')
      const mountPromise = renderer.mount(probeCanvas)
      mark('destroy:start')
      renderer.destroy()
      mark('destroy:done')
      try {
        await withTimeout(mountPromise, 'destroy-during-mount settle')
        mark('mount:settled')
      } catch (error) {
        mountErrorMessage = error instanceof Error ? error.message : String(error)
        mark('mount:rejected')
      }

      const appReleased = (renderer as any)._app === null
      const keyHandlerReleased = (renderer as any)._keyHandler === null
      const resizeObserverReleased = (renderer as any)._resizeObserver === null
      const canvasOwnershipReleased = !(MermaidRenderer as any)._liveCanvases.has(probeCanvas)
      mark('fields:read')

      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }))
      probeCanvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }))
      mark('keydown:dispatched')

      const keydownListenersReleased = windowTracker.liveCount() === 0 && canvasTracker.liveCount() === 0

      let remountSucceeded = false
      let remountNodeCount = 0
      const second = new MermaidRenderer()
      try {
        mark('remount:start')
        await withTimeout(second.mount(probeCanvas), 'remount after aborted mount')
        mark('remount:mounted')
        await withTimeout(second.load(source), 'load after aborted mount')
        mark('remount:loaded')
        remountSucceeded = true
        remountNodeCount = (second as any)._nodeSprites.size as number
      } finally {
        second.destroy()
        mark('remount:destroyed')
      }

      const result = {
        mountErrorMessage,
        appReleased,
        keyHandlerReleased,
        resizeObserverReleased,
        canvasOwnershipReleased,
        keydownListenersReleased,
        fitCallsAfterKeydown,
        remountSucceeded,
        remountNodeCount,
      }
      setStatus(JSON.stringify(result, null, 2))
      return result
    } finally {
      windowTracker.restore()
      canvasTracker.restore()
      renderer.destroy()
      probeWrapper.remove()
      if (originalGpuDescriptor) {
        Object.defineProperty(navigator, 'gpu', originalGpuDescriptor)
      }
    }
  },
  async setupKeyboardScopeProbe(): Promise<void> {
    teardownKeyboardScope()

    const gpuDescriptor = Object.getOwnPropertyDescriptor(navigator, 'gpu') ?? null
    try {
      Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        value: undefined,
      })
    } catch {
      // ignore if the browser does not let us override this property
    }

    const canvas = document.getElementById('canvas-a') as HTMLCanvasElement
    const editor = document.createElement('div')
    editor.id = 'keyboard-probe-editor'
    editor.setAttribute('contenteditable', 'true')
    editor.textContent = 'editable host'
    editor.style.position = 'fixed'
    editor.style.right = '16px'
    editor.style.bottom = '16px'
    editor.style.width = '280px'
    editor.style.minHeight = '48px'
    editor.style.padding = '8px'
    editor.style.background = '#f9fafb'
    editor.style.color = '#111827'
    editor.style.zIndex = '10'
    document.body.appendChild(editor)

    const renderer = new MermaidRenderer()
    const counts = { fit: 0, reset: 0 }
    keyboardScopeState = { renderer, editor, counts, gpuDescriptor }

    await withTimeout(renderer.mount(canvas), 'keyboard scope mount')
    renderer.loadGraph({
      nodes: new Map([
        ['A', { id: 'A', label: 'Start', shape: 'rectangle', metadata: {} }],
        ['B', { id: 'B', label: 'Done', shape: 'rectangle', metadata: {} }],
      ]),
      edges: [{ id: 'A->B', source: 'A', target: 'B', style: 'solid' as const }],
      subgraphs: new Map(),
      directives: [],
      direction: 'TD',
      diagramType: 'flowchart' as const,
    })

    const originalFit = renderer.fitToView.bind(renderer)
    ;(renderer as any).fitToView = () => {
      counts.fit += 1
      originalFit()
    }
    const originalReset = renderer.resetView.bind(renderer)
    ;(renderer as any).resetView = () => {
      counts.reset += 1
      originalReset()
    }

    setStatus('keyboard scope probe ready')
  },
  getKeyboardScopeCounts(): KeyboardScopeCounts {
    if (!keyboardScopeState) {
      throw new Error('keyboard scope probe is not active')
    }
    const active = document.activeElement
    return {
      fitCalls: keyboardScopeState.counts.fit,
      resetCalls: keyboardScopeState.counts.reset,
      editorText: keyboardScopeState.editor.textContent ?? '',
      activeElementId: active instanceof HTMLElement ? (active.id || active.tagName.toLowerCase()) : 'none',
    }
  },
  focusKeyboardScopeCanvas(): boolean {
    const canvas = document.getElementById('canvas-a') as HTMLCanvasElement
    canvas.focus()
    return document.activeElement === canvas
  },
  teardownKeyboardScopeProbe(): void {
    teardownKeyboardScope()
    setStatus('keyboard scope probe torn down')
  },
  async runContextRecovery(): Promise<ContextRecoveryResult> {
    const originalGpuDescriptor = Object.getOwnPropertyDescriptor(navigator, 'gpu')
    try {
      Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        value: undefined,
      })
    } catch {
      // ignore if the browser does not let us override this property
    }

    const canvasA = document.getElementById('canvas-a') as HTMLCanvasElement
    const renderer = new MermaidRenderer()
    const source = `graph TD
      A[Start] --> B[Done]`

    try {
      await withTimeout(renderer.mount(canvasA), 'recovery mount')
      await withTimeout(renderer.load(source), 'recovery load')
      const initialNodeCount = (renderer as any)._nodeSprites.size

      const lostEvent = new Event('webglcontextlost', { cancelable: true })
      const restoredEvent = new Event('webglcontextrestored')
      canvasA.dispatchEvent(lostEvent)
      const contextLossPrevented = lostEvent.defaultPrevented
      const contextRestoredDispatched = canvasA.dispatchEvent(restoredEvent)

      const recoveredNodeCount = await withTimeout(
        new Promise<number>((resolve, reject) => {
          const started = performance.now()
          const tick = () => {
            const nodeCount = (renderer as any)._nodeSprites.size as number
            if (nodeCount > 0) {
              resolve(nodeCount)
              return
            }
            if (performance.now() - started > 5000) {
              reject(new Error('context recovery timed out'))
              return
            }
            window.setTimeout(tick, 50)
          }
          tick()
        }),
        'context recovery',
      )

      return {
        initialNodeCount,
        recoveredNodeCount,
        contextLossPrevented,
        contextRestoredDispatched,
      }
    } finally {
      renderer.destroy()
      if (originalGpuDescriptor) {
        Object.defineProperty(navigator, 'gpu', originalGpuDescriptor)
      }
    }
  },
  async runContextRecoveryVisualProbe(): Promise<ContextRecoveryVisualResult> {
    const originalGpuDescriptor = Object.getOwnPropertyDescriptor(navigator, 'gpu')
    try {
      Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        value: undefined,
      })
    } catch {
      // ignore if the browser does not let us override this property
    }

    const canvasA = document.getElementById('canvas-a') as HTMLCanvasElement
    const renderer = new MermaidRenderer()
    const source = `graph TD
      A[Start] --> B[Done]`

    try {
      await withTimeout(renderer.mount(canvasA), 'recovery visual mount')
      await withTimeout(renderer.load(source), 'recovery visual load')
      const initialNodeCount = (renderer as any)._nodeSprites.size

      const lostEvent = new Event('webglcontextlost', { cancelable: true })
      const restoredEvent = new Event('webglcontextrestored')
      canvasA.dispatchEvent(lostEvent)
      const contextLossPrevented = lostEvent.defaultPrevented
      const contextRestoredDispatched = canvasA.dispatchEvent(restoredEvent)

      const recoveredNodeCount = await withTimeout(
        new Promise<number>((resolve, reject) => {
          const started = performance.now()
          const tick = () => {
            const nodeCount = (renderer as any)._nodeSprites.size as number
            if (nodeCount > 0) {
              resolve(nodeCount)
              return
            }
            if (performance.now() - started > 5000) {
              reject(new Error('context recovery timed out'))
              return
            }
            window.setTimeout(tick, 50)
          }
          tick()
        }),
        'context recovery visual',
      )

      const screenshotBase64 = canvasA.toDataURL('image/png').split(',')[1]

      const result = {
        initialNodeCount,
        recoveredNodeCount,
        contextLossPrevented,
        contextRestoredDispatched,
        canvasId: 'canvas-a',
        screenshotBase64,
      }
      setStatus(JSON.stringify(result, null, 2))
      renderer.destroy()
      if (originalGpuDescriptor) {
        Object.defineProperty(navigator, 'gpu', originalGpuDescriptor)
      }
      return result
    } catch (error) {
      renderer.destroy()
      if (originalGpuDescriptor) {
        Object.defineProperty(navigator, 'gpu', originalGpuDescriptor)
      }
      throw error
    }
  },
  async runVisibilityPauseProbe(): Promise<VisibilityPauseResult> {
    const originalGpuDescriptor = Object.getOwnPropertyDescriptor(navigator, 'gpu')
    try {
      Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        value: undefined,
      })
    } catch {
      // ignore if the browser does not let us override this property
    }

    const canvasA = document.getElementById('canvas-a') as HTMLCanvasElement
    const renderer = new MermaidRenderer()
    const source = `graph TD
      A[Start] --> B[Done]`
    const originalVisibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState')
    const documentPrototype = Object.getPrototypeOf(document) as Document
    const prototypeVisibilityDescriptor = Object.getOwnPropertyDescriptor(documentPrototype, 'visibilityState')
    let simulatedVisibilityState: DocumentVisibilityState | null = null

    try {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => simulatedVisibilityState ?? prototypeVisibilityDescriptor?.get?.call(document) ?? 'visible',
      })
    } catch {
      // ignore if the browser does not let us override this property
    }

    try {
      await withTimeout(renderer.mount(canvasA), 'visibility mount')
      await withTimeout(renderer.load(source), 'visibility load')

      const app = (renderer as any)._app as { ticker?: { started?: boolean } } | null
      const initiallyRunning = Boolean(app?.ticker?.started)

      simulatedVisibilityState = 'hidden'
      document.dispatchEvent(new Event('visibilitychange'))
      const hiddenRunning = Boolean(app?.ticker?.started)

      simulatedVisibilityState = 'visible'
      document.dispatchEvent(new Event('visibilitychange'))
      const restoredRunning = Boolean(app?.ticker?.started)

      return {
        initiallyRunning,
        hiddenRunning,
        restoredRunning,
      }
    } finally {
      renderer.destroy()
      if (originalVisibilityDescriptor) {
        Object.defineProperty(document, 'visibilityState', originalVisibilityDescriptor)
      } else {
        delete (document as { visibilityState?: DocumentVisibilityState }).visibilityState
      }
      if (originalGpuDescriptor) {
        Object.defineProperty(navigator, 'gpu', originalGpuDescriptor)
      }
    }
  },
  async runRelayoutVisibilityPauseProbe(): Promise<RelayoutVisibilityPauseResult> {
    const originalGpuDescriptor = Object.getOwnPropertyDescriptor(navigator, 'gpu')
    try {
      Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        value: undefined,
      })
    } catch {
      // ignore if the browser does not let us override this property
    }

    const canvasA = document.getElementById('canvas-a') as HTMLCanvasElement
    const renderer = new MermaidRenderer()
    const source = `%% @layout narrative
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
  C --> E`
    const originalVisibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState')
    const documentPrototype = Object.getPrototypeOf(document) as Document
    const prototypeVisibilityDescriptor = Object.getOwnPropertyDescriptor(documentPrototype, 'visibilityState')
    let simulatedVisibilityState: DocumentVisibilityState | null = null

    try {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => simulatedVisibilityState ?? prototypeVisibilityDescriptor?.get?.call(document) ?? 'visible',
      })
    } catch {
      // ignore if the browser does not let us override this property
    }

    const readNodePosition = (nodeId: string) => {
      const sprite = ((renderer as any)._nodeSprites as Map<string, { x: number; y: number }> | undefined)?.get(nodeId)
      return sprite ? { x: sprite.x, y: sprite.y } : null
    }

    try {
      await withTimeout(renderer.mount(canvasA), 'relayout visibility mount')
      await withTimeout(renderer.load(source), 'relayout visibility load')
      const start = readNodePosition('D')
      if (!start) throw new Error('moving node not found before relayout')

      renderer.setPhilosophy('radial')

      const beforeHide = await withTimeout(
        new Promise<{ x: number; y: number }>((resolve, reject) => {
          const started = performance.now()
          const tick = () => {
            const current = readNodePosition('D')
            if (current && Math.hypot(current.x - start.x, current.y - start.y) > 6) {
              resolve(current)
              return
            }
            if (performance.now() - started > 5000) {
              reject(new Error('relayout did not start moving before hide'))
              return
            }
            window.setTimeout(tick, 16)
          }
          tick()
        }),
        'relayout movement before hide',
      )

      simulatedVisibilityState = 'hidden'
      document.dispatchEvent(new Event('visibilitychange'))
      await new Promise((resolve) => window.setTimeout(resolve, 180))
      const hidden = readNodePosition('D')

      simulatedVisibilityState = 'visible'
      document.dispatchEvent(new Event('visibilitychange'))

      const afterVisible = await withTimeout(
        new Promise<{ x: number; y: number }>((resolve, reject) => {
          const started = performance.now()
          const tick = () => {
            const current = readNodePosition('D')
            if (current && hidden && Math.hypot(current.x - hidden.x, current.y - hidden.y) > 4) {
              resolve(current)
              return
            }
            if (performance.now() - started > 5000) {
              reject(new Error('relayout did not resume after visibility restore'))
              return
            }
            window.setTimeout(tick, 16)
          }
          tick()
        }),
        'relayout movement after visible',
      )

      return {
        nodeMovedBeforeHide: Math.hypot(beforeHide.x - start.x, beforeHide.y - start.y) > 6,
        stayedStillWhileHidden: hidden ? Math.hypot(hidden.x - beforeHide.x, hidden.y - beforeHide.y) <= 0.5 : false,
        resumedAfterVisible: hidden ? Math.hypot(afterVisible.x - hidden.x, afterVisible.y - hidden.y) > 4 : false,
      }
    } finally {
      renderer.destroy()
      if (originalVisibilityDescriptor) {
        Object.defineProperty(document, 'visibilityState', originalVisibilityDescriptor)
      } else {
        delete (document as { visibilityState?: DocumentVisibilityState }).visibilityState
      }
      if (originalGpuDescriptor) {
        Object.defineProperty(navigator, 'gpu', originalGpuDescriptor)
      }
    }
  },
  async runIdlePauseProbe(): Promise<IdlePauseResult> {
    const originalGpuDescriptor = Object.getOwnPropertyDescriptor(navigator, 'gpu')
    try {
      Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        value: undefined,
      })
    } catch {
      // ignore if the browser does not let us override this property
    }

    const canvasA = document.getElementById('canvas-a') as HTMLCanvasElement
    const renderer = new MermaidRenderer()
    const source = `graph TD
      A[Start] --> B[Done]`

    try {
      await withTimeout(renderer.mount(canvasA), 'idle mount')
      await withTimeout(renderer.load(source), 'idle load')

      const app = (renderer as any)._app as { ticker?: { started?: boolean } } | null
      const runningImmediatelyAfterLoad = Boolean(app?.ticker?.started)

      await new Promise((resolve) => window.setTimeout(resolve, 350))
      const stoppedAfterIdle = !app?.ticker?.started

      canvasA.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        clientX: 20,
        clientY: 20,
      }))
      await new Promise((resolve) => window.setTimeout(resolve, 50))
      const runningAfterPointerMove = Boolean(app?.ticker?.started)

      await new Promise((resolve) => window.setTimeout(resolve, 350))
      const stoppedAgainAfterIdle = !app?.ticker?.started

      return {
        runningImmediatelyAfterLoad,
        stoppedAfterIdle,
        runningAfterPointerMove,
        stoppedAgainAfterIdle,
      }
    } finally {
      renderer.destroy()
      if (originalGpuDescriptor) {
        Object.defineProperty(navigator, 'gpu', originalGpuDescriptor)
      }
    }
  },
  async runAdapterFallbackProbe(): Promise<AdapterFallbackResult> {
    const originalGpuDescriptor = Object.getOwnPropertyDescriptor(navigator, 'gpu')
    let requestAdapterCalls = 0
    try {
      Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        value: {
          async requestAdapter() {
            requestAdapterCalls += 1
            return null
          },
        },
      })
    } catch {
      // ignore if the browser does not let us override this property
    }

    const canvasA = document.getElementById('canvas-a') as HTMLCanvasElement
    const renderer = new MermaidRenderer()
    const source = `graph TD
      A[Start] --> B[Done]`

    try {
      await withTimeout(renderer.mount(canvasA), 'adapter fallback mount')
      await withTimeout(renderer.load(source), 'adapter fallback load')
      const app = (renderer as any)._app as { renderer?: { type?: number } } | null
      const backend = app?.renderer?.type === 0x1
        ? 'WebGL'
        : app?.renderer?.type === 0x2
          ? 'WebGPU'
          : null
      const nodeCount = (renderer as any)._nodeSprites.size as number
      return {
        mountSucceeded: true,
        backend,
        nodeCount,
        requestAdapterCalls,
      }
    } finally {
      renderer.destroy()
      if (originalGpuDescriptor) {
        Object.defineProperty(navigator, 'gpu', originalGpuDescriptor)
      }
    }
  },
  async runAdapterFallbackVisualProbe(): Promise<AdapterFallbackVisualResult> {
    adapterFallbackVisualRenderer?.destroy()
    adapterFallbackVisualRenderer = null
    if (adapterFallbackVisualGpuDescriptor) {
      Object.defineProperty(navigator, 'gpu', adapterFallbackVisualGpuDescriptor)
      adapterFallbackVisualGpuDescriptor = null
    }

    const originalGpuDescriptor = Object.getOwnPropertyDescriptor(navigator, 'gpu')
    adapterFallbackVisualGpuDescriptor = originalGpuDescriptor ?? null
    let requestAdapterCalls = 0
    try {
      Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        value: {
          async requestAdapter() {
            requestAdapterCalls += 1
            return null
          },
        },
      })
    } catch {
      // ignore if the browser does not let us override this property
    }

    const canvasA = document.getElementById('canvas-a') as HTMLCanvasElement
    const renderer = new MermaidRenderer()
    adapterFallbackVisualRenderer = renderer
    const source = `graph TD
      A[Start] --> B[Done]`

    try {
      await withTimeout(renderer.mount(canvasA), 'adapter fallback visual mount')
      await withTimeout(renderer.load(source), 'adapter fallback visual load')
      const app = (renderer as any)._app as { renderer?: { type?: number } } | null
      const backend = app?.renderer?.type === 0x1
        ? 'WebGL'
        : app?.renderer?.type === 0x2
          ? 'WebGPU'
          : null
      const nodeCount = (renderer as any)._nodeSprites.size as number
      const result = {
        mountSucceeded: true,
        backend,
        nodeCount,
        requestAdapterCalls,
        canvasId: 'canvas-a',
      }
      setStatus(JSON.stringify(result, null, 2))
      return result
    } catch (error) {
      renderer.destroy()
      adapterFallbackVisualRenderer = null
      if (adapterFallbackVisualGpuDescriptor) {
        Object.defineProperty(navigator, 'gpu', adapterFallbackVisualGpuDescriptor)
        adapterFallbackVisualGpuDescriptor = null
      }
      throw error
    }
  },
  cleanupAdapterFallbackVisualProbe(): void {
    adapterFallbackVisualRenderer?.destroy()
    adapterFallbackVisualRenderer = null
    if (adapterFallbackVisualGpuDescriptor) {
      Object.defineProperty(navigator, 'gpu', adapterFallbackVisualGpuDescriptor)
      adapterFallbackVisualGpuDescriptor = null
    }
  },
  startWebGpuRecoveryProbe(): void {
    const canvasA = document.getElementById('canvas-a') as HTMLCanvasElement
    const renderer = new MermaidRenderer()
    const source = `graph TD
      A[Start] --> B[Done]`
    const onWarn = (warning: any) => {
      webGpuRecoveryProbe?.warningMessages.push(warning?.message ?? String(warning))
    }
    renderer.on('warn', onWarn)
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

    const readBackend = () => {
      const app = (renderer as any)._app as { renderer?: { type?: number } } | null
      return app?.renderer?.type === 0x2
        ? 'WebGPU'
        : app?.renderer?.type === 0x1
          ? 'WebGL'
          : null
    }

    const finish = (error: string | null = null) => {
      if (!webGpuRecoveryProbe || webGpuRecoveryProbe.done) return
      if (error) webGpuRecoveryProbe.error = error
      webGpuRecoveryProbe.done = true
      setStatus(JSON.stringify(webGpuRecoveryProbe, null, 2))
      renderer.off('warn', onWarn)
      renderer.destroy()
    }

    void (async () => {
      try {
        webGpuRecoveryProbe?.steps.push('mount:start')
        await withTimeout(renderer.mount(canvasA), 'webgpu recovery mount')
        webGpuRecoveryProbe?.steps.push('mount:done')

        await withTimeout(renderer.load(source), 'webgpu recovery load')
        webGpuRecoveryProbe?.steps.push('load:done')

        if (!webGpuRecoveryProbe) return
        webGpuRecoveryProbe.initialBackend = readBackend()
        webGpuRecoveryProbe.initialNodeCount = (renderer as any)._nodeSprites.size as number
        if (webGpuRecoveryProbe.initialBackend !== 'WebGPU') {
          finish('WebGPU adapter unavailable in current browser environment')
          return
        }

        const app = (renderer as any)._app as object | null
        const generation = (renderer as any)._gpuLostGeneration as number
        webGpuRecoveryProbe.steps.push('deviceLost:invoke')
        void (renderer as any)
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

          const nodeCount = (renderer as any)._nodeSprites.size as number
          if (readBackend() && nodeCount > 0 && webGpuRecoveryProbe.warningMessages.some((message) => message.includes('WebGPU device lost'))) {
            webGpuRecoveryProbe.recoveredBackend = readBackend()
            webGpuRecoveryProbe.recoveredNodeCount = nodeCount
            webGpuRecoveryProbe.steps.push('recovery:done')
            finish()
            return
          }

          if (performance.now() - started > 10000) {
            finish('webgpu recovery timed out')
            return
          }

          window.setTimeout(poll, 50)
        }

        poll()
      } catch (error) {
        finish(error instanceof Error ? error.message : String(error))
      }
    })()
  },
  getWebGpuRecoveryProbe(): WebGpuRecoveryResult | null {
    return webGpuRecoveryProbe
  },
}

setStatus('ready')
