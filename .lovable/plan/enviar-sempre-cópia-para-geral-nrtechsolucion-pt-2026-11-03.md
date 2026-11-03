# Enviar sempre cópia para geral@nrtechsolucion.pt

## Objetivo
A caixa geral@nrtechsolucion.pt recebe um email sempre que:
1. Um cliente **solicita** uma OT (pedido novo).
2. Um gerente **cria** uma OT (hoje não é enviado nenhum aviso para a empresa).
3. Uma OT é **finalizada**, com a Folha de OT e os relatórios em anexo (hoje só vai para o cliente).

## Como fica
- **Solicitação de cliente**: o aviso vai para os gerentes como hoje e também, sempre, para geral@nrtechsolucion.pt. Se essa caixa já for um destinatário, não chega em duplicado.
- **OT criada pelo gerente**: novo email «Nova OT criada» com referência, cliente, equipamento, data/hora e técnico, enviado para geral@nrtechsolucion.pt.
- **OT finalizada**: o cliente continua a receber o email. Também vai uma cópia com os mesmos anexos para geral@nrtechsolucion.pt.
- Todos os envios ficam registados no histórico de emails, como os outros.

## Detalhes técnicos
- Na função `send-notification-email`, criar a constante `COMPANY_INBOX = "geral@nrtechsolucion.pt"`.
- `work_order_created_notify_managers`: no fim, juntar COMPANY_INBOX ao conjunto de destinatários e remover duplicados (comparar sem diferenciar maiúsculas/minúsculas).
- `work_order_completed`: juntar COMPANY_INBOX a `allRecipients`, também sem duplicados.
- Criar o novo tipo `work_order_created_company`, que envia só para COMPANY_INBOX. Os diálogos onde o gerente cria a OT (CreateWorkOrderDialog e a página Sem Técnico, se criar OTs) chamam este tipo depois de gravar. Se o envio falhar, a criação da OT não fica bloqueada.
- OTs geradas automaticamente pelos contratos não entram nesta alteração (diz-me se também as queres).
- Publicar a função e confirmar no histórico de emails que os envios foram feitos.
