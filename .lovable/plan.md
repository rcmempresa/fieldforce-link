# Horas dos técnicos nas OTs concluídas

## O que se passa
Ontem bloqueámos o acesso dos técnicos às OTs Concluídas, Faturadas e a aguardar nota de encomenda. Esse bloqueio também apagou da vista do técnico as **horas que trabalhou nessas OTs**. Por isso, no «Meu Perfil» do técnico, essas OTs e as respetivas horas desapareceram.

O gerente não é afetado e continua a ver todas as horas na página dos técnicos. Os totais do painel do técnico (hoje, semana, mês e número de concluídas) já contam com as OTs fechadas.

## O que vou fazer
- No «Meu Perfil» do técnico, as OTs fechadas voltam a aparecer, mas **só com o resumo**: referência, título, cliente, data, estado e as horas que esse técnico lá trabalhou.
- O técnico continua sem poder abrir essas OTs: não há botão «Ver», e anexos, materiais, relatórios e detalhes continuam bloqueados.
- O total de horas no perfil volta a incluir as OTs fechadas.

## Detalhes técnicos
- Nova função SECURITY DEFINER `my_closed_work_orders_hours()`, que devolve apenas para `auth.uid()` as OTs fechadas onde o técnico foi atribuído ou registou tempo: id, reference, title, cliente (company_name ou name), scheduled_date, status e a soma de duration_hours do próprio técnico. EXECUTE só para authenticated.
- Em `Profile.tsx` (papel employee), juntar estas linhas às OTs abertas. As linhas fechadas ficam sem ligação para o detalhe.
- As políticas de acesso de ontem mantêm-se sem alterações.
- Confirmar com uma consulta, para um técnico real, que os totais da função batem com a soma das sessões dele.
