GOAL: Ship a beautiful, modern GitHub project landing page for MERMAID MONKEY (the
  product brand; npm package is still @mermaid-monkey/core until the repo slug is
  renamed) that meets today's open-source library standards (the Vite / Bun / Biome
  / Drizzle / tRPC / Tauri class of landing page) and is deployed via GitHub Pages.
  The page's centerpiece is the LIVE engine running in-browser — not screenshots —
  because the product's whole pitch is "interactive, not static SVG."

  NAME & TONE
  - Product name: Mermaid Monkey. It's playful and mascot-friendly — lean into a
    character brand (Octocat energy), with the monkey as a recurring mark. The tone
    is confident and witty, never corporate. The name hints at the interaction:
    swinging/zooming around a living diagram.

  CONTEXT
  - Repo: @mermaid-monkey/core (PixiJS engine) + a vite web harness
    (packages/core/dev). The engine v1 work and its public embed API are scoped in
    goal.md; THIS file is the marketing/landing site, a separate deliverable.
  - DESIGN DIRECTION: "Luminous Depth" — atmospheric modern dark with soft radial
    light, tasteful translucency, and one desaturated luminous accent. Built as a
    fresh OKLCH token system; do NOT inherit the engine's current theme.ts palette,
    which reads ~2019–2021 (GitHub-default near-blacks + neon accents) and is dated
    by 2026 taste. Those six themes are at most candidates for a LATER engine
    refresh — not the site brand. Luminous Depth tokens (extend as needed in OKLCH):
      · bg base    #08090C   (cool, deep — not flat black)
      · surface-1  #10131A   raised panel
      · surface-2  #161A23   card / popover
      · border     rgba(255,255,255,0.08)   hairline
      · glass      rgba(255,255,255,0.04) + backdrop blur
      · text hi    #EAEDF2   (warm-cool off-white, never pure #fff)
      · text lo    #8A92A3
      · accent     soft gradient #5BA8FF → #7D6CFF (desaturated, used sparingly)
      · glow       low-alpha radial accent light behind the hero + demo
  - Tooling available: higgsfield CLI (`higgs` / `hf`) for logo/mascot + social-card
    image generation (auth, model list, generate create/wait, upload,
    product-photoshoot). The engine's deployable demo app is goal.md item 3.
  - This is a marketing surface: it MAY use accessibility/animation/polish that the
    engine itself defers to v2. The page is held to a higher a11y bar than the lib.

  DEFINITION OF DONE — every item verified in a real browser, not asserted:

  BRAND & LOGO (higgsfield)
  1. Generate the Mermaid Monkey MASCOT + mark with the higgsfield CLI (confirm
     exact flags via `higgsfield generate create --help`; `higgsfield auth login`
     first if needed). Concept brief: a charming mermaid-monkey character —
     monkey + mermaid tail — rendered in the Luminous Depth palette (soft accent
     glow #5BA8FF→#7D6CFF on deep #08090C), clean and modern, NOT a neon
     cyberpunk look. Produce two forms: (a) the mascot for the hero, and (b) a
     reduced abstract glyph (the tail-as-flow / nodes) that survives at favicon
     size. Iterate ≥3 prompt variations per form, pick one each, record chosen
     prompts + job ids. The mascot must read as friendly and crafted, not gaudy.
  2. Derive the full asset set, all committed under the site's assets dir: SVG
     logo + wordmark (light + dark variants), the reduced glyph as favicon
     (.ico/.svg + 180px apple-touch), and a 1200×630 Open Graph / Twitter social
     card featuring the mascot on a Luminous Depth backdrop. Glyph legible at 32px;
     no AI artifacts/garbled text/extra limbs in the mascot.
  3. Brand tokens are defined ONCE (CSS custom properties or a tokens file) as the
     Luminous Depth OKLCH system from CONTEXT — NOT the engine's theme.ts. No
     hardcoded hex scattered through markup; every color resolves from a token.

  PAGE STRUCTURE & CONTENT
  4. Hero (above the fold): logo + name + a one-line value proposition ("Mermaid
     syntax in, interactive GPU-rendered canvas out"), primary CTAs (Get Started,
     GitHub, npm), and a one-line copyable install command with a copy button.
     Status badges: npm version, bundle size, license, CI.
  5. LIVE interactive demo as the hero's centerpiece or the section immediately
     under it — see "LIVE DEMO" below. This is non-negotiable; a static image hero
     fails the goal.
  6. Feature grid (4–6 cards, each with an icon + one line): interactive canvas
     (zoom/pan), node folding, multi-file projects, cross-file @link navigation,
     WebGPU/WebGL rendering, backward-compatible Mermaid. Claims must match what the
     engine actually does today (cross-check goal.md item 2 scope — do not advertise
     philosophies that fall back to dagre).
  7. "Mermaid in → canvas out" section: show real Mermaid source on the left and the
     rendered interactive result on the right, so the input/output story is obvious.
  8. Quickstart / embed snippet: the copy-paste `MermaidRenderer` usage from
     goal.md item 4, with a working code block (syntax-highlighted, copy button).
  9. Footer: links to GitHub, npm, docs (vision.md / the problem list referenced in
     goal.md item 4), license, and author. No dead links.

  LIVE DEMO EMBED
  10. The page loads the REAL @mermaid-monkey/core engine and renders a live diagram
      the visitor can zoom, pan, and fold — reuse the public embed API and the same
      build pipeline as the deployable demo (goal.md item 3), do not fork a second
      renderer. Ship a curated diagram that shows off folding + a cross-file link.
  11. Theme/philosophy switcher in the demo so visitors see the engine re-theme live
      (this is a headline feature). Switching must visibly recolor and re-layout.
  12. The demo degrades gracefully: if WebGPU/WebGL is unavailable the demo area
      shows a readable fallback (a still of the same diagram + message), never a
      blank canvas (ties goal.md items 6 & 42). First paint is not blocked on the
      engine bundle — lazy-load/hydrate the canvas so hero text renders instantly.

  VISUAL DESIGN LANGUAGE (today's standards)
  13. Luminous Depth, executed with restraint. Deep cool #08090C base (never flat
      black), soft radial light sources behind the hero and live demo, tasteful
      translucency (glass at ~4% white + backdrop blur, hairline 8%-white borders),
      and the desaturated #5BA8FF→#7D6CFF accent used sparingly for emphasis only.
      Add faint grain to avoid banding on the gradients. Color carries meaning, not
      decoration — most of the page is neutral + type + space. Respect
      prefers-color-scheme; a deliberate dark-led identity with a usable light pass.
  14. Typography: one quality variable display/sans for headings + a real monospace
      for code/commands and the install line. Clear type scale, generous line-height,
      max content width for readability. No default Times/system-serif look.
  15. Motion with restraint: scroll-reveal on sections, hover states on cards/CTAs,
      a hero entrance — all honoring prefers-reduced-motion. Motion must never block
      content or cause layout shift.
  16. Pixel polish: consistent spacing scale, aligned grid, crisp logo/icons at all
      DPRs, no orphaned widows in headings, consistent corner-radius and border
      treatment that echoes the engine's node styling.

  PERFORMANCE & SEO
  17. Fast: Lighthouse ≥ 95 Performance and ≥ 95 Best-Practices on the deployed page
      (record the numbers). No render-blocking bloat; the marketing shell loads
      without waiting on the engine bundle.
  18. Complete meta: title, description, canonical URL, Open Graph + Twitter card
      tags pointing at the generated social image, theme-color, favicon set. Verify
      the card renders in a link-preview validator.
  19. Responsive from ~320px to ultrawide: hero, feature grid, code blocks, and the
      live demo all reflow cleanly; the demo stays usable (or collapses to the
      fallback still) on small/touch viewports.

  ACCESSIBILITY (page level)
  20. Keyboard-navigable, visible focus rings, semantic landmarks/headings, alt text
      on the logo/images, and AA contrast for all text against its actual backdrop
      (reuse the contrast discipline from goal.md item 55). The live canvas has an
      accessible label and is not a keyboard trap.

  HOSTING & DEPLOY
  21. Deploys to GitHub Pages via a GitHub Actions workflow on push to main (build →
      publish). Document the live URL in the README and link the page from the repo
      "About"/homepage field. Builds reproducibly from a documented command; assets
      are correctly base-pathed for the Pages subpath (or a custom domain if chosen).
  22. The page build is wired into CI (goal.md item 12): the Pages build must pass on
      PR so a broken site never merges.

  DESIGN DECISIONS REQUIRED (resolve before building, surface choice + rationale)
  - BRAND IDENTITY: Luminous Depth + Mermaid Monkey mascot (decided). Open sub-call:
    mascot-led hero (character is the focus) vs mark-led hero (abstract glyph +
    wordmark, mascot as accent). Recommend mascot-led — it's the differentiator.
  - ENGINE THEME TENSION: the live demo showcases the engine's CURRENT themes
    (theme.ts) as a real feature, but those read dated next to the site's Luminous
    Depth chrome. Decide: demo only the 1–2 best-looking engine themes for now, and
    track a separate engine-theme refresh to Luminous-Depth taste (do NOT block the
    site on it).
  - SITE TECH: vanilla HTML/CSS/TS reusing the existing vite setup (lean, fast,
    recommended) vs a framework (Astro). Default to vanilla+vite unless there's a
    reason — it keeps the demo and site on one pipeline.
  - SITE LOCATION: a /site (or /docs) folder published by Actions, vs the gh-pages
    branch. Recommend a /site package built by vite, deployed via Actions.
  - DOMAIN: GitHub Pages default subpath vs a custom domain (affects base path + OG
    canonical URL).

  CONSTRAINTS
  - The live demo must use the SAME engine/build as goal.md item 3 — one renderer,
    one pipeline, no divergent copy that can rot.
  - Every advertised feature must be true of the engine TODAY; cross-check against
    goal.md item 2 (no claiming the dagre-fallback philosophies as distinct).
  - Logo and social images come from higgsfield and are committed to the repo;
    record the prompts/job ids so they're reproducible. No placeholder art at merge.
  - Verify in a real browser (and the claude-in-chrome MCP for a non-headless,
    WebGPU-capable check of the live demo) before claiming done — screenshots in the
    PR.

  DELIVERABLE: a PR adding a deployed, Lighthouse-95+, fully responsive GitHub Pages
  landing page with a higgsfield-generated logo + social card, a live in-browser
  engine demo with theme switching, accurate feature claims, and an Actions deploy
  workflow — visually in the same class as the Vite/Bun/Biome/Drizzle landing pages.
