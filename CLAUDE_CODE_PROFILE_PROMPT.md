# Claude Code Task: Full Profile Redesign — match mobile app

## Context

ANTIGRAM Telegram mini-app. Stack: React + TypeScript + Vite + Supabase.

Mobile app reference: `../mobile/src/screens/ProfileScreen.tsx` and `../mobile/src/components/FilmStripProfileHeader.tsx`

Goal: make the Telegram mini-app profile page look and work exactly like the mobile app.

---

## STEP 0: SQL migrations

Create file `supabase_migration_profile.sql` with ALL of the following. The user will run this in Supabase SQL editor.

```sql
-- Highlights (film strip slots — 5 curated photos per user)
create table if not exists highlights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  moment_id   uuid not null references moments(id) on delete cascade,
  position    int  not null check (position >= 0 and position <= 4),
  created_at  timestamptz default now(),
  unique(user_id, position)
);
alter table highlights enable row level security;
create policy "highlights_select" on highlights for select using (true);
create policy "highlights_insert" on highlights for insert with check (auth.uid() = user_id);
create policy "highlights_delete" on highlights for delete using (auth.uid() = user_id);
create policy "highlights_update" on highlights for update using (auth.uid() = user_id);

-- Albums
create table if not exists albums (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  is_public  boolean default true,
  created_at timestamptz default now()
);
alter table albums enable row level security;
create policy "albums_select"  on albums for select using (true);
create policy "albums_insert"  on albums for insert with check (auth.uid() = user_id);
create policy "albums_delete"  on albums for delete using (auth.uid() = user_id);
create policy "albums_update"  on albums for update using (auth.uid() = user_id);

-- Album ↔ Moment join table
create table if not exists album_moments (
  album_id   uuid not null references albums(id) on delete cascade,
  moment_id  uuid not null references moments(id) on delete cascade,
  added_at   timestamptz default now(),
  primary key (album_id, moment_id)
);
alter table album_moments enable row level security;
create policy "album_moments_select" on album_moments for select using (true);
create policy "album_moments_insert" on album_moments for insert
  with check (exists (select 1 from albums where id = album_id and user_id = auth.uid()));
create policy "album_moments_delete" on album_moments for delete
  using (exists (select 1 from albums where id = album_id and user_id = auth.uid()));
```

---

## STEP 1: Add new types to `src/lib/types.ts`

Append these interfaces:

```ts
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
```

---

## STEP 2: Add new DB functions to `src/lib/db.ts`

Add these functions (import Album, AlbumWithMoments, Highlight, HighlightWithMoment from types):

```ts
// ── Highlights ────────────────────────────────────────────────────────────────

export async function getHighlights(userId: string): Promise<HighlightWithMoment[]> {
  const { data } = await supabase
    .from('highlights')
    .select('*, moments(id, photo_url)')
    .eq('user_id', userId)
    .order('position')
  return (data as HighlightWithMoment[]) ?? []
}

export async function setHighlightAtPosition(
  userId: string, momentId: string, position: number
): Promise<{ error: any }> {
  // upsert: replace existing at this position
  const { error } = await supabase
    .from('highlights')
    .upsert({ user_id: userId, moment_id: momentId, position }, { onConflict: 'user_id,position' })
  return { error }
}

export async function removeHighlightAtPosition(
  userId: string, position: number
): Promise<{ error: any }> {
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

  const result: AlbumWithMoments[] = await Promise.all(
    (albums as Album[]).map(async (album) => {
      const { count } = await supabase
        .from('album_moments')
        .select('*', { count: 'exact', head: true })
        .eq('album_id', album.id)
      const { data: first } = await supabase
        .from('album_moments')
        .select('moments(photo_url)')
        .eq('album_id', album.id)
        .order('added_at', { ascending: false })
        .limit(1)
        .single()
      const firstUrl = (first as any)?.moments?.photo_url ?? null
      return { ...album, moments_count: count ?? 0, first_moment_url: firstUrl }
    })
  )
  return result
}

export async function createAlbum(
  userId: string, title: string
): Promise<{ data: Album | null; error: any }> {
  const { data, error } = await supabase
    .from('albums')
    .insert({ user_id: userId, title })
    .select()
    .single()
  return { data: data as Album | null, error }
}

export async function deleteAlbum(albumId: string): Promise<{ error: any }> {
  const { error } = await supabase.from('albums').delete().eq('id', albumId)
  return { error }
}

export async function updateAlbumTitle(
  albumId: string, title: string
): Promise<{ error: any }> {
  const { error } = await supabase.from('albums').update({ title }).eq('id', albumId)
  return { error }
}

export async function getAlbumMoments(albumId: string): Promise<Moment[]> {
  const { data } = await supabase
    .from('album_moments')
    .select('moments(*)')
    .eq('album_id', albumId)
    .order('added_at', { ascending: false })
  return ((data ?? []).map((d: any) => d.moments).filter(Boolean)) as Moment[]
}

export async function addMomentToAlbum(
  albumId: string, momentId: string
): Promise<{ error: any }> {
  const { error } = await supabase
    .from('album_moments')
    .insert({ album_id: albumId, moment_id: momentId })
  return { error }
}

export async function removeMomentFromAlbum(
  albumId: string, momentId: string
): Promise<{ error: any }> {
  const { error } = await supabase
    .from('album_moments')
    .delete()
    .eq('album_id', albumId)
    .eq('moment_id', momentId)
  return { error }
}

// ── Moment delete ─────────────────────────────────────────────────────────────

export async function deleteMoment(momentId: string): Promise<{ error: any }> {
  const { error } = await supabase.from('moments').delete().eq('id', momentId)
  return { error }
}
```

---

## STEP 3: Create FilmStripHeader component

Create `src/components/FilmStripHeader.tsx`.

This is a horizontal scrollable film strip with:
- Amber/brown sprocket hole edges (top and bottom)
- Dark film track in the middle
- 5 photo slots (can be empty, showing `+` for owner)
- On tap: if empty and isOwner → call onReplaceRequest(slotIndex)
- On tap: if has photo and isOwner → show options: "Открыть" / "Заменить" / "Убрать"

**Visual design (match mobile exactly):**

Colors:
- Track bg: `#0E0804`
- Sprocket edge bg: `#A05C18`  
- Sprocket holes: `#3A1406`
- Frame border: `#6B3A12`
- Amber: `#D4891A`

Structure:
```
[SprocketEdge: amber bar with small dark square holes]
[Track: dark bg, horizontal scroll of 5 frames]
[SprocketEdge: same]
```

SprocketEdge: a div with amber background (`#A05C18`), height 14px, display flex, flex-direction row, gap 4px, padding 0 6px, overflow hidden. Contains ~16 small squares (width 12px, height 10px, borderRadius 2px, background `#3A1406`, flexShrink 0).

Track: height 96px, dark bg, overflow-x auto, display flex, align-items center, padding 0 16px, gap 10px, scrollbar hidden.

Each frame: width 72px, height 72px, borderRadius 8px, border 1px solid `#6B3A12`, overflow hidden, background `#0E0804`, flexShrink 0.
- If has photo: `<img>` objectFit cover
- If empty: dark reddish bg `rgba(107,46,12,0.28)`, centered `+` in amber color

Props:
```ts
interface FilmStripHeaderProps {
  photos: (string | null)[]  // exactly 5 slots
  isOwner?: boolean
  onReplaceRequest?: (slotIndex: number) => void
  onOpenPhoto?: (slotIndex: number) => void
}
```

For the "options on tap" — use the browser's `confirm` / custom inline mini-menu or just a bottom sheet with two buttons. Keep it simple: on tap, if isOwner and has photo, show a small overlay menu inline (position absolute, below the frame):

```tsx
// Simplest approach: track which slot is "menu open" in state
const [menuSlot, setMenuSlot] = useState<number | null>(null)
```

Show the mini-menu as an absolutely positioned div below the strip when menuSlot is not null.

---

## STEP 4: Full rewrite of `src/pages/MyProfilePage.tsx`

Replace the entire file. New layout (top to bottom):

```
[Sticky header bar: "Мой профиль" + "⚙" settings button]
[FilmStripHeader — 5 slots, owner mode]
[Hint banner if 0 highlights: "Выберите 5 фото для плёнки — нажмите + на кадр"]
[@username centered, bold]
[bio if exists]
[Stats row: кадры | подписчики | подписки]
[Tabs: "Мои кадры" | "Мои альбомы" — with amber underline on active]
[Content area based on active tab]
```

**Tab "Мои кадры":**
Photo grid with editorial pattern (alternating 2-column pairs + full-width):
```
Every 5 items: items 0,1 → pair; items 2,3 → pair; item 4 → full width; repeat
```
Build a `buildGridRows` function:
```ts
type GridRow =
  | { type: 'pair'; key: string; left: Moment; right: Moment | null }
  | { type: 'full'; key: string; item: Moment }

function buildGridRows(moments: Moment[]): GridRow[] {
  const rows: GridRow[] = []
  let i = 0
  while (i < moments.length) {
    if (i % 5 === 4) {
      rows.push({ type: 'full', key: moments[i].id, item: moments[i] })
      i++
    } else {
      rows.push({ type: 'pair', key: moments[i].id, left: moments[i], right: moments[i+1] ?? null })
      i += 2
    }
  }
  return rows
}
```

Pair row: display flex, gap 8px, padding 0 8px, marginBottom 8px. Each tile: flex 1, aspect-ratio 1, borderRadius 10px, overflow hidden.

Full row: margin 0 8px 8px, aspect-ratio 1 (100% wide), borderRadius 10px, overflow hidden.

Each photo has `onClick`: navigate to `'/moment-feed'` with state `{ moments, startIndex: moments.indexOf(moment) }`.

**Long-press / right-click on photo** → show delete option:
Use `onContextMenu` (right click / long press on mobile via touchstart timer trick).
Show a small overlay: "Удалить кадр?" → confirm → call `deleteMoment(moment.id)` then reload.

**Tab "Мои альбомы":**
Albums grid — 2 columns, same style as mobile:

```tsx
function AlbumsGrid({ albums, onCreatePress, onAlbumPress }) { ... }
```

Grid items:
- Each album card: roughly (screenWidth - 28) / 2 wide, borderRadius 12, overflow hidden, border 1px solid `#2E1A0A`
- Cover image: aspect-ratio 4/3, objectFit cover (or dark placeholder if no cover)
- Lock badge (top-right corner): if not is_public → small dark circle with 🔒 (font 12px)
- Album title below: color amber, fontSize 13, fontWeight 600, padding 8 10px
- Title format: if title starts with # keep as-is, else prepend #

Special first card "Сохранённые":
- Cover: amber-tinted bg `rgba(201,146,42,0.12)`, centered ⌂ icon (fontSize 28, amber color)
- Always shown first
- On tap: navigate to `/saved` (or show a toast "Скоро" if not implemented yet)

"+ Новая плёнка" card at the end:
- Dark placeholder cover, centered "+" (amber, fontSize 28)
- Below: "Новая плёнка" in muted color
- On tap: show create album modal (see below)

**Create Album modal (bottom sheet):**
State: `showCreateAlbum: boolean`, `newAlbumTitle: string`

Bottom sheet (same dark style as film picker):
- Title: "Новый альбом"  
- Input: dark bg, amber border, text white, placeholder "Название..."
- Button "Создать" (amber bg) → calls `createAlbum(userId, newAlbumTitle)` → close sheet → reload albums

**Album detail page:** navigate to `/album/:albumId` with state `{ albumId, albumTitle, userId }`

**Settings / sign out:**
Gear icon button in top-right of header bar.
On click: show browser `confirm` dialog:
- "Выйти из аккаунта?" → confirm → `signOut()`
- (Profile editing is out of scope for now)

**Film strip highlight picker modal:**
When user taps "+" or "Заменить" on a film strip slot → show a modal/bottom sheet with user's moments in a 3-column grid.
User taps a photo → `setHighlightAtPosition(userId, moment.id, slotIndex)` → close modal → reload highlights.

**State:**
```ts
const [moments, setMoments] = useState<Moment[]>([])
const [highlights, setHighlights] = useState<HighlightWithMoment[]>([])
const [albums, setAlbums] = useState<AlbumWithMoments[]>([])
const [followersCount, setFollowersCount] = useState(0)
const [followingCount, setFollowingCount] = useState(0)
const [loading, setLoading] = useState(true)
const [activeTab, setActiveTab] = useState<'film' | 'albums'>('film')
const [pickerTarget, setPickerTarget] = useState<number | null>(null)  // slot index
const [showCreateAlbum, setShowCreateAlbum] = useState(false)
const [newAlbumTitle, setNewAlbumTitle] = useState('')
```

Load function: loads all 6 in parallel (profile, moments, highlights, albums, followers, following).

**ringPhotos** — build from highlights:
```ts
const ringPhotos: (string | null)[] = Array.from({ length: 5 }, (_, i) => {
  const hl = highlights.find(h => h.position === i)
  return hl?.moments?.photo_url ?? null
})
```

---

## STEP 5: Create `src/pages/AlbumDetailPage.tsx`

Route: `/album/:albumId`
Gets state from router: `{ albumTitle: string, userId: string }`

Features:
- Header: "← назад" + album title + "⋯" menu button
- Menu: "Переименовать" | "Удалить альбом" (with confirm)
- "Добавить фото" button (amber, full-width, at bottom or top of content)
- 3-column photo grid of album's moments
- Tap photo in album → show option "Убрать из альбома" (with confirm)
- "Добавить фото" → opens picker modal showing user's moments NOT already in album → tap to add

Use `getAlbumMoments`, `getUserMoments`, `addMomentToAlbum`, `removeMomentFromAlbum`, `deleteAlbum`, `updateAlbumTitle` from db.ts.

**Rename flow:** inline input below title, or a bottom sheet with text input.

---

## STEP 6: Add new routes to `src/App.tsx`

```tsx
import { AlbumDetailPage } from './pages/AlbumDetailPage'

// Add to router:
<Route path="/album/:albumId" element={<AlbumDetailPage />} />
```

(MomentFeedPage route should already exist from previous task — if not, add it too.)

---

## STEP 7: Fix MomentPage — add delete button for owner

In `src/pages/MomentPage.tsx`, if the logged-in user is the owner of the moment, show a "⋯" menu or delete button.
On delete: call `deleteMoment(moment.id)` then `navigate(-1)`.

---

## STEP 8: SQL migration file

Print to console or write to file exactly what SQL the user must run.
The file is already described in STEP 0 — make sure it is saved as `supabase_migration_profile.sql`.

---

## STEP 9: Verification

1. `npm run build` — must succeed
2. Check that `FilmStripHeader` renders (no TS errors)
3. Check that `AlbumDetailPage` has no missing imports
4. Check MyProfilePage imports all new DB functions

---

## Design reference values

All from mobile app source:

| Token | Value |
|-------|-------|
| Track bg | `#0E0804` |
| Sprocket edge | `#A05C18` |
| Sprocket holes | `#3A1406` |
| Frame border | `#6B3A12` |
| Amber light | `#D4891A` |
| Amber mid | `#C9922A` |
| Text | `#F0E8D8` |
| Text muted | `#7A6A58` |
| Border | `#2E1A0A` |
| BG | `#140E0A` |
| BG warm | `#1A1208` |
| Amber accent | `var(--amber)` (already in CSS) |

Film strip dimensions:
- Edge height: 14px
- Track height: 96px  
- Frame: 72×72px, borderRadius 8px
- Gap between frames: 10px
- Total strip height: 14 + 96 + 14 = 124px

Album card: ~(50vw - 14px) wide, aspectRatio 4/3 cover, rounded 12px.

---

## Important notes

- Do NOT break existing pages (FeedPage, SearchPage, MomentPage, UploadPage, etc.)
- The `no-scrollbar` class is already in global CSS — use it on the film strip track
- Use `useNavigate` from react-router-dom for navigation
- Use inline style objects (no Tailwind for custom values)
- `var(--amber)` = `#C9843E` (already defined in CSS)
- `var(--bg)` = `#140E0A`
- `var(--border)` = `#2E1A0A`
- `var(--text)` = `#F0E8D8`
- `var(--text-muted)` = `#7A6A58`
- Telegram WebView: avoid `alert()` — use inline confirm UI or conditional rendering
