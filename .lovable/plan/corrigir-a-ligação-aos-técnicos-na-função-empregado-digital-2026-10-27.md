# Corrigir a ligação aos técnicos na função empregado-digital

## O que muda
Nas ações `listar_ots` e `detalhe_ot`, a ligação aos técnicos atribuídos passa a usar explicitamente a ligação pelo técnico (`user_id`). Hoje a ligação é ambígua porque também existe `assigned_by`.

## Detalhes técnicos
- Ficheiro: `supabase/functions/empregado-digital/index.ts`
- Nos dois selects, trocar `work_order_assignments(user_id, profiles(name))` por `work_order_assignments(user_id, profiles!work_order_assignments_user_id_fkey(name))`.
- Voltar a publicar a função e confirmar que um segredo errado continua a dar 401.
