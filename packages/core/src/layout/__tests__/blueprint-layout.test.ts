import { describe, it, expect } from 'vitest'
import { BlueprintLayout, snapToGrid, lineIntersectsRect, computeWaypoint, avoidEdgeCollisions } from '../blueprint-layout'
import { getPhilosophyConfig } from '../philosophy-config'
import { buildGraph } from '../../parser/graph-builder'
import { estimateRenderedNodeFootprint } from '../../node-footprint'
import type { RenderGraph, RenderNode, RenderEdge, PositionedNode, PositionedEdge } from '../../types'

function makeGraph(): RenderGraph {
  const nodes = new Map<string, RenderNode>([
    ['A', { id: 'A', label: 'Node A', shape: 'rectangle', metadata: {} }],
    ['B', { id: 'B', label: 'Node B', shape: 'rectangle', metadata: {} }],
    ['C', { id: 'C', label: 'Node C', shape: 'rectangle', metadata: {} }],
  ])
  const edges: RenderEdge[] = [
    { id: 'e0', source: 'A', target: 'B', style: 'solid' },
    { id: 'e1', source: 'B', target: 'C', style: 'solid' },
  ]
  return {
    nodes,
    edges,
    subgraphs: new Map(),
    directives: [],
    direction: 'TD',
    diagramType: 'flowchart',
  }
}

// ── Grid Snapping ─────────────────────────────────────────────────────────────

describe('snapToGrid', () => {
  it('snaps (123) to 120', () => {
    expect(snapToGrid(123)).toBe(120)
  })

  it('snaps (47) to 40', () => {
    expect(snapToGrid(47)).toBe(40)
  })

  it('snaps (130) to 140 (rounds to nearest)', () => {
    expect(snapToGrid(130)).toBe(140)
  })

  it('snaps exact grid values to themselves', () => {
    expect(snapToGrid(60)).toBe(60)
    expect(snapToGrid(0)).toBe(0)
    expect(snapToGrid(100)).toBe(100)
  })

  it('snaps negative values correctly', () => {
    expect(snapToGrid(-13)).toBe(-20)
    expect(snapToGrid(-25)).toBe(-20)
    expect(snapToGrid(-31)).toBe(-40)
  })

  it('supports custom grid size', () => {
    expect(snapToGrid(27, 10)).toBe(30)
    expect(snapToGrid(23, 10)).toBe(20)
  })
})

// ── BlueprintLayout ───────────────────────────────────────────────────────────

describe('BlueprintLayout', () => {
  it('uses discussion-scale spacing while preserving the 20px grid discipline', () => {
    const config = getPhilosophyConfig('blueprint')
    expect(config.nodeSep).toBeGreaterThanOrEqual(40)
    expect(config.rankSep).toBeGreaterThanOrEqual(56)
    expect(config.edgeSep).toBeGreaterThanOrEqual(16)
    expect(config.marginX).toBeGreaterThanOrEqual(40)
    expect(config.marginY).toBeGreaterThanOrEqual(40)
  })

  it('snaps all node positions to 20px grid', () => {
    const layout = new BlueprintLayout()
    const result = layout.compute(makeGraph())

    for (const [, node] of result.nodes) {
      expect(node.x % 20).toBe(0)
      expect(node.y % 20).toBe(0)
    }
  })

  it('does not produce overlapping nodes after snapping', () => {
    const layout = new BlueprintLayout()
    const result = layout.compute(makeGraph())
    const positioned = Array.from(result.nodes.values())

    for (let i = 0; i < positioned.length; i++) {
      for (let j = i + 1; j < positioned.length; j++) {
        const a = positioned[i]
        const b = positioned[j]
        const overlapX = Math.abs(a.x - b.x) < (a.width + b.width) / 2
        const overlapY = Math.abs(a.y - b.y) < (a.height + b.height) / 2
        expect(overlapX && overlapY).toBe(false)
      }
    }
  })

  it('resolves overlap using rendered footprint height and the minimum margin', () => {
    const lines = Array.from({ length: 8 }, (_, index) => `Rendered line ${index}`)
    const nodes = new Map<string, PositionedNode>([
      ['A', {
        id: 'A', label: lines.join('\n'), shape: 'rectangle', metadata: {},
        x: 100, y: 100, width: 80, height: 40,
      }],
      ['B', {
        id: 'B', label: lines.join('\n'), shape: 'rectangle', metadata: {},
        x: 100, y: 160, width: 80, height: 40,
      }],
    ])
    const layout = new BlueprintLayout() as any

    layout._resolveOverlaps(nodes)

    const a = nodes.get('A')!
    const b = nodes.get('B')!
    const aFootprint = estimateRenderedNodeFootprint(a, true)
    const bFootprint = estimateRenderedNodeFootprint(b, true)
    const minimumGap = (aFootprint.height + bFootprint.height) / 2 + 40

    expect(Math.abs(a.y - b.y)).toBeGreaterThanOrEqual(minimumGap)
  })

  it('positions all nodes', () => {
    const layout = new BlueprintLayout()
    const result = layout.compute(makeGraph())
    expect(result.nodes.size).toBe(3)
  })

  it('keeps a structural dotted-edge sink in the solid hierarchy instead of treating it as an annotation', () => {
    const graph: RenderGraph = {
      nodes: new Map<string, RenderNode>([
        ['A', { id: 'A', label: 'A', shape: 'rectangle', metadata: {} }],
        ['B', { id: 'B', label: 'B', shape: 'rectangle', metadata: {} }],
        ['C', { id: 'C', label: 'C', shape: 'rectangle', metadata: {} }],
      ]),
      edges: [
        { id: 'a-to-c', source: 'A', target: 'C', style: 'solid' },
        { id: 'a-to-b', source: 'A', target: 'B', style: 'solid' },
        { id: 'b-to-c-note', source: 'B', target: 'C', style: 'dotted' },
      ],
      subgraphs: new Map(),
      directives: [],
      direction: 'TD',
      diagramType: 'flowchart',
    }

    const result = new BlueprintLayout().compute(graph)
    const a = result.nodes.get('A')!
    const b = result.nodes.get('B')!
    const c = result.nodes.get('C')!

    expect(c.y, 'C has a solid incoming edge and must not be placed beside dotted-edge source B').toBeGreaterThan(b.y)
    expect(c.y).toBeGreaterThan(a.y)
  })

  it('honors explicit local TB direction for a connected subgraph that links outside', () => {
    const graph: RenderGraph = {
      nodes: new Map<string, RenderNode>([
        ['S', { id: 'S', label: 'Source', shape: 'rectangle', metadata: {} }],
        ['B', { id: 'B', label: 'Bronze', shape: 'rectangle', metadata: {} }],
        ['N', { id: 'N', label: 'Note', shape: 'rectangle', metadata: {} }],
      ]),
      edges: [
        { id: 'e0', source: 'S', target: 'B', style: 'solid' },
        { id: 'e1', source: 'B', target: 'N', style: 'dotted' },
      ],
      subgraphs: new Map([
        ['PIPE', {
          id: 'PIPE',
          label: 'pipeline',
          nodeIds: ['S', 'B'],
          collapsed: false,
          direction: 'TB',
        }],
      ]),
      directives: [],
      direction: 'LR',
      diagramType: 'flowchart',
    }

    const result = new BlueprintLayout().compute(graph)
    const source = result.nodes.get('S')!
    const bronze = result.nodes.get('B')!

    expect(bronze.y).toBeGreaterThan(source.y)
    expect(Math.abs(source.x - bronze.x)).toBeLessThanOrEqual(20)
  })

  it('keeps branching local TB details under the hub even when the hub hands off to the next phase', () => {
    const graph: RenderGraph = {
      nodes: new Map<string, RenderNode>([
        ['Sheet', { id: 'Sheet', label: 'Sheet', shape: 'rectangle', metadata: {} }],
        ['Table', { id: 'Table', label: 'Table', shape: 'rectangle', metadata: {} }],
        ['Column', { id: 'Column', label: 'Column', shape: 'rectangle', metadata: {} }],
        ['Entity', { id: 'Entity', label: 'Entity', shape: 'rectangle', metadata: {} }],
        ['View', { id: 'View', label: 'View', shape: 'rectangle', metadata: {} }],
        ['Dataset', { id: 'Dataset', label: 'Dataset', shape: 'rectangle', metadata: {} }],
      ]),
      edges: [
        { id: 'e0', source: 'Sheet', target: 'Table', style: 'solid' },
        { id: 'e1', source: 'Table', target: 'Column', style: 'solid' },
        { id: 'e2', source: 'Table', target: 'Entity', style: 'solid' },
        { id: 'e3', source: 'Table', target: 'View', style: 'solid' },
        { id: 'e4', source: 'Table', target: 'Dataset', style: 'solid' },
      ],
      subgraphs: new Map([
        ['SHAPE', {
          id: 'SHAPE',
          label: 'SHAPE / silver',
          nodeIds: ['Table', 'Column', 'Entity'],
          collapsed: false,
          direction: 'TB',
        }],
        ['SERVE', {
          id: 'SERVE',
          label: 'SERVE / gold',
          nodeIds: ['View', 'Dataset'],
          collapsed: false,
          direction: 'TB',
        }],
      ]),
      directives: [],
      direction: 'LR',
      diagramType: 'flowchart',
    }

    const result = new BlueprintLayout().compute(graph)
    const table = result.nodes.get('Table')!
    const column = result.nodes.get('Column')!
    const entity = result.nodes.get('Entity')!
    const view = result.nodes.get('View')!
    const dataset = result.nodes.get('Dataset')!

    expect(column.y).toBeGreaterThan(table.y)
    expect(entity.y).toBeGreaterThan(table.y)
    expect(view.x).toBeGreaterThan(table.x)
    expect(dataset.x).toBeGreaterThan(table.x)
  })

  it('marks collapsed subgraph summaries as expandable nodes in Blueprint layout', () => {
    const graph: RenderGraph = {
      nodes: new Map<string, RenderNode>([
        ['A', { id: 'A', label: 'API', shape: 'rectangle', metadata: {} }],
        ['B', { id: 'B', label: 'Service', shape: 'rectangle', metadata: {} }],
        ['C', { id: 'C', label: 'Worker', shape: 'rectangle', metadata: {} }],
      ]),
      edges: [
        { id: 'e0', source: 'A', target: 'B', style: 'solid' },
        { id: 'e1', source: 'C', target: 'B', style: 'solid' },
      ],
      subgraphs: new Map([
        ['core', {
          id: 'core',
          label: 'Core Services',
          nodeIds: ['A', 'B', 'C'],
          collapsed: true,
          direction: 'TB',
        }],
      ]),
      directives: [],
      direction: 'TD',
      diagramType: 'flowchart',
    }

    const result = new BlueprintLayout().compute(graph)
    const summary = result.nodes.get('core')

    expect(summary).toBeDefined()
    expect(summary!.metadata).toMatchObject({
      _isCollapsedSummary: true,
      _subgraphId: 'core',
      _childCount: 3,
    })
  })

  it('stacks edgeless TB subgraph nodes instead of making a wide row', () => {
    const graph: RenderGraph = {
      nodes: new Map<string, RenderNode>([
        ['Model', { id: 'Model', label: 'Model', shape: 'rectangle', metadata: {} }],
        ['Grain', { id: 'Grain', label: 'Grain', shape: 'rectangle', metadata: {} }],
        ['Measure', { id: 'Measure', label: 'Measure', shape: 'rectangle', metadata: {} }],
      ]),
      edges: [],
      subgraphs: new Map([
        ['FACETS', {
          id: 'FACETS',
          label: 'model facets',
          nodeIds: ['Model', 'Grain', 'Measure'],
          collapsed: false,
          direction: 'TB',
        }],
      ]),
      directives: [],
      direction: 'LR',
      diagramType: 'flowchart',
    }

    const result = new BlueprintLayout().compute(graph)
    const model = result.nodes.get('Model')!
    const grain = result.nodes.get('Grain')!
    const measure = result.nodes.get('Measure')!

    expect(Math.abs(model.x - grain.x)).toBeLessThanOrEqual(20)
    expect(Math.abs(grain.x - measure.x)).toBeLessThanOrEqual(20)
    expect(grain.y).toBeGreaterThan(model.y)
    expect(measure.y).toBeGreaterThan(grain.y)
  })

  it('keeps an edgeless TB list vertical even when members annotate outside nodes', () => {
    const graph: RenderGraph = {
      nodes: new Map<string, RenderNode>([
        ['Model', { id: 'Model', label: 'Model', shape: 'rectangle', metadata: {} }],
        ['Grain', { id: 'Grain', label: 'Grain', shape: 'rectangle', metadata: {} }],
        ['Measure', { id: 'Measure', label: 'Measure', shape: 'rectangle', metadata: {} }],
        ['NoteModel', { id: 'NoteModel', label: 'Model note', shape: 'rectangle', metadata: {} }],
        ['NoteMeasure', { id: 'NoteMeasure', label: 'Measure note', shape: 'rectangle', metadata: {} }],
      ]),
      edges: [
        { id: 'e0', source: 'Model', target: 'NoteModel', style: 'dotted' },
        { id: 'e1', source: 'Measure', target: 'NoteMeasure', style: 'dotted' },
      ],
      subgraphs: new Map([
        ['FACETS', {
          id: 'FACETS',
          label: 'model facets',
          nodeIds: ['Model', 'Grain', 'Measure'],
          collapsed: false,
          direction: 'TB',
        }],
      ]),
      directives: [],
      direction: 'LR',
      diagramType: 'flowchart',
    }

    const result = new BlueprintLayout().compute(graph)
    const model = result.nodes.get('Model')!
    const grain = result.nodes.get('Grain')!
    const measure = result.nodes.get('Measure')!

    expect(Math.abs(model.x - grain.x)).toBeLessThanOrEqual(20)
    expect(Math.abs(grain.x - measure.x)).toBeLessThanOrEqual(20)
    expect(grain.y).toBeGreaterThan(model.y)
    expect(measure.y).toBeGreaterThan(grain.y)
  })

  it('keeps disconnected nodes in declaration order inside a partially connected TB subgraph', () => {
    const graph: RenderGraph = {
      nodes: new Map<string, RenderNode>([
        ['Model', { id: 'Model', label: 'Model', shape: 'rectangle', metadata: {} }],
        ['Grain', { id: 'Grain', label: 'Grain', shape: 'rectangle', metadata: {} }],
        ['Measure', { id: 'Measure', label: 'Measure', shape: 'rectangle', metadata: {} }],
        ['Dimension', { id: 'Dimension', label: 'Dimension', shape: 'rectangle', metadata: {} }],
      ]),
      edges: [
        { id: 'e0', source: 'Model', target: 'Grain', style: 'solid' },
      ],
      subgraphs: new Map([
        ['FACETS', {
          id: 'FACETS',
          label: 'model facets',
          nodeIds: ['Model', 'Grain', 'Measure', 'Dimension'],
          collapsed: false,
          direction: 'TB',
        }],
      ]),
      directives: [],
      direction: 'LR',
      diagramType: 'flowchart',
    }

    const result = new BlueprintLayout().compute(graph)
    const model = result.nodes.get('Model')!
    const grain = result.nodes.get('Grain')!
    const measure = result.nodes.get('Measure')!
    const dimension = result.nodes.get('Dimension')!

    expect(Math.abs(model.x - grain.x)).toBeLessThanOrEqual(20)
    expect(Math.abs(grain.x - measure.x)).toBeLessThanOrEqual(20)
    expect(Math.abs(measure.x - dimension.x)).toBeLessThanOrEqual(20)
    expect(grain.y).toBeGreaterThan(model.y)
    expect(measure.y).toBeGreaterThan(grain.y)
    expect(dimension.y).toBeGreaterThan(measure.y)
  })

  it('wraps long spaced annotation labels into compact taller boxes', () => {
    const graph: RenderGraph = {
      nodes: new Map<string, RenderNode>([
        ['Source', { id: 'Source', label: 'Source', shape: 'rectangle', metadata: {} }],
        ['Note', {
          id: 'Note',
          label: "treated silver as a per-view inline pre-pass -> it is a shared Model: conform-once, 1:N to gold",
          shape: 'rectangle',
          metadata: {},
        }],
      ]),
      edges: [
        { id: 'e0', source: 'Source', target: 'Note', style: 'dotted' },
      ],
      subgraphs: new Map(),
      directives: [],
      direction: 'LR',
      diagramType: 'flowchart',
    }

    const result = new BlueprintLayout().compute(graph)
    const note = result.nodes.get('Note')!

    expect(note.width).toBeLessThanOrEqual(340)
    expect(note.height).toBeGreaterThan(48)
  })

  it('keeps dotted annotation cards aligned with their source rows', () => {
    const graph: RenderGraph = {
      nodes: new Map<string, RenderNode>([
        ['B', { id: 'B', label: 'Bronze — Raw / Landing', shape: 'rectangle', metadata: {} }],
        ['SV', { id: 'SV', label: 'Silver — Staging / Cleaned', shape: 'rectangle', metadata: {} }],
        ['GD', { id: 'GD', label: 'Gold — Mart / Presentation', shape: 'rectangle', metadata: {} }],
        ['MD', { id: 'MD', label: 'Model (contract-bearing relation)', shape: 'rectangle', metadata: {} }],
        ['MEn', { id: 'MEn', label: 'Measure', shape: 'rectangle', metadata: {} }],
        ['NSn', { id: 'NSn', label: 'Namespace / Domain', shape: 'rectangle', metadata: {} }],
        ['A_B', {
          id: 'A_B',
          label: "on upload we made one 'Table' (Source + bronze + queryable conflated)",
          shape: 'rectangle',
          metadata: {},
        }],
        ['A_MD', {
          id: 'A_MD',
          label: "the 'IR / ViewPlan' was treated as the spine -> Model is the citizen",
          shape: 'rectangle',
          metadata: {},
        }],
      ]),
      edges: [
        { id: 'e0', source: 'B', target: 'SV', style: 'solid' },
        { id: 'e1', source: 'SV', target: 'GD', style: 'solid' },
        { id: 'e2', source: 'B', target: 'A_B', style: 'dotted' },
        { id: 'e3', source: 'MD', target: 'A_MD', style: 'dotted' },
      ],
      subgraphs: new Map([
        ['PIPE', {
          id: 'PIPE',
          label: 'pipeline',
          nodeIds: ['B', 'SV', 'GD'],
          collapsed: false,
          direction: 'TB',
        }],
        ['FACETS', {
          id: 'FACETS',
          label: 'model facets',
          nodeIds: ['MD', 'MEn', 'NSn'],
          collapsed: false,
          direction: 'TB',
        }],
      ]),
      directives: [],
      direction: 'LR',
      diagramType: 'flowchart',
    }

    const result = new BlueprintLayout().compute(graph)
    const bronze = result.nodes.get('B')!
    const model = result.nodes.get('MD')!
    const pipelineNote = result.nodes.get('A_B')!
    const modelNote = result.nodes.get('A_MD')!

    expect(pipelineNote.x).toBeGreaterThan(bronze.x)
    expect(Math.abs(pipelineNote.y - bronze.y)).toBeLessThanOrEqual(80)
    expect(pipelineNote.x - bronze.x).toBeLessThanOrEqual(pipelineNote.width + 80)

    expect(modelNote.x).toBeGreaterThan(model.x)
    expect(Math.abs(modelNote.y - model.y)).toBeLessThanOrEqual(80)
    expect(modelNote.x - model.x).toBeLessThanOrEqual(modelNote.width + 80)
  })

  it('wraps parent subgraph bounds around nested child subgraphs', () => {
    const graph: RenderGraph = {
      nodes: new Map<string, RenderNode>([
        ['S', { id: 'S', label: 'Source', shape: 'rectangle', metadata: {} }],
        ['B', { id: 'B', label: 'Bronze', shape: 'rectangle', metadata: {} }],
        ['Model', { id: 'Model', label: 'Model', shape: 'rectangle', metadata: {} }],
        ['Grain', { id: 'Grain', label: 'Grain', shape: 'rectangle', metadata: {} }],
      ]),
      edges: [
        { id: 'e0', source: 'S', target: 'B', style: 'solid' },
      ],
      subgraphs: new Map([
        ['CANON', {
          id: 'CANON',
          label: 'Canonical first-class citizens',
          nodeIds: ['PIPE', 'FACETS'],
          collapsed: false,
          direction: 'TB',
        }],
        ['PIPE', {
          id: 'PIPE',
          label: 'pipeline',
          nodeIds: ['S', 'B'],
          collapsed: false,
          direction: 'TB',
        }],
        ['FACETS', {
          id: 'FACETS',
          label: 'model facets',
          nodeIds: ['Model', 'Grain'],
          collapsed: false,
          direction: 'TB',
        }],
      ]),
      directives: [],
      direction: 'LR',
      diagramType: 'flowchart',
    }

    const result = new BlueprintLayout().compute(graph)
    const parent = result.subgraphs.get('CANON')!
    const pipe = result.subgraphs.get('PIPE')!
    const facets = result.subgraphs.get('FACETS')!

    const parentLeft = parent.x - parent.width / 2
    const parentRight = parent.x + parent.width / 2
    const parentTop = parent.y - parent.height / 2
    const parentBottom = parent.y + parent.height / 2

    for (const child of [pipe, facets]) {
      expect(child.x - child.width / 2).toBeGreaterThanOrEqual(parentLeft)
      expect(child.x + child.width / 2).toBeLessThanOrEqual(parentRight)
      expect(child.y - child.height / 2).toBeGreaterThanOrEqual(parentTop)
      expect(child.y + child.height / 2).toBeLessThanOrEqual(parentBottom)
    }
  })

  it('uses compound packing for large multi-cluster LR topology maps instead of a flat cluster row', async () => {
    const source = `graph LR
  subgraph SOURCES
    _incremental[_incremental]
    schema_discovery[schema-discovery]
    mock_data_workflow([mock-data-workflow tooling])
    bkb_seed([bkb-seed tooling])
    mock_mode([mock-mode tooling])
  end
  subgraph TRANSFORM
    view_builder[view-builder]
    auto_view_builder[auto-view-builder]
    view_ir_atomic_guarantees[view-ir-atomic-guarantees]
  end
  subgraph SEMANTICS
    domain_ontology[domain-ontology]
    dimensions[dimensions]
  end
  subgraph CHAT
    chat[chat]
    analytics[analytics]
  end
  subgraph BLOCKS
    result_visualization[result-visualization]
    dashboard_context[dashboard-context]
  end
  subgraph PROACTIVE
    reports_and_dashboard[reports-and-dashboard]
  end
  subgraph GOVERNANCE
    audit_logs[audit-logs]
    on_prem_regulated[on-prem-regulated]
    async_event_system[async-event-system]
    billing[billing]
    notifications[notifications]
    iam[iam]
    self_registration[self-registration]
    invite_acceptance_flow[invite-acceptance-flow]
    groups[groups]
    teams([teams deprecated])
    teams_retirement([teams-retirement deprecated])
    llmrelay[llmrelay]
    bifrost_gateway[bifrost-gateway]
    smriti_cli[smriti-cli]
    agent_tools[agent-tools]
    auth_go_cli_sdk[auth-go-cli-sdk]
    otel_go_sdk[otel-go-sdk]
    otel_python_sdk[otel-python-sdk]
    otel_node_sdk[otel-node-sdk]
    otel_collector_config[otel-collector-config]
    log_mcp_server([log-mcp-server tooling])
    infra[infra]
  end
  predict[predict]
  bkb[("Business Knowledge Base")]
  events[/"async-event-system"/]
  identity[/"iam self-registration invite-acceptance groups"/]
  surface[/"smriti-cli agent-tools auth-go-cli-sdk"/]
  llm[/"llmrelay bifrost-gateway"/]
  otel[/"otel-go python node sdk otel-collector config"/]
  platform_core[platform-core]
  predictive_tiers[predictive-tiers predict]
  ml_models[ml-models predict]
  view_builder -.->|"R9 ViewPlan rls predicate tenant discriminator critical"| audit_logs
  audit_logs -->|"R9 RLS compute engine shared python sqlglot AST"| analytics
  audit_logs -.->|"R9 rls predicate filter on mention results high"| dimensions
  groups -.->|"R11 group membership ABAC user attribute source high"| audit_logs
  _incremental -.->|"R1 SDX ViewPlan CanonicalRelExpr one IR high"| view_builder
  view_builder -.->|"R4 canvas resolves intent hands to avb medium"| auto_view_builder
  domain_ontology -.->|"R4 confirmed structural items grain join roles medium"| auto_view_builder
  domain_ontology -.->|"R5 semantics checklist rendered in view-builder Onboarding medium"| view_builder
  domain_ontology -.->|"R6 AppliedUnderstanding prose sink jargon descriptions medium"| bkb
  auto_view_builder -->|"R6 ViewPlan ViewRegistry structural sink sole writer"| bkb
  bkb -.->|"R8 mentionable event mentionable column change medium"| dimensions
  on_prem_regulated -.->|"R12 on-prem LLM egress allowlist high"| llmrelay
  self_registration -.->|"R13 demo org assignment demo tier credit limit medium"| billing
  groups -.->|"R14 chat S2S consumer still reads legacy teams context medium"| chat
  _incremental -->|"R2 delta engine replaces full replace path active"| schema_discovery
  schema_discovery -->|"R2 table registry entry on DDL completion first load"| bkb
  schema_discovery -->|"R2 DDL inference output feeds incremental engine first load"| _incremental
  _incremental -->|"R10 DatasetLoaded event mention re-sync MV refresh"| bkb
  result_visualization -.->|"R3 chart on one answer vs saved scheduled report deferred"| reports_and_dashboard
  reports_and_dashboard -.->|"R3 report pack vs agent dashboard context deferred"| dashboard_context
  view_builder -->|"V1 lock gate twelve atomic guarantees tenant drop"| view_ir_atomic_guarantees
  bkb -->|"accessible views manifest view scoped rules"| chat
  chat -->|"SQL exec via analytics service circuit breaker"| analytics
  chat -->|"visualize picker five type cascade"| result_visualization
  chat -->|"LangGraph LLM calls via llmrelay"| llmrelay
  chat -->|"R7 predict tool mirrors sql rag tool pattern"| predict
  predict -->|"named StarRocks semantic layer views"| view_builder
  predictive_tiers -->|"Tier one stat SQL runs in analytics service"| analytics
  predictive_tiers -->|"Tier two three reads from semantic views"| view_builder
  domain_ontology -->|"bootstrap classify LLM calls via llmrelay"| llmrelay
  domain_ontology -->|"AppliedUnderstanding written to BKB chat reads BKB"| chat
  domain_ontology -.->|"semantic context fed directly to the agent planned"| chat
  reports_and_dashboard -.->|"views are what reports query"| view_builder
  reports_and_dashboard -.->|"reports dashboards composed from chart blocks"| result_visualization
  analytics -->|"no share boundary SQL dispatched to on prem agent"| on_prem_regulated
  on_prem_regulated -->|"no share RLS injected in cloud before dispatch"| analytics
  on_prem_regulated -->|"medical content access audit requirements"| audit_logs
  on_prem_regulated -->|"mention eligibility per dimension contract"| dimensions
  llmrelay -->|"sole LLM embedding proxy purpose header model routing"| bifrost_gateway
  bifrost_gateway -->|"usage event token counts raw provider payload"| billing
  billing -->|"credit deducted trial ended plan changed notifications"| notifications
  iam -->|"invite sent email verification notification job"| notifications
  billing -->|"billing domain events via PG outbox Hatchet worker"| async_event_system
  self_registration -->|"demo org callback in OIDC auth flow"| iam
  invite_acceptance_flow -->|"invite code accept silent reauth org scoped"| iam
  groups -->|"org workspace group membership platform core"| iam
  teams -->|"groups replaces teams legacy tables removed active"| groups
  smriti_cli -->|"device flow API key Cobra commands MCP server"| auth_go_cli_sdk
  agent_tools -->|"external model invocation via MCP"| ml_models
  mock_data_workflow -->|"demo spec generator seeds BKB directly active"| bkb
  bkb_seed -->|"seeds BKB for test dev staging idempotent"| bkb`

    const parsed = await buildGraph(source)
    expect(parsed.success).toBe(true)
    expect(parsed.graph).toBeDefined()

    const result = new BlueprintLayout().compute(parsed.graph!)

    expect(result.nodes.size).toBe(47)
    expect(result.subgraphs.size).toBe(7)
    expect(result.width / result.height).toBeLessThan(2.2)
    expect(result.height).toBeGreaterThan(2500)
  })

  it('produces edges with at least 2 points', () => {
    const layout = new BlueprintLayout()
    const result = layout.compute(makeGraph())
    expect(result.edges.length).toBe(2)
    for (const edge of result.edges) {
      expect(edge.points.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('handles empty graph', () => {
    const layout = new BlueprintLayout()
    const emptyGraph: RenderGraph = {
      nodes: new Map(),
      edges: [],
      subgraphs: new Map(),
      directives: [],
      direction: 'TD',
      diagramType: 'flowchart',
    }
    const result = layout.compute(emptyGraph)
    expect(result.nodes.size).toBe(0)
    expect(result.edges.length).toBe(0)
  })
})

// ── Line-Rect Intersection ────────────────────────────────────────────────────

describe('lineIntersectsRect', () => {
  it('detects a line passing through a rectangle', () => {
    // Line from (0,0) to (200,0), rect centered at (100,0) with 40x40
    expect(lineIntersectsRect(0, 0, 200, 0, 100, 0, 20, 20)).toBe(true)
  })

  it('returns false for a line that misses the rectangle', () => {
    // Line from (0,0) to (200,0), rect centered at (100,50) with 40x40
    expect(lineIntersectsRect(0, 0, 200, 0, 100, 50, 20, 20)).toBe(false)
  })

  it('detects diagonal line through rectangle', () => {
    // Line from (0,0) to (200,200), rect centered at (100,100) with 40x40
    expect(lineIntersectsRect(0, 0, 200, 200, 100, 100, 20, 20)).toBe(true)
  })

  it('returns false when line ends before rectangle', () => {
    // Line from (0,0) to (50,0), rect centered at (100,0) with 20x20
    expect(lineIntersectsRect(0, 0, 50, 0, 100, 0, 10, 10)).toBe(false)
  })
})

// ── Edge Collision Avoidance ──────────────────────────────────────────────────

describe('avoidEdgeCollisions', () => {
  it('reroutes edge that passes through an intermediate node', () => {
    const nodes = new Map<string, PositionedNode>([
      ['A', { id: 'A', label: 'A', shape: 'rectangle', metadata: {}, x: 0, y: 0, width: 40, height: 40 }],
      ['B', { id: 'B', label: 'B', shape: 'rectangle', metadata: {}, x: 100, y: 0, width: 40, height: 40 }],
      ['C', { id: 'C', label: 'C', shape: 'rectangle', metadata: {}, x: 200, y: 0, width: 40, height: 40 }],
    ])

    const edges: PositionedEdge[] = [
      {
        id: 'e0', source: 'A', target: 'C', style: 'solid',
        points: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
      },
    ]

    const result = avoidEdgeCollisions(edges, nodes)
    expect(result.length).toBe(1)
    // The edge should now have 3 points (source, waypoint, target)
    expect(result[0].points.length).toBe(3)
    // The waypoint should NOT be at y=0 (it was rerouted around node B)
    const waypoint = result[0].points[1]
    expect(waypoint.y).not.toBe(0)
  })

  it('does not modify edges that have no collisions', () => {
    const nodes = new Map<string, PositionedNode>([
      ['A', { id: 'A', label: 'A', shape: 'rectangle', metadata: {}, x: 0, y: 0, width: 40, height: 40 }],
      ['B', { id: 'B', label: 'B', shape: 'rectangle', metadata: {}, x: 0, y: 200, width: 40, height: 40 }],
      ['C', { id: 'C', label: 'C', shape: 'rectangle', metadata: {}, x: 200, y: 100, width: 40, height: 40 }],
    ])

    const edges: PositionedEdge[] = [
      {
        id: 'e0', source: 'A', target: 'B', style: 'solid',
        points: [{ x: 0, y: 0 }, { x: 0, y: 200 }],
      },
    ]

    const result = avoidEdgeCollisions(edges, nodes)
    expect(result.length).toBe(1)
    // Edge should remain unchanged (2 points)
    expect(result[0].points.length).toBe(2)
  })

  it('skips collision check against source and target nodes', () => {
    const nodes = new Map<string, PositionedNode>([
      ['A', { id: 'A', label: 'A', shape: 'rectangle', metadata: {}, x: 0, y: 0, width: 40, height: 40 }],
      ['B', { id: 'B', label: 'B', shape: 'rectangle', metadata: {}, x: 100, y: 0, width: 40, height: 40 }],
    ])

    const edges: PositionedEdge[] = [
      {
        id: 'e0', source: 'A', target: 'B', style: 'solid',
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      },
    ]

    const result = avoidEdgeCollisions(edges, nodes)
    // Should not reroute since line only passes through source and target
    expect(result[0].points.length).toBe(2)
  })
})

// ── computeWaypoint ───────────────────────────────────────────────────────────

describe('computeWaypoint', () => {
  it('produces a waypoint offset from the obstacle', () => {
    const wp = computeWaypoint(0, 0, 200, 0, 100, 0, 40, 40)
    // Waypoint should be at x=100 (same x as obstacle) but offset in y
    expect(wp.x).toBe(100)
    expect(Math.abs(wp.y)).toBe(30) // nodeWidth/2 + margin = 20 + 10 = 30
  })
})
