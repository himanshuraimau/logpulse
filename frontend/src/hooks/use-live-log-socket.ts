import { useEffect, useMemo, useState } from "react"

import type { LiveMetrics, LogEvent } from "@/api/logs"
import { config } from "@/lib/config"

type SocketState = "idle" | "connecting" | "open" | "closed" | "error"

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

  const websocketUrl = useMemo(() => {
    return `${config.wsBaseUrl}/ws/logs`
  }, [])

  const metricsWebsocketUrl = useMemo(() => {
    return `${config.wsBaseUrl}/ws/metrics`
  }, [])

  useEffect(() => {
    setState("connecting")
    const socket = new WebSocket(websocketUrl)

    socket.onopen = () => setState("open")
    socket.onmessage = (messageEvent) => {
      const message = parseSocketMessage(messageEvent.data)
      if (!message) {
        return
      }

      if (message.type === "log") {
        setLastSequence(message.sequence)
        setEvents((currentEvents) => {
          const deduped = [
            message.data,
            ...currentEvents.filter((event) => event.event_id !== message.data.event_id),
          ]
          return deduped.slice(0, 150)
        })
        return
      }

    }
    socket.onerror = () => setState("error")
    socket.onclose = () => setState("closed")

    return () => {
      socket.close()
    }
  }, [websocketUrl])

  useEffect(() => {
    setMetricsState("connecting")
    const socket = new WebSocket(metricsWebsocketUrl)

    socket.onopen = () => setMetricsState("open")
    socket.onmessage = (messageEvent) => {
      const message = parseSocketMessage(messageEvent.data)
      if (!message || message.type !== "metrics") {
        return
      }

      setMetrics(message.data)
    }
    socket.onerror = () => setMetricsState("error")
    socket.onclose = () => setMetricsState("closed")

    return () => {
      socket.close()
    }
  }, [metricsWebsocketUrl])

  return {
    state,
    metricsState,
    websocketUrl,
    metricsWebsocketUrl,
    events,
    metrics,
    lastSequence,
  }
}
