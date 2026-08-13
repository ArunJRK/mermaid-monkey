import { describe, it, expect } from 'vitest'
import { LoadPipeline } from '../load-pipeline'
import { computeSelfLoopGeometry } from '../self-loop-geometry'
import { estimateRenderedNodeFootprint } from '../../node-footprint'
import { measureTextWidth } from '../../layout/text-measure'

describe('LoadPipeline', () => {
  it('parses mermaid source and produces positioned graph', async () => {
    const pipeline = new LoadPipeline()
    const result = await pipeline.load('graph TD\n    A[Hello] --> B[World]')

    expect(result.success).toBe(true)
    expect(result.positioned).toBeDefined()
    expect(result.positioned!.nodes.size).toBe(2)
    expect(result.positioned!.edges.length).toBe(1)
  })

  it('returns error for invalid source', async () => {
    const pipeline = new LoadPipeline()
    const result = await pipeline.load('not valid mermaid')

    expect(result.success).toBe(false)
    expect(result.errors!.length).toBeGreaterThan(0)
    expect(result.errors![0].code).toBe('PARSE_FAILED')
  })

  it('preserves previous result on error', async () => {
    const pipeline = new LoadPipeline()

    // First load succeeds
    const good = await pipeline.load('graph TD\n    A --> B')
    expect(good.success).toBe(true)

    // Second load fails
    const bad = await pipeline.load('invalid')
    expect(bad.success).toBe(false)

    // Previous result still available
    expect(pipeline.lastPositioned).toBeDefined()
    expect(pipeline.lastPositioned!.nodes.size).toBe(2)
  })

  it('applies layout philosophy from directive', async () => {
    const pipeline = new LoadPipeline()

    const breathResult = await pipeline.load('%% @layout breath\ngraph TD\n    A --> B --> C')
    const blueprintPipeline = new LoadPipeline()
    const blueprintResult = await blueprintPipeline.load('%% @layout blueprint\ngraph TD\n    A --> B --> C')

    expect(breathResult.success).toBe(true)
    expect(blueprintResult.success).toBe(true)

    // Breath should produce larger dimensions
    expect(breathResult.positioned!.height).toBeGreaterThan(blueprintResult.positioned!.height)
  })

  it('cancels previous load when new load starts', async () => {
    const pipeline = new LoadPipeline()

    // Start two loads concurrently
    const first = pipeline.load('graph TD\n    A --> B')
    const second = pipeline.load('graph TD\n    X --> Y')

    const [, secondResult] = await Promise.all([first, second])

    // Only second should succeed, first should be cancelled
    expect(secondResult.success).toBe(true)
    expect(secondResult.positioned!.nodes.has('X')).toBe(true)
  })

  it('lays out a sequenceDiagram in declared actor/message order without overlap (regression: GH #4)', async () => {
    const pipeline = new LoadPipeline()
    const source = `sequenceDiagram
    participant C as Client
    participant V as Views (BKB)
    participant P as ProbeRunner
    C->>V: Publish (Idempotency-Key)
    alt claim already held
        V-->>C: 409 publication_in_progress
    else admitted
        V->>P: await required Probe terminal results
        V-->>C: 200 final result
    end
`
    const result = await pipeline.load(source)

    expect(result.success).toBe(true)
    const positioned = result.positioned!
    const client = positioned.nodes.get('C')!
    const views = positioned.nodes.get('V')!
    const probeRunner = positioned.nodes.get('P')!

    // Actor lanes stay in declared left-to-right order, even though two of
    // the messages flow "backwards" (V -> C) relative to that order.
    expect(client.x).toBeLessThan(views.x)
    expect(views.x).toBeLessThan(probeRunner.x)

    // No two messages collapse onto the same row/line.
    const rowYs = positioned.edges.map((edge) => edge.points[0].y)
    expect(new Set(rowYs).size).toBe(rowYs.length)
  })

  it('keeps a long stateDiagram-v2 self-loop label clear of its own node (regression: GH #4)', async () => {
    const pipeline = new LoadPipeline()
    const source = `stateDiagram-v2
    [*] --> draft : CreateView
    draft --> published : first successful Publish cutover - INV-VIEW-068
    draft --> discarded : Discard - releases live RelationName
    published --> retired : Retire - retains RelationName
    published --> published : authoring continues, serving unchanged - INV-VIEW-038
`
    const result = await pipeline.load(source)

    expect(result.success).toBe(true)
    const positioned = result.positioned!
    const published = positioned.nodes.get('published')!
    const selfLoop = positioned.edges.find((edge) => edge.source === 'published' && edge.target === 'published')

    expect(selfLoop).toBeDefined()
    expect(selfLoop!.label).toBeTruthy()

    // Reproduce the actual render-time geometry computation against the
    // real, pipeline-computed node — the label must clear the node's own
    // boundary, not truncate against it.
    const footprint = estimateRenderedNodeFootprint(published, false)
    const geometry = computeSelfLoopGeometry(published, footprint, selfLoop!.label)
    const labelWidth = measureTextWidth(selfLoop!.label!, 11)
    const labelLeftEdge = geometry.labelPosition.x - labelWidth / 2
    const nodeRightEdge = published.x + footprint.width / 2

    expect(labelLeftEdge).toBeGreaterThan(nodeRightEdge)
  })

  it('warns when a graph exceeds the verified interactive stress floor', async () => {
    const pipeline = new LoadPipeline()
    const nodeCount = 221
    const lines = ['graph TD']

    for (let index = 0; index < nodeCount; index += 1) {
      lines.push(`    N${index}[Node ${index}]`)
    }
    for (let index = 0; index < nodeCount - 1; index += 1) {
      lines.push(`    N${index} --> N${index + 1}`)
    }

    const result = await pipeline.load(lines.join('\n'))

    expect(result.success).toBe(true)
    expect(result.warnings?.some((warning) => warning.code === 'PERF_STRESS_THRESHOLD')).toBe(true)
  })
})
