import { errorResponse, HttpError, json, requireUserId } from '../../server/auth.js'
import { getDb } from '../../server/db/client.js'
import { deletePlan, getPlan, MAX_PLAN_BYTES, planIdSchema, putPlan, putPlanBody } from '../../server/plans.js'

function planIdFrom(request: Request): string {
  const id = decodeURIComponent(new URL(request.url).pathname.split('/').pop() ?? '')
  const parsed = planIdSchema.safeParse(id)
  if (!parsed.success) throw new HttpError(400, 'Invalid plan id')
  return parsed.data
}

export async function GET(request: Request): Promise<Response> {
  try {
    const userId = await requireUserId(request)
    return json(await getPlan(getDb(), planIdFrom(request), userId))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const userId = await requireUserId(request)
    const planId = planIdFrom(request)
    const text = await request.text()
    if (new TextEncoder().encode(text).byteLength > MAX_PLAN_BYTES) throw new HttpError(413, 'Plan too large')
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      throw new HttpError(400, 'Invalid JSON')
    }
    const body = putPlanBody.safeParse(raw)
    if (!body.success) throw new HttpError(400, 'Invalid plan payload')
    const result = await putPlan(getDb(), planId, userId, body.data)
    if (result.status === 'conflict') return json({ error: 'Version conflict', current: result.current }, { status: 409 })
    return json({ version: result.version, updatedAt: result.updatedAt }, { status: result.status === 'created' ? 201 : 200 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const userId = await requireUserId(request)
    await deletePlan(getDb(), planIdFrom(request), userId)
    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
