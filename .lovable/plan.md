# Manuais e avarias frequentes por modelo de equipamento

Ainda não existe na app: os equipamentos só têm anexos genéricos. Os manuais e as avarias passam a ficar ligados à **marca + modelo**, por isso aparecem em todos os equipamentos iguais, seja qual for o cliente.

## O que vais ver
Dentro de cada equipamento, dois separadores novos:

1. **Manuais**
   - Manual de peças e manual técnico (PDF ou imagem), com o nome do ficheiro e um botão para o abrir.
   - O gerente envia e apaga os manuais; os técnicos podem consultá-los.

2. **Avarias frequentes**
   - Lista de avarias. Cada avaria tem o **sintoma** (ex.: "Máquina de lavar copos – água do tanque fria") e as **possíveis causas/resoluções**, uma por linha (ex.: termóstato de segurança ativo; termóstato de temperatura aberto; resistência fundida).
   - Pesquisa por palavra; cada avaria abre para mostrar as causas.
   - O gerente cria, edita e apaga avarias; os técnicos consultam e também podem sugerir uma avaria nova.
   - Os clientes não veem nenhum dos dois separadores.

Também fica um atalho «Manual / Avarias» na OT, ao lado de cada equipamento, para o técnico consultar no local.

Se o equipamento não tiver modelo preenchido, aparece o aviso «Preenche a marca e o modelo para ver manuais e avarias».

## Detalhes técnicos
- Chave do modelo: marca + modelo normalizados (minúsculas, sem espaços duplicados).
- Novas tabelas `equipment_model_manuals` (brand_key, model_key, kind 'parts'|'technical', filename, url, uploaded_by) e `equipment_model_faults` (brand_key, model_key, symptom, causes text[], created_by), com GRANTs e RLS: gerente gere tudo, funcionário lê e insere avarias, clientes sem acesso.
- Os ficheiros vão para um armazenamento privado, com links temporários para abrir.
- Novos componentes `EquipmentManuals` e `EquipmentFaults`, usados no detalhe/histórico do equipamento e em WorkOrderDetails.
