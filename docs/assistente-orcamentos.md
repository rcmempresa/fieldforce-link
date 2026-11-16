# Assistente Digital – fluxo de orçamentos (para o agente externo)

Todas as ações chamam a função `empregado-digital` com `{ "action": ..., "params": {...} }` e o header `x-agent-secret`.

## Fluxo de conversa
1. «Para que cliente é o orçamento?» → `procurar_cliente_orcamento {search}` (nome, empresa ou NIF). Se vier mais que um, perguntar qual.
2. Pedir artigos um a um: descrição, unidade (un, h, m...), quantidade, preço unitário sem IVA. Perguntar «Mais algum artigo?».
3. Perguntar: precisa de visita prévia? validade (dias, por defeito 30)? condições/observações para o cliente? notas internas?
4. Criar: `criar_orcamento {client_search, items, requires_visit, valid_days, notes}` (fica em rascunho).
5. Mostrar o resumo (`resumo_orcamento {reference}`) com linhas numeradas e totais e pedir confirmação.
6. Alterações: `adicionar_linha_orcamento`, `editar_linha_orcamento {reference, line, ...}`, `remover_linha_orcamento {reference, line}`, `editar_orcamento {reference, vat_rate, valid_days, notes, internal_notes, client_email, client_phone, client_search}`.
7. Perguntar: «Enviar por Email, WhatsApp ou pelos dois?» e confirmar o email / telemóvel (sugerir os do cliente).
8. Só depois de confirmação explícita: `enviar_orcamento {reference, canal: "email"|"whatsapp"|"ambos", email?, telefone?, mensagem?}`.
9. WhatsApp: o número está no próprio agente. Se `results.whatsapp.pending_agent` for true, o agente envia pelo seu WhatsApp o documento `pdf_url` (nome `filename`, legenda `caption`) para `to`, e depois chama `confirmar_whatsapp_orcamento {reference, telefone, ok: true}` (ou `ok: false, erro`). Só aí o orçamento fica «Enviado» (se o email não tiver já saído).
10. Ler `results.email` / `results.whatsapp`: dizer o que foi enviado e o que falhou. Se o WhatsApp falhar, oferecer Email.

## Regras
- Nunca enviar sem confirmação do gerente.
- Preços sem IVA; IVA por defeito 22% (`vat_rate` em fração, ex. 0.22).
- O PDF é gerado no servidor com o logótipo NR, sem preços nas linhas.
- O link do PDF dura 7 dias.

Exemplo de resposta:
```json
{"data":{"reference":"ORC-2026-0007","sent":false,"pending_agent_whatsapp":true,"results":{"whatsapp":{"ok":false,"pending_agent":true,"pdf_url":"https://...","filename":"ORC-2026-0007.pdf","caption":"Olá ...","to":"351912345678"}}}}
```
