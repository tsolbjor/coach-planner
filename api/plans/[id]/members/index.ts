import { errorResponse, json, requireUserId } from '../../../../server/auth.js'
import { getDb } from '../../../../server/db/client.js'
import { planIdFrom } from '../../../../server/http.js'
import { getSharing } from '../../../../server/sharing.js'

/** Owner, members and (for the owner) active invite links. */
export async function GET(request: Request): Promise<Response> {
  try {
    const userId = await requireUserId(request)
    return json(await getSharing(getDb(), planIdFrom(request), userId))
  } catch (error) {
    return errorResponse(error)
  }
}
