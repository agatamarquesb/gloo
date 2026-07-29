import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import type { LoginInput, UserDto } from '@gloo/shared';

import { ApiError, apiClient, API_BASE } from '@/lib/apiClient';

export const authKeys = {
  me: ['auth', 'me'] as const,
};

/**
 * Publishes an updated profile everywhere it is cached. Name and avatar are
 * embedded in task/routine payloads and in the assignee pickers, so refreshing
 * only `auth/me` would leave the old values on screen until those refetch.
 */
function syncUserCaches(queryClient: QueryClient, user: UserDto) {
  queryClient.setQueryData(authKeys.me, user);
  queryClient.invalidateQueries({ queryKey: ['tasks'] });
  queryClient.invalidateQueries({ queryKey: ['routines'] });
  queryClient.invalidateQueries({ queryKey: ['users'] });
}

export function useMe() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: () => apiClient.get<UserDto>('/auth/me'),
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => apiClient.post<UserDto>('/auth/login', input),
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me, user);
    },
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append('file', file);
      // Not via apiClient: FormData must set its own multipart boundary, so the
      // JSON content-type that wrapper applies would corrupt the request.
      const response = await fetch(`${API_BASE}/users/me/avatar`, {
        method: 'POST',
        credentials: 'include',
        body,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ApiError(response.status, error.error ?? 'Falha ao enviar imagem');
      }
      return (await response.json()) as UserDto;
    },
    onSuccess: (user) => syncUserCaches(queryClient, user),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; jobTitle: string | null }) =>
      apiClient.patch<UserDto>('/users/me', input),
    onSuccess: (user) => syncUserCaches(queryClient, user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post('/auth/logout'),
    onSuccess: () => {
      queryClient.setQueryData(authKeys.me, null);
      queryClient.clear();
    },
  });
}
