import { supabase } from './supabase'
import {
  PREMIUM_REGULAR_DAILY_FRAME_LIMIT,
  PREMIUM_REGULAR_HIGHLIGHT_LIMIT,
  getDailyFrameLimit,
  getHighlightLimit,
} from './premium'
import type {
  Profile,
  Moment,
  MomentWithProfile,
  ReactionType,
  MomentReactionSummary,
  CommentWithProfile,
  Album,
  AlbumWithMoments,
  HighlightWithMoment,
  NotificationItem,
  MomentStarTotal,
  ProfileStarTotal,
  PremiumSubscription,
  StarInvoiceResponse,
  FollowProfile,
  ReportStatus,
  ModerationReport,
  UserEntitlements,
} from './types'
import { EMOTIONS } from './types'
import { getMomentImageUrl, normalizeImageVariants } from './imageVariants'

type BlockRelationshipRow = {
  blocker_id: string
  blocked_id: string
}

const PUBLIC_PROFILE_SELECT = 'id, username, display_name, bio, avatar_url, website, created_at'
const MOMENT_WITH_PUBLIC_PROFILE_SELECT = `*, profiles(${PUBLIC_PROFILE_SELECT})`
const PUBLIC_PROFILES_VIEW = 'public_profiles'
const PUBLIC_MOMENTS_VIEW = 'public_moments'
const MY_SAVED_MOMENTS_VIEW = 'my_saved_moments'
const ALBUM_MOMENTS_VIEW = 'album_moment_details'
const MY_NOTIFICATIONS_VIEW = 'my_notifications'
const PUBLIC_MOMENT_SELECT = [
  'id',
  'user_id',
  'photo_url',
  'image_variants',
  'caption',
  'mood',
  'custom_mood_emoji',
  'custom_mood_label',
  'film_preset_id',
  'is_public',
  'visibility',
  'created_at',
  'profile_id',
  'username',
  'display_name',
  'bio',
  'avatar_url',
  'website',
  'profile_created_at',
].join(', ')
const SAVED_MOMENT_SELECT = ['saved_at', 'saved_by_user_id', PUBLIC_MOMENT_SELECT].join(', ')
const ALBUM_MOMENT_SELECT = [
  'album_id',
  'added_at',
  'id',
  'user_id',
  'photo_url',
  'image_variants',
  'caption',
  'mood',
  'custom_mood_emoji',
  'custom_mood_label',
  'film_preset_id',
  'is_public',
  'visibility',
  'created_at',
].join(', ')
const MY_NOTIFICATION_SELECT = [
  'id',
  'user_id',
  'type',
  'actor_id',
  'moment_id',
  'payload',
  'read',
  'created_at',
  'actor_profile_id',
  'actor_username',
  'actor_display_name',
  'actor_bio',
  'actor_avatar_url',
  'actor_website',
  'actor_profile_created_at',
  'moment_photo_url',
  'moment_image_variants',
].join(', ')

type PublicMomentRow = Omit<Moment, 'image_variants'> & {
  image_variants?: unknown
  profile_id: string
  username: string | null
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  website: string | null
  profile_created_at: string
}

type SavedPublicMomentRow = PublicMomentRow & {
  saved_at: string
  saved_by_user_id: string
}

type AlbumMomentDetailsRow = Omit<Moment, 'image_variants'> & {
  album_id: string
  added_at: string
  image_variants?: unknown
}

type NotificationViewRow = Omit<NotificationItem, 'profiles' | 'moments'> & {
  actor_profile_id: string | null
  actor_username: string | null
  actor_display_name: string | null
  actor_bio: string | null
  actor_avatar_url: string | null
  actor_website: string | null
  actor_profile_created_at: string | null
  moment_photo_url: string | null
  moment_image_variants?: unknown
}

function isMissingTableError(error: unknown, tableName: string): boolean {
  const maybeError = error as { code?: string; message?: string; details?: string; hint?: string } | null
  if (!maybeError) return false

  return [
    maybeError.code,
    maybeError.message,
    maybeError.details,
    maybeError.hint,
  ].filter(Boolean).join(' ').includes(tableName)
}

async function getHiddenUserIdsForViewer(viewerId?: string | null): Promise<Set<string>> {
  const hiddenUserIds = new Set<string>()
  if (!viewerId) return hiddenUserIds

  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`)

  if (error) {
    if (!isMissingTableError(error, 'blocked_users')) {
      console.error('[Blocks] failed to load hidden users:', error)
    }
    return hiddenUserIds
  }

  for (const row of ((data as BlockRelationshipRow[] | null) ?? [])) {
    if (row.blocker_id === viewerId) hiddenUserIds.add(row.blocked_id)
    if (row.blocked_id === viewerId) hiddenUserIds.add(row.blocker_id)
  }

  return hiddenUserIds
}

function filterHiddenMoments<T extends { user_id: string }>(
  moments: T[],
  hiddenUserIds: Set<string>,
): T[] {
  if (hiddenUserIds.size === 0) return moments
  return moments.filter(moment => !hiddenUserIds.has(moment.user_id))
}

function mapPublicMomentRow(row: PublicMomentRow): MomentWithProfile {
  return {
    id: row.id,
    user_id: row.user_id,
    photo_url: row.photo_url,
    image_variants: normalizeImageVariants(row.image_variants),
    caption: row.caption,
    mood: row.mood,
    custom_mood_emoji: row.custom_mood_emoji,
    custom_mood_label: row.custom_mood_label,
    film_preset_id: row.film_preset_id,
    is_public: row.is_public,
    visibility: row.visibility,
    created_at: row.created_at,
    profiles: {
      id: row.profile_id,
      username: row.username,
      display_name: row.display_name,
      bio: row.bio,
      avatar_url: row.avatar_url,
      website: row.website,
      created_at: row.profile_created_at,
    },
  }
}

function mapPublicMomentRows(rows: PublicMomentRow[] | null | undefined): MomentWithProfile[] {
  return (rows ?? []).map(mapPublicMomentRow)
}

function mapAlbumMomentDetailsRow(row: AlbumMomentDetailsRow): Moment {
  return {
    id: row.id,
    user_id: row.user_id,
    photo_url: row.photo_url,
    image_variants: normalizeImageVariants(row.image_variants),
    caption: row.caption,
    mood: row.mood,
    custom_mood_emoji: row.custom_mood_emoji,
    custom_mood_label: row.custom_mood_label,
    film_preset_id: row.film_preset_id,
    is_public: row.is_public,
    visibility: row.visibility,
    created_at: row.created_at,
  }
}

function mapAlbumMomentDetailsRows(rows: AlbumMomentDetailsRow[] | null | undefined): Moment[] {
  return (rows ?? []).map(mapAlbumMomentDetailsRow)
}

function mapNotificationViewRow(row: NotificationViewRow): NotificationItem {
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    actor_id: row.actor_id,
    moment_id: row.moment_id,
    payload: row.payload,
    read: row.read,
    created_at: row.created_at,
    profiles: row.actor_profile_id ? {
      id: row.actor_profile_id,
      username: row.actor_username,
      display_name: row.actor_display_name,
      bio: row.actor_bio,
      avatar_url: row.actor_avatar_url,
      website: row.actor_website,
      created_at: row.actor_profile_created_at ?? row.created_at,
    } : null,
    moments: row.moment_photo_url ? {
      photo_url: row.moment_photo_url,
      image_variants: normalizeImageVariants(row.moment_image_variants),
    } : null,
  }
}

async function getPublicProfilesByIds(userIds: string[]): Promise<Profile[]> {
  if (userIds.length === 0) return []

  const uniqueIds = [...new Set(userIds)]
  const result = await supabase
    .from(PUBLIC_PROFILES_VIEW)
    .select(PUBLIC_PROFILE_SELECT)
    .in('id', uniqueIds)

  if (!result.error) return (result.data as Profile[] | null) ?? []

  if (!isMissingTableError(result.error, PUBLIC_PROFILES_VIEW)) {
    console.error('[Profiles] public profiles load failed:', result.error)
    return []
  }

  const fallback = await supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_SELECT)
    .in('id', uniqueIds)

  if (fallback.error) {
    console.error('[Profiles] public profiles fallback failed:', fallback.error)
    return []
  }

  return (fallback.data as Profile[] | null) ?? []
}

async function loadPublicMomentsByIds(
  momentIds: string[],
  viewerId?: string | null,
): Promise<MomentWithProfile[]> {
  if (momentIds.length === 0) return []

  const uniqueIds = [...new Set(momentIds)]
  const [hiddenUserIds, result] = await Promise.all([
    getHiddenUserIdsForViewer(viewerId),
    supabase
      .from(PUBLIC_MOMENTS_VIEW)
      .select(PUBLIC_MOMENT_SELECT)
      .in('id', uniqueIds),
  ])

  if (!result.error) {
    return filterHiddenMoments(mapPublicMomentRows(result.data as unknown as PublicMomentRow[] | null), hiddenUserIds)
  }

  if (!isMissingTableError(result.error, PUBLIC_MOMENTS_VIEW)) {
    console.error('[Moments] public moments load failed:', result.error)
    return []
  }

  const fallback = await supabase
    .from('moments')
    .select(MOMENT_WITH_PUBLIC_PROFILE_SELECT)
    .eq('is_public', true)
    .in('id', uniqueIds)

  if (fallback.error) {
    console.error('[Moments] public moments fallback failed:', fallback.error)
    return []
  }

  return filterHiddenMoments((fallback.data as MomentWithProfile[] | null) ?? [], hiddenUserIds)
}

async function searchPublicProfiles(query: string): Promise<Profile[]> {
  const result = await supabase
    .from(PUBLIC_PROFILES_VIEW)
    .select(PUBLIC_PROFILE_SELECT)
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .limit(30)

  if (!result.error) return (result.data as Profile[] | null) ?? []

  if (!isMissingTableError(result.error, PUBLIC_PROFILES_VIEW)) {
    console.error('[Profiles] public search failed:', result.error)
    return []
  }

  const fallback = await supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_SELECT)
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .limit(30)

  if (fallback.error) {
    console.error('[Profiles] public search fallback failed:', fallback.error)
    return []
  }

  return (fallback.data as Profile[] | null) ?? []
}

// ─── PROFILES ────────────────────────────────────────────────────────────────

export async function getOwnProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data as Profile | null
}

export async function getPublicProfile(userId: string): Promise<Profile | null> {
  const [profile] = await getPublicProfilesByIds([userId])
  return profile ?? null
}

export async function updateProfile(
  userId: string,
  updates: Partial<Omit<Profile, 'id' | 'created_at'>>,
): Promise<{ error: unknown }> {
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
  return { error }
}

export async function searchUsers(query: string, viewerId?: string | null): Promise<Profile[]> {
  const q = query.trim().replace(/[,%]/g, ' ')
  if (q.length < 2) return []

  const [hiddenUserIds, profiles] = await Promise.all([
    getHiddenUserIdsForViewer(viewerId),
    searchPublicProfiles(q),
  ])

  return hiddenUserIds.size === 0
    ? profiles
    : profiles.filter(profile => !hiddenUserIds.has(profile.id))
}

// ─── MOMENTS ─────────────────────────────────────────────────────────────────

export async function searchMoments(
  query: string,
  limit = 24,
  viewerId?: string | null,
): Promise<MomentWithProfile[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const lower = q.toLowerCase()
  const moodMatches = EMOTIONS
    .filter(emotion => emotion.type.includes(lower) || emotion.label.toLowerCase().includes(lower))
    .map(emotion => emotion.type)
  const pattern = `%${q.replace(/[,%]/g, ' ')}%`
  const filters = [
    `caption.ilike.${pattern}`,
    `custom_mood_label.ilike.${pattern}`,
    ...moodMatches.map(mood => `mood.eq.${mood}`),
  ]

  const [hiddenUserIds, result] = await Promise.all([
    getHiddenUserIdsForViewer(viewerId),
    supabase
      .from(PUBLIC_MOMENTS_VIEW)
      .select(PUBLIC_MOMENT_SELECT)
      .or(filters.join(','))
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  if (!result.error) {
    return filterHiddenMoments(mapPublicMomentRows(result.data as unknown as PublicMomentRow[] | null), hiddenUserIds)
  }

  if (!isMissingTableError(result.error, PUBLIC_MOMENTS_VIEW)) {
    console.error('[Search] public moments failed:', result.error)
    return []
  }

  const { data, error } = await supabase
    .from('moments')
    .select(MOMENT_WITH_PUBLIC_PROFILE_SELECT)
    .eq('is_public', true)
    .or(filters.join(','))
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[Search] moments fallback failed:', error)
    return []
  }

  return filterHiddenMoments((data as MomentWithProfile[]) ?? [], hiddenUserIds)
}

export async function getFeed(userId: string, limit = 20): Promise<MomentWithProfile[]> {
  const [hiddenUserIds, { data: following }] = await Promise.all([
    getHiddenUserIdsForViewer(userId),
    supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId),
  ])

  if (!following || following.length === 0) return []

  const followingIds = (following as { following_id: string }[])
    .map(f => f.following_id)
    .filter(id => !hiddenUserIds.has(id))

  if (followingIds.length === 0) return []

  const result = await supabase
    .from(PUBLIC_MOMENTS_VIEW)
    .select(PUBLIC_MOMENT_SELECT)
    .in('user_id', followingIds)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!result.error) return mapPublicMomentRows(result.data as unknown as PublicMomentRow[] | null)

  if (!isMissingTableError(result.error, PUBLIC_MOMENTS_VIEW)) {
    console.error('[Feed] public moments failed:', result.error)
    return []
  }

  const { data, error } = await supabase
    .from('moments')
    .select(MOMENT_WITH_PUBLIC_PROFILE_SELECT)
    .eq('is_public', true)
    .in('user_id', followingIds)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[Feed] moments fallback failed:', error)
    return []
  }

  return (data as MomentWithProfile[]) ?? []
}

export async function getRandomMoments(
  limit: number,
  viewerId?: string | null,
): Promise<MomentWithProfile[]> {
  const [hiddenUserIds, result] = await Promise.all([
    getHiddenUserIdsForViewer(viewerId),
    supabase
      .from(PUBLIC_MOMENTS_VIEW)
      .select(PUBLIC_MOMENT_SELECT)
      .order('created_at', { ascending: false })
      .limit(limit * 4),
  ])

  if (!result.error) {
    const publicMoments = mapPublicMomentRows(result.data as unknown as PublicMomentRow[] | null)
    if (publicMoments.length === 0) return []
    const visibleMoments = filterHiddenMoments(publicMoments, hiddenUserIds)
    const shuffled = [...visibleMoments].sort(() => Math.random() - 0.5)
    return (shuffled.slice(0, limit) as MomentWithProfile[])
  }

  if (!isMissingTableError(result.error, PUBLIC_MOMENTS_VIEW)) {
    console.error('[Random] public moments failed:', result.error)
    return []
  }

  const { data, error } = await supabase
    .from('moments')
    .select(MOMENT_WITH_PUBLIC_PROFILE_SELECT)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit * 4)

  if (error || !data || data.length === 0) return []
  const visibleMoments = filterHiddenMoments(data as MomentWithProfile[], hiddenUserIds)
  const shuffled = [...visibleMoments].sort(() => Math.random() - 0.5)
  return (shuffled.slice(0, limit) as MomentWithProfile[])
}

export async function getMomentsByEmotion(
  emotion: ReactionType,
  limit = 30,
  viewerId?: string | null,
): Promise<MomentWithProfile[]> {
  const [{ data: reactionData }, moodResult] = await Promise.all([
    supabase
      .from('reactions')
      .select('moment_id')
      .eq('type', emotion),
    supabase
      .from(PUBLIC_MOMENTS_VIEW)
      .select('id')
      .eq('mood', emotion)
      .order('created_at', { ascending: false })
      .limit(limit * 3),
  ])

  let moodData = moodResult.data as { id: string }[] | null
  if (moodResult.error) {
    if (!isMissingTableError(moodResult.error, PUBLIC_MOMENTS_VIEW)) {
      console.error('[Emotion] public mood moments failed:', moodResult.error)
      return []
    }

    const fallbackMood = await supabase
      .from('moments')
      .select('id')
      .eq('is_public', true)
      .eq('mood', emotion)
      .order('created_at', { ascending: false })
      .limit(limit * 3)

    moodData = fallbackMood.data as { id: string }[] | null
  }

  const countMap: Record<string, number> = {}
  for (const m of (moodData ?? []) as { id: string }[]) {
    countMap[m.id] = (countMap[m.id] ?? 0) + 1
  }
  for (const r of (reactionData ?? []) as { moment_id: string }[]) {
    countMap[r.moment_id] = (countMap[r.moment_id] ?? 0) + 1
  }

  if (Object.keys(countMap).length === 0) return []

  const sortedIds = Object.entries(countMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([id]) => id)

  const visibleMoments = await loadPublicMomentsByIds(sortedIds, viewerId)
  const momentMap = new Map(visibleMoments.map(m => [m.id, m]))
  return sortedIds.map(id => momentMap.get(id)).filter(Boolean) as MomentWithProfile[]
}

export type CategoryFilterValue = 'for_you' | ReactionType
export type CategoryThumbnailMap = Partial<Record<CategoryFilterValue, string | null>>

const CATEGORY_REACTION_TYPES: ReactionType[] = ['warm', 'nostalgic', 'calm', 'wow', 'relatable']

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null
  return items[Math.floor(Math.random() * items.length)]
}

function pickedMomentImageUrl(moment: Moment | null, variant: 'thumb' | 'feed' | 'full'): string | null {
  return moment ? getMomentImageUrl(moment, variant) : null
}

function isMissingImageVariantsError(error: unknown): boolean {
  const maybeError = error as { code?: string; message?: string; details?: string; hint?: string } | null
  if (!maybeError) return false

  return [
    maybeError.code,
    maybeError.message,
    maybeError.details,
    maybeError.hint,
  ].filter(Boolean).join(' ').includes('image_variants')
}

function isMissingRpcError(error: unknown, functionName: string): boolean {
  const maybeError = error as { code?: string; message?: string; details?: string; hint?: string } | null
  if (!maybeError) return false

  return [
    maybeError.code,
    maybeError.message,
    maybeError.details,
    maybeError.hint,
  ].filter(Boolean).join(' ').includes(functionName)
}

export async function getGlobalCategoryThumbnails(): Promise<CategoryThumbnailMap> {
  const [randomMoments, ...emotionMoments] = await Promise.all([
    getRandomMoments(24),
    ...CATEGORY_REACTION_TYPES.map(type => getMomentsByEmotion(type, 24)),
  ])

  const thumbnails: CategoryThumbnailMap = {
    for_you: pickedMomentImageUrl(pickRandom(randomMoments), 'thumb'),
  }

  CATEGORY_REACTION_TYPES.forEach((type, index) => {
    thumbnails[type] = pickedMomentImageUrl(pickRandom(emotionMoments[index] ?? []), 'thumb')
  })

  return thumbnails
}

export async function getFollowingCategoryThumbnails(userId: string): Promise<CategoryThumbnailMap> {
  const [globalThumbnails, feedMoments] = await Promise.all([
    getGlobalCategoryThumbnails(),
    getFeed(userId, 80),
  ])

  if (feedMoments.length === 0) return globalThumbnails

  const thumbnails: CategoryThumbnailMap = {
    ...globalThumbnails,
    for_you: pickedMomentImageUrl(pickRandom(feedMoments), 'thumb') ?? globalThumbnails.for_you ?? null,
  }

  const ids = feedMoments.map(moment => moment.id)
  const reactions = await getFeedReactions(ids)
  const momentsById = new Map(feedMoments.map(moment => [moment.id, moment]))

  for (const type of CATEGORY_REACTION_TYPES) {
    const matchingIds = [...new Set(
      reactions
        .filter(reaction => reaction.type === type)
        .map(reaction => reaction.moment_id),
    )]
    const matchingMomentsByReaction = matchingIds
      .map(momentId => momentsById.get(momentId))
      .filter(Boolean) as MomentWithProfile[]
    const matchingMomentsByMood = feedMoments.filter(moment => moment.mood === type)
    const uniqueMatchingMoments = [...new Map(
      [...matchingMomentsByMood, ...matchingMomentsByReaction].map(moment => [moment.id, moment]),
    ).values()]

    thumbnails[type] = pickedMomentImageUrl(pickRandom(uniqueMatchingMoments), 'thumb') ?? globalThumbnails[type] ?? null
  }

  return thumbnails
}

export async function getUserMoments(userId: string): Promise<Moment[]> {
  const { data } = await supabase
    .from('moments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data as Moment[]) ?? []
}

export async function getMoment(momentId: string): Promise<MomentWithProfile | null> {
  const result = await supabase
    .from(PUBLIC_MOMENTS_VIEW)
    .select(PUBLIC_MOMENT_SELECT)
    .eq('id', momentId)
    .single()

  if (!result.error) return mapPublicMomentRow(result.data as unknown as PublicMomentRow)

  if (!isMissingTableError(result.error, PUBLIC_MOMENTS_VIEW)) {
    console.error('[Moment] public moment load failed:', result.error)
    return null
  }

  const { data } = await supabase
    .from('moments')
    .select(MOMENT_WITH_PUBLIC_PROFILE_SELECT)
    .eq('id', momentId)
    .single()
  return (data as MomentWithProfile) ?? null
}

// ─── REACTIONS ───────────────────────────────────────────────────────────────

export async function getFeedReactions(
  momentIds: string[],
): Promise<{ moment_id: string; type: ReactionType }[]> {
  if (momentIds.length === 0) return []
  const { data } = await supabase
    .from('reactions')
    .select('moment_id, type')
    .in('moment_id', momentIds)
  return (data as { moment_id: string; type: ReactionType }[]) ?? []
}

export async function getUserReactionsForMoments(
  userId: string,
  momentIds: string[],
): Promise<{ moment_id: string; type: ReactionType }[]> {
  if (momentIds.length === 0) return []
  const { data } = await supabase
    .from('reactions')
    .select('moment_id, type')
    .eq('user_id', userId)
    .in('moment_id', momentIds)
  return (data as { moment_id: string; type: ReactionType }[]) ?? []
}

type ReactionSummaryRpcRow = {
  moment_id: string
  counts: Record<string, number> | null
  top_type: ReactionType | null
  top_count: number | null
  my_reaction: ReactionType | null
}

function normalizeReactionSummary(row: ReactionSummaryRpcRow): MomentReactionSummary {
  const counts: Partial<Record<ReactionType, number>> = {}
  for (const [type, count] of Object.entries(row.counts ?? {})) {
    if (isReactionType(type) && typeof count === 'number' && count > 0) {
      counts[type] = count
    }
  }

  return {
    moment_id: row.moment_id,
    counts,
    top_type: row.top_type,
    top_count: row.top_count ?? 0,
    my_reaction: row.my_reaction,
  }
}

function isReactionType(value: string): value is ReactionType {
  return ['warm', 'nostalgic', 'calm', 'wow', 'relatable', 'custom'].includes(value)
}

export async function getMomentReactionSummaries(
  momentIds: string[],
  userId?: string,
): Promise<MomentReactionSummary[]> {
  const uniqueIds = [...new Set(momentIds)]
  if (uniqueIds.length === 0) return []

  const { data, error } = await supabase.rpc('get_moment_reaction_summaries', {
    p_moment_ids: uniqueIds,
  })

  if (!error && data) {
    return (data as ReactionSummaryRpcRow[]).map(normalizeReactionSummary)
  }

  if (error && !isMissingRpcError(error, 'get_moment_reaction_summaries')) {
    console.error('[Reactions] summary RPC failed:', error)
  }

  const [reactions, myReactions] = await Promise.all([
    getFeedReactions(uniqueIds),
    userId ? getUserReactionsForMoments(userId, uniqueIds) : Promise.resolve([]),
  ])
  const summaries = new Map<string, MomentReactionSummary>()
  for (const id of uniqueIds) {
    summaries.set(id, { moment_id: id, counts: {}, top_type: null, top_count: 0, my_reaction: null })
  }

  for (const reaction of reactions) {
    const summary = summaries.get(reaction.moment_id)
    if (!summary) continue
    summary.counts[reaction.type] = (summary.counts[reaction.type] ?? 0) + 1
  }

  for (const summary of summaries.values()) {
    const top = (Object.entries(summary.counts) as [ReactionType, number][])
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
    if (top) {
      summary.top_type = top[0]
      summary.top_count = top[1]
    }
  }

  for (const reaction of myReactions) {
    const summary = summaries.get(reaction.moment_id)
    if (summary) summary.my_reaction = reaction.type
  }

  return [...summaries.values()]
}

export function buildReactionListMapFromSummaries(
  summaries: MomentReactionSummary[],
): Record<string, { type: ReactionType }[]> {
  const map: Record<string, { type: ReactionType }[]> = {}
  for (const summary of summaries) {
    const reactions: { type: ReactionType }[] = []
    for (const [type, count] of Object.entries(summary.counts) as [ReactionType, number][]) {
      for (let i = 0; i < count; i += 1) reactions.push({ type })
    }
    map[summary.moment_id] = reactions
  }
  return map
}

export function buildReactionCountMapFromSummaries(
  summaries: MomentReactionSummary[],
): Record<string, Partial<Record<ReactionType, number>>> {
  const map: Record<string, Partial<Record<ReactionType, number>>> = {}
  for (const summary of summaries) map[summary.moment_id] = summary.counts
  return map
}

export function buildUserReactionMapFromSummaries(
  summaries: MomentReactionSummary[],
): Record<string, ReactionType | null> {
  const map: Record<string, ReactionType | null> = {}
  for (const summary of summaries) map[summary.moment_id] = summary.my_reaction
  return map
}

export async function getReactions(
  momentId: string,
): Promise<{ moment_id: string; user_id: string; type: ReactionType }[]> {
  const { data } = await supabase
    .from('reactions')
    .select('moment_id, user_id, type')
    .eq('moment_id', momentId)
  return (data as { moment_id: string; user_id: string; type: ReactionType }[]) ?? []
}

export async function addReaction(
  momentId: string,
  userId: string,
  type: ReactionType,
): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('reactions')
    .upsert({ moment_id: momentId, user_id: userId, type })
  return { error }
}

export async function removeReaction(
  momentId: string,
  userId: string,
): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('reactions')
    .delete()
    .eq('moment_id', momentId)
    .eq('user_id', userId)
  return { error }
}

// ─── DAILY FRAME LIMIT ───────────────────────────────────────────────────────

export const DAILY_FRAME_LIMIT = PREMIUM_REGULAR_DAILY_FRAME_LIMIT

function getFallbackEntitlements(isPremium = false): UserEntitlements {
  return {
    is_premium: isPremium,
    premium_until: null,
    daily_frame_limit: getDailyFrameLimit(isPremium),
    highlight_limit: isPremium ? getHighlightLimit(true) : PREMIUM_REGULAR_HIGHLIGHT_LIMIT,
    features: {
      rare_films: isPremium,
      premium_badge: isPremium,
      priority_support: isPremium,
    },
  }
}

export async function getUserEntitlements(userId: string): Promise<UserEntitlements> {
  const { data, error } = await supabase.rpc('get_user_entitlements', { p_user_id: userId })

  if (error) {
    if (!isMissingRpcError(error, 'get_user_entitlements')) {
      console.error('[Entitlements] load failed:', error)
    }
    const activeSubscription = await getActivePremiumSubscription(userId)
    return getFallbackEntitlements(Boolean(activeSubscription))
  }

  return {
    ...getFallbackEntitlements(false),
    ...((data as Partial<UserEntitlements> | null) ?? {}),
  }
}

/** Returns how many moments the user has published today (UTC midnight reset, matches DB trigger). */
export async function getTodaysMomentCount(userId: string): Promise<number> {
  const now = new Date()
  const startOfDayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  const { count, error } = await supabase
    .from('moments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfDayUTC.toISOString())

  if (error) return 0
  return count ?? 0
}

// ─── TELEGRAM STARS ──────────────────────────────────────────────────────────

export const STAR_SUPPORT_AMOUNTS = [1, 5, 10, 50] as const
export type StarSupportAmount = (typeof STAR_SUPPORT_AMOUNTS)[number]

export function isStarSupportAmount(value: number): value is StarSupportAmount {
  return (STAR_SUPPORT_AMOUNTS as readonly number[]).includes(value)
}

export async function getMomentStarTotals(momentIds: string[]): Promise<Record<string, number>> {
  if (momentIds.length === 0) return {}

  const uniqueIds = [...new Set(momentIds)]
  const { data, error } = await supabase
    .from('moment_star_totals')
    .select('moment_id, total_amount')
    .in('moment_id', uniqueIds)

  if (error) {
    console.error('[Stars] moment totals load failed:', error)
    return {}
  }

  const totals: Record<string, number> = {}
  for (const row of (data as MomentStarTotal[]) ?? []) {
    totals[row.moment_id] = row.total_amount
  }
  return totals
}

export async function getMomentStarTotal(momentId: string): Promise<number> {
  const totals = await getMomentStarTotals([momentId])
  return totals[momentId] ?? 0
}

export async function getProfileStarTotal(profileId: string): Promise<number> {
  const { data, error } = await supabase
    .from('profile_star_totals')
    .select('profile_id, total_received')
    .eq('profile_id', profileId)
    .maybeSingle()

  if (error) {
    console.error('[Stars] profile total load failed:', error)
    return 0
  }

  return ((data as ProfileStarTotal | null)?.total_received) ?? 0
}

export async function createStarInvoice(
  momentId: string,
  amount: StarSupportAmount,
): Promise<StarInvoiceResponse> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  if (!token) {
    throw new Error('auth_required')
  }

  const { data, error } = await supabase.functions.invoke<StarInvoiceResponse>(
    'create-star-invoice',
    {
      body: { momentId, amount },
      headers: { Authorization: `Bearer ${token}` },
    },
  )

  if (error) throw error
  if (!data?.invoiceLink || !data.paymentId) {
    throw new Error('invoice_link_missing')
  }

  return data
}

export async function getActivePremiumSubscription(userId: string): Promise<PremiumSubscription | null> {
  const { data, error } = await supabase
    .from('premium_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[Premium] active subscription load failed:', error)
    return null
  }

  return data as PremiumSubscription | null
}

// ─── FOLLOWS ─────────────────────────────────────────────────────────────────

export async function followUser(
  followerId: string,
  followingId: string,
): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId })
  return { error }
}

export async function unfollowUser(
  followerId: string,
  followingId: string,
): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
  return { error }
}

export async function isFollowing(
  followerId: string,
  followingId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .single()
  return !!data
}

// ─── BLOCKS ──────────────────────────────────────────────────────────────────

export async function getBlockRelationship(
  viewerId: string,
  targetId: string,
): Promise<{ hasBlocked: boolean; blockedBy: boolean }> {
  const empty = { hasBlocked: false, blockedBy: false }
  if (!viewerId || !targetId || viewerId === targetId) return empty

  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocker_id, blocked_id')
    .or(`and(blocker_id.eq.${viewerId},blocked_id.eq.${targetId}),and(blocker_id.eq.${targetId},blocked_id.eq.${viewerId})`)

  if (error) {
    if (!isMissingTableError(error, 'blocked_users')) {
      console.error('[Blocks] relationship load failed:', error)
    }
    return empty
  }

  const rows = (data as BlockRelationshipRow[] | null) ?? []
  return {
    hasBlocked: rows.some(row => row.blocker_id === viewerId && row.blocked_id === targetId),
    blockedBy: rows.some(row => row.blocker_id === targetId && row.blocked_id === viewerId),
  }
}

export async function blockUser(
  blockerId: string,
  blockedId: string,
): Promise<{ error: unknown }> {
  if (!blockerId || !blockedId || blockerId === blockedId) {
    return { error: new Error('Cannot block this user') }
  }

  const { error } = await supabase
    .from('blocked_users')
    .insert({ blocker_id: blockerId, blocked_id: blockedId })

  const maybeError = error as { code?: string } | null
  return { error: maybeError?.code === '23505' ? null : error }
}

export async function unblockUser(
  blockerId: string,
  blockedId: string,
): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)

  return { error }
}

export async function getFollowersCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', userId)
  return count ?? 0
}

export async function getFollowingCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', userId)
  return count ?? 0
}

export async function getFollowers(userId: string): Promise<FollowProfile[]> {
  const [hiddenUserIds, { data: follows }] = await Promise.all([
    getHiddenUserIdsForViewer(userId),
    supabase
      .from('follows')
      .select('follower_id, created_at')
      .eq('following_id', userId)
      .order('created_at', { ascending: false }),
  ])

  const rows = ((follows as { follower_id: string; created_at: string }[] | null) ?? [])
    .filter(row => !hiddenUserIds.has(row.follower_id))
  if (rows.length === 0) return []

  const ids = rows.map(row => row.follower_id)
  const profiles = await getPublicProfilesByIds(ids)

  const profileMap = new Map(profiles.map(profile => [profile.id, profile]))
  return rows
    .map(row => {
      const profile = profileMap.get(row.follower_id)
      return profile ? { profile, followed_at: row.created_at } : null
    })
    .filter(Boolean) as FollowProfile[]
}

export async function getFollowing(userId: string): Promise<FollowProfile[]> {
  const [hiddenUserIds, { data: follows }] = await Promise.all([
    getHiddenUserIdsForViewer(userId),
    supabase
      .from('follows')
      .select('following_id, created_at')
      .eq('follower_id', userId)
      .order('created_at', { ascending: false }),
  ])

  const rows = ((follows as { following_id: string; created_at: string }[] | null) ?? [])
    .filter(row => !hiddenUserIds.has(row.following_id))
  if (rows.length === 0) return []

  const ids = rows.map(row => row.following_id)
  const profiles = await getPublicProfilesByIds(ids)

  const profileMap = new Map(profiles.map(profile => [profile.id, profile]))
  return rows
    .map(row => {
      const profile = profileMap.get(row.following_id)
      return profile ? { profile, followed_at: row.created_at } : null
    })
    .filter(Boolean) as FollowProfile[]
}

// ─── SAVED MOMENTS ───────────────────────────────────────────────────────────

export async function saveMoment(
  userId: string,
  momentId: string,
): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('saved_moments')
    .insert({ user_id: userId, moment_id: momentId })

  const maybeError = error as { code?: string } | null
  return { error: maybeError?.code === '23505' ? null : error }
}

export async function unsaveMoment(
  userId: string,
  momentId: string,
): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('saved_moments')
    .delete()
    .eq('user_id', userId)
    .eq('moment_id', momentId)
  return { error }
}

export async function getSavedMomentIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('saved_moments')
    .select('moment_id')
    .eq('user_id', userId)
  return (data as { moment_id: string }[])?.map(r => r.moment_id) ?? []
}

export async function getSavedMoments(userId: string): Promise<MomentWithProfile[]> {
  const result = await supabase
    .from(MY_SAVED_MOMENTS_VIEW)
    .select(SAVED_MOMENT_SELECT)
    .eq('saved_by_user_id', userId)
    .order('saved_at', { ascending: false })

  if (!result.error) {
    return mapPublicMomentRows(result.data as unknown as SavedPublicMomentRow[])
  }

  if (!isMissingTableError(result.error, MY_SAVED_MOMENTS_VIEW)) {
    console.error('[Saved] moments view load failed:', result.error)
    return []
  }

  const { data, error } = await supabase
    .from('saved_moments')
    .select(`saved_at, moments(${MOMENT_WITH_PUBLIC_PROFILE_SELECT})`)
    .eq('user_id', userId)
    .order('saved_at', { ascending: false })

  if (error) {
    console.error('[Saved] moments load failed:', error)
    return []
  }

  return ((data ?? []) as { moments: MomentWithProfile | MomentWithProfile[] | null }[])
    .map(row => Array.isArray(row.moments) ? row.moments[0] : row.moments)
    .filter(Boolean) as MomentWithProfile[]
}

export async function isMomentSaved(userId: string, momentId: string): Promise<boolean> {
  const { data } = await supabase
    .from('saved_moments')
    .select('moment_id')
    .eq('user_id', userId)
    .eq('moment_id', momentId)
    .single()
  return !!data
}

// ─── COMMENTS ────────────────────────────────────────────────────────────────

export async function getComments(momentId: string): Promise<CommentWithProfile[]> {
  const { data: comments } = await supabase
    .from('comments')
    .select('*')
    .eq('moment_id', momentId)
    .order('created_at', { ascending: true })
  if (!comments || comments.length === 0) return []

  const userIds = [...new Set((comments as { user_id: string }[]).map(c => c.user_id))]
  const profiles = await getPublicProfilesByIds(userIds)
  const profileMap: Record<string, Profile> = {}
  for (const p of profiles) profileMap[p.id] = p

  return (comments as { id: string; moment_id: string; user_id: string; text: string; created_at: string }[]).map(c => ({
    ...c,
    profiles: profileMap[c.user_id] ?? null,
  }))
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

export async function getNotifications(userId: string): Promise<NotificationItem[]> {
  const result = await supabase
    .from(MY_NOTIFICATIONS_VIEW)
    .select(MY_NOTIFICATION_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!result.error) {
    return ((result.data as unknown as NotificationViewRow[] | null) ?? []).map(mapNotificationViewRow)
  }

  if (!isMissingTableError(result.error, MY_NOTIFICATIONS_VIEW)) {
    console.error('[Notifications] view load failed:', result.error)
    return []
  }

  const fallbackResult = await supabase
    .from('notifications')
    .select(`*, profiles:profiles!notifications_actor_id_fkey(${PUBLIC_PROFILE_SELECT}), moments(photo_url, image_variants)`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!fallbackResult.error) return (fallbackResult.data as NotificationItem[]) ?? []

  if (isMissingImageVariantsError(fallbackResult.error)) {
    const legacyResult = await supabase
      .from('notifications')
      .select(`*, profiles:profiles!notifications_actor_id_fkey(${PUBLIC_PROFILE_SELECT}), moments(photo_url)`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!legacyResult.error) return (legacyResult.data as NotificationItem[]) ?? []
    console.error('[Notifications] legacy load failed:', legacyResult.error)
    return []
  }

  if (fallbackResult.error) {
    console.error('[Notifications] load failed:', fallbackResult.error)
    return []
  }

  return []
}

export async function markNotificationsRead(userId: string): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)
  return { error }
}

export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_unread_notification_count')
  if (!rpcError && typeof rpcData === 'number') return rpcData
  if (rpcError && !isMissingRpcError(rpcError, 'get_unread_notification_count')) {
    console.error('[Notifications] unread count RPC failed:', rpcError)
  }

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)

  if (error) {
    console.error('[Notifications] unread count failed:', error)
    return 0
  }
  return count ?? 0
}

// ── Highlights ────────────────────────────────────────────────────────────────

export async function getHighlights(userId: string): Promise<HighlightWithMoment[]> {
  const result = await supabase
    .from('highlights')
    .select('*, moments(id, photo_url, image_variants)')
    .eq('user_id', userId)
    .order('position')

  if (!result.error) return (result.data as HighlightWithMoment[]) ?? []

  if (isMissingImageVariantsError(result.error)) {
    const legacyResult = await supabase
      .from('highlights')
      .select('*, moments(id, photo_url)')
      .eq('user_id', userId)
      .order('position')

    if (!legacyResult.error) return (legacyResult.data as HighlightWithMoment[]) ?? []
    console.error('[Highlights] legacy load failed:', legacyResult.error)
    return []
  }

  console.error('[Highlights] load failed:', result.error)
  return []
}

export async function setHighlightAtPosition(
  userId: string, momentId: string, position: number
): Promise<{ error: unknown }> {
  // Delete existing highlight at this position (if any)
  await supabase.from('highlights').delete().eq('user_id', userId).eq('position', position)
  // Also remove if this moment is already pinned to another slot (UNIQUE user_id,moment_id)
  await supabase.from('highlights').delete().eq('user_id', userId).eq('moment_id', momentId)
  // Insert fresh
  const { error } = await supabase.from('highlights').insert({ user_id: userId, moment_id: momentId, position })
  return { error }
}

export async function removeHighlightAtPosition(
  userId: string, position: number
): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('highlights')
    .delete()
    .eq('user_id', userId)
    .eq('position', position)
  return { error }
}

// ── Albums ────────────────────────────────────────────────────────────────────

export async function getUserAlbums(userId: string): Promise<AlbumWithMoments[]> {
  const { data: albums } = await supabase
    .from('albums')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (!albums || albums.length === 0) return []

  const albumRows = albums as Album[]
  const albumIds = albumRows.map(album => album.id)
  const albumMomentsResult = await supabase
    .from(ALBUM_MOMENTS_VIEW)
    .select('album_id, photo_url, image_variants')
    .in('album_id', albumIds)
    .order('added_at', { ascending: false })

  type AlbumMomentPreviewRow = {
    album_id: string
    photo_url: string
    image_variants?: unknown
    moments?:
      | { photo_url: string; image_variants?: Record<string, string> | null }
      | { photo_url: string; image_variants?: Record<string, string> | null }[]
      | null
  }

  let albumMoments = albumMomentsResult.data as unknown as AlbumMomentPreviewRow[] | null

  if (albumMomentsResult.error && isMissingTableError(albumMomentsResult.error, ALBUM_MOMENTS_VIEW)) {
    const fallbackResult = await supabase
      .from('album_moments')
      .select('album_id, moments(photo_url, image_variants)')
      .in('album_id', albumIds)
      .order('added_at', { ascending: false })

    if (fallbackResult.error && isMissingImageVariantsError(fallbackResult.error)) {
      const legacyResult = await supabase
        .from('album_moments')
        .select('album_id, moments(photo_url)')
        .in('album_id', albumIds)
        .order('added_at', { ascending: false })

      if (legacyResult.error) {
        console.error('[Albums] legacy moments load failed:', legacyResult.error)
      }
      albumMoments = legacyResult.data as AlbumMomentPreviewRow[] | null
    } else if (fallbackResult.error) {
      console.error('[Albums] fallback moments load failed:', fallbackResult.error)
      albumMoments = null
    } else {
      albumMoments = fallbackResult.data as AlbumMomentPreviewRow[] | null
    }
  } else if (albumMomentsResult.error && isMissingImageVariantsError(albumMomentsResult.error)) {
    const legacyResult = await supabase
      .from('album_moments')
      .select('album_id, moments(photo_url)')
      .in('album_id', albumIds)
      .order('added_at', { ascending: false })

    if (legacyResult.error) {
      console.error('[Albums] legacy moments load failed:', legacyResult.error)
    }
    albumMoments = legacyResult.data as AlbumMomentPreviewRow[] | null
  } else if (albumMomentsResult.error) {
    console.error('[Albums] moments load failed:', albumMomentsResult.error)
  }

  const stats: Record<string, { count: number; first_moment_url: string | null }> = {}
  for (const albumId of albumIds) {
    stats[albumId] = { count: 0, first_moment_url: null }
  }

  for (const row of albumMoments ?? []) {
    const albumStats = stats[row.album_id]
    if (!albumStats) continue
    const nestedMoment = Array.isArray(row.moments) ? row.moments[0] : row.moments
    const moment = row.photo_url ? row : nestedMoment
    albumStats.count += 1
    albumStats.first_moment_url ??= moment ? getMomentImageUrl(moment as Moment, 'thumb') : null
  }

  return albumRows.map(album => ({
    ...album,
    moments_count: stats[album.id]?.count ?? 0,
    first_moment_url: stats[album.id]?.first_moment_url ?? null,
  }))
}

export async function createAlbum(
  userId: string, title: string
): Promise<{ data: Album | null; error: unknown }> {
  const { data, error } = await supabase
    .from('albums')
    .insert({ user_id: userId, title })
    .select()
    .single()
  return { data: data as Album | null, error }
}

export async function deleteAlbum(albumId: string): Promise<{ error: unknown }> {
  const { error } = await supabase.from('albums').delete().eq('id', albumId)
  return { error }
}

export async function updateAlbumTitle(
  albumId: string, title: string
): Promise<{ error: unknown }> {
  const { error } = await supabase.from('albums').update({ title }).eq('id', albumId)
  return { error }
}

export async function getAlbumMoments(albumId: string): Promise<Moment[]> {
  const result = await supabase
    .from(ALBUM_MOMENTS_VIEW)
    .select(ALBUM_MOMENT_SELECT)
    .eq('album_id', albumId)
    .order('added_at', { ascending: false })

  if (!result.error) {
    return mapAlbumMomentDetailsRows(result.data as unknown as AlbumMomentDetailsRow[] | null)
  }

  if (!isMissingTableError(result.error, ALBUM_MOMENTS_VIEW)) {
    console.error('[Albums] detail view load failed:', result.error)
    return []
  }

  const { data } = await supabase
    .from('album_moments')
    .select('moments(*)')
    .eq('album_id', albumId)
    .order('added_at', { ascending: false })
  return ((data ?? []).map((d: any) => d.moments).filter(Boolean)) as Moment[]
}

export async function addMomentToAlbum(
  albumId: string, momentId: string
): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('album_moments')
    .insert({ album_id: albumId, moment_id: momentId })
  return { error }
}

export async function removeMomentFromAlbum(
  albumId: string, momentId: string
): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('album_moments')
    .delete()
    .eq('album_id', albumId)
    .eq('moment_id', momentId)
  return { error }
}

// ── Moment delete ─────────────────────────────────────────────────────────────

export async function deleteMoment(momentId: string): Promise<{ error: unknown }> {
  const { error } = await supabase.from('moments').delete().eq('id', momentId)
  return { error }
}

export async function reportMoment(
  momentId: string,
  reporterId: string,
  reason = 'reported',
  reportedUserId?: string | null,
): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('reports')
    .insert({
      reporter_id: reporterId,
      reported_moment_id: momentId,
      reported_user_id: reportedUserId ?? null,
      reason,
    })
  return { error }
}

export async function reportUser(
  reportedUserId: string,
  reporterId: string,
  reason = 'profile_reported',
): Promise<{ error: unknown }> {
  if (!reportedUserId || !reporterId || reportedUserId === reporterId) {
    return { error: new Error('Cannot report this user') }
  }

  const { error } = await supabase
    .from('reports')
    .insert({ reporter_id: reporterId, reported_user_id: reportedUserId, reason })
  return { error }
}

// ── Admin ─────────────────────────────────────────────────────────────────────

type RawModerationReport = {
  id: string
  reporter_id: string
  reported_moment_id: string | null
  reported_user_id: string | null
  reason: string
  status: ReportStatus
  admin_note: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export async function getModerationReports(status: ReportStatus | 'all' = 'open'): Promise<ModerationReport[]> {
  let query = supabase
    .from('reports')
    .select('id, reporter_id, reported_moment_id, reported_user_id, reason, status, admin_note, reviewed_by, reviewed_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    console.error('[Moderation] reports load failed:', error)
    return []
  }

  const reports = (data as RawModerationReport[] | null) ?? []
  if (reports.length === 0) return []

  const profileIds = new Set<string>()
  const momentIds = new Set<string>()
  for (const report of reports) {
    profileIds.add(report.reporter_id)
    if (report.reported_user_id) profileIds.add(report.reported_user_id)
    if (report.reported_moment_id) momentIds.add(report.reported_moment_id)
  }

  const [{ data: profiles }, { data: moments }] = await Promise.all([
    profileIds.size > 0
      ? supabase.from('profiles').select(PUBLIC_PROFILE_SELECT).in('id', Array.from(profileIds))
      : Promise.resolve({ data: [] }),
    momentIds.size > 0
      ? supabase.from('moments').select(MOMENT_WITH_PUBLIC_PROFILE_SELECT).in('id', Array.from(momentIds))
      : Promise.resolve({ data: [] }),
  ])

  const profileMap = new Map(((profiles as Profile[] | null) ?? []).map(profile => [profile.id, profile]))
  const momentMap = new Map(((moments as MomentWithProfile[] | null) ?? []).map(moment => [moment.id, moment]))

  return reports.map(report => ({
    ...report,
    reporter: profileMap.get(report.reporter_id) ?? null,
    reported_user: report.reported_user_id ? profileMap.get(report.reported_user_id) ?? null : null,
    reported_moment: report.reported_moment_id ? momentMap.get(report.reported_moment_id) ?? null : null,
  }))
}

async function recordAdminAudit(
  adminId: string,
  action: string,
  payload: {
    targetUserId?: string | null
    targetMomentId?: string | null
    reportId?: string | null
    metadata?: Record<string, unknown>
  } = {},
): Promise<void> {
  const { error } = await supabase
    .from('admin_audit_log')
    .insert({
      admin_id: adminId,
      action,
      target_user_id: payload.targetUserId ?? null,
      target_moment_id: payload.targetMomentId ?? null,
      report_id: payload.reportId ?? null,
      metadata: payload.metadata ?? {},
    })

  if (error && !isMissingTableError(error, 'admin_audit_log')) {
    console.error('[Moderation] audit log write failed:', error)
  }
}

export async function updateReportStatus(
  reportId: string,
  adminId: string,
  status: ReportStatus,
  adminNote?: string,
): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('reports')
    .update({
      status,
      admin_note: adminNote ?? null,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', reportId)

  if (!error) {
    await recordAdminAudit(adminId, `report_${status}`, { reportId, metadata: { adminNote } })
  }

  return { error }
}

export async function adminShadowBanUser(userId: string): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_banned: true })
    .eq('id', userId)
  return { error }
}

export async function adminShadowBanUserFromReport(
  userId: string,
  adminId: string,
  reportId?: string | null,
): Promise<{ error: unknown }> {
  const result = await adminShadowBanUser(userId)
  if (!result.error) {
    await recordAdminAudit(adminId, 'shadow_ban_user', { targetUserId: userId, reportId })
    if (reportId) await updateReportStatus(reportId, adminId, 'actioned', 'Shadow banned user')
  }
  return result
}

export async function adminUnbanUser(userId: string): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_banned: false })
    .eq('id', userId)
  return { error }
}

export async function adminDeleteMomentFromReport(
  momentId: string,
  adminId: string,
  reportId?: string | null,
): Promise<{ error: unknown }> {
  const result = await deleteMoment(momentId)
  if (!result.error) {
    await recordAdminAudit(adminId, 'delete_moment', { targetMomentId: momentId, reportId })
    if (reportId) await updateReportStatus(reportId, adminId, 'actioned', 'Deleted moment')
  }
  return result
}

export async function addComment(
  momentId: string,
  userId: string,
  text: string,
): Promise<{ data: CommentWithProfile | null; error: unknown }> {
  const { data: comment, error } = await supabase
    .from('comments')
    .insert({ moment_id: momentId, user_id: userId, text: text.trim() })
    .select('*')
    .single()
  if (error || !comment) return { data: null, error }

  const [profile] = await getPublicProfilesByIds([userId])
  return {
    data: { ...(comment as { id: string; moment_id: string; user_id: string; text: string; created_at: string }), profiles: profile ?? null },
    error: null,
  }
}
