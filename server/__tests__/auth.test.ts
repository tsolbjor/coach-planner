import { afterEach, describe, expect, it, vi } from 'vitest'
import { bearerToken, errorResponse, HttpError, requireUserId } from '../auth'

const req = (authorization?: string) =>
  new Request('https://example.test/api/health', { headers: authorization ? { authorization } : {} })

describe('bearerToken', () => {
  it('extracts the token from a Bearer header', () => {
    expect(bearerToken(req('Bearer abc.def.ghi'))).toBe('abc.def.ghi')
    expect(bearerToken(req('bearer abc'))).toBe('abc')
  })

  it('returns null for missing or malformed headers', () => {
    expect(bearerToken(req())).toBeNull()
    expect(bearerToken(req('Basic abc'))).toBeNull()
    expect(bearerToken(req('Bearer'))).toBeNull()
  })
})

describe('requireUserId', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('rejects requests without a token with 401', async () => {
    await expect(requireUserId(req())).rejects.toMatchObject({ status: 401 })
  })

  it('rejects invalid tokens with 401', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_dummy')
    await expect(requireUserId(req('Bearer not-a-jwt'))).rejects.toMatchObject({ status: 401 })
  })
})

describe('errorResponse', () => {
  it('hides internal error details', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = errorResponse(new Error('connection string leaked'))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Internal server error' })
  })

  it('passes through HttpError status and message', async () => {
    const res = errorResponse(new HttpError(403, 'Forbidden'))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Forbidden' })
  })
})
