import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-black/5 bg-[var(--surface)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-white/10",
        className,
      )}
      {...props}
    />
  );
}
