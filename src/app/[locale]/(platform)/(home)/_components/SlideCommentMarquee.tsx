'use client'

import type { Comment, Event } from '@/types'
import Image from 'next/image'
import { useMemo } from 'react'
import { useHeroComments } from '@/app/[locale]/(platform)/(home)/_hooks/useHeroComments'
import AppLink from '@/components/AppLink'
import {
  getAvatarPlaceholderStyle,
  shouldUseAvatarPlaceholder,
} from '@/lib/avatar'
import { resolveEventPagePath } from '@/lib/events-routing'
import { truncateAddress } from '@/lib/formatters'

interface SlideCommentMarqueeProps {
  event: Event
}

function CommentAvatar({ comment }: { comment: Comment }) {
  const showPlaceholder = shouldUseAvatarPlaceholder(comment.user_avatar)
  const seed = comment.user_proxy_wallet_address ?? comment.user_address ?? comment.user_id

  if (showPlaceholder) {
    return (
      <div
        className="size-5 shrink-0 rounded-full"
        style={getAvatarPlaceholderStyle(seed)}
      />
    )
  }

  return (
    <div className="relative size-5 shrink-0 overflow-hidden rounded-full">
      <Image
        src={comment.user_avatar}
        alt={comment.username}
        fill
        sizes="20px"
        className="object-cover"
      />
    </div>
  )
}

function resolveDisplayName(comment: Comment) {
  const name = comment.username?.trim()
  if (name) {
    return name
  }
  const address = comment.user_proxy_wallet_address ?? comment.user_address
  return address ? truncateAddress(address) : 'Anonymous'
}

function CommentRow({ comment, eventPath }: { comment: Comment, eventPath: string }) {
  return (
    <AppLink href={eventPath as never} className="block shrink-0 py-2">
      <div className="flex items-start gap-1.5">
        <CommentAvatar comment={comment} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-sm font-normal text-foreground">{resolveDisplayName(comment)}</p>
          <p className="line-clamp-2 text-xs font-normal text-muted-foreground">
            {comment.content}
          </p>
        </div>
      </div>
    </AppLink>
  )
}

export default function SlideCommentMarquee({ event }: SlideCommentMarqueeProps) {
  const { data: comments } = useHeroComments(event.slug)
  const eventPath = resolveEventPagePath(event)

  // Duplicate once for seamless loop — marquee-vertical scrolls -50% then resets
  const duplicated = useMemo(() => {
    if (!comments || comments.length === 0) {
      return []
    }
    return [...comments, ...comments]
  }, [comments])

  if (!comments || comments.length === 0) {
    return null
  }

  return (
    <div
      className="relative h-full overflow-hidden"
      style={{ maskImage: 'linear-gradient(transparent 0px, black 40px, black 100%)' }}
    >
      <div className="flex shrink-0 animate-marquee-vertical flex-col will-change-transform hover:paused">
        {duplicated.map((comment, i) => (
          <CommentRow
            key={`${comment.id}-${i}`}
            comment={comment}
            eventPath={eventPath}
          />
        ))}
      </div>
    </div>
  )
}
