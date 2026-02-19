import type { VectorStore } from '../vector_store.ts'
import type { VectorDocument, QueryOptions, QueryResult } from '../types.ts'

export class NullDriver implements VectorStore {
  readonly name = 'null'

  async createCollection(_collection: string, _dimension: number): Promise<void> {}
  async deleteCollection(_collection: string): Promise<void> {}
  async upsert(_collection: string, _documents: VectorDocument[]): Promise<void> {}
  async delete(_collection: string, _ids: (string | number)[]): Promise<void> {}
  async deleteBySource(_collection: string, _sourceId: string | number): Promise<void> {}
  async flush(_collection: string): Promise<void> {}

  async query(
    _collection: string,
    _vector: number[],
    _options?: QueryOptions
  ): Promise<QueryResult> {
    return { matches: [] }
  }
}
