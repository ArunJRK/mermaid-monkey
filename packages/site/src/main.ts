import './styles.css'

type DemoLayout = 'narrative' | 'blueprint'

type RendererModule = typeof import('@mermaid-monkey/core')
type MermaidRendererInstance = InstanceType<RendererModule['MermaidRenderer']>
type LinkResolver = import('@mermaid-monkey/core').LinkResolver
type RenderGraph = import('@mermaid-monkey/core').RenderGraph

const files: Record<string, string> = {
  '/demo/source.mmd': `%% @link docs -> ./details#hydrate
graph TD
  syntax[Mermaid syntax] --> parse[Parse directives]
  parse --> layout{Narrative or Blueprint}
  layout --> canvas[GPU canvas]
  canvas --> fold[Fold subgraphs]
  canvas --> link[Cross-file @link]
  subgraph Project files
    docs[docs/architecture.mmd]
    fold
    link
  end`,
  '/demo/details.mmd': `graph TD
  hydrate[Hydrate renderer] --> preview[Hover preview]
  hydrate --> navigate[Reveal target node]
  navigate --> fit[Fit to view]`,
}

const sourcePath = '/demo/source.mmd'
const demoCanvas = document.querySelector<HTMLCanvasElement>('#demo-canvas')
const demoStatus = document.querySelector<HTMLElement>('#demo-status')
const demoLoading = document.querySelector<HTMLElement>('#demo-loading')
const demoFallback = document.querySelector<HTMLElement>('#demo-fallback')
const layoutButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-layout]'))
const copyButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-copy-target]'))

let renderer: MermaidRendererInstance | null = null
let rendererModule: RendererModule | null = null
let currentLayout: DemoLayout = 'narrative'
let currentFile = sourcePath
let currentLoadId = 0

function setDemoStatus(message: string) {
  if (demoStatus) demoStatus.textContent = message
}

function showDemoFallback(message: string) {
  demoLoading?.classList.add('is-hidden')
  if (demoFallback) demoFallback.hidden = false
  setDemoStatus(message)
}

function syncLayoutButtons() {
  for (const button of layoutButtons) {
    const layout = button.dataset.layout
    button.setAttribute('aria-pressed', String(layout === currentLayout))
  }
}

function normalizePath(targetFile: string, fromFile: string): string | null {
  return rendererModule?.normalizeDiagramPath(targetFile, fromFile) ?? null
}

function createResolver(): LinkResolver {
  return {
    canonicalize(targetFile: string, fromFile: string): string | null {
      return normalizePath(targetFile, fromFile)
    },
    read(canonicalFile: string): string | null {
      return files[canonicalFile] ?? null
    },
  }
}

async function buildPreviewGraph(targetFile: string): Promise<RenderGraph | null> {
  if (!rendererModule) return null
  const source = files[targetFile]
  if (!source) return null
  const result = await rendererModule.buildGraph(source, { sourcePath: targetFile })
  return result.success && result.graph ? result.graph : null
}

async function loadDemoFile(filePath: string, targetNode?: string): Promise<boolean> {
  if (!renderer || !rendererModule) return false
  const loadId = ++currentLoadId
  const resolvedPath = normalizePath(filePath, currentFile)
  if (!resolvedPath || !files[resolvedPath]) {
    setDemoStatus(`Missing linked diagram: ${filePath}`)
    return false
  }

  currentFile = resolvedPath
  setDemoStatus(`Loading ${resolvedPath} with ${currentLayout}...`)
  const result = await renderer.load(`%% @layout ${currentLayout}\n${files[resolvedPath]}`, {
    sourcePath: resolvedPath,
    linkResolver: createResolver(),
  })
  if (loadId !== currentLoadId) return false

  if (!result.success) {
    const message = result.errors.map((error) => error.message).join('\n') || 'Diagram failed to load.'
    showDemoFallback(message)
    return false
  }

  if (targetNode) renderer.revealNode(targetNode)
  const warnings = result.warnings.map((warning) => warning.message).join(' ')
  setDemoStatus(warnings || `Live ${currentLayout} canvas ready. Pan, zoom, fold, or click a link badge.`)
  demoLoading?.classList.add('is-hidden')
  return true
}

async function initDemo() {
  if (!demoCanvas) return

  try {
    rendererModule = await import('@mermaid-monkey/core')
    const { MermaidRenderer } = rendererModule
    renderer = new MermaidRenderer({ themeMode: 'dark' })
    renderer.on('warn', (warning) => {
      const message = typeof warning === 'object' && warning && 'message' in warning
        ? String((warning as { message?: unknown }).message)
        : String(warning)
      setDemoStatus(message)
    })
    renderer.on('link:navigate', (payload) => {
      const event = payload as { targetFile?: string; targetNode?: string }
      if (event.targetFile) void loadDemoFile(event.targetFile, event.targetNode)
    })
    renderer.onResolvePreview = buildPreviewGraph
    await renderer.mount(demoCanvas)
    await loadDemoFile(sourcePath)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    showDemoFallback(`Rendering unavailable: ${message}`)
  }
}

function scheduleDemo() {
  const start = () => {
    void initDemo()
  }

  const requestIdle = (window as Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
  }).requestIdleCallback

  if (requestIdle) {
    requestIdle(start, { timeout: 1200 })
    return
  }

  globalThis.setTimeout(start, 250)
}

for (const button of layoutButtons) {
  button.addEventListener('click', () => {
    const layout = button.dataset.layout
    if (layout !== 'narrative' && layout !== 'blueprint') return
    currentLayout = layout
    syncLayoutButtons()
    renderer?.setPhilosophy(layout)
    void loadDemoFile(currentFile)
  })
}

document.querySelector<HTMLButtonElement>('[data-demo-action="fold"]')?.addEventListener('click', () => {
  renderer?.foldAll()
  setDemoStatus('Subgraphs folded. Use Unfold or switch layout to watch the scene rebuild.')
})

document.querySelector<HTMLButtonElement>('[data-demo-action="unfold"]')?.addEventListener('click', () => {
  renderer?.unfoldAll()
  setDemoStatus('Subgraphs unfolded.')
})

document.querySelector<HTMLButtonElement>('[data-demo-action="fit"]')?.addEventListener('click', () => {
  renderer?.fitToView()
  setDemoStatus('Fit to view restored.')
})

for (const button of copyButtons) {
  button.addEventListener('click', async () => {
    const targetId = button.dataset.copyTarget
    const target = targetId ? document.getElementById(targetId) : null
    const text = target?.textContent?.trim()
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      button.dataset.copied = 'true'
      window.setTimeout(() => {
        delete button.dataset.copied
      }, 1200)
    } catch {
      setDemoStatus('Copy is blocked in this browser context.')
    }
  })
}

syncLayoutButtons()
scheduleDemo()
