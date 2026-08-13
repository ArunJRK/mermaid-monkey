# Vision

## What is mermaid-monkey?

A high-performance, interactive rendering engine for Mermaid diagrams. It takes Mermaid's text-as-code philosophy and pairs it with a modern WebGL-powered canvas — zoom, pan, fold nodes, navigate across files.

The engine is a standalone, publishable npm library. In the current v1 release scope, the shipped consumers are:

- `@mermaid-monkey/core` as an embeddable web library
- the static demo web app built from `packages/core/dist-demo/`

VS Code remains a future consumer, not part of the current v1 release target.

## The Gap

Mermaid.js is great for defining diagrams as code but produces static SVGs — no interaction, no folding, no multi-file support.

Tools like Coggle, Miro, and Excalidraw are interactive but don't use a text-based format — you lose version control, diffability, and code-as-documentation.

Mermaid Monkey bridges this: Mermaid syntax in, interactive GPU-rendered canvas out.

## Primary Use Cases

1. **Information Architecture** — navigable flowchart-style IA diagrams with drill-down
2. **Service Overviews** — cross-file flowchart projects that split complexity across files
3. **Process Maps** — zoomable, foldable flowcharts for dense operational workflows
4. **Technical Flowcharts** — precise, aligned relationship views rendered with the Blueprint philosophy

## Core Features (v1)

- **Interactive canvas** — zoom, pan, smooth animations via WebGL (PixiJS)
- **Node folding** — collapse/expand parts of a diagram like code folding
- **Multi-file projects** — browser-side file selection and cross-file navigation for `.mmd` projects
- **Cross-file linking** — nodes reference other files via comment directives, click to navigate
- **Backward compatible** — files remain valid Mermaid syntax; cross-file links use comments
- **Current parser/runtime scope** — `flowchart` syntax today; broader Mermaid families remain future work

## Deferred (v2+)

- Inline editing (add/modify nodes visually)
- Real-time collaboration
- Accessibility (screen readers, ARIA)
- Export to image/PDF

## Design Principles

- **Rendering engine is the product** — shells are secondary to a strong embeddable core
- **Web-first v1 scope** — ship the embeddable web engine and static demo cleanly before taking on other shells
- **Zero breakage** — every .mmd file works in standard Mermaid tools too
- **Performance over features** — fast, smooth, responsive canvas first
- **Decomposition reduces cognitive load** — multi-file is a first-class concept, not an afterthought

## License

MIT
