import { describe, expect, it, vi } from 'vitest'

// BitmapFont installation needs a real canvas 2D context, which jsdom lacks.
// The badge itself is pure Graphics; only labels would need fonts, and these
// tests use empty labels and count-less badges.
vi.mock('../fonts', () => ({ ensureFontsInstalled: () => {} }))

import {
  computeEdgeCalloutBadgePosition,
  computeNodeCalloutBadgePosition,
  computeSubgraphCalloutBadgePosition,
  CALLOUT_BADGE_CORNER_INSET,
  CALLOUT_BADGE_HOVER_SCALE,
  CALLOUT_BADGE_LINK_CLEARANCE,
  CALLOUT_BADGE_RADIUS,
  orderCalloutBadgeStates,
} from '../callout-badge'
import { estimateRenderedNodeFootprint } from '../../node-footprint'

const nodeTheme = {
  accent: 0x3b82f6,
  commentAccent: 0xf59e0b,
  background: 0x0b1220,
  cornerRadius: 8,
  nodeFill: 0x1e293b,
  nodeStroke: 0x475569,
  nodeStrokeSelected: 0x93c5fd,
  nodeText: 0xf1f5f9,
  strokeWidth: 1.5,
  hoverGlow: 0x60a5fa,
  hoverGlowAlpha: 0.35,
  edgeColor: 0x64748b,
  edgeLabelColor: 0xcbd5e1,
  dimmedAlpha: 0.42,
  hoverDimmedAlpha: 0.2,
} as any

describe('callout badge local geometry', () => {
  it('places a node badge at the top-right corner in local coordinates', () => {
    const position = computeNodeCalloutBadgePosition(120, 48, false)
    expect(position).toEqual({
      x: 60 - CALLOUT_BADGE_CORNER_INSET,
      y: -24 + CALLOUT_BADGE_CORNER_INSET,
    })
  })

  it('shifts the node badge left of an existing link badge', () => {
    const withLink = computeNodeCalloutBadgePosition(120, 48, true)
    const withoutLink = computeNodeCalloutBadgePosition(120, 48, false)
    expect(withLink.y).toBe(withoutLink.y)
    expect(withoutLink.x - withLink.x).toBe(CALLOUT_BADGE_LINK_CLEARANCE)
  })

  it('places a subgraph badge in the header band, left of the count pill', () => {
    const noPill = computeSubgraphCalloutBadgePosition(400, 200, 0)
    expect(noPill).toEqual({ x: 200 - 10 - CALLOUT_BADGE_RADIUS, y: -100 + 15 })

    const withPill = computeSubgraphCalloutBadgePosition(400, 200, 24)
    expect(withPill.y).toBe(noPill.y)
    expect(noPill.x - withPill.x).toBe(24 + 8)
  })

  it('lifts an edge badge off the wire midpoint', () => {
    expect(computeEdgeCalloutBadgePosition({ x: 50, y: 10 })).toEqual({ x: 50, y: -4 })
  })

  it('steps each additional marker slot aside by the shared clearance', () => {
    const nodeSlot0 = computeNodeCalloutBadgePosition(120, 48, false, 0)
    const nodeSlot1 = computeNodeCalloutBadgePosition(120, 48, false, 1)
    expect(nodeSlot0.x - nodeSlot1.x).toBe(CALLOUT_BADGE_LINK_CLEARANCE)
    expect(nodeSlot1.y).toBe(nodeSlot0.y)

    const subgraphSlot0 = computeSubgraphCalloutBadgePosition(400, 200, 0, 0)
    const subgraphSlot1 = computeSubgraphCalloutBadgePosition(400, 200, 0, 1)
    expect(subgraphSlot0.x - subgraphSlot1.x).toBe(CALLOUT_BADGE_LINK_CLEARANCE)

    const edgeSlot0 = computeEdgeCalloutBadgePosition({ x: 50, y: 10 }, 0)
    const edgeSlot1 = computeEdgeCalloutBadgePosition({ x: 50, y: 10 }, 1)
    expect(edgeSlot1.x - edgeSlot0.x).toBe(CALLOUT_BADGE_LINK_CLEARANCE)
    expect(edgeSlot1.y).toBe(edgeSlot0.y)
  })

  it('orders marker states callout-first with one badge per kind', () => {
    expect(
      orderCalloutBadgeStates([
        { kind: 'comment', count: 2 },
        { kind: 'callout' },
      ]),
    ).toEqual([{ kind: 'callout' }, { kind: 'comment', count: 2 }])

    // Last push per kind wins; a lone comment pin takes the corner slot.
    expect(
      orderCalloutBadgeStates([
        { kind: 'comment', count: 2 },
        { kind: 'comment', count: 5 },
      ]),
    ).toEqual([{ kind: 'comment', count: 5 }])
  })
})

describe('NodeSprite callout badge', () => {
  async function makeSprite() {
    const { NodeSprite } = await import('../node-sprite')
    const node = {
      id: 'a',
      label: '',
      shape: 'rectangle',
      x: 0,
      y: 0,
      width: 120,
      height: 48,
    } as any
    return { sprite: new NodeSprite(node, nodeTheme), node }
  }

  it('attaches a badge child at the top-right corner and clears it again', async () => {
    const { sprite, node } = await makeSprite()

    expect(sprite.hasCalloutBadge()).toBe(false)

    sprite.setCalloutBadges([{ kind: 'callout' }])
    expect(sprite.hasCalloutBadge()).toBe(true)

    const footprint = estimateRenderedNodeFootprint(node, false)
    expect(sprite.getCalloutBadgeDebug()).toEqual(
      computeNodeCalloutBadgePosition(footprint.width, footprint.height, false),
    )

    sprite.setCalloutBadges([])
    expect(sprite.hasCalloutBadge()).toBe(false)
    expect(sprite.getCalloutBadgeDebug()).toBeNull()
  })

  it('survives an internal rebuild (theme/appearance update)', async () => {
    const { sprite } = await makeSprite()
    sprite.setCalloutBadges([{ kind: 'callout' }])

    sprite.updateAppearance(nodeTheme, false)

    expect(sprite.hasCalloutBadge()).toBe(true)
  })

  it('carries a callout badge and a comment pin side by side without overlap', async () => {
    const { sprite, node } = await makeSprite()

    sprite.setCalloutBadges([
      { kind: 'comment' },
      { kind: 'callout' },
    ])

    expect(sprite.hasCalloutBadge('callout')).toBe(true)
    expect(sprite.hasCalloutBadge('comment')).toBe(true)

    const footprint = estimateRenderedNodeFootprint(node, false)
    // Callout keeps the corner slot; the comment pin sits one clearance left.
    expect(sprite.getCalloutBadgeDebug('callout')).toEqual(
      computeNodeCalloutBadgePosition(footprint.width, footprint.height, false, 0),
    )
    expect(sprite.getCalloutBadgeDebug('comment')).toEqual(
      computeNodeCalloutBadgePosition(footprint.width, footprint.height, false, 1),
    )

    // The global hit test discriminates the two markers by kind.
    const calloutLocal = sprite.getCalloutBadgeDebug('callout')!
    const commentLocal = sprite.getCalloutBadgeDebug('comment')!
    const calloutGlobal = sprite.toGlobal({ x: calloutLocal.x, y: calloutLocal.y })
    const commentGlobal = sprite.toGlobal({ x: commentLocal.x, y: commentLocal.y })
    expect(sprite.getCalloutBadgeAt(calloutGlobal.x, calloutGlobal.y)?.kind).toBe('callout')
    expect(sprite.getCalloutBadgeAt(commentGlobal.x, commentGlobal.y)?.kind).toBe('comment')

    // Clearing to one kind drops the other and promotes it to the corner slot.
    sprite.setCalloutBadges([{ kind: 'comment' }])
    expect(sprite.hasCalloutBadge('callout')).toBe(false)
    expect(sprite.getCalloutBadgeDebug('comment')).toEqual(
      computeNodeCalloutBadgePosition(footprint.width, footprint.height, false, 0),
    )
  })
})

describe('EdgeGraphic callout badge', () => {
  async function makeEdge() {
    const { EdgeGraphic } = await import('../edge-graphic')
    const edge = {
      id: 'e1',
      source: 'a',
      target: 'b',
      style: 'solid',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    } as any
    return { edgeGraphic: new EdgeGraphic(edge, nodeTheme), edge }
  }

  it('attaches a badge child lifted off the path midpoint', async () => {
    const { edgeGraphic } = await makeEdge()

    edgeGraphic.setCalloutBadges([{ kind: 'callout' }])

    expect(edgeGraphic.hasCalloutBadge()).toBe(true)
    expect(edgeGraphic.getCalloutBadgeDebug()).toEqual(
      computeEdgeCalloutBadgePosition({ x: 50, y: 0 }),
    )
    // The composite hit area keeps the badge clickable outside the wire corridor.
    const hitArea = edgeGraphic.hitArea as { contains(x: number, y: number): boolean }
    expect(hitArea.contains(50, -20)).toBe(true)
    expect(hitArea.contains(50, 0)).toBe(true)
  })

  it('survives a redraw and disappears when cleared', async () => {
    const { edgeGraphic, edge } = await makeEdge()
    edgeGraphic.setCalloutBadges([{ kind: 'callout' }])

    edgeGraphic.redraw(edge, nodeTheme)
    expect(edgeGraphic.hasCalloutBadge()).toBe(true)

    edgeGraphic.setCalloutBadges([])
    expect(edgeGraphic.hasCalloutBadge()).toBe(false)
    // Plain polyline hit area restored: badge circle no longer hittable.
    const hitArea = edgeGraphic.hitArea as { contains(x: number, y: number): boolean }
    expect(hitArea.contains(50, -20)).toBe(false)
  })

  it('keeps both marker kinds clickable through the composite hit area', async () => {
    const { edgeGraphic } = await makeEdge()

    edgeGraphic.setCalloutBadges([
      { kind: 'callout' },
      { kind: 'comment' },
    ])

    const calloutPosition = edgeGraphic.getCalloutBadgeDebug('callout')!
    const commentPosition = edgeGraphic.getCalloutBadgeDebug('comment')!
    expect(commentPosition.x - calloutPosition.x).toBe(CALLOUT_BADGE_LINK_CLEARANCE)

    const hitArea = edgeGraphic.hitArea as { contains(x: number, y: number): boolean }
    expect(hitArea.contains(calloutPosition.x, calloutPosition.y)).toBe(true)
    expect(hitArea.contains(commentPosition.x, commentPosition.y)).toBe(true)

    const commentGlobal = edgeGraphic.toGlobal(commentPosition)
    expect(
      edgeGraphic.getCalloutBadgeAt(commentGlobal.x, commentGlobal.y)?.kind,
    ).toBe('comment')
  })
})

describe('MermaidRenderer.setCalloutBadges', () => {
  function fakeAnchorSprite() {
    return { data: {}, setCalloutBadges: vi.fn() }
  }

  /**
   * Real NodeSprite rendered through `_renderGraph` with a badge on node
   * `a`, faking only the viewport/app plumbing jsdom cannot provide.
   */
  async function renderNodeWithBadge() {
    const { MermaidRenderer } = await import('../mermaid-renderer')
    const renderer = new MermaidRenderer() as any

    renderer._viewport = {
      removeChildren: vi.fn(),
      addChild: vi.fn(),
      addChildAt: vi.fn(),
      setChildIndex: vi.fn(),
      scale: { x: 1, y: 1 },
      x: 0,
      y: 0,
      _zoom: 1,
    }
    renderer._app = { ticker: { started: true, start: vi.fn(), stop: vi.fn() } }
    renderer._currentPhilosophy = 'narrative'
    renderer._graph = null
    renderer._focusStack = []
    renderer._getActiveTheme = () => nodeTheme
    renderer.fitToView = vi.fn()
    renderer._updateDetailLevel = vi.fn()
    renderer._applyPerformanceModeDetails = vi.fn()

    renderer.setCalloutBadges([{ anchorKind: 'node', anchorId: 'a' }])
    renderer._renderGraph({
      width: 640,
      height: 480,
      nodes: new Map([
        [
          'a',
          { id: 'a', label: '', shape: 'rectangle', x: 60, y: 24, width: 120, height: 48 },
        ],
      ]),
      edges: [],
      subgraphs: new Map(),
    })

    const sprite = renderer._nodeSprites.get('a')
    expect(sprite.hasCalloutBadge()).toBe(true)
    return { renderer, sprite }
  }

  it('pushes badge state to node, subgraph, and edge sprites and clears it', async () => {
    const { MermaidRenderer } = await import('../mermaid-renderer')
    const renderer = new MermaidRenderer() as any

    const nodeSprite = fakeAnchorSprite()
    const otherNode = fakeAnchorSprite()
    const subgraph = fakeAnchorSprite()
    const edge = { data: { id: 'e1' }, setCalloutBadges: vi.fn() }
    renderer._nodeSprites = new Map([
      ['a', nodeSprite],
      ['b', otherNode],
    ])
    renderer._subgraphContainers = new Map([['SG', subgraph]])
    renderer._edgeGraphics = [edge]

    renderer.setCalloutBadges([
      { anchorKind: 'node', anchorId: 'a', count: 3 },
      { anchorKind: 'node', anchorId: 'a', kind: 'comment', count: 2 },
      { anchorKind: 'subgraph', anchorId: 'SG' },
      { anchorKind: 'edge', anchorId: 'e1', count: 1 },
    ])

    // An unspecified kind defaults to 'callout'; a node can carry both kinds.
    expect(nodeSprite.setCalloutBadges).toHaveBeenLastCalledWith([
      { kind: 'callout', count: 3 },
      { kind: 'comment', count: 2 },
    ])
    expect(otherNode.setCalloutBadges).toHaveBeenLastCalledWith([])
    expect(subgraph.setCalloutBadges).toHaveBeenLastCalledWith([{ kind: 'callout' }])
    expect(edge.setCalloutBadges).toHaveBeenLastCalledWith([{ kind: 'callout', count: 1 }])

    renderer.clearCalloutBadges()
    expect(nodeSprite.setCalloutBadges).toHaveBeenLastCalledWith([])
    expect(subgraph.setCalloutBadges).toHaveBeenLastCalledWith([])
    expect(edge.setCalloutBadges).toHaveBeenLastCalledWith([])
    expect(renderer.getCalloutBadges()).toEqual([])
  })

  it('re-applies the stored badge set to freshly rebuilt sprites in _renderGraph', async () => {
    const { MermaidRenderer } = await import('../mermaid-renderer')
    const renderer = new MermaidRenderer() as any

    renderer._viewport = {
      removeChildren: vi.fn(),
      addChild: vi.fn(),
      addChildAt: vi.fn(),
      setChildIndex: vi.fn(),
      scale: { x: 1, y: 1 },
      x: 0,
      y: 0,
      _zoom: 1,
    }
    renderer._app = { ticker: { started: true, start: vi.fn(), stop: vi.fn() } }
    renderer._currentPhilosophy = 'narrative'
    renderer._graph = null
    renderer._focusStack = []
    renderer._getActiveTheme = () => nodeTheme
    renderer.fitToView = vi.fn()
    renderer._updateDetailLevel = vi.fn()
    renderer._applyPerformanceModeDetails = vi.fn()

    // No `count`: a numbered badge renders a BitmapText, which needs real
    // canvas font measurement jsdom cannot provide.
    renderer.setCalloutBadges([{ anchorKind: 'node', anchorId: 'a' }])

    const positioned = {
      width: 640,
      height: 480,
      nodes: new Map([
        [
          'a',
          { id: 'a', label: '', shape: 'rectangle', x: 60, y: 24, width: 120, height: 48 },
        ],
      ]),
      edges: [],
      subgraphs: new Map(),
    }

    renderer._renderGraph(positioned)

    const rebuiltSprite = renderer._nodeSprites.get('a')
    expect(rebuiltSprite).toBeTruthy()
    expect(rebuiltSprite.hasCalloutBadge()).toBe(true)
    expect(renderer.getCalloutBadges()).toEqual([
      { anchorKind: 'node', anchorId: 'a' },
    ])
  })

  it('routes node taps inside the badge radius to callout:click, not node:click', async () => {
    const { renderer, sprite } = await renderNodeWithBadge()

    const calloutClicks: unknown[] = []
    const nodeClicks: unknown[] = []
    renderer.on('callout:click', (event: unknown) => calloutClicks.push(event))
    renderer.on('node:click', (event: unknown) => nodeClicks.push(event))

    // Tap at the badge's centre, expressed in global (screen) coordinates —
    // the same space `pointertap` events report. The badge child is not a
    // pointer target; the sprite's own handler must route this tap.
    const badgeLocal = sprite.getCalloutBadgeDebug()
    const badgeGlobal = sprite.toGlobal({ x: badgeLocal.x, y: badgeLocal.y })
    sprite.emit('pointertap', { global: badgeGlobal, nativeEvent: undefined })

    expect(calloutClicks).toHaveLength(1)
    expect(calloutClicks[0]).toMatchObject({
      anchorKind: 'node',
      anchorId: 'a',
      eventType: 'click',
    })
    expect(nodeClicks).toHaveLength(0)
    expect(renderer._selectedNodeIds.size).toBe(0)

    // A tap elsewhere on the node still behaves as a node click + selection.
    const centerGlobal = sprite.toGlobal({ x: 0, y: 0 })
    sprite.emit('pointertap', { global: centerGlobal, nativeEvent: undefined })

    expect(calloutClicks).toHaveLength(1)
    expect(nodeClicks).toHaveLength(1)
    expect(nodeClicks[0]).toMatchObject({ nodeId: 'a', eventType: 'click' })
    expect(renderer._selectedNodeIds.has('a')).toBe(true)
  })

  it('expands the badge on hover via host-routed pointer moves and resets exactly once on leave', async () => {
    const { renderer, sprite } = await renderNodeWithBadge()

    const hovers: unknown[] = []
    const hoverEnds: unknown[] = []
    renderer.on('callout:hover', (event: unknown) => hovers.push(event))
    renderer.on('callout:hoverend', (event: unknown) => hoverEnds.push(event))

    const badgeLocal = sprite.getCalloutBadgeDebug()
    const badgeGlobal = sprite.toGlobal({ x: badgeLocal.x, y: badgeLocal.y })
    const centerGlobal = sprite.toGlobal({ x: 0, y: 0 })

    // Entering the badge applies the hover scale and fires callout:hover once.
    sprite.emit('pointermove', { global: badgeGlobal, nativeEvent: undefined })
    sprite.emit('pointermove', { global: badgeGlobal, nativeEvent: undefined })
    expect(sprite.getCalloutBadgeHoverScale()).toBe(CALLOUT_BADGE_HOVER_SCALE)
    expect(hovers).toHaveLength(1)
    expect(hovers[0]).toMatchObject({ anchorKind: 'node', anchorId: 'a', eventType: 'hover' })
    expect(hoverEnds).toHaveLength(0)

    // Leaving the badge while STAYING on the node resets the scale and fires
    // callout:hoverend exactly once.
    sprite.emit('pointermove', { global: centerGlobal, nativeEvent: undefined })
    sprite.emit('pointermove', { global: centerGlobal, nativeEvent: undefined })
    expect(sprite.getCalloutBadgeHoverScale()).toBe(1)
    expect(hoverEnds).toHaveLength(1)

    // Re-enter, then leave the node entirely: hoverend fires once more.
    sprite.emit('pointermove', { global: badgeGlobal, nativeEvent: undefined })
    expect(hovers).toHaveLength(2)
    sprite.emit('pointerout', { nativeEvent: undefined })
    expect(sprite.getCalloutBadgeHoverScale()).toBe(1)
    expect(hoverEnds).toHaveLength(2)
  })

  it('routes edge taps inside the badge radius to callout:click, not edge:click', async () => {
    const { MermaidRenderer } = await import('../mermaid-renderer')
    const { EdgeGraphic } = await import('../edge-graphic')
    const renderer = new MermaidRenderer() as any

    const edge = {
      id: 'e1',
      source: 'a',
      target: 'b',
      style: 'solid',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    } as any
    const edgeGraphic = new EdgeGraphic(edge, nodeTheme)
    renderer._edgeGraphics = [edgeGraphic]
    renderer._wireEdgeInteraction(edgeGraphic)
    renderer.setCalloutBadges([{ anchorKind: 'edge', anchorId: 'e1' }])

    const calloutClicks: unknown[] = []
    const edgeClicks: unknown[] = []
    renderer.on('callout:click', (event: unknown) => calloutClicks.push(event))
    renderer.on('edge:click', (event: unknown) => edgeClicks.push(event))

    const badgeLocal = edgeGraphic.getCalloutBadgeDebug()!
    const badgeGlobal = edgeGraphic.toGlobal({ x: badgeLocal.x, y: badgeLocal.y })
    edgeGraphic.emit('pointertap', { global: badgeGlobal, nativeEvent: undefined } as any)

    expect(calloutClicks).toHaveLength(1)
    expect(calloutClicks[0]).toMatchObject({
      anchorKind: 'edge',
      anchorId: 'e1',
      eventType: 'click',
    })
    expect(edgeClicks).toHaveLength(0)

    // A tap on the wire away from the badge still emits edge:click.
    const wireGlobal = edgeGraphic.toGlobal({ x: 10, y: 0 })
    edgeGraphic.emit('pointertap', { global: wireGlobal, nativeEvent: undefined } as any)
    expect(calloutClicks).toHaveLength(1)
    expect(edgeClicks).toHaveLength(1)
    expect(edgeClicks[0]).toMatchObject({ edgeId: 'e1', eventType: 'click' })
  })

  it('surfaces sprite badge interactions as callout events with the anchor identity', async () => {
    const { MermaidRenderer } = await import('../mermaid-renderer')
    const renderer = new MermaidRenderer() as any

    const events: unknown[] = []
    renderer.on('callout:click', (event: unknown) => events.push(event))

    renderer._calloutBadges = [{ anchorKind: 'subgraph', anchorId: 'SG', count: 4 }]
    renderer._emitCalloutBadgeEvent('click', 'subgraph', 'SG', 'callout', { x: 12, y: 34 })

    expect(events).toEqual([
      {
        anchorKind: 'subgraph',
        anchorId: 'SG',
        kind: 'callout',
        count: 4,
        eventType: 'click',
        x: 12,
        y: 34,
      },
    ])
  })

  it('routes taps on a node carrying both marker kinds to the right kind', async () => {
    const { MermaidRenderer } = await import('../mermaid-renderer')
    const renderer = new MermaidRenderer() as any

    renderer._viewport = {
      removeChildren: vi.fn(),
      addChild: vi.fn(),
      addChildAt: vi.fn(),
      setChildIndex: vi.fn(),
      scale: { x: 1, y: 1 },
      x: 0,
      y: 0,
      _zoom: 1,
    }
    renderer._app = { ticker: { started: true, start: vi.fn(), stop: vi.fn() } }
    renderer._currentPhilosophy = 'narrative'
    renderer._graph = null
    renderer._focusStack = []
    renderer._getActiveTheme = () => nodeTheme
    renderer.fitToView = vi.fn()
    renderer._updateDetailLevel = vi.fn()
    renderer._applyPerformanceModeDetails = vi.fn()

    renderer.setCalloutBadges([
      { anchorKind: 'node', anchorId: 'a' },
      { anchorKind: 'node', anchorId: 'a', kind: 'comment' },
    ])
    renderer._renderGraph({
      width: 640,
      height: 480,
      nodes: new Map([
        [
          'a',
          { id: 'a', label: '', shape: 'rectangle', x: 60, y: 24, width: 120, height: 48 },
        ],
      ]),
      edges: [],
      subgraphs: new Map(),
    })

    const sprite = renderer._nodeSprites.get('a')
    expect(sprite.hasCalloutBadge('callout')).toBe(true)
    expect(sprite.hasCalloutBadge('comment')).toBe(true)

    const clicks: unknown[] = []
    const hovers: unknown[] = []
    const hoverEnds: unknown[] = []
    renderer.on('callout:click', (event: unknown) => clicks.push(event))
    renderer.on('callout:hover', (event: unknown) => hovers.push(event))
    renderer.on('callout:hoverend', (event: unknown) => hoverEnds.push(event))

    const commentLocal = sprite.getCalloutBadgeDebug('comment')
    const commentGlobal = sprite.toGlobal({ x: commentLocal.x, y: commentLocal.y })
    sprite.emit('pointertap', { global: commentGlobal, nativeEvent: undefined })

    expect(clicks).toHaveLength(1)
    expect(clicks[0]).toMatchObject({
      anchorKind: 'node',
      anchorId: 'a',
      kind: 'comment',
      eventType: 'click',
    })

    const calloutLocal = sprite.getCalloutBadgeDebug('callout')
    const calloutGlobal = sprite.toGlobal({ x: calloutLocal.x, y: calloutLocal.y })
    sprite.emit('pointertap', { global: calloutGlobal, nativeEvent: undefined })

    expect(clicks).toHaveLength(2)
    expect(clicks[1]).toMatchObject({ kind: 'callout', eventType: 'click' })

    // Sliding from the comment pin straight onto the callout badge ends one
    // hover and starts the other, each with its own kind.
    sprite.emit('pointermove', { global: commentGlobal, nativeEvent: undefined })
    expect(hovers).toHaveLength(1)
    expect(hovers[0]).toMatchObject({ kind: 'comment', eventType: 'hover' })
    expect(sprite.getCalloutBadgeHoverScale('comment')).toBe(CALLOUT_BADGE_HOVER_SCALE)
    expect(sprite.getCalloutBadgeHoverScale('callout')).toBe(1)

    sprite.emit('pointermove', { global: calloutGlobal, nativeEvent: undefined })
    expect(hoverEnds).toHaveLength(1)
    expect(hoverEnds[0]).toMatchObject({ kind: 'comment', eventType: 'hoverend' })
    expect(hovers).toHaveLength(2)
    expect(hovers[1]).toMatchObject({ kind: 'callout', eventType: 'hover' })
    expect(sprite.getCalloutBadgeHoverScale('comment')).toBe(1)
    expect(sprite.getCalloutBadgeHoverScale('callout')).toBe(CALLOUT_BADGE_HOVER_SCALE)
  })
})
