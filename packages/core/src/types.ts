import type { RichLabel } from './label-markup'

// ─── Primitive type aliases ──────────────────────────────────────────────────

export type NodeShape =
  | 'rectangle'
  | 'rounded'
  | 'circle'
  | 'diamond'
  | 'hexagon'
  | 'stadium'
  | 'cylinder'
  | 'subroutine'
  | 'asymmetric'
  | 'unknown'

export type EdgeStyle = 'solid' | 'dotted' | 'thick'

export type LayoutPhilosophy = 'narrative' | 'map' | 'blueprint' | 'breath' | 'radial' | 'mosaic'
export type ThemeMode = 'system' | 'dark' | 'light'

export type DiagramType =
  | 'flowchart'
  | 'erDiagram'
  | 'classDiagram'
  | 'c4'
  | 'stateDiagram'
  | 'sequenceDiagram'
  | 'requirementDiagram'
  | 'mindmap'
  | 'gantt'
  | 'journey'
  | 'unknown'

// ─── Graph model ─────────────────────────────────────────────────────────────

export interface RenderNode {
  id: string
  label: string
  labelMarkup?: RichLabel
  shape: NodeShape
  metadata: Record<string, unknown>
  classes?: string[]
  style?: RenderStyle
}

export interface RenderEdge {
  id: string
  source: string
  target: string
  style: EdgeStyle
  label?: string
  metadata?: Record<string, unknown>
  renderStyle?: RenderStyle
}

export interface RenderSubgraph {
  id: string
  label: string
  nodeIds: string[]
  collapsed: boolean
  direction?: string
  classes?: string[]
  style?: RenderStyle
}

export interface RenderGraph {
  nodes: Map<string, RenderNode>
  edges: RenderEdge[]
  subgraphs: Map<string, RenderSubgraph>
  directives: Directive[]
  direction: string
  diagramType: DiagramType
}

export interface RenderedNodeAnchor {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export interface RenderedEdgeAnchor {
  id: string
  source: string
  target: string
  x: number
  y: number
}

export interface RenderedSubitemAnchor {
  id: string
  parentKind: 'node' | 'edge'
  parentId: string
  itemKind: string
  label: string
  x: number
  y: number
  width: number
  height: number
}

export interface RenderStyle {
  fill?: number
  stroke?: number
  text?: number
  strokeWidth?: number
  strokeDasharray?: number[]
}

// ─── Cross-file linking ──────────────────────────────────────────────────────

export interface CrossFileLink {
  sourceFile: string
  sourceNode: string
  targetFile: string
  targetNode: string
}

// ─── Directives ──────────────────────────────────────────────────────────────

export interface LinkDirective {
  type: 'link'
  nodeId: string
  targetFile: string
  targetNode?: string
}

export interface LinkResolver {
  canonicalize(targetFile: string, fromFile: string): string | null | Promise<string | null>
  read(canonicalFile: string): string | null | Promise<string | null>
}

export interface LinkState {
  nodeId: string
  rawTargetFile: string
  targetNode?: string
  canonicalTargetFile?: string
  status: 'valid' | 'broken'
  reason?: string
  warningCode?: string
}

export type DirectiveMetadataValue = string | boolean | string[]
export type DirectiveMetadata = Record<string, DirectiveMetadataValue>

export interface EntityDirective {
  type: 'entity'
  nodeId: string
  entityType: string
  entityId: string
  metadata: DirectiveMetadata
}

export interface EdgeDirective {
  type: 'edge'
  source: string
  target: string
  metadata: DirectiveMetadata
}

export interface FileDirective {
  type: 'file'
  metadata: DirectiveMetadata
}

export interface LensDirective {
  type: 'lens'
  name: string
  metadata: DirectiveMetadata
}

export interface LayoutDirective {
  type: 'layout'
  philosophy: LayoutPhilosophy
}

export interface PinDirective {
  type: 'pin'
  nodeId: string
  x: number
  y: number
}

export interface RankDirective {
  type: 'rank'
  nodeIds: string[]
  rank: 'same' | 'min' | 'max'
}

export interface SpacingDirective {
  type: 'spacing'
  nodeSpacing?: number
  rankSpacing?: number
}

export type Directive =
  | LinkDirective
  | EntityDirective
  | EdgeDirective
  | FileDirective
  | LensDirective
  | LayoutDirective
  | PinDirective
  | RankDirective
  | SpacingDirective

// ─── Project index ──────────────────────────────────────────────────────────

export interface ProjectNodeOccurrence {
  file: string
  nodeId: string
  label: string
  entityKey?: string
  metadata: Record<string, unknown>
}

export interface ProjectEdgeOccurrence {
  file: string
  edgeId: string
  source: string
  target: string
  label?: string
  metadata: Record<string, unknown>
}

export interface ProjectLinkOccurrence {
  file: string
  nodeId: string
  rawTargetFile: string
  targetNode?: string
  canonicalTargetFile?: string
  status: 'valid' | 'broken' | 'unvalidated'
  reason?: string
  warningCode?: string
}

export interface ProjectFileIndex {
  file: string
  success: boolean
  graph?: RenderGraph
  warnings: ProjectIndexWarning[]
  errors: ProjectIndexError[]
}

export interface ProjectIndexWarning extends RenderWarning {
  file: string
}

export interface ProjectIndexError extends RenderError {
  file: string
}

export interface ProjectIndex {
  files: Map<string, ProjectFileIndex>
  nodesById: Map<string, ProjectNodeOccurrence[]>
  entities: Map<string, ProjectNodeOccurrence[]>
  edgesBySignature: Map<string, ProjectEdgeOccurrence[]>
  links: ProjectLinkOccurrence[]
  warnings: ProjectIndexWarning[]
  errors: ProjectIndexError[]
}

// ─── Positioned (layout output) ─────────────────────────────────────────────

export interface PositionedNode extends RenderNode {
  x: number
  y: number
  width: number
  height: number
}

export interface PositionedEdge extends RenderEdge {
  points: Array<{ x: number; y: number }>
}

export interface PositionedSubgraph extends RenderSubgraph {
  x: number
  y: number
  width: number
  height: number
}

export interface PositionedGraph {
  nodes: Map<string, PositionedNode>
  edges: PositionedEdge[]
  subgraphs: Map<string, PositionedSubgraph>
  width: number
  height: number
}

// ─── Load / parse results ────────────────────────────────────────────────────

export interface RenderError {
  code: string
  message: string
  line?: number
  column?: number
}

export interface RenderWarning {
  code: string
  message: string
  line?: number
  column?: number
}

export interface LoadResult {
  success: boolean
  graph?: RenderGraph
  errors: RenderError[]
  warnings: RenderWarning[]
  linkStates?: Map<string, LinkState>
}

export interface LoadOptions {
  layout?: LayoutPhilosophy | string
  strict?: boolean
  maxNodes?: number
  baseDir?: string
  sourcePath?: string
  linkResolver?: LinkResolver
}

export interface ThemeOverrides {
  background?: number
  nodeFill?: number
  nodeStroke?: number
  nodeStrokeSelected?: number
  brokenLinkAccent?: number
  nodeText?: number
  edgeColor?: number
  edgeLabelColor?: number
  subgraphFill?: number
  subgraphFillAlpha?: number
  subgraphStroke?: number
  subgraphStrokeAlpha?: number
  subgraphLabel?: number
  subgraphDepthTints?: number[]
  gridColor?: number
  gridAlpha?: number
  gridSize?: number
  hoverGlow?: number
  hoverGlowAlpha?: number
  accent?: number
  commentAccent?: number
  strokeWidth?: number
  cornerRadius?: number
  dimmedAlpha?: number
  hoverDimmedAlpha?: number
  messageOverlayBg?: number
  messageTitle?: string
  messageBody?: string
  breadcrumbBg?: string
  breadcrumbText?: string
  breadcrumbAccent?: string
}

export interface MermaidRendererOptions {
  themeMode?: ThemeMode
  themeOverrides?: ThemeOverrides
}

export interface MermaidViewportState {
  x: number
  y: number
  zoom: number
}

export type MermaidViewSpec =
  | { kind: 'full' }
  | { kind: 'subgraph'; id: string; boundaryDepth?: 1 }
  | { kind: 'lens'; name: string | null }

// ─── Interaction events ──────────────────────────────────────────────────────

export interface NodeEvent {
  nodeId: string
  eventType: 'click' | 'hover' | 'dblclick' | 'contextmenu'
  originalEvent?: Event
}

export interface EdgeEvent {
  edgeId: string
  source: string
  target: string
  eventType: 'click' | 'hover' | 'contextmenu'
  originalEvent?: Event
}

export interface SubitemEvent {
  id: string
  parentKind: 'node' | 'edge'
  parentId: string
  itemKind: string
  label: string
  eventType: 'click' | 'hover' | 'contextmenu'
  originalEvent?: Event
}

// ─── Callout badges ──────────────────────────────────────────────────────────

export type CalloutAnchorKind = 'node' | 'subgraph' | 'edge'

/**
 * What an annotation marker represents. Both kinds share one mechanism (a
 * badge child of the anchor's sprite, host-routed hit testing, the same
 * `callout:*` events); the kind selects the accent colour and lets an anchor
 * carry one marker of EACH kind side by side without overlap.
 *
 * - `'callout'` — a callout/annotation card attached to the anchor.
 * - `'comment'` — a Figma-style comment thread pin on the anchor.
 */
export type CalloutBadgeKind = 'callout' | 'comment'

/**
 * One in-canvas annotation marker, keyed by the anchor (and kind) it belongs
 * to. Pushed via `MermaidRenderer.setCalloutBadges` and rendered by the
 * engine as a child of the anchor's sprite so it moves/scales with its
 * anchor by construction.
 */
export interface CalloutBadgeSpec {
  anchorKind: CalloutAnchorKind
  anchorId: string
  /** Marker kind; omitted means `'callout'` (backwards compatible). */
  kind?: CalloutBadgeKind
  /** Optional annotation count shown inside the badge when greater than 1. */
  count?: number
}

/**
 * Payload for `callout:click` / `callout:hover` / `callout:hoverend`.
 * `x`/`y` are the badge centre in canvas-relative screen coordinates at the
 * moment of the event — the same space as `getNodeAnchors` rects — so hosts
 * can open a DOM detail panel at the badge without tracking it continuously.
 * `kind` discriminates which marker on the anchor the event refers to.
 */
export interface CalloutBadgeEvent {
  anchorKind: CalloutAnchorKind
  anchorId: string
  kind: CalloutBadgeKind
  count?: number
  eventType: 'click' | 'hover' | 'hoverend'
  x: number
  y: number
  originalEvent?: Event
}
