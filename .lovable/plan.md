# Assinatura do cliente em falta na Folha de OT

## Causa provável
A Folha de OT é uma única página A4 sem quebra de página. Desde que se juntaram o logótipo e a secção «Equipamentos Intervencionados», o conteúdo (equipamentos + horas por técnico + observações) empurra a assinatura para baixo. Quando passa do fundo da página (cerca de 265 mm), a imagem da assinatura fica fora da folha ou cortada, por isso não aparece. A assinatura é captada corretamente na janela de conclusão.

## O que vou fazer
1. Na geração da Folha de OT, antes de desenhar a assinatura, verificar se cabe na página; se não couber, criar uma nova página e pôr lá «Assinatura do Cliente» e a imagem.
2. Aplicar a mesma verificação às listas longas (equipamentos, técnicos, observações) para nada sair da folha.
3. Pôr o rodapé «Documento gerado automaticamente» em todas as páginas.
4. Converter a assinatura para imagem com fundo branco antes de a inserir (evita traços invisíveis em alguns leitores de PDF).
5. Testar a geração com uma OT com vários equipamentos e observações longas e confirmar que a assinatura aparece.

## Notas
- Só vale para OTs fechadas a partir de agora; as folhas antigas sem assinatura não mudam.

## Detalhes técnicos
- src/lib/generateWorkOrderPDF.ts: helper `ensureSpace(h)` que faz `doc.addPage()` e reinicia Y quando `y + h > 265`; assinatura usa esse helper em vez de `Math.max(currentY + 5, 185)`; rodapé desenhado em loop por `doc.getNumberOfPages()`.
- src/components/work-orders/CompleteWorkOrderDialog.tsx: usar `getTrimmedCanvas()` desenhado sobre canvas com fundo branco e exportar como PNG.
