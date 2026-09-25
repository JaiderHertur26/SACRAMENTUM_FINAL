import * as React from "react"
import { cn } from "@/lib/utils"

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex min-h-[90px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm transition placeholder:text-slate-400 focus-visible:border-[#4B7BA7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4B7BA7]/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70",
      className
    )}
    ref={ref}
    {...props}
  />
))
Textarea.displayName = "Textarea"

export { Textarea }
