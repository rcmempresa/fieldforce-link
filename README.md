# NR Tech Solução — Sistema de Gestão de Ordens de Trabalho

Aplicação web para gerir ordens de trabalho (OT): clientes, equipamentos, técnicos,
horas, pausas, materiais, relatórios de manutenção e faturação.

**Endereço**: https://nrtechsolucion.pt

## Funcionalidades principais

- Ordens de trabalho com estados, agenda por turnos e atribuição de técnicos
- Registo de horas por técnico, com separação entre horário laboral e pós-laboral
- Equipamentos por cliente, com categorias, histórico de intervenções e anexos
- Relatórios editáveis por equipamento (climatização, eletricidade, geradores,
  intervenção, etc.) com assinatura digital e exportação em PDF
- Controlo de materiais aplicados e catálogo de materiais
- Contratos de horas por cliente com bloqueio quando o saldo é esgotado
- Notificações por email em eventos críticos (OT atribuída, pausada, concluída)
- Perfis de acesso: gerente, técnico e cliente

## Tecnologias

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Base de dados, autenticação e ficheiros fornecidos pela plataforma onde a
  aplicação está alojada

## Desenvolvimento local

Pré-requisito: Node.js (https://nodejs.org)

```sh
git clone <URL_DO_REPOSITÓRIO>
cd <NOME_DO_PROJETO>
npm install
npm run dev
```

A aplicação fica disponível em http://localhost:8080

## Domínio próprio

Para ligar um domínio, use a definação de publicação da plataforma onde a
aplicação está alojada (seção de domínios).
