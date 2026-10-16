# T20 — Modalidade de roubo de pontos

- **Depende de:** [T17](./T17-primeiro-marco-jogavel.md), [T13](./T13-pontuacao-e-parametros.md)
- **Pacotes:** server, web, shared
- **Marco:** M3
- **Branch sugerido:** `task/20-fase-roubo`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Adicionar interação por transferência de pontos com direito ao roubo explícito e saldo consistente.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [regras.md](../regras.md)
- [decisoes.md](../decisoes.md)

## Decisões em consulta

D05 define quem rouba. O plano de trabalho atual usa somente o primeiro acerto; confirmar a variante antes de consolidar esta modalidade, sem bloquear tarefas independentes.

## Entregáveis

- [ ] Implementar o direito ao roubo conforme D05 e preservar +100 para cada resposta correta.
- [ ] No formato proposto, identificar a primeira resposta correta depois de fechar as respostas e abrir seis segundos de alvo.
- [ ] Transferir mínimo de 50 e saldo disponível do alvo, após creditar os acertos; sem alvo ou escolha, não transferir.
- [ ] Exibir autor, alvo, valor efetivo e decomposição do saldo; atualizar protocolo da escolha de alvo.

## Critérios de aceite

- [ ] Mais rápido errado não bloqueia um acerto posterior nesta fase; isso difere da final.
- [ ] Somente ator autorizado escolhe alvo; não escolhe a si mesmo nem participante inexistente.
- [ ] Transferência não cria pontos e nunca deixa o alvo negativo.
- [ ] A view não revela o primeiro acerto enquanto houver respostas abertas.

## Verificação

- [ ] Testar primeira resposta errada, dois acertos concorrentes e ausência de acertos.
- [ ] Testar alvo com 30, saldo atualizado após acerto, escolha tardia e ataque reenviado.

## Cuidados de implementação

Se D05 mudar para vários ladrões, atualizar a política de resolução e os exemplos antes de implementar essa variante. Não misturar política de roubo de pontos com ataque de vidas.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
