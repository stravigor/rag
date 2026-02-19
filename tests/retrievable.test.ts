import { describe, test, expect, beforeEach } from 'bun:test'
import RagManager from '../src/rag_manager.ts'
import { retrievable } from '../src/retrievable.ts'
import { Emitter } from '@stravigor/kernel'
import { bootRag, recordingStore } from './helpers.ts'

// ── Fake BaseModel ──────────────────────────────────────────────────────

class FakeBaseModel {
  static tableName = 'documents'
  static primaryKeyProperty = 'id'
  static primaryKeyColumn = 'id'
  static db: any = null

  static hydrate(row: Record<string, unknown>) {
    const instance = new this()
    Object.assign(instance, row)
    return instance
  }
}

class Document extends retrievable(FakeBaseModel as any) {
  declare id: number
  declare title: string
  declare body: string

  static override retrievableAs() {
    return 'documents'
  }

  override toRetrievableContent() {
    return `${this.title}\n${this.body}`
  }

  override toRetrievableMetadata() {
    return { source: 'test' }
  }
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('retrievable() mixin', () => {
  beforeEach(() => {
    RagManager.reset()
  })

  test('retrievableAs() returns configured name', () => {
    expect(Document.retrievableAs()).toBe('documents')
  })

  test('toRetrievableContent() returns combined text', () => {
    const doc = new Document()
    Object.assign(doc, { id: 1, title: 'Hello', body: 'World' })
    expect(doc.toRetrievableContent()).toBe('Hello\nWorld')
  })

  test('toRetrievableMetadata() returns metadata', () => {
    const doc = new Document()
    expect(doc.toRetrievableMetadata()).toEqual({ source: 'test' })
  })

  test('shouldBeRetrievable() defaults to true', () => {
    const doc = new Document()
    expect(doc.shouldBeRetrievable()).toBe(true)
  })

  test('flushVectors() delegates to store.flush', async () => {
    bootRag()
    const { store, calls } = recordingStore('memory')
    RagManager.useStore(store)

    await Document.flushVectors()

    expect(calls.length).toBe(1)
    expect(calls[0]!.method).toBe('flush')
    expect(calls[0]!.args[0]).toBe('documents')
  })

  test('flushVectors() applies collection prefix', async () => {
    bootRag({ prefix: 'test_' })
    const { store, calls } = recordingStore('memory')
    RagManager.useStore(store)

    await Document.flushVectors()

    expect(calls[0]!.args[0]).toBe('test_documents')
  })

  test('createVectorCollection() delegates to store.createCollection', async () => {
    bootRag()
    const { store, calls } = recordingStore('memory')
    RagManager.useStore(store)

    await Document.createVectorCollection()

    expect(calls.length).toBe(1)
    expect(calls[0]!.method).toBe('createCollection')
    expect(calls[0]!.args[0]).toBe('documents')
    expect(calls[0]!.args[1]).toBe(3) // dimension from mock config
  })

  test('vectorRemove() delegates to store.deleteBySource', async () => {
    bootRag()
    const { store, calls } = recordingStore('memory')
    RagManager.useStore(store)

    const doc = new Document()
    Object.assign(doc, { id: 42 })
    await doc.vectorRemove()

    expect(calls.length).toBe(1)
    expect(calls[0]!.method).toBe('deleteBySource')
    expect(calls[0]!.args[0]).toBe('documents')
    expect(calls[0]!.args[1]).toBe(42)
  })

  test('bootRetrieval() registers event listeners', () => {
    const listeners: string[] = []
    const original = Emitter.on.bind(Emitter)
    const spy = (event: string, _fn: any) => {
      listeners.push(event)
      return original(event, _fn)
    }
    Emitter.on = spy as any

    try {
      Document.bootRetrieval('document')
      expect(listeners).toContain('document.created')
      expect(listeners).toContain('document.updated')
      expect(listeners).toContain('document.synced')
      expect(listeners).toContain('document.deleted')
    } finally {
      Emitter.on = original
    }
  })

  test('bootRetrieval() only boots once', () => {
    let callCount = 0
    const original = Emitter.on.bind(Emitter)
    Emitter.on = ((...args: any[]) => {
      callCount++
      return original(...args)
    }) as any

    try {
      // Create a fresh class to avoid state from previous test
      class Fresh extends retrievable(FakeBaseModel as any) {}
      Fresh.bootRetrieval('fresh')
      const firstCount = callCount
      Fresh.bootRetrieval('fresh')
      expect(callCount).toBe(firstCount) // No additional calls
    } finally {
      Emitter.on = original
    }
  })
})
