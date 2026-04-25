---
name: Employee Availability Slots
description: Disponibilidade por 4 slots fixos de 2h (09,11,14,16) com 1 OT por funcionário por slot e calendário com OTs no diálogo
type: feature
---
- Slots fixos de 2h: 09:00, 11:00, 14:00, 16:00 (Europe/Lisbon).
- MAX_PER_SLOT = 1 OT por funcionário por slot. Acima -> AlertDialog de overbooking.
- Estados que ocupam: pending, approved, in_progress, awaiting_approval.
- CreateWorkOrderDialog usa Calendar+Popover com modificador `hasOrders` (ponto nos dias com OTs), 4 botões de slot com contagem, e lista das OTs do dia (ref, título, cliente, técnicos).
- Helpers em `src/lib/employeeAvailability.ts`: getSlot, getSlotLabel, WORK_ORDER_SLOTS, getScheduledWorkOrders, getLisbonDateKey.
