# Corrigir o erro ao concluir OTs

## O que está a acontecer
Desde que os técnicos deixaram de ver as OTs fechadas, o passo final da conclusão falha para os técnicos. Quando o técnico muda a OT para «A faturar» (ou «Aguarda nota de encomenda»), o sistema verifica se o técnico ainda consegue ver a OT depois da mudança. Como já não consegue, a gravação é recusada e aparece «Erro ao concluir a ordem de trabalho». A Folha de OT chega a ser gerada, mas a OT fica no estado anterior.

O gerente não é afetado; o erro é só dos técnicos.

## O que vou fazer
1. Criar um passo no sistema, só para concluir a OT, que confirma que quem conclui é gerente ou técnico atribuído e muda o estado de uma vez, sem a verificação de visibilidade.
2. Usar esse passo nos dois pontos onde o técnico conclui: no botão «Concluir OT» e no fecho da sua sessão quando é o último técnico.
3. Os avisos ao cliente e aos gerentes continuam a sair como hoje.
4. Mostrar no aviso de erro a mensagem real, para que futuros problemas se percebam logo.
5. Testar no sistema como técnico: concluir uma OT atribuída passa; concluir uma OT de outro técnico continua bloqueado.

## Detalhes técnicos
- Causa: no Postgres, um UPDATE com WHERE aplica as policies SELECT à linha nova; as policies "Employees can view assigned work orders"/"Previous assignees..." excluem completed/invoiced/awaiting_purchase_order, por isso o `.update({status})` em CompleteWorkOrderDialog (linhas ~235 e ~424) falha com RLS.
- Nova função `complete_work_order(_wo uuid, _status work_order_status)` SECURITY DEFINER: aceita só completed/awaiting_purchase_order, exige manager ou linha em work_order_assignments para auth.uid(); GRANT EXECUTE a authenticated.
- Os inserts em `notifications` feitos pelo técnico também são recusados (policy só para managers) — já falham em silêncio; passam a ser feitos dentro da mesma função para não se perderem.
- Teste SQL rolled-back em supabase/tests/.
