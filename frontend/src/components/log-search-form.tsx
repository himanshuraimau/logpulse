import { useState } from "react"

import type { SearchLogsParams } from "@/api/logs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"

type LogSearchFormProps = {
  onSearch: (params: SearchLogsParams) => void
  onClear: () => void
  isPending?: boolean
}

const levels = ["", "INFO", "WARN", "ERROR"] as const
const windows = [60, 240, 720, 1440]

export function LogSearchForm({ onSearch, onClear, isPending = false }: LogSearchFormProps) {
  const [query, setQuery] = useState("")
  const [service, setService] = useState("")
  const [level, setLevel] = useState("")
  const [sinceMinutes, setSinceMinutes] = useState(240)

  return (
    <div className="space-y-2 border border-border/70 p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Log Search</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Query
          <Input
            placeholder="Search message or service"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Service
          <Input
            placeholder="Service filter (optional)"
            value={service}
            onChange={(event) => setService(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Level
          <Select value={level} onChange={(event) => setLevel(event.target.value)}>
            {levels.map((item) => (
              <option key={item || "all"} value={item}>
                {item || "All levels"}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Time Window
          <Select
            value={String(sinceMinutes)}
            onChange={(event) => setSinceMinutes(Number(event.target.value))}
          >
            {windows.map((windowValue) => (
              <option key={windowValue} value={windowValue}>
                Last {windowValue} minutes
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() =>
            onSearch({
              q: query.trim() || undefined,
              service: service.trim() || undefined,
              level: level || undefined,
              sinceMinutes,
              limit: 140,
            })
          }
          disabled={isPending}
        >
          {isPending ? "Searching..." : "Search Logs"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setQuery("")
            setService("")
            setLevel("")
            setSinceMinutes(240)
            onClear()
          }}
        >
          Clear
        </Button>
      </div>
    </div>
  )
}
