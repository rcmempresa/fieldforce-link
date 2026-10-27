# Contratos de manutenção + relatório mensal de OTs por faturar

## 1. Contratos (nova página "Contratos" na gestão)
- Tipos: Manutenção AVAC, Manutenção Bomba de Calor, Manutenção Eletricidade.
- Periodicidade: Mensal, Trimestral ou Anual.
- O gerente escolhe o cliente e um ou mais equipamentos desse cliente, a data de início e as notas.
- Lista com pesquisa, filtro por tipo/estado (Ativo / Terminado), paginação e a data da próxima intervenção.
- Ao criar o contrato, a app cria a primeira OT (tipo Manutenção) com os equipamentos escolhidos, ligada ao contrato e a aguardar data/técnico como as outras OTs.

## 2. Fecho da OT de contrato (só o gerente)
- Quando uma OT ligada a um contrato fica concluída, o gerente vê um aviso no painel e na própria OT: "Continuar contrato ou terminar?".
- Continuar: cria a próxima OT na data seguinte (mais 1, 3 ou 12 meses), com os mesmos cliente e equipamentos.
- Terminar: o contrato passa a Terminado e deixa de criar OTs.
- Os técnicos não veem esta pergunta.

## 3. Relatório mensal automático
- No último dia de cada mês, às 18h, é enviado um email para geral@nrtechsolucion.pt.
- Mostra todas as OTs que não estão no estado Faturado (exceto canceladas), agrupadas por cliente, com referência, equipamento, estado, data e horas.
- Usa o mesmo serviço de email que a app já usa.

## Detalhes técnicos
- Tabelas: `maintenance_contracts` (client_id, contract_type, frequency, start_date, next_date, status, notes) e `maintenance_contract_equipments`; coluna nullable `work_orders.contract_id` e `work_orders.contract_decision_pending`.
- RLS: só gerentes gerem contratos; clientes podem ver os seus.
- Edge function `monthly-uninvoiced-report` (verify_jwt=false, só corre se for último dia do mês) agendada diariamente às 18h via pg_cron.
- Diálogo de decisão em WorkOrderDetails e cartão "Contratos a decidir" no ManagerDashboard.
