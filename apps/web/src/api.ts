export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Appelé quand l'API répond 401 : session expirée ou révoquée. */
let onUnauthorized: (() => void) | undefined
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

export const isUnauthorized = (error: unknown) => error instanceof ApiError && error.status === 401

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  // Session expirée en cours d'utilisation : retour à la page de connexion.
  if (res.status === 401 && path !== '/auth/me') onUnauthorized?.()
  if (!res.ok) {
    // NestJS renvoie { message: string | string[] }
    let message = `${res.status} ${res.statusText}`
    try {
      const data = (await res.json()) as { message?: string | string[] }
      if (data.message) {
        message = Array.isArray(data.message) ? data.message.join('\n') : data.message
      }
    } catch {
      // corps non JSON : on garde le statut
    }
    throw new ApiError(res.status, message)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  put: <T = void>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
}
