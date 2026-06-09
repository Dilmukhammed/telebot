import { useQuery } from '@tanstack/react-query'
import { getMyRegistrations, getMyResults } from '../client'

export function useMyRegistrations() {
  return useQuery({
    queryKey: ['registrations'],
    queryFn: getMyRegistrations,
    staleTime: 30_000,
  })
}

export function useMyResults() {
  return useQuery({
    queryKey: ['results'],
    queryFn: getMyResults,
    staleTime: 60_000,
  })
}
