import { describe, test, expect, beforeEach } from 'bun:test'
import { MemoryDriver } from '../src/drivers/memory_driver.ts'
import type { VectorDocument } from '../src/types.ts'

describe('MemoryDriver', () => {
  let driver: MemoryDriver

  beforeEach(() => {
    driver = new MemoryDriver()
  })

  test('createCollection initializes empty collection', async () => {
    await driver.createCollection('test', 3)
    expect(driver.getCollection('test')).toEqual([])
  })

  test('upsert adds documents', async () => {
    await driver.createCollection('test', 3)
    await driver.upsert('test', [
      { id: '1', content: 'hello', embedding: [1, 0, 0] },
      { id: '2', content: 'world', embedding: [0, 1, 0] },
    ])
    expect(driver.getCollection('test').length).toBe(2)
  })

  test('upsert creates collection if not exists', async () => {
    await driver.upsert('auto', [
      { id: '1', content: 'hello', embedding: [1, 0, 0] },
    ])
    expect(driver.getCollection('auto').length).toBe(1)
  })

  test('upsert updates existing documents by ID', async () => {
    await driver.upsert('test', [
      { id: '1', content: 'original', embedding: [1, 0, 0] },
    ])
    await driver.upsert('test', [
      { id: '1', content: 'updated', embedding: [0, 1, 0] },
    ])
    const docs = driver.getCollection('test')
    expect(docs.length).toBe(1)
    expect(docs[0]!.content).toBe('updated')
  })

  test('delete removes documents by ID', async () => {
    await driver.upsert('test', [
      { id: '1', content: 'a', embedding: [1, 0, 0] },
      { id: '2', content: 'b', embedding: [0, 1, 0] },
      { id: '3', content: 'c', embedding: [0, 0, 1] },
    ])
    await driver.delete('test', ['1', '3'])
    const docs = driver.getCollection('test')
    expect(docs.length).toBe(1)
    expect(docs[0]!.id).toBe('2')
  })

  test('deleteBySource removes documents by sourceId', async () => {
    await driver.upsert('test', [
      { id: '1_0', sourceId: '1', content: 'chunk a', embedding: [1, 0, 0] },
      { id: '1_1', sourceId: '1', content: 'chunk b', embedding: [0, 1, 0] },
      { id: '2_0', sourceId: '2', content: 'chunk c', embedding: [0, 0, 1] },
    ])
    await driver.deleteBySource('test', '1')
    const docs = driver.getCollection('test')
    expect(docs.length).toBe(1)
    expect(docs[0]!.sourceId).toBe('2')
  })

  test('flush clears collection', async () => {
    await driver.upsert('test', [
      { id: '1', content: 'hello', embedding: [1, 0, 0] },
    ])
    await driver.flush('test')
    expect(driver.getCollection('test')).toEqual([])
  })

  test('deleteCollection removes entire collection', async () => {
    await driver.upsert('test', [
      { id: '1', content: 'hello', embedding: [1, 0, 0] },
    ])
    await driver.deleteCollection('test')
    expect(driver.getCollection('test')).toEqual([])
  })

  test('query returns top-K by cosine similarity', async () => {
    await driver.upsert('test', [
      { id: '1', content: 'close', embedding: [0.9, 0.1, 0] },
      { id: '2', content: 'far', embedding: [0, 0, 1] },
      { id: '3', content: 'medium', embedding: [0.5, 0.5, 0] },
    ])

    const result = await driver.query('test', [1, 0, 0], { topK: 2 })
    expect(result.matches.length).toBe(2)
    expect(result.matches[0]!.id).toBe('1')
    expect(result.matches[0]!.score).toBeGreaterThan(result.matches[1]!.score)
  })

  test('query respects threshold', async () => {
    await driver.upsert('test', [
      { id: '1', content: 'close', embedding: [1, 0, 0] },
      { id: '2', content: 'far', embedding: [0, 0, 1] },
    ])

    const result = await driver.query('test', [1, 0, 0], { threshold: 0.9 })
    expect(result.matches.length).toBe(1)
    expect(result.matches[0]!.id).toBe('1')
  })

  test('query applies metadata filter', async () => {
    await driver.upsert('test', [
      { id: '1', content: 'a', embedding: [1, 0, 0], metadata: { domain: 'tech' } },
      { id: '2', content: 'b', embedding: [0.9, 0.1, 0], metadata: { domain: 'finance' } },
    ])

    const result = await driver.query('test', [1, 0, 0], {
      filter: { domain: 'finance' },
    })
    expect(result.matches.length).toBe(1)
    expect(result.matches[0]!.id).toBe('2')
  })

  test('query returns empty for non-existent collection', async () => {
    const result = await driver.query('nope', [1, 0, 0])
    expect(result.matches).toEqual([])
  })

  test('cosine similarity is correct for known vectors', async () => {
    // Identical vectors → similarity = 1
    await driver.upsert('test', [
      { id: '1', content: 'same', embedding: [1, 0, 0] },
    ])
    const result = await driver.query('test', [1, 0, 0])
    expect(result.matches[0]!.score).toBeCloseTo(1.0)
  })

  test('cosine similarity for orthogonal vectors is 0', async () => {
    await driver.upsert('test', [
      { id: '1', content: 'ortho', embedding: [0, 1, 0] },
    ])
    const result = await driver.query('test', [1, 0, 0])
    expect(result.matches[0]!.score).toBeCloseTo(0.0)
  })

  test('query includes processingTimeMs', async () => {
    await driver.createCollection('test', 3)
    const result = await driver.query('test', [1, 0, 0])
    expect(result.processingTimeMs).toBeDefined()
    expect(typeof result.processingTimeMs).toBe('number')
  })
})
