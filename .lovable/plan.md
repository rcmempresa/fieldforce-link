# Verificação: bloqueio de edição de horas em OTs concluídas

## Objetivo
Confirmar que os técnicos não conseguem alterar horas depois de a OT ser concluída (estado `completed`) ou faturada (`invoiced`).

## O que já está implementado
- **RLS em `time_entries`**: funcionários bloqueados em INSERT/UPDATE/DELETE quando a OT está `completed` ou `invoiced`; gerente mantém acesso total.
- **UI (`EmployeeDashboard` + `EditTimeEntriesDialog`)**: em OTs concluídas, o diálogo abre em modo leitura (`readOnly`), sem botões de editar/remover, com aviso a indicar que deve contactar o gerente.

## Passos de verificação
1. Abrir o código e confirmar que o modo `readOnly` é ativado apenas para funcionários (o gerente deve continuar a conseguir editar).
2. Testar no preview com um funcionário: abrir uma OT concluída e verificar que não há botões de edição.
3. Simular um UPDATE direto via API com sessão de funcionário numa OT concluída e confirmar que a base de dados recusa (proteção real, não só visual).
4. Confirmar que o gerente continua a conseguir corrigir horas em OTs concluídas.

## Correções (se necessário)
Se algum passo falhar, ajustar a policy RLS ou a condição de `readOnly` no dashboard do funcionário.
