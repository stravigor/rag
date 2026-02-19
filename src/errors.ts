import { StravError } from '@stravigor/kernel'

export class RagError extends StravError {}

export class CollectionNotFoundError extends RagError {
  constructor(collection: string) {
    super(`Vector collection "${collection}" not found.`)
  }
}

export class VectorQueryError extends RagError {
  constructor(collection: string, cause?: string) {
    super(`Vector query on "${collection}" failed${cause ? `: ${cause}` : ''}.`)
  }
}

export class EmbeddingError extends RagError {
  constructor(cause?: string) {
    super(`Embedding generation failed${cause ? `: ${cause}` : ''}.`)
  }
}
