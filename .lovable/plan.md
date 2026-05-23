## Problema

Na "Folha de OT" (PDF gerado ao concluir uma OT), quando há vários funcionários atribuídos, os nomes dos colegas aparecem como **"N/A"** em vez do nome real.

## Causa

Em `CompleteWorkOrderDialog.tsx` (~linha 276) e `EditTimeEntriesDialog.tsx`/regeneração de PDF, o nome de cada funcionário é obtido via join `time_entries → profiles!time_entries_user_id_fkey(name)`. As RLS atuais da tabela `profiles` permitem apenas:

- O próprio utilizador ver o seu perfil
- Managers verem todos
- Employees verem perfis de **clientes** de OTs atribuídas

Não existe regra que permita a um funcionário ver o perfil de **outro funcionário** atribuído à mesma OT. Logo, o join devolve `null` e o código cai no fallback `"N/A"`.

O mesmo se aplica ao `assignments → user:profiles` (linha 295) e à secção "Horas por Funcionário" no detalhe da OT quando vista por outro funcionário.

## Correção

Adicionar uma policy SELECT em `public.profiles` que permita a um funcionário ver o perfil de outros funcionários atribuídos a **uma OT que também lhe está atribuída**:

```sql
CREATE POLICY "Employees can view co-assigned employee profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'employee'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.work_order_assignments woa_self
    JOIN public.work_order_assignments woa_other
      ON woa_other.work_order_id = woa_self.work_order_id
    WHERE woa_self.user_id = auth.uid()
      AND woa_other.user_id = profiles.id
  )
);
```

Isto resolve o "N/A" no PDF, na regeneração do PDF e no cartão "Horas por Funcionário" da página de detalhes, sem expor perfis fora do contexto das OTs partilhadas.

## Ficheiros alterados

- Nova migration SQL (apenas a policy acima). Sem alterações de código frontend — o nome passa a vir corretamente nos joins já existentes.