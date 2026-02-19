import { describe, test, expect } from 'bun:test'
import { FixedSizeChunker } from '../src/chunking/fixed_size_chunker.ts'
import { RecursiveChunker } from '../src/chunking/recursive_chunker.ts'
import { createChunker } from '../src/chunking/chunker.ts'

describe('FixedSizeChunker', () => {
  test('chunks content into fixed sizes', () => {
    const chunker = new FixedSizeChunker(10, 0)
    const chunks = chunker.chunk('abcdefghijklmnopqrstuvwxyz')
    expect(chunks.length).toBe(3)
    expect(chunks[0]!.content).toBe('abcdefghij')
    expect(chunks[1]!.content).toBe('klmnopqrst')
    expect(chunks[2]!.content).toBe('uvwxyz')
  })

  test('applies overlap between chunks', () => {
    const chunker = new FixedSizeChunker(10, 3)
    const chunks = chunker.chunk('abcdefghijklmnopqrst')
    // Step = 10 - 3 = 7
    expect(chunks[0]!.content).toBe('abcdefghij')
    expect(chunks[0]!.startOffset).toBe(0)
    expect(chunks[1]!.startOffset).toBe(7)
    expect(chunks[1]!.content).toBe('hijklmnopq')
  })

  test('handles content shorter than chunk size', () => {
    const chunker = new FixedSizeChunker(100, 10)
    const chunks = chunker.chunk('short')
    expect(chunks.length).toBe(1)
    expect(chunks[0]!.content).toBe('short')
  })

  test('handles empty content', () => {
    const chunker = new FixedSizeChunker(10, 2)
    expect(chunker.chunk('')).toEqual([])
  })

  test('tracks correct offsets', () => {
    const chunker = new FixedSizeChunker(5, 0)
    const chunks = chunker.chunk('abcdefghij')
    expect(chunks[0]!.startOffset).toBe(0)
    expect(chunks[0]!.endOffset).toBe(5)
    expect(chunks[1]!.startOffset).toBe(5)
    expect(chunks[1]!.endOffset).toBe(10)
  })

  test('indexes are sequential', () => {
    const chunker = new FixedSizeChunker(5, 0)
    const chunks = chunker.chunk('abcdefghijklmno')
    expect(chunks.map(c => c.index)).toEqual([0, 1, 2])
  })
})

describe('RecursiveChunker', () => {
  test('keeps short content as single chunk', () => {
    const chunker = new RecursiveChunker(100, 0)
    const chunks = chunker.chunk('short text')
    expect(chunks.length).toBe(1)
    expect(chunks[0]!.content).toBe('short text')
  })

  test('splits by paragraph first', () => {
    const chunker = new RecursiveChunker(30, 0)
    const content = 'First paragraph here.\n\nSecond paragraph here.'
    const chunks = chunker.chunk(content)
    expect(chunks.length).toBe(2)
    expect(chunks[0]!.content).toBe('First paragraph here.')
    expect(chunks[1]!.content).toBe('Second paragraph here.')
  })

  test('falls back to newline splitting', () => {
    const chunker = new RecursiveChunker(20, 0)
    const content = 'Line one\nLine two\nLine three'
    const chunks = chunker.chunk(content)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    // Each chunk should be <= 20 chars (before overlap)
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(20)
    }
  })

  test('handles empty content', () => {
    const chunker = new RecursiveChunker(100, 0)
    expect(chunker.chunk('')).toEqual([])
  })

  test('applies overlap', () => {
    const chunker = new RecursiveChunker(30, 5)
    const content = 'First paragraph.\n\nSecond paragraph.'
    const chunks = chunker.chunk(content)
    expect(chunks.length).toBe(2)
    // First chunk should extend into the gap/next section
    expect(chunks[0]!.endOffset).toBeGreaterThan('First paragraph.'.length)
  })

  test('force-splits when no separator works', () => {
    const chunker = new RecursiveChunker(5, 0)
    const content = 'abcdefghijklmnop'
    const chunks = chunker.chunk(content)
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(5)
    }
  })
})

describe('createChunker', () => {
  test('creates FixedSizeChunker for "fixed" strategy', () => {
    const chunker = createChunker({ strategy: 'fixed', chunkSize: 100, overlap: 10 })
    expect(chunker).toBeInstanceOf(FixedSizeChunker)
  })

  test('creates RecursiveChunker for "recursive" strategy', () => {
    const chunker = createChunker({ strategy: 'recursive', chunkSize: 100, overlap: 10 })
    expect(chunker).toBeInstanceOf(RecursiveChunker)
  })

  test('defaults to RecursiveChunker for unknown strategy', () => {
    const chunker = createChunker({ strategy: 'unknown', chunkSize: 100, overlap: 10 })
    expect(chunker).toBeInstanceOf(RecursiveChunker)
  })
})
