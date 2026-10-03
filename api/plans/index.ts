import { errorResponse, json, requireUserId } from '../../server/auth.js'
import { getDb } from '../../server/db/client.js'
import { listPlans } from '../../server/plans.js'

export async function GET(request: Request): Promise<Response> {
  try {
    const userId = await requireUserId(request)
    return json({ plans: await listPlans(getDb(), userId) })
  } catch (error) {
    return errorResponse(error)
  }
}
