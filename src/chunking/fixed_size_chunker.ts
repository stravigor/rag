import type { Chunk, Chunker } from '../types.ts'

export class FixedSizeChunker implements Chunker {
  constructor(
    private readonly chunkSize: number = 512,
    private readonly overlap: number = 64
  ) {}

  chunk(content: string): Chunk[] {
    if (!content) return []

    const chunks: Chunk[] = []
    const step = Math.max(1, this.chunkSize - this.overlap)

    let start = 0
    let index = 0

    while (start < content.length) {
      const end = Math.min(start + this.chunkSize, content.length)
      chunks.push({
        content: content.slice(start, end),
        index,
        startOffset: start,
        endOffset: end,
      })
      index++
      start += step
      if (end === content.length) break
    }

    return chunks
  }
}
