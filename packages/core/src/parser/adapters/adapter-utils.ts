import type { EdgeStyle, RenderEdge, RenderNode } from '../../types'

export type MermaidDb = Record<string, unknown>

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

export function textValue(value: unknown, fallback = ''): string {
  const record = asRecord(value)
  return asString(record.text, asString(value, fallback)).trim()
}

export function callDb(db: MermaidDb, name: string): unknown {
  const method = db[name]
  return typeof method === 'function' ? method.call(db) : undefined
}

export function mapEntries(value: unknown): Array<[string, Record<string, unknown>]> {
  if (value instanceof Map) {
    return [...value.entries()].map(([key, item]) => [String(key), asRecord(item)])
  }
  return Object.entries(asRecord(value)).map(([key, item]) => [key, asRecord(item)])
}

export function makeNode(
  id: string,
  label: string,
  family: string,
  metadata: Record<string, unknown>,
  shape: RenderNode['shape'] = 'rounded',
): RenderNode {
  return {
    id,
    label: label || id,
    shape,
    metadata: { diagramFamily: family, [family]: metadata },
  }
}

export function makeEdge(input: {
  id: string
  source: string
  target: string
  family: string
  metadata: Record<string, unknown>
  label?: string
  style?: EdgeStyle
}): RenderEdge {
  return {
    id: input.id,
    source: input.source,
    target: input.target,
    style: input.style ?? 'solid',
    ...(input.label ? { label: input.label } : {}),
    metadata: { diagramFamily: input.family, [input.family]: input.metadata },
  }
}

export function stablePart(value: unknown, fallback: string): string {
  const normalized = asString(value, fallback)
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_.:-]/g, '')
  return normalized || fallback
}
