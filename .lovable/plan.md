## Problema

Quando vários funcionários estão atribuídos à mesma OT, apenas o primeiro consegue clicar em "Iniciar". Os restantes deixam de ver o botão.

## Causa

No `src/pages/EmployeeDashboard.tsx`, na secção **"Ordens para [data selecionada]"** (calendário do dia, ~linhas 634–681), os botões dependem do `status` global da OT:

- `status === "pending"` → mostra "Iniciar"
- `status === "in_progress"` → mostra "Pausar" + "Concluir"

Quando o 1.º funcionário inicia, o `status` global passa a `in_progress`. Para o 2.º funcionário, esse cartão deixa de mostrar "Iniciar" e mostra "Pausar" (desativado, porque não tem `active_time_entry_id` próprio) e "Concluir". Resultado: o 2.º funcionário não tem como iniciar a sua sessão a partir do calendário do dia.

A lógica das tabs "Minhas Ordens de Trabalho" (Ativas/Pausadas/Novas/Concluídas) já usa o estado por funcionário (`active_time_entry_id`, `has_been_started`) e funciona corretamente — o problema é apenas no cartão do calendário do dia.

## Correção

Em `src/pages/EmployeeDashboard.tsx`, no bloco "Ordens para [data]", trocar a condição dos botões para usar o estado por funcionário, igual ao que já existe nas tabs:

- Se `order.active_time_entry_id` → o funcionário tem sessão ativa → mostrar "Pausar" + "Concluir"
- Senão, se `order.status !== "completed"` → mostrar "Iniciar" (rotulado "Retomar" quando `order.has_been_started`)
- Se `order.status === "completed"` → não mostrar ações de execução

Também mostrar o `TimeTracker` apenas quando o próprio funcionário tem sessão ativa (`active_time_entry_start` presente), independentemente do status global.

## Ficheiros alterados

- `src/pages/EmployeeDashboard.tsx` (apenas a renderização do cartão de ordens do dia, ~linhas 634–681)

Sem alterações de schema, RLS ou backend — `handleStartWork` já trata corretamente do caso de a OT já estar `in_progress` (só atualiza o status se ainda não estiver).