import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMaterials, createMaterial, uploadMaterial, deleteMaterial } from '../client'
import type { MaterialCreate } from '../../shared/types'

export function useMaterials(subjectId?: number, lessonId?: number) {
  return useQuery({
    queryKey: ['materials', { subjectId, lessonId }],
    queryFn: () => getMaterials(subjectId, lessonId),
    enabled: (subjectId !== undefined && subjectId !== 0) || (lessonId !== undefined && lessonId !== 0),
    staleTime: 10_000, // 10s — materials change often
  })
}

function invalidateAllMaterialQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['materials'] })
  qc.invalidateQueries({ queryKey: ['lesson'] })
  qc.invalidateQueries({ queryKey: ['course'] })
}

export function useCreateMaterial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: MaterialCreate) => createMaterial(data),
    onSuccess: () => invalidateAllMaterialQueries(qc),
  })
}

export function useUploadMaterial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, title, subjectId, lessonId }: {
      file: File; title: string; subjectId?: number; lessonId?: number
    }) => uploadMaterial(file, title, subjectId, lessonId),
    onSuccess: () => invalidateAllMaterialQueries(qc),
  })
}

export function useDeleteMaterial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteMaterial(id),
    onSuccess: () => invalidateAllMaterialQueries(qc),
  })
}
