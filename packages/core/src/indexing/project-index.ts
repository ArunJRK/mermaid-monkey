import type {
  LinkDirective,
  LinkResolver,
  ProjectEdgeOccurrence,
  ProjectFileIndex,
  ProjectIndex,
  ProjectIndexError,
  ProjectIndexWarning,
  ProjectLinkOccurrence,
  ProjectNodeOccurrence,
  RenderEdge,
  RenderGraph,
} from '../types'
import { buildGraph } from '../parser/graph-builder'
import { createVirtualFileResolver, normalizeDiagramPath } from '../linking/virtual-file-resolver'

export interface ProjectIndexOptions {
  linkResolver?: LinkResolver
}

function normalizeProjectFilePath(path: string): string {
  const rooted = path.startsWith('/') ? path : `/${path}`
  return normalizeDiagramPath(rooted, '/') ?? rooted
}

function normalizeProjectFiles(files: Record<string, string> | Map<string, string>): Map<string, string> {
  const entries = files instanceof Map ? files.entries() : Object.entries(files)
  const normalized = new Map<string, string>()
  for (const [path, source] of entries) {
    normalized.set(normalizeProjectFilePath(path), source)
  }
  return normalized
}

function addMapEntry<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const values = map.get(key)
  if (values) {
    values.push(value)
    return
  }
  map.set(key, [value])
}

function edgeSignature(edge: Pick<RenderEdge, 'source' | 'target'>): string {
  return `${edge.source}->${edge.target}`
}

function getEntityKey(metadata: Record<string, unknown>): string | undefined {
  const entity = metadata.entity
  if (
    typeof entity === 'object' &&
    entity !== null &&
    'type' in entity &&
    'id' in entity
  ) {
    const typedEntity = entity as { type: unknown; id: unknown }
    if (typeof typedEntity.type === 'string' && typeof typedEntity.id === 'string') {
      return `${typedEntity.type}:${typedEntity.id}`
    }
  }
  return undefined
}

function indexGraph(
  index: ProjectIndex,
  file: string,
  graph: RenderGraph,
  linkStates: ProjectLinkOccurrence[],
): void {
  for (const node of graph.nodes.values()) {
    const entityKey = getEntityKey(node.metadata)
    const occurrence: ProjectNodeOccurrence = {
      file,
      nodeId: node.id,
      label: node.label,
      metadata: node.metadata,
      ...(entityKey ? { entityKey } : {}),
    }
    addMapEntry(index.nodesById, node.id, occurrence)
    if (entityKey) {
      addMapEntry(index.entities, entityKey, occurrence)
    }
  }

  for (const edge of graph.edges) {
    const occurrence: ProjectEdgeOccurrence = {
      file,
      edgeId: edge.id,
      source: edge.source,
      target: edge.target,
      metadata: edge.metadata ?? {},
      ...(edge.label ? { label: edge.label } : {}),
    }
    addMapEntry(index.edgesBySignature, edgeSignature(edge), occurrence)
  }

  index.links.push(...linkStates)
}

function mapWarnings(file: string, warnings: Array<{ code: string; message: string }>): ProjectIndexWarning[] {
  return warnings.map((warning) => ({
    ...warning,
    file,
  }))
}

function mapErrors(file: string, errors: Array<{ code: string; message: string }>): ProjectIndexError[] {
  return errors.map((error) => ({
    ...error,
    file,
  }))
}

function collectLinks(
  file: string,
  graph: RenderGraph,
  linkStates: Awaited<ReturnType<typeof buildGraph>>['linkStates'],
): ProjectLinkOccurrence[] {
  const links: ProjectLinkOccurrence[] = []
  for (const directive of graph.directives) {
    if (directive.type !== 'link') continue
    const link = directive as LinkDirective
    const state = linkStates?.get(link.nodeId)
    links.push({
      file,
      nodeId: link.nodeId,
      rawTargetFile: link.targetFile,
      targetNode: link.targetNode,
      status: state?.status ?? 'unvalidated',
      canonicalTargetFile: state?.canonicalTargetFile,
      reason: state?.reason,
      warningCode: state?.warningCode,
    })
  }
  return links
}

export async function buildProjectIndex(
  files: Record<string, string> | Map<string, string>,
  options: ProjectIndexOptions = {},
): Promise<ProjectIndex> {
  const normalizedFiles = normalizeProjectFiles(files)
  const linkResolver = options.linkResolver ?? createVirtualFileResolver(normalizedFiles)
  const index: ProjectIndex = {
    files: new Map<string, ProjectFileIndex>(),
    nodesById: new Map(),
    entities: new Map(),
    edgesBySignature: new Map(),
    links: [],
    warnings: [],
    errors: [],
  }

  for (const [file, source] of normalizedFiles) {
    const result = await buildGraph(source, {
      sourcePath: file,
      linkResolver,
    })
    const fileWarnings = mapWarnings(file, result.warnings)
    const fileErrors = mapErrors(file, result.errors)
    index.warnings.push(...fileWarnings)
    index.errors.push(...fileErrors)

    const fileIndex: ProjectFileIndex = {
      file,
      success: result.success,
      warnings: fileWarnings,
      errors: fileErrors,
      ...(result.graph ? { graph: result.graph } : {}),
    }
    index.files.set(file, fileIndex)

    if (result.success && result.graph) {
      indexGraph(index, file, result.graph, collectLinks(file, result.graph, result.linkStates))
    }
  }

  return index
}
