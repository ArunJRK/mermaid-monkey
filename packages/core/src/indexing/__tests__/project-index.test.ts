import { describe, expect, it } from 'vitest'
import { buildProjectIndex } from '../project-index'

describe('buildProjectIndex', () => {
  it('indexes nodes, semantic entities, edges, and cross-file links', async () => {
    const index = await buildProjectIndex({
      '/topology/main.mmd': `%% @file domain=topology title="Product topology"
%% @link view_builder -> ./transform#view_builder
%% @entity view_builder spec:view-builder domain=transform tags=transform,risk
%% @edge view_builder -> audit_logs ref=R9 status=unpinned severity=critical
flowchart LR
    view_builder[view-builder] -.->|R9| audit_logs[audit-logs]`,
      '/topology/transform.mmd': `%% @entity view_builder spec:view-builder domain=transform
flowchart TD
    view_builder[view-builder] --> auto_view_builder[auto-view-builder]`,
    })

    expect(index.files.size).toBe(2)
    expect(index.errors).toEqual([])
    expect(index.nodesById.get('view_builder')).toHaveLength(2)
    expect(index.entities.get('spec:view-builder')).toHaveLength(2)

    const seam = index.edgesBySignature.get('view_builder->audit_logs')![0]
    expect(seam).toMatchObject({
      file: '/topology/main.mmd',
      source: 'view_builder',
      target: 'audit_logs',
      metadata: {
        ref: 'R9',
        status: 'unpinned',
        severity: 'critical',
      },
    })

    expect(index.links).toHaveLength(1)
    expect(index.links[0]).toMatchObject({
      file: '/topology/main.mmd',
      nodeId: 'view_builder',
      canonicalTargetFile: '/topology/transform.mmd',
      targetNode: 'view_builder',
      status: 'valid',
    })
  })

  it('keeps file-scoped warnings and indexes successful files when another file fails', async () => {
    const index = await buildProjectIndex({
      '/good.mmd': `%% @entity missing spec:missing
graph TD
    A --> B`,
      '/bad.mmd': 'this is not mermaid',
    })

    expect(index.files.get('/good.mmd')!.success).toBe(true)
    expect(index.files.get('/bad.mmd')!.success).toBe(false)
    expect(index.nodesById.get('A')).toHaveLength(1)
    expect(index.warnings).toContainEqual(expect.objectContaining({
      file: '/good.mmd',
      code: 'ENTITY_NODE_NOT_FOUND',
    }))
    expect(index.errors).toContainEqual(expect.objectContaining({
      file: '/bad.mmd',
      code: 'PARSE_FAILED',
    }))
  })

  it('reports unsupported diagram types as a file-scoped error instead of crashing', async () => {
    const index = await buildProjectIndex({
      '/pie.mmd': `pie title Pets\n"Dogs" : 4`,
    })

    expect(index.files.get('/pie.mmd')!.success).toBe(false)
    expect(index.errors).toContainEqual(expect.objectContaining({
      file: '/pie.mmd',
      code: 'UNSUPPORTED_DIAGRAM_TYPE',
    }))
    expect(index.nodesById.size).toBe(0)
  })

  it('surfaces malformed semantic directives as file-scoped warnings', async () => {
    const index = await buildProjectIndex({
      '/malformed.mmd': `%% @entity missingKindRef
%% @edge A -x B
graph TD
    A --> B`,
    })

    expect(index.files.get('/malformed.mmd')!.success).toBe(true)
    expect(index.warnings).toContainEqual(expect.objectContaining({
      file: '/malformed.mmd',
      code: 'ENTITY_DIRECTIVE_INVALID',
    }))
    expect(index.warnings).toContainEqual(expect.objectContaining({
      file: '/malformed.mmd',
      code: 'EDGE_DIRECTIVE_INVALID',
    }))
  })

  it('records a dangling cross-file link as a broken, file-scoped warning', async () => {
    const index = await buildProjectIndex({
      '/main.mmd': `%% @link a -> ./nowhere
graph TD
    a[A]`,
    })

    expect(index.warnings).toContainEqual(expect.objectContaining({
      file: '/main.mmd',
      code: 'LINK_TARGET_NOT_FOUND',
    }))
    expect(index.links).toHaveLength(1)
    expect(index.links[0]).toMatchObject({
      file: '/main.mmd',
      nodeId: 'a',
      status: 'broken',
      warningCode: 'LINK_TARGET_NOT_FOUND',
    })
  })
})
