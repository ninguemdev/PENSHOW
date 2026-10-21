# Testes da partida completa — T29

A matriz usa o modo clássico integrado da T36: quatro modalidades de pontuação distintas e a final na quinta posição. Navegadores e sockets usam o aplicativo real, catálogo publicado, seleção, fila de sala, pontuação, classificação, vidas e pódio. O processo de teste consulta a pergunta privada apenas para escolher uma alternativa já oferecida; não injeta pontuação, vitória ou visões no cliente.

As políticas D02–D06 continuam em consulta. Roubo e dinamite são as variantes experimentais existentes. As finalizações sem resposta ou alvo são verificadas como pausas sem dano; o desempate não é escolhido pelo teste. Por isso, a execução da matriz não consolida as regras nem conclui essas dependências de produto.

## Execução

```sh
pnpm questions:check
pnpm avatars:check
pnpm build
pnpm test:e2e:classic
pnpm --filter @penshow/server exec vitest run src/modules/matches/match.realtime.test.ts -t T29
```

`test:e2e:classic` executa somente a matriz integrada. `test:e2e:run` continua executando todos os percursos, incluindo os protótipos históricos. O perfil de testes está em `e2e/classic-fixture.ts`, separado dos parâmetros padrão: reduz leitura, revelação, resultados e seleção de aposta, com relógios e transporte reais. A janela de resposta e as regras de pontuação permanecem as da configuração experimental. A carência reduzida de transferência do anfitrião é exclusiva desse perfil.

Cada teste cria aplicativo/preview próprios, catálogo local e contextos de navegador independentes. Portas de backend são atribuídas pelo sistema; o preview usa porta estrita e um worker. Requisições externas são bloqueadas. Não há rotas públicas de teste, serviços externos de perguntas, sleeps nem alteração do estado para pular fases.

`classic-group.ts` prepara perfis e sala pela interface e aguarda o commit de cada comando antes de consumir a etapa seguinte. Nas transições automáticas, espera a revisão observada antes da ação, evitando aguardar um timer da etapa seguinte por uma corrida entre renderização e rede. Após recarga, a recuperação inicial é confirmada pelos controles visíveis; a auditoria passiva dos eventos não substitui essa confirmação.

## Matriz de navegadores

Os mesmos cenários rodam em desktop 1280×900 e celular 360×780 com toque emulado.

| Cenário | Evidência esperada |
|---|---|
| Aposta → Roubo → Dinamite → Velocidade → Final | Aposta zero na abertura, saldo conservado até liquidação, roubo após dois acertos, turnos exclusivos/inversos, pontos acumulados e conversão em vidas |
| Quiz simples → Velocidade → Aposta → Roubo → Final | Outra ordem oficial, aposta coberta pelo saldo acumulado, transferência real, final na quinta posição |
| Recarga, pódio e revanche em cada sequência | Mesmo plano/IDs após recarga; quatro resumos na ordem efetiva; sobrevivente e eliminações; outra partida com placar zero, mesma sala/perfis/fila |
| Anfitrião ausente durante resposta | Outro participante assume; resposta já registrada e prazo não mudam; anfitrião retorna como participante sem refazer o sorteio |
| Controle substituído por outra aba | Aba anterior perde controle; nova aba recupera a resposta definitiva e não oferece outra tentativa; uma liquidação |
| Sala vazia entre fases | Aguarda antes de publicar a fase seguinte; não consome pergunta nem altera placar/histórico; retoma com o mesmo plano |
| 12 participantes na interface | Duas identidades de navegador e dez convidados por HTTP/socket reais; 12 avatares e linhas de placar; 24 turnos de dinamite; inspeção de largura e captura por dispositivo |

O sorteio é controlado apenas pela porta de aleatoriedade do servidor depois da criação da sala. O cliente não envia a ordem das fases. O conjunto das duas sequências cobre as cinco modalidades; a enumeração das 120 ordens e o orçamento de conteúdo continuam na evidência da T36.

## Integração com 12 sockets

`match.realtime.test.ts`, no grupo T29, percorre cinco fases com 12 identidades autenticadas e o catálogo publicado. As escolhas produzem pontuações distintas sem resolver D06 artificialmente. Durante a segunda fase, o anfitrião cai, a carência real da configuração do servidor expira pelo relógio injetado e a identidade retorna em outra conexão, preservando plano e partida.

Na final, os 12 clientes disputam a mesma pergunta: uma resposta é aceita e as demais recebem `QUESTION_CLOSED`. O ataque consome uma vida; o reenvio com outro ID de ação é recusado sem alterar o estado. O percurso continua por comandos autenticados até sobrar um jogador. Todos os clientes recebem o mesmo plano, classificação, histórico e pódio. O novo anfitrião prepara a revanche; placar reinicia, comandos da partida antiga são recusados e o encerramento limpa salas/timers.

Outros dois percursos completos exercitam D02/D03: expirar a resposta ou o alvo conserva vidas, classificação e histórico de dano, remove o timer da partida e exige retorno explícito ao lobby. São verificações do comportamento pendente, sem aprovar um fallback.

## CI, artefatos e limites

O job `full-match` depende de `quality`, verifica catálogo/artes, compila o aplicativo e executa a matriz integrada em uma máquina independente. O job `smoke` mantém os percursos históricos e exclui os títulos `modo padrão:`/`modo completo:`, para não duplicar a matriz nova. A descoberta de testes pode ser conferida localmente com `--list` nos mesmos comandos. A execução hospedada depende de publicar o branch; não é presumida pela configuração local.

Falhas preservam trace, capturas dos navegadores, relatório HTML e `estado-publico.json`, construído pelas projeções públicas de cada membro. O checkpoint, sessões/tokens, mapeamentos editoriais e respostas futuras não entram nesse anexo. A captura `grupo-12-dinamite.png` permite inspeção assistida do grupo grande em cada dispositivo. Os diretórios de resultados continuam ignorados por Git.

Esta matriz complementa os testes de autorização, concorrência entre salas e limpeza da T28. A inspeção com 12 conexões não mede capacidade de produção nem equivale a uma sessão com 12 pessoas. As regras pendentes e as evidências executadas ficam na [T29](tasks/T29-e2e-partida-completa.md).
