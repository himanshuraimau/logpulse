import { isApiError } from "@/api/client"

export function getErrorMessage(error: unknown, fallback = "Something went wrong") {
  if (isApiError(error)) {
    return error.message || fallback
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error
  }

  return fallback
}
