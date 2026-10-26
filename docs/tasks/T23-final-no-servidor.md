# T23 — Final no servidor com primeira resposta exclusiva

- **Depende de:** [T14](./T14-motor-comum-de-partida.md), [T22](./T22-classificacao-e-vidas.md)
- **Pacotes:** server, shared
- **Marco:** M3
- **Branch sugerido:** `task/23-final-no-servidor`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Implementar a disputa de vidas com uma única resposta aceita por pergunta e dano aplicado uma única vez.

## Leia antes

- [regras.md](../regras.md)
- [plano-do-jogo.md](../plano-do-jogo.md)
- [arquitetura.md](../arquitetura.md)
- [decisoes.md](../decisoes.md)

## Decisões confirmadas em 23/10/2026

D02: sem resposta no prazo, todos os participantes ainda ativos perdem uma vida. D03: sem escolha de alvo em seis segundos, sortear entre todos os ativos, incluindo quem acertou. A escolha manual continua restrita aos adversários. D09: se mais de um for eliminado na mesma resolução, os empatados disputam o minigame de tiro da [T39](./T39-desempate-tiro-top-down.md), inclusive se todos os ativos chegarem a zero juntos; ver [decisões](../decisoes.md).

A integração T39 aplica perda coletiva D02, sorteio D03 inclusive do autor e encaminhamento de grupos eliminados ao minigame. Testes de domínio/serviço/rede foram atualizados e o e2e verifica perda coletiva, combate e pódio. As evidências anteriores abaixo permanecem históricas.

## Entregáveis

- [x] Na fila da sala, aceitar a primeira resposta válida e fechar a pergunta antes de avaliar o gabarito.
- [x] Em erro, retirar uma vida do autor; em acerto, autorizar somente esse ator a escolher outro participante com vida.
- [x] Aplicar uma perda ao alvo, resolver eliminação e iniciar pergunta inédita ou declarar o último sobrevivente.
- [x] Integrar prazos, autoridade de tempo, envelopes de ação e projeções sem dados privados, preservando efeito único em reenvios.
- [x] Aplicar D02 como resolução coletiva atômica: tirar uma vida de cada ativo, incluindo desconectados, sem atingir eliminados nem duplicar perdas em callbacks/reenvios.
- [x] Aplicar D03 com sorteio pela porta de aleatoriedade do servidor, entre todos os ativos com a mesma chance, incluindo quem acertou e desconectados; registrar o alvo uma única vez para reconexão e repetição.
- [x] Atualizar histórico, schemas e projeções para dano coletivo e grupos eliminados simultaneamente; encaminhar cada grupo à T39 sem declarar campeão ou fixar posições por ordem de conexão. Integrar o resultado ao pódio por T25/T36.

## Critérios de aceite

- [x] Primeiro errado seguido de outro correto produz uma perda no primeiro e nenhuma avaliação da segunda tentativa.
- [x] Duas respostas corretas concorrentes concedem um único direito de ataque.
- [x] Uma pergunta respondida não acumula erro e ataque; reenvio não restaura vidas nem duplica dano.
- [x] Na escolha manual, alvo desconectado continua elegível se tiver vidas; eliminado ou autor do ataque não é alvo válido.
- [x] No sorteio automático, permitir que o próprio autor seja atingido; excluir eliminados e preservar um único dano por ataque.
- [x] O motor não concede vitória por placar ao atingir um limite arbitrário de perguntas.

## Verificação

- [x] Integrar respostas concorrentes, resposta exatamente no prazo, pacote inválido e tentativa de espectador.
- [x] Testar líder com quatro perdas e quinta eliminação, ataque repetido e alvo já eliminado.
- [x] Evidência histórica: testar suspensão sem dano por ausência de resposta/alvo antes das respostas de D02/D03. Essa pausa será substituída pelas políticas aprovadas.
- [x] Validar perda coletiva com sobreviventes e eliminações simultâneas; sorteio que atinge o autor, um adversário ou desconectado; prazo exato, callback atrasado, reconexão e repetição sem novo dano/sorteio.

## Implementação e evidências do núcleo

`final.domain.ts` implementa instruções, leitura, disputa exclusiva, escolha de alvo, resolução, eliminação, sobrevivente e interrupção. Registra um subestado interno de resposta ocupada antes de comparar o gabarito. Cada erro ou ataque confirma um único dano e histórico; ausência de conteúdo interrompe sem campeão. Timers usam contexto/pergunta/revisão, e preparação com falha retoma sem recalcular perda.

`final:start` só aceita contexto de partida e exige anfitrião, protótipo concluído, classificação T22 pronta e estoque suficiente. Conserva vidas iniciais, pontos/acertos históricos e escopo `isolated-prototype`. Repetir o início não reinicia vidas. `answer:submit` confirma `first-valid`; `target:choose` retira uma vida do adversário ativo escolhido pelo autor do acerto, mesmo se o alvo estiver desconectado. Identidade, papel, fase e prazo são revalidados na fila.

As projeções explícitas omitem recibos, gabarito antecipado, IDs editoriais e seleção. Publicam vidas atuais, a única resolução e progresso com `questionCount: null`, sem teto artificial de perguntas. `final-no-answer-pending` e `final-no-target-pending` representam D02/D03 sem fallback; o anfitrião pode encerrar esses testes voltando ao lobby. A UI da final permanece na T24.

Em 19/10/2026, `pnpm test` passou com **371 testes do servidor, 169 de shared, 109 da web, 32 de conteúdo e 5 de artes**, total **686**. Lint, tipagem e build passaram. Os testes cobrem 2/3/4/12 participantes, líder eliminado só na quinta perda, dano único, concorrência, inválidos, prazo exato, alvo ausente/eliminado, reconexão, estoque e falha de preparação seguida de retomada.

Socket.IO percorre seis perguntas reais do catálogo publicado para obter classificação, inicia a final e verifica WebSocket/polling: pacote e opção inválidos, espectador, resposta no prazo exato, primeiro erro seguido de acerto rejeitado, dois acertos concorrentes, um único ataque, conexão substituta com prazo preservado e alvo desconectado. As duas pendências também foram exercitadas em rede. A matriz de navegador não foi repetida nesta etapa de servidor; final com interface real será verificada na T24.

Guia: [final-no-servidor.md](../final-no-servidor.md). As evidências acima antecedem as respostas de D02/D03/D06, sem alterar então `PENDING_DECISIONS` ou `decisoes.md`. As escolhas estão registradas em 23/10/2026 e foram aplicadas na integração T39. Não havia cache de ack por `actionId` nesta entrega; o domínio impedia reaplicação do efeito mesmo com outro ID, e robustez de ações/frequência foi encaminhada às tarefas posteriores.

## Cuidados de implementação

Recepção e desempate técnico de concorrência pertencem ao servidor. Nunca aceitar timestamp do cliente como prova de ter respondido antes.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
