
# Plano: Rastreamento de Tempo Individual por Funcionário

## ✅ IMPLEMENTADO

## Resumo do Problema

Atualmente, quando um funcionário inicia, pausa ou termina uma ordem de trabalho, isso afeta o **status global** da ordem para todos. Por exemplo:
- Se 2 funcionários estão a trabalhar na mesma OT e um pausa, a ordem fica "pendente" para ambos
- Se um funcionário completa a ordem, ela fica "completa" para todos

## Solução Implementada

Cada funcionário tem agora o seu próprio controlo de tempo **independente**:
- Cada funcionário pode iniciar/pausar/retomar o seu próprio trabalho sem afetar os outros
- O total de horas do cliente é a soma de todas as horas de todos os funcionários
- O status da ordem de trabalho é baseado na atividade de **todos** os funcionários

---

## Mudanças Implementadas

### 1. ✅ Lógica de Status da Ordem de Trabalho

**Novo comportamento:**
- **in_progress**: Se pelo menos UM funcionário está com sessão ativa (time entry sem end_time)
- **pending**: Se nenhum funcionário está com sessão ativa, mas a OT não está concluída
- **completed**: Apenas quando um gerente ou funcionário explicitamente marca como concluída

### 2. ✅ Dashboard do Funcionário (EmployeeDashboard.tsx)

**Mudanças implementadas:**
- A visualização mostra o estado do **próprio funcionário**, não da OT global
- Um funcionário vê "Retomar" se **ele** tem sessões pausadas (não se outro funcionário pausou)
- Categorização baseada no estado individual do funcionário:
  - activeOrders: ordens onde O FUNCIONÁRIO tem sessão ativa
  - startedOrders: ordens onde o funcionário já trabalhou mas não tem sessão ativa
  - newOrders: ordens onde o funcionário nunca trabalhou

### 3. ✅ Pausa de Trabalho (PauseWorkOrderDialog.tsx)

**Mudanças implementadas:**
- Pausa apenas a sessão do funcionário atual
- Verifica se há outras sessões ativas de outros funcionários
- Se SIM: mantém status como in_progress
- Se NÃO: muda status para pending
- Mensagem de feedback diferenciada conforme o caso

### 4. ✅ Conclusão de Trabalho (CompleteWorkOrderDialog.tsx)

**Duas opções implementadas:**
1. **"Terminar Minha Sessão"** - Finaliza apenas a sessão do funcionário e mantém a OT ativa para outros
2. **"Concluir Ordem de Trabalho"** - Marca a OT como concluída, finaliza todas as sessões ativas, gera PDF

**Funcionalidades adicionais:**
- Verifica e mostra quais funcionários ainda estão ativos
- Aviso visual quando outros funcionários têm sessões ativas

### 5. ✅ Dashboard do Cliente (ClientDashboard.tsx)

Já estava correto - soma todas as horas de todos os funcionários via `time_entries`.

### 6. ✅ Detalhes da Ordem (WorkOrderDetails.tsx)

**Melhorias implementadas:**
- Mostra o estado de cada funcionário (Ativo, Pausado, Novo) com ícones visuais
- Mostra horas individuais por funcionário
- Indicadores visuais coloridos para cada estado

---

## Ficheiros Modificados

| Ficheiro | Status |
|----------|--------|
| `src/pages/EmployeeDashboard.tsx` | ✅ Implementado |
| `src/components/work-orders/PauseWorkOrderDialog.tsx` | ✅ Implementado |
| `src/components/work-orders/CompleteWorkOrderDialog.tsx` | ✅ Implementado |
| `src/pages/WorkOrderDetails.tsx` | ✅ Implementado |

---

## Fluxo de Uso

**Cenário: 2 funcionários (João e Maria) atribuídos à mesma OT**

1. **João inicia** → OT fica "in_progress", João vê timer a contar
2. **Maria inicia** → OT continua "in_progress", Maria também vê timer
3. **João pausa** → João finaliza sua sessão
   - Sistema verifica: Maria ainda tem sessão ativa? Sim → OT mantém "in_progress"
   - João vê "Retomar", Maria continua a ver timer
4. **Maria pausa** → Maria finaliza sua sessão
   - Sistema verifica: Há outras sessões ativas? Não → OT muda para "pending"
5. **João retoma** → Nova sessão para João, OT volta a "in_progress"
6. **Conclusão** → Quando alguém clica "Concluir OT", todas as sessões são finalizadas
