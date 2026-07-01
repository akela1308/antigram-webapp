# Telegram Mini App — Quick Reference

## Init pattern (always do this first)
```typescript
const tg = window.Telegram?.WebApp
tg?.expand()               // fill full height
tg?.ready()                // hides native loading indicator
tg?.setBackgroundColor('#140E0A')
tg?.setHeaderColor('#140E0A')
tg?.setBottomBarColor('#140E0A')
tg?.disableVerticalSwipes() // prevent accidental close on scroll-down
```

## Core properties
| Property | Type | Description |
|---|---|---|
| `initData` | string | Raw URL-encoded init data for server validation |
| `initDataUnsafe` | object | Parsed init data (user, chat, auth_date, hash) — NOT safe alone |
| `version` | string | Bot API version (check with `isVersionAtLeast("8.0")`) |
| `platform` | string | `"android"` / `"ios"` / `"tdesktop"` / `"webk"` etc |
| `colorScheme` | string | `"light"` or `"dark"` |
| `themeParams` | object | Theme colors (also exposed as CSS vars `--tg-theme-*`) |
| `isExpanded` | boolean | Whether app is in full height mode |
| `isFullscreen` | boolean | True if in fullscreen (Bot API 8.0+) |
| `viewportHeight` | number | Visible height in px (changes when keyboard opens) |
| `viewportStableHeight` | number | Height without keyboard |
| `safeAreaInset` | object | `{top,bottom,left,right}` — system safe area (Bot API 8.0+) |
| `contentSafeAreaInset` | object | Content safe area accounting for TG UI (Bot API 8.0+) |
| `headerColor` | string | Current header color |
| `backgroundColor` | string | Current background color |
| `bottomBarColor` | string | Bottom bar color (Bot API 7.10+) |

## Core methods
```typescript
tg.expand()                          // Expand to full viewport height
tg.close()                           // Close the mini app
tg.ready()                           // Signal app loaded (removes splash)
tg.requestFullscreen()               // Enter fullscreen (Bot API 8.0+)
tg.exitFullscreen()                  // Exit fullscreen
tg.setHeaderColor('#RRGGBB')         // Set Telegram header color
tg.setBackgroundColor('#RRGGBB')     // Set background color
tg.setBottomBarColor('#RRGGBB')      // Set bottom bar color (7.10+)
tg.enableClosingConfirmation()       // Show "close?" dialog
tg.disableClosingConfirmation()      // No confirm on close
tg.enableVerticalSwipes()            // Allow swipe-down to close
tg.disableVerticalSwipes()           // Block swipe-down (prevents accidental close)
tg.isVersionAtLeast('8.0')           // Boolean — guards for newer APIs
tg.showAlert(msg, cb)                // Native alert dialog
tg.showConfirm(msg, cb)              // Native confirm (cb: boolean)
tg.showPopup(params, cb)             // Native popup with buttons
tg.openLink(url, {try_instant_view}) // Open external link
tg.openTelegramLink(url)             // Open in-app Telegram link
tg.sendData(data)                    // Send string to bot (keyboard mode only)
tg.shareMessage(msg_id, cb)          // Share to chat (Bot API 8.0+)
tg.downloadFile({url, file_name}, cb) // Prompt file download
tg.readTextFromClipboard(cb)         // Read clipboard (requires attachment menu)
tg.requestWriteAccess(cb)            // Request bot write permission
tg.requestContact(cb)                // Request user phone number
```

## BackButton + React Router
```typescript
import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

export function useTelegramBackButton() {
  const navigate = useNavigate()
  const location = useLocation()
  const tg = (window as any).Telegram?.WebApp

  useEffect(() => {
    if (!tg?.BackButton) return
    const isRoot = location.pathname === '/'
    if (isRoot) {
      tg.BackButton.hide()
    } else {
      tg.BackButton.show()
    }
    const handleBack = () => navigate(-1)
    tg.BackButton.onClick(handleBack)
    return () => tg.BackButton.offClick(handleBack)
  }, [location.pathname, navigate, tg])
}
```

## Safe area insets
```typescript
// CSS variables auto-set by Telegram (Bot API 8.0+):
// --tg-safe-area-inset-top, --tg-safe-area-inset-bottom,
// --tg-safe-area-inset-left, --tg-safe-area-inset-right
// --tg-content-safe-area-inset-top, etc.

// JS access:
const { top, bottom, left, right } = tg?.safeAreaInset ?? { top:0, bottom:0, left:0, right:0 }

// Fallback for older Telegram versions:
const safeTop = tg?.safeAreaInset?.top ?? (tg?.headerColor ? 48 : 0)
```

### Safe area pattern for page headers
```css
.page-header {
  padding-top: calc(var(--tg-safe-top, 0px) + 12px);
}
```
```typescript
// In App.tsx on mount:
useEffect(() => {
  const top = (window as any).Telegram?.WebApp?.safeAreaInset?.top ?? 0
  document.documentElement.style.setProperty('--tg-safe-top', `${top}px`)
  // Also listen for changes:
  const tg = (window as any).Telegram?.WebApp
  const handler = () => {
    const newTop = tg?.safeAreaInset?.top ?? 0
    document.documentElement.style.setProperty('--tg-safe-top', `${newTop}px`)
  }
  tg?.onEvent('safeAreaChanged', handler)
  return () => tg?.offEvent('safeAreaChanged', handler)
}, [])
```

## HapticFeedback
```typescript
tg.HapticFeedback.impactOccurred('medium')       // light|medium|heavy|rigid|soft
tg.HapticFeedback.notificationOccurred('success') // error|success|warning
tg.HapticFeedback.selectionChanged()              // e.g. scroll picker tick
```

## Events
```typescript
tg.onEvent('themeChanged', handler)
tg.onEvent('viewportChanged', ({ isStateStable }) => { ... })
tg.onEvent('backButtonClicked', handler)
tg.onEvent('safeAreaChanged', handler)          // Bot API 8.0+
tg.onEvent('contentSafeAreaChanged', handler)   // Bot API 8.0+
tg.onEvent('activated', handler)                // App focused (Bot API 8.0+)
tg.onEvent('deactivated', handler)              // App unfocused (Bot API 8.0+)
tg.offEvent(eventType, handler)                 // Remove listener
```

## ThemeParams CSS variables
Telegram injects these automatically:
```
--tg-theme-bg-color
--tg-theme-text-color
--tg-theme-hint-color
--tg-theme-link-color
--tg-theme-button-color
--tg-theme-button-text-color
--tg-theme-secondary-bg-color
--tg-theme-header-bg-color       (7.0+)
--tg-theme-bottom-bar-bg-color   (7.10+)
--tg-theme-accent-text-color     (7.0+)
--tg-theme-section-bg-color      (7.0+)
```

## Platform quirks

### iOS
- `safe-area-inset-top` is typically 44–59px (notch/Dynamic Island). Always pad top content.
- `viewportHeight` shrinks when the keyboard appears — use `viewportStableHeight` for layout.
- `-webkit-overflow-scrolling: touch` not needed in modern iOS but no harm.
- `100vh` can overflow; use `100dvh` or `viewportHeight` from TG.
- `position: fixed` + keyboard: fixed elements may jump. Prefer sticky.
- `overscroll-behavior: none` on body prevents bounce affecting overlays.

### Android
- Keyboard resize mode is `resize` by default — the viewport shrinks.
- Safe area insets are usually 0 unless there's a notch.
- Hardware back button fires `backButtonClicked` event; always handle it.
- Haptic feedback works on most recent Android Telegram versions.

### Desktop (tdesktop / webk)
- No touch events; mouse only.
- `safeAreaInset` is all zeros.
- `viewportHeight` is the panel height — much larger than mobile.
- No camera access (`getUserMedia` may be blocked or require HTTPS).
- HapticFeedback is a no-op.
- BackButton is rarely shown; rely on in-app navigation buttons.

## BottomButton (MainButton)
```typescript
tg.MainButton.setText('Опубликовать')
tg.MainButton.setParams({ color: '#C9922A', text_color: '#140E0A' })
tg.MainButton.show()
tg.MainButton.onClick(() => handlePublish())
// OR use SecondaryButton for two-button layouts (Bot API 7.10+)
```

## CloudStorage (key-value, 1024 items × 4096 chars)
```typescript
tg.CloudStorage.setItem('key', 'value', (err, success) => {})
tg.CloudStorage.getItem('key', (err, value) => {})
tg.CloudStorage.getKeys((err, keys) => {})
```

## Version guard pattern
```typescript
function tgApiAvailable(version: string) {
  return (window as any).Telegram?.WebApp?.isVersionAtLeast(version) ?? false
}
// Usage:
if (tgApiAvailable('8.0')) {
  tg.requestFullscreen()
}
```
