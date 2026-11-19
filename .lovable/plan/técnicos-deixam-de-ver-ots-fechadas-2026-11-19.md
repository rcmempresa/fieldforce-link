# Técnicos deixam de ver OTs fechadas

Quando uma OT fica **Concluída**, **Faturada** ou **Aguarda nota de encomenda**, os técnicos deixam de a conseguir abrir ou ver. Gerentes e clientes continuam a ver tudo como hoje.

## O que muda para o técnico
- As OTs fechadas desaparecem das listas, do calendário e das pesquisas do técnico.
- Se o técnico abrir um link antigo de uma OT fechada, vê só a mensagem «Esta OT está fechada e já não está disponível.», sem detalhes.
- Também ficam bloqueados os anexos, os materiais, as sessões de tempo, os relatórios e os PDFs dessas OTs.
- O contador «OTs concluídas» do painel do técnico continua a mostrar só o número.
- Se uma OT voltar a ser aberta (por exemplo, se passar de novo para Pendente ou Em execução), o técnico volta a vê-la.
- O histórico de intervenções do equipamento, que aparece dentro de OTs abertas, continua a mostrar o resumo das intervenções antigas (data, técnico, descrição), mas não deixa abrir a OT fechada.

## Detalhes técnicos
- A regra é aplicada no servidor, por isso esconder o ecrã não chega para contornar o bloqueio.
- Uma migração cria a função `employee_can_view_work_order(_wo, _user)`, do tipo SECURITY DEFINER, que só devolve verdadeiro quando o técnico está atribuído à OT (ou a teve antes) e o estado da OT não é completed, invoiced nem awaiting_purchase_order.
- As políticas de leitura dos técnicos em `work_orders` («Employees can view assigned» e «Previous assignees») passam a exigir que a OT não esteja fechada.
- Os ramos de técnico em `can_access_work_order` passam a usar a mesma condição. Isto cobre o armazenamento de anexos e relatórios.
- As políticas de leitura dos técnicos em `attachments`, `work_order_materials`, `time_entries`, `maintenance_reports`, `work_order_equipments` e `work_order_assignments` passam a verificar o estado da OT. Primeiro reviso as políticas atuais de cada tabela; gerentes e clientes ficam sem alterações.
- No `EmployeeDashboard`, a consulta das OTs fechadas passa a ser só uma contagem. As listas e o calendário deixam de mostrar OTs fechadas.
- No `WorkOrderDetails`, quando o técnico não consegue ler a OT, aparece a mensagem de OT fechada em vez do erro genérico.
- Um teste SQL, revertido no fim, confirma que um técnico atribuído deixa de ver a OT e os anexos quando ela passa a concluída e volta a vê-la quando ela é reaberta.
- No `AGENTS.md` fica registada a regra de que o acesso dos técnicos termina quando a OT fecha.
