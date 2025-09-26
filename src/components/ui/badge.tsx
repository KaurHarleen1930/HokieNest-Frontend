import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-sm px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary: "border-transparent bg-surface-2 text-foreground hover:bg-surface-3",
        accent: "border-transparent bg-accent text-accent-foreground hover:bg-accent/80",
        destructive: "border-transparent bg-error text-primary-foreground hover:bg-error/80",
        outline: "text-foreground border border-surface-3",
        success: "border-transparent bg-success text-primary-foreground hover:bg-success/80",
        warning: "border-transparent bg-warning text-primary-foreground hover:bg-warning/80",
        muted: "border-transparent bg-muted/20 text-muted hover:bg-muted/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }