import { describe, test, expect, beforeEach } from 'bun:test'
import RagManager from '../src/rag_manager.ts'
import { NullDriver } from '../src/drivers/null_driver.ts'
import { MemoryDriver } from '../src/drivers/memory_driver.ts'
import { bootRag, recordingStore } from './helpers.ts'

describe('RagManager', () => {
  beforeEach(() => {
    RagManager.reset()
  })

  test('reads config and exposes it', () => {
    bootRag()
    expect(RagManager.config.default).toBe('memory')
    expect(RagManager.config.embedding.provider).toBe('openai')
    expect(RagManager.config.chunking.strategy).toBe('recursive')
  })

  test('creates memory store from config', () => {
    bootRag()
    const store = RagManager.store('memory')
    expect(store).toBeInstanceOf(MemoryDriver)
    expect(store.name).toBe('memory')
  })

  test('creates null store from config', () => {
    bootRag()
    const store = RagManager.store('null')
    expect(store).toBeInstanceOf(NullDriver)
    expect(store.name).toBe('null')
  })

  test('returns default store when no name given', () => {
    bootRag()
    const store = RagManager.store()
    expect(store).toBeInstanceOf(MemoryDriver)
  })

  test('caches store instances', () => {
    bootRag()
    const a = RagManager.store('memory')
    const b = RagManager.store('memory')
    expect(a).toBe(b)
  })

  test('throws on unknown driver', () => {
    bootRag({ stores: { bad: { driver: 'nonexistent' } } })
    expect(() => RagManager.store('bad')).toThrow('Unknown RAG driver')
  })

  test('throws when not configured', () => {
    expect(() => RagManager.config).toThrow('RagManager not configured')
  })

  test('applies collection prefix', () => {
    bootRag({ prefix: 'test_' })
    expect(RagManager.collectionName('docs')).toBe('test_docs')
  })

  test('no prefix by default', () => {
    bootRag()
    expect(RagManager.collectionName('docs')).toBe('docs')
  })

  test('extend registers custom driver', () => {
    bootRag({ stores: { custom: { driver: 'custom' } } })

    const customStore = new NullDriver()
    RagManager.extend('custom', () => customStore)

    const store = RagManager.store('custom')
    expect(store).toBe(customStore)
  })

  test('useStore replaces a store at runtime', () => {
    bootRag()
    const { store } = recordingStore('memory')
    RagManager.useStore(store)
    expect(RagManager.store('memory')).toBe(store)
  })

  test('reset clears all state', () => {
    bootRag()
    RagManager.store('memory')
    RagManager.reset()
    expect(() => RagManager.config).toThrow('RagManager not configured')
  })

  test('throws on unconfigured store name', () => {
    bootRag()
    expect(() => RagManager.store('nonexistent')).toThrow('not configured')
  })
})
