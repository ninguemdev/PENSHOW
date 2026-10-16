# T28 — Privacidade, limites e concorrência

- **Depende de:** [T26](./T26-reconexao-e-ciclo-de-vida.md)
- **Pacotes:** server, shared, web
- **Marco:** M4
- **Branch sugerido:** `task/28-privacidade-limites-e-concorrencia`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Auditar os limites e as projeções de todas as modalidades antes de disponibilizar o jogo a grupos externos.

## Leia antes

- [arquitetura.md](../arquitetura.md)
- [plano-do-jogo.md](../plano-do-jogo.md)

## Entregáveis

- [ ] Revisar autorização, tamanho/frequência de comandos, capacidade e limpeza de salas/sessões/timers.
- [ ] Executar matriz de privacidade de gabarito, explicação, apostas, respostas alheias, futuras perguntas e dados de sessão.
- [ ] Estressar concorrência entre resposta, prazo, queda e escolha de alvo com múltiplas salas independentes.
- [ ] Verificar logs de diagnóstico sem conteúdo sensível e erros públicos sem detalhes internos.

## Critérios de aceite

- [ ] Carga numa sala não corrompe outra; a fila continua após comandos rejeitados.
- [ ] Jogadores não atravessam salas ou papéis por IDs fornecidos no payload.
- [ ] Anfitrião e espectador não obtêm gabarito antecipado por HTTP ou socket.
- [ ] Sala encerrada não retém timers nem aceita comandos de uma partida antiga.

## Verificação

- [ ] Testar spam limitado, payload grande, ação de outro jogador, espectadores e várias salas com 12 participantes.
- [ ] Inspecionar mensagens em cada estado e confirmar ausência dos campos privados, inclusive em erro/reconexão.

## Cuidados de implementação

Essas proteções começam nas tarefas de base; esta é uma auditoria integrada, não autorização para adiar validação ou autenticação.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
