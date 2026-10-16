# Corrigir horas em falta na OT 0678 (painel do gerente)

## O que se passa
As horas da WO-2026-0678 estão bem guardadas: 3 sessões, 8h no total (Duarte Catanho 6h e outro técnico 2h, todas laborais).
O problema está no painel do gerente: ele só lê os primeiros 1000 registos de horas e a app já tem 1195. Os registos mais recentes, como os desta OT, ficam de fora, por isso a OT aparece sem horas. Vai acontecer a mais OTs novas à medida que se registam horas.

## O que vai ser feito
- O painel do gerente passa a ler todos os registos de horas aos blocos de 1000, sem limite.
- O mesmo vale para o gráfico «Clientes com mais horas», que tem o mesmo limite e mostra totais incompletos.
- Fica igual: o aspeto do calendário, a lista do dia e as horas por técnico.

## Verificação
- Abrir o painel do gerente, escolher 15/10/2026 e confirmar que a WO-2026-0678 mostra 8h com as horas de cada técnico.

## Detalhes técnicos
- `src/pages/ManagerDashboard.tsx`: em `fetchCalendarOrders`, trocar `.in("work_order_id", workOrderIds)` (575 IDs no URL, máximo de 1000 linhas) por um helper `fetchAllTimeEntries(select)` que pagina com `.range(from, from+999)` até vir um bloco incompleto, e filtrar no cliente pelos IDs das OTs. Usar o mesmo helper em `fetchChartData`.
- Procurar outros `from("time_entries")` sem paginação noutras páginas do gerente e aplicar o mesmo helper.
