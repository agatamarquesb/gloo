import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { LabelScope, type LabelDto, type LabelInput } from '@gloo/shared';

import { apiClient } from '@/lib/apiClient';
import { taskKeys } from '@/lib/queryKeys';

export const labelKeys = {
  all: ['labels'] as const,
  /**
   * Routines and tasks keep separate pools (see `scope` on the Label model), so
   * they are separate queries too — a tag created on one side must not appear in
   * the other's list, not even for the moment before a refetch.
   */
  scope: (scope: LabelScope) => ['labels', scope] as const,
};

export function useLabels(scope: LabelScope = LabelScope.ROUTINE) {
  return useQuery({
    queryKey: labelKeys.scope(scope),
    queryFn: () => apiClient.get<LabelDto[]>(`/labels?scope=${scope}`),
  });
}

/**
 * A label is shared by everything in its pool wearing it, so any change to one
 * can appear on any routine or task — every mutation invalidates both of those
 * lists as well as the label lists themselves.
 */
function useInvalidateLabels() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: labelKeys.all });
    queryClient.invalidateQueries({ queryKey: ['routines'] });
    queryClient.invalidateQueries({ queryKey: taskKeys.all });
  };
}

export function useCreateLabel() {
  const invalidate = useInvalidateLabels();
  return useMutation({
    mutationFn: (input: LabelInput) => apiClient.post<LabelDto>('/labels', input),
    onSuccess: invalidate,
  });
}

export function useUpdateLabel() {
  const invalidate = useInvalidateLabels();
  return useMutation({
    // Deliberately not `scope`: which pool a label belongs to is decided when it
    // is created and never afterwards. Moving one would take it off everything
    // on this side and give it to nothing on the other.
    mutationFn: ({ id, ...input }: { id: string } & Partial<Omit<LabelInput, 'scope'>>) =>
      apiClient.patch<LabelDto>(`/labels/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteLabel() {
  const invalidate = useInvalidateLabels();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/labels/${id}`),
    onSuccess: invalidate,
  });
}
