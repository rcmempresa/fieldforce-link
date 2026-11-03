# Contratos: agendar hora na criação e perguntar ao fechar cada OT

## O que muda para o utilizador

1. **Ao criar um contrato**
   - Junto à «Data da primeira intervenção» aparece a escolha da **hora** (horários 09:00, 11:00, 14:00, 16:00, 19:00, 21:00, 23:00, com a ocupação de cada um, como nos outros agendamentos).
   - Opcional: escolher já o **técnico**.
   - A primeira OT é criada **já agendada** nesse dia e hora (aparece no calendário), em vez de ficar pendente «à espera de data».

2. **Sempre que uma OT de contrato é fechada**
   - Assim que a OT passa a «Concluída», abre logo uma janela para o gerente: **«Criar a próxima OT de manutenção?»**
   - Mostra a data sugerida (próximo mês / trimestre / ano conforme o contrato) e deixa escolher **dia, hora** e técnico (por defeito o mesmo da OT anterior).
   - **Criar próxima OT** → nova OT agendada com os mesmos equipamentos. **Terminar contrato** → contrato fecha. **Decidir depois** → fica no aviso «Contratos a decidir» do painel (como hoje).
   - Se a OT for fechada por um técnico, o gerente continua a ver o aviso no painel e dentro da OT, agora com a mesma escolha de dia/hora.

## Detalhes técnicos

- Migração: `create_contract_work_order(_contract, _scheduled timestamptz default null, _technician uuid default null)` — com data: `scheduled_date` preenchido e `needs_scheduling=false`; com técnico: insere em `work_order_assignments`. `decide_contract(_wo, _continue, _scheduled default null, _technician default null)` passa os valores. Mantém compatibilidade com chamadas atuais (empregado-digital, ContractDecisions).
- `Contracts.tsx`: `SlotDateTimePicker` + seleção opcional de técnico no formulário; passa `_scheduled`/`_technician` ao RPC.
- `ContractDecisions.tsx`: botão «Continuar» abre diálogo com data sugerida (next_date + frequência), `SlotDateTimePicker` e técnico.
- Novo `ContractNextOtDialog` aberto em `WorkOrderDetails.tsx` / fluxo de conclusão quando o gerente conclui uma OT com `contract_id`.
