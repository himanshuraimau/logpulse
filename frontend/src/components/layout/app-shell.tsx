import type { PropsWithChildren } from "react"
import { Link, useLocation } from "react-router-dom"

import { Button } from "@/components/ui/button"

const navItems = [
  { label: "Live Logs", path: "/live-logs" },
  { label: "Anomaly Timeline", path: "/anomalies" },
  { label: "Metrics", path: "/metrics" },
  { label: "Batch", path: "/batch" },
  { label: "Agent", path: "/agent" },
]

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation()

  return (
    <div className="min-h-svh bg-[radial-gradient(circle_at_top_left,hsl(var(--muted))_0,transparent_48%),radial-gradient(circle_at_80%_20%,hsl(var(--accent))_0,transparent_38%)] px-4 py-5 md:px-8 md:py-7">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <header className="border-border/70 bg-card/85 flex flex-wrap items-center justify-between gap-3 border px-4 py-3 backdrop-blur-sm">
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              LogPulse / Phase 1
            </p>
            <h1 className="text-lg font-semibold tracking-wide">Streaming Console</h1>
          </div>
          <nav className="flex flex-wrap gap-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Button
                  key={item.path}
                  asChild
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                >
                  <Link to={item.path}>{item.label}</Link>
                </Button>
              )
            })}
          </nav>
        </header>
        <main>{children}</main>
      </div>
    </div>
  )
}
