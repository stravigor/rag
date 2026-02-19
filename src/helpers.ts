import { brain } from '@stravigor/brain'
import RagManager from './rag_manager.ts'
import type { VectorStore } from './vector_store.ts'
import type {
  RetrieveOptions,
  RetrieveResult,
  RetrievedDocument,
  VectorDocument,
  StoreConfig,
} from './types.ts'
import { createChunker } from './chunking/chunker.ts'
import { EmbeddingError } from './errors.ts'

export interface IngestOptions {
  metadata?: Record<string, unknown>
  sourceId?: string | number
  chunkSize?: number
  overlap?: number
  strategy?: string
}

export const rag = {
  store(name?: string): VectorStore {
    return RagManager.store(name)
  },

  extend(name: string, factory: (config: StoreConfig) => VectorStore): void {
    RagManager.extend(name, factory)
  },

  async ingest(
    collection: string,
    content: string,
    options: IngestOptions = {}
  ): Promise<string[]> {
    const config = RagManager.config
    const fullCollection = RagManager.collectionName(collection)

    const chunkerConfig = {
      strategy: options.strategy ?? config.chunking.strategy,
      chunkSize: options.chunkSize ?? config.chunking.chunkSize,
      overlap: options.overlap ?? config.chunking.overlap,
      separators: config.chunking.separators,
    }
    const chunker = createChunker(chunkerConfig)
    const chunks = chunker.chunk(content)

    if (chunks.length === 0) return []

    const chunkTexts = chunks.map(c => c.content)
    let embeddings: number[][]
    try {
      embeddings = await brain.embed(chunkTexts, {
        provider: config.embedding.provider,
        model: config.embedding.model,
      })
    } catch (err) {
      throw new EmbeddingError(err instanceof Error ? err.message : String(err))
    }

    const baseId = crypto.randomUUID()
    const documents: VectorDocument[] = chunks.map((chunk, i) => ({
      id: `${baseId}_${i}`,
      sourceId: options.sourceId,
      content: chunk.content,
      embedding: embeddings[i]!,
      metadata: {
        ...options.metadata,
        chunkIndex: chunk.index,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
      },
    }))

    await RagManager.store().upsert(fullCollection, documents)
    return documents.map(d => String(d.id))
  },

  async retrieve(query: string, options: RetrieveOptions = {}): Promise<RetrieveResult> {
    const start = performance.now()
    const config = RagManager.config
    const collection = RagManager.collectionName(options.collection ?? 'default')

    let queryVector: number[]
    try {
      const vectors = await brain.embed(query, {
        provider: config.embedding.provider,
        model: config.embedding.model,
      })
      queryVector = vectors[0]!
    } catch (err) {
      throw new EmbeddingError(err instanceof Error ? err.message : String(err))
    }

    const queryResult = await RagManager.store().query(collection, queryVector, {
      topK: options.topK,
      threshold: options.threshold,
      filter: options.filter,
    })

    let matches: RetrievedDocument[] = queryResult.matches.map(m => ({
      id: m.id,
      content: m.content,
      score: m.score,
      similarity: m.score,
      metadata: m.metadata,
    }))

    if (options.rerank) {
      const {
        similarityWeight = 0.6,
        authorityWeight = 0.2,
        recencyWeight = 0.2,
      } = options.rerank

      matches = matches.map(m => {
        const authority =
          typeof m.metadata.authority === 'number' ? m.metadata.authority : 0
        const createdAt = m.metadata.createdAt
        const recencyScore = createdAt
          ? 1 / (1 + daysSince(new Date(createdAt as string)) / 30)
          : 0.5

        const finalScore =
          m.similarity * similarityWeight +
          authority * authorityWeight +
          recencyScore * recencyWeight

        return { ...m, score: finalScore }
      })

      matches.sort((a, b) => b.score - a.score)
    }

    return {
      matches,
      query,
      processingTimeMs: performance.now() - start,
    }
  },

  async delete(collection: string, ids: (string | number)[]): Promise<void> {
    const fullCollection = RagManager.collectionName(collection)
    await RagManager.store().delete(fullCollection, ids)
  },

  async deleteBySource(collection: string, sourceId: string | number): Promise<void> {
    const fullCollection = RagManager.collectionName(collection)
    await RagManager.store().deleteBySource(fullCollection, sourceId)
  },

  async flush(collection: string): Promise<void> {
    const fullCollection = RagManager.collectionName(collection)
    await RagManager.store().flush(fullCollection)
  },
}

function daysSince(date: Date): number {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)
}
