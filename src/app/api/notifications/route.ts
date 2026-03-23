import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/api-utils'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { NotificationRepository } from '@/lib/db/queries/notification'
import { UserRepository } from '@/lib/db/queries/user'

export async function GET(request: Request) {
  const rateLimited = await checkRateLimit(request)
  if (rateLimited) {
    return rateLimited
  }

  try {
    const user = await UserRepository.getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthenticated.' },
        { status: 401 },
      )
    }

    const { data: notifications, error } = await NotificationRepository.getByUserId(user.id)

    if (error) {
      return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    return NextResponse.json(notifications)
  }
  catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
