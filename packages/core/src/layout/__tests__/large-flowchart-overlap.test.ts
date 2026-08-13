import { describe, it, expect } from 'vitest'
import { LoadPipeline } from '../../renderer/load-pipeline'
import { estimateRenderedNodeFootprint } from '../../node-footprint'
import type { PositionedNode } from '../../types'

/**
 * Regression: a real-world architecture diagram (~40 nodes, 3 subgraphs,
 * ~55 edges, `flowchart LR`) rendered as an unreadable pile of overlapping
 * nodes (roughdraft-markdown GH issue #6, symptom 1).
 *
 * goal.md item 13: "No node overlaps another node after layout in any
 * philosophy. INVARIANT: for any two nodes, their rendered bounding boxes do
 * not intersect (subgraph containment excepted). Assert on positioned bounds,
 * not eyeballing."
 *
 * The assertion uses estimateRenderedNodeFootprint so it reflects the true
 * rendered size (label growth included), not just the raw layout size.
 */

// Verbatim mermaid source from
// roughdraft-markdown/.context/diagram-archive/2026-08-13-large-flowchart-overlap-repro.md
const FIXTURE = `
%% @diagram id=noshare-current-architecture lens=architecture
%% @lens request-path include=tag:request
%% @lens data-residency include=tag:residency
%% @lens proof-path include=tag:proof
%% @link CloudRuntime ./current-runtime-flow.md#diagram=noshare-current-request-flow
%% @link CustomerRuntime ./current-runtime-flow.md#diagram=noshare-current-request-flow
%% @link BKB ./current-authoring-flow.md#diagram=noshare-current-authoring-flow
flowchart LR
  subgraph BrowserBoundary["User browser"]
    User["Authenticated user"]
    AppUI["Smriti chat UI"]
    BrowserMemory["In-memory re-identification"]
    User -->|"question"| AppUI
  end

  subgraph CloudRuntime["Smriti host / cloud control and relay plane"]
    NextApp["Next.js app and auth boundary"]
    Chat["Chat service and regulated operation lifecycle"]
    Resolver["Platform-core metadata-only route resolver"]
    BKB["BKB schema and view metadata"]
    AuthoringUI["Admin / View Builder authoring"]
    ManualAuthoring["Current fixture and direct PostgreSQL edits"]
    BKBStore[("BKB PostgreSQL")]
    Outbox[("Transactional event outbox")]
    Hatchet["Hatchet event delivery"]
    BKBWorker["BKB cache-invalidation worker"]
    ViewIndexer["View-indexer worker"]
    Qdrant[("Workspace view index in Qdrant")]
    ChatCache[("Chat BKB cache")]
    Relay["Agent relay"]
    RelayState["Redis relay session state"]
    CloudHistory["Cloud chat history"]
    CloudTelemetry["Content-free logs, traces, metrics and proof events"]

    NextApp -->|"trusted identity and workspace context"| Chat
    Chat -->|"org, workspace, subject, session, purpose, data class, sinks"| Resolver
    Resolver -->|"allow or deny plus signed route capability"| Chat
    BKB -->|"content-free schema and view context"| Chat
    AuthoringUI -. "View Builder service is WIP" .-> BKB
    ManualAuthoring -. "current test path bypasses application events" .-> BKBStore
    BKB -->|"view, rule, jargon and context mutation"| BKBStore
    BKBStore -->|"same transaction"| Outbox
    Outbox -->|"claim, retry and publish"| Hatchet
    Hatchet -->|"view, rule, jargon and context events"| BKBWorker
    Hatchet -->|"view events"| ViewIndexer
    BKBWorker -->|"workspace or view scoped invalidation"| ChatCache
    ViewIndexer -->|"fetch current view metadata"| BKB
    ViewIndexer -->|"delete then upsert embeddings"| Qdrant
    ChatCache --> Chat
    Qdrant -->|"semantic view lookup"| Chat
    Chat -->|"capability-bound dispatch"| Relay
    Relay <--> |"agent session and request frames"| RelayState
    Chat -. "regulated path skips writes" .-> CloudHistory
    Resolver -. "decision metadata" .-> CloudTelemetry
    Chat -. "content-free operation metadata" .-> CloudTelemetry
    Relay -. "content-free relay metadata" .-> CloudTelemetry
  end

  subgraph CustomerRuntime["Customer Kubernetes data plane"]
    Agent["Smriti agent and local policy checks"]
    StarRocks[("StarRocks customer data")]
    DeID["SQL lint and de-identification gate"]
    Vault[("Token vault and one-shot token map")]
    LocalLLM["On-prem answer synthesis"]
    LocalHistory[("On-prem PostgreSQL chat history")]
    TokenMapAPI["Scoped token-map and history API"]
    Ingestion["Ingestion broker and bronze storage"]

    Agent -->|"local SQL"| StarRocks
    StarRocks -->|"raw rows stay in customer plane"| DeID
    DeID -->|"tokenized rows"| Vault
    DeID -->|"tokenized rows and columns"| LocalLLM
    LocalLLM -->|"tokenized answer"| Agent
    Agent -->|"local question, SQL, tokenized and display answer"| LocalHistory
    Vault --> TokenMapAPI
    LocalHistory --> TokenMapAPI
    Ingestion --> StarRocks
  end

  AppUI -->|"real-auth chat request"| NextApp
  Relay <-->|"customer-agent outbound WebSocket"| Agent
  Agent -. "schema_sync frame emitted; relay has no ingest handler yet" .-> Relay
  Agent -->|"answer text only and token-map descriptor"| Relay
  Relay --> Chat
  Chat -->|"tokens-only stream or answer"| NextApp
  NextApp --> AppUI
  AppUI -->|"signed, scoped, direct customer-plane GET"| TokenMapAPI
  TokenMapAPI -->|"one-shot map; no-store"| BrowserMemory
  AppUI --> BrowserMemory
  BrowserMemory -->|"display-only answer"| User

  Provider["Public LLM provider"]
  CustomerRaw[("Raw rows, identifiers and token material")]
  Agent -. "NetworkPolicy denies regulated provider egress" .-> Provider
  CustomerRaw -. "must not cross this boundary" .-> CloudRuntime

  Contract["Compiled regulated data-flow contract"]
  SDKs["Generated regulated SDK config"]
  Helm["Helm charts and active policy hash"]
  Probes["Generated negative probes"]
  Proof["Content-free proof bundle and buyer report"]
  Contract -.-> Resolver
  Contract -.-> SDKs
  SDKs -.-> NextApp
  SDKs -.-> Chat
  Contract -.-> Helm
  Helm -.-> CloudRuntime
  Helm -.-> CustomerRuntime
  Contract -.-> Probes
  Probes -.-> Proof
  CloudTelemetry -.-> Proof

  classDef browser fill:#e8f3ff,stroke:#23689b,color:#102a43;
  classDef cloud fill:#eef1f5,stroke:#52616b,color:#1f2933;
  classDef customer fill:#e7f6ec,stroke:#287a46,color:#153b25;
  classDef blocked fill:#fff0f0,stroke:#b42318,color:#6b1711;
  classDef control fill:#fff8db,stroke:#9a7400,color:#4f3b00;
  class User,AppUI,BrowserMemory browser;
  class NextApp,Chat,Resolver,BKB,AuthoringUI,BKBStore,Outbox,Hatchet,BKBWorker,ViewIndexer,Qdrant,ChatCache,Relay,RelayState,CloudHistory,CloudTelemetry cloud;
  class Agent,StarRocks,DeID,Vault,LocalLLM,LocalHistory,TokenMapAPI,Ingestion customer;
  class Provider,CustomerRaw,ManualAuthoring blocked;
  class Contract,SDKs,Helm,Probes,Proof control;
`

interface Rect {
  left: number
  right: number
  top: number
  bottom: number
}

function renderedRect(node: PositionedNode): Rect {
  const footprint = estimateRenderedNodeFootprint(node)
  return {
    left: node.x - footprint.width / 2,
    right: node.x + footprint.width / 2,
    top: node.y - footprint.height / 2,
    bottom: node.y + footprint.height / 2,
  }
}

/** Strict intersection: rects that merely touch along an edge do not count. */
function intersects(a: Rect, b: Rect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

function findOverlappingPairs(nodes: Map<string, PositionedNode>): string[] {
  const entries = Array.from(nodes.entries())
  const rects = entries.map(([id, node]) => ({ id, rect: renderedRect(node) }))
  const pairs: string[] = []
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (intersects(rects[i].rect, rects[j].rect)) {
        pairs.push(`${rects[i].id} <-> ${rects[j].id}`)
      }
    }
  }
  return pairs
}

describe('large flowchart layout density (regression: roughdraft GH #6)', () => {
  it('positions the repro diagram with no two rendered node footprints intersecting', async () => {
    const pipeline = new LoadPipeline()
    const result = await pipeline.load(FIXTURE)

    expect(result.success).toBe(true)
    const positioned = result.positioned!

    // Sanity: the full graph made it through the pipeline.
    expect(positioned.nodes.size).toBeGreaterThanOrEqual(35)
    expect(positioned.subgraphs.size).toBe(3)

    const overlaps = findOverlappingPairs(positioned.nodes)
    expect(
      overlaps,
      `${overlaps.length} overlapping node pair(s):\n${overlaps.join('\n')}`,
    ).toEqual([])
  })

  it('keeps edges that target a subgraph id routed to the cluster, not dropped', async () => {
    const pipeline = new LoadPipeline()
    const result = await pipeline.load(FIXTURE)

    expect(result.success).toBe(true)
    const positioned = result.positioned!

    // The repro points three dotted edges at subgraph ids (cluster aliases):
    // Helm -.-> CloudRuntime, Helm -.-> CustomerRuntime,
    // CustomerRaw -.-> CloudRuntime. The clusters must not be positioned as
    // free nodes (that clobbers the cluster's reserved space), but the edges
    // must still be rendered, anchored on the positioned subgraph bounds.
    for (const [source, target] of [
      ['Helm', 'CloudRuntime'],
      ['Helm', 'CustomerRuntime'],
      ['CustomerRaw', 'CloudRuntime'],
    ]) {
      const edge = positioned.edges.find((e) => e.source === source && e.target === target)
      expect(edge, `${source} -> ${target} edge missing from positioned output`).toBeDefined()
      expect(edge!.points.length).toBeGreaterThanOrEqual(2)

      const cluster = positioned.subgraphs.get(target)!
      const endpoint = edge!.points[edge!.points.length - 1]
      // The arrowhead lands on (or within a rounding hair of) the cluster rect.
      expect(Math.abs(endpoint.x - cluster.x)).toBeLessThanOrEqual(cluster.width / 2 + 1)
      expect(Math.abs(endpoint.y - cluster.y)).toBeLessThanOrEqual(cluster.height / 2 + 1)
    }
  })
})
