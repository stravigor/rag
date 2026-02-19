import type { BaseModel } from '@stravigor/database'
import type { NormalizeConstructor } from '@stravigor/kernel'
import { Emitter } from '@stravigor/kernel'
import { brain } from '@stravigor/brain'
import RagManager from './rag_manager.ts'
import { createChunker } from './chunking/chunker.ts'
import type { VectorDocument, RetrieveOptions, RetrieveResult } from './types.ts'

export function retrievable<T extends NormalizeConstructor<typeof BaseModel>>(Base: T) {
  return class Retrievable extends Base {
    private static _retrievalBooted = false

    static retrievableAs(): string {
      return (this as unknown as typeof BaseModel).tableName
    }

    toRetrievableContent(): string {
      const parts: string[] = []
      for (const key of Object.keys(this)) {
        if (key.startsWith('_')) continue
        const val = (this as any)[key]
        if (typeof val === 'string' && val.length > 0) parts.push(val)
      }
      return parts.join('\n')
    }

    toRetrievableMetadata(): Record<string, unknown> {
      return {}
    }

    shouldBeRetrievable(): boolean {
      return true
    }

    // ── Instance methods ──────────────────────────────────────────────

    async vectorize(): Promise<void> {
      if (!this.shouldBeRetrievable()) return

      const ctor = this.constructor as typeof Retrievable
      const collection = RagManager.collectionName(ctor.retrievableAs())
      const config = RagManager.config
      const pkProp = (ctor as unknown as typeof BaseModel).primaryKeyProperty
      const id = (this as any)[pkProp]

      const content = this.toRetrievableContent()
      if (!content) return

      // Remove existing chunks for this model instance
      await RagManager.store().deleteBySource(collection, id)

      const chunker = createChunker(config.chunking)
      const chunks = chunker.chunk(content)
      if (chunks.length === 0) return

      const texts = chunks.map(c => c.content)
      const embeddings = await brain.embed(texts, {
        provider: config.embedding.provider,
        model: config.embedding.model,
      })

      const metadata = this.toRetrievableMetadata()
      const documents: VectorDocument[] = chunks.map((chunk, i) => ({
        id: `${id}_${i}`,
        sourceId: id,
        content: chunk.content,
        embedding: embeddings[i]!,
        metadata: {
          ...metadata,
          modelId: id,
          chunkIndex: chunk.index,
        },
      }))

      await RagManager.store().upsert(collection, documents)
    }

    async vectorRemove(): Promise<void> {
      const ctor = this.constructor as typeof Retrievable
      const collection = RagManager.collectionName(ctor.retrievableAs())
      const pkProp = (ctor as unknown as typeof BaseModel).primaryKeyProperty
      const id = (this as any)[pkProp]
      await RagManager.store().deleteBySource(collection, id)
    }

    // ── Static methods ────────────────────────────────────────────────

    static async retrieve(query: string, options?: RetrieveOptions): Promise<RetrieveResult> {
      const { rag } = await import('./helpers.ts')
      return rag.retrieve(query, {
        ...options,
        collection: options?.collection ?? this.retrievableAs(),
      })
    }

    static async importAll(chunkSize: number = 100): Promise<number> {
      const ModelCtor = this as unknown as typeof BaseModel & typeof Retrievable
      const collection = RagManager.collectionName(this.retrievableAs())
      const config = RagManager.config
      const db = ModelCtor.db
      const table = ModelCtor.tableName
      const pkCol = ModelCtor.primaryKeyColumn

      await RagManager.store().createCollection(collection, config.embedding.dimension)

      let imported = 0
      let offset = 0

      while (true) {
        const rows = (await db.sql.unsafe(
          `SELECT * FROM "${table}" ORDER BY "${pkCol}" LIMIT $1 OFFSET $2`,
          [chunkSize, offset]
        )) as Record<string, unknown>[]

        if (rows.length === 0) break

        for (const row of rows) {
          const instance = ModelCtor.hydrate(row) as InstanceType<typeof Retrievable>
          if (instance.shouldBeRetrievable()) {
            try {
              await instance.vectorize()
              imported++
            } catch {
              // Vectorization is secondary — continue on failure
            }
          }
        }

        offset += chunkSize
        if (rows.length < chunkSize) break
      }

      return imported
    }

    static async flushVectors(): Promise<void> {
      const collection = RagManager.collectionName(this.retrievableAs())
      await RagManager.store().flush(collection)
    }

    static async createVectorCollection(): Promise<void> {
      const collection = RagManager.collectionName(this.retrievableAs())
      await RagManager.store().createCollection(collection, RagManager.config.embedding.dimension)
    }

    static bootRetrieval(eventPrefix: string): void {
      if (this._retrievalBooted) return
      this._retrievalBooted = true

      const vectorizeFn = async (model: unknown) => {
        if (model && typeof (model as any).vectorize === 'function') {
          try {
            await (model as any).vectorize()
          } catch {
            // Vectorization is secondary — failures should not break the event pipeline
          }
        }
      }

      const removeFn = async (model: unknown) => {
        if (model && typeof (model as any).vectorRemove === 'function') {
          try {
            await (model as any).vectorRemove()
          } catch {
            // Vector removal is secondary
          }
        }
      }

      Emitter.on(`${eventPrefix}.created`, vectorizeFn)
      Emitter.on(`${eventPrefix}.updated`, vectorizeFn)
      Emitter.on(`${eventPrefix}.synced`, vectorizeFn)
      Emitter.on(`${eventPrefix}.deleted`, removeFn)
    }
  }
}

export type RetrievableInstance = InstanceType<ReturnType<typeof retrievable>>
export type RetrievableModel = ReturnType<typeof retrievable>
