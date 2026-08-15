import { measureTextWidth } from './layout/text-measure'

const CLASS_MIN_WIDTH = 260
const CLASS_MIN_HEIGHT = 58
const CLASS_MAX_WIDTH = 760
const HEADER_HEIGHT = 38
const ROW_HEIGHT = 22
const SECTION_HEADER_HEIGHT = 18
const PADDING_X = 12

type MetadataRecord = Record<string, unknown>

interface ClassMetadata {
  kind?: unknown
  typeParameter?: unknown
  stereotypes?: unknown
  attributes?: unknown
  methods?: unknown
}

interface RawClassMember {
  display?: unknown
  name?: unknown
  visibility?: unknown
  classifier?: unknown
  parameters?: unknown
  returnType?: unknown
}

interface ClassCompartmentNode {
  id?: string
  label: string
  metadata?: Record<string, unknown>
  width?: number
  height?: number
}

export interface ClassCompartmentRow {
  text: string
  visibility: string
  classifier: string
}

export interface ClassCompartmentSection {
  title: string
  kind: 'attributes' | 'methods'
  rows: ClassCompartmentRow[]
  top: number
  height: number
}

export interface ClassCompartmentLayout {
  className: string
  kind: string
  stereotypeLabel: string
  sections: ClassCompartmentSection[]
  width: number
  height: number
  headerHeight: number
  rowHeight: number
  sectionHeaderHeight: number
  paddingX: number
}

function asRecord(value: unknown): MetadataRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as MetadataRecord
    : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function getClassMetadata(node: { metadata?: unknown }): ClassMetadata | null {
  const metadata = asRecord(node.metadata)
  if (!metadata || metadata.diagramFamily !== 'class') return null

  const classMetadata = asRecord(metadata.class) as ClassMetadata | null
  if (!classMetadata) return null
  return classMetadata
}

function rowText(member: RawClassMember, kind: 'attributes' | 'methods'): string | null {
  const explicitDisplay = asString(member.display)
  if (explicitDisplay) return explicitDisplay

  const name = asString(member.name)
  if (!name) return null

  const visibility = asString(member.visibility) ?? ''
  if (kind === 'methods') {
    const parameters = asString(member.parameters) ?? ''
    const returnType = asString(member.returnType)
    return `${visibility ? `${visibility} ` : ''}${name}(${parameters})${returnType ? `: ${returnType}` : ''}`
  }
  return `${visibility ? `${visibility} ` : ''}${name}`
}

function normalizeRows(value: unknown, kind: 'attributes' | 'methods'): ClassCompartmentRow[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => asRecord(entry) as RawClassMember | null)
    .filter((entry): entry is RawClassMember => entry !== null)
    .map((entry) => ({
      text: rowText(entry, kind) ?? '',
      visibility: asString(entry.visibility) ?? '',
      classifier: asString(entry.classifier) ?? '',
    }))
    .filter((entry) => entry.text.length > 0)
}

function stereotypeLabel(classMetadata: ClassMetadata): string {
  if (!Array.isArray(classMetadata.stereotypes)) return ''
  const stereotypes = classMetadata.stereotypes
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
  return stereotypes.length > 0 ? `<<${stereotypes.join(', ')}>>` : ''
}

export function computeClassCompartmentLayout(
  node: ClassCompartmentNode,
  monospace: boolean = false,
): ClassCompartmentLayout | null {
  const classMetadata = getClassMetadata(node)
  if (!classMetadata) return null

  const className = node.label.split(/\r?\n/, 1)[0]?.trim() || node.id || 'Class'
  const kind = asString(classMetadata.kind) ?? 'class'
  const stereotype = stereotypeLabel(classMetadata)
  const attributes = normalizeRows(classMetadata.attributes, 'attributes')
  const methods = normalizeRows(classMetadata.methods, 'methods')
  const sections: ClassCompartmentSection[] = []
  let cursor = HEADER_HEIGHT

  for (const [title, sectionKind, rows] of [
    ['Attributes', 'attributes', attributes],
    ['Methods', 'methods', methods],
  ] as const) {
    if (rows.length === 0) continue
    const height = SECTION_HEADER_HEIGHT + rows.length * ROW_HEIGHT
    sections.push({
      title,
      kind: sectionKind,
      rows,
      top: cursor,
      height,
    })
    cursor += height
  }

  const rowWidth = Math.max(0, ...sections.flatMap((section) => (
    [
      measureTextWidth(section.title, 10, monospace),
      ...section.rows.map((row) => measureTextWidth(row.text, 12, monospace)),
    ]
  )))
  const headerWidth = Math.max(
    measureTextWidth(className, 15, monospace),
    stereotype ? measureTextWidth(stereotype, 10, monospace) : 0,
  )
  const width = Math.ceil(Math.max(
    node.width ?? 0,
    CLASS_MIN_WIDTH,
    Math.min(CLASS_MAX_WIDTH, Math.max(headerWidth, rowWidth) + PADDING_X * 2),
  ))
  const height = Math.ceil(Math.max(
    node.height ?? 0,
    CLASS_MIN_HEIGHT,
    cursor,
  ))

  return {
    className,
    kind,
    stereotypeLabel: stereotype,
    sections,
    width,
    height,
    headerHeight: HEADER_HEIGHT,
    rowHeight: ROW_HEIGHT,
    sectionHeaderHeight: SECTION_HEADER_HEIGHT,
    paddingX: PADDING_X,
  }
}
