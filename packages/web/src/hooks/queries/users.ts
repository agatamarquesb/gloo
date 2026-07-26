import { useQuery } from '@tanstack/react-query';

import type { UserDto } from '@gloo/shared';

import { apiClient } from '@/lib/apiClient';
import { userKeys } from '@/lib/queryKeys';

export function useUsers() {
  return useQuery({
    queryKey: userKeys.all,
    queryFn: () => apiClient.get<UserDto[]>('/users'),
  });
}
