import { describe, test, expect, beforeEach } from 'bun:test'
import RagManager from '../src/rag_manager.ts'
import { rag } from '../src/helpers.ts'
import { bootRag, recordingStore } from './helpers.ts'

describe('rag helper', () => {
  beforeEach(() => {
    RagManager.reset()
  })

  test('store() returns the default store', () => {
    bootRag()
    const store = rag.store()
    expect(store.name).toBe('memory')
  })

  test('store(name) returns a named store', () => {
    bootRag()
    const store = rag.store('null')
    expect(store.name).toBe('null')
  })

  test('delete() delegates to store.delete with prefix', async () => {
    bootRag({ prefix: 'test_' })
    const { store, calls } = recordingStore('memory')
    RagManager.useStore(store)

    await rag.delete('docs', ['1', '2'])

    expect(calls.length).toBe(1)
    expect(calls[0]!.method).toBe('delete')
    expect(calls[0]!.args[0]).toBe('test_docs')
    expect(calls[0]!.args[1]).toEqual(['1', '2'])
  })

  test('deleteBySource() delegates to store.deleteBySource with prefix', async () => {
    bootRag({ prefix: 'p_' })
    const { store, calls } = recordingStore('memory')
    RagManager.useStore(store)

    await rag.deleteBySource('docs', '42')

    expect(calls.length).toBe(1)
    expect(calls[0]!.method).toBe('deleteBySource')
    expect(calls[0]!.args[0]).toBe('p_docs')
    expect(calls[0]!.args[1]).toBe('42')
  })

  test('flush() delegates to store.flush with prefix', async () => {
    bootRag({ prefix: 'dev_' })
    const { store, calls } = recordingStore('memory')
    RagManager.useStore(store)

    await rag.flush('articles')

    expect(calls.length).toBe(1)
    expect(calls[0]!.method).toBe('flush')
    expect(calls[0]!.args[0]).toBe('dev_articles')
  })

  test('extend() registers custom driver', () => {
    bootRag({ stores: { custom: { driver: 'custom' } } })
    const { store } = recordingStore('custom')

    rag.extend('custom', () => store)
    const resolved = rag.store('custom')
    expect(resolved).toBe(store)
  })
})
