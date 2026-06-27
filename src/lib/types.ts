export interface Profile {
  id: string
  username: string | null
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  website: string | null
  created_at: string
  is_admin?: boolean
  is_banned?: boolean
}

export interface Moment {
  id: string
  user_id: string
  photo_url: string
  caption: string | null
  mood: string | null
  custom_mood_emoji: string | null
  custom_mood_label: string | null
  film_preset_id: string | null
  is_public: boolean
  created_at: string
}

export interface MomentWithProfile extends Moment {
  profiles: Profile
}

export interface Reaction {
  id: string
  moment_id: string
  user_id: string
  type: ReactionType
  created_at: string
}

export type ReactionType = 'warm' | 'nostalgic' | 'calm' | 'wow' | 'relatable' | 'custom'

export interface Follow {
  follower_id: string
  following_id: string
  created_at: string
}

export interface CommentWithProfile {
  id: string
  moment_id: string
  user_id: string
  text: string
  created_at: string
  profiles: Profile | null
}

export interface SavedMoment {
  id: string
  user_id: string
  moment_id: string
  saved_at: string
}

export interface NotificationItem {
  id: string
  user_id: string
  type: 'follow' | 'reaction' | 'comment'
  actor_id: string | null
  moment_id: string | null
  payload: Record<string, unknown>
  read: boolean
  created_at: string
  profiles: Profile | null
  moments: { photo_url: string } | null
}

export interface Highlight {
  id: string
  user_id: string
  moment_id: string
  position: number
  created_at: string
}

export interface HighlightWithMoment extends Highlight {
  moments: { photo_url: string; id: string } | null
}

export interface Album {
  id: string
  user_id: string
  title: string
  is_public: boolean
  created_at: string
}

export interface AlbumWithMoments extends Album {
  moments_count: number
  first_moment_url: string | null
}

export const EMOTIONS = [
  { type: 'warm' as ReactionType,      emoji: '🔥', label: 'Тепло'      },
  { type: 'nostalgic' as ReactionType, emoji: '🌅', label: 'Ностальгия' },
  { type: 'calm' as ReactionType,      emoji: '🌿', label: 'Спокойно'   },
  { type: 'wow' as ReactionType,       emoji: '✨', label: 'Вау'         },
  { type: 'relatable' as ReactionType, emoji: '🤍', label: 'Близко'     },
] as const
