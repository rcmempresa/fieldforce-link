# Current tasks

- [x] Add listar_contratos and historico_equipamento with validated filters and existing report linkage.
- [x] Complete criar_cliente duplicate checks for contact email and phone without email.
- [x] Test, deploy and verify the three uploaded actions without changing live records (54 tests passed; live contracts, equipment orders/reports, duplicate email and secret protection verified).

- [x] Add criar_cliente to empregado-digital with validated profile/contact fields and approved client access.
- [x] Test, deploy and verify client creation with temporary data, then remove the test account (45 tests passed; live creation and client-page readback verified; temporary account removed).

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
- [x] Email de nova solicitação chegava a geral@nrenergias.pt — resolvido com profiles.notification_email a apontar para geral@nrtechsolucion.pt.
