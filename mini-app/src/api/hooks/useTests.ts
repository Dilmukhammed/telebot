import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTests, getTest, registerForTest, cancelRegistration } from '../client'

export function useTests() {
  return useQuery({
    queryKey: ['tests'],
    queryFn: getTests,
    staleTime: 60_000,
  })
}

export function useTest(id: number) {
  return useQuery({
    queryKey: ['test', id],
    queryFn: () => getTest(id),
    enabled: !!id,
  })
}

export function useRegisterForTest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => registerForTest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrations'] })
      queryClient.invalidateQueries({ queryKey: ['tests'] })
    },
  })
}

export function useCancelRegistration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => cancelRegistration(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrations'] })
    },
  })
}
