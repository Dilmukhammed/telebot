/** Telegram WebApp avatar first, then stored photo_url from API/DB. */
export function useAvatarUrl(user?: { photo_url?: string | null } | null): string | undefined {
  const tgUser = (window as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { photo_url?: string } } } } })
    .Telegram?.WebApp?.initDataUnsafe?.user
  return tgUser?.photo_url || user?.photo_url || undefined
}
