import { useEffect, useMemo, useState } from "react"

import type { LogEvent } from "@/api/logs"
import { config } from "@/lib/config"

type SocketState = "idle" | "connecting" | "open" | "closed" | "error"

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

  const websocketUrl = useMemo(() => {
    return `${config.wsBaseUrl}/ws/anomalies`
  }, [])

  useEffect(() => {
    setState("connecting")
    const socket = new WebSocket(websocketUrl)

    socket.onopen = () => setState("open")
    socket.onmessage = (messageEvent) => {
      const parsedMessage = parseAnomalyMessage(messageEvent.data)
      if (!parsedMessage) {
        return
      }

      setLastSequence(parsedMessage.sequence)
      setEvents((currentEvents) => {
        const deduped = [
          parsedMessage.data,
          ...currentEvents.filter((event) => event.event_id !== parsedMessage.data.event_id),
        ]
        return deduped.slice(0, maxEvents)
      })
    }
    socket.onerror = () => setState("error")
    socket.onclose = () => setState("closed")

    return () => {
      socket.close()
    }
  }, [maxEvents, websocketUrl])

  return {
    state,
    websocketUrl,
    events,
    lastSequence,
  }
}
