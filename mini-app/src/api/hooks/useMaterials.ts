import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMaterials, createMaterial, uploadMaterial, deleteMaterial } from '../client'
import type { MaterialCreate } from '../../shared/types'

export function useMaterials(subjectId?: number, lessonId?: number) {
  return useQuery({
    queryKey: ['materials', { subjectId, lessonId }],
    queryFn: () => getMaterials(subjectId, lessonId),
    enabled: subjectId !== undefined || lessonId !== undefined,
  })
}

export function useCreateMaterial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: MaterialCreate) => createMaterial(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['materials'] })
    },
  })
}

export function useUploadMaterial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, title, subjectId, lessonId }: {
      file: File; title: string; subjectId?: number; lessonId?: number
    }) => uploadMaterial(file, title, subjectId, lessonId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['materials'] })
    },
  })
}

export function useDeleteMaterial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteMaterial(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['materials'] })
    },
  })
}
