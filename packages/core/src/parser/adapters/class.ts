import type {
  DiagramType,
  Directive,
  EdgeStyle,
  RenderEdge,
  RenderGraph,
  RenderNode,
  RenderSubgraph,
} from '../../types'

type MermaidClassMember = {
  memberType?: string
  visibility?: string
  classifier?: string
  text?: string
  id?: string
  parameters?: string
  returnType?: string
}

type MermaidClassNode = {
  id?: string
  type?: string
  label?: string
  text?: string
  members?: MermaidClassMember[]
  methods?: MermaidClassMember[]
  annotations?: string[]
}

type MermaidClassRelation = {
  id1?: string
  id2?: string
  relation?: {
    type1?: string | number
    type2?: string | number
    lineType?: string | number
  }
  title?: string
  relationTitle1?: string
  relationTitle2?: string
}

interface NormalizedClassAttribute {
  name: string
  visibility: string
  classifier: string
  display: string
}

interface NormalizedClassMethod {
  name: string
  visibility: string
  classifier: string
  parameters: string
  returnType: string
  display: string
}

export interface ClassBuildInput {
  db: any
  direction: string
  diagramType: DiagramType
  directives: Directive[]
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

const CLASS_TEXT_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
}

function decodeClassTextEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const key = entity.toLowerCase()
    if (key.startsWith('#x')) {
      const codePoint = Number.parseInt(key.slice(2), 16)
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match
    }
    if (key.startsWith('#')) {
      const codePoint = Number.parseInt(key.slice(1), 10)
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match
    }
    return CLASS_TEXT_ENTITIES[key] ?? match
  })
}

function cleanClassText(value: unknown, fallback = ''): string {
  return decodeClassTextEntities(String(value ?? fallback))
    .replace(/\\([+\-#~])/g, '$1')
    .replace(/([A-Za-z_][\w.]*)~([^~]+)~/g, '$1<$2>')
    .replace(/~/g, '')
    .trim()
}

function stableIdPart(value: string | undefined, fallback: string): string {
  const base = value?.trim() || fallback
  return base.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_.-]/g, '_')
}

function normalizeDisplayWithVisibility(value: string, visibility: string): string {
  if (!visibility) return value
  return value.startsWith(visibility)
    ? `${visibility} ${value.slice(visibility.length).trim()}`
    : `${visibility} ${value}`.trim()
}

function normalizeAttribute(member: MermaidClassMember): NormalizedClassAttribute {
  const visibility = asString(member.visibility) ?? ''
  const classifier = asString(member.classifier) ?? ''
  const rawText = cleanClassText(member.text, asString(member.id) ?? 'attribute')
  const name = rawText.startsWith(visibility)
    ? rawText.slice(visibility.length).trim()
    : rawText

  return {
    name,
    visibility,
    classifier,
    display: normalizeDisplayWithVisibility(name, visibility),
  }
}

function normalizeMethod(member: MermaidClassMember): NormalizedClassMethod {
  const visibility = asString(member.visibility) ?? ''
  const classifier = asString(member.classifier) ?? ''
  const name = cleanClassText(member.id, 'method')
  const parameters = cleanClassText(member.parameters, '')
  const returnType = cleanClassText(member.returnType, '')
  const signature = `${name}(${parameters})${returnType ? `: ${returnType}` : ''}`

  return {
    name,
    visibility,
    classifier,
    parameters,
    returnType,
    display: normalizeDisplayWithVisibility(signature, visibility),
  }
}

function classKind(annotations: string[] | undefined): string {
  const normalized = (annotations ?? []).map((annotation) => annotation.toLowerCase())
  if (normalized.includes('interface')) return 'interface'
  if (normalized.includes('enum')) return 'enum'
  if (normalized.includes('abstract')) return 'abstract'
  return 'class'
}

function formatClassLabel(
  name: string,
  attributes: NormalizedClassAttribute[],
  methods: NormalizedClassMethod[],
): string {
  return [
    name,
    ...attributes.map((attribute) => attribute.display),
    ...methods.map((method) => method.display),
  ].join('\n')
}

function buildClassNode(id: string, classNode: MermaidClassNode): RenderNode {
  const attributes = (classNode.members ?? [])
    .filter((member) => member.memberType === 'attribute')
    .map(normalizeAttribute)
  const methods = (classNode.methods ?? [])
    .filter((member) => member.memberType === 'method')
    .map(normalizeMethod)
  const label = cleanClassText(classNode.label ?? classNode.text, id)
  const typeParameter = cleanClassText(classNode.type, '')
  const stereotypes = Array.isArray(classNode.annotations)
    ? classNode.annotations.filter((annotation): annotation is string => typeof annotation === 'string')
    : []

  return {
    id,
    label: formatClassLabel(label, attributes, methods),
    shape: 'subroutine',
    metadata: {
      diagramFamily: 'class',
      class: {
        kind: classKind(stereotypes),
        ...(typeParameter ? { typeParameter } : {}),
        ...(stereotypes.length > 0 ? { stereotypes } : {}),
        attributes,
        methods,
      },
    },
  }
}

function getClasses(db: any): Map<string, MermaidClassNode> {
  if (typeof db.getClasses !== 'function') return new Map()
  const classes = db.getClasses()
  if (classes instanceof Map) return classes
  return new Map(Object.entries(classes ?? {}) as Array<[string, MermaidClassNode]>)
}

function getRelations(db: any): MermaidClassRelation[] {
  return typeof db.getRelations === 'function' && Array.isArray(db.getRelations())
    ? db.getRelations()
    : []
}

function getClassDirection(db: any, fallback: string): string {
  return typeof db.getDirection === 'function'
    ? asString(db.getDirection()) ?? fallback
    : fallback
}

function markerName(value: unknown): string {
  switch (value) {
    case 0:
      return 'aggregation'
    case 1:
      return 'extension'
    case 2:
      return 'composition'
    case 3:
      return 'dependency'
    case 4:
      return 'lollipop'
    case 'none':
    case undefined:
    case null:
      return 'none'
    default:
      return String(value)
  }
}

function relationshipKind(sourceMarker: string, targetMarker: string, lineType: unknown): string {
  const markers = [sourceMarker, targetMarker]
  if (markers.includes('composition')) return 'composition'
  if (markers.includes('aggregation')) return 'aggregation'
  if (markers.includes('extension')) return lineType === 1 ? 'implementation' : 'inheritance'
  if (markers.includes('dependency')) return 'dependency'
  if (markers.includes('lollipop')) return 'interface'
  return 'association'
}

function edgeStyle(lineType: unknown, kind: string): EdgeStyle {
  if (lineType === 1 || kind === 'implementation') return 'dotted'
  return 'solid'
}

function buildClassEdge(relation: MermaidClassRelation, index: number): RenderEdge | null {
  const source = asString(relation.id1)
  const target = asString(relation.id2)
  if (!source || !target) return null

  const sourceMarker = markerName(relation.relation?.type1)
  const targetMarker = markerName(relation.relation?.type2)
  const kind = relationshipKind(sourceMarker, targetMarker, relation.relation?.lineType)
  const label = cleanClassText(relation.title, '')
  const idParts = [
    stableIdPart(source, `source${index}`),
    stableIdPart(target, `target${index}`),
    stableIdPart(kind, 'relationship'),
    stableIdPart(label, 'relationship'),
  ]

  return {
    id: `class:${idParts.join(':')}`,
    source,
    target,
    style: edgeStyle(relation.relation?.lineType, kind),
    ...(label ? { label } : {}),
    metadata: {
      diagramFamily: 'class',
      class: {
        kind: 'relationship',
        relationshipKind: kind,
        sourceMarker,
        targetMarker,
        lineType: relation.relation?.lineType === 1 ? 'dotted' : 'solid',
        ...(label ? { label } : {}),
      },
    },
  }
}

export function buildClassGraph(input: ClassBuildInput): RenderGraph {
  const { db, direction, diagramType, directives } = input
  const nodes = new Map<string, RenderNode>()
  const classes = getClasses(db)

  for (const [id, classNode] of classes) {
    nodes.set(id, buildClassNode(id, classNode))
  }

  const edges = getRelations(db)
    .map((relation, index) => buildClassEdge(relation, index))
    .filter((edge): edge is RenderEdge => edge !== null)

  for (const edge of edges) {
    if (!nodes.has(edge.source)) {
      nodes.set(edge.source, buildClassNode(edge.source, { id: edge.source, label: edge.source }))
    }
    if (!nodes.has(edge.target)) {
      nodes.set(edge.target, buildClassNode(edge.target, { id: edge.target, label: edge.target }))
    }
  }

  return {
    nodes,
    edges,
    subgraphs: new Map<string, RenderSubgraph>(),
    directives,
    direction: getClassDirection(db, direction),
    diagramType,
  }
}
