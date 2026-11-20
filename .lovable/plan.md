# Trocar os restantes «Concluída» por «A faturar»

Revi a aplicação e todas as etiquetas de estado das OTs já dizem «A faturar». Ainda aparece «concluída» nestes textos, que vou mudar:

## No painel do gerente
- O cartão **«Concluídas/mês»** passa a **«A faturar/mês»**.
- No aviso dos contratos, «OT concluída: criar a próxima OT de manutenção?» passa a «OT a faturar: criar a próxima OT de manutenção?».

## Histórico de Emails
- O tipo de email «Ordem Concluída» passa a «Ordem a faturar».

## Folha de OT em PDF
- A linha «Status: Concluída» passa a «Status: A faturar». Só as folhas geradas daqui para a frente mudam; as que já existem ficam como estão.

## Avisos ao concluir uma OT
- Os avisos ao gerente e ao cliente, e a mensagem no ecrã, passam de «Ordem … concluída» para «Ordem … pronta a faturar».

## Fica igual
- O botão **«Concluir OT»**, porque é a ação que o técnico faz.
- O selo **«Concluído / Rascunho»** dos relatórios de manutenção, porque é o estado do relatório e não da OT.
- **«Serviços Concluídos»** no painel do cliente, para o cliente não ver «a faturar».

## Detalhes técnicos
- Muda só o texto, sem alterações à base de dados nem ao estado `completed`.
- Ficheiros: ManagerDashboard.tsx (linha 1135), ContractDecisions.tsx, EmailLogs.tsx, generateWorkOrderPDF.ts (linha 94; o PDF usa só ASCII, por isso fica «A faturar»), CompleteWorkOrderDialog.tsx (mensagens).
