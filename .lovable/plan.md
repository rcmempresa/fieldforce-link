## Objetivo

Cada cliente passa a poder ter **vários endereços de email adicionais**. Quando o sistema envia uma notificação para o cliente (OT criada, aprovada, concluída, pausada por falta de material, etc.), o email vai para o email principal **e** para todos os emails extra registados nesse cliente.

## O que vai mudar

### 1. Base de dados — nova tabela `client_emails`

Guarda os emails adicionais por cliente:

- `user_id` → o cliente (referência ao perfil)
- `email` → endereço de email
- `label` → rótulo opcional (ex.: "Financeiro", "Diretor")
- `created_at`, `updated_at`

Regras de acesso (RLS):
- Gerentes: ver, criar, editar e apagar todos.
- Cliente: ver e gerir apenas os seus próprios emails extra.
- Funcionários: ler emails dos clientes das OTs que lhes estão atribuídas (para envios automáticos via edge function — feitos com service role, sem impacto direto).

Restrição: `(user_id, email)` único — evita duplicados para o mesmo cliente.

### 2. Edge function `send-notification-email`

Sempre que o destinatário é um cliente (eventos: OT criada, aprovada/rejeitada, agendada, atribuída, iniciada, pausada, concluída, falta de material, etc.), a função passa a:

1. Obter o email principal (como hoje).
2. Buscar todos os emails extra do cliente em `client_emails`.
3. Enviar o **mesmo** email (assunto, HTML, anexos) para o principal e para cada email extra.
4. Registar cada envio em `email_logs` para rastreio.

Falhas num email extra não bloqueiam os outros.

### 3. Interface — gestão dos emails extra

Na página **Clientes**, no diálogo de edição de cada cliente, nova secção **"Emails adicionais"**:

- Lista os emails extra com rótulo.
- Botão **Adicionar email** → input de email + rótulo opcional.
- Botão **Remover** por linha (com confirmação).
- Validação básica do formato do email e bloqueio de duplicados.

O email principal (de login) continua a ser editado como hoje e não aparece nesta lista.

Os clientes também passam a ver e gerir os seus próprios emails extra na área "O meu perfil" (dashboard de cliente).

## Fora de âmbito

- Não se mexe nos emails de funcionários nem de gerentes (cada um continua com 1 email).
- Não há mudança no email de **login** do cliente — os emails extra são apenas para **receção de notificações**, não dão acesso à conta.
- Não se altera o conteúdo dos templates de email.

## Detalhes técnicos

- Migration cria a tabela com GRANTs (`authenticated`, `service_role`), RLS e políticas descritas, mais trigger `update_updated_at_column`.
- `send-notification-email` consulta `client_emails` com o service role (já usado na função). Lista final de destinatários = `[emailPrincipal, ...extras]` deduplicada (case-insensitive).
- UI: pequeno componente `ClientExtraEmails` reutilizado em `EditClientDialog` e no perfil do cliente, com queries Supabase diretas (insert/delete).
