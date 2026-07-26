import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

type Variant = "brand" | "secondary" | "success" | "neutral" | "outline";

const variants: Record<Variant, string> = {
  brand: "bg-[var(--brand-primary)] text-white",
  secondary: "bg-[var(--brand-secondary)] text-white",
  success: "bg-green-600 text-white dark:bg-green-500",
  neutral: "bg-black/80 text-white dark:bg-white/20",
  outline: "border border-black/10 text-black/60 dark:border-white/15 dark:text-white/60",
};

interface BadgeProps extends ComponentProps<"span"> {
  variant?: Variant;
}

export function Badge({ variant = "brand", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
