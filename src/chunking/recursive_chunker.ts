import type { Chunk, Chunker } from '../types.ts'

const DEFAULT_SEPARATORS = ['\n\n', '\n', '. ', ' ']

export class RecursiveChunker implements Chunker {
  private readonly separators: string[]

  constructor(
    private readonly chunkSize: number = 512,
    private readonly overlap: number = 64,
    separators?: string[]
  ) {
    this.separators = separators ?? DEFAULT_SEPARATORS
  }

  chunk(content: string): Chunk[] {
    if (!content) return []
    const pieces = this.splitRecursive(content, 0)
    return this.buildChunks(content, pieces)
  }

  private splitRecursive(text: string, separatorIndex: number): string[] {
    if (text.length <= this.chunkSize) return [text]

    const separator = this.separators[separatorIndex]
    if (!separator) {
      const result: string[] = []
      for (let i = 0; i < text.length; i += this.chunkSize) {
        result.push(text.slice(i, i + this.chunkSize))
      }
      return result
    }

    const parts = text.split(separator)
    const merged: string[] = []
    let current = ''

    for (const part of parts) {
      const candidate = current ? current + separator + part : part

      if (candidate.length <= this.chunkSize) {
        current = candidate
      } else {
        if (current) merged.push(current)
        if (part.length > this.chunkSize) {
          merged.push(...this.splitRecursive(part, separatorIndex + 1))
          current = ''
        } else {
          current = part
        }
      }
    }
    if (current) merged.push(current)

    return merged
  }

  private buildChunks(original: string, pieces: string[]): Chunk[] {
    const chunks: Chunk[] = []
    let searchFrom = 0

    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i]!
      const foundAt = original.indexOf(piece, searchFrom)
      const startOffset = foundAt >= 0 ? foundAt : searchFrom
      const pieceEnd = startOffset + piece.length

      const overlapEnd = Math.min(pieceEnd + this.overlap, original.length)
      const chunkContent = original.slice(startOffset, overlapEnd)

      chunks.push({
        content: chunkContent,
        index: i,
        startOffset,
        endOffset: overlapEnd,
      })

      searchFrom = pieceEnd
    }

    return chunks
  }
}
