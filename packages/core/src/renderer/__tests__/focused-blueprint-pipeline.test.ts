import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const builderRoute = vi.fn()
const builderConstruct = vi.fn()
const edgeDrawSegments = vi.fn()
const nodeHandlers = new Map<string, string[]>()

vi.mock('../../router/blueprint-wire-builder', () => ({
  BlueprintWireBuilder: class {
    constructor(...args: unknown[]) {
      builderConstruct(...args)
    }

    route() {
      return builderRoute()
    }
  },
}))

vi.mock('../load-pipeline', () => ({
  LoadPipeline: class {},
  createLayoutEngine: () => ({
    compute: (graph: any) => ({
      ...graph,
      width: 640,
      height: 480,
    }),
  }),
}))

vi.mock('../edge-graphic', () => ({
  EdgeGraphic: class {
    data: any
    alpha = 1
    orthogonalSegments = [{ x1: 0, y1: 0, x2: 20, y2: 0, isHorizontal: true }]

    constructor(edge: any, ...args: unknown[]) {
      this.data = edge
      edgeConstruct(edge, ...args)
    }

    drawFromSegments(...args: unknown[]) {
      edgeDrawSegments(...args)
    }

    on() {}
    setHovered() {}
    setSelected() {}
    setCalloutBadges() {}
  },
}))

vi.mock('../node-sprite', () => ({
  NodeSprite: class {
    data: any
    alpha = 1

    constructor(node: any) {
      this.data = node
      nodeConstruct(node)
      nodeHandlers.set(node.id, [])
    }

    on(event: string) {
      nodeHandlers.get(this.data.id)?.push(event)
    }
    getSemanticSubitemAt() {
      return null
    }
    setCalloutBadges() {}
  },
}))

vi.mock('../wire-hops', () => ({
  drawWireHops: () => ({}),
}))

const edgeConstruct = vi.fn()
const nodeConstruct = vi.fn()

describe('focused Blueprint rendering', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: () => ({
        fillStyle: '',
        globalCompositeOperation: 'source-over',
        fillRect() {},
        drawImage() {},
        getImageData() {
          return { data: new Uint8ClampedArray(4) }
        },
      }),
      configurable: true,
    })
  })

  beforeEach(() => {
    builderRoute.mockReset()
    builderConstruct.mockReset()
    edgeConstruct.mockReset()
    edgeDrawSegments.mockReset()
    nodeConstruct.mockReset()
    nodeHandlers.clear()
    builderRoute.mockReturnValue({
      wires: [
        {
          edgeId: 'outside-in-to-b',
          segments: [{ x1: 0, y1: 0, x2: 20, y2: 0, isHorizontal: true }],
        },
        {
          edgeId: 'b-to-c',
          segments: [{ x1: 20, y1: 0, x2: 40, y2: 0, isHorizontal: true }],
        },
        {
          edgeId: 'c-to-outside',
          segments: [{ x1: 40, y1: 0, x2: 60, y2: 0, isHorizontal: true }],
        },
      ],
      congested: false,
      diagnostics: [],
    })
  })

  it('uses Blueprint routing and interaction for a focused view with only faded one-hop stubs', async () => {
    const { MermaidRenderer } = await import('../mermaid-renderer')
    const renderer = new MermaidRenderer({ themeMode: 'dark' }) as any
    const nodes = new Map([
      ['outside-in', { id: 'outside-in', label: 'Outside in', x: 40, y: 80, width: 100, height: 40 }],
      ['stub-source', { id: 'stub-source', label: 'Stub source', x: 20, y: 40, width: 100, height: 40 }],
      ['b', { id: 'b', label: 'B', x: 200, y: 120, width: 100, height: 40 }],
      ['c', { id: 'c', label: 'C', x: 360, y: 120, width: 100, height: 40 }],
      ['outside-out', { id: 'outside-out', label: 'Outside out', x: 520, y: 160, width: 100, height: 40 }],
      ['stub-target', { id: 'stub-target', label: 'Stub target', x: 620, y: 200, width: 100, height: 40 }],
    ])
    const edges = [
      { id: 'outside-in-to-b', source: 'outside-in', target: 'b', points: [{ x: 40, y: 80 }, { x: 200, y: 120 }] },
      { id: 'stub-source-to-outside-in', source: 'stub-source', target: 'outside-in', points: [{ x: 20, y: 40 }, { x: 40, y: 80 }] },
      { id: 'b-to-c', source: 'b', target: 'c', points: [{ x: 200, y: 120 }, { x: 360, y: 120 }] },
      { id: 'c-to-outside', source: 'c', target: 'outside-out', points: [{ x: 360, y: 120 }, { x: 520, y: 160 }] },
      { id: 'outside-out-to-stub-target', source: 'outside-out', target: 'stub-target', points: [{ x: 520, y: 160 }, { x: 620, y: 200 }] },
    ]

    renderer._graph = {
      nodes,
      edges,
      directives: [],
      subgraphs: new Map([
        ['core', { id: 'core', label: 'Core', nodeIds: ['b', 'c'] }],
      ]),
    }
    renderer._viewport = {
      removeChildren: vi.fn(),
      addChild: vi.fn(),
    }
    renderer._app = {
      ticker: {
        started: true,
        start: vi.fn(),
        stop: vi.fn(),
      },
    }
    renderer._currentPhilosophy = 'blueprint'
    renderer._focusStack = []
    renderer._getActiveTheme = () => ({
      gridSize: 20,
      edgeColor: 0xffffff,
      dimmedAlpha: 0.18,
      hoverDimmedAlpha: 0.08,
    })
    renderer._wireEdgeInteraction = vi.fn()
    renderer._emitEdgeNodeCrossingWarning = vi.fn()
    renderer._emitBreadcrumb = vi.fn()
    renderer.fitToView = vi.fn()
    renderer._updateDetailLevel = vi.fn()
    renderer._applyPerformanceModeDetails = vi.fn()
    renderer._assertUsable = vi.fn()

    renderer.focusSubgraph('core')

    expect(builderConstruct).toHaveBeenCalledTimes(1)
    expect(builderRoute).toHaveBeenCalledTimes(1)
    expect(edgeConstruct).toHaveBeenCalledTimes(3)
    expect(edgeConstruct.mock.calls.every(([, , , philosophy]) => philosophy === 'blueprint-routed')).toBe(true)
    expect(edgeDrawSegments).toHaveBeenCalledTimes(3)
    expect(renderer._wireEdgeInteraction).toHaveBeenCalledTimes(3)

    const renderedNodeIds = [...renderer._nodeSprites.keys()]
    expect(renderedNodeIds).toEqual(expect.arrayContaining(['b', 'c', '_stub_outside-in', '_stub_outside-out']))
    expect(renderedNodeIds).not.toEqual(expect.arrayContaining(['_stub_stub-source', '_stub_stub-target']))
    expect(renderer._nodeSprites.get('_stub_outside-in').alpha).toBe(0.4)
    expect(renderer._nodeSprites.get('_stub_outside-out').alpha).toBe(0.4)
  })

  it('does not wire pointer interactions or raw stub ids onto focused boundary nodes', async () => {
    const { MermaidRenderer } = await import('../mermaid-renderer')
    const renderer = new MermaidRenderer({ themeMode: 'dark' }) as any
    const nodes = new Map([
      ['outside-in', { id: 'outside-in', label: 'Outside in', x: 40, y: 80, width: 100, height: 40 }],
      ['b', { id: 'b', label: 'B', x: 200, y: 120, width: 100, height: 40 }],
      ['c', { id: 'c', label: 'C', x: 360, y: 120, width: 100, height: 40 }],
      ['outside-out', { id: 'outside-out', label: 'Outside out', x: 520, y: 160, width: 100, height: 40 }],
    ])
    const edges = [
      { id: 'outside-to-b', source: 'outside-in', target: 'b', points: [{ x: 40, y: 80 }, { x: 200, y: 120 }] },
      { id: 'b-to-c', source: 'b', target: 'c', points: [{ x: 200, y: 120 }, { x: 360, y: 120 }] },
      { id: 'c-to-outside', source: 'c', target: 'outside-out', points: [{ x: 360, y: 120 }, { x: 520, y: 160 }] },
    ]

    renderer._graph = {
      nodes,
      edges,
      directives: [],
      direction: 'TD',
      diagramType: 'flowchart',
      subgraphs: new Map([
        ['core', { id: 'core', label: 'Core', nodeIds: ['b', 'c'] }],
      ]),
    }
    renderer._viewport = {
      removeChildren: vi.fn(),
      addChild: vi.fn(),
    }
    renderer._app = { ticker: { started: false, start: vi.fn() } }
    renderer._currentPhilosophy = 'blueprint'
    renderer._focusStack = []
    renderer._getActiveTheme = () => ({ gridSize: 20, edgeColor: 0xffffff })
    renderer._wireEdgeInteraction = vi.fn()
    renderer._emitEdgeNodeCrossingWarning = vi.fn()
    renderer._emitBreadcrumb = vi.fn()
    renderer.fitToView = vi.fn()
    renderer._updateDetailLevel = vi.fn()
    renderer._applyPerformanceModeDetails = vi.fn()
    renderer._assertUsable = vi.fn()

    renderer.focusSubgraph('core')

    expect(nodeHandlers.get('_stub_outside-in')).toEqual([])
    expect(nodeHandlers.get('_stub_outside-out')).toEqual([])
    expect([...nodeHandlers.keys()].filter((id) => id.startsWith('_stub_'))).toEqual([
      '_stub_outside-in',
      '_stub_outside-out',
    ])
  })
})
