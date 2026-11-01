import { Clock } from "lucide-react";
import { daysOpen, daysOpenLabel, isOpenStatus } from "@/lib/daysOpenWorkOrder";
import { formatDate } from "@/lib/formatDate";
import { cn } from "@/lib/utils";

interface DaysOpenBadgeProps {
  createdAt: string | null | undefined;
  status: string | null | undefined;
  size?: "sm" | "lg";
  className?: string;
}

/**
 * Visible "Há X dias" badge for open work orders.
 * Grey outline under 7 days, solid amber from 7, solid red from 14.
 * Renders nothing for completed/cancelled/invoiced orders.
 */
export function DaysOpenBadge({ createdAt, status, size = "sm", className }: DaysOpenBadgeProps) {
  if (!isOpenStatus(status) || !createdAt) return null;
  const days = daysOpen(createdAt);

  const color =
    days >= 14
      ? "bg-destructive text-destructive-foreground border-destructive shadow-sm"
      : days >= 7
        ? "bg-amber-500 text-white border-amber-600 shadow-sm"
        : "bg-background text-muted-foreground border-border";

  return (
    <span
      title={`Criada em ${formatDate(createdAt)}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-bold whitespace-nowrap",
        size === "lg" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs",
        color,
        className
      )}
    >
      <Clock className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} />
      {daysOpenLabel(createdAt)}
    </span>
  );
}
