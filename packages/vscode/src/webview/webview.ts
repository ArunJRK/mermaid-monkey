import { MermaidRenderer } from '@mermaid-monkey/core'

declare function acquireVsCodeApi(): {
  postMessage(msg: any): void
  getState(): any
  setState(state: any): void
}

const vscode = acquireVsCodeApi()
const canvas = document.getElementById('canvas') as HTMLCanvasElement
const renderer = new MermaidRenderer()

async function init() {
  await renderer.mount(canvas)

  renderer.on('node:click', (e) => {
    console.log('Selected:', e.nodeId)
  })

  renderer.on('link:navigate', (link) => {
    vscode.postMessage({
      type: 'navigate',
      targetFile: link.targetFile,
      targetNode: link.targetNode,
    })
  })

  renderer.on('error', (err) => {
    console.error('Render error:', err)
  })

  vscode.postMessage({ type: 'ready' })
}

window.addEventListener('message', async (event) => {
  const msg = event.data
  switch (msg.type) {
    case 'load':
      await renderer.load(msg.source)
      break
    case 'foldAll':
      renderer.foldAll()
      break
    case 'unfoldAll':
      renderer.unfoldAll()
      break
  }
})

init().catch(console.error)
