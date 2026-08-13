import { measureTextWidth } from './layout/text-measure'

const TABLE_MIN_WIDTH = 240
const TABLE_MIN_HEIGHT = 58
const TABLE_MAX_WIDTH = 680
const HEADER_HEIGHT = 32
const ROW_HEIGHT = 24
const PADDING_X = 12
const NAME_TYPE_GAP = 18
const TYPE_LEFT_GAP = 10
const MIN_NAME_COLUMN_WIDTH = 92
const MIN_TYPE_COLUMN_WIDTH = 58
const MIN_KEY_COLUMN_WIDTH = 18

type MetadataRecord = Record<string, unknown>

interface ErMetadata {
  kind?: unknown
  alias?: unknown
  attributes?: unknown
}

interface RawErAttribute {
  name?: unknown
  type?: unknown
  keys?: unknown
}

export interface ErTableAttributeRow {
  name: string
  type: string
  keys: string[]
  keyLabel: string
  isPrimaryKey: boolean
  isForeignKey: boolean
}

export interface ErEntityTableLayout {
  entityName: string
  rows: ErTableAttributeRow[]
  width: number
  height: number
  headerHeight: number
  rowHeight: number
  paddingX: number
  keyColumnWidth: number
  nameColumnWidth: number
  typeColumnWidth: number
  nameColumnLeft: number
  typeDividerLeft: number
  typeColumnLeft: number
}

interface ErTableNode {
  id?: string
  label: string
  metadata?: Record<string, unknown>
  width?: number
  height?: number
}

function asRecord(value: unknown): MetadataRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as MetadataRecord
    : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function normalizeKey(value: string): string {
  return value.trim().replace(/,$/, '').toUpperCase()
}

function normalizeKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const keys = value
    .map((key) => (typeof key === 'string' ? normalizeKey(key) : ''))
    .filter((key) => key.length > 0)
  return [...new Set(keys)]
}

function normalizeAttribute(value: unknown): ErTableAttributeRow | null {
  const attribute = asRecord(value) as RawErAttribute | null
  if (!attribute) return null

  const name = asString(attribute.name)
  if (!name) return null

  const type = asString(attribute.type) ?? 'unknown'
  const keys = normalizeKeys(attribute.keys)
  const keyLabel = keys.join('/')
  return {
    name,
    type,
    keys,
    keyLabel,
    isPrimaryKey: keys.includes('PK'),
    isForeignKey: keys.includes('FK'),
  }
}

function getErMetadata(node: { metadata?: unknown }): ErMetadata | null {
  const metadata = asRecord(node.metadata)
  if (!metadata || metadata.diagramFamily !== 'er') return null

  const er = asRecord(metadata.er) as ErMetadata | null
  if (!er || er.kind !== 'entity') return null
  return er
}

export function isErEntityNode(node: { metadata?: unknown }): boolean {
  return getErMetadata(node) !== null
}

export function computeErEntityTableLayout(
  node: ErTableNode,
  monospace: boolean = false,
): ErEntityTableLayout | null {
  const er = getErMetadata(node)
  if (!er) return null

  const entityName = asString(er.alias)
    ?? node.label.split(/\r?\n/, 1)[0]?.trim()
    ?? node.id
    ?? 'Entity'
  const rows = Array.isArray(er.attributes)
    ? er.attributes.map(normalizeAttribute).filter((row): row is ErTableAttributeRow => row !== null)
    : []

  const headerWidth = measureTextWidth(entityName, 15, monospace)
  const keyTextWidth = Math.max(0, ...rows.map((row) => measureTextWidth(row.keyLabel, 10, monospace)))
  const nameTextWidth = Math.max(0, ...rows.map((row) => measureTextWidth(row.name, 13, monospace)))
  const typeTextWidth = Math.max(0, ...rows.map((row) => measureTextWidth(row.type, 12, monospace)))

  const keyColumnWidth = rows.some((row) => row.keyLabel.length > 0)
    ? Math.max(MIN_KEY_COLUMN_WIDTH, Math.ceil(keyTextWidth + 18))
    : MIN_KEY_COLUMN_WIDTH
  const nameColumnWidth = Math.max(MIN_NAME_COLUMN_WIDTH, Math.ceil(nameTextWidth))
  const typeColumnWidth = Math.max(MIN_TYPE_COLUMN_WIDTH, Math.ceil(typeTextWidth))
  const contentWidth = PADDING_X * 2
    + keyColumnWidth
    + nameColumnWidth
    + NAME_TYPE_GAP
    + TYPE_LEFT_GAP
    + typeColumnWidth
  const width = Math.ceil(Math.max(
    node.width ?? 0,
    TABLE_MIN_WIDTH,
    Math.min(TABLE_MAX_WIDTH, contentWidth),
    Math.min(TABLE_MAX_WIDTH, headerWidth + PADDING_X * 2),
  ))
  const height = Math.ceil(Math.max(
    node.height ?? 0,
    TABLE_MIN_HEIGHT,
    HEADER_HEIGHT + rows.length * ROW_HEIGHT,
  ))
  const typeColumnLeft = width - PADDING_X - typeColumnWidth

  return {
    entityName,
    rows,
    width,
    height,
    headerHeight: HEADER_HEIGHT,
    rowHeight: ROW_HEIGHT,
    paddingX: PADDING_X,
    keyColumnWidth,
    nameColumnWidth,
    typeColumnWidth,
    nameColumnLeft: PADDING_X + keyColumnWidth,
    typeDividerLeft: typeColumnLeft - TYPE_LEFT_GAP,
    typeColumnLeft,
  }
}
