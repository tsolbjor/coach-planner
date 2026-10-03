import { verifyToken } from '@clerk/backend'

export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization')
  const match = header?.match(/^Bearer\s+(\S+)$/i)
  return match?.[1] ?? null
}

/** Verify the Clerk session JWT and return the Clerk user id. */
export async function requireUserId(request: Request): Promise<string> {
  const token = bearerToken(request)
  if (!token) throw new HttpError(401, 'Missing bearer token')
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) throw new Error('CLERK_SECRET_KEY is not set')
  const authorizedParties = process.env.CLERK_AUTHORIZED_PARTIES?.split(',').map((s) => s.trim()).filter(Boolean)
  try {
    const payload = await verifyToken(token, {
      secretKey,
      authorizedParties: authorizedParties?.length ? authorizedParties : undefined,
    })
    return payload.sub
  } catch {
    throw new HttpError(401, 'Invalid session token')
  }
}

export function json(body: unknown, init: ResponseInit = {}): Response {
  return Response.json(body, { ...init, headers: { 'cache-control': 'no-store', ...init.headers } })
}

/** Map thrown errors to JSON responses without leaking internals. */
export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) return json({ error: error.message }, { status: error.status })
  console.error(error)
  return json({ error: 'Internal server error' }, { status: 500 })
}
