# T15 — Quiz clássico no servidor

- **Depende de:** [T14](./T14-motor-comum-de-partida.md)
- **Pacotes:** server, shared
- **Marco:** M2
- **Branch sugerido:** `task/15-quiz-classico-servidor`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Implementar a primeira modalidade completa com resposta simultânea, revelação e placar.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [regras.md](../regras.md)
- [arquitetura.md](../arquitetura.md)

## Entregáveis

- [ ] Implementar seis perguntas, distribuição de dificuldade, leitura, liberação de alternativas e resposta definitiva.
- [ ] Creditar +100 por acerto, zero por erro/ausência, com IDs opacos de alternativas gerados no servidor.
- [ ] Criar projeções de participante/espectador antes e depois da revelação, incluindo progresso e placar.
- [ ] Implementar encerramento do protótipo de uma fase e atualização dos contratos disponíveis.

## Critérios de aceite

- [ ] Cada participante responde no máximo uma vez; espectador não responde.
- [ ] Gabarito e explicação só chegam após fechar as respostas; anfitrião também não tem acesso antecipado.
- [ ] Resposta fora do prazo não pontua; reenviar comando não credita novamente.
- [ ] Modo curto fica restrito a desenvolvimento/teste e não aparece como partida completa de seis fases.

## Verificação

- [ ] Integrar duas ou mais sessões com respostas corretas, erradas e ausentes.
- [ ] Cobrir fronteira de prazo, payload inválido, reconexão após responder e matriz de privacidade.

## Cuidados de implementação

Usar as funções de T13 e a seleção de T12. A implementação não deve inferir acerto pela posição de uma opção na fonte.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
