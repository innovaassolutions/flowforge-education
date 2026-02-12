import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-[hsl(var(--accent-hover))]",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-muted",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground border-border",
        success:
          "border-[hsl(var(--success)/0.3)] bg-[hsl(var(--success-subtle))] text-[hsl(var(--success))]",
        warning:
          "border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning-subtle))] text-[hsl(var(--warning))]",
        info:
          "border-primary/30 bg-[hsl(var(--accent-subtle))] text-primary",
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
