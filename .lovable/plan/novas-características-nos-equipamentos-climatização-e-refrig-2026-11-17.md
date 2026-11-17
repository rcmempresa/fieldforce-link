# Novas características nos equipamentos (Climatização e Refrigeração & Congelação)

## O que muda
No formulário de criar/editar equipamento, quando a categoria for **Climatização** ou **Refrigeração & Congelação**, aparecem 4 campos novos:
- **Tensão** (ex.: 230 V, 400 V) — texto livre
- **Potência** (ex.: 3,5 kW, 12000 BTU) — texto livre
- **Refrigerante** — lista com os mais comuns (R32, R410A, R134a, R404A, R290, R744, R22, R407C, R449A, R452A) + opção «Outro» para escrever
- **Carga de refrigerante** — número em kg

Nas outras categorias estes campos não aparecem. Todos são opcionais (não bloqueiam equipamentos antigos).

## Onde se vê
- Página Equipamentos: selos com Tensão / Potência / Refrigerante / Carga no cartão.
- Detalhe da OT: na linha do equipamento, junto ao modelo/ano.
- Folha de OT (PDF), secção «Equipamentos Intervencionados»: acrescenta estas características quando existirem.

## Detalhes técnicos
- Migração aditiva em `equipments`: `voltage text`, `power text`, `refrigerant text`, `refrigerant_charge_kg numeric` (todas nullable). Sem mudanças de RLS (herdam as policies atuais).
- `EquipmentFormFields.tsx`: novos campos no form/payload, mostrados só para `category in ('hvac','refrigeration')`; ao mudar para outra categoria o payload grava null. Teste em `EquipmentFormFields.test.ts` para essa regra.
- Atualizar selects em Equipments.tsx, WorkOrderDetails.tsx, EquipmentPicker e gerador da Folha de OT (texto ASCII no PDF).
