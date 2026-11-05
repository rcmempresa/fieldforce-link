# Logotipo na Folha de OT

Quando uma OT é fechada, a Folha de OT (o PDF que o cliente assina) passa a ter o logotipo NR Techsolución no canto superior esquerdo, em todas as OTs fechadas a partir de agora.

## O que muda
- Logotipo enviado (NR Techsolución) colocado em cima à esquerda, tamanho discreto (~45 mm de largura).
- O título «Folha de OT» mantém-se ao centro; a referência e o resto descem ligeiramente para não sobrepor.
- As folhas antigas já geradas não mudam.

## Detalhes técnicos
- Carregar a imagem enviada como asset (lovable-assets) e guardar o ponteiro em `src/assets/nr-techsolucion-logo.png.asset.json`.
- Em `src/lib/generateWorkOrderPDF.ts`, buscar a imagem, converter para dataURL e `doc.addImage(..., 15, 8, 45, ~25)`; se falhar o carregamento, o PDF é gerado na mesma sem logo.
- Ajustar o Y da referência/separador para ficar abaixo do logo.
