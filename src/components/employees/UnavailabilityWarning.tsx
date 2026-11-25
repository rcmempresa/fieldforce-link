import { AlertTriangle } from "lucide-react";
import { useUnavailabilities } from "@/hooks/useUnavailabilities";
import { findBlock, reasonInfo, toDay } from "@/lib/unavailability";

interface Props {
  scheduledDate: string;
  selectedIds: string[];
  employees: { id: string; name: string }[];
}

/** Yellow notice when a selected technician is blocked on the OT day. */
export function UnavailabilityWarning({ scheduledDate, selectedIds, employees }: Props) {
  const day = scheduledDate ? toDay(scheduledDate) : "";
  const { data } = useUnavailabilities(day || undefined);
  if (!day) return null;
  const hits = selectedIds
    .map((id) => ({ id, block: findBlock(data, id, day) }))
    .filter((h) => h.block);
  if (!hits.length) return null;
  return (
    <div className="space-y-1">
      {hits.map(({ id, block }) => {
        const name = employees.find((e) => e.id === id)?.name ?? "Técnico";
        return (
          <div key={id} className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
            <span>{reasonInfo(block!.reason).icon} {name} está {reasonInfo(block!.reason).phrase} nesse dia — tens a certeza?</span>
          </div>
        );
      })}
    </div>
  );
}
