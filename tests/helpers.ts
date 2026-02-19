import RagManager from '../src/rag_manager.ts'
import type { VectorStore } from '../src/vector_store.ts'
import type { VectorDocument, QueryOptions, QueryResult } from '../src/types.ts'

// ── Mock Configuration ──────────────────────────────────────────────────

export function mockConfig(overrides: Record<string, unknown> = {}) {
  const defaults = {
    default: 'memory',
    prefix: '',
    embedding: {
      provider: 'openai',
      model: 'text-embedding-3-small',
      dimension: 3,
    },
    chunking: {
      strategy: 'recursive',
      chunkSize: 512,
      overlap: 64,
    },
    stores: {
      memory: { driver: 'memory' },
      null: { driver: 'null' },
    },
  }

  const ragConfig = { ...defaults, ...overrides }
  const data: Record<string, unknown> = { rag: ragConfig }

  return {
    get(key: string, defaultValue?: unknown): unknown {
      const parts = key.split('.')
      let current: any = data
      for (const part of parts) {
        if (current === undefined || current === null) return defaultValue
        current = current[part]
      }
      return current !== undefined ? current : defaultValue
    },
    has(key: string): boolean {
      return this.get(key) !== undefined
    },
  } as any
}

// ── Bootstrap RagManager ────────────────────────────────────────────────

export function bootRag(overrides: Record<string, unknown> = {}) {
  const config = mockConfig(overrides)
  RagManager.reset()
  new RagManager(config)
  return { config }
}

// ── Recording Store ─────────────────────────────────────────────────────

export interface StoreCall {
  method: string
  args: unknown[]
}

export function recordingStore(driverName: string = 'recording'): {
  store: VectorStore
  calls: StoreCall[]
} {
  const calls: StoreCall[] = []

  const store: VectorStore = {
    name: driverName,
    async createCollection(...args: unknown[]) {
      calls.push({ method: 'createCollection', args })
    },
    async deleteCollection(...args: unknown[]) {
      calls.push({ method: 'deleteCollection', args })
    },
    async upsert(...args: unknown[]) {
      calls.push({ method: 'upsert', args })
    },
    async delete(...args: unknown[]) {
      calls.push({ method: 'delete', args })
    },
    async deleteBySource(...args: unknown[]) {
      calls.push({ method: 'deleteBySource', args })
    },
    async flush(...args: unknown[]) {
      calls.push({ method: 'flush', args })
    },
    async query(...args: unknown[]): Promise<QueryResult> {
      calls.push({ method: 'query', args })
      return { matches: [] }
    },
  }

  return { store, calls }
}
