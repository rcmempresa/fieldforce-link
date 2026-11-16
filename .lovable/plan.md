# Novo relatorio de Climatizacao (AVAC) com calculos e apoio tecnico

## O que o Nuno pediu (resumo da conversa)
1. **Nova folha de relatorio de climatizacao**, com as medicoes organizadas em blocos.
2. **Calculos automaticos**: o tecnico escreve as temperaturas e a app calcula o Delta T e diz se esta OK.
3. **Apoio tecnico** (valores de referencia e tabelas de diagnostico) **no fim da folha** - pode sair no PDF do cliente.
4. **Observacoes em cada equipamento.**

## Medicoes por equipamento (blocos)

**Gerais:** Temperatura exterior, Caudal de ar (evaporador).

**Subarrefecimento** - Pressao alta, Temp. descarga, Temp. fim de condensacao (saida do condensador). Delta T = Td - Tf. Ideal 4-7 K.

**Rendimento do condensador** - Temp. ar entrada, Temp. ar saida. Delta T = saida - entrada. Referencia 10-15 K (indicado pelo Nuno).

**Sobreaquecimento util** - Pressao baixa, Temp. evaporacao, Temp. saida do evaporador. Delta T = saida - evaporacao. Ideal 3-6 K (Nuno) / 4-8 K (texto).

**Sobreaquecimento total** - Pressao baixa, Temp. evaporacao, Temp. linha de sucao (10 cm antes do compressor). Delta T = sucao - evaporacao. Ideal 8-15 K.

**Rendimento do evaporador** - Temp. retorno, Temp. insuflacao. Delta T = retorno - insuflacao. Ideal 10-14 K.

**Eletricas (mantem-se):** Tensao, corrente compressor, corrente ventilador, consumo.

Cada Delta T aparece calculado, com selo verde "OK", laranja "Baixo" ou "Alto", e a mesma indicacao no PDF.

**Observacoes** - caixa de texto em cada equipamento, tambem no PDF.

## Apoio tecnico no fim da folha
Seccao "Apoio Tecnico - Valores de Referencia" com os textos do Nuno resumidos:
- Sobreaquecimento util, total, subarrefecimento, rendimento do evaporador e do condensador: valores por tipo de sistema + tabela "valor medido / significado / causas / acao".
- No formulario aparece como painel que se abre ("Ver apoio tecnico") junto de cada bloco, para o tecnico consultar no local.

## Relatorios antigos
Continuam a abrir e a gerar PDF como estavam. So os novos relatorios usam a nova folha.

## Detalhes tecnicos
- `src/lib/maintenanceReportDefaults.ts`: nova lista de medicoes AVAC com campo `section` e definicao de calculos (formula, intervalo OK) em `src/lib/hvacCalculations.ts` (+ teste vitest com os exemplos do Nuno: -2/4 -> 6 K OK; 4/14 -> 10 K OK; 24/14 -> 10 K OK).
- Delta T guardado no JSON das medicoes (sem alteracao a base de dados); observacao por equipamento em `checklist_items.equipments[].observation`.
- `MaintenanceReportForm.tsx`: medicoes agrupadas por bloco, valores calculados so de leitura, painel de apoio colapsavel.
- `generateMaintenanceReportPDF.ts`: blocos, Delta T com estado, observacoes, e anexo final de apoio tecnico (texto ASCII, sem acentos, como nas regras dos PDFs).

## Pontos a confirmar
- O Nuno indicou para o sobreaquecimento util 3-6 K, mas o texto diz 4-8 K. Vou usar **3-6 K** salvo indicacao.
- O rendimento do condensador: o Nuno diz 10-15 K para entrada/saida do ar, o texto diz 6-12 K. Vou usar **10-15 K** salvo indicacao.
