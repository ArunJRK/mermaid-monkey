import { describe, it, expect } from 'vitest'
import { isEditableShortcutTarget, mapKeyToAction } from '../keyboard'

describe('keyboard', () => {
  it('maps f to fitToView', () => {
    expect(mapKeyToAction('f')).toBe('fitToView')
  })

  it('maps r to resetView', () => {
    expect(mapKeyToAction('r')).toBe('resetView')
  })

  it('returns undefined for unknown keys', () => {
    expect(mapKeyToAction('x')).toBeUndefined()
    expect(mapKeyToAction('a')).toBeUndefined()
  })
})

describe('isEditableShortcutTarget', () => {
  it('exempts form controls', () => {
    expect(isEditableShortcutTarget(document.createElement('input'))).toBe(true)
    expect(isEditableShortcutTarget(document.createElement('textarea'))).toBe(true)
    expect(isEditableShortcutTarget(document.createElement('select'))).toBe(true)
  })

  it('exempts contenteditable hosts', () => {
    const editor = document.createElement('div')
    editor.setAttribute('contenteditable', 'true')
    expect(isEditableShortcutTarget(editor)).toBe(true)
  })

  it('exempts descendants of contenteditable hosts', () => {
    const editor = document.createElement('div')
    editor.setAttribute('contenteditable', 'true')
    const paragraph = document.createElement('p')
    editor.appendChild(paragraph)
    expect(isEditableShortcutTarget(paragraph)).toBe(true)
  })

  it('exempts empty-valued and plaintext-only contenteditable hosts', () => {
    const bare = document.createElement('div')
    bare.setAttribute('contenteditable', '')
    expect(isEditableShortcutTarget(bare)).toBe(true)

    const plaintext = document.createElement('div')
    plaintext.setAttribute('contenteditable', 'plaintext-only')
    expect(isEditableShortcutTarget(plaintext)).toBe(true)
  })

  it('does not exempt plain elements or non-element targets', () => {
    expect(isEditableShortcutTarget(document.createElement('div'))).toBe(false)
    expect(isEditableShortcutTarget(document.createElement('canvas'))).toBe(false)
    expect(isEditableShortcutTarget(null)).toBe(false)
  })

  it('does not exempt elements inside a contenteditable=false island', () => {
    const editor = document.createElement('div')
    editor.setAttribute('contenteditable', 'true')
    const island = document.createElement('div')
    island.setAttribute('contenteditable', 'false')
    const canvas = document.createElement('canvas')
    island.appendChild(canvas)
    editor.appendChild(island)
    expect(isEditableShortcutTarget(canvas)).toBe(false)
  })
})
