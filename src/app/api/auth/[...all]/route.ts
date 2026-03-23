import { toNextJsHandler } from 'better-auth/next-js'
import { checkRateLimit } from '@/lib/api-utils'
import { auth } from '@/lib/auth'

const { GET: authGET, POST: authPOST } = toNextJsHandler(auth.handler)

export async function GET(request: Request) {
  const rateLimited = await checkRateLimit(request, 'auth')
  if (rateLimited) {
    return rateLimited
  }

  return authGET(request)
}

export async function POST(request: Request) {
  const rateLimited = await checkRateLimit(request, 'auth')
  if (rateLimited) {
    return rateLimited
  }

  return authPOST(request)
}
