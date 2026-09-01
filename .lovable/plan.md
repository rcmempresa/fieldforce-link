# Adicionar campos laboral / pós-laboral: cliente + Gerenciar Horas

## Contexto
Os checkboxes "Trabalho laboral" e "Trabalho pós-laboral" já existem na criação e edição de OT pelo gerente (`CreateWorkOrderDialog` e `EditWorkOrderDialog`) e são guardados nas colunas `is_labor_hours` e `is_after_hours` da tabela `work_orders`. No entanto, o diálogo de criação de OT pelo **cliente** (`CreateClientWorkOrderDialog`) não tem estes campos — o cliente não consegue indicar se o trabalho é laboral ou pós-laboral.

## Objetivo
Permitir que o cliente, ao criar uma solicitação de OT, selecione se o trabalho é laboral e/ou pós-laboral, para que o gerente e os técnicos vejam essa informação ao aprovar.

## Alterações
1. **`src/components/work-orders/CreateClientWorkOrderDialog.tsx`**
   - Adicionar `is_labor_hours` e `is_after_hours` ao `formData` (ambos `false` por defeito).
   - Adicionar a UI dos dois checkboxes (igual ao `CreateWorkOrderDialog`):
     ```tsx
     <div className="space-y-2">
       <Label>Regime de Trabalho</Label>
       <div className="flex flex-col gap-2">
         <label className="flex items-center gap-2 cursor-pointer">
           <input type="checkbox" checked={formData.is_labor_hours}
             onChange={(e) => setFormData({ ...formData, is_labor_hours: e.target.checked })} />
           <span className="text-sm">Trabalho laboral</span>
         </label>
         <label className="flex items-center gap-2 cursor-pointer">
           <input type="checkbox" checked={formData.is_after_hours}
             onChange={(e) => setFormData({ ...formData, is_after_hours: e.target.checked })} />
           <span className="text-sm">Trabalho pós-laboral</span>
         </label>
       </div>
     </div>
     ```
   - Incluir `is_labor_hours` e `is_after_hours` no `insert` em `work_orders`.
   - Limpar os campos no reset do formulário após submeter.

2. **Sem alterações à base de dados** — as colunas já existem e aceitam `null`/`boolean`.

3. **`src/components/work-orders/EditTimeEntriesDialog.tsx`** (Gerenciar Horas)
   - Buscar o regime da OT: ao abrir o diálogo, fazer `select is_labor_hours, is_after_hours from work_orders where id = workOrderId` e guardar num estado `woRegime`.
   - Mostrar badges junto ao título (igual ao `WorkOrderDetails`):
     - "Laboral" (verde) quando `is_labor_hours`
     - "Pós-laboral" (âmbar) quando `is_after_hours`
   - Assim o gerente e o técnico vêem o regime ao gerir/registar horas.

## Verificação
- Abrir o diálogo "Nova Solicitação de Serviço" como cliente e confirmar que os checkboxes aparecem.
- Submeter uma OT com um dos checkboxes marcado e verificar no `WorkOrderDetails` que o badge correspondente aparece.
- Abrir "Gerenciar Horas" numa OT e confirmar que os badges Laboral/Pós-laboral aparecem junto à referência.
