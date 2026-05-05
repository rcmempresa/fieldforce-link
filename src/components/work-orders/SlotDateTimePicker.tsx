import { useEffect, useState } from "react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  WORK_ORDER_SLOTS,
  SlotHour,
  getSlot,
  getSlotLabel,
  getLisbonDateKey,
  getScheduledWorkOrders,
  ScheduledWorkOrder,
} from "@/lib/employeeAvailability";

interface SlotDateTimePickerProps {
  /** Valor atual no formato `YYYY-MM-DDTHH:00` (datetime-local) ou string vazia */
  value: string;
  /** Devolve a nova string `YYYY-MM-DDTHH:00` (ou "" se incompleto) */
  onChange: (value: string) => void;
  /** Excluir uma OT da lista do dia (ex: a própria OT a ser editada/aprovada) */
  excludeWorkOrderId?: string;
  /** Texto do label (default: "Data Agendada") */
  label?: string;
  /** Mostrar slots inline mesmo sem data escolhida? */
  compact?: boolean;
}

/** Decompõe string `YYYY-MM-DDTHH:mm` em Date local + slot */
function parseValue(value: string): { date?: Date; slot?: SlotHour } {
  if (!value) return {};
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):/);
  if (!m) return {};
  const [, y, mo, d, h] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  const hour = Number(h);
  const slot = (WORK_ORDER_SLOTS as readonly number[]).includes(hour)
    ? (hour as SlotHour)
    : undefined;
  return { date, slot };
}

function buildValue(date: Date, slot: SlotHour): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(slot).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:00`;
}

export function SlotDateTimePicker({
  value,
  onChange,
  excludeWorkOrderId,
  label = "Data Agendada",
}: SlotDateTimePickerProps) {
  const initial = parseValue(value);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initial.date);
  const [selectedSlot, setSelectedSlot] = useState<SlotHour | "">(initial.slot ?? "");
  const [calendarMonth, setCalendarMonth] = useState<Date>(initial.date ?? new Date());
  const [monthOrders, setMonthOrders] = useState<ScheduledWorkOrder[]>([]);

  // Sincronizar quando `value` muda externamente
  useEffect(() => {
    const p = parseValue(value);
    setSelectedDate(p.date);
    setSelectedSlot(p.slot ?? "");
    if (p.date) setCalendarMonth(p.date);
  }, [value]);

  // Carregar OTs do mês visível
  useEffect(() => {
    const start = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const end = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() + 1,
      0,
      23,
      59,
      59
    );
    getScheduledWorkOrders(start, end).then((orders) => {
      setMonthOrders(
        excludeWorkOrderId ? orders.filter((o) => o.id !== excludeWorkOrderId) : orders
      );
    });
  }, [calendarMonth, excludeWorkOrderId]);

  // Propagar mudanças
  useEffect(() => {
    if (selectedDate && selectedSlot !== "") {
      onChange(buildValue(selectedDate, selectedSlot));
    } else {
      onChange("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedSlot]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !selectedDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selectedDate ? (
              format(selectedDate, "PPP", { locale: pt })
            ) : (
              <span>Escolher data</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            locale={pt}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
            modifiers={{
              hasOrders: monthOrders
                .map((o) => new Date(o.scheduled_date))
                .filter((d) => !isNaN(d.getTime())),
            }}
            modifiersClassNames={{
              hasOrders:
                "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
            }}
          />
        </PopoverContent>
      </Popover>

      {selectedDate && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Horário (slots de 2 horas)
          </Label>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {WORK_ORDER_SLOTS.map((slot) => {
              const dayKey = getLisbonDateKey(selectedDate);
              const slotOrders = monthOrders.filter((o) => {
                const d = new Date(o.scheduled_date);
                return getLisbonDateKey(d) === dayKey && getSlot(d) === slot;
              });
              const count = slotOrders.length;
              const isSelected = selectedSlot === slot;
              return (
                <Button
                  key={slot}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedSlot(slot)}
                  className="flex flex-col h-auto py-2"
                >
                  <span className="font-medium">{getSlotLabel(slot)}</span>
                  <span className="text-[10px] opacity-75">
                    {count === 0 ? "livre" : `${count} OT${count > 1 ? "s" : ""}`}
                  </span>
                </Button>
              );
            })}
          </div>

          {(() => {
            const dayKey = getLisbonDateKey(selectedDate);
            const dayOrders = monthOrders
              .filter((o) => getLisbonDateKey(new Date(o.scheduled_date)) === dayKey)
              .sort(
                (a, b) =>
                  new Date(a.scheduled_date).getTime() -
                  new Date(b.scheduled_date).getTime()
              );
            if (dayOrders.length === 0) {
              return (
                <p className="text-xs text-muted-foreground italic">
                  Sem OTs agendadas neste dia.
                </p>
              );
            }
            return (
              <div className="border rounded-lg p-2 max-h-40 overflow-y-auto space-y-1 bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground px-1">
                  OTs já agendadas:
                </p>
                {dayOrders.map((o) => {
                  const d = new Date(o.scheduled_date);
                  const slot = getSlot(d);
                  return (
                    <div
                      key={o.id}
                      className="text-xs flex items-start gap-2 p-1.5 rounded hover:bg-background"
                    >
                      <Badge variant="outline" className="text-[10px] py-0 h-5 shrink-0">
                        {getSlotLabel(slot)}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {o.reference} · {o.title}
                        </div>
                        <div className="text-muted-foreground truncate">
                          {o.client_name || "—"}
                          {o.assignees.length > 0 && (
                            <> · {o.assignees.map((a) => a.name).join(", ")}</>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}