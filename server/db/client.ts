import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from './schema.js'

/** Driver-agnostic handle so tests can substitute PGlite for Neon. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

let instance: Db | undefined

export function getDb(): Db {
  if (instance) return instance
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  instance = drizzle(neon(url), { schema }) as unknown as Db
  return instance
}

/** Test hook: replace the database handle. */
export function setDb(db: Db | undefined): void {
  instance = db
}

export { schema }
