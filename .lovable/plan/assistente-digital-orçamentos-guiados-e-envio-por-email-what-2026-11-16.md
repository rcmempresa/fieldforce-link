# Assistente Digital: orçamentos guiados e envio por Email / WhatsApp / ambos

## O que vais ter
- Dizes ao assistente «quero fazer um orçamento» e ele vai perguntando, passo a passo: cliente (procura pelo nome ou NIF), artigos (descrição, unidade, quantidade, preço), IVA, validade, condições.
- Antes de gravar, mostra um resumo e pede confirmação. Podes pedir alterações («muda a quantidade da linha 2», «tira o artigo X»).
- No fim pergunta: «Enviar por Email, WhatsApp ou pelos dois?» e para que contacto (emails do cliente / telemóvel do cliente).
- O PDF enviado é o mesmo dos orçamentos da app: logótipo NR, sem preços nas linhas, total no fim, zona de aceitação.
- O orçamento passa a «Enviado» e o envio fica no histórico.

## O que é preciso de ti
- **Ligar o WhatsApp Business** da NR à app (aparece um cartão para ligar). Precisa de número WhatsApp Business e aprovação da Meta.
- Regra da Meta: só dá para enviar mensagem livre a um cliente que falou com a NR nas últimas 24h. Fora disso tem de ser uma mensagem-modelo aprovada (vou criar o modelo «orcamento_nr»; a aprovação pode levar até 48h). Até lá, o envio por WhatsApp pode falhar e o assistente avisa e oferece Email.
- O «cérebro» do assistente (as perguntas que faz) está num serviço externo vosso (Railway). Eu preparo as novas ações na app; quem gere esse serviço tem de lhe ensinar o novo fluxo. Deixo um texto pronto com as instruções e a lista das ações.

## Detalhes técnicos
- Edge function `empregado-digital`, novas/alteradas ações:
  - `procurar_cliente_orcamento` (nome/NIF/email → id, emails de client_emails, telefone).
  - `criar_orcamento` aceita rascunho; `editar_orcamento` (cliente, iva, validade, notas, internal_notes); `adicionar_linha_orcamento`, `editar_linha_orcamento`, `remover_linha_orcamento`; `resumo_orcamento` (totais calculados).
  - `enviar_orcamento` { reference, canal: email|whatsapp|ambos, email?, telefone? }: gera o PDF no servidor, envia por cada canal, devolve o resultado de cada canal separadamente, marca enviado se pelo menos um canal teve sucesso, regista em email_logs (tipo quote_sent / quote_whatsapp).
- PDF no servidor: extrair o desenho de `generateQuotePDF.ts` para `supabase/functions/_shared/quotePdf.ts` (jsPDF via npm:, logo carregado de https://nrtechsolucion.pt), e a página Orçamentos passa a usar o mesmo código para não divergir.
- WhatsApp: PDF guardado em storage (bucket privado), URL assinada 7 dias, enviado via gateway `/messages` com `type: document` (dentro de 24h) ou `type: template` com header document (fora). Número normalizado para E.164 só dígitos (+351 por defeito).
- Email reutiliza a lógica do `send-quote-email` (Resend, geral@nrtechsolucion.pt).
- Testes: cálculo de totais, normalização do telemóvel, escolha de canal e regra «enviado se ≥1 canal OK».
- Documento `docs/assistente-orcamentos.md` com o prompt/fluxo para o agente externo.
