import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SlotDateTimePicker } from "@/components/work-orders/SlotDateTimePicker";
import { supabase } from "@/integrations/supabase/client";

/** Converte o valor do picker (hora local) em ISO, ou null. */
export const scheduleToIso = (v: string) => (v ? new Date(v).toISOString() : null);

export function ContractScheduleFields({
  value, onChange, technician, onTechnicianChange, label = "Data e hora da intervenção",
}: {
  value: string; onChange: (v: string) => void;
  technician: string; onTechnicianChange: (v: string) => void; label?: string;
}) {
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "employee").eq("approved", true);
      const ids = (roles || []).map((r) => r.user_id);
      if (!ids.length) return;
      const { data } = await supabase.from("profiles").select("id, name").in("id", ids);
      setEmployees((data || []).sort((a, b) => a.name.localeCompare(b.name)));
    })();
  }, []);
  return (
    <div className="space-y-3">
      <SlotDateTimePicker value={value} onChange={onChange} label={label} />
      <div className="space-y-1">
        <Label>Técnico (opcional)</Label>
        <Select value={technician || "none"} onValueChange={(v) => onTechnicianChange(v === "none" ? "" : v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem técnico por agora</SelectItem>
            {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
