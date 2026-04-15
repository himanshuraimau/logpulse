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
    <div className="min-h-svh bg-[radial-gradient(circle_at_5%_0%,hsl(var(--accent))_0,transparent_42%),radial-gradient(circle_at_95%_5%,hsl(var(--muted))_0,transparent_44%)] px-4 py-5 md:px-8 md:py-7">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <header className="relative overflow-hidden rounded-xl border border-border/70 bg-card/90 px-4 py-4 shadow-sm shadow-black/5 backdrop-blur-sm">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-60 bg-[radial-gradient(circle_at_top_right,hsl(var(--accent))_0,transparent_70%)]" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground">LogPulse</p>
              <h1 className="text-2xl font-semibold tracking-tight">Observability Workspace</h1>
              <p className="text-sm text-muted-foreground">
                Track live stream health, anomaly timelines, batch outcomes, and RCA reports.
              </p>
            </div>

            <nav className="flex flex-wrap gap-1.5 rounded-lg border border-border/70 bg-background/70 p-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <Button
                    key={item.path}
                    asChild
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                  >
                    <Link to={item.path}>{item.label}</Link>
                  </Button>
                )
              })}
            </nav>
          </div>
        </header>
        <main className="space-y-4">{children}</main>
      </div>
    </div>
  )
}
