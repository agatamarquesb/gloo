export const API_BASE = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/api`;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const hasBody = body !== undefined;

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    // Only declare a JSON content-type (and a body) when we actually send
    // JSON: Fastify rejects a bodyless request that claims application/json
    // with a 400 (FST_ERR_CTP_EMPTY_JSON_BODY), which breaks DELETE and logout.
    ...(hasBody
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new ApiError(response.status, errorBody.error ?? errorBody.message ?? 'Erro inesperado');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, 'POST', body),
  patch: <T>(path: string, body?: unknown) => request<T>(path, 'PATCH', body),
  delete: <T>(path: string) => request<T>(path, 'DELETE'),
};
