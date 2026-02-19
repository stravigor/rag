import type { VectorStore } from '../vector_store.ts'
import type { VectorDocument, QueryOptions, QueryResult, VectorMatch } from '../types.ts'

export class MemoryDriver implements VectorStore {
  readonly name = 'memory'
  private collections = new Map<string, VectorDocument[]>()

  async createCollection(collection: string, _dimension: number): Promise<void> {
    if (!this.collections.has(collection)) {
      this.collections.set(collection, [])
    }
  }

  async deleteCollection(collection: string): Promise<void> {
    this.collections.delete(collection)
  }

  async upsert(collection: string, documents: VectorDocument[]): Promise<void> {
    let docs = this.collections.get(collection)
    if (!docs) {
      docs = []
      this.collections.set(collection, docs)
    }

    for (const doc of documents) {
      if (doc.id != null) {
        const existingIndex = docs.findIndex(d => d.id === doc.id)
        if (existingIndex >= 0) {
          docs[existingIndex] = doc
        } else {
          docs.push(doc)
        }
      } else {
        docs.push(doc)
      }
    }
  }

  async delete(collection: string, ids: (string | number)[]): Promise<void> {
    const docs = this.collections.get(collection)
    if (!docs) return

    const idSet = new Set(ids.map(String))
    this.collections.set(
      collection,
      docs.filter(d => !idSet.has(String(d.id)))
    )
  }

  async deleteBySource(collection: string, sourceId: string | number): Promise<void> {
    const docs = this.collections.get(collection)
    if (!docs) return

    const sourceStr = String(sourceId)
    this.collections.set(
      collection,
      docs.filter(d => String(d.sourceId) !== sourceStr)
    )
  }

  async flush(collection: string): Promise<void> {
    if (this.collections.has(collection)) {
      this.collections.set(collection, [])
    }
  }

  async query(
    collection: string,
    vector: number[],
    options?: QueryOptions
  ): Promise<QueryResult> {
    const start = performance.now()
    const docs = this.collections.get(collection)
    if (!docs || docs.length === 0) {
      return { matches: [], processingTimeMs: performance.now() - start }
    }

    const topK = options?.topK ?? 5
    const threshold = options?.threshold ?? 0

    let scored: VectorMatch[] = docs.map(doc => ({
      id: doc.id ?? 0,
      content: doc.content,
      score: cosineSimilarity(vector, doc.embedding),
      metadata: doc.metadata ?? {},
    }))

    if (options?.filter) {
      scored = scored.filter(m => matchesFilter(m.metadata, options.filter!))
    }

    if (threshold > 0) {
      scored = scored.filter(m => m.score >= threshold)
    }

    scored.sort((a, b) => b.score - a.score)
    const matches = scored.slice(0, topK)

    return {
      matches,
      processingTimeMs: performance.now() - start,
    }
  }

  getCollection(collection: string): VectorDocument[] {
    return this.collections.get(collection) ?? []
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let magA = 0
  let magB = 0

  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!
    const bi = b[i]!
    dot += ai * bi
    magA += ai * ai
    magB += bi * bi
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}

function matchesFilter(
  metadata: Record<string, unknown>,
  filter: Record<string, unknown>
): boolean {
  for (const [key, value] of Object.entries(filter)) {
    if (metadata[key] !== value) return false
  }
  return true
}
