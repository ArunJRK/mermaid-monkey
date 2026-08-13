#!/usr/bin/env node
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(scriptDir, '..')
const repoRoot = path.resolve(packageRoot, '../..')

const DEFAULT_INPUTS = [
  '/Volumes/Lake/Projects/southguild/smriti-wt-view-build/docs/specs/transform/explorations/source-to-gold-canonical.md',
  '/Volumes/Lake/Projects/southguild/smriti-wt-view-build/docs/foundation/topology.md',
]

function parseArgs(argv) {
  const args = {
    inputs: [],
    output: '',
    diagramIndex: 0,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--input') {
      args.inputs.push(argv[++index])
    } else if (arg === '--output') {
      args.output = argv[++index]
    } else if (arg === '--diagram-index') {
      args.diagramIndex = Number(argv[++index])
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return args
}

function printHelp() {
  console.log(`Usage:
  pnpm --filter @mermaid-monkey/core compare:mermaid
  pnpm --filter @mermaid-monkey/core compare:mermaid -- --input /path/to/file.md

Options:
  --input <path>          Markdown or .mmd file. May be repeated.
  --diagram-index <n>    Mermaid fence index for Markdown inputs. Default: 0.
  --output <path>        Output directory. Default: .context/mermaid-baseline-comparison/<timestamp>.
`)
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'diagram'
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function extractMermaidSources(filePath, content) {
  if (filePath.endsWith('.mmd') || filePath.endsWith('.mermaid')) {
    return [{ label: path.basename(filePath), source: content }]
  }

  const sources = []
  const fencePattern = /```(?:mermaid|mmd)\s*\n([\s\S]*?)```/gi
  let match
  while ((match = fencePattern.exec(content)) !== null) {
    sources.push({
      label: `${path.basename(filePath)}#${sources.length}`,
      source: match[1].trim(),
    })
  }
  return sources
}

function normalizeForNativeMermaid(source) {
  return source
    .split('\n')
    .filter((line) => !line.trim().startsWith('%% @layout'))
    .join('\n')
}

function summarizeMonkey(metrics) {
  const bounds = metrics.snapshot.renderedBounds
  const width = bounds ? bounds.maxX - bounds.minX : null
  const height = bounds ? bounds.maxY - bounds.minY : null
  const edgeLengths = metrics.edges.map((edge) => {
    const points = edge.routedSegments.length > 0
      ? edge.routedSegments.flatMap((segment, index) => index === 0
        ? [{ x: segment.x1, y: segment.y1 }, { x: segment.x2, y: segment.y2 }]
        : [{ x: segment.x2, y: segment.y2 }])
      : edge.points
    return pathLength(points)
  })

  return {
    width: width === null ? null : Math.round(width),
    height: height === null ? null : Math.round(height),
    aspectRatio: width && height ? round(width / height) : null,
    nodeCount: metrics.nodes.length,
    edgeCount: metrics.edges.length,
    subgraphCount: metrics.subgraphs.length,
    averageEdgeLength: round(average(edgeLengths)),
    maxEdgeLength: round(Math.max(0, ...edgeLengths)),
    labelBackingCount: metrics.edges.filter((edge) => edge.labelBounds).length,
  }
}

function summarizeNative(metrics) {
  const edgeLengths = metrics.edges.map((edge) => edge.pathLength).filter(Number.isFinite)
  return {
    width: metrics.svgRect ? Math.round(metrics.svgRect.width) : null,
    height: metrics.svgRect ? Math.round(metrics.svgRect.height) : null,
    aspectRatio: metrics.svgRect?.width && metrics.svgRect?.height
      ? round(metrics.svgRect.width / metrics.svgRect.height)
      : null,
    nodeCount: metrics.nodes.length,
    edgeCount: metrics.edges.length,
    subgraphCount: metrics.subgraphs.length,
    averageEdgeLength: round(average(edgeLengths)),
    maxEdgeLength: round(Math.max(0, ...edgeLengths)),
    textCount: metrics.texts.length,
  }
}

function pathLength(points) {
  let total = 0
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]
    total += Math.abs(end.x - start.x) + Math.abs(end.y - start.y)
  }
  return total
}

function average(values) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function round(value) {
  if (!Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

function buildAutomatedNotes(nativeSummary, monkeySummary) {
  const notes = []

  if (nativeSummary.width && monkeySummary.width && monkeySummary.width > nativeSummary.width * 1.35) {
    notes.push('Blueprint is materially wider than native Mermaid; inspect rank spacing, subgraph padding, and grid snapping before adding more canvas scale.')
  }
  if (nativeSummary.height && monkeySummary.height && monkeySummary.height > nativeSummary.height * 1.35) {
    notes.push('Blueprint is materially taller than native Mermaid; inspect vertical stacking and nested-subgraph packing.')
  }
  if (nativeSummary.averageEdgeLength && monkeySummary.averageEdgeLength && monkeySummary.averageEdgeLength > nativeSummary.averageEdgeLength * 1.5) {
    notes.push('Blueprint average edge length is much longer than native Mermaid; inspect routing channels and unnecessary detours.')
  }
  if (nativeSummary.subgraphCount > 0 && monkeySummary.subgraphCount === nativeSummary.subgraphCount) {
    notes.push('Native Mermaid and Blueprint agree on subgraph count; use the captured SVG cluster bounds as a packing baseline.')
  }
  if (notes.length === 0) {
    notes.push('No large geometric divergence was detected by simple metrics; inspect the paired PNG/SVG artifacts for color hierarchy and local routing decisions.')
  }

  return notes
}

async function startViteServer() {
  const server = await createServer({
    root: packageRoot,
    logLevel: 'silent',
    server: {
      host: '127.0.0.1',
      port: 0,
      strictPort: false,
    },
  })
  await server.listen()
  const address = server.httpServer?.address()
  if (!address || typeof address === 'string') {
    throw new Error('Unable to determine Vite dev server address')
  }
  return {
    server,
    baseURL: `http://127.0.0.1:${address.port}`,
  }
}

async function renderNative(page, baseURL, source, artifactBase) {
  await page.goto(`${baseURL}/dev/index.html`)
  const result = await page.evaluate(async (nativeSource) => {
    const { default: mermaid } = await import('/node_modules/mermaid/dist/mermaid.esm.min.mjs')
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'default',
      flowchart: {
        htmlLabels: true,
        useMaxWidth: false,
      },
    })

    const host = document.createElement('div')
    host.id = 'native-root'
    host.style.position = 'fixed'
    host.style.left = '0'
    host.style.top = '0'
    host.style.zIndex = '10000'
    host.style.background = '#ffffff'
    host.style.padding = '24px'
    document.body.innerHTML = ''
    document.body.appendChild(host)

    const renderId = `native-${Math.random().toString(36).slice(2)}`
    const { svg } = await mermaid.render(renderId, nativeSource)
    host.innerHTML = svg
    const svgEl = host.querySelector('svg')
    if (!svgEl) throw new Error('Native Mermaid did not produce an SVG')
    svgEl.style.display = 'block'
    svgEl.style.background = '#ffffff'

    const rectFor = (el) => {
      const rect = el.getBoundingClientRect()
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      }
    }

    const textFor = (el) => Array.from(el.querySelectorAll('text, span, div'))
      .map((child) => child.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')

    const pathLengthFor = (el) => {
      if (typeof el.getTotalLength !== 'function') return null
      try {
        return el.getTotalLength()
      } catch {
        return null
      }
    }

    const nodes = Array.from(svgEl.querySelectorAll('g.node')).map((el) => ({
      id: el.id || null,
      classes: Array.from(el.classList),
      text: textFor(el),
      bounds: rectFor(el),
    }))
    const clusters = Array.from(svgEl.querySelectorAll('g.cluster')).map((el) => ({
      id: el.id || null,
      classes: Array.from(el.classList),
      text: textFor(el),
      bounds: rectFor(el),
    }))
    const edges = Array.from(svgEl.querySelectorAll('g.edgePath, path.flowchart-link')).map((el) => {
      const pathEl = el.matches('path') ? el : el.querySelector('path')
      return {
        id: el.id || pathEl?.id || null,
        classes: Array.from(el.classList),
        bounds: rectFor(el),
        pathLength: pathEl ? pathLengthFor(pathEl) : null,
      }
    })
    const texts = Array.from(svgEl.querySelectorAll('text, foreignObject')).map((el) => ({
      text: el.textContent?.trim().replace(/\s+/g, ' ') ?? '',
      bounds: rectFor(el),
    })).filter((entry) => entry.text)

    return {
      svg: svgEl.outerHTML,
      metrics: {
        viewBox: svgEl.getAttribute('viewBox'),
        svgRect: rectFor(svgEl),
        nodes,
        edges,
        subgraphs: clusters,
        texts,
      },
    }
  }, source)

  await page.locator('#native-root svg').screenshot({ path: `${artifactBase}.native.png` })
  return result
}

async function renderMonkey(page, baseURL, source, artifactBase) {
  await page.goto(`${baseURL}/dev/index.html`)
  await page.waitForFunction(() => Boolean(window.__MERMAID_DEV__))
  const metrics = await page.evaluate(async (monkeySource) => {
    const dev = window.__MERMAID_DEV__
    if (!dev) throw new Error('Mermaid Monkey dev harness was not available')
    dev.setLayout('blueprint')
    const loaded = await dev.loadSource(monkeySource, '/baseline-comparison.mmd')
    if (!loaded) throw new Error(dev.snapshot().statusMessage || 'Mermaid Monkey failed to load source')
    dev.fitToView()
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return {
      snapshot: dev.snapshot(),
      nodes: dev.getRenderedNodeMetrics(),
      edges: dev.getRenderedEdgeMetrics(),
      subgraphs: dev.getRenderedSubgraphMetrics(),
    }
  }, source)

  await page.locator('#canvas').screenshot({ path: `${artifactBase}.blueprint.png` })
  return metrics
}

async function compareDiagram({ browser, baseURL, outputDir, inputPath, label, source }) {
  const slug = slugify(`${path.basename(inputPath)}-${label}`)
  const artifactBase = path.join(outputDir, slug)
  const nativeSource = normalizeForNativeMermaid(source)

  const nativePage = await browser.newPage({ viewport: { width: 2200, height: 1800 } })
  const monkeyPage = await browser.newPage({ viewport: { width: 2200, height: 1800 } })

  try {
    const native = await renderNative(nativePage, baseURL, nativeSource, artifactBase)
    const monkey = await renderMonkey(monkeyPage, baseURL, source, artifactBase)
    const nativeSummary = summarizeNative(native.metrics)
    const monkeySummary = summarizeMonkey(monkey)
    const report = {
      inputPath,
      label,
      nativeSummary,
      monkeySummary,
      automatedNotes: buildAutomatedNotes(nativeSummary, monkeySummary),
      native: native.metrics,
      monkey,
    }

    await writeFile(`${artifactBase}.native.svg`, native.svg)
    await writeFile(`${artifactBase}.json`, `${JSON.stringify(report, null, 2)}\n`)
    return {
      slug,
      report,
      artifacts: {
        nativeSvg: `${artifactBase}.native.svg`,
        nativePng: `${artifactBase}.native.png`,
        blueprintPng: `${artifactBase}.blueprint.png`,
        json: `${artifactBase}.json`,
      },
    }
  } finally {
    await nativePage.close()
    await monkeyPage.close()
  }
}

function markdownReport(results, outputDir) {
  const lines = [
    '# Mermaid Baseline Comparison',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    'This report compares native Mermaid SVG layout against Mermaid Monkey Blueprint rendering for the same source diagrams.',
    '',
  ]

  for (const result of results) {
    const native = result.report.nativeSummary
    const monkey = result.report.monkeySummary
    lines.push(`## ${result.slug}`)
    lines.push('')
    lines.push(`Source: \`${result.report.inputPath}\``)
    lines.push('')
    lines.push('| Metric | Native Mermaid | Blueprint |')
    lines.push('| --- | ---: | ---: |')
    lines.push(`| Width | ${native.width ?? 'n/a'} | ${monkey.width ?? 'n/a'} |`)
    lines.push(`| Height | ${native.height ?? 'n/a'} | ${monkey.height ?? 'n/a'} |`)
    lines.push(`| Aspect ratio | ${native.aspectRatio ?? 'n/a'} | ${monkey.aspectRatio ?? 'n/a'} |`)
    lines.push(`| Nodes | ${native.nodeCount} | ${monkey.nodeCount} |`)
    lines.push(`| Edges | ${native.edgeCount} | ${monkey.edgeCount} |`)
    lines.push(`| Subgraphs | ${native.subgraphCount} | ${monkey.subgraphCount} |`)
    lines.push(`| Average edge length | ${native.averageEdgeLength ?? 'n/a'} | ${monkey.averageEdgeLength ?? 'n/a'} |`)
    lines.push('')
    lines.push('Artifacts:')
    lines.push(`- Native SVG: \`${path.relative(outputDir, result.artifacts.nativeSvg)}\``)
    lines.push(`- Native PNG: \`${path.relative(outputDir, result.artifacts.nativePng)}\``)
    lines.push(`- Blueprint PNG: \`${path.relative(outputDir, result.artifacts.blueprintPng)}\``)
    lines.push(`- Metrics JSON: \`${path.relative(outputDir, result.artifacts.json)}\``)
    lines.push('')
    lines.push('Automated notes:')
    for (const note of result.report.automatedNotes) {
      lines.push(`- ${note}`)
    }
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const outputDir = path.resolve(
    repoRoot,
    args.output || path.join('.context', 'mermaid-baseline-comparison', timestampSlug()),
  )
  const candidateInputs = args.inputs.length > 0
    ? args.inputs
    : DEFAULT_INPUTS

  await mkdir(outputDir, { recursive: true })

  const inputs = []
  for (const input of candidateInputs) {
    const inputPath = path.resolve(input)
    try {
      const content = await readFile(inputPath, 'utf8')
      const diagrams = extractMermaidSources(inputPath, content)
      if (diagrams.length === 0) {
        console.warn(`Skipping ${inputPath}: no Mermaid fences found`)
        continue
      }
      const selected = diagrams[args.diagramIndex]
      if (!selected) {
        console.warn(`Skipping ${inputPath}: diagram index ${args.diagramIndex} not found`)
        continue
      }
      inputs.push({ inputPath, ...selected })
    } catch (error) {
      console.warn(`Skipping ${inputPath}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (inputs.length === 0) {
    throw new Error('No Mermaid inputs were available to compare')
  }

  const { server, baseURL } = await startViteServer()
  const browser = await chromium.launch()

  try {
    const results = []
    for (const input of inputs) {
      console.log(`Comparing ${input.inputPath} (${input.label})`)
      results.push(await compareDiagram({ browser, baseURL, outputDir, ...input }))
    }

    const reportPath = path.join(outputDir, 'README.md')
    await writeFile(reportPath, markdownReport(results, outputDir))

    console.log(`Wrote comparison artifacts to ${outputDir}`)
    console.log(`Report: ${reportPath}`)
  } finally {
    await browser.close()
    await server.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
