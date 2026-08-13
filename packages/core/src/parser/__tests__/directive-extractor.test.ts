import { describe, it, expect } from 'vitest'
import { extractDirectives } from '../directive-extractor'
import type {
  LinkDirective,
  EntityDirective,
  EdgeDirective,
  FileDirective,
  LensDirective,
  LayoutDirective,
  PinDirective,
  RankDirective,
  SpacingDirective,
} from '../../types'

describe('extractDirectives', () => {
  it('extracts @link directive with full path and fragment', () => {
    const source = `%% @link authService -> /services/auth/flow.mmd#loginNode
graph TD
    authService[Auth Service] --> db[Database]`

    const result = extractDirectives(source)

    expect(result.directives).toHaveLength(1)
    const d = result.directives[0] as LinkDirective
    expect(d.type).toBe('link')
    expect(d.nodeId).toBe('authService')
    expect(d.targetFile).toBe('/services/auth/flow.mmd')
    expect(d.targetNode).toBe('loginNode')
    expect(result.cleanedSource).not.toContain('@link')
    expect(result.cleanedSource).toContain('graph TD')
  })

  it('extracts @link without fragment', () => {
    const source = `%% @link nodeA -> /services/overview.mmd
graph TD
    nodeA[Service]`

    const result = extractDirectives(source)

    expect(result.directives).toHaveLength(1)
    const d = result.directives[0] as LinkDirective
    expect(d.type).toBe('link')
    expect(d.targetFile).toBe('/services/overview.mmd')
    expect(d.targetNode).toBeUndefined()
  })

  it('extracts multiple directive types', () => {
    const source = `%% @link A -> /a.mmd#x
%% @layout blueprint
%% @pin B 200 150
%% @rank C D E
%% @spacing 1.5
graph TD
    A --> B --> C`

    const result = extractDirectives(source)

    expect(result.directives).toHaveLength(5)

    const link = result.directives[0] as LinkDirective
    expect(link.type).toBe('link')
    expect(link.nodeId).toBe('A')
    expect(link.targetFile).toBe('/a.mmd')
    expect(link.targetNode).toBe('x')

    const layout = result.directives[1] as LayoutDirective
    expect(layout.type).toBe('layout')
    expect(layout.philosophy).toBe('blueprint')

    const pin = result.directives[2] as PinDirective
    expect(pin.type).toBe('pin')
    expect(pin.nodeId).toBe('B')
    expect(pin.x).toBe(200)
    expect(pin.y).toBe(150)

    const rank = result.directives[3] as RankDirective
    expect(rank.type).toBe('rank')
    expect(rank.nodeIds).toEqual(['C', 'D', 'E'])

    const spacing = result.directives[4] as SpacingDirective
    expect(spacing.type).toBe('spacing')
    expect(spacing.nodeSpacing).toBe(1.5)
  })

  it('preserves regular mermaid comments (not directives)', () => {
    const source = `%% This is a normal comment
graph TD
    A --> B`

    const result = extractDirectives(source)

    expect(result.directives).toHaveLength(0)
    expect(result.cleanedSource).toContain('%% This is a normal comment')
  })

  it('returns empty directives for plain mermaid', () => {
    const source = `graph TD
    A[Hello] --> B[World]`

    const result = extractDirectives(source)

    expect(result.directives).toHaveLength(0)
    expect(result.cleanedSource).toBe(source)
  })

  it('surfaces malformed @link directives as warnings', () => {
    const source = `%% @link broken ->>
graph TD
    A --> B`

    const result = extractDirectives(source)

    expect(result.directives).toHaveLength(0)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].code).toBe('LINK_DIRECTIVE_INVALID')
  })

  it('extracts semantic directives and key-value metadata', () => {
    const source = `%% @file domain=topology title="Product topology"
%% @entity view_builder spec:view-builder domain=transform tags=transform,risk
%% @edge view_builder -> audit_logs ref=R9 status=unpinned severity=critical kind=tenant-isolation reviewed
%% @lens risk include=status:unpinned,severity:critical
flowchart LR
    view_builder[view-builder] -.-> audit_logs[audit-logs]`

    const result = extractDirectives(source)

    expect(result.directives).toHaveLength(4)
    const file = result.directives[0] as FileDirective
    expect(file).toMatchObject({
      type: 'file',
      metadata: {
        domain: 'topology',
        title: 'Product topology',
      },
    })

    const entity = result.directives[1] as EntityDirective
    expect(entity).toMatchObject({
      type: 'entity',
      nodeId: 'view_builder',
      entityType: 'spec',
      entityId: 'view-builder',
      metadata: {
        domain: 'transform',
        tags: ['transform', 'risk'],
      },
    })

    const edge = result.directives[2] as EdgeDirective
    expect(edge).toMatchObject({
      type: 'edge',
      source: 'view_builder',
      target: 'audit_logs',
      metadata: {
        ref: 'R9',
        status: 'unpinned',
        severity: 'critical',
        kind: 'tenant-isolation',
        reviewed: true,
      },
    })

    const lens = result.directives[3] as LensDirective
    expect(lens).toMatchObject({
      type: 'lens',
      name: 'risk',
      metadata: {
        include: ['status:unpinned', 'severity:critical'],
      },
    })
    expect(result.cleanedSource).not.toContain('@entity')
    expect(result.cleanedSource).toContain('flowchart LR')
  })

  it('surfaces malformed semantic directives as warnings', () => {
    const source = `%% @entity missingKindRef
%% @edge A -x B
%% @lens
graph TD
    A --> B`

    const result = extractDirectives(source)

    expect(result.directives).toHaveLength(0)
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      'ENTITY_DIRECTIVE_INVALID',
      'EDGE_DIRECTIVE_INVALID',
      'LENS_DIRECTIVE_INVALID',
    ])
  })
})
