import type {
  LoadResult,
  RenderWarning,
  LinkDirective,
  LinkResolver,
  LinkState,
  RenderGraph,
} from '../types'
import { extractDirectives } from './directive-extractor'
import { parseMermaid } from './mermaid-adapter'
import { buildClassGraph } from './adapters/class'
import { buildC4Graph } from './adapters/c4'
import { buildErGraph } from './adapters/er'
import { buildFlowchartGraph } from './adapters/flowchart'
import { buildGanttGraph } from './adapters/gantt'
import { buildJourneyGraph } from './adapters/journey'
import { buildMindmapGraph } from './adapters/mindmap'
import { buildRequirementGraph } from './adapters/requirement'
import { buildSequenceGraph } from './adapters/sequence'
import { buildStateGraph } from './adapters/state'

function inferDeclaredDiagramType(source: string): string {
  const match = source.match(/^\s*([A-Za-z][A-Za-z0-9_-]*)/m)
  return match?.[1] ?? 'unknown'
}

/**
 * Full orchestrator: extract directives, parse mermaid, build graph, attach links.
 */
async function validateLinkTargets(
  graph: RenderGraph,
  linkResolver: LinkResolver,
  sourcePath: string,
  warnings: RenderWarning[],
): Promise<Map<string, LinkState>> {
  const linkStates = new Map<string, LinkState>()
  const targetGraphCache = new Map<string, RenderGraph | null>()

  for (const directive of graph.directives) {
    if (directive.type !== 'link') continue

    const link = directive as LinkDirective
    const canonicalTargetFile = await linkResolver.canonicalize(link.targetFile, sourcePath)

    if (!canonicalTargetFile) {
      const reason = `Link target "${link.targetFile}" is outside the configured resolver scope`
      warnings.push({
        code: 'LINK_TARGET_OUT_OF_SCOPE',
        message: `${reason} (node "${link.nodeId}")`,
      })
      linkStates.set(link.nodeId, {
        nodeId: link.nodeId,
        rawTargetFile: link.targetFile,
        targetNode: link.targetNode,
        status: 'broken',
        reason,
        warningCode: 'LINK_TARGET_OUT_OF_SCOPE',
      })
      continue
    }

    const targetSource = await linkResolver.read(canonicalTargetFile)
    if (targetSource == null) {
      const reason = `Linked Mermaid file not found: ${canonicalTargetFile}`
      warnings.push({
        code: 'LINK_TARGET_NOT_FOUND',
        message: `${reason} (node "${link.nodeId}")`,
      })
      linkStates.set(link.nodeId, {
        nodeId: link.nodeId,
        rawTargetFile: link.targetFile,
        targetNode: link.targetNode,
        canonicalTargetFile,
        status: 'broken',
        reason,
        warningCode: 'LINK_TARGET_NOT_FOUND',
      })
      continue
    }

    if (link.targetNode) {
      if (!targetGraphCache.has(canonicalTargetFile)) {
        const targetResult = await buildGraph(targetSource)
        targetGraphCache.set(
          canonicalTargetFile,
          targetResult.success && targetResult.graph ? targetResult.graph : null,
        )
      }

      const targetGraph = targetGraphCache.get(canonicalTargetFile)
      if (!targetGraph?.nodes.has(link.targetNode)) {
        const reason = `Linked node "${link.targetNode}" was not found in ${canonicalTargetFile}`
        warnings.push({
          code: 'LINK_TARGET_NODE_NOT_FOUND',
          message: `${reason} (node "${link.nodeId}")`,
        })
        linkStates.set(link.nodeId, {
          nodeId: link.nodeId,
          rawTargetFile: link.targetFile,
          targetNode: link.targetNode,
          canonicalTargetFile,
          status: 'broken',
          reason,
          warningCode: 'LINK_TARGET_NODE_NOT_FOUND',
        })
        continue
      }
    }

    linkStates.set(link.nodeId, {
      nodeId: link.nodeId,
      rawTargetFile: link.targetFile,
      targetNode: link.targetNode,
      canonicalTargetFile,
      status: 'valid',
    })
  }

  return linkStates
}

export async function buildGraph(
  source: string,
  options?: { sourcePath?: string; linkResolver?: LinkResolver },
): Promise<LoadResult> {
  // Step 1: Extract directives from source
  const { directives, cleanedSource, warnings: extractionWarnings } = extractDirectives(source)

  // Step 2: Parse with mermaid
  let parseResult
  try {
    parseResult = await parseMermaid(cleanedSource)
  } catch (err: any) {
    return {
      success: false,
      errors: [
        {
          code: 'PARSE_FAILED',
          message: err?.message ?? String(err),
        },
      ],
      warnings: [],
    }
  }

  // Step 3: Build graph via family adapter
  const { diagramType, db, direction } = parseResult
  let graph: RenderGraph

  if (diagramType === 'flowchart') {
    graph = buildFlowchartGraph({
      db,
      direction,
      diagramType,
      directives,
    })
  } else if (diagramType === 'erDiagram') {
    graph = buildErGraph({
      db,
      direction,
      diagramType,
      directives,
    })
  } else if (diagramType === 'classDiagram') {
    graph = buildClassGraph({
      db,
      direction,
      diagramType,
      directives,
    })
  } else if (diagramType === 'stateDiagram') {
    graph = buildStateGraph({
      db,
      direction,
      diagramType,
      directives,
    })
  } else if (diagramType === 'sequenceDiagram') {
    graph = buildSequenceGraph({ db, diagramType, directives })
  } else if (diagramType === 'c4') {
    graph = buildC4Graph({ db, diagramType, directives })
  } else if (diagramType === 'requirementDiagram') {
    graph = buildRequirementGraph({ db, diagramType, directives })
  } else if (diagramType === 'mindmap') {
    graph = buildMindmapGraph({ db, diagramType, directives })
  } else if (diagramType === 'gantt') {
    graph = buildGanttGraph({ db, diagramType, directives })
  } else if (diagramType === 'journey') {
    graph = buildJourneyGraph({ db, diagramType, directives })
  } else {
    const declaredDiagramType =
      diagramType === 'unknown' ? inferDeclaredDiagramType(cleanedSource) : diagramType
    return {
      success: false,
      errors: [
        {
          code: 'UNSUPPORTED_DIAGRAM_TYPE',
          message: `Unsupported Mermaid diagram type "${declaredDiagramType}". Mermaid Monkey supports flowchart, erDiagram, classDiagram, stateDiagram, sequenceDiagram, C4, requirementDiagram, mindmap, Gantt, and journey.`,
        },
      ],
      warnings: [...extractionWarnings],
    }
  }

  // Step 4: Validate link directives against graph nodes
  const warnings: RenderWarning[] = [...extractionWarnings]
  for (const d of directives) {
    if (d.type === 'link') {
      const linkDir = d as LinkDirective
      if (!graph.nodes.has(linkDir.nodeId)) {
        warnings.push({
          code: 'LINK_NODE_NOT_FOUND',
          message: `@link references unknown node "${linkDir.nodeId}"`,
        })
      }
    }
    if (d.type === 'entity' && !graph.nodes.has(d.nodeId)) {
      warnings.push({
        code: 'ENTITY_NODE_NOT_FOUND',
        message: `@entity references unknown node "${d.nodeId}"`,
      })
    }
    if (
      d.type === 'edge' &&
      !graph.edges.some((edge) => edge.source === d.source && edge.target === d.target)
    ) {
      warnings.push({
        code: 'EDGE_TARGET_NOT_FOUND',
        message: `@edge references unknown edge "${d.source} -> ${d.target}"`,
      })
    }
  }

  let linkStates: Map<string, LinkState> | undefined
  if (options?.linkResolver && options.sourcePath) {
    linkStates = await validateLinkTargets(graph, options.linkResolver, options.sourcePath, warnings)
  }

  return {
    success: true,
    graph,
    errors: [],
    warnings,
    linkStates,
  }
}
