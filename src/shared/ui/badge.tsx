import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/cn";

export function Badge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200 ring-inset",
        className,
      )}
      {...props}
    />
  );
}
