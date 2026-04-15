import type { LogEvent } from "@/api/logs"

function normalizePart(value: unknown) {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value).trim()
}

export function getLogEventKey(event: LogEvent) {
  const explicitId = normalizePart(event.event_id)
  if (explicitId) {
    return explicitId
  }

  const parts = [
    normalizePart(event.timestamp),
    normalizePart(event.service),
    normalizePart(event.log_level),
    normalizePart(event.http?.status),
    normalizePart(event.network?.source_ip),
    normalizePart(event.message),
  ]

  const compact = parts.filter((part) => part.length > 0).join("|")
  if (compact.length > 0) {
    return compact
  }

  return "unknown-event"
}

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

export function formatEventTime(value: string | null | undefined) {
  const parsed = parseDate(value)
  if (!parsed) {
    return "-"
  }

  return parsed.toLocaleTimeString()
}

export function formatEventDateTime(value: string | null | undefined) {
  const parsed = parseDate(value)
  if (!parsed) {
    return "-"
  }

  return parsed.toLocaleString()
}
