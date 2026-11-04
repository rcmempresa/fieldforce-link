# Corrigir aprovação de solicitações com data e técnico

## O que verifiquei
- WO-2026-0708 e WO-2026-0710 já estão hoje com data, técnico e fora de «Aguarda data» (atualizadas às 11:05).
- WO-2026-0709 está pendente sem data nem técnico.
- Nenhuma OT está neste momento presa em «Aguarda data» com data marcada.

## Causas encontradas no painel do gerente
1. **«Aprovar» não limpa a marca «aguarda data»**: se o cliente marcou «ainda sem data» ao pedir, a OT continua em «OTs a aguardar data» mesmo depois de aprovada com data e técnico.
2. **«Marcar como Pendente» ignora a data e o técnico escolhidos**: ao lado de «Aprovar», este botão apaga a data e manda a OT para «Aguarda data», mesmo que já tenhas escolhido data e técnico. É fácil carregar no botão errado.

## O que vou mudar
- Ao **Aprovar** com data: a OT sai de «Aguarda data», fica com data e técnicos, e aparece no calendário.
- Ao **Aprovar sem data**: vai para «Aguarda data» (como é esperado).
- Se já escolheste data/técnico e carregares em **Marcar como Pendente**, a app avisa e propõe aprovar com essa data.
- Depois de aprovar, a lista «Aguarda data» e «OT sem técnico» atualizam logo.
- Verificar a WO-2026-0709 contigo: dizes-me a data e o técnico que querias e eu acerto.

## Detalhes técnicos
- `ManagerDashboard.tsx` `approveRequest`: `needs_scheduling: !scheduledDate`; chamar `fetchPendingScheduling()` e `fetchUnassignedOrders()` no fim.
- `markAsPending`: se `scheduledDates[id]` ou `orderTechs[id]` preenchidos, mostrar confirmação a sugerir aprovação.
- Testar o fluxo no ecrã com uma sessão de gerente.
