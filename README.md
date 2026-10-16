# PENSHOW

Jogo multiplayer de perguntas e respostas para jogar com amigos pelo navegador. Crie uma sala, escolha seu nome e monte seu personagem para disputar fases com regras diferentes.

O desempenho nas primeiras cinco fases determinará a vantagem na final: **1º lugar com 5 vidas, 2º com 4, 3º com 3 e os demais com 2**. Assim, sobrevivem respectivamente a 4, 3, 2 e 1 perdas de vida; a perda seguinte elimina. Na final, só a primeira resposta de cada pergunta é avaliada: se errar, o jogador perde uma vida; se acertar, escolhe qualquer adversário ainda na disputa para tirar uma vida. A pergunta se encerra após essa jogada.

## Estado do projeto

Planejamento inicial e preparação do banco de perguntas. A aplicação ainda não foi implementada e não há uma versão jogável publicada.

O projeto parte da arquitetura do [Comicle](https://github.com/ninguemdev/Comicle), especialmente suas salas, identidade de convidado, nomes e avatares. As fases têm como referência a dinâmica de programas de perguntas do [Brain Show](https://store.steampowered.com/app/2235150/).

## Planejamento

- [Plano detalhado do jogo](docs/plano-do-jogo.md): cada fase, quantidade de perguntas, pontos, tempos, exemplos, final e casos de borda.
- [Plano de desenvolvimento](docs/planejamento.md): entregas, prioridades e critérios de conclusão.
- [Tasks de implementação](docs/tasks/README.md): 35 tarefas com dependências, módulos, entregáveis, aceite e verificações, no formato do Comicle.
- [Análise do Comicle](docs/analise-comicle.md): módulos examinados e adaptações necessárias.
- [Referência do Brain Show](docs/referencia-brain-show.md): evidências e propostas para o PENSHOW.
- [Regras em discussão](docs/regras.md): o que foi definido e o que precisa ser decidido.
- [Arquitetura](docs/arquitetura.md): organização, responsabilidades e contratos previstos.
- [Banco de perguntas](docs/perguntas.md): fontes, categorias, revisão e expansão.
- [Decisões](docs/decisoes.md): regras confirmadas, propostas em consulta e escolhas de etapas posteriores.

## Ferramentas de conteúdo

Requer Node.js 24. Não há dependências externas nesta etapa.

```sh
npm run questions:validate
npm test
```

Os arquivos em `data/questions/candidates` são candidatos à revisão editorial. Não devem ser usados automaticamente numa partida. As fontes e suas licenças estão em `data/sources.json` e `data/licenses`.

Coleta inicial: **1.531 candidatos**, sendo **531 em português para revisão** e **1.000 em inglês para tradução**. Nenhum foi marcado como aprovado. O objetivo de expansão é chegar a 5.000 perguntas revisadas em pt-BR.

```sh
npm run questions:import
npm run questions:import:opentdb -- --amount=1000
```

O segundo comando faz uma coleta opcional em inglês, respeitando o intervalo da fonte; o material precisa de tradução e revisão antes de entrar no jogo. A importação é uma ferramenta de preparação: partidas não dependerão de serviços externos de perguntas.
