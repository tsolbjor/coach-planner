import { errorResponse, requireUserId } from '../../../../server/auth.js'
import { getDb } from '../../../../server/db/client.js'
import { planIdFrom, readJson, segmentAt } from '../../../../server/http.js'
import { removeMember, updateMember, updateMemberBody } from '../../../../server/sharing.js'

export async function PATCH(request: Request): Promise<Response> {
  try {
    const userId = await requireUserId(request)
    const { role } = await readJson(request, updateMemberBody)
    await updateMember(getDb(), planIdFrom(request), segmentAt(request, 3), userId, role)
    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const userId = await requireUserId(request)
    await removeMember(getDb(), planIdFrom(request), segmentAt(request, 3), userId)
    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
