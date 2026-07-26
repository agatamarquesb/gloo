import { useQuery } from '@tanstack/react-query';

import type { SectorDto } from '@gloo/shared';

import { apiClient } from '@/lib/apiClient';
import { sectorKeys } from '@/lib/queryKeys';

export function useSectors() {
  return useQuery({
    queryKey: sectorKeys.all,
    queryFn: () => apiClient.get<SectorDto[]>('/sectors'),
  });
}
