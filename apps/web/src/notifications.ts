import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api.ts'
import type { Day, OpportunitySummary } from './types.ts'

export type NotificationType =
  | 'ACTION_OVERDUE'
  | 'ACTION_DUE_TODAY'
  | 'ACTION_UPCOMING'
  | 'STALE_OPPORTUNITY'

export type AppNotification = {
  id: number
  type: NotificationType
  message: string
  read: boolean
  opportunity: Pick<OpportunitySummary, 'id' | 'reference' | 'title' | 'stage' | 'company' | 'intermediary'>
  action: { id: number; label: string; dueDate: Day | null } | null
}

export type NotificationFeed = { unread: number; items: AppNotification[] }

export const NOTIFICATION_KEY = ['notifications']

export const useNotifications = () =>
  useQuery({
    queryKey: NOTIFICATION_KEY,
    queryFn: () => api.get<NotificationFeed>('/notifications'),
    // Recalcul périodique : les échéances changent avec le jour.
    refetchInterval: 5 * 60_000,
  })

export function useNotificationMutations() {
  const qc = useQueryClient()
  const setRead = (ids: number[] | 'all', read: boolean) =>
    qc.setQueryData<NotificationFeed>(NOTIFICATION_KEY, (feed) => {
      if (!feed) return feed
      const items = feed.items.map((n) =>
        ids === 'all' || ids.includes(n.id) ? { ...n, read } : n,
      )
      return { items, unread: items.filter((n) => !n.read).length }
    })

  return {
    markRead: useMutation({
      mutationFn: ({ id, read }: { id: number; read: boolean }) =>
        api.patch<void>(`/notifications/${id}`, { read }),
      onMutate: ({ id, read }) => setRead([id], read),
    }),
    markAllRead: useMutation({
      mutationFn: () => api.post<void>('/notifications/read-all', {}),
      onMutate: () => setRead('all', true),
    }),
    /** Marque l'action liée comme faite : l'alerte disparaît au recalcul. */
    completeAction: useMutation({
      mutationFn: (actionId: number) => api.patch<void>(`/actions/${actionId}`, { done: true }),
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ['opportunities'] })
        void qc.invalidateQueries({ queryKey: ['opportunity'] })
      },
    }),
  }
}
