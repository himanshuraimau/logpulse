import { useEffect, useMemo, useRef, useState } from "react"

import type { LiveMetrics, LogEvent } from "@/api/logs"
import { config } from "@/lib/config"
import { getLogEventKey } from "@/lib/log-event"

type SocketState = "idle" | "connecting" | "reconnecting" | "open" | "closed" | "error"

type LogSocketMessage = {
  type: "log"
  sequence: number
  data: LogEvent
}

type MetricsSocketMessage = {
  type: "metrics"
  data: LiveMetrics
}

type SocketMessage = LogSocketMessage | MetricsSocketMessage

function parseSocketMessage(rawMessage: string): SocketMessage | null {
  try {
    const parsed = JSON.parse(rawMessage) as SocketMessage

    if (parsed?.type === "log" && typeof parsed.sequence === "number" && parsed.data) {
      return parsed
    }

    if (parsed?.type === "metrics" && parsed.data) {
      return parsed
    }

    return null
  } catch {
    return null
  }
}

export function useLiveLogSocket() {
  const [state, setState] = useState<SocketState>("idle")
  const [metricsState, setMetricsState] = useState<SocketState>("idle")
  const [events, setEvents] = useState<LogEvent[]>([])
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null)
  const [lastSequence, setLastSequence] = useState(0)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const [metricsReconnectAttempts, setMetricsReconnectAttempts] = useState(0)
  const lastSequenceRef = useRef(0)

  const websocketBaseUrl = useMemo(() => {
    return `${config.wsBaseUrl}/ws/logs`
  }, [])

  const metricsWebsocketUrl = useMemo(() => {
    return `${config.wsBaseUrl}/ws/metrics`
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

      const nextUrl = `${websocketBaseUrl}?last_sequence=${lastSequenceRef.current}`
      setState(attempt > 0 ? "reconnecting" : "connecting")

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
        const message = parseSocketMessage(messageEvent.data)
        if (!message || message.type !== "log") {
          return
        }

        setLastSequence(message.sequence)
        setEvents((currentEvents) => {
          const incomingKey = getLogEventKey(message.data)
          const deduped = [
            message.data,
            ...currentEvents.filter((event) => getLogEventKey(event) !== incomingKey),
          ]
          return deduped.slice(0, 150)
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
  }, [websocketBaseUrl])

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
      setMetricsReconnectAttempts(attempt)
      const delay = Math.min(1000 * 2 ** (attempt - 1), 10000)
      setMetricsState("reconnecting")
      reconnectTimer = window.setTimeout(connect, delay)
    }

    const connect = () => {
      clearReconnectTimer()
      setMetricsState(attempt > 0 ? "reconnecting" : "connecting")

      socket = new WebSocket(metricsWebsocketUrl)

      socket.onopen = () => {
        if (disposed) {
          return
        }

        attempt = 0
        setMetricsReconnectAttempts(0)
        setMetricsState("open")
      }

      socket.onmessage = (messageEvent) => {
        const message = parseSocketMessage(messageEvent.data)
        if (!message || message.type !== "metrics") {
          return
        }

        setMetrics(message.data)
      }

      socket.onerror = () => {
        if (disposed) {
          return
        }

        setMetricsState("error")
      }

      socket.onclose = () => {
        if (disposed) {
          return
        }

        setMetricsState("closed")
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
  }, [metricsWebsocketUrl])

  return {
    state,
    metricsState,
    websocketUrl: websocketBaseUrl,
    metricsWebsocketUrl,
    events,
    metrics,
    lastSequence,
    reconnectAttempts,
    metricsReconnectAttempts,
  }
}
