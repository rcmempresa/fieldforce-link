# Como funciona agora a conclusão de OTs

Não é preciso mudar mais nada: a correção já está feita. Explicação:

## O que acontecia antes
- Quando um técnico carregava em «Concluir OT», o PDF era gerado, mas a OT não mudava de estado e aparecia um erro.
- Motivo: os técnicos deixam de ver as OTs fechadas («A faturar», «Faturada», «Aguarda nota de encomenda»). Ao tentar pôr a OT em «A faturar», o sistema bloqueava porque o técnico ia deixar de a ver.
- Os gerentes não tinham este problema.

## O que acontece agora
1. O técnico preenche a conclusão como sempre (observação, materiais, assinatura do cliente).
2. Carrega em «Concluir OT».
3. O sistema confirma que quem conclui é o técnico atribuído à OT ou um gerente. Outro técnico não consegue.
4. A OT passa para «A faturar».
5. O cliente e os gerentes recebem o aviso de que a OT está pronta a faturar. A Folha de OT e os relatórios seguem por email como antes, também para geral@nrtechsolucion.pt.
6. A OT desaparece da lista do técnico. As horas dele continuam a contar no painel e no perfil.
7. Se der algum erro, aparece agora a mensagem real, para ser mais fácil perceber o que falhou.

## O que testar
- Pedir a um técnico (por exemplo, o Nuno) para concluir uma OT atribuída a ele e confirmar que fica em «A faturar» na conta do gerente.
