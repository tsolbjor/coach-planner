import { errorResponse, json, requireUserId } from '../../../server/auth.js'
import { getDb } from '../../../server/db/client.js'
import { planIdFrom, readJson } from '../../../server/http.js'
import { deletePlan, getPlan, MAX_PLAN_BYTES, putPlan, putPlanBody } from '../../../server/plans.js'

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
    const body = await readJson(request, putPlanBody, MAX_PLAN_BYTES)
    const result = await putPlan(getDb(), planId, userId, body)
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
