import { Database } from '@stravigor/database'
import type { VectorStore } from '../vector_store.ts'
import type { VectorDocument, QueryOptions, QueryResult, VectorMatch, StoreConfig } from '../types.ts'
import { VectorQueryError } from '../errors.ts'

export class PgvectorDriver implements VectorStore {
  readonly name = 'pgvector'
  private initialized = false

  constructor(_config: StoreConfig) {}

  async createCollection(collection: string, dimension: number): Promise<void> {
    await this.ensureTable(dimension)

    const indexName = `idx_strav_vectors_hnsw_${collection.replace(/[^a-z0-9_]/gi, '_')}`
    try {
      await Database.raw.unsafe(
        `CREATE INDEX IF NOT EXISTS "${indexName}"
         ON _strav_vectors USING hnsw (embedding vector_cosine_ops)
         WHERE collection = '${collection}'`
      )
    } catch {
      // Index may already exist
    }
  }

  async deleteCollection(collection: string): Promise<void> {
    await Database.raw.unsafe(
      `DELETE FROM _strav_vectors WHERE collection = $1`,
      [collection]
    )
  }

  async upsert(collection: string, documents: VectorDocument[]): Promise<void> {
    const sql = Database.raw

    for (const doc of documents) {
      const embeddingStr = `[${doc.embedding.join(',')}]`
      const metadata = JSON.stringify(doc.metadata ?? {})
      const id = doc.id != null ? String(doc.id) : crypto.randomUUID()
      const sourceId = doc.sourceId != null ? String(doc.sourceId) : null

      await sql.unsafe(
        `INSERT INTO _strav_vectors (collection, source_id, content, metadata, embedding)
         VALUES ($1, $2, $3, $4::jsonb, $5::vector)`,
        [collection, sourceId, doc.content, metadata, embeddingStr]
      )
    }
  }

  async delete(collection: string, ids: (string | number)[]): Promise<void> {
    if (ids.length === 0) return
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ')
    await Database.raw.unsafe(
      `DELETE FROM _strav_vectors WHERE collection = $1 AND id IN (${placeholders})`,
      [collection, ...ids]
    )
  }

  async deleteBySource(collection: string, sourceId: string | number): Promise<void> {
    await Database.raw.unsafe(
      `DELETE FROM _strav_vectors WHERE collection = $1 AND source_id = $2`,
      [collection, String(sourceId)]
    )
  }

  async flush(collection: string): Promise<void> {
    await Database.raw.unsafe(
      `DELETE FROM _strav_vectors WHERE collection = $1`,
      [collection]
    )
  }

  async query(
    collection: string,
    vector: number[],
    options?: QueryOptions
  ): Promise<QueryResult> {
    const start = performance.now()
    const topK = options?.topK ?? 5
    const threshold = options?.threshold ?? 0
    const embeddingStr = `[${vector.join(',')}]`

    let whereClause = 'collection = $1'
    const params: unknown[] = [collection]
    let paramIndex = 2

    if (options?.filter) {
      for (const [key, value] of Object.entries(options.filter)) {
        whereClause += ` AND metadata->>'${key}' = $${paramIndex}`
        params.push(String(value))
        paramIndex++
      }
    }

    if (threshold > 0) {
      whereClause += ` AND (embedding <=> $${paramIndex}::vector) <= $${paramIndex + 1}`
      params.push(embeddingStr, 1 - threshold)
      paramIndex += 2
    }

    try {
      const rows = (await Database.raw.unsafe(
        `SELECT id, source_id, content, metadata,
                1 - (embedding <=> $${paramIndex}::vector) AS score
         FROM _strav_vectors
         WHERE ${whereClause}
         ORDER BY embedding <=> $${paramIndex}::vector
         LIMIT $${paramIndex + 1}`,
        [...params, embeddingStr, topK]
      )) as any[]

      const matches: VectorMatch[] = rows.map((row: any) => ({
        id: row.source_id ?? row.id,
        content: row.content,
        score: parseFloat(row.score),
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata ?? {},
      }))

      return {
        matches,
        processingTimeMs: performance.now() - start,
      }
    } catch (err) {
      throw new VectorQueryError(collection, err instanceof Error ? err.message : String(err))
    }
  }

  private async ensureTable(dimension: number): Promise<void> {
    if (this.initialized) return

    const sql = Database.raw

    await sql.unsafe(`CREATE EXTENSION IF NOT EXISTS vector`)

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS _strav_vectors (
        id BIGSERIAL PRIMARY KEY,
        collection VARCHAR(255) NOT NULL,
        source_id VARCHAR(255),
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        embedding vector(${dimension}),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    await sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_strav_vectors_collection ON _strav_vectors(collection)`
    )
    await sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_strav_vectors_source ON _strav_vectors(collection, source_id)`
    )

    this.initialized = true
  }
}
