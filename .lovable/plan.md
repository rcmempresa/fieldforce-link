
## Problema

Nas estatísticas de horas de um funcionário (página **Funcionários** → botão do calendário/relógio de um funcionário) só existem três cartões: **Hoje**, **Esta Semana** e **Este Mês**. Não há nenhum sítio onde apareçam as horas dos meses anteriores, por isso o trabalho feito em Junho/Maio/Abril fica "invisível" nas estatísticas, mesmo estando registado na base de dados.

Confirmei na BD que existem registos de tempo em todos os meses (Jan → Jul 2026). Os dados estão lá; o ecrã é que não os mostra.

Na página **Clientes** já existe um separador "Mensal" com os últimos 12 meses — vou replicar essa mesma lógica na página **Funcionários**.

## O que vai mudar

Na página `/employees`, no diálogo de cada funcionário:

1. Passa a haver um novo separador **"Mensal"** ao lado de "Resumo" e "Por OT".
2. Esse separador lista as horas trabalhadas pelo funcionário nos **últimos 12 meses**, um mês por linha (ex.: "junho de 2026 — 40h"), ordenados do mais recente para o mais antigo, escondendo meses sem horas.
3. No separador "Resumo" adiciona-se ainda um cartão **"Total (últimos 12 meses)"** para ter a soma acumulada visível.

O agrupamento continua a usar a data real de execução (`start_time` do registo de tempo), consistente com o resto da app.

## Alterações técnicas

- `src/pages/Employees.tsx`
  - Estender o tipo `HoursStats` com `monthlyHistory: { month: Date; hours: number; label: string }[]`.
  - Em `fetchEmployeeHours`, após o loop existente, construir um mapa dos últimos 12 meses (`subMonths(now, i)` com `i` de 0 a 11) e acumular `duration_hours` por `format(start_time, 'yyyy-MM')`.
  - Guardar o array ordenado desc no `hoursStats`.
  - No JSX: mudar `TabsList` para `grid-cols-3`, adicionar `TabsTrigger value="monthly"` e `TabsContent` correspondente (mesmo estilo do que existe em `src/pages/Clients.tsx` linhas 898-923).
  - Adicionar o cartão "Total (últimos 12 meses)" no separador "Resumo".

Nenhuma alteração à base de dados, RLS, ou a outras páginas.
