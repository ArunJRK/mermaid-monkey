import { BitmapFont } from 'pixi.js'

let installed = false

// Printable ASCII range + common symbols
const ASCII_CHARS = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~▶▼→★·'

/**
 * Install dynamic BitmapFonts at 4x render resolution.
 * fontSize is 4x the display size so text stays crisp up to 4x zoom.
 * PixiJS scales it down to display size via the BitmapText fontSize prop.
 */
export function ensureFontsInstalled(): void {
  if (installed) return
  installed = true

  const resolution = Math.max(2, Math.ceil(window.devicePixelRatio ?? 1)) * 2

  BitmapFont.install({
    name: 'MermaidNode',
    style: {
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      fontSize: 14 * resolution,
      fill: 0xf1f5f9,
    },
    chars: ASCII_CHARS.split(''),
  })

  BitmapFont.install({
    name: 'MermaidLabel',
    style: {
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      fontSize: 12 * resolution,
      fill: 0x94a3b8,
      fontWeight: 'bold',
    },
    chars: ASCII_CHARS.split(''),
  })

  BitmapFont.install({
    name: 'MermaidNodeBold',
    style: {
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      fontSize: 14 * resolution,
      fill: 0xf1f5f9,
      fontWeight: 'bold',
    },
    chars: ASCII_CHARS.split(''),
  })

  BitmapFont.install({
    name: 'MermaidEdge',
    style: {
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      fontSize: 11 * resolution,
      fill: 0xcbd5e1,
    },
    chars: ASCII_CHARS.split(''),
  })

  BitmapFont.install({
    name: 'MermaidBlueprint',
    style: {
      fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
      fontSize: 14 * resolution,
      fill: 0xffffff,
    },
    chars: ASCII_CHARS.split(''),
  })

  BitmapFont.install({
    name: 'MermaidBlueprintBold',
    style: {
      fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
      fontSize: 14 * resolution,
      fill: 0xffffff,
      fontWeight: 'bold',
    },
    chars: ASCII_CHARS.split(''),
  })
}
