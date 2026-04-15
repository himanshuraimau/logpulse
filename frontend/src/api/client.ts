import { config } from "@/lib/config"

type RequestOptions = {
  method?: "GET" | "POST"
  body?: unknown
}

export class ApiError extends Error {
  status: number | null
  path: string
  detail: unknown
  rawDetail: string | null

  constructor(options: {
    message: string
    status: number | null
    path: string
    detail?: unknown
    rawDetail?: string | null
  }) {
    super(options.message)
    this.name = "ApiError"
    this.status = options.status
    this.path = options.path
    this.detail = options.detail ?? null
    this.rawDetail = options.rawDetail ?? null
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

function coerceErrorMessage(
  status: number,
  detail: unknown,
  fallbackText: string | null
) {
  if (typeof detail === "string" && detail.trim().length > 0) {
    return detail.trim()
  }

  if (detail && typeof detail === "object" && "detail" in detail) {
    const nestedDetail = (detail as { detail?: unknown }).detail
    if (typeof nestedDetail === "string" && nestedDetail.trim().length > 0) {
      return nestedDetail.trim()
    }
  }

  if (fallbackText && fallbackText.trim().length > 0) {
    return fallbackText.trim()
  }

  return `Request failed with ${status}`
}

async function parseErrorResponse(response: Response): Promise<{
  detail: unknown
  rawDetail: string | null
}> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""

  if (contentType.includes("application/json")) {
    try {
      const detail = await response.json()
      return {
        detail,
        rawDetail: JSON.stringify(detail),
      }
    } catch {
      return {
        detail: null,
        rawDetail: null,
      }
    }
  }

  try {
    const text = await response.text()
    return {
      detail: text || null,
      rawDetail: text || null,
    }
  } catch {
    return {
      detail: null,
      rawDetail: null,
    }
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
  } catch (error) {
    throw new ApiError({
      message: error instanceof Error ? error.message : "Network request failed",
      status: null,
      path,
      detail: null,
      rawDetail: null,
    })
  }

  if (!response.ok) {
    const parsed = await parseErrorResponse(response)
    throw new ApiError({
      message: coerceErrorMessage(response.status, parsed.detail, parsed.rawDetail),
      status: response.status,
      path,
      detail: parsed.detail,
      rawDetail: parsed.rawDetail,
    })
  }

  return (await response.json()) as T
}
