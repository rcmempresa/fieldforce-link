# Histórico de intervenções visível na OT

## O que muda
Na página da OT, em cada equipamento, o técnico (e o gerente) vê o histórico logo à primeira, sem ter de abrir o equipamento nem carregar em botões:

- Por baixo do nome do equipamento aparece um selo com o número de intervenções anteriores, por exemplo «12 intervenções».
- Um bloco **«Histórico de intervenções»** fica sempre visível por baixo de cada equipamento. Mostra logo as últimas 5 intervenções (referência, data, estado, título), e cada uma abre a OT respetiva.
- Um botão «Ver todas» mostra o resto, incluindo os relatórios e anexos em PDF.
- Os manuais, o diagnóstico com IA e os anexos continuam no mesmo sítio, dentro do equipamento.
- A OT que está aberta não entra no seu próprio histórico.

## Detalhes técnicos
- `EquipmentHistory.tsx`: novas opções `defaultOpen`, `previewLimit` e `excludeWorkOrderId`. Quando o bloco está aberto, mostra as primeiras N ordens e um botão «Ver todas».
- `WorkOrderDetails.tsx`: o `EquipmentHistory` sai de dentro do AccordionContent e passa a ficar visível debaixo de cada AccordionItem (para gerente e técnico), com `defaultOpen` ativo e `previewLimit=5`. O contador vem do mesmo pedido (RPC `get_equipment_history`), sem mudanças na base de dados.
- As outras páginas (Equipamentos, Clientes, painel do cliente) não mudam.
