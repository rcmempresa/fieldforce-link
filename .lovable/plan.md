# Corrigir disponibilidade de slots no calendário

## Problema

No seletor de data/hora das OTs (`SlotDateTimePicker`) há slots que mostram **"livre"** mesmo existindo OTs marcadas com técnicos atribuídos para essa hora.

A causa está em `src/lib/employeeAvailability.ts`, função `getSlot()`. Os slots fixos são `09, 11, 14, 16, 19, 21, 23` e a função só atribui uma OT a um slot se `hora ∈ [slot, slot+2)`. Resultado: qualquer OT marcada numa hora que **caia num intervalo não coberto** fica invisível na contagem dos slots e o slot aparece como "livre".

Verificado na base de dados — existem várias OTs nessa situação:

| Ref | Hora Lisboa | Técnicos | Status |
|---|---|---|---|
| WO-2026-0247 | 00:00 | 2 | pending |
| WO-2026-0211 | 13:00 | 2 | completed |
| WO-2026-0194 | 18:00 | 2 | completed |
| WO-2026-0177 | 18:00 | 1 | completed |
| WO-2025-0031 | 18:00 | 2 | completed |
| WO-2025-0006 | 18:00 | 1 | completed |

A hora `13:00` cai entre slots 11 (11–13) e 14 (14–16); a hora `18:00` cai entre 16 (16–18) e 19 (19–21); horas `00/03` ficam fora de tudo. Para todas estas, `getSlot()` devolve `null` e a OT desaparece da contagem do slot.

No Dashboard do Gestor (`ManagerDashboard.tsx`) o calendário grande não tem este problema directamente (marca o dia se existir qualquer OT), mas os indicadores de carga partilhados sofrem do mesmo defeito quando dependerem de `getSlot`.

## Correção

Alterar `getSlot()` para **snap ao slot mais próximo anterior** em vez de devolver `null`:

- Para uma hora `h`, escolher o maior `slot ∈ WORK_ORDER_SLOTS` tal que `slot ≤ h`.
- Se `h` for inferior ao primeiro slot (ex.: 03:00), atribuir ao primeiro slot do dia (`09`).
- Manter `getSlotLabel` inalterado.

Assim:
- 13:00 → slot 11 (mostra "1 OT" em vez de "livre")
- 18:00 → slot 16
- 00:00 / 03:00 → slot 09 (do mesmo dia em Lisboa)

Isto garante que toda OT com `scheduled_date` é visível em algum slot e a contagem reflecte a realidade.

## Verificação adicional

- Confirmar que `getBusyEmployees()` continua coerente: passa a bloquear o slot vizinho quando há overbooking em horas "fora da grelha", o que é o comportamento desejado (impede dois técnicos para o mesmo dia/janela próxima).
- Revisar a lista "OTs já agendadas" no `SlotDateTimePicker` (linhas 201–220): já mostra todas as OTs do dia independentemente do slot, portanto não precisa de mudança.
- O calendário do `ManagerDashboard` (e equivalentes em `Employees.tsx` / `Clients.tsx`) só usa `isSameDay`, não `getSlot`, portanto não precisa de alteração funcional. Mantém-se.

## Ficheiros a alterar

- `src/lib/employeeAvailability.ts` — reescrever `getSlot()` para snap ao slot anterior mais próximo.

## Notas técnicas

```ts
export function getSlot(date: Date): SlotHour {
  const h = getLisbonHour(date);
  let chosen: SlotHour = WORK_ORDER_SLOTS[0];
  for (const s of WORK_ORDER_SLOTS) {
    if (s <= h) chosen = s;
  }
  return chosen;
}
```

Tipo de retorno passa de `SlotHour | null` para `SlotHour`. Atualizar os usos:
- `SlotDateTimePicker.tsx` linha 158, 203, 210 — remover branch `slot !== null`.
- `employeeAvailability.ts` `getBusyEmployees` linha do `if (targetSlot === null) return [];` — remover.
