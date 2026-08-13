# Layout Philosophies

A layout philosophy is an opinionated rendering preset. In the current v1 web scope, only two philosophies have dedicated layout engines. The others are visual/spacing presets layered on the generic Dagre engine.

## Available Philosophies

| Philosophy | Intent | Best For |
|------------|--------|----------|
| [Narrative](narrative.md) | Dedicated engine | Read like a story | Flowcharts, decision trees, user journeys |
| [Blueprint](blueprint.md) | Dedicated engine | Precise, technical, aligned | Technical flowcharts today; future fit includes class/ER/C4-style diagrams once parser scope expands |
| [Map](map.md) | Theme + Dagre fallback | See the territory at a glance | Experimental v1 preset |
| [Breath](breath.md) | Theme + Dagre fallback | Space to think | Experimental v1 preset |
| [Radial](radial.md) | Theme + Dagre fallback | Central concept radiates outward | Experimental v1 preset |
| [Mosaic](mosaic.md) | Theme + Dagre fallback | Cards on a wall | Experimental v1 preset |

## Usage

Set via directive in your `.mmd` file:

```mermaid
%% @layout narrative
```

Or programmatically:

```typescript
renderer.load(source, { layout: 'narrative' })
```

If no philosophy is specified, the renderer currently defaults to `narrative`.

## Notes

- `%% @pin` and `%% @rank` are parsed, but they are not yet enforced as visual layout constraints in the renderer.
- The dedicated v1 layout behavior lives in [packages/core/src/layout](/Volumes/Lake/Projects/ArunJRK/mermaid-monkey/packages/core/src/layout).
- The fallback philosophies remain documented here as design targets, not as fully delivered runtime guarantees.
- Parser/runtime scope is narrower than the philosophy intent language: current v1 shipping support is `flowchart` syntax only. References to class diagrams, ER diagrams, state diagrams, or C4 here describe future fit, not current parser compatibility.
- Collision guarantees are philosophy-specific: only `blueprint` promises collision-aware orthogonal routing. The others may still draw through unrelated nodes and should not be described as obstacle-free.

## Contributing a Philosophy

Add a new philosophy only after there is a matching runtime implementation, not just a theme spec. Public docs should describe shipped behavior, not planned behavior.
