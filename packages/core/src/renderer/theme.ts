import type { LayoutPhilosophy, ThemeMode, ThemeOverrides } from '../types'

export interface Theme {
  name: string
  background: number
  nodeFill: number
  nodeStroke: number
  nodeStrokeSelected: number
  brokenLinkAccent: number
  nodeText: number
  edgeColor: number
  edgeLabelColor: number
  subgraphFill: number
  subgraphFillAlpha: number
  subgraphStroke: number
  subgraphStrokeAlpha: number
  subgraphLabel: number
  /** Per-depth subgraph tints (Map philosophy uses gradient) */
  subgraphDepthTints?: number[]
  /** Blueprint grid overlay */
  gridColor?: number
  gridAlpha?: number
  gridSize?: number
  hoverGlow: number
  hoverGlowAlpha: number
  accent: number
  /**
   * Accent for comment-kind annotation markers (comment pins), deliberately
   * distinct from `accent` so callout badges and comment pins read
   * differently at a glance.
   */
  commentAccent: number
  strokeWidth: number
  cornerRadius: number
  /** Dimmed opacity for unfocused elements */
  dimmedAlpha: number
  /** Stronger dimmed opacity for unrelated elements while hovering a node */
  hoverDimmedAlpha: number
  messageOverlayBg: number
  messageTitle: string
  messageBody: string
  /** Breadcrumb bar styling */
  breadcrumbBg: string
  breadcrumbText: string
  breadcrumbAccent: string
}

export function getSubgraphDepthFill(theme: Theme, depth: number): number {
  if (theme.subgraphDepthTints && theme.subgraphDepthTints.length > 0) {
    return theme.subgraphDepthTints[Math.min(depth, theme.subgraphDepthTints.length - 1)]
  }
  return theme.subgraphFill
}

// ── Narrative "Ink" ──────────────────────────────────────────────────────────
const NARRATIVE: Theme = {
  name: 'Ink',
  background: 0x0d1117,
  nodeFill: 0x161b22,
  nodeStroke: 0x30363d,
  nodeStrokeSelected: 0x58a6ff,
  brokenLinkAccent: 0xf85149,
  nodeText: 0xe6edf3,
  edgeColor: 0x6e7681,
  edgeLabelColor: 0x8b949e,
  subgraphFill: 0x161b22,
  subgraphFillAlpha: 0.4,
  subgraphStroke: 0x30363d,
  subgraphStrokeAlpha: 0.6,
  subgraphLabel: 0x8b949e,
  subgraphDepthTints: [0x161b22, 0x1d2631, 0x1f2c39],
  hoverGlow: 0x58a6ff,
  hoverGlowAlpha: 0.2,
  accent: 0x58a6ff,
  commentAccent: 0xf59e0b,
  strokeWidth: 2,
  cornerRadius: 8,
  dimmedAlpha: 0.3,
  hoverDimmedAlpha: 0.22,
  messageOverlayBg: 0x111827,
  messageTitle: '#f9fafb',
  messageBody: '#9ca3af',
  breadcrumbBg: '#0d1117',
  breadcrumbText: '#8b949e',
  breadcrumbAccent: '#58a6ff',
}

const NARRATIVE_LIGHT: Theme = {
  name: 'Ink Light',
  background: 0xf6f8fa,
  nodeFill: 0xffffff,
  nodeStroke: 0xd0d7de,
  nodeStrokeSelected: 0x0969da,
  brokenLinkAccent: 0xcf222e,
  nodeText: 0x1f2328,
  edgeColor: 0x57606a,
  edgeLabelColor: 0x57606a,
  subgraphFill: 0xf6f8fa,
  subgraphFillAlpha: 0.92,
  subgraphStroke: 0xd0d7de,
  subgraphStrokeAlpha: 0.9,
  subgraphLabel: 0x57606a,
  subgraphDepthTints: [0xf6f8fa, 0xeaeef2, 0xe1e7ec],
  hoverGlow: 0x0969da,
  hoverGlowAlpha: 0.16,
  accent: 0x0969da,
  commentAccent: 0xb45309,
  strokeWidth: 2,
  cornerRadius: 8,
  dimmedAlpha: 0.32,
  hoverDimmedAlpha: 0.24,
  messageOverlayBg: 0xffffff,
  messageTitle: '#1f2328',
  messageBody: '#57606a',
  breadcrumbBg: '#ffffff',
  breadcrumbText: '#57606a',
  breadcrumbAccent: '#0969da',
}

// ── Map "Atlas" ──────────────────────────────────────────────────────────────
const MAP: Theme = {
  name: 'Atlas',
  background: 0x1a1a2e,
  nodeFill: 0x16213e,
  nodeStroke: 0x0f3460,
  nodeStrokeSelected: 0xe94560,
  brokenLinkAccent: 0xff7b72,
  nodeText: 0xeaeaea,
  edgeColor: 0x5a5a8c,
  edgeLabelColor: 0xc7cbe6,
  subgraphFill: 0x0f3460,
  subgraphFillAlpha: 0.3,
  subgraphStroke: 0x0f3460,
  subgraphStrokeAlpha: 0.6,
  subgraphLabel: 0xc7cbe6,
  subgraphDepthTints: [0x0f3460, 0x3f2d68, 0x2d1f45],
  hoverGlow: 0xe94560,
  hoverGlowAlpha: 0.25,
  accent: 0xe94560,
  commentAccent: 0xffa940,
  strokeWidth: 2,
  cornerRadius: 10,
  dimmedAlpha: 0.3,
  hoverDimmedAlpha: 0.22,
  messageOverlayBg: 0x1a1a2e,
  messageTitle: '#f5f7ff',
  messageBody: '#c7cbe6',
  breadcrumbBg: '#1a1a2e',
  breadcrumbText: '#7a7a9e',
  breadcrumbAccent: '#e94560',
}

// ── Blueprint "Grid" ─────────────────────────────────────────────────────────
const BLUEPRINT: Theme = {
  name: 'Grid',
  background: 0x00111f,
  nodeFill: 0x063b70,
  nodeStroke: 0x2f95dc,
  nodeStrokeSelected: 0x00ffcc,
  brokenLinkAccent: 0xff6b6b,
  nodeText: 0xffffff,
  edgeColor: 0x42a4e8,
  edgeLabelColor: 0xb9dfff,
  subgraphFill: 0x082947,
  subgraphFillAlpha: 0.46,
  subgraphStroke: 0x42a4e8,
  subgraphStrokeAlpha: 0.72,
  subgraphLabel: 0xf2fbff,
  subgraphDepthTints: [0x082947, 0x0b385d, 0x0e4975],
  gridColor: 0x0c416d,
  gridAlpha: 0.2,
  gridSize: 20,
  hoverGlow: 0x00ffcc,
  hoverGlowAlpha: 0.32,
  accent: 0x00ffcc,
  commentAccent: 0xffb454,
  strokeWidth: 1.5,
  cornerRadius: 4,
  dimmedAlpha: 0.42,
  hoverDimmedAlpha: 0.2,
  messageOverlayBg: 0x00111f,
  messageTitle: '#f8fdff',
  messageBody: '#b8dfff',
  breadcrumbBg: '#00111f',
  breadcrumbText: '#b9dfff',
  breadcrumbAccent: '#00ffcc',
}

// ── Breath "Void" ────────────────────────────────────────────────────────────
const BREATH: Theme = {
  name: 'Void',
  background: 0x111111,
  nodeFill: 0x1a1a1a,
  nodeStroke: 0x333333,
  nodeStrokeSelected: 0xffffff,
  brokenLinkAccent: 0xff7b72,
  nodeText: 0xeeeeee,
  edgeColor: 0x666666,
  edgeLabelColor: 0x888888,
  subgraphFill: 0x1a1a1a,
  subgraphFillAlpha: 0.25,
  subgraphStroke: 0x333333,
  subgraphStrokeAlpha: 0.4,
  subgraphLabel: 0x888888,
  subgraphDepthTints: [0x1a1a1a, 0x212121, 0x202020],
  hoverGlow: 0xffffff,
  hoverGlowAlpha: 0.15,
  accent: 0xffffff,
  commentAccent: 0xffb454,
  strokeWidth: 2.5,
  cornerRadius: 16,
  dimmedAlpha: 0.3,
  hoverDimmedAlpha: 0.2,
  messageOverlayBg: 0x111111,
  messageTitle: '#f5f5f5',
  messageBody: '#b0b0b0',
  breadcrumbBg: '#111111',
  breadcrumbText: '#888888',
  breadcrumbAccent: '#ffffff',
}

// ── Radial "Orbit" ──────────────────────────────────────────────────────────
const RADIAL: Theme = {
  name: 'Orbit',
  background: 0x0f0f1a,
  nodeFill: 0x1a1a2e,
  nodeStroke: 0x4a3a6a,
  nodeStrokeSelected: 0xb07aff,
  brokenLinkAccent: 0xff8fa3,
  nodeText: 0xe0d8f0,
  edgeColor: 0x6a5a8a,
  edgeLabelColor: 0x9090b0,
  subgraphFill: 0x1a1a2e,
  subgraphFillAlpha: 0.3,
  subgraphStroke: 0x4a3a6a,
  subgraphStrokeAlpha: 0.5,
  subgraphLabel: 0x9090b0,
  subgraphDepthTints: [0x1a1a2e, 0x272140, 0x2f2552],
  hoverGlow: 0xb07aff,
  hoverGlowAlpha: 0.25,
  accent: 0xb07aff,
  commentAccent: 0xffb454,
  strokeWidth: 2,
  cornerRadius: 12,
  dimmedAlpha: 0.3,
  hoverDimmedAlpha: 0.22,
  messageOverlayBg: 0x0f0f1a,
  messageTitle: '#f4eeff',
  messageBody: '#c7bddc',
  breadcrumbBg: '#0f0f1a',
  breadcrumbText: '#9090b0',
  breadcrumbAccent: '#b07aff',
}

// ── Mosaic "Board" ──────────────────────────────────────────────────────────
const MOSAIC: Theme = {
  name: 'Board',
  background: 0x121212,
  nodeFill: 0x1e1e1e,
  nodeStroke: 0x3a3a3a,
  nodeStrokeSelected: 0xff9f43,
  brokenLinkAccent: 0xff6b4a,
  nodeText: 0xe0e0e0,
  edgeColor: 0x3a3a3a,
  edgeLabelColor: 0x909090,
  subgraphFill: 0x1e1e1e,
  subgraphFillAlpha: 0.25,
  subgraphStroke: 0x3a3a3a,
  subgraphStrokeAlpha: 0.4,
  subgraphLabel: 0x909090,
  subgraphDepthTints: [0x1e1e1e, 0x27211d, 0x32271f],
  hoverGlow: 0xff9f43,
  hoverGlowAlpha: 0.2,
  accent: 0xff9f43,
  commentAccent: 0x4dabf7,
  strokeWidth: 1.5,
  cornerRadius: 8,
  dimmedAlpha: 0.3,
  hoverDimmedAlpha: 0.22,
  messageOverlayBg: 0x121212,
  messageTitle: '#f3f3f3',
  messageBody: '#b8b8b8',
  breadcrumbBg: '#121212',
  breadcrumbText: '#909090',
  breadcrumbAccent: '#ff9f43',
}

const THEMES: Record<LayoutPhilosophy, Theme> = {
  narrative: NARRATIVE,
  map: MAP,
  blueprint: BLUEPRINT,
  breath: BREATH,
  radial: RADIAL,
  mosaic: MOSAIC,
}

export function getTheme(philosophy: LayoutPhilosophy): Theme {
  return THEMES[philosophy]
}

export function resolveTheme(
  philosophy: LayoutPhilosophy,
  mode: ThemeMode = 'dark',
  prefersLight = false,
  overrides?: ThemeOverrides | null,
): Theme {
  const base = mode === 'light' || (mode === 'system' && prefersLight)
    ? philosophy === 'narrative'
      ? NARRATIVE_LIGHT
      : THEMES[philosophy]
    : THEMES[philosophy]

  return overrides ? { ...base, ...overrides } : base
}
