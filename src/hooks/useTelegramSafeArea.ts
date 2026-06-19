export function useTelegramSafeArea() {
  const tg = (window as any).Telegram?.WebApp
  const top = tg?.safeAreaInset?.top ?? (tg?.headerColor ? 48 : 0)
  const bottom = tg?.safeAreaInset?.bottom ?? 0
  return { top, bottom }
}
