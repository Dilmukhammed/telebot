import { createContext, useContext, useCallback, useMemo, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getMe } from '../api/client'
import type { UserOut } from '../shared/types'

interface UserContextValue {
  user: UserOut | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  setUser: (user: UserOut | null) => void
}

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
  error: null,
  refresh: async () => {},
  setUser: () => {},
})

export function UserProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const {
    data: user,
    isLoading,
    error,
    refetch,
  } = useQuery<UserOut>({
    queryKey: ['me'],
    queryFn: () => getMe(),
    staleTime: 5 * 60 * 1000, // 5 minutes — user data rarely changes
    gcTime: 10 * 60 * 1000,   // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  })

  const refresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  const setUser = useCallback((newUser: UserOut | null) => {
    queryClient.setQueryData(['me'], newUser)
  }, [queryClient])

  const errorStr = error ? (error instanceof Error ? error.message : 'Failed to load user') : null

  const value = useMemo<UserContextValue>(
    () => ({
      user: user ?? null,
      loading: isLoading,
      error: errorStr,
      refresh,
      setUser,
    }),
    [user, isLoading, errorStr, refresh, setUser]
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
