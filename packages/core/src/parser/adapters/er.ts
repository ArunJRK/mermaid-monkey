import type {
  DiagramType,
  Directive,
  EdgeStyle,
  RenderEdge,
  RenderGraph,
  RenderNode,
  RenderSubgraph,
} from '../../types'

interface MermaidErAttribute {
  attributeType?: string
  attributeName?: string
  attributeKeyTypeList?: string[]
}

interface MermaidErEntity {
  alias?: string
  attributes?: MermaidErAttribute[]
}

interface MermaidErRelationship {
  entityA?: string
  entityB?: string
  roleA?: string
  relSpec?: {
    cardA?: string
    cardB?: string
    relType?: string
  }
}

interface NormalizedErAttribute {
  type: string
  name: string
  keys: string[]
}

export interface ErBuildInput {
  db: any
  direction: string
  diagramType: DiagramType
  directives: Directive[]
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function stableIdPart(value: string | undefined, fallback: string): string {
  const base = value?.trim() || fallback
  return base.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_.-]/g, '_')
}

function cardinalityLabel(cardinality: string | undefined): string {
  switch (cardinality) {
    case 'ONLY_ONE':
      return '1'
    case 'ZERO_OR_ONE':
      return '0..1'
    case 'ONE_OR_MORE':
      return '1..*'
    case 'ZERO_OR_MORE':
      return '0..*'
    default:
      return '?'
  }
}

function normalizeAttributes(attributes: MermaidErAttribute[] | undefined): NormalizedErAttribute[] {
  if (!Array.isArray(attributes)) return []

  return attributes
    .map((attribute) => ({
      type: asString(attribute.attributeType) ?? 'unknown',
      name: asString(attribute.attributeName) ?? 'unknown',
      keys: Array.isArray(attribute.attributeKeyTypeList)
        ? attribute.attributeKeyTypeList.filter((key): key is string => typeof key === 'string')
        : [],
    }))
    .filter((attribute) => attribute.name.length > 0)
}

function formatEntityLabel(id: string, entity: MermaidErEntity | undefined, attributes: NormalizedErAttribute[]): string {
  const header = asString(entity?.alias) ?? id
  if (attributes.length === 0) return header

  const rows = attributes.map((attribute) => {
    const suffix = attribute.keys.length > 0 ? ` ${attribute.keys.join(' ')}` : ''
    return `${attribute.name}: ${attribute.type}${suffix}`
  })
  return [header, ...rows].join('\n')
}

function buildEntityNode(id: string, entity?: MermaidErEntity): RenderNode {
  const attributes = normalizeAttributes(entity?.attributes)
  return {
    id,
    label: formatEntityLabel(id, entity, attributes),
    shape: 'subroutine',
    metadata: {
      diagramFamily: 'er',
      er: {
        kind: 'entity',
        attributes,
        ...(entity?.alias ? { alias: entity.alias } : {}),
      },
    },
  }
}

function getEntities(db: any): Map<string, MermaidErEntity> {
  if (typeof db.getEntities !== 'function') return new Map()
  const entities = db.getEntities()
  if (entities instanceof Map) return entities
  return new Map(Object.entries(entities ?? {}) as Array<[string, MermaidErEntity]>)
}

function getRelationships(db: any): MermaidErRelationship[] {
  return typeof db.getRelationships === 'function' && Array.isArray(db.getRelationships())
    ? db.getRelationships()
    : []
}

function getErDirection(db: any, fallback: string): string {
  if (typeof db.getConfig !== 'function') return fallback
  const config = db.getConfig()
  return asString(config?.layoutDirection) ?? fallback
}

function buildRelationshipEdge(relationship: MermaidErRelationship, index: number): RenderEdge | null {
  const source = asString(relationship.entityA)
  const target = asString(relationship.entityB)
  if (!source || !target) return null

  const role = asString(relationship.roleA)
  const rawCardA = asString(relationship.relSpec?.cardA)
  const rawCardB = asString(relationship.relSpec?.cardB)
  // Mermaid's ER DB exposes cardA/cardB from the rendered endpoint notation,
  // which is opposite the source/target naming a reviewer expects. Normalize
  // these before exposing semantic metadata or stable edge ids.
  const sourceCardinality = rawCardB
  const targetCardinality = rawCardA
  const relType = asString(relationship.relSpec?.relType)
  const cardinality = `${cardinalityLabel(sourceCardinality)} -> ${cardinalityLabel(targetCardinality)}`
  const idParts = [
    stableIdPart(source, `source${index}`),
    stableIdPart(target, `target${index}`),
    stableIdPart(role, 'relationship'),
    stableIdPart(sourceCardinality, 'unknown'),
    stableIdPart(targetCardinality, 'unknown'),
    stableIdPart(relType, 'unknown'),
  ]
  const style: EdgeStyle = relType === 'NON_IDENTIFYING' ? 'dotted' : 'solid'

  return {
    id: `er:${idParts.join(':')}`,
    source,
    target,
    style,
    label: role ?? cardinality,
    metadata: {
      diagramFamily: 'er',
      er: {
        kind: 'relationship',
        ...(role ? { role } : {}),
        cardinality,
        ...(sourceCardinality ? { sourceCardinality } : {}),
        ...(targetCardinality ? { targetCardinality } : {}),
        ...(rawCardA ? { rawCardA } : {}),
        ...(rawCardB ? { rawCardB } : {}),
        ...(relType ? { relType } : {}),
      },
    },
  }
}

export function buildErGraph(input: ErBuildInput): RenderGraph {
  const { db, direction, diagramType, directives } = input
  const nodes = new Map<string, RenderNode>()
  const entities = getEntities(db)

  for (const [id, entity] of entities) {
    nodes.set(id, buildEntityNode(id, entity))
  }

  const edges = getRelationships(db)
    .map((relationship, index) => buildRelationshipEdge(relationship, index))
    .filter((edge): edge is RenderEdge => edge !== null)

  for (const edge of edges) {
    if (!nodes.has(edge.source)) {
      nodes.set(edge.source, buildEntityNode(edge.source))
    }
    if (!nodes.has(edge.target)) {
      nodes.set(edge.target, buildEntityNode(edge.target))
    }
  }

  return {
    nodes,
    edges,
    subgraphs: new Map<string, RenderSubgraph>(),
    directives,
    direction: getErDirection(db, direction),
    diagramType,
  }
}
