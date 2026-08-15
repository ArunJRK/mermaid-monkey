const keyMap: Record<string, string> = {
  f: 'fitToView',
  r: 'resetView',
  Escape: 'focusOut',
}

/**
 * Maps a keyboard key to a renderer action name.
 * Returns undefined if the key has no mapped action.
 */
export function mapKeyToAction(key: string): string | undefined {
  return keyMap[key]
}

/**
 * True when a keyboard event target is an editable control (input, textarea,
 * select) or lives in an editable contenteditable region such as a rich-text
 * editor. Shortcut handlers must ignore those targets so the renderer never
 * hijacks typing in an embedding host.
 *
 * The nearest `[contenteditable]` ancestor decides editability, mirroring
 * `isContentEditable`: a `contenteditable="false"` island inside an editor
 * (the common pattern for embedded widgets) is not editable.
 */
export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  const host = target.closest('[contenteditable]')
  if (!host) return false
  const value = host.getAttribute('contenteditable')?.toLowerCase()
  return value === '' || value === 'true' || value === 'plaintext-only'
}
