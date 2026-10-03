import { errorResponse, requireUserId } from '../../../../server/auth.js'
import { getDb } from '../../../../server/db/client.js'
import { planIdFrom, segmentAt } from '../../../../server/http.js'
import { revokeInvite } from '../../../../server/sharing.js'

export async function DELETE(request: Request): Promise<Response> {
  try {
    const userId = await requireUserId(request)
    await revokeInvite(getDb(), planIdFrom(request), segmentAt(request, 3), userId)
    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
