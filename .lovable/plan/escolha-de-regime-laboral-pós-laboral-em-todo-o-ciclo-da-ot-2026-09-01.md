# Escolha de regime (laboral / pós-laboral) em todo o ciclo da OT

Objetivo: técnicos e gerente poderem definir se as horas são laborais ou pós-laborais no **início**, **durante** e **no fecho** do trabalho, e essa separação sair discriminada no relatório assinado pelo cliente.

## Situação atual

- Ao iniciar sessão, o regime é atribuído automaticamente pela hora de início (08:00–20:00 = laboral) — o técnico não escolhe.
- Durante o trabalho, o técnico já pode alternar laboral/pós-laboral em "Gerenciar Horas", mas só vê as **suas** sessões.
- Ao concluir a OT com assinatura, não há escolha de regime da sessão que está a ser fechada.
- O PDF já mostra, por técnico, o total e a divisão laboral/pós-laboral, mais os totais gerais.

## O que vai ser feito

### 1. Início do trabalho
No painel do funcionário, ao clicar em "Iniciar", passa a aparecer uma escolha rápida **Laboral / Pós-laboral**, já pré-selecionada pela hora atual (o técnico só confirma ou troca).

### 2. Durante o trabalho
Mantém-se o ecrã "Gerenciar Horas" com os botões Laboral / Pós-laboral por sessão e os dois totais no topo.
Passa a existir também um atalho no cartão da OT ativa para trocar o regime da sessão em curso sem abrir o diálogo completo.

### 3. Fim do trabalho (fecho de sessão e conclusão com assinatura)
No diálogo de conclusão, antes da assinatura, aparece:
- Escolha do regime da(s) sessão(ões) que estão a ser fechadas.
- Resumo em tempo real: total de horas laborais e pós-laborais da OT, para o cliente confirmar antes de assinar.

### 4. Acesso do gerente
O gerente passa a poder abrir "Gerenciar Horas" de qualquer OT e ver/corrigir o regime de **todas** as sessões, de todos os técnicos (agrupadas por nome). Continua bloqueado para técnicos em OTs concluídas/faturadas; o gerente mantém permissão de correção.

### 5. Relatório (PDF)
Reforça-se a discriminação:
- Por técnico: total, horas laborais e horas pós-laborais (já existe).
- Nova linha de resumo destacada no fim: "Total laboral" e "Total pós-laboral" antes da assinatura do cliente.

## Notas técnicas

- Regime continua guardado em `time_entries.work_regime` (enum `labor` / `after`); nada muda no esquema de dados.
- Ficheiros afetados: `EmployeeDashboard.tsx` (escolha ao iniciar + atalho na sessão ativa), `CompleteWorkOrderDialog.tsx` (escolha ao fechar + resumo), `EditTimeEntriesDialog.tsx` (modo gerente: sem filtro por `user_id`, agrupado por técnico), `WorkOrderDetails.tsx` (botão do gerente), `generateWorkOrderPDF.ts` (bloco de totais por regime).
- É necessária uma política de base de dados que permita ao gerente alterar `work_regime` de sessões de outros utilizadores.
