import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type PageHeaderProps = {
  title: string
  description: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "rounded-xl border border-border/70 bg-card/85 p-4 shadow-sm shadow-black/5 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}
