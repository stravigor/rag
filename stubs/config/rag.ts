import { env } from '@stravigor/kernel'

export default {
  default: env('RAG_DRIVER', 'pgvector'),

  prefix: env('RAG_PREFIX', ''),

  embedding: {
    provider: env('RAG_EMBEDDING_PROVIDER', 'openai'),
    model: env('RAG_EMBEDDING_MODEL', 'text-embedding-3-small'),
    dimension: 1536,
  },

  chunking: {
    strategy: 'recursive',
    chunkSize: 512,
    overlap: 64,
  },

  stores: {
    pgvector: {
      driver: 'pgvector',
    },

    memory: {
      driver: 'memory',
    },

    null: {
      driver: 'null',
    },
  },
}
