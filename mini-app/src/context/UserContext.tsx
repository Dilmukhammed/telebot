import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { getMe } from '../api/client'
import type { UserOut } from '../shared/types'

interface UserContextValue {
  user: UserOut | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
  error: null,
  refresh: async () => {},
})

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUser = useCallback(async (isRefresh = false) => {
    // Only show full-page spinner on initial load, not on refreshes
    if (!isRefresh) setLoading(true)
    setError(null)
    try {
      const u = await getMe()
      setUser(u)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load user')
    } finally {
      if (!isRefresh) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const refresh = useCallback(() => fetchUser(true), [fetchUser])

  const value = useMemo<UserContextValue>(
    () => ({ user, loading, error, refresh }),
    [user, loading, error, refresh]
  )

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
