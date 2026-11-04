# Solicitações aprovadas com data e técnico ficam «Aprovadas»

## O que muda para ti
Nas OTs em **«Aguarda Aprovação»**, quando escolhes **data + técnico** e carregas em **Aprovar**:
- A OT fica com estado **«Aprovada»** (já não «Pendente»).
- Sai da lista de aprovação e **não vai** para «Aguarda data» nem para «OT sem técnico».
- Aparece logo no **calendário** e no painel do técnico escolhido.
- O cliente recebe o email de aprovação com a data.

Se carregares em **Aprovar** sem data ou sem técnico, a app avisa: «Escolhe data e técnico para aprovar» (para não ficar meio criada). «Marcar como Pendente» continua a servir para aprovar sem data.

## Onde «Aprovada» passa a aparecer bem
- Selo verde «Aprovada» nas listas de OTs, painel do gerente, painel do técnico e detalhe da OT.
- Opção «Aprovada» no editar OT e no filtro (o filtro já existe).
- O técnico consegue iniciar o trabalho numa OT aprovada; ao pausar volta a «Pendente» como hoje.
- O assistente digital também conta as OTs aprovadas como abertas.

## OTs já afetadas
Passo para «Aprovada» as OTs vindas de solicitações que já têm data e técnico e estão como «Pendente» hoje (ex.: WO-2026-0708, WO-2026-0710) — mostro-te a lista antes de mudar.

## Detalhes técnicos
- `ManagerDashboard.approveRequest`: exigir `scheduledDate` + técnicos selecionados; update `{ status: "approved", scheduled_date, needs_scheduling: false }`; depois `assignTechnicians`; refrescar pending requests, pendingScheduling, unassigned, calendar, stats.
- Adicionar `approved` a `getStatusColor/getStatusLabel` em ManagerDashboard, WorkOrders, WorkOrderDetails, EmployeeDashboard; `SelectItem value="approved"` e tipo no EditWorkOrderDialog.
- Garantir que consultas de OTs abertas (painel do técnico, calendário, contadores, `empregado-digital` linhas 227/316) incluem `approved`.
- Testar no ecrã: aprovar uma solicitação com data + técnico e confirmar estado, calendário e listas.
