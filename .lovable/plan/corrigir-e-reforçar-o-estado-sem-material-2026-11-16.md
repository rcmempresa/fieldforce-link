# Corrigir e reforçar o estado «Sem Material»

## O que encontrei
- Desde agosto não ficou gravada nenhuma pausa por «Falta de Material», mas há anexos «Falta material» enviados em outubro e novembro (WO-2026-0547 e WO-2026-0572).
- Nessas OTs, a sessão ficou fechada como «Assinatura do Gerente», sem a descrição do material. Ou seja, o anexo foi enviado, mas o motivo da pausa não ficou guardado. Por isso a OT nunca aparece em «Sem Material».
- O botão de pausa faz vários passos separados: envia o anexo, fecha a sessão, muda o estado e retira os técnicos. Se um passo falhar a meio, fica tudo a meio. O técnico volta a tentar e escolhe outro motivo.
- Hoje, «Sem Material» só é deduzido do motivo da última pausa. Não é um estado da OT, e o gerente não tem como marcar a OT assim.

Ainda não confirmei qual dos passos falhou nessas OTs. O primeiro passo é reproduzir o problema com um técnico de teste.

## O que vou fazer
1. **Pausa num só passo seguro.** Uma única operação no servidor fecha a sessão com o motivo e a descrição, muda o estado da OT e retira os técnicos. Ou corre tudo, ou não muda nada. Se falhar, o técnico vê o erro em vez de um aviso de sucesso.
2. **Marca própria de «Sem Material» na OT.** A OT fica marcada até alguém voltar a trabalhar nela, a concluir ou a reatribuir. A marca deixa de depender da última sessão. Assim, uma pausa posterior com outro motivo já não a apaga sem querer.
3. **O gerente também pode marcar e desmarcar.** No detalhe da OT, com descrição obrigatória e anexo opcional. Os emails de aviso são os mesmos de hoje.
4. **Filtro «Sem Material».** Na lista de OTs do gerente e no indicador do painel, que passa a abrir essa lista.
5. **Recuperar as OTs afetadas.** Marco a WO-2026-0547 e a WO-2026-0572 como «Sem Material» se ainda estiverem pendentes, usando os anexos que já existem.
6. **Teste** para a regra: pausar por falta de material faz a OT aparecer em «Sem Material» e retomar o trabalho tira-a de lá.

## Detalhes técnicos
- Nova coluna `work_orders.missing_material_since timestamptz` e `missing_material_note text`.
- Novo RPC SECURITY DEFINER `pause_work_order(_entry, _reason, _note)`: valida que a sessão é do utilizador, atualiza `time_entries`, define o estado (pending, ou in_progress se houver outras sessões), preenche a marca e chama `release_assignments_for_missing_material`.
- A marca é limpa por trigger ao iniciar uma sessão nova, ao concluir, faturar ou cancelar, e pelo `reassign_previous_technicians`.
- `fetchMissingMaterialIds`, EmployeeDashboard e EmployeeMissingMaterial passam a ler a coluna. O separador do técnico e a regra «nunca em Pausadas» mantêm-se.
- O upload dos anexos continua antes do RPC. Se o RPC falhar, mostra o erro e não envia os emails.
