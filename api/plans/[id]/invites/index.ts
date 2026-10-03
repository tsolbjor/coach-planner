import { errorResponse, json, requireUserId } from '../../../../server/auth.js'
import { getDb } from '../../../../server/db/client.js'
import { planIdFrom, readJson } from '../../../../server/http.js'
import { createInvite, createInviteBody } from '../../../../server/sharing.js'

/** Create an invite link. The token is returned once and only its hash is stored. */
export async function POST(request: Request): Promise<Response> {
  try {
    const userId = await requireUserId(request)
    const body = await readJson(request, createInviteBody)
    return json(await createInvite(getDb(), planIdFrom(request), userId, body), { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
