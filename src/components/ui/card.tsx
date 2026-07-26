import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-black/5 bg-[var(--surface)] shadow-[var(--shadow-card)] dark:border-white/10",
        className,
      )}
      {...props}
    />
  );
}
