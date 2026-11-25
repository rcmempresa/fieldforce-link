# Indisponibilidades dos técnicos no assistente digital

## O que muda
- O assistente passa a saber quando um técnico está de férias, baixa, folga, feriado ou outro motivo.
- Novas ações: listar, adicionar e remover indisponibilidades.
- «Disponibilidade da equipa» passa a indicar quem está indisponível hoje e porquê.
- Ao atribuir um técnico a uma OT num dia em que está indisponível, o assistente avisa e pergunta se confirma. Se o gerente confirmar, a atribuição avança.

## Ajustes à especificação
1. A tabela de indisponibilidades ainda não existe, por isso é criada primeiro (início, fim, motivo, notas, quem criou).
2. O aviso «Confirmas mesmo assim?» não tinha forma de confirmar. Junto o parâmetro `forcar: true` para o agente repetir o pedido e concluir a atribuição.
3. Valido `user_id`, `unavail_id` e `created_by` como identificadores válidos e confirmo que `user_id` é técnico ou gerente, para não gravar registos inválidos.
4. Se houver indisponibilidades sobrepostas no mesmo dia, o aviso usa a primeira em vez de dar erro.

## Detalhes técnicos
- Migração `profile_unavailabilities`: id uuid PK, user_id uuid -> profiles(id) on delete cascade (FK chamada `profile_unavailabilities_user_id_fkey`), start_date date, end_date date, check end_date >= start_date, reason text check in (ferias,baixa,folga,feriado,outro) default 'ferias', notes text, created_by uuid -> profiles(id), created_at timestamptz. Índice (user_id, start_date, end_date).
- RLS ativo: gerentes podem tudo; técnicos leem só as suas. GRANT a authenticated e service_role.
- `empregado-digital/index.ts`: 3 novos cases conforme especificação (`isDate` adicionado se não existir); `disponibilidade_equipa` com `unavailable_today` e `unavailable_reason`; `atribuir_tecnico_ot` com verificação antes do upsert (usa `.limit(1)`, ignora se `p.forcar === true`), devolve 409 com `warning:true`; ações adicionadas a `supported`.
- Testes Deno para validação de datas/motivo e para o aviso/forçar; voltar a publicar a função; atualizar docs/assistente-orcamentos.md (secção do agente) com as novas ações.
