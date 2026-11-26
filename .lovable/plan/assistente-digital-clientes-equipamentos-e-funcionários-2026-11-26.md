# Assistente digital: clientes, equipamentos e funcionários

Aplicar o ficheiro enviado ao assistente (empregado-digital).

## O que muda
1. **editar_cliente** passa a aceitar `email`: atualiza o primeiro email do cliente ou cria-o se não existir.
2. Novas ações:
   - **listar_equipamentos**: pesquisa por nome/marca/modelo/nº série, com filtro opcional por cliente.
   - **criar_equipamento**: cria um equipamento para um cliente (categoria, tipo, marca, modelo, séries interior/exterior, ano, local, notas).
   - **editar_equipamento**: encontra um único equipamento (com filtro por cliente opcional); se houver vários iguais, devolve a lista em vez de escolher um ao acaso.
   - **criar_funcionario**: cria a conta como técnico aprovado; se algo falhar, apaga a conta criada a meio.
   - **editar_funcionario**: altera nome, telefone, morada e NIF de um técnico.
3. Juntar as 5 ações novas à lista de ações suportadas.

## Uma alteração de segurança ao ficheiro
O ficheiro devolve a password temporária do novo funcionário na resposta do assistente, o que a deixaria no histórico do chat/WhatsApp. Em vez disso, a conta é criada e o funcionário recebe o email «Definir password» (o mesmo fluxo de recuperação que já existe). A resposta indica `password_email_sent: true`.

## Detalhes técnicos
- Ficheiro: `supabase/functions/empregado-digital/index.ts` (schemas ~linha 43 e os cases 914-929), mais testes em `index.test.ts` para: email no editar_cliente, equipamento ambíguo devolve 400, falha ao criar funcionário apaga a conta.
- Correr os testes, publicar a função e atualizar `docs/assistente-orcamentos.md` com as novas ações.
