import { useEffect, useMemo, useRef, useState } from "react"

import type { LogEvent } from "@/api/logs"
import { config } from "@/lib/config"
import { getLogEventKey } from "@/lib/log-event"

type SocketState = "idle" | "connecting" | "reconnecting" | "open" | "closed" | "error"

type AnomalySocketMessage = {
  type: "anomaly"
  sequence: number
  data: LogEvent
}

function parseAnomalyMessage(rawMessage: string): AnomalySocketMessage | null {
  try {
    const parsed = JSON.parse(rawMessage) as AnomalySocketMessage
    if (parsed?.type === "anomaly" && typeof parsed.sequence === "number" && parsed.data) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function useAnomalySocket(maxEvents = 180) {
  const [state, setState] = useState<SocketState>("idle")
  const [events, setEvents] = useState<LogEvent[]>([])
  const [lastSequence, setLastSequence] = useState(0)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const lastSequenceRef = useRef(0)

  const websocketBaseUrl = useMemo(() => {
    return `${config.wsBaseUrl}/ws/anomalies`
  }, [])

  useEffect(() => {
    lastSequenceRef.current = lastSequence
  }, [lastSequence])

  useEffect(() => {
    let socket: WebSocket | null = null
    let reconnectTimer: number | null = null
    let attempt = 0
    let disposed = false

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }

    const scheduleReconnect = () => {
      if (disposed) {
        return
      }

      attempt += 1
      setReconnectAttempts(attempt)
      const delay = Math.min(1000 * 2 ** (attempt - 1), 10000)
      setState("reconnecting")
      reconnectTimer = window.setTimeout(connect, delay)
    }

    const connect = () => {
      clearReconnectTimer()
      setState(attempt > 0 ? "reconnecting" : "connecting")

      const nextUrl = `${websocketBaseUrl}?last_sequence=${lastSequenceRef.current}`
      socket = new WebSocket(nextUrl)

      socket.onopen = () => {
        if (disposed) {
          return
        }

        attempt = 0
        setReconnectAttempts(0)
        setState("open")
      }

      socket.onmessage = (messageEvent) => {
        const parsedMessage = parseAnomalyMessage(messageEvent.data)
        if (!parsedMessage) {
          return
        }

        setLastSequence(parsedMessage.sequence)
        setEvents((currentEvents) => {
          const incomingKey = getLogEventKey(parsedMessage.data)
          const deduped = [
            parsedMessage.data,
            ...currentEvents.filter((event) => getLogEventKey(event) !== incomingKey),
          ]
          return deduped.slice(0, maxEvents)
        })
      }

      socket.onerror = () => {
        if (disposed) {
          return
        }

        setState("error")
      }

      socket.onclose = () => {
        if (disposed) {
          return
        }

        setState("closed")
        scheduleReconnect()
      }
    }

    connect()

    return () => {
      disposed = true
      clearReconnectTimer()
      if (socket) {
        socket.close()
      }
    }
  }, [maxEvents, websocketBaseUrl])

  return {
    state,
    websocketUrl: websocketBaseUrl,
    events,
    lastSequence,
    reconnectAttempts,
  }
}
