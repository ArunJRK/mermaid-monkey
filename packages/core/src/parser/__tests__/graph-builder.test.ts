import { describe, it, expect } from 'vitest'
import { buildGraph } from '../graph-builder'
import { createVirtualFileResolver } from '../../linking/virtual-file-resolver'
import type { LoadResult } from '../../types'

describe('buildGraph', () => {
  it('parses a simple flowchart with 2 nodes and 1 edge', async () => {
    const source = `graph TD
    A[Hello] --> B[World]`

    const result: LoadResult = await buildGraph(source)

    expect(result.success).toBe(true)
    expect(result.graph).toBeDefined()
    expect(result.graph!.nodes.size).toBe(2)
    expect(result.graph!.nodes.get('A')!.label).toBe('Hello')
    expect(result.graph!.nodes.get('B')!.label).toBe('World')
    expect(result.graph!.edges).toHaveLength(1)
    expect(result.graph!.edges[0].source).toBe('A')
    expect(result.graph!.edges[0].target).toBe('B')
    expect(result.graph!.diagramType).toBe('flowchart')
    expect(result.graph!.direction).toBe('TD')
  })

  it('parses flowchart with subgraphs', async () => {
    const source = `graph TD
    subgraph backend[Backend Services]
        API[API Server]
        DB[(Database)]
    end
    API --> DB`

    const result = await buildGraph(source)

    expect(result.success).toBe(true)
    expect(result.graph!.subgraphs.size).toBeGreaterThanOrEqual(1)

    // Find the subgraph labeled "Backend Services"
    let found = false
    for (const [, sg] of result.graph!.subgraphs) {
      if (sg.label === 'Backend Services') {
        expect(sg.nodeIds).toContain('API')
        expect(sg.nodeIds).toContain('DB')
        found = true
      }
    }
    expect(found).toBe(true)
  })

  it('attaches @link directives to nodes', async () => {
    const source = `%% @link auth -> /services/auth/flow.mmd#loginHandler
graph TD
    auth[Auth Service] --> db[Database]`

    const result = await buildGraph(source)

    expect(result.success).toBe(true)
    expect(result.graph!.directives).toHaveLength(1)
    const linkDir = result.graph!.directives[0]
    expect(linkDir.type).toBe('link')
    if (linkDir.type === 'link') {
      expect(linkDir.nodeId).toBe('auth')
      expect(linkDir.targetFile).toBe('/services/auth/flow.mmd')
      expect(linkDir.targetNode).toBe('loginHandler')
    }
  })

  it('detects layout philosophy from @layout directive', async () => {
    const source = `%% @layout blueprint
graph TD
    A --> B`

    const result = await buildGraph(source)

    expect(result.success).toBe(true)
    const layoutDir = result.graph!.directives.find((d) => d.type === 'layout')
    expect(layoutDir).toBeDefined()
    if (layoutDir && layoutDir.type === 'layout') {
      expect(layoutDir.philosophy).toBe('blueprint')
    }
  })

  it('returns errors for invalid mermaid syntax', async () => {
    const source = `this is not valid mermaid at all`

    const result = await buildGraph(source)

    expect(result.success).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0].code).toBe('PARSE_FAILED')
  })

  it('returns an explicit error for unsupported Mermaid diagram families', async () => {
    const source = `pie title Pets
    "Dogs" : 4
    "Cats" : 2`

    const result = await buildGraph(source)

    expect(result.success).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe('UNSUPPORTED_DIAGRAM_TYPE')
    expect(result.errors[0].message).toContain('pie')
    expect(result.errors[0].message).toContain('flowchart')
  })

  it.each([
    {
      family: 'sequence',
      diagramType: 'sequenceDiagram',
      source: `sequenceDiagram
        participant A as Author
        participant R as Reviewer
        A->>R: Request review
        R-->>A: Approve`,
      nodeIds: ['A', 'R'],
      edgeCount: 2,
      assertion: (result: LoadResult) => {
        expect(result.graph!.nodes.get('A')).toMatchObject({
          label: 'Author',
          metadata: { diagramFamily: 'sequence' },
        })
        expect(result.graph!.edges[0]).toMatchObject({
          source: 'A',
          target: 'R',
          label: 'Request review',
          metadata: { diagramFamily: 'sequence', sequence: { order: 0 } },
        })
      },
    },
    {
      family: 'C4',
      diagramType: 'c4',
      source: `C4Context
        Person(user, "User")
        System_Boundary(platform, "Platform") {
          System(app, "Application")
        }
        Rel(user, app, "Uses", "HTTPS")`,
      nodeIds: ['user', 'app'],
      edgeCount: 1,
      assertion: (result: LoadResult) => {
        expect(result.graph!.subgraphs.get('platform')).toMatchObject({
          label: 'Platform',
          nodeIds: ['app'],
        })
        expect(result.graph!.edges[0]).toMatchObject({
          source: 'user',
          target: 'app',
          label: 'Uses · HTTPS',
        })
      },
    },
    {
      family: 'requirement',
      diagramType: 'requirementDiagram',
      source: `requirementDiagram
        requirement secure_login {
          id: REQ_1
          text: Authentication must be secure
          risk: High
          verifymethod: Test
        }
        element auth_service {
          type: service
          docRef: auth.md
        }
        auth_service - satisfies -> secure_login`,
      nodeIds: ['secure_login', 'auth_service'],
      edgeCount: 1,
      assertion: (result: LoadResult) => {
        expect(result.graph!.nodes.get('secure_login')).toMatchObject({
          metadata: {
            diagramFamily: 'requirement',
            requirement: { id: 'REQ_1', risk: 'High', verifyMethod: 'Test' },
          },
        })
        expect(result.graph!.edges[0]).toMatchObject({
          source: 'auth_service',
          target: 'secure_login',
          label: 'satisfies',
        })
      },
    },
    {
      family: 'mindmap',
      diagramType: 'mindmap',
      source: `mindmap
        root((Review))
          Product
            Entity
          Delivery`,
      nodeIds: ['root', 'Product', 'Entity', 'Delivery'],
      edgeCount: 3,
      assertion: (result: LoadResult) => {
        expect(result.graph!.nodes.get('Entity')).toMatchObject({
          metadata: {
            diagramFamily: 'mindmap',
            mindmap: { depth: 2, parentId: 'Product' },
          },
        })
      },
    },
    {
      family: 'Gantt',
      diagramType: 'gantt',
      source: `gantt
        title Delivery
        dateFormat YYYY-MM-DD
        section Build
        API :api, 2026-07-24, 2d
        UI :ui, after api, 1d`,
      nodeIds: ['api', 'ui'],
      edgeCount: 1,
      assertion: (result: LoadResult) => {
        expect(result.graph!.subgraphs.get('gantt:section:Build')).toMatchObject({
          nodeIds: ['api', 'ui'],
        })
        expect(result.graph!.edges[0]).toMatchObject({
          source: 'api',
          target: 'ui',
          label: 'precedes',
        })
      },
    },
    {
      family: 'journey',
      diagramType: 'journey',
      source: `journey
        title Review
        section Author
          Draft: 4: Author
          Discuss: 3: Author, Reviewer`,
      nodeIds: ['journey:Author:Draft:0', 'journey:Author:Discuss:1'],
      edgeCount: 1,
      assertion: (result: LoadResult) => {
        expect(result.graph!.nodes.get('journey:Author:Discuss:1')).toMatchObject({
          metadata: {
            diagramFamily: 'journey',
            journey: { score: 3, people: ['Author', 'Reviewer'] },
          },
        })
      },
    },
  ])(
    'builds $family diagrams as interactive semantic graphs',
    async ({ source, diagramType, nodeIds, edgeCount, assertion }) => {
      const result = await buildGraph(source)

      expect(result.success, JSON.stringify(result.errors)).toBe(true)
      expect(result.graph!.diagramType).toBe(diagramType)
      expect([...result.graph!.nodes.keys()]).toEqual(nodeIds)
      expect(result.graph!.edges).toHaveLength(edgeCount)
      assertion(result)
    },
  )

  it('builds class diagrams as semantic compartment graphs with relationship metadata', async () => {
    const source = `classDiagram
    direction LR
    class Repository~T~ {
      +find(id: string) T
      +save(entity: T) void
    }
    class UserService {
      -repo: Repository~User~
      +activate(userId: string) Result
      +deactivate(userId: string) Result
    }
    class User {
      +string id
      +string status
      +activate() void
    }
    class Auditable {
      <<interface>>
      +createdAt Date
    }
    Auditable <|.. User
    Repository o-- User : stores
    UserService --> Repository : uses
    UserService *-- User : owns`

    const result = await buildGraph(source)

    expect(result.success).toBe(true)
    expect(result.graph!.diagramType).toBe('classDiagram')
    expect(result.graph!.direction).toBe('LR')
    expect([...result.graph!.nodes.keys()]).toEqual([
      'Repository',
      'UserService',
      'User',
      'Auditable',
    ])
    expect(result.graph!.nodes.get('UserService')).toMatchObject({
      id: 'UserService',
      label: 'UserService\n- repo: Repository<User>\n+ activate(userId: string): Result\n+ deactivate(userId: string): Result',
      metadata: {
        diagramFamily: 'class',
        class: {
          kind: 'class',
          attributes: [
            { name: 'repo: Repository<User>', visibility: '-', classifier: '' },
          ],
          methods: [
            { name: 'activate', visibility: '+', parameters: 'userId: string', returnType: 'Result' },
            { name: 'deactivate', visibility: '+', parameters: 'userId: string', returnType: 'Result' },
          ],
        },
      },
    })
    expect(result.graph!.nodes.get('Auditable')).toMatchObject({
      metadata: {
        class: {
          kind: 'interface',
          stereotypes: ['interface'],
        },
      },
    })

    expect(result.graph!.edges).toEqual([
      expect.objectContaining({
        id: 'class:Auditable:User:implementation:relationship',
        source: 'Auditable',
        target: 'User',
        style: 'dotted',
        metadata: {
          diagramFamily: 'class',
          class: expect.objectContaining({
            kind: 'relationship',
            relationshipKind: 'implementation',
            sourceMarker: 'extension',
            targetMarker: 'none',
          }),
        },
      }),
      expect.objectContaining({
        id: 'class:Repository:User:aggregation:stores',
        label: 'stores',
        metadata: expect.objectContaining({
          class: expect.objectContaining({
            relationshipKind: 'aggregation',
          }),
        }),
      }),
      expect.objectContaining({
        id: 'class:UserService:Repository:dependency:uses',
        label: 'uses',
        metadata: expect.objectContaining({
          class: expect.objectContaining({
            relationshipKind: 'dependency',
          }),
        }),
      }),
      expect.objectContaining({
        id: 'class:UserService:User:composition:owns',
        label: 'owns',
        metadata: expect.objectContaining({
          class: expect.objectContaining({
            relationshipKind: 'composition',
          }),
        }),
      }),
    ])
  })

  it('builds state diagrams as semantic transition graphs with composite subgraphs', async () => {
    const source = `stateDiagram-v2
    direction LR
    [*] --> Draft
    Draft --> InReview: submit
    InReview --> Approved: approve
    InReview --> Draft: request changes
    Approved --> [*]
    state InReview {
      [*] --> Waiting
      Waiting --> Escalated: stale
      Escalated --> Waiting: owner responds
    }`

    const result = await buildGraph(source)

    expect(result.success).toBe(true)
    expect(result.graph!.diagramType).toBe('stateDiagram')
    expect(result.graph!.direction).toBe('LR')
    expect([...result.graph!.nodes.keys()]).toEqual([
      'root_start',
      'Draft',
      'InReview',
      'Approved',
      'root_end',
      'InReview_start',
      'Waiting',
      'Escalated',
    ])
    expect(result.graph!.nodes.get('root_start')).toMatchObject({
      label: 'Start',
      shape: 'circle',
      metadata: {
        diagramFamily: 'state',
        state: {
          kind: 'start',
        },
      },
    })
    expect(result.graph!.nodes.get('InReview')).toMatchObject({
      label: 'InReview',
      shape: 'rounded',
      metadata: {
        diagramFamily: 'state',
        state: {
          kind: 'composite',
        },
      },
    })
    expect(result.graph!.subgraphs.get('state:InReview')).toMatchObject({
      id: 'state:InReview',
      label: 'InReview',
      nodeIds: ['InReview_start', 'Waiting', 'Escalated'],
      direction: 'LR',
    })
    expect(result.graph!.edges).toEqual([
      expect.objectContaining({
        id: 'state:root_start:Draft:transition',
        source: 'root_start',
        target: 'Draft',
      }),
      expect.objectContaining({
        id: 'state:Draft:InReview:submit',
        source: 'Draft',
        target: 'InReview',
        label: 'submit',
      }),
      expect.objectContaining({
        id: 'state:InReview:Approved:approve',
        label: 'approve',
      }),
      expect.objectContaining({
        id: 'state:InReview:Draft:request_changes',
        label: 'request changes',
      }),
      expect.objectContaining({
        id: 'state:Approved:root_end:transition',
      }),
      expect.objectContaining({
        id: 'state:InReview_start:Waiting:transition',
      }),
      expect.objectContaining({
        id: 'state:Waiting:Escalated:stale',
        label: 'stale',
      }),
      expect.objectContaining({
        id: 'state:Escalated:Waiting:owner_responds',
        label: 'owner responds',
      }),
    ])
  })

  it('builds ER diagrams as semantic entity graphs with stable relationship metadata', async () => {
    const source = `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    CUSTOMER {
      string id PK
      string name
      string region
    }
    ORDER {
      string id PK
      date orderedAt
    }
    LINE_ITEM {
      string sku
      int quantity
    }`

    const result = await buildGraph(source)

    expect(result.success).toBe(true)
    expect(result.graph!.diagramType).toBe('erDiagram')
    expect([...result.graph!.nodes.keys()]).toEqual(['CUSTOMER', 'ORDER', 'LINE_ITEM'])
    expect(result.graph!.nodes.get('CUSTOMER')).toMatchObject({
      id: 'CUSTOMER',
      label: 'CUSTOMER\nid: string PK\nname: string\nregion: string',
      metadata: {
        diagramFamily: 'er',
        er: {
          kind: 'entity',
          attributes: [
            { type: 'string', name: 'id', keys: ['PK'] },
            { type: 'string', name: 'name', keys: [] },
            { type: 'string', name: 'region', keys: [] },
          ],
        },
      },
    })

    const places = result.graph!.edges.find(
      (edge) => edge.source === 'CUSTOMER' && edge.target === 'ORDER',
    )
    expect(places).toMatchObject({
      id: 'er:CUSTOMER:ORDER:places:ONLY_ONE:ZERO_OR_MORE:IDENTIFYING',
      label: 'places',
      metadata: {
        diagramFamily: 'er',
        er: {
          kind: 'relationship',
          role: 'places',
          cardinality: '1 -> 0..*',
          sourceCardinality: 'ONLY_ONE',
          targetCardinality: 'ZERO_OR_MORE',
          rawCardA: 'ZERO_OR_MORE',
          rawCardB: 'ONLY_ONE',
          relType: 'IDENTIFYING',
        },
      },
    })
  })

  it('normalizes ER many-to-one cardinality from source to target', async () => {
    const source = `erDiagram
    CHILD }o--|| PARENT : belongs_to`

    const result = await buildGraph(source)

    expect(result.success).toBe(true)
    expect(result.graph!.edges[0]).toMatchObject({
      id: 'er:CHILD:PARENT:belongs_to:ZERO_OR_MORE:ONLY_ONE:IDENTIFYING',
      label: 'belongs_to',
      metadata: {
        er: {
          sourceCardinality: 'ZERO_OR_MORE',
          targetCardinality: 'ONLY_ONE',
          cardinality: '0..* -> 1',
        },
      },
    })
  })

  it('parses edge labels', async () => {
    const source = `graph TD
    A -->|yes| B
    A -->|no| C`

    const result = await buildGraph(source)

    expect(result.success).toBe(true)
    expect(result.graph!.edges).toHaveLength(2)

    const edgeAB = result.graph!.edges.find((e) => e.source === 'A' && e.target === 'B')
    expect(edgeAB).toBeDefined()
    expect(edgeAB!.label).toBe('yes')

    const edgeAC = result.graph!.edges.find((e) => e.source === 'A' && e.target === 'C')
    expect(edgeAC).toBeDefined()
    expect(edgeAC!.label).toBe('no')
  })

  it('normalizes Mermaid HTML label breaks and entities', async () => {
    const source = `graph TD
    A["First line<br/>Second & more"]
    B["Escaped &amp; readable"]
    A -->|"edge<br/>yes &amp; no"| B`

    const result = await buildGraph(source)

    expect(result.success).toBe(true)
    expect(result.graph!.nodes.get('A')!.label).toBe('First line\nSecond & more')
    expect(result.graph!.nodes.get('B')!.label).toBe('Escaped & readable')
    expect(result.graph!.edges[0].label).toBe('edge\nyes & no')
  })

  it('sanitizes Mermaid HTML labels and preserves allowed bold ranges', async () => {
    const source = `graph TD
    A["<b>Upload + config panel</b><br/><script>alert(1)</script><em>CSV</em> &amp; admin"]
    B["Safe"]
    A --> B`

    const result = await buildGraph(source)

    expect(result.success).toBe(true)
    const node = result.graph!.nodes.get('A')!
    expect(node.label).toBe('Upload + config panel\nCSV & admin')
    expect(node.label).not.toContain('<')
    expect(node.label).not.toContain('alert')
    expect(node.labelMarkup?.ranges).toEqual([
      { start: 0, end: 'Upload + config panel'.length, bold: true },
    ])
  })

  it('preserves Mermaid class colors and subgraph directions for semantic maps', async () => {
    const source = `flowchart LR
    classDef canon fill:#e6f7ee,stroke:#2e9e6b,color:#0b3d26;
    classDef note fill:#fff7e6,stroke:#d9a521,color:#6b4e00,stroke-dasharray:3 2;

    subgraph PIPE["pipeline (medallion)"]
      direction TB
      S["Source / Connector"]:::canon
      B["Bronze — Raw / Landing"]:::canon
      S --> B
    end

    A_B["wrong table"]:::note
    B -.-> A_B`

    const result = await buildGraph(source)

    expect(result.success).toBe(true)
    expect(result.graph!.direction).toBe('LR')

    expect(result.graph!.subgraphs.get('PIPE')).toMatchObject({
      direction: 'TB',
    })
    expect(result.graph!.nodes.get('S')).toMatchObject({
      classes: ['canon'],
      style: {
        fill: 0xe6f7ee,
        stroke: 0x2e9e6b,
        text: 0x0b3d26,
      },
    })
    expect(result.graph!.nodes.get('A_B')).toMatchObject({
      classes: ['note'],
      style: {
        fill: 0xfff7e6,
        stroke: 0xd9a521,
        text: 0x6b4e00,
        strokeDasharray: [3, 2],
      },
    })
  })

  it('preserves Mermaid linkStyle colors for custom highlighted lines', async () => {
    const source = `flowchart LR
    A["Source"] --> B["Model"]
    B -.-> C["Note"]
    linkStyle 0 stroke:#00ffcc,stroke-width:4px;
    linkStyle 1 stroke:#d9a521,stroke-width:2px,stroke-dasharray:3 2;`

    const result = await buildGraph(source)

    expect(result.success).toBe(true)
    expect(result.graph!.edges[0]).toMatchObject({
      renderStyle: {
        stroke: 0x00ffcc,
        strokeWidth: 4,
      },
    })
    expect(result.graph!.edges[1]).toMatchObject({
      style: 'dotted',
      renderStyle: {
        stroke: 0xd9a521,
        strokeWidth: 2,
        strokeDasharray: [3, 2],
      },
    })
  })

  it('warns when @link references unknown node', async () => {
    const source = `%% @link nonexistent -> /path.mmd
graph TD
    A --> B`

    const result = await buildGraph(source)

    expect(result.success).toBe(true)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].code).toBe('LINK_NODE_NOT_FOUND')
  })

  it('attaches semantic entity and edge metadata to the parsed graph', async () => {
    const source = `%% @entity view_builder spec:view-builder domain=transform tags=transform,risk
%% @edge view_builder -> audit_logs ref=R9 status=unpinned severity=critical kind=tenant-isolation
flowchart LR
    view_builder[view-builder] -.->|R9| audit_logs[audit-logs]`

    const result = await buildGraph(source)

    expect(result.success).toBe(true)
    expect(result.graph!.nodes.get('view_builder')!.metadata).toEqual({
      entity: {
        type: 'spec',
        id: 'view-builder',
      },
      domain: 'transform',
      tags: ['transform', 'risk'],
    })
    expect(result.graph!.edges[0].metadata).toEqual({
      ref: 'R9',
      status: 'unpinned',
      severity: 'critical',
      kind: 'tenant-isolation',
    })
  })

  it('warns when semantic directives reference missing graph symbols', async () => {
    const source = `%% @entity missing spec:missing
%% @edge A -> missing ref=R0
graph TD
    A --> B`

    const result = await buildGraph(source)

    expect(result.success).toBe(true)
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      'ENTITY_NODE_NOT_FOUND',
      'EDGE_TARGET_NOT_FOUND',
    ])
  })

  it('validates linked files and fragments through the resolver', async () => {
    const resolver = createVirtualFileResolver({
      '/examples/main.mmd': `%% @link good -> ./target#ready
%% @link bad -> ./missing#nowhere
graph TD
    good[Good] --> bad[Bad]`,
      '/examples/target.mmd': `graph TD
    ready[Ready] --> done[Done]`,
    })

    const result = await buildGraph(
      `%% @link good -> ./target#ready
%% @link bad -> ./missing#nowhere
graph TD
    good[Good] --> bad[Bad]`,
      {
        sourcePath: '/examples/main.mmd',
        linkResolver: resolver,
      },
    )

    expect(result.success).toBe(true)
    expect(result.linkStates?.get('good')).toMatchObject({
      status: 'valid',
      canonicalTargetFile: '/examples/target.mmd',
    })
    expect(result.linkStates?.get('bad')).toMatchObject({
      status: 'broken',
      canonicalTargetFile: '/examples/missing.mmd',
      warningCode: 'LINK_TARGET_NOT_FOUND',
    })
    expect(result.warnings.some((warning) => warning.code === 'LINK_TARGET_NOT_FOUND')).toBe(true)
  })

  it('warns when a linked fragment is missing from the target graph', async () => {
    const resolver = createVirtualFileResolver({
      '/examples/main.mmd': `%% @link bad -> ./target#missingNode
graph TD
    bad[Bad]`,
      '/examples/target.mmd': `graph TD
    ready[Ready]`,
    })

    const result = await buildGraph(
      `%% @link bad -> ./target#missingNode
graph TD
    bad[Bad]`,
      {
        sourcePath: '/examples/main.mmd',
        linkResolver: resolver,
      },
    )

    expect(result.success).toBe(true)
    expect(result.linkStates?.get('bad')).toMatchObject({
      status: 'broken',
      warningCode: 'LINK_TARGET_NODE_NOT_FOUND',
    })
    expect(result.warnings.some((warning) => warning.code === 'LINK_TARGET_NODE_NOT_FOUND')).toBe(true)
  })

  it('warns instead of crashing when a link target escapes the resolver scope', async () => {
    const resolver = createVirtualFileResolver({
      '/examples/microservice/overview.mmd': `%% @link bad -> ../../../../etc/passwd
graph TD
    bad[Bad]`,
    })

    const result = await buildGraph(
      `%% @link bad -> ../../../../etc/passwd
graph TD
    bad[Bad]`,
      {
        sourcePath: '/examples/microservice/overview.mmd',
        linkResolver: resolver,
      },
    )

    expect(result.success).toBe(true)
    expect(result.linkStates?.get('bad')).toMatchObject({
      status: 'broken',
      warningCode: 'LINK_TARGET_OUT_OF_SCOPE',
    })
    expect(result.warnings.some((warning) => warning.code === 'LINK_TARGET_OUT_OF_SCOPE')).toBe(true)
  })
})
