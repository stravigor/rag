// Manager
export { default, default as RagManager } from './rag_manager.ts'

// Provider
export { default as RagProvider } from './rag_provider.ts'

// Store interface
export type { VectorStore } from './vector_store.ts'

// Drivers
export { NullDriver } from './drivers/null_driver.ts'
export { MemoryDriver } from './drivers/memory_driver.ts'
export { PgvectorDriver } from './drivers/pgvector_driver.ts'

// Mixin
export { retrievable } from './retrievable.ts'
export type { RetrievableInstance, RetrievableModel } from './retrievable.ts'

// Helper
export { rag } from './helpers.ts'

// Chunking
export { createChunker } from './chunking/chunker.ts'
export { FixedSizeChunker } from './chunking/fixed_size_chunker.ts'
export { RecursiveChunker } from './chunking/recursive_chunker.ts'

// Errors
export { RagError, CollectionNotFoundError, VectorQueryError, EmbeddingError } from './errors.ts'

// Types
export type {
  RagConfig,
  StoreConfig,
  EmbeddingConfig,
  ChunkingConfig,
  VectorDocument,
  QueryOptions,
  QueryResult,
  VectorMatch,
  RetrieveOptions,
  RerankOptions,
  RetrieveResult,
  RetrievedDocument,
  Chunk,
  Chunker,
} from './types.ts'

export type { IngestOptions } from './helpers.ts'
