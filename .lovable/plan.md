# Orcamentos: logotipo por defeito e pagina completa

## 1. Logotipo NR Techsolucion sempre por defeito
- Todos os PDFs de orcamento (lista e formulario) passam a levar o logotipo NR Techsolucion no canto superior esquerdo, sem ser preciso escolher nada.
- O seletor de logotipo continua la para trocar (ex: NR Energias); "Repor logotipo NR" volta ao padrao.

## 2. O que falta para a pagina ficar correta
**Correcoes**
- Ao editar um orcamento antigo, a validade era recalculada a partir de hoje. Passa a manter a data original (so muda se mudares os dias).
- "Notas" diz "observacoes internas" mas sai no PDF do cliente. Passa a haver dois campos: **Condicoes / Observacoes** (sai no PDF) e **Notas internas** (so na app).

**Acoes novas na lista e no orcamento**
- **Enviar por email**: envia o PDF ao cliente (assunto "Orcamento {ref} - NR Tech Solution"), marca como enviado e regista no historico de emails. Se o cliente tiver varios emails, escolhes qual.
- **Duplicar**: cria um rascunho novo com os mesmos dados e artigos.
- **Criar OT a partir do orcamento aceite**: abre a criacao de OT ja com cliente e descricao dos artigos; a OT fica ligada ao orcamento.
- **Eliminar**: deixa de estar limitado aos rascunhos (com confirmacao, e aviso se ja foi enviado/aceite).

**No PDF**
- Condicoes por defeito no fim (validade, pagamento, precos com IVA a 22%) editaveis no campo Condicoes.
- Linha de assinatura/aceitacao do cliente.

## Detalhes tecnicos
- Logo: `src/assets/nr-techsolucion-logo.png.asset.json` convertido para dataURL em `src/lib/defaultReportLogo.ts`; `Quotes.tsx` usa-o quando nao ha logo guardado (localStorage).
- Migracao: `quotes.internal_notes text` (nullable); `notes` continua a ser o texto do PDF.
- `openEdit` guarda `valid_until` original; so recalcula ao mudar `valid_days`.
- Email: nova acao no edge function `send-notification-email` (tipo `quote`, so gerentes, PDF em base64 como anexo, Resend), regista em `email_logs`, atualiza `status='enviado'`, `sent_at`.
- Duplicar: insert com `reference` gerada pelo trigger existente.
- OT: navega para criacao de OT com dados pre-preenchidos e grava `quotes.work_order_id`.
- `generateQuotePDF.ts`: bloco de condicoes por defeito + linha de aceitacao.
