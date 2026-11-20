# Horas do mês completas no painel do técnico

## O que se passa
No painel do técnico, os cartões **«Horas [mês]»**, **«Horas Laborais»** e **«Horas Pós-laborais»** leem as sessões do técnico diretamente. Desde o bloqueio das OTs fechadas, as sessões das OTs «A faturar», «Faturada» e «Aguarda nota de encomenda» deixaram de entrar nessas contas. Por isso, os totais do mês aparecem mais baixos do que são.

Os cartões «Horas Hoje» e «Horas Semana» já contam todos os estados.

## O que vou fazer
- Os três cartões do mês passam a somar **todas as horas do técnico**, seja qual for o estado da OT. Isto vale também quando se muda de mês no calendário.
- O técnico continua sem conseguir abrir ou ver os detalhes das OTs fechadas. Só recebe as horas: data, duração e regime laboral ou pós-laboral.

## Detalhes técnicos
- Nova função SECURITY DEFINER `my_time_entries_since(_from timestamptz)`, que devolve apenas start_time, duration_hours e work_regime das sessões de `auth.uid()`. EXECUTE só para authenticated.
- Em `EmployeeDashboard.tsx`, a leitura dos últimos 12 meses (cerca da linha 231) passa a usar esta função em vez da tabela de sessões. O resto do cálculo mensal e laboral/pós-laboral fica igual.
- Confirmar com uma consulta que o total de novembro de um técnico real é igual à soma das sessões dele em todos os estados.
