# NIF preenchido pelo proprio cliente

## Situacao atual
- So o gerente consegue escrever o NIF (ao criar ou editar um cliente).
- O cliente nao tem onde o introduzir: a pagina "Perfil" nao tem campos de dados da empresa e o registo pede so nome, email e password.

## O que muda
- Pagina "Perfil" (clientes): nova caixa "Dados de faturacao" com Nome da empresa, NIF, Telefone e Morada, e botao "Guardar".
- NIF validado: 9 digitos (aceita espacos, que sao retirados). Campo opcional.
- Registo: campo "NIF (opcional)" no formulario de criar conta.
- O que o cliente guardar aparece logo ao gerente (lista de clientes) e e usado automaticamente nos orcamentos.

## Detalhe tecnico
- Sem alteracoes a base de dados: profiles.nif ja existe e a regra "Users can update own profile" ja permite ao cliente editar o seu perfil.
- `src/pages/Profile.tsx`: formulario com update em profiles (company_name, nif, phone, address) para o utilizador atual, mostrado a clientes.
- `src/pages/Auth.tsx` + signUp: enviar nif nos metadados e, apos registo, gravar em profiles quando houver sessao (ou o cliente completa no Perfil).
- Teste unitario da validacao do NIF (9 digitos).
