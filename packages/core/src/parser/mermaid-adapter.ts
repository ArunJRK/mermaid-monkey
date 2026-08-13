import type { DiagramType } from '../types'

type MermaidModule = {
  default: {
    initialize(config: { startOnLoad: boolean }): void
    mermaidAPI: {
      getDiagramFromText(source: string): Promise<{ type: string; db: any }>
    }
  }
}

let mermaidModulePromise: Promise<MermaidModule['default']> | null = null

async function getMermaid() {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import('mermaid').then((module) => module.default)
  }
  return await mermaidModulePromise
}

// Ensure mermaid is initialized once
let initialized = false

async function ensureInitialized() {
  const mermaid = await getMermaid()
  if (!initialized) {
    mermaid.initialize({ startOnLoad: false })
    initialized = true
  }
  return mermaid
}

export interface MermaidParseResult {
  diagramType: DiagramType
  db: any
  direction: string
}

/**
 * Map mermaid's internal diagram type strings to our DiagramType.
 */
function mapDiagramType(mermaidType: string): DiagramType {
  if (mermaidType.startsWith('flowchart')) return 'flowchart'
  if (mermaidType === 'er' || mermaidType.startsWith('erDiagram')) return 'erDiagram'
  if (mermaidType === 'class' || mermaidType.startsWith('classDiagram')) return 'classDiagram'
  if (mermaidType.startsWith('c4')) return 'c4'
  if (mermaidType.startsWith('stateDiagram')) return 'stateDiagram'
  if (mermaidType === 'sequence') return 'sequenceDiagram'
  if (mermaidType === 'requirement') return 'requirementDiagram'
  if (mermaidType === 'mindmap') return 'mindmap'
  if (mermaidType === 'gantt') return 'gantt'
  if (mermaidType === 'journey') return 'journey'
  return 'unknown'
}

/**
 * Parse mermaid source and return the diagram type, db (for querying
 * vertices/edges/subgraphs), and direction.
 */
export async function parseMermaid(source: string): Promise<MermaidParseResult> {
  const mermaid = await ensureInitialized()

  // Access mermaidAPI.getDiagramFromText to get the full Diagram object
  const api = mermaid.mermaidAPI
  const diagram = await api.getDiagramFromText(source)

  const diagramType = mapDiagramType(diagram.type)
  const db = diagram.db
  const direction: string = typeof db.getDirection === 'function' ? db.getDirection() : 'TD'

  return { diagramType, db, direction }
}
