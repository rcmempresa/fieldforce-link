# WhatsApp dos orçamentos sem desligar o número do agente de IA

## O problema
O número da NR já está a ser usado por outro agente de IA na Meta. Cada número só pode estar ligado a um sítio, por isso não dá para o ligar também à app sem tirar ao agente.

## A solução
Quem envia a mensagem de WhatsApp passa a ser o vosso agente, pelo número que ele já usa. A app prepara o orçamento e entrega-lhe o PDF pronto.

- Quando pedes «envia por WhatsApp» (ou «pelos dois»), a app gera o PDF (logótipo NR, sem preços nas linhas) e devolve ao agente um link seguro para o PDF, válido 7 dias, com o telemóvel do cliente e uma mensagem sugerida.
- O agente envia o PDF ao cliente pelo WhatsApp dele e confirma à app que foi enviado. Aí o orçamento passa a «Enviado» e o envio fica registado no histórico.
- O email continua a sair diretamente da app, como já está.
- Se um dia ligarem à app um número próprio, o envio passa a ser feito pela app sem mudar mais nada.

## O que fica do vosso lado
Quem gere o agente (Railway) tem de lhe ensinar: pegar no link do PDF e enviá-lo por WhatsApp, e depois confirmar o envio à app. Atualizo o documento de instruções com os passos e um exemplo.

## Detalhes técnicos
- `enviar_orcamento` com canal `whatsapp`/`ambos`: se `WHATSAPP_API_KEY` não existir, faz upload para o bucket `quote-pdfs`, cria signed URL (7 dias) e devolve `results.whatsapp = { ok: false, pending_agent: true, pdf_url, filename, to, caption }`. O orçamento só fica «enviado» com email OK ou após confirmação.
- Nova ação `confirmar_whatsapp_orcamento { reference, telefone, ok, erro? }`: regista em email_logs (`quote_whatsapp`) e marca enviado + sent_at quando ok.
- Atualizar teste de regras (pendente do agente não conta como enviado) e `docs/assistente-orcamentos.md`.
- Tirar a tarefa «Ligar WhatsApp Business» do roadmap como bloqueio; fica como opção futura.
