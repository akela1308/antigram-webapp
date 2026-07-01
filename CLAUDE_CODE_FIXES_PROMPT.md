# Claude Code Task: Fix Grain, Filters, Profile, Icons, Flares

## Context
ANTIGRAM Telegram mini-app. Stack: React + TypeScript + Vite. Supabase backend.
Main camera/upload: `src/pages/UploadPage.tsx`
Film presets: `src/lib/filmPresets.ts`
Film picker bottom sheet: `src/components/BottomNav.tsx`
Profile page: `src/pages/MyProfilePage.tsx`
Mobile app preset icons: `../mobile/assets/presets/*.png` (agfa.png, bleach.png, cold.png, fuji.png, hc_bw.png, kodak.png, lc_bw.png, slide.png, technicolor.png, warm.png)
App router: `src/App.tsx`

---

## Task 1: Make grain 5x stronger

In `src/pages/UploadPage.tsx`, find the `applyGrain` function.
Change the grain noise multiplier from `220` to `1000`:

```ts
const noiseVal = noise * grain.intensity * 1000   // was 220
```

This applies in BOTH branches of the if (size > 1.0 branch and the else branch).

---

## Task 2: Stronger film preset effects

Replace the entire `src/lib/filmPresets.ts` content with this version that has stronger
color grading (the original values were too conservative — CSS filters need to be
pushed harder to be visible on mobile):

```ts
export type GrainConfig = {
  intensity: number
  size:      number
  shape:     'round' | 'tgrain'
  r: number
  g: number
  b: number
}

export type AlgoType = 'orthochrom' | 'ultramax' | 'vision_t'
export type FlareType = 'none' | 'leak_warm' | 'leak_cool' | 'edge_burn' | 'streak'

export interface FilmPreset {
  id:        string
  name:      string
  color:     string
  filter:    string
  grain:     GrainConfig
  algoType?: AlgoType
}

export const FILM_PRESETS: FilmPreset[] = [
  {
    id: 'none', name: '∅ Без фильтра', color: '#444444', filter: 'none',
    grain: { intensity: 0.004, size: 0.8, shape: 'round', r: 1.0, g: 1.0, b: 1.0 },
  },
  {
    id: 'kodak', name: 'Kodak Portra', color: '#C8A050',
    filter: 'contrast(1.18) saturate(1.65) brightness(1.05) sepia(0.22) hue-rotate(-4deg)',
    grain: { intensity: 0.048, size: 1.2, shape: 'tgrain', r: 1.0, g: 0.90, b: 0.65 },
  },
  {
    id: 'fuji', name: 'Fuji Superia', color: '#4A8B6B',
    filter: 'contrast(1.22) saturate(0.72) hue-rotate(-14deg) brightness(0.94)',
    grain: { intensity: 0.035, size: 1.0, shape: 'round', r: 0.70, g: 1.0, b: 0.85 },
  },
  {
    id: 'agfa', name: 'Agfa Vista', color: '#C47832',
    filter: 'contrast(1.22) saturate(1.75) sepia(0.25) hue-rotate(8deg)',
    grain: { intensity: 0.055, size: 1.3, shape: 'round', r: 1.0, g: 0.85, b: 0.65 },
  },
  {
    id: 'warm', name: 'Warm', color: '#D4703A',
    filter: 'contrast(1.08) saturate(1.35) sepia(0.48) brightness(1.06)',
    grain: { intensity: 0.040, size: 1.0, shape: 'round', r: 1.0, g: 0.80, b: 0.50 },
  },
  {
    id: 'cold', name: 'Cold', color: '#4A78B8',
    filter: 'contrast(1.25) saturate(0.55) hue-rotate(22deg) brightness(0.92)',
    grain: { intensity: 0.038, size: 1.0, shape: 'round', r: 0.55, g: 0.80, b: 1.0 },
  },
  {
    id: 'bleach', name: 'Bleach Bypass', color: '#888880',
    filter: 'contrast(1.60) saturate(0.40) brightness(0.88)',
    grain: { intensity: 0.055, size: 1.3, shape: 'round', r: 1.0, g: 1.0, b: 1.0 },
  },
  {
    id: 'slide', name: 'Slide', color: '#B86840',
    filter: 'contrast(1.38) saturate(1.65) brightness(0.92) hue-rotate(-6deg)',
    grain: { intensity: 0.025, size: 0.8, shape: 'round', r: 1.0, g: 0.90, b: 0.80 },
  },
  {
    id: 'technicolor', name: 'Technicolor', color: '#D4A020',
    filter: 'contrast(1.32) saturate(1.90) hue-rotate(-12deg) brightness(0.93)',
    grain: { intensity: 0.065, size: 1.7, shape: 'round', r: 1.0, g: 0.95, b: 0.45 },
  },
  {
    id: 'hc_bw', name: 'HC B&W', color: '#606060',
    filter: 'grayscale(1) contrast(1.45) brightness(0.86)',
    grain: { intensity: 0.080, size: 2.0, shape: 'round', r: 1.0, g: 1.0, b: 1.0 },
  },
  {
    id: 'lc_bw', name: 'LC B&W', color: '#909090',
    filter: 'grayscale(1) contrast(0.90) brightness(1.08)',
    grain: { intensity: 0.040, size: 1.0, shape: 'round', r: 1.0, g: 1.0, b: 1.0 },
  },
  {
    id: 'orthochrom', name: 'Orthochrom', color: '#404040', filter: 'none',
    grain: { intensity: 0.090, size: 1.8, shape: 'round', r: 1.0, g: 1.0, b: 1.0 },
    algoType: 'orthochrom',
  },
  {
    id: 'ultramax', name: 'Ultramax', color: '#D48030', filter: 'none',
    grain: { intensity: 0.048, size: 1.3, shape: 'round', r: 1.0, g: 0.85, b: 0.60 },
    algoType: 'ultramax',
  },
  {
    id: 'vision_t', name: 'Vision T', color: '#4858A8', filter: 'none',
    grain: { intensity: 0.042, size: 1.5, shape: 'tgrain', r: 0.65, g: 0.80, b: 1.0 },
    algoType: 'vision_t',
  },
]
```

---

## Task 3: Stronger algo presets (orthochrom/ultramax/vision_t)

In `src/pages/UploadPage.tsx`, find `applyAlgo` function and replace its body:

```ts
function applyAlgo(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, algoType: AlgoType): void {
  const W = canvas.width
  const H = canvas.height
  const imageData = ctx.getImageData(0, 0, W, H)
  const d = imageData.data

  if (algoType === 'orthochrom') {
    // Strong R-channel grayscale (orthochromatic = very sensitive to red, blind to blue)
    for (let i = 0; i < d.length; i += 4) {
      let lum = d[i] * 0.92 + d[i + 1] * 0.07 + d[i + 2] * 0.01
      lum = clamp((lum - 128) * 1.75 + 128, 0, 255)
      d[i] = d[i + 1] = d[i + 2] = lum
    }
  } else if (algoType === 'ultramax') {
    // Warm: strong red boost, green neutral, cut blue hard
    for (let i = 0; i < d.length; i += 4) {
      let r = clamp(d[i]     * 1.18 + 20, 0, 255)
      let g = clamp(d[i + 1] * 1.04,      0, 255)
      let b = clamp(d[i + 2] * 0.72 - 12, 0, 255)
      r = clamp((r - 128) * 1.18 + 128, 0, 255)
      g = clamp((g - 128) * 1.12 + 128, 0, 255)
      b = clamp((b - 128) * 1.15 + 128, 0, 255)
      d[i] = r; d[i + 1] = g; d[i + 2] = b
    }
  } else if (algoType === 'vision_t') {
    // Cool teal: cut red, boost blue hard, slight desaturate
    for (let i = 0; i < d.length; i += 4) {
      let r = clamp(d[i]     * 0.76 - 16, 0, 255)
      let g = clamp(d[i + 1] * 0.96,      0, 255)
      let b = clamp(d[i + 2] * 1.28 + 18, 0, 255)
      r = clamp((r - 128) * 0.90 + 128, 0, 255)
      g = clamp((g - 128) * 0.90 + 128, 0, 255)
      b = clamp((b - 128) * 0.92 + 128, 0, 255)
      d[i] = r; d[i + 1] = g; d[i + 2] = b
    }
  }

  ctx.putImageData(imageData, 0, 0)
}
```

---

## Task 4: Auto-random flare on capture

In `src/pages/UploadPage.tsx`, find the `capture()` function.

Add auto-flare logic: 30% chance to apply a random light leak when preset is not 'none'.
Replace the existing flare section:

```ts
// Auto-flare: 30% chance when using a film preset
const AUTO_FLARES: FlareType[] = ['leak_warm', 'streak', 'leak_warm', 'leak_cool']
const autoFlare: FlareType =
  preset.id !== 'none' && Math.random() < 0.30
    ? AUTO_FLARES[Math.floor(Math.random() * AUTO_FLARES.length)]
    : 'none'

const effectiveFlare = selectedFlare !== 'none' ? selectedFlare : autoFlare

if (effectiveFlare !== 'none') {
  applyFlare(ctx, canvas, effectiveFlare)
}
```

Remove or keep the manual flare picker UI — it can stay but is optional (auto-flare now happens regardless).

---

## Task 5: Film preset icons — use PNG images instead of colored circles

### Step 5a: Copy PNG files
Copy all PNG files from `../mobile/assets/presets/` into `public/presets/`:
```
cp ../mobile/assets/presets/*.png public/presets/
```
Create the `public/presets/` directory if it doesn't exist.

### Step 5b: Add iconUrl to each preset
In `src/lib/filmPresets.ts`, add optional `iconUrl` field to `FilmPreset`:
```ts
export interface FilmPreset {
  id:        string
  name:      string
  color:     string
  filter:    string
  grain:     GrainConfig
  algoType?: AlgoType
  iconUrl?:  string   // path to film canister PNG
}
```

Add `iconUrl` to the presets that have PNG files:
```ts
{ id: 'kodak',      ..., iconUrl: '/presets/kodak.png' },
{ id: 'fuji',       ..., iconUrl: '/presets/fuji.png' },
{ id: 'agfa',       ..., iconUrl: '/presets/agfa.png' },
{ id: 'warm',       ..., iconUrl: '/presets/warm.png' },
{ id: 'cold',       ..., iconUrl: '/presets/cold.png' },
{ id: 'bleach',     ..., iconUrl: '/presets/bleach.png' },
{ id: 'slide',      ..., iconUrl: '/presets/slide.png' },
{ id: 'technicolor',..., iconUrl: '/presets/technicolor.png' },
{ id: 'hc_bw',     ..., iconUrl: '/presets/hc_bw.png' },
{ id: 'lc_bw',     ..., iconUrl: '/presets/lc_bw.png' },
```
Presets `none`, `orthochrom`, `ultramax`, `vision_t` have no PNG — keep circle for them.

### Step 5c: Update BottomNav film picker
In `src/components/BottomNav.tsx`, replace the colored circle div with:

```tsx
{/* Film icon */}
<div
  style={{
    width: 64, height: 64, borderRadius: 32,
    border: active ? '3px solid var(--amber)' : '2px solid #2E2218',
    overflow: 'hidden',
    background: preset.iconUrl ? 'transparent' : preset.id === 'none' ? '#1A1A1A' : preset.color,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'border-color 0.15s',
  }}
>
  {preset.iconUrl ? (
    <img
      src={preset.iconUrl}
      alt={preset.name}
      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 32 }}
    />
  ) : (
    <>
      <div style={{
        width: 24, height: 24, borderRadius: 12,
        background: 'rgba(0,0,0,0.35)',
        border: '1.5px solid rgba(255,255,255,0.15)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 32,
        background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.18) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />
    </>
  )}
</div>
```

---

## Task 6: Redesign MyProfilePage to match mobile app

Replace `src/pages/MyProfilePage.tsx` with a version that matches the mobile app profile layout:

Layout structure (top to bottom):
1. **Sticky header** — "Мой профиль" + sign out button
2. **Avatar** — Telegram photo_url if available, else Avatar component (80px circle, centered)
3. **Name** — display_name or username, centered
4. **@username** — centered, muted
5. **Telegram badge** — small Telegram icon + "Telegram" text if isTelegram
6. **Stats row** — кадры | подписчики | подписки (centered, with dividers)
7. **Horizontal film strip** — scrollable strip of user's photos (like the mobile app top film strip)
   - Horizontal scroll, no scrollbar
   - Each photo: 80x80px rounded square, aspect-ratio 1
   - Shows ALL user moments in order
   - Strip has a dark film strip feel (dark background, slight rounded corners)
8. **Albums section** — heading "АЛЬБОМЫ", empty state ("Альбомы появятся здесь") if no albums
9. **Divider** — thin line
10. **Photos grid** — 2-column grid of all moments
    - Each photo: square aspect ratio, rounded corners
    - On tap: navigate to `'/moment-feed'` with router state `{ moments, startIndex: index }`
    - Do NOT use `<Link>` — use `onClick` with navigate

### Film strip component (inline in the file):
```tsx
function ProfileFilmStrip({ moments }: { moments: Moment[] }) {
  if (moments.length === 0) return null
  return (
    <div style={{
      background: '#0A0806',
      borderTop: '2px solid #2A1A0A',
      borderBottom: '2px solid #2A1A0A',
      padding: '8px 0',
      margin: '0 0 16px',
    }}>
      <div
        className="no-scrollbar"
        style={{
          display: 'flex', gap: 4, overflowX: 'auto',
          padding: '0 12px',
          alignItems: 'center',
        }}
      >
        {moments.map(m => (
          <div
            key={m.id}
            style={{
              flexShrink: 0,
              width: 72, height: 72,
              borderRadius: 6,
              overflow: 'hidden',
              border: '1px solid #2E1A0A',
            }}
          >
            <img
              src={m.photo_url}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## Task 7: Create MomentFeedPage — vertical scrollable user moments feed

Create new file `src/pages/MomentFeedPage.tsx`:

This page receives from router state:
- `moments: Moment[]` — array of moments to show
- `startIndex: number` — which index to scroll to on mount

Layout:
- Full screen vertical scroll feed (like the main FeedPage but no filters, just vertical list)
- Each item shows: full-width photo (aspect-ratio 1), then below: username, reactions, caption, date
- On mount, scroll to `startIndex` position (use `useRef` array + `scrollIntoView`)
- Back button in top-left corner (navigate back)

The page uses the existing `MomentCard` component if possible, or renders inline.
Show a back arrow button at top left (sticky):
```tsx
<button onClick={() => navigate(-1)} style={{
  position: 'fixed', top: 'calc(var(--tg-top, 56px) + 8px)', left: 12, zIndex: 50,
  background: 'rgba(20,14,10,0.85)', borderRadius: 20, padding: '6px 12px',
  border: '1px solid #2E2218', color: '#fff', fontSize: 14, cursor: 'pointer',
}}>← Назад</button>
```

---

## Task 8: Add MomentFeedPage to router

In `src/App.tsx`, add the route:
```tsx
import { MomentFeedPage } from './pages/MomentFeedPage'
// ...
<Route path="/moment-feed" element={<MomentFeedPage />} />
```

---

## Task 9: Verification

After all changes:
1. Run `npm run build` — must succeed with 0 errors
2. Check that `public/presets/` directory exists and contains PNG files
3. Confirm `applyGrain` uses `1000` not `220` as multiplier

## Important notes

- Do NOT break existing functionality (camera, publish, auth)
- Preserve all existing TypeScript types
- The `lc_bw` preset was missing from the original presets array — it's been added in Task 2 above, make sure it's included
- Keep the `no-scrollbar` CSS class usage (already defined in global CSS)
- All styles use inline style objects (no Tailwind for custom values)
