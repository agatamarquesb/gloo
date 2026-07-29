import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateRoutineInput, RoutineDto, UpdateRoutineInput } from '@gloo/shared';

import { apiClient } from '@/lib/apiClient';

export const routineKeys = {
  all: ['routines'] as const,
  list: (assigneeId?: string) => ['routines', 'list', assigneeId] as const,
  deleted: () => ['routines', 'deleted'] as const,
};

export function useRoutines(assigneeId?: string) {
  return useQuery({
    queryKey: routineKeys.list(assigneeId),
    queryFn: () =>
      apiClient.get<RoutineDto[]>(`/routines${assigneeId ? `?assigneeId=${assigneeId}` : ''}`),
  });
}

/**
 * The trash. Its key sits under routineKeys.all, so deleting or restoring a
 * routine invalidates the live list and the bin together — the two always
 * disagree about exactly the routine that just moved between them.
 *
 * Nothing fetches this until the panel that uses it is mounted, which is what
 * keeps it off the Dashboard's initial load.
 */
export function useDeletedRoutines() {
  return useQuery({
    queryKey: routineKeys.deleted(),
    queryFn: () => apiClient.get<RoutineDto[]>('/routines/deleted'),
  });
}

function useInvalidateRoutines() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: routineKeys.all });
}

export function useCreateRoutine() {
  const invalidate = useInvalidateRoutines();
  return useMutation({
    mutationFn: (input: CreateRoutineInput) => apiClient.post<RoutineDto>('/routines', input),
    onSuccess: invalidate,
  });
}

export function useUpdateRoutine() {
  const invalidate = useInvalidateRoutines();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateRoutineInput) =>
      apiClient.patch<RoutineDto>(`/routines/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useToggleRoutine() {
  const invalidate = useInvalidateRoutines();
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      apiClient.patch<RoutineDto>(`/routines/${id}/toggle`, { done }),
    onSuccess: invalidate,
  });
}

/** Moves a routine to the trash; `useRestoreRoutine` is the way back. */
export function useDeleteRoutine() {
  const invalidate = useInvalidateRoutines();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/routines/${id}`),
    onSuccess: invalidate,
  });
}

/** Destroys a single routine outright. Only reachable from the trash. */
export function useDeleteRoutinePermanently() {
  const invalidate = useInvalidateRoutines();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/routines/${id}/permanent`),
    onSuccess: invalidate,
  });
}

export function useRestoreRoutine() {
  const invalidate = useInvalidateRoutines();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<RoutineDto>(`/routines/${id}/restore`, {}),
    onSuccess: invalidate,
  });
}

/**
 * Destroys what the caller has the right to destroy: everything in the trash, or
 * just the routines named.
 */
export function useEmptyRoutineTrash() {
  const invalidate = useInvalidateRoutines();
  return useMutation({
    mutationFn: (ids?: string[]) =>
      apiClient.delete('/routines/deleted', ids ? { ids } : undefined),
    onSuccess: invalidate,
  });
}
