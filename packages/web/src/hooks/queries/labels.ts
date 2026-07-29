import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { LabelDto, LabelInput } from '@gloo/shared';

import { apiClient } from '@/lib/apiClient';

export const labelKeys = {
  all: ['labels'] as const,
};

export function useLabels() {
  return useQuery({
    queryKey: labelKeys.all,
    queryFn: () => apiClient.get<LabelDto[]>('/labels'),
  });
}

/**
 * Labels are shared, so any change to one can appear on any routine — every
 * mutation invalidates routines as well as the label list itself.
 */
function useInvalidateLabels() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: labelKeys.all });
    queryClient.invalidateQueries({ queryKey: ['routines'] });
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
    mutationFn: ({ id, ...input }: { id: string } & Partial<LabelInput>) =>
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
