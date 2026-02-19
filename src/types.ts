// ── Vector Documents ─────────────────────────────────────────────────────

export interface VectorDocument {
  id?: string | number
  sourceId?: string | number
  content: string
  embedding: number[]
  metadata?: Record<string, unknown>
}

// ── Query Options & Results ──────────────────────────────────────────────

export interface QueryOptions {
  topK?: number
  threshold?: number
  filter?: Record<string, unknown>
}

export interface QueryResult {
  matches: VectorMatch[]
  processingTimeMs?: number
}

export interface VectorMatch {
  id: string | number
  content: string
  score: number
  metadata: Record<string, unknown>
}

// ── Retrieval (high-level pipeline) ──────────────────────────────────────

export interface RetrieveOptions {
  collection?: string
  topK?: number
  threshold?: number
  filter?: Record<string, unknown>
  rerank?: RerankOptions
}

export interface RerankOptions {
  authorityWeight?: number
  recencyWeight?: number
  similarityWeight?: number
}

export interface RetrieveResult {
  matches: RetrievedDocument[]
  query: string
  processingTimeMs: number
}

export interface RetrievedDocument {
  id: string | number
  content: string
  score: number
  similarity: number
  metadata: Record<string, unknown>
}

// ── Chunking ─────────────────────────────────────────────────────────────

export interface Chunk {
  content: string
  index: number
  startOffset: number
  endOffset: number
}

export interface Chunker {
  chunk(content: string): Chunk[]
}

// ── Configuration ────────────────────────────────────────────────────────

export interface RagConfig {
  default: string
  prefix: string
  embedding: EmbeddingConfig
  chunking: ChunkingConfig
  stores: Record<string, StoreConfig>
}

export interface EmbeddingConfig {
  provider: string
  model: string
  dimension: number
}

export interface ChunkingConfig {
  strategy: string
  chunkSize: number
  overlap: number
  separators?: string[]
}

export interface StoreConfig {
  driver: string
  [key: string]: unknown
}
