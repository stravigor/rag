import type { VectorDocument, QueryOptions, QueryResult } from './types.ts'

export interface VectorStore {
  readonly name: string

  createCollection(collection: string, dimension: number): Promise<void>
  deleteCollection(collection: string): Promise<void>

  upsert(collection: string, documents: VectorDocument[]): Promise<void>
  delete(collection: string, ids: (string | number)[]): Promise<void>
  deleteBySource(collection: string, sourceId: string | number): Promise<void>
  flush(collection: string): Promise<void>

  query(collection: string, vector: number[], options?: QueryOptions): Promise<QueryResult>
}
