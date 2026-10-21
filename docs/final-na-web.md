# Final na web

A T24 conecta a web ao protótipo da final implementado na T23. Depois de um quiz isolado, a tela mostra a classificação congelada e a conversão de pontos/colocação para vidas. Quando a classificação está pronta, somente o anfitrião vê **Iniciar final de teste**. Empate pendente conserva o aviso de desempate e não disponibiliza o início. Falta de perguntas é informada pelo servidor sem alterar o resultado anterior.

## Instruções e disputa

`final-round.tsx` renderiza as projeções explícitas da final. As instruções mostram as regras, os prazos publicados e a atribuição inicial de vidas. A conversão possui uma animação curta de entrada, desabilitada com `prefers-reduced-motion`; a informação inteira permanece disponível em texto.

A leitura reutiliza o enunciado comum sem alternativas. Quando as respostas abrem, somente participantes ativos recebem botões. A store valida contexto, horário, papel e vidas antes de enviar `answer:submit`; o servidor continua sendo a autoridade. O envio bloqueia outro clique nesta conexão/pergunta, sem calcular acerto ou alterar vidas.

**Clicar não confirma prioridade.** O estado local distingue envio em andamento, confirmação `first-valid`, rejeição explícita de pergunta fechada/fase/prazo/contexto e falha de confirmação. O ack confirma somente a prioridade; autor, gabarito e dano vêm da projeção. Uma confirmação atrasada de outra pergunta ou conexão não reaparece na etapa atual. Falha de rede oferece recuperação do estado, conservando a tentativa bloqueada até a reconciliação.

## Escolha e resolução

Depois do acerto confirmado, todos veem o primeiro respondente e a resposta correta. Só o autor recebe botões de ataque, com o prazo oficial e os IDs elegíveis publicados. Cada botão informa nome e vidas; adversários desconectados continuam disponíveis, identificados em texto. O comando envia apenas contexto, pergunta e alvo, sem vidas ou dano calculados no cliente.

A resolução apresenta quem respondeu, erro ou ataque, perda de exatamente uma vida, contagem anterior/atual e eventual eliminação. A pergunta está encerrada e não contém novos controles de resposta ou ataque. O painel mantém as vidas atuais em uma lista com anúncios acessíveis, números e estado por escrito, sem depender de cor, som ou movimento. Ao mudar etapa/pergunta, o foco vai ao título correspondente.

Eliminados e espectadores acompanham enunciado, alternativas abertas, escolha de alvo e resolução sem controles de jogo. Uma recarga/reconexão usa a visão atual da sala para restaurar a mesma etapa e o prazo, inclusive quando o jogador foi eliminado ou estava escolhendo alvo. A store também impede que esses espectadores enviem ações diretamente.

O único sobrevivente recebe o aviso de vitória e o [pódio da T25](podio-e-revanche.md), com classificação final, histórico das fases e ação de preparar revanche. Somente o anfitrião retorna o grupo ao lobby.

## Consultas de regras

D02 e D03 continuam em consulta. `final-no-answer-pending` e `final-no-target-pending` mostram uma pausa explícita, sem botões de resposta/ataque nem dano inventado. O anfitrião pode encerrar o protótipo voltando ao lobby. Não há fallback novo nesta interface. A sequência completa das cinco fases permanece fora deste protótipo.

## Verificação

`final-flow.test.tsx` cobre conversão, início, prontidão, leitura, confirmação atrasada, primeiro erro, rejeição e timeout, alvo offline, exclusividade, eliminação, espectador e as duas pausas. As fixtures passam pelos contratos públicos reais. A suíte existente continua cobrindo descarte de ack antigo, sessão substituída e bloqueio até receber uma visão atual.

`e2e/tests/final-smoke.spec.ts` usa duas identidades, catálogo publicado, servidor e relógios reais. Obtém classificação jogando seis perguntas pela web, disputa respostas, verifica dano único, recarrega a escolha com prazo preservado, ataca adversário desconectado e acompanha eliminação/reconexão até o aviso de sobrevivente e retorno ao lobby. A auditoria passiva verifica privacidade e erros de navegador. Os projetos desktop e celular emulado exercitam teclado/toque e ausência de rolagem horizontal.

Com o build disponível:

```sh
pnpm --filter @penshow/e2e exec playwright test final-smoke.spec.ts
```

Capturas e relatórios ficam em `e2e/test-results/` e `e2e/playwright-report/`, ignorados pelo Git. A execução e os resultados registrados ficam na [T24](tasks/T24-final-na-web.md).
