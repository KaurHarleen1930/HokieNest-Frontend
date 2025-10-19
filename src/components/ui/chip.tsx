import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const chipVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-surface-2 text-foreground hover:bg-surface-3",
        accent: "bg-accent/20 text-accent hover:bg-accent/30",
        success: "bg-success/20 text-success hover:bg-success/30",
        warning: "bg-warning/20 text-warning hover:bg-warning/30",
        muted: "bg-muted/10 text-muted hover:bg-muted/20",
      },
      size: {
        sm: "px-2 py-0.5 text-xs",
        default: "px-3 py-1 text-sm",
        lg: "px-4 py-1.5 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ChipProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof chipVariants> {
  onRemove?: () => void;
  removable?: boolean;
}

function Chip({ className, variant, size, onRemove, removable, children, ...props }: ChipProps) {
  return (
    <div className={cn(chipVariants({ variant, size }), className)} {...props}>
      {children}
      {removable && onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 rounded-full p-0.5 hover:bg-black/10 transition-colors"
          aria-label="Remove"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

export { Chip, chipVariants }