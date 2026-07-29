import { useMutation } from '@tanstack/react-query';

import type { UploadedFileDto } from '@gloo/shared';

import { ApiError, API_BASE } from '@/lib/apiClient';

/**
 * Uploads a file and returns its URL, without attaching it to anything — which
 * is what lets an attachment be added to a routine that hasn't been saved yet.
 *
 * Not via apiClient: FormData must set its own multipart boundary, so the JSON
 * content-type that wrapper applies would corrupt the request.
 */
export function useUploadFile() {
  return useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append('file', file);

      const response = await fetch(`${API_BASE}/uploads`, {
        method: 'POST',
        credentials: 'include',
        body,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ApiError(response.status, error.error ?? 'Falha ao enviar arquivo');
      }

      return (await response.json()) as UploadedFileDto;
    },
  });
}
