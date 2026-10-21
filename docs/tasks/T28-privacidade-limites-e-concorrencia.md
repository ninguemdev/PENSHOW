# T28 — Privacidade, limites e concorrência

- **Depende de:** [T26](./T26-reconexao-e-ciclo-de-vida.md)
- **Pacotes:** server, shared, web
- **Marco:** M4
- **Branch sugerido:** `task/28-privacidade-limites-e-concorrencia`

O status desta tarefa fica somente no [índice](README.md). A implementação e as verificações estão registradas nas evidências abaixo.

## Objetivo

Auditar os limites e as projeções de todas as modalidades antes de disponibilizar o jogo a grupos externos.

## Leia antes

- [arquitetura.md](../arquitetura.md)
- [plano-do-jogo.md](../plano-do-jogo.md)

## Entregáveis

- [x] Revisar autorização, tamanho/frequência de comandos, capacidade e limpeza de salas/sessões/timers.
- [x] Executar matriz de privacidade de gabarito, explicação, apostas, respostas alheias, futuras perguntas e dados de sessão.
- [x] Estressar concorrência entre resposta, prazo, queda e escolha de alvo com múltiplas salas independentes.
- [x] Verificar logs de diagnóstico sem conteúdo sensível e erros públicos sem detalhes internos.

## Critérios de aceite

- [x] Carga numa sala não corrompe outra; a fila continua após comandos rejeitados.
- [x] Jogadores não atravessam salas ou papéis por IDs fornecidos no payload.
- [x] Anfitrião e espectador não obtêm gabarito antecipado por HTTP ou socket.
- [x] Sala encerrada não retém timers nem aceita comandos de uma partida antiga.

## Verificação

- [x] Testar spam limitado, payload grande, ação de outro jogador, espectadores e várias salas com 12 participantes.
- [x] Inspecionar mensagens em cada estado e confirmar ausência dos campos privados, inclusive em erro/reconexão.

## Evidências

- [Auditoria integrada](../privacidade-limites-e-concorrencia.md): limites operacionais, matriz de exposição, fronteiras HTTP/socket e suítes correspondentes.
- Limites por identidade/IP persistem após troca de conexão; eventos inválidos/sem callback também consomem orçamento. Tabelas têm capacidade e limpeza, sem timers novos.
- Três salas com 12 jogadores em Socket.IO real: uma fila bloqueada não impede outra, alvos duplicados transferem uma vez, prazos mantêm placares independentes e sala fechada recusa contexto antigo.
- Disputas com 12 jogadores entre alvo antes/no prazo, queda e callbacks antigos preservam uma única resolução e não retêm timers após fechar a sala.
- Contrato público inclui `RATE_LIMITED`/`SERVER_BUSY`; resposta, aposta e alvo recusados por frequência permitem nova tentativa manual na web, sem envio automático.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` aprovados. Foram 765 testes: 34 de conteúdo, 5 de artes, 176 de shared, 416 de server e 134 de web. `pnpm questions:check` verificou o catálogo privado de 300 perguntas.
- `pnpm test:e2e:run`: 16 testes aprovados em 20,7 minutos, com os oito fluxos de smoke em desktop e celular emulado, incluindo inspeção das mensagens HTTP/socket, final, pódio, revanche, modalidades, reconexão e reinício.
- O modo integrado completo continua nas T36/T29; os cenários desta auditoria não respondem D02–D06 nem medem capacidade de produção.

## Cuidados de implementação

Essas proteções começam nas tarefas de base; esta é uma auditoria integrada, não autorização para adiar validação ou autenticação.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
