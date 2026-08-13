import type {
  RenderGraph,
  PositionedGraph,
  LayoutDirective,
  RenderError,
  RenderWarning,
  LinkResolver,
  LinkState,
} from '../types'
import { buildGraph } from '../parser/graph-builder'
import { DagreLayout } from '../layout/dagre-layout'
import { BlueprintLayout } from '../layout/blueprint-layout'
import { NarrativeLayout } from '../layout/narrative-layout'
import { SequenceLayout } from '../layout/sequence-layout'
import type { LayoutEngine } from '../layout/layout-engine'

const VERIFIED_INTERACTIVE_NODE_FLOOR = 220
const VERIFIED_INTERACTIVE_EDGE_FLOOR = 294

/**
 * Factory: select the right layout engine for the given philosophy.
 *
 * Sequence diagrams are not a generic directed graph (see sequence-layout.ts)
 * — regardless of the chosen visual philosophy, they always get the
 * dedicated swimlane engine when the graph being laid out is passed in.
 */
export function createLayoutEngine(
  philosophy: string,
  graph?: Pick<RenderGraph, 'diagramType'>,
): LayoutEngine {
  if (graph?.diagramType === 'sequenceDiagram') {
    return new SequenceLayout({ philosophy: philosophy as any })
  }
  switch (philosophy) {
    case 'narrative': return new NarrativeLayout()
    case 'blueprint': return new BlueprintLayout()
    default: return new DagreLayout({ philosophy: philosophy as any })
  }
}

export interface PipelineResult {
  success: boolean
  graph?: RenderGraph
  positioned?: PositionedGraph
  errors?: RenderError[]
  warnings?: RenderWarning[]
  linkStates?: Map<string, LinkState>
}

export class LoadPipeline {
  lastGraph: RenderGraph | null = null
  lastPositioned: PositionedGraph | null = null
  private loadId = 0

  async load(
    source: string,
    options?: { layout?: string; sourcePath?: string; linkResolver?: LinkResolver },
  ): Promise<PipelineResult> {
    const currentId = ++this.loadId

    const result = await buildGraph(source, {
      sourcePath: options?.sourcePath,
      linkResolver: options?.linkResolver,
    })

    // Check cancellation
    if (currentId !== this.loadId) {
      return { success: false, errors: [{ code: 'LOAD_CANCELLED', message: 'Superseded by newer load' }] }
    }

    if (!result.success || !result.graph) {
      return {
        success: false,
        errors: result.errors,
      }
    }

    // Determine philosophy from options or directive
    const layoutDir = result.graph.directives.find((d): d is LayoutDirective => d.type === 'layout')
    const philosophy = (options?.layout ?? layoutDir?.philosophy ?? 'narrative') as any

    // Layout
    const layout = createLayoutEngine(philosophy, result.graph)
    const positioned = layout.compute(result.graph)
    const warnings = [...(result.warnings ?? [])]

    if (
      result.graph.nodes.size > VERIFIED_INTERACTIVE_NODE_FLOOR
      || result.graph.edges.length > VERIFIED_INTERACTIVE_EDGE_FLOOR
    ) {
      warnings.push({
        code: 'PERF_STRESS_THRESHOLD',
        message: `Diagram exceeds the current verified interactive floor (~${VERIFIED_INTERACTIVE_NODE_FLOOR} nodes / ~${VERIFIED_INTERACTIVE_EDGE_FLOOR} edges). Interaction remains best-effort; prefer folding or cross-file links to keep views smaller.`,
      })
    }

    this.lastGraph = result.graph
    this.lastPositioned = positioned

    return {
      success: true,
      graph: result.graph,
      positioned,
      warnings,
      linkStates: result.linkStates,
    }
  }
}
