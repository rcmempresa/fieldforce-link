
# Plano: Rastreamento de Tempo Individual por Funcionário

## Resumo do Problema

Atualmente, quando um funcionário inicia, pausa ou termina uma ordem de trabalho, isso afeta o **status global** da ordem para todos. Por exemplo:
- Se 2 funcionários estão a trabalhar na mesma OT e um pausa, a ordem fica "pendente" para ambos
- Se um funcionário completa a ordem, ela fica "completa" para todos

## Solução Proposta

Cada funcionário terá o seu próprio controlo de tempo **independente**:
- Cada funcionário pode iniciar/pausar/retomar o seu próprio trabalho sem afetar os outros
- O total de horas do cliente será a soma de todas as horas de todos os funcionários
- O status da ordem de trabalho será baseado na atividade de **todos** os funcionários

---

## Mudanças a Implementar

### 1. Lógica de Status da Ordem de Trabalho

**Novo comportamento:**
- **in_progress**: Se pelo menos UM funcionário está com sessão ativa (time entry sem end_time)
- **pending**: Se nenhum funcionário está com sessão ativa, mas a OT não está concluída
- **completed**: Apenas quando um gerente ou funcionário explicitamente marca como concluída

### 2. Dashboard do Funcionário (EmployeeDashboard.tsx)

**Mudanças principais:**
- A visualização mostrará o estado do **próprio funcionário**, não da OT global
- Um funcionário verá "Retomar" se **ele** tem sessões pausadas (não se outro funcionário pausou)
- O botão "Concluir" só completa a sessão atual do funcionário (não a OT inteira)
- Nova opção para "Terminar Meu Trabalho" sem concluir a OT

**Estados por funcionário:**
- "Iniciar" - Funcionário nunca trabalhou nesta OT
- "Retomar" - Funcionário tem sessões anteriores mas nenhuma ativa
- "Pausar" - Funcionário está atualmente a trabalhar (com sessão ativa)
- "Em Execução" - Mostrar apenas se O FUNCIONÁRIO tem sessão ativa

### 3. Pausa de Trabalho (PauseWorkOrderDialog.tsx)

**Mudanças:**
- Pausar apenas a sessão do funcionário atual
- **Não** mudar o status global da OT para "pending" se outros funcionários ainda estão a trabalhar
- Verificar se há outras sessões ativas antes de mudar o status

### 4. Conclusão de Trabalho (CompleteWorkOrderDialog.tsx)

**Duas opções:**
1. **"Terminar Minha Sessão"** - Finaliza a sessão do funcionário mas mantém a OT ativa
2. **"Concluir Ordem de Trabalho"** - Marca a OT como concluída (pode requerer confirmação se outros funcionários têm sessões ativas)

### 5. Dashboard do Cliente (ClientDashboard.tsx)

**Já está correto** - soma todas as horas de todos os funcionários via `time_entries`.

### 6. Dashboard do Gerente (ManagerDashboard.tsx)

**Melhorias:**
- Mostrar quais funcionários estão atualmente ativos em cada OT
- Mostrar horas individuais por funcionário
- Indicar visualmente se há múltiplos funcionários a trabalhar

---

## Detalhes Técnicos

### Alterações em EmployeeDashboard.tsx

```text
- Modificar fetchAssignedOrders() para determinar o estado do funcionário atual:
  - has_active_session: boolean (se TEM sessão sem end_time)
  - has_previous_sessions: boolean (se já trabalhou antes)
  
- Modificar categorização de ordens:
  - activeOrders: ordens onde O FUNCIONÁRIO tem sessão ativa
  - startedOrders: ordens onde o funcionário já trabalhou mas não tem sessão ativa
  - newOrders: ordens onde o funcionário nunca trabalhou

- Atualizar handleStartWork():
  - Criar nova time_entry para o funcionário
  - Apenas atualizar status para in_progress se não estava já
  
- Atualizar lógica de exibição:
  - TimeTracker mostra apenas quando O FUNCIONÁRIO tem sessão ativa
```

### Alterações em PauseWorkOrderDialog.tsx

```text
- Após pausar a sessão do funcionário:
  - Verificar se há OUTRAS sessões ativas (de outros funcionários)
  - Se SIM: manter status como in_progress
  - Se NÃO: mudar status para pending
  
- Query para verificar:
  SELECT count(*) FROM time_entries 
  WHERE work_order_id = :id 
  AND end_time IS NULL 
  AND user_id != :current_user_id
```

### Alterações em CompleteWorkOrderDialog.tsx

**Opção A - Terminar Sessão:**
- Finalizar apenas a time_entry do funcionário atual
- Verificar se há outras sessões ativas
- Atualizar status conforme necessário (in_progress ou pending)

**Opção B - Concluir OT:**
- Finalizar todas as time_entries ativas de todos os funcionários
- Marcar OT como completed
- Gerar PDF e notificações

### Nova Query para Verificar Sessões Ativas

```sql
-- Verificar se há outros funcionários a trabalhar
SELECT COUNT(*) as active_count
FROM time_entries
WHERE work_order_id = $1
  AND end_time IS NULL
  AND user_id != $2
```

---

## Fluxo de Uso Exemplo

**Cenário: 2 funcionários (João e Maria) atribuídos à mesma OT**

1. **João inicia** → OT fica "in_progress", João vê timer a contar
2. **Maria inicia** → OT continua "in_progress", Maria também vê timer
3. **João pausa** → João finaliza sua sessão
   - Sistema verifica: Maria ainda tem sessão ativa?
   - Sim → OT mantém "in_progress"
   - João vê "Retomar", Maria continua a ver timer
4. **Maria pausa** → Maria finaliza sua sessão
   - Sistema verifica: Há outras sessões ativas?
   - Não → OT muda para "pending"
5. **João retoma** → Nova sessão para João, OT volta a "in_progress"
6. **Conclusão** → Quando alguém clica "Concluir OT", todas as sessões são finalizadas

---

## Ficheiros a Modificar

| Ficheiro | Tipo de Alteração |
|----------|-------------------|
| `src/pages/EmployeeDashboard.tsx` | Lógica de estados por funcionário |
| `src/components/work-orders/PauseWorkOrderDialog.tsx` | Verificar outras sessões antes de mudar status |
| `src/components/work-orders/CompleteWorkOrderDialog.tsx` | Adicionar opção de terminar sessão vs concluir OT |
| `src/pages/ManagerDashboard.tsx` | Mostrar funcionários ativos |
| `src/pages/WorkOrderDetails.tsx` | Mostrar estado de cada funcionário |

---

## Resumo Visual

```text
┌─────────────────────────────────────────────────────────┐
│                    ORDEM DE TRABALHO                    │
├─────────────────────────────────────────────────────────┤
│  Status Global: in_progress                             │
│  Total Horas: 5.5h                                      │
├─────────────────────────────────────────────────────────┤
│  Funcionários:                                          │
│  ┌─────────────┬──────────┬─────────┐                   │
│  │ Nome        │ Estado   │ Horas   │                   │
│  ├─────────────┼──────────┼─────────┤                   │
│  │ João        │ ⏸ Pausado│ 2.0h    │                   │
│  │ Maria       │ ▶ Ativo  │ 1.5h    │                   │
│  │ Pedro       │ ○ Novo   │ 0.0h    │                   │
│  └─────────────┴──────────┴─────────┘                   │
└─────────────────────────────────────────────────────────┘
```
