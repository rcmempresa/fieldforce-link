# Current tasks

- [x] Support invoiced in atualizar_estado_ot and add editar_cliente and apagar_registo_horas.
- [x] Test and deploy the changes, then verify authenticated requests without modifying live records (35 tests passed; live missing-target, validation and secret-protection checks passed).

- [x] Add editar_ot, adicionar_material_ot and remover_material_ot with validation and unambiguous OT resolution.
- [x] Test the three actions without changing live OTs and deploy with authenticated verification (26 tests passed; live missing-target, validation and secret-protection checks passed).

- [x] Add equipamentos_cliente, materiais_usados and disponibilidade_equipa to empregado-digital.
- [x] Test filters, date boundaries and technician workload totals.
- [x] Deploy and verify authenticated requests for the three actions.
- [x] Add remover_tecnico_ot, agendar_ot, criar_ot and registar_horas_ot with validated inputs.
- [x] Test the four write actions without changing live OTs, deploy and verify access protection (17 local tests; authenticated missing-target requests and incorrect-secret rejection).
- [x] Restrict /assistente-digital to managers: route guard, sidebar item removed for employees, page shows access denied, and assistente-proxy rejects non-managers (6 tests passed; live 403 for employee, manager reaches message handling).
