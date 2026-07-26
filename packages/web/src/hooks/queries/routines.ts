import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateRoutineInput, RoutineDto, UpdateRoutineInput } from '@gloo/shared';

import { apiClient } from '@/lib/apiClient';

export const routineKeys = {
  all: ['routines'] as const,
  list: (assigneeId?: string) => ['routines', 'list', assigneeId] as const,
};

export function useRoutines(assigneeId?: string) {
  return useQuery({
    queryKey: routineKeys.list(assigneeId),
    queryFn: () =>
      apiClient.get<RoutineDto[]>(`/routines${assigneeId ? `?assigneeId=${assigneeId}` : ''}`),
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

export function useDeleteRoutine() {
  const invalidate = useInvalidateRoutines();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/routines/${id}`),
    onSuccess: invalidate,
  });
}
