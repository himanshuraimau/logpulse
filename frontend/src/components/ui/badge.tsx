/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
  {
    variants: {
      variant: {
        default: "border-border bg-secondary text-secondary-foreground",
        success: "border-emerald-700/40 bg-emerald-800/12 text-emerald-700 dark:text-emerald-200",
        warning: "border-amber-700/40 bg-amber-700/12 text-amber-700 dark:text-amber-200",
        danger: "border-red-700/40 bg-red-800/12 text-red-700 dark:text-red-200",
        outline: "border-border text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
