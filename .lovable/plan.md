# Adicionar Relatório de Intervenção editável

## Objetivo
Adicionar aos relatórios da OT uma nova opção **Relatório de Intervenção**, baseada na folha enviada, que possa ser preenchida, guardada como rascunho, reaberta para edição e exportada em PDF.

## O que será feito
- Adicionar “Intervenção” ao menu de novos relatórios e à lista de relatórios existentes.
- Criar um formulário próprio com os campos do documento: cliente, instalação, data, CC, proposta, contrato, equipamentos, materiais, descrição do serviço, utilização de EMM, linhas de execução, quilómetros, observações e assinaturas.
- Preencher automaticamente os dados já disponíveis na OT e permitir acrescentar/remover linhas de equipamentos, materiais e execução.
- Guardar todos os dados do formulário no relatório para poder continuar a edição posteriormente.
- Gerar um PDF com a estrutura visual da folha enviada e anexá-lo automaticamente à OT.
- Manter as permissões atuais: quem pode editar relatórios pode editar este; os restantes apenas consultam e descarregam.

## Detalhes técnicos
- Criar um campo JSON no registo de relatórios para os dados específicos da intervenção, sem alterar os relatórios atuais.
- Criar componentes e gerador de PDF próprios para este tipo de relatório.
- Atualizar a listagem para reconhecer o tipo `intervention`.
- Validar gravação, reabertura, PDF e apresentação em telemóvel e computador.
