# Página de detalhe do contrato

Ao clicar num contrato abre uma página própria com tudo sobre ele.

## O que aparece
- Cabeçalho: cliente, tipo, periodicidade, estado, próxima intervenção, equipamentos e notas.
- Botões **Editar** e **Eliminar** no topo (os mesmos de hoje), e voltar à lista depois de eliminar.
- Lista de **todas as OTs associadas** ao contrato: referência, equipamento, estado, data agendada, técnicos e selo de dias em aberto; ordenadas da mais recente para a mais antiga.
- Em cada OT: **Ver** (abre a OT), **Editar** (abre a OT em edição) e **Remover do contrato** (a OT continua a existir, só deixa de estar ligada), com confirmação.
- Botão **Criar OT agora** para gerar manualmente uma OT de manutenção do contrato.
- Clientes: ao clicar num contrato em «Contratos» veem a mesma página só de leitura (sem botões de editar/remover).

## Detalhes técnicos
- Nova rota `/contracts/:id` (gerentes) e reutilização em modo leitura para clientes a partir de MyContracts.
- Extrair os diálogos de editar/eliminar de Contracts.tsx para um componente partilhado.
- OTs via `work_orders.contract_id = id`; "Remover do contrato" faz `update contract_id = null`; "Criar OT agora" usa a RPC existente `create_contract_work_order`.
- O clique no cartão deixa de ir para `/work-orders?contract=`.
