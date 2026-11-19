import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './api.ts'
import type { Company, CompanyInput } from './types.ts'

export function useCompanyMutations() {
  const qc = useQueryClient()
  // Le nom d'une entreprise s'affiche sur les contacts et les pistes.
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['companies'] })
    void qc.invalidateQueries({ queryKey: ['contacts'] })
    void qc.invalidateQueries({ queryKey: ['opportunity'] })
    void qc.invalidateQueries({ queryKey: ['opportunities'] })
  }
  return {
    create: useMutation({
      mutationFn: (body: CompanyInput) => api.post<Company>('/companies', body),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: Partial<CompanyInput> & { id: number }) =>
        api.patch<Company>(`/companies/${id}`, body),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api.delete(`/companies/${id}`),
      onSuccess: refresh,
    }),
  }
}
