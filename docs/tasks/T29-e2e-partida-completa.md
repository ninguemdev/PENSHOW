# T29 — Testes ponta a ponta da partida completa

- **Depende de:** [T26](./T26-reconexao-e-ciclo-de-vida.md), [T27](./T27-catalogo-de-teste-completo.md), [T28](./T28-privacidade-limites-e-concorrencia.md)
- **Pacotes:** e2e, web, server, data
- **Marco:** M4
- **Branch sugerido:** `task/29-e2e-partida-completa`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Demonstrar que todas as modalidades e a final funcionam juntas com navegadores e servidor reais.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [regras.md](../regras.md)
- [arquitetura.md](../arquitetura.md)

## Entregáveis

- [ ] Cobrir criação, seis fases, placar, conversão em vidas, primeira resposta exclusiva, pódio e revanche.
- [ ] Adicionar cenários de aposta, roubo e dinamite com as variantes confirmadas em D04/D05.
- [ ] Exercitar reconexão, anfitrião ausente e rejeição de respostas/ataques repetidos.
- [ ] Expandir CI com fixtures isoladas, artefatos de falha e verificação de catálogo/assets.

## Critérios de aceite

- [ ] O fluxo completo usa o cálculo real dos serviços, sem mockar vitória ou pular efeitos de regras.
- [ ] Testes são reproduzíveis e não usam serviços externos de perguntas.
- [ ] Formato acelerado para teste preserva as regras e não altera os parâmetros da produção.
- [ ] Documentar falha real e diagnóstico quando um cenário não passar; não marcar sucesso apenas por compilar.

## Verificação

- [ ] Executar o percurso completo com duas identidades em navegadores e os cenários de falha prioritários.
- [ ] Cobrir capacidade de 12 por integração real de sockets; complementar com teste manual do navegador para não multiplicar custo sem ganho.

## Cuidados de implementação

Evitar sleeps e dependência da duração normal de uma partida. Usar estados observáveis e perfil de timing exclusivo para testes.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
