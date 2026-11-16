# Orcamento: esconder precos por linha no PDF

## O que muda
- No PDF do orcamento, a tabela de artigos passa a mostrar so: Descricao, Unidade e Quantidade.
- As colunas "P. Unit." e "Total" de cada linha deixam de aparecer.
- No fim continua: Subtotal, IVA e TOTAL.
- Na app (formulario do orcamento) os precos por linha continuam visiveis e editaveis, para calcular o total.
- Aplica-se a todos os PDFs de orcamento (download e email), incluindo orcamentos antigos quando forem regenerados.

## Detalhe tecnico
- `src/lib/generateQuotePDF.ts`: remover as colunas P. Unit. e Total do array `cols`, redistribuir larguras (Descricao ~70%, Un. ~12%, Qtd ~18%) e retirar os `doc.text` de `unit_price` e `total` no ciclo das linhas.
