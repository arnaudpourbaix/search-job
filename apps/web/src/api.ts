export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
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
  delete: (path: string) => request<void>('DELETE', path),
}

/** Compat : utilisé par le tableau de bord. */
export const apiGet = api.get
