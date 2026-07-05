import { getPlatformSafeArea } from '../lib/platform'

export function useTelegramSafeArea() {
  const { top, bottom } = getPlatformSafeArea()
  return { top, bottom }
}
