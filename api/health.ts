import { sql } from 'drizzle-orm'
import { bearerToken, errorResponse, json, requireUserId } from '../server/auth.js'
import { getDb } from '../server/db/client.js'

/**
 * Liveness + wiring check. Always pings the database; when a bearer token is
 * sent, also verifies it and reports the authenticated user id.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    await getDb().execute(sql`select 1`)
    const userId = bearerToken(request) ? await requireUserId(request) : null
    return json({ ok: true, db: 'ok', userId })
  } catch (error) {
    return errorResponse(error)
  }
}
