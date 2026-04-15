const defaultApiBaseUrl = "http://localhost:8000/api/v1"

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl

function toWebsocketBaseUrl(apiUrl: string): string {
  return apiUrl
    .replace(/\/api\/v1\/?$/, "")
    .replace(/^http:/, "ws:")
    .replace(/^https:/, "wss:")
}

export const config = {
  apiBaseUrl,
  wsBaseUrl: import.meta.env.VITE_WS_BASE_URL ?? toWebsocketBaseUrl(apiBaseUrl),
}
