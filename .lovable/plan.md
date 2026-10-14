# OT sem material: técnico deixa de estar atribuído, mas continua a vê-la

## Como vai funcionar
1. Quando um técnico pausa uma OT com o motivo **Falta de Material** (com comentário + anexo, como já é hoje), a app:
   - tira **todos os técnicos** dessa OT (deixa de aparecer nas OTs ativas deles e no calendário/ocupação);
   - guarda quem eram esses técnicos ("técnicos anteriores");
   - a OT continua no cartão/separador **Sem Material** do gerente e com o selo vermelho «Sem material».
2. Os técnicos ganham um novo separador **«Sem material»** no seu painel, com as OTs que já lhes foram atribuídas e estão paradas por falta de material (só para ver: referência, equipamento, cliente, comentário da pausa e anexo).
3. Quando o material chegar, o gerente abre a OT (ou a página «OT sem técnico») e carrega em **«Reatribuir técnicos anteriores»** (um clique) ou escolhe outro técnico. A OT sai de «Sem material» assim que alguém volta a trabalhar nela.
4. O histórico do técnico (Meu Perfil) continua a mostrar essas OTs, porque ele trabalhou nelas.

## Detalhes técnicos
- Nova tabela `work_order_previous_assignments` (work_order_id, user_id, removed_at, reason) com GRANTs + RLS: técnico vê as suas linhas, gerente tudo.
- Função SECURITY DEFINER `release_assignments_for_missing_material(_wo uuid)`: copia as atribuições para a tabela acima e apaga-as de `work_order_assignments`; chamada pelo `PauseWorkOrderDialog` após gravar a pausa `falta_material`.
- RLS SELECT extra em `work_orders`, `time_entries` (pausa/comentário) e `attachments`: técnico pode ler OTs onde consta em `work_order_previous_assignments` (só leitura). Verificar primeiro as políticas atuais antes de as alargar.
- `EmployeeDashboard`: separador «Sem material» usando `fetchMissingMaterialIds()` cruzado com as atribuições anteriores do técnico.
- `WorkOrderDetails` / `UnassignedWorkOrders`: botão «Reatribuir técnicos anteriores» (insere de novo em `work_order_assignments`).
- Atualizar a memória «Missing material» com a nova regra.
