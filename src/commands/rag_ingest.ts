import type { Command } from 'commander'
import chalk from 'chalk'
import { bootstrap, shutdown } from '@stravigor/cli'
import { BaseModel } from '@stravigor/database'
import { BrainManager } from '@stravigor/brain'
import RagManager from '../rag_manager.ts'

export function register(program: Command): void {
  program
    .command('rag:ingest <model>')
    .description('Vectorize all records for a model into the vector store')
    .option('--chunk <size>', 'Records per batch', '100')
    .action(async (modelPath: string, options: { chunk: string }) => {
      let db
      try {
        const { db: database, config } = await bootstrap()
        db = database

        new BaseModel(db)
        new RagManager(config)
        new BrainManager(config)

        const resolved = require.resolve(`${process.cwd()}/${modelPath}`)
        const module = await import(resolved)
        const ModelClass = module.default ?? (Object.values(module)[0] as any)

        if (typeof ModelClass?.importAll !== 'function') {
          console.error(chalk.red(`Model "${modelPath}" does not use the retrievable() mixin.`))
          process.exit(1)
        }

        const chunkSize = parseInt(options.chunk, 10)
        const collectionName = ModelClass.retrievableAs()
        console.log(chalk.dim(`Vectorizing ${ModelClass.name} into "${collectionName}"...`))

        const count = await ModelClass.importAll(chunkSize)
        console.log(chalk.green(`Vectorized ${count} record(s) into "${collectionName}".`))
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : err}`))
        process.exit(1)
      } finally {
        if (db) await shutdown(db)
      }
    })
}
