import type { z } from 'zod'
import { HttpError } from './auth.js'
import { planIdSchema } from './plans.js'

/** Path segments after `/api/`, URL-decoded. */
export function pathSegments(request: Request): string[] {
  return new URL(request.url).pathname.split('/').filter(Boolean).slice(1).map(decodeURIComponent)
}

/** Plan id from `/api/plans/:id/...`. */
export function planIdFrom(request: Request): string {
  const parsed = planIdSchema.safeParse(pathSegments(request)[1])
  if (!parsed.success) throw new HttpError(400, 'Invalid plan id')
  return parsed.data
}

const idParam = /^[A-Za-z0-9_-]{1,100}$/

/** A trailing id such as `/api/plans/:id/members/:userId`. */
export function segmentAt(request: Request, index: number): string {
  const value = pathSegments(request)[index]
  if (!value || !idParam.test(value)) throw new HttpError(400, 'Invalid path')
  return value
}

export async function readJson<T extends z.ZodType>(request: Request, schema: T, maxBytes = 16 * 1024): Promise<z.infer<T>> {
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new HttpError(413, 'Request too large')
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new HttpError(400, 'Invalid JSON')
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) throw new HttpError(400, 'Invalid request body')
  return parsed.data
}
