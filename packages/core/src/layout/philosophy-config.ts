import type { LayoutPhilosophy } from '../types'

export interface PhilosophyConfig {
  nodeSep: number
  rankSep: number
  edgeSep: number
  rankDir: 'TB' | 'LR' | 'BT' | 'RL'
  marginX: number
  marginY: number
  nodeMinWidth: number
  nodeMinHeight: number
  nodePadding: number
}

const NARRATIVE: PhilosophyConfig = {
  nodeSep: 30,
  rankSep: 40,
  edgeSep: 12,
  rankDir: 'TB',
  marginX: 30,
  marginY: 30,
  nodeMinWidth: 160,
  nodeMinHeight: 48,
  nodePadding: 16,
}

const MAP: PhilosophyConfig = {
  nodeSep: 24,
  rankSep: 30,
  edgeSep: 14,
  rankDir: 'TB',
  marginX: 40,
  marginY: 40,
  nodeMinWidth: 160,
  nodeMinHeight: 48,
  nodePadding: 18,
}

const BLUEPRINT: PhilosophyConfig = {
  nodeSep: 44,
  rankSep: 64,
  edgeSep: 18,
  rankDir: 'TB',
  marginX: 44,
  marginY: 40,
  nodeMinWidth: 160,
  nodeMinHeight: 48,
  nodePadding: 18,
}

const BREATH: PhilosophyConfig = {
  nodeSep: 100,
  rankSep: 120,
  edgeSep: 30,
  rankDir: 'TB',
  marginX: 80,
  marginY: 80,
  nodeMinWidth: 160,
  nodeMinHeight: 56,
  nodePadding: 20,
}

const RADIAL: PhilosophyConfig = {
  nodeSep: 60,
  rankSep: 80,
  edgeSep: 20,
  rankDir: 'TB',
  marginX: 60,
  marginY: 60,
  nodeMinWidth: 120,
  nodeMinHeight: 40,
  nodePadding: 14,
}

const MOSAIC: PhilosophyConfig = {
  nodeSep: 16,
  rankSep: 16,
  edgeSep: 10,
  rankDir: 'TB',
  marginX: 20,
  marginY: 20,
  nodeMinWidth: 200,
  nodeMinHeight: 60,
  nodePadding: 20,
}

const CONFIGS: Record<LayoutPhilosophy, PhilosophyConfig> = {
  narrative: NARRATIVE,
  map: MAP,
  blueprint: BLUEPRINT,
  breath: BREATH,
  radial: RADIAL,
  mosaic: MOSAIC,
}

export function getPhilosophyConfig(
  philosophy: LayoutPhilosophy,
): PhilosophyConfig {
  return CONFIGS[philosophy]
}
