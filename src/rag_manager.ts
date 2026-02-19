import { inject, Configuration, ConfigurationError } from '@stravigor/kernel'
import type { VectorStore } from './vector_store.ts'
import type { RagConfig, StoreConfig, EmbeddingConfig, ChunkingConfig } from './types.ts'
import { NullDriver } from './drivers/null_driver.ts'
import { MemoryDriver } from './drivers/memory_driver.ts'
import { PgvectorDriver } from './drivers/pgvector_driver.ts'

@inject
export default class RagManager {
  private static _config: RagConfig
  private static _stores = new Map<string, VectorStore>()
  private static _extensions = new Map<string, (config: StoreConfig) => VectorStore>()

  constructor(config: Configuration) {
    RagManager._config = {
      default: config.get('rag.default', 'null') as string,
      prefix: config.get('rag.prefix', '') as string,
      embedding: config.get('rag.embedding', {
        provider: 'openai',
        model: 'text-embedding-3-small',
        dimension: 1536,
      }) as EmbeddingConfig,
      chunking: config.get('rag.chunking', {
        strategy: 'recursive',
        chunkSize: 512,
        overlap: 64,
      }) as ChunkingConfig,
      stores: config.get('rag.stores', {}) as Record<string, StoreConfig>,
    }
  }

  static get config(): RagConfig {
    if (!RagManager._config) {
      throw new ConfigurationError(
        'RagManager not configured. Resolve it through the container first.'
      )
    }
    return RagManager._config
  }

  static store(name?: string): VectorStore {
    const key = name ?? RagManager.config.default

    let store = RagManager._stores.get(key)
    if (store) return store

    const storeConfig = RagManager.config.stores[key]
    if (!storeConfig) {
      throw new ConfigurationError(`RAG store "${key}" is not configured.`)
    }

    store = RagManager.createStore(key, storeConfig)
    RagManager._stores.set(key, store)
    return store
  }

  static get prefix(): string {
    return RagManager._config?.prefix ?? ''
  }

  static collectionName(name: string): string {
    return RagManager.prefix ? `${RagManager.prefix}${name}` : name
  }

  static extend(name: string, factory: (config: StoreConfig) => VectorStore): void {
    RagManager._extensions.set(name, factory)
  }

  static useStore(store: VectorStore): void {
    RagManager._stores.set(store.name, store)
  }

  static reset(): void {
    RagManager._stores.clear()
    RagManager._extensions.clear()
    RagManager._config = undefined as any
  }

  private static createStore(name: string, config: StoreConfig): VectorStore {
    const driverName = config.driver ?? name

    const extension = RagManager._extensions.get(driverName)
    if (extension) return extension(config)

    switch (driverName) {
      case 'pgvector':
        return new PgvectorDriver(config)
      case 'memory':
        return new MemoryDriver()
      case 'null':
        return new NullDriver()
      default:
        throw new ConfigurationError(
          `Unknown RAG driver "${driverName}". Register it with RagManager.extend().`
        )
    }
  }
}
