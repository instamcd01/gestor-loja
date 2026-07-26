import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-black/10 bg-[var(--surface)] px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-black/30 focus:border-[var(--brand-primary)] dark:border-white/10 dark:placeholder:text-white/30",
        className,
      )}
      {...props}
    />
  );
}
