import { supabase } from './supabase'
import type { Profile, Moment, MomentWithProfile, ReactionType, CommentWithProfile } from './types'

// ─── PROFILES ────────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data as Profile | null
}

export async function updateProfile(
  userId: string,
  updates: Partial<Omit<Profile, 'id' | 'created_at'>>,
): Promise<{ error: unknown }> {
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
  return { error }
}

export async function searchUsers(query: string): Promise<Profile[]> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .limit(30)
  return (data as Profile[]) ?? []
}

// ─── MOMENTS ─────────────────────────────────────────────────────────────────

export async function getFeed(userId: string, limit = 20): Promise<MomentWithProfile[]> {
  const { data: following } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)

  if (!following || following.length === 0) return []

  const followingIds = (following as { following_id: string }[]).map(f => f.following_id)

  const { data } = await supabase
    .from('moments')
    .select('*, profiles(*)')
    .eq('is_public', true)
    .in('user_id', followingIds)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data as MomentWithProfile[]) ?? []
}

export async function getRandomMoments(limit: number): Promise<MomentWithProfile[]> {
  const { data } = await supabase
    .from('moments')
    .select('*, profiles(*)')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit * 3)
  if (!data || data.length === 0) return []
  const shuffled = [...data].sort(() => Math.random() - 0.5)
  return (shuffled.slice(0, limit) as MomentWithProfile[])
}

export async function getMomentsByEmotion(
  emotion: ReactionType,
  limit = 30,
): Promise<MomentWithProfile[]> {
  const { data: reactionData } = await supabase
    .from('reactions')
    .select('moment_id')
    .eq('type', emotion)

  if (!reactionData || reactionData.length === 0) return []

  const countMap: Record<string, number> = {}
  for (const r of reactionData as { moment_id: string }[]) {
    countMap[r.moment_id] = (countMap[r.moment_id] ?? 0) + 1
  }
  const sortedIds = Object.entries(countMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([id]) => id)

  const { data } = await supabase
    .from('moments')
    .select('*, profiles(*)')
    .eq('is_public', true)
    .in('id', sortedIds)

  if (!data) return []

  const momentMap = new Map((data as MomentWithProfile[]).map(m => [m.id, m]))
  return sortedIds.map(id => momentMap.get(id)).filter(Boolean) as MomentWithProfile[]
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
  const { data } = await supabase
    .from('moments')
    .select('*, profiles(*)')
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

// ─── SAVED MOMENTS ───────────────────────────────────────────────────────────

export async function saveMoment(
  userId: string,
  momentId: string,
): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('saved_moments')
    .insert({ user_id: userId, moment_id: momentId })
  return { error }
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
  const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds)
  const profileMap: Record<string, Profile> = {}
  for (const p of (profiles ?? []) as Profile[]) profileMap[p.id] = p

  return (comments as { id: string; moment_id: string; user_id: string; text: string; created_at: string }[]).map(c => ({
    ...c,
    profiles: profileMap[c.user_id] ?? null,
  }))
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return {
    data: { ...(comment as { id: string; moment_id: string; user_id: string; text: string; created_at: string }), profiles: (profile as Profile) ?? null },
    error: null,
  }
}
