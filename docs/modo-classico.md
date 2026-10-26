# Modo clássico integrado

A T36 integra a partida de cinco fases em desenvolvimento/teste. Novas salas usam `settings.format: "classic"`; omitir o formato no contrato também seleciona esse padrão. O botão **Iniciar modo clássico** envia `match:start` sem modalidade. O servidor sorteia quatro entre quiz simples, velocidade, aposta, roubo e dinamite, sem repetição, e acrescenta a final na quinta posição.

**Atualização de 23/10/2026:** D01–D06 foram respondidas, conforme [decisões](decisoes.md). Dinamite por turnos aprovada; roubo exclusivo do primeiro acerto com teto de 100 e +100 para todos os acertos; empate em pontos e acertos com vidas iguais; sem resposta na final, todos os ativos perdem uma vida; sem alvo, sorteio entre todos os ativos, inclusive quem acertou. A integração T39 já aplica vidas iguais, dano coletivo, alvo automático e desempate de tiro; a T20 aplica o teto de roubo de 100. A T21 consolida a dinamite com política confirmada em plano, regras e projeção. As seções técnicas abaixo descrevem o fluxo atual; os relatórios datados nas tarefas preservam as evidências históricas. O [guia do desempate](desempate-tiro.md) detalha o combate. Hospedagem como no Comicle fica por último, aguardando criação da VM pelo usuário.

## Plano e transições

`createClassicPlan` usa a porta `RandomSource` e Fisher–Yates. Os 120 resultados possíveis têm quatro modalidades distintas nas posições 1–4 e final na posição 5. IDs de todas as fases são gerados no início. Plano, elenco, perfis e parâmetros ficam congelados pela transação da sala; presença, reconexão e mudança de anfitrião não sorteiam outra ordem.

`MatchView.format` distingue `classic` de `isolated-prototype`. `MatchView.plan` publica apenas IDs, modalidades, variantes e posições das cinco fases; não contém perguntas futuras. A modalidade `classic` dentro de uma fase significa quiz simples. Os consumidores usam a modalidade para as regras e `index`/`progress` para a posição, sem índices fixos por modalidade.

As quatro fases reutilizam instruções, fila de temas, seleção, apostas/turnos, respostas, revelação e resultado. O timer do resultado abre automaticamente as instruções da próxima fase, na mesma partida e com o mesmo placar/acertos. Aposta na abertura oferece zero para saldo zero. Roubo nunca fabrica saldo ou transferência.

Após a quarta fase, `finalEntry.scope: "full-match"` congela a classificação por pontos e acertos e atribui 5/4/3/2 vidas por grupos consecutivos. Empatados recebem as mesmas vidas, sem saltar posições: 5/5/4/3/2. A final começa automaticamente com o `roundId` reservado, inclusive quando todos empatam. A classificação e a conversão permanecem inalteradas até o pódio.

A final reutiliza a primeira resposta exclusiva, dano único, ataque manual e eliminação. No pódio, o histórico apresenta as quatro modalidades disputadas na ordem oficial; a classificação final apresenta a disputa por vidas. A revanche retorna à mesma sala, preserva perfis/fila de temas e inicia outro `matchId`, placar zero e novo sorteio, que pode repetir legitimamente a ordem anterior.

## Conteúdo e reconexão

`QuestionSelection` recebe `format: "classic"` e a lista privada de quatro modalidades sorteadas. A admissão calcula demanda por dificuldade para o elenco real e reserva 25 fáceis/25 médias a partir do excedente de uma alocação viável. Cada oferta de temas conserva a viabilidade das fases restantes na ordem do plano. Não repete perguntas nem substitui dificuldade para esconder falta de conteúdo.

O formato histórico `full-prototype` continua exercitando cinco modalidades de pontuação mais a final, apenas como orçamento da T27. Os formatos isolados continuam acessíveis na seção separada do lobby e por `match:start.mode` explícito; `settings.format: "prototype-v1"` conserva o início legado do quiz simples.

Transições e timers passam pela fila existente. O contexto inclui partida, fase, pergunta, revisão, etapa e prazo. Conteúdo e placar são confirmados juntos. Reconexão recupera plano, escolhas e prazo originais. Quando a sala está vazia, os limites da T26 suspendem a transição antes de liberar conteúdo novo.

## Verificação

- `classic-plan.test.ts`: enumeração determinística das 120 sequências, todas as posições/omissões e IDs distintos.
- `classic-match.service.test.ts`: percurso integrado pelo serviço, conservação do placar, vidas/pódio, histórico, revanche, saldo zero na aposta, conexão substituída, empate explícito e estoque insuficiente.
- `classic-mode.test.ts` em shared: padrão de criação e rejeição de planos ausentes, repetidos ou divergentes da fase.
- `classic-mode.spec.ts`: interface real, HTTP/Socket.IO, duas identidades, cinco fases, recarga, pódio e revanche em desktop/celular. A composição de teste injeta tempos curtos; transporte, relógio e agendador são reais. Não há rota pública de teste.
- `pnpm questions:simulate:classic`: gera [t36-stock.json](../data/publication-reports/t36-stock.json), separado da evidência histórica da T27. Cobre 480 percursos completos de conteúdo (120 ordens × 2/4/8/12 pessoas), 1.260 configurações de temas, reserva de 50 perguntas, esgotamento explícito e ausência de repetição. `--check` reproduz os bytes sem escrever, inclusive na CI.

O quadro de status e as evidências de execução ficam na [T36](tasks/T36-modo-classico-padrao.md). Os esclarecimentos confirmaram vidas por grupos consecutivos (5/5/4/3/2 no exemplo com empate em 1º) e o desempate de eliminações simultâneas por tiro 2D top-down, planejado na [T39](tasks/T39-desempate-tiro-top-down.md). O minigame começa com três vidas por participante; ao chegar a zero, erro na pergunta elimina e acerto concede uma vida. Essas regras estão implementadas em desenvolvimento/teste na T39, sem acrescentar uma sexta fase ao modo clássico; a validação humana de equilíbrio segue em T32.

A [T29](e2e-partida-completa.md) amplia a verificação com duas sequências reais em desktop/celular, falhas durante a partida integrada e 12 identidades por sockets, com as políticas confirmadas, sem tratar os testes como avaliação humana de equilíbrio.
