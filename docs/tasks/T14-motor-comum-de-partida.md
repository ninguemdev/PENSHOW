# T14 — Motor comum da partida e das fases

- **Depende de:** [T08](./T08-salas-realtime-e-projecao.md), [T12](./T12-selecao-de-temas-e-perguntas.md), [T13](./T13-pontuacao-e-parametros.md)
- **Pacotes:** server, shared
- **Marco:** M2
- **Branch sugerido:** `task/14-motor-comum-de-partida`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Orquestrar fases por uma máquina de estados pura, mantendo serviços, efeitos e transporte separados.

## Leia antes

- [arquitetura.md](../arquitetura.md)
- [plano-do-jogo.md](../plano-do-jogo.md)

## Entregáveis

- [ ] Criar agregado de partida, estados discriminados e contrato pequeno de estratégia de modalidade.
- [ ] Modelar início, instruções, escolha de tema, leitura, resposta, revelação e resultado de fase.
- [ ] Executar efeitos e timers na fila da sala, com IDs de partida/fase/pergunta, relógio e agendador injetados.
- [ ] Congelar participantes/configuração e emitir visões atualizadas após transições aceitas.

## Critérios de aceite

- [ ] Timer atrasado de outra pergunta ou partida não avança a atual.
- [ ] Troca de modalidade ocorre pelo registro de estratégias; não há switch de regra espalhado por handler e componente.
- [ ] Uma falha de processamento não reaplica pontuação nem bloqueia a sala.
- [ ] Máquina pode operar com só a modalidade clássica no primeiro protótipo, sem simular modalidades não implementadas.

## Verificação

- [ ] Testar transições válidas/inválidas, prazo exato, todos responderam e próximo passo agendado.
- [ ] Testar cancelamento de timer, ordem de efeitos, comando repetido e encerramento da partida.

## Cuidados de implementação

Não criar microsserviços, barramento de eventos ou hierarquia genérica sem uso. Final terá domínio próprio e será incorporada pela T23.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
