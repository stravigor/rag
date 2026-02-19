import type { Command } from 'commander'
import chalk from 'chalk'
import { bootstrap, shutdown } from '@stravigor/cli'
import { BaseModel } from '@stravigor/database'
import RagManager from '../rag_manager.ts'

export function register(program: Command): void {
  program
    .command('rag:flush <model>')
    .description("Flush all vectors from a model's vector collection")
    .action(async (modelPath: string) => {
      let db
      try {
        const { db: database, config } = await bootstrap()
        db = database

        new BaseModel(db)
        new RagManager(config)

        const resolved = require.resolve(`${process.cwd()}/${modelPath}`)
        const module = await import(resolved)
        const ModelClass = module.default ?? (Object.values(module)[0] as any)

        if (typeof ModelClass?.flushVectors !== 'function') {
          console.error(chalk.red(`Model "${modelPath}" does not use the retrievable() mixin.`))
          process.exit(1)
        }

        const collectionName = ModelClass.retrievableAs()
        console.log(chalk.dim(`Flushing "${collectionName}"...`))

        await ModelClass.flushVectors()
        console.log(chalk.green(`Flushed all vectors from "${collectionName}".`))
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : err}`))
        process.exit(1)
      } finally {
        if (db) await shutdown(db)
      }
    })
}
