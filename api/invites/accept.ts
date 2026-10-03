import { errorResponse, json, requireUserId } from '../../server/auth.js'
import { getDb } from '../../server/db/client.js'
import { readJson } from '../../server/http.js'
import { acceptInvite, acceptInviteBody } from '../../server/sharing.js'

export async function POST(request: Request): Promise<Response> {
  try {
    const userId = await requireUserId(request)
    const { token } = await readJson(request, acceptInviteBody)
    return json(await acceptInvite(getDb(), token, userId))
  } catch (error) {
    return errorResponse(error)
  }
}
