# Mermaid Monkey Brand Generation

Generated with `higgsfield generate create imagegen_2_0` on 2026-05-30.

## Decision

- Mascot-led hero: chosen because the character is the differentiator and the third candidate clearly interacts with graph nodes.
- Demo theme set: Narrative and Blueprint only, because those are the two real v1 layout engines. The other philosophy names are not advertised as dedicated layouts on the landing page.
- Site tech: vanilla HTML, CSS, and TypeScript on Vite in `packages/site`, reusing the same `@mermaid-monkey/core` public API as the demo harness.
- Site location: workspace package at `packages/site`, deployed by GitHub Pages Actions from its static build output.
- Domain: GitHub Pages default subpath, canonical `https://arunjrk.github.io/mermaid-monkey/`.

## Chosen Assets

- Mascot: `packages/site/public/brand/mascot.png`
  - Job id: `efdd73ed-2940-4293-9230-2e08635c035f`
  - Reason: strongest diagram interaction cue, clean body silhouette, no visible extra limbs.
- Glyph: `packages/site/public/brand/glyph.png`
  - Job id: `eaa95dc6-8d98-45f5-ad3a-70cb43e2a9aa`
  - Reason: simplest tail-as-flow mark, legible as a small favicon.

## Prompt Iterations

### Mascot 1

- Job id: `db5927e6-d21b-4856-952c-473d04c157b3`
- Prompt: Friendly crafted Mermaid Monkey mascot for an open-source JavaScript library brand. A charming monkey with a flowing mermaid tail, clean modern character design, expressive but simple face, premium vector-like 3D illustration, Luminous Depth palette with deep cool #08090C background and soft #5BA8FF to #7D6CFF accent glow, tasteful translucent light, mascot-led GitHub project energy, no text, no neon cyberpunk, no extra limbs, no artifacts.

### Mascot 2

- Job id: `5b891cad-8c1f-423f-b73f-feca191db829`
- Prompt: Mermaid Monkey brand mascot, playful monkey explorer with a graceful mermaid tail curling like a flowchart path, soft luminous blue-violet rim light, deep #08090C atmosphere, modern open-source product mascot, crafted friendly expression, simple readable silhouette for a landing page hero, high polish, no words, no logo text, no cyberpunk neon, no extra fingers or limbs.

### Mascot 3

- Job id: `efdd73ed-2940-4293-9230-2e08635c035f`
- Prompt: Premium mascot illustration for Mermaid Monkey, a warm clever monkey with a mermaid tail floating through an interactive node diagram, subtle canvas-grid cues, deep luminous dark brand world, desaturated #5BA8FF to #7D6CFF glow, clean friendly shape language, Octocat-like memorability without imitation, mascot hero asset, no text, no neon, no clutter, anatomically simple with two arms and one tail.

### Glyph 1

- Job id: `eaa95dc6-8d98-45f5-ad3a-70cb43e2a9aa`
- Prompt: Abstract reduced glyph for Mermaid Monkey favicon: a mermaid tail forming a flowing node-link diagram path, 3 connected nodes, simple geometric mark, legible at 32px, luminous blue to violet gradient on deep #08090C, crisp edges, no text, no animal face, no tiny detail, no cyberpunk, app icon ready.

### Glyph 2

- Job id: `c18b9caa-bdc2-44de-a9d7-b68c8e887639`
- Prompt: Minimal Mermaid Monkey abstract mark for favicon and app icon: one elegant monkey-tail and mermaid-fin curve becoming a flow arrow between two canvas nodes, bold simple silhouette, soft #5BA8FF to #7D6CFF accent, dark luminous background, no letters, no text, survives at 16px and 32px, clean modern vector logo style.

### Glyph 3

- Job id: `34b41d22-e173-4286-ba77-4e419ee8aa8b`
- Prompt: Tiny-size abstract logo glyph for Mermaid Monkey: a luminous mermaid tail fin as a curved graph edge with three nodes, balanced circular composition, highly simplified, high contrast on #08090C, soft blue-violet gradient, professional open-source project mark, no text, no mascot body, no fine details, favicon legible.
