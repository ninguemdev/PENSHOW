# T13 — Pontuação pura e parâmetros de regras

**Atualização T20 (23/10/2026):** D05 aplicada com teto de 100 e +100 por acerto para todos. A política padrão de roubo agora é `confirmed`; as evidências originais abaixo, incluindo valores 3.900/3.300 e a trajetória de 1.975, permanecem históricas. Os testes atuais validam ganhos 600/900/900/1.200/600, placares 4.200/3.000 e trajetória 400 → 925 → 1.375 → 1.875 → 2.025.

- **Depende de:** [T02](./T02-contratos-e-documentacao.md)
- **Pacotes:** server, shared
- **Marco:** M2
- **Branch sugerido:** `task/13-pontuacao-e-parametros`

O status desta tarefa fica somente no [índice](README.md). As evidências abaixo descrevem os módulos implementados e as verificações executadas.

## Objetivo

Concentrar cálculos e configurações para evitar números mágicos e regras duplicadas nas telas.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [regras.md](../regras.md)
- [decisoes.md](../decisoes.md)

## Entregáveis

- [x] Definir parâmetros tipados por modalidade para pontos, prazos, quantidade de perguntas e limites.
- [x] Criar funções puras de crédito/débito, aposta, transferência, acertos acumulados e variação de placar.
- [x] Modelar a configuração congelada na partida e o histórico dos efeitos necessários à revelação.
- [x] Separar os valores confirmados da final dos padrões experimentais de pontuação e duração.

## Critérios de aceite

- [x] Cliente recebe valores explicativos do resultado, mas não calcula o placar oficial.
- [x] Saldo nunca fica negativo; transferência conserva os pontos roubados; aposta não é descontada duas vezes.
- [x] Os exemplos de 3.900 pontos máximos e saldo ilustrativo de 1.975 fecham com os padrões propostos.
- [x] Trocar um parâmetro não exige alterar handlers, várias stores ou componentes.

## Verificação

- [x] Testar limites de saldo, apostas acima do saldo, transferência de alvo com 30 pontos e fronteiras dos bônus.
- [x] Testar composição dos efeitos puros e exemplos completos do plano; aplicação única pelo serviço será verificada nas tarefas do motor e das modalidades.

## Cuidados de implementação

A tabela proposta é configuração experimental, não prova de aprovação. Incorporar D01 quando respondida sem alterar 5 / 4 / 3 / 2 vidas.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.

## Evidências de verificação — 19/10/2026

- Branch `task/13-pontuacao-e-parametros`, preservando as entregas anteriores no workspace. Sem nova dependência, alteração de conteúdo ou mudança de regras confirmadas. O [documento de pontuação](../pontuacao-e-parametros.md) descreve parâmetros, API, exemplos e responsabilidades da futura integração.
- `modules/scoring/match-rules.ts` concentra parâmetros tipados/validados das modalidades, pontos, tempos, misturas de dificuldade, ciclos, valores de aposta, teto de transferência e reserva. `freezeMatchRules` valida/copía e congela recursivamente cada configuração por `matchId`. Padrões têm `status: experimental`; D04/D05 exigem políticas `prototype`. `CONFIRMED_FINAL_RULES` e D01–D06 ficam em campos separados, imutáveis. Tentativas de sobrescrever vidas ou marcar consultas como confirmadas são recusadas.
- A seleção da T12 agora deriva seus orçamentos da configuração central. `rules` opcional permite compartilhar a mesma configuração com a pontuação; sem ele, o seletor congela os padrões para a partida. Regras de outra partida ou prazo avulso divergente são recusados. O argumento anterior `categoryChoiceMs` permanece compatível para o protótipo isolado. Quantidade, prazo, opções, reserva e ordem dos ciclos vêm dos parâmetros, sem alterar padrões das partidas já congeladas.
- `modules/scoring/scoring.domain.ts` implementa criação do placar, crédito, débito limitado ao saldo, transferência conservativa, contador de acertos, valores permitidos/aposta selada, variações por identidade e resolução pura por pergunta. Recebe avaliação e timestamps internos do servidor em ordem de recebimento; valida participantes, unicidade, contexto da partida e janela inclusiva na abertura/exclusiva no fim. Não consulta rede, relógio global, sorteio ou estado compartilhado.
- Aposta não movimenta saldo ao ser selada; valida valor oferecido/cobertura e conserva o saldo original. A resolução verifica essa fotografia e credita base mais aposta no acerto ou debita somente a aposta no erro/ausência. Testes verificam 500 → 650/450, zero com acerto, ausência com aposta 25 e recusa de valor acima do saldo, valor não oferecido, duplicata, saldo alterado e não participante.
- Roubo credita todos os acertos antes de transferir e identifica a primeira correta pela sequência de recibos, inclusive quando uma errada chegou antes ou os timestamps empatam. Alvo próprio/desconhecido é recusado; ausência de alvo mantém os créditos. Os testes verificam dois acertos, alvo com 340 após crédito terminando com 290 e alvo com 30 transferindo exatamente 30. Débito e crédito têm o mesmo valor efetivo; zero não produz transferência.
- Dinamite só altera o dono do turno. Testes verificam +300 por acerto, erro/ausência, penalidade de 30 com saldo 30, saldo zero e recusa de resposta de outro jogador. Crédito/acertos/tempo fora do intervalo seguro causam falha sem mutar entradas ou entregar estado parcial; transferência que estouraria o saldo do destino também é recusada atomicamente.
- `QuestionScoreResolution` registra contexto, versão, modalidade, antes/depois, acertos, efeitos explicativos e variações. `ScoringHistory` liga resoluções à configuração congelada. Efeitos seguem o schema público já existente e informam valores efetivos; lógica e parâmetros permanecem privados. Shared exporta apenas os novos aliases de tipos inferidos `Scoreboard`, `ScoringRound` e `ScoringMode`, reutilizados no servidor.
- **29 testes novos de pontuação** e **dois testes novos de integração com a seleção**, além dos 25 testes anteriores da T12. Cobrem congelamento/cópias, mudança de parâmetros, faixas 0/4.999/5.000/9.999/10.000/14.999 ms, recusa em 15.000 ms, erro rápido, overflow, entrada inválida, recibos duplicados/fora de ordem, apostas, transferência, ausência e compatibilidade com schemas públicos.
- Os exemplos compõem cinco fases reais do cálculo: ganhos 600/900/900/900/600, **3.900 pontos e 26 acertos**, com outro jogador terminando em 3.300 após sofrer roubos. A trajetória ilustrativa fecha **400 → 925 → 1.375 → 1.825 → 1.975**, com 17 acertos. Cada delta no exemplo máximo coincide com a soma dos efeitos com sinal; histórico é serializável e os snapshots não alteram resoluções anteriores.
- Testes de configuração compartilhada alteram clássico para duas perguntas de +175, escolha para sete segundos/duas opções, reserva para dez e ciclos da dinamite em ordem inversa. Seleção e cálculo respeitam os ajustes, enquanto os padrões permanecem 3/3, +100 e reserva 50. Faixas de velocidade personalizadas também mudam o bônus/prazo sem modificar o cálculo.
- Smoke do JavaScript compilado com diretório corrente fora do projeto: aplicação carregou o catálogo real de 72; seleção e pontuação executaram seis perguntas clássicas, com 600 pontos/seis acertos, conferência pelo mapa privado e resultados válidos no contrato completo de revelação de `MatchView`. Aposta compilada confirmou 650/450 com saldo original 500 preservado; configuração ajustada selecionou duas perguntas com +175. Configuração/histórico foram conferidos quanto a congelamento e serialização.
- HTTP de saúde permaneceu 200 e caminhos de regras/pontuação retornaram 404. Vite real retornou 403 para os dois módulos privados e 200 para a página. Nos 54 arquivos do bundle web não foram encontrados marcadores da lógica de pontuação, apostas seladas, hash privado ou IDs do catálogo. Os 29 hashes de candidatos/manifesto registrados na T11 foram preservados. Aplicação/agendadores/servidor de verificação encerrados; nenhum script temporário persistido.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm questions:check`, `pnpm build` e `git diff --check` passaram. **496 testes**: 225 server, 159 shared, 75 web, 32 de conteúdo/publicação e cinco de artes. A CI hospedada depende do envio do branch.
- README, arquitetura, modelo de dados, servidor, seleção, regras e decisões atualizados. O módulo não executa fechamento de pergunta, autorização de comandos, aplicação única ou projeção na rede. Essas etapas seguem no motor e nas modalidades, conforme o cuidado da task. O botão de início permanece desabilitado; nenhuma decisão de produto foi tratada como respondida.
