# Técnicos podem editar avarias frequentes

Hoje os técnicos só conseguem sugerir avarias novas; editar e apagar é só para o gerente.

## O que muda
- Em cada equipamento, na secção «Avarias frequentes», os técnicos passam a ver o botão de lápis (Editar) em todas as avarias, e podem alterar o sintoma e as causas/resoluções.
- Apagar avarias continua a ser só para o gerente.
- O botão de adicionar passa a dizer «Avaria» também para técnicos.

## Detalhes técnicos
- Migração: nova política RLS `UPDATE` em `equipment_model_faults` para `has_role(auth.uid(),'employee')` (USING e WITH CHECK).
- `EquipmentKnowledge.tsx`: mostrar botão editar com `isStaff`; manter botão apagar com `isManager`.
- Verificar com sessão de técnico que a edição grava.
