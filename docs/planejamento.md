# Plano de desenvolvimento

## Objetivo

**Atualização de 23/10/2026:** as respostas D01–D08 estão em [decisões](decisoes.md), com regras e plano do jogo atualizados. O código ainda precisa aplicar e validar as novas políticas; os registros iniciais abaixo são históricos. A publicação segue o modelo do Comicle e fica por último, após o usuário criar a VM e as demais entregas estarem prontas.

**Atualização de 26/10/2026:** a pedido do usuário, o piloto foi instalado na VM existente do Comicle, tipo `c7i-flex.large`, via MCP AWS/SSM. Está disponível em [dionel.site/penshow/](https://dionel.site/penshow/). Convite com cinco jogadores, início do clássico e reconexão passaram em desktop e celular emulado no destino real. As rotas Cloudflare do domínio principal estão ativas; o conteúdo de 5.000 e as validações humanas continuam pendentes; ver [evidências](validation/t35-piloto-compartilhado.md).

Criar um quiz multiplayer para navegador com a entrada simples do Comicle e modalidades variadas inspiradas no Brain Show. No modo clássico padrão solicitado em 20/10/2026, quatro modalidades distintas são sorteadas e seu placar se converte em vantagem na final, sempre a quinta fase. A [T36](tasks/T36-modo-classico-padrao.md) integra esse formato.

O desenho de cada fase está no [plano detalhado do jogo](plano-do-jogo.md): pontos, quantidade de perguntas, tempos, escolha de temas, dificuldade, exemplos, final, telas e casos de borda. Os números são propostas de protótipo, exceto as regras da final já confirmadas.

A execução foi decomposta em [39 tasks de implementação](tasks/README.md), com arquivo por tarefa, dependências, critérios de aceite e verificações. O índice das tasks é o único controle de status de implementação; as etapas P01 a P09 abaixo descrevem o escopo geral e conservam o registro do planejamento inicial. O [registro de decisões](decisoes.md) reúne as respostas e o trabalho de aplicação. A T39 acrescenta o desempate de eliminações simultâneas por tiro 2D top-down, integrado à final antes da publicação, que continua por último.

## Estado inicial

| Entrega | Estado |
|---|---|
| Inspeção do código público do Comicle e mapa de reaproveitamento | Concluída nesta etapa |
| Pesquisa das informações públicas do Brain Show | Concluída com limites documentados |
| Estrutura e sequência de implementação | Planejadas |
| Coleta inicial de candidatos a perguntas, procedência e validação estrutural | 531 em português e 1.000 em inglês importados; nenhum aprovado editorialmente |
| Plano de cada fase, pontos, tempos, exemplos e duração | Documentado; seis escolhas consultadas e valores provisórios identificados |
| Backlog de implementação no formato do Comicle | 35 tarefas documentadas; todas pendentes de implementação |
| Aprovação das propostas, revisão editorial e aplicação jogável | Pendentes |

## Entregas em ordem

### P01 — Base do projeto

Criar os três pacotes do monorepo e configurar TypeScript estrito, lint, formatação, Vitest e builds. Manter contratos em um lugar e textos visíveis em pt-BR. Verificar dependências e gerar lockfile próprio.

Aceite: web e servidor iniciam localmente; contratos são importados pelos dois; verificações passam; nenhuma dependência do editor de quadrinhos é carregada.

### P02 — Perfil e personagem

Migrar catálogo, artes, editor e renderizador de avatares, normalização do apelido e armazenamento seguro do perfil. Adaptar nomes de pacote, estilos e chaves locais. Preservar a licença dos arquivos reutilizados.

Aceite: montar personagem, sortear aparência, salvar nome e reabrir o navegador preservam o perfil; catálogo inválido é sanitizado; navegação por teclado e celular funcionam. Perguntar sobre direção visual antes de finalizar a identidade do site.

### P03 — Salas e reconexão

Migrar sessões anônimas, códigos, convites, anfitrião e presença. Separar as dependências de histórias. Construir lobby com configurações de quiz, espectadores e fila por sala.

Aceite: duas sessões entram por código/link; só anfitrião inicia/configura; queda e retorno preservam identidade; aba substituída não joga; expulsão e sala cheia têm tratamento visível. Antes de consolidar, confirmar limite de jogadores e política de queda.

### P04 — Perguntas e primeira partida curta

Revisar uma amostra distribuída pelos temas, criar catálogo de conteúdo publicado separado dos candidatos e implementar quiz clássico. Criar seleção de tema, cronômetro do servidor, resposta única, revelação e placar.

Aceite: partida real com amigos funciona de ponta a ponta; gabarito não chega antes da revelação; nenhuma pergunta se repete; ausência e requisições repetidas não quebram o placar. Não chamar os candidatos importados de perguntas revisadas.

### P05 — Motor de fases e modalidades

Criar estratégias e fases de instrução/resultados; adicionar velocidade, aposta, roubo e dinamite em incrementos separados, conforme as fichas do plano do jogo. Aposta proposta: 0 / 25 / 50; roubo confirmado em D05 e aplicado em T20: primeiro acerto transfere até 100, com +100 por acerto para todos; dinamite proposta: dois turnos por participante, +300 / −150. Incorporar as respostas sobre roubo e quinta fase antes de implementar os respectivos formatos e ajustar equilíbrio observando partidas curtas.

Aceite: cinco fases completas; cada modalidade explica sua regra; transições não dependem do anfitrião responder; ninguém recebe tempo já vencido; pontuação e transferências são determinísticas.

### P06 — Final e pódio

Aplicar as decisões de [regras](regras.md): vidas iniciais de 5 / 4 / 3 / 2 para sobreviver a 4 / 3 / 2 / 1 perdas. Na final, aceitar apenas a primeira resposta de cada pergunta: erro tira uma vida do autor; acerto permite tirar uma vida de qualquer adversário ativo. Encerrar a jogada e seguir para uma nova pergunta, sem outras tentativas na mesma. Incorporar as respostas das consultas sobre prazo sem resposta e ausência de escolha do alvo; validar o desempate proposto de pontos, acertos e sorteio residual. Implementar conversão do placar, danos, eliminação, espectadores, vitória e revanche.

Aceite: o líder permanece com uma vida após quatro perdas e é eliminado na quinta; o mesmo princípio produz eliminação na quarta, terceira e segunda perdas para as outras faixas. Duas respostas concorrentes produzem somente uma resposta aceita; se a primeira estiver errada, a segunda é rejeitada sem novo dano. Somente o autor da resposta correta escolhe um alvo, e o ataque tira uma única vida. Reconectar não restaura vidas nem duplica dano; a disputa termina com o último jogador ainda com vida.

### P07 — Banco amplo e qualidade editorial

Expandir para pelo menos 5.000 perguntas revisadas em pt-BR, equilibradas por tema e dificuldade. Esse é um objetivo de conteúdo, não a contagem já entregue. Priorizar pelo menos 50 perguntas publicáveis por tema antes da primeira versão de grupo e crescer sem bloquear os protótipos.

Aceite: fonte e licença por registro, resposta única, alternativas plausíveis, correções registradas, ausência de duplicatas e relatório por tema. Conteúdo desatualizado ou ambíguo fica fora do sorteio.

### P08 — Interface, som e testes em grupo

Refinar palco, personagens, leitura das perguntas, transições, feedback de resposta, indicador de conexão e pódio. Sons próprios, volume/silêncio e redução de movimento. Priorizar celular e computador, sem exigir gráficos 3D.

Aceite: navegação por teclado, contraste, botões confortáveis para toque, cronômetro legível e instruções compreensíveis; validar com 2, 4 e 12 participantes e conexões lentas. Ajustar duração e agressividade dos ataques com dados das partidas.

### P09 — Publicação

Definir destino de hospedagem e caminho público. Preparar build, configuração, documentação local, healthcheck e proxy com WebSocket. Confirmar a política de encerramento após reinício.

Aceite: ambiente de teste passa por partida completa, reconexão e revanche; cliente não carrega o banco de gabaritos; configurações de PENSHOW e Comicle são isoladas. Publicar o jogo quando o destino e o escopo dessa publicação estiverem definidos.

## Critérios gerais

- Implementar uma entrega utilizável por vez, com módulos pequenos e responsabilidades claras.
- Regras decididas ficam em `regras.md`; regras propostas continuam identificadas como propostas.
- Testes focam comportamento: placar, fases, salas, vidas e privacidade das respostas.
- Manter README fiel ao estado real do projeto e às instruções de execução existentes.
- Não importar o histórico inteiro do outro jogo: migrar apenas arquivos úteis, com sua licença.
- A primeira versão de teste deve existir antes da revisão de milhares de perguntas, para experimentar as regras cedo.

## Riscos a resolver durante o trabalho

| Risco concreto | Tratamento |
|---|---|
| Respostas concorrentes produzirem duas jogadas na final | Aceitar somente a primeira resposta válida na fila da sala; fechar as tentativas e aplicar uma única perda por pergunta respondida |
| A final desvalorizar as cinco fases anteriores | Exibir vantagem, simular resultados e ajustar com partidas |
| Fonte grande conter respostas erradas | Candidatos separados de conteúdo publicado e revisão por pergunta |
| Velocidade favorecer latência | Bônus limitado em faixas e tempo de recepção decidido pelo servidor |
| Reaproveitamento arrastar regras de quadrinhos | Adaptação por módulo, contratos próprios e testes de integração |
| Esgotar um tema sem repetir | Validar capacidade e oferecer outros temas antes de iniciar |
