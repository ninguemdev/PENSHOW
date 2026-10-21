# T36 — Modo clássico padrão com cinco fases e ordem sorteada

- **Depende de:** [T18](./T18-fase-velocidade.md), [T19](./T19-fase-aposta.md), [T20](./T20-fase-roubo.md), [T21](./T21-quinta-fase-pressao.md), [T25](./T25-podio-e-revanche.md), [T26](./T26-reconexao-e-ciclo-de-vida.md), [T27](./T27-catalogo-de-teste-completo.md)
- **Pacotes:** server, web, shared, scripts, docs
- **Marco:** M3
- **Branch sugerido:** `task/36-modo-classico-padrao`

O status desta tarefa fica somente no [índice](README.md). A tarefa foi acrescentada por solicitação do usuário em 20/10/2026; a integração experimental está descrita em [modo-classico.md](../modo-classico.md), com evidências abaixo. Embora o ID seja posterior, sua entrega precede os testes completos da T29.

## Objetivo

Implementar o **modo clássico como modo padrão do PENSHOW**, com **cinco fases no total**: quatro fases de modalidades diferentes, sorteadas sem repetição, seguidas obrigatoriamente pela final na quinta posição. A partida deve seguir do lobby ao pódio em um único fluxo, conservando o desempenho acumulado até a conversão em vidas.

## Leia antes

- [regras.md](../regras.md), requisito R09
- [decisoes.md](../decisoes.md)
- [plano-do-jogo.md](../plano-do-jogo.md)
- [motor-de-partida.md](../motor-de-partida.md)
- [selecao-de-perguntas.md](../selecao-de-perguntas.md)
- [classificacao-e-vidas.md](../classificacao-e-vidas.md)
- [podio-e-revanche.md](../podio-e-revanche.md)
- [cenarios-de-reconexao.md](../cenarios-de-reconexao.md)
- [revisao-editorial-t27.md](../revisao-editorial-t27.md)

## Requisitos confirmados e composição planejada

Confirmado pelo pedido: modo clássico como padrão, cinco fases totais, modalidade diferente em cada fase, ordem aleatória das modalidades iniciais e final sempre por último. Isso substitui a proposta anterior de cinco fases fixas de pontuação mais uma final, que totalizava seis.

Para atender às cinco fases usando o catálogo atual, o plano desta tarefa é sortear **quatro entre as cinco modalidades de pontuação**, sem reposição, e sortear sua ordem:

| Posições | Modalidades |
|---|---|
| 1 a 4 | Quatro distintas entre quiz simples/aquecimento, velocidade, aposta, roubo e pressão/dinamite |
| 5 | Final, sempre presente e fora do sorteio |

Uma modalidade de pontuação fica de fora a cada partida; nenhuma fica permanentemente excluída. O quiz simples não é uma abertura obrigatória. Exemplo válido: `Aposta → Velocidade → Dinamite → Quiz simples → Final`. Outro exemplo: `Roubo → Quiz simples → Aposta → Velocidade → Final`.

**Modo clássico** identifica a partida completa; a modalidade de perguntas sem modificadores deve aparecer como **quiz simples** ou **aquecimento**, evitando confusão com o protótipo hoje chamado quiz clássico. Separar formato de partida e modalidade no contrato/domínio.

## Decisões já em consulta

D04 define a variante da modalidade de pressão, que deixa de ter posição fixa; não altera a final na quinta fase. D05 define o direito ao roubo; D06 define o desempate anterior às vidas; D02/D03 definem as ausências de resposta/alvo na final. Esta tarefa não aprova as propostas dessas decisões por consequência do sorteio. A integração pode ser exercitada com variantes explicitamente experimentais; a consolidação do modo padrão exige as políticas aplicáveis definidas e validadas.

## Entregáveis

- [x] Adicionar o formato de partida completo ao domínio e aos contratos públicos, separado da modalidade de cada fase e dos protótipos isolados.
- [x] Tornar o modo clássico a opção padrão ao criar uma sala e a ação principal de início no lobby, sem exigir escolher uma modalidade isolada.
- [x] Gerar no servidor, com a porta de aleatoriedade existente, quatro modalidades distintas e sua ordem; acrescentar a final na posição 5.
- [x] Congelar o plano sorteado, IDs, elenco e parâmetros ao iniciar a partida; separar posição da fase e identidade da modalidade, removendo pressupostos de índices fixos.
- [x] Integrar instruções, escolha de tema, perguntas/turnos, revelação e resultados das quatro modalidades em uma mesma partida, com avanço automático entre fases.
- [ ] Conservar pontos e acertos entre fases; preparar classificação/desempate somente após a quarta fase e converter em vidas uma única vez antes da quinta.
- [x] Integrar a final existente, pódio, histórico das fases efetivamente disputadas e revanche na mesma sala.
- [x] Adaptar a seleção de perguntas e a reserva da final à lista e à ordem sorteadas, sem exigir a sequência fixa de cinco modalidades do atual `full-prototype`.
- [x] Recalcular elegibilidade de temas e estoque por dificuldade para o plano real, considerando participantes e apenas as quatro modalidades escolhidas; preservar as 50 perguntas da final e o ineditismo em toda a partida.
- [x] Atualizar a web para informar modo, fase atual de cinco, modalidade, regra e transição; refletir a ordem oficial recebida do servidor.
- [x] Preservar a reconexão, troca de conexão ativa, transferência de anfitrião e espera de sala vazia em todas as transições do modo completo.
- [x] Atualizar plano/regras, documentação técnica e simulações de estoque para o novo formato; conservar as evidências históricas dos protótipos e da T27 como tais.

## Critérios de aceite

- [x] Criar sala sem escolher outro formato prepara o modo clássico completo; iniciar não executa somente o quiz simples de seis perguntas.
- [x] Cada plano tem exatamente cinco fases, quatro modalidades iniciais únicas e uma única final, na quinta posição.
- [x] A mesma modalidade pode ocupar posições iniciais diferentes entre partidas; o algoritmo permite todas as modalidades e todas as omissões previstas pelo catálogo habilitado.
- [x] O plano e os resultados coincidem para todos os clientes; recarga, reconexão, troca de anfitrião ou reenvio de início não refazem o sorteio.
- [x] Uma fase concluída inicia a próxima sem voltar ao lobby, zerar pontos ou criar uma nova partida.
- [x] Aposta pode ser a primeira fase: participantes com saldo zero podem apostar zero, sem crédito inicial artificial. Roubo sem alvo com saldo segue a política da modalidade, sem fabricar pontos.
- [ ] A final só começa após as quatro fases iniciais e o desempate aplicável, preservando as vidas confirmadas de 5/4/3/2 e a primeira resposta exclusiva.
- [x] Nenhuma pergunta ou ação consumida é reaproveitada ao mudar de modalidade; a reserva da final não é gasta antes da quinta fase.
- [x] Estoque insuficiente impede iniciar a configuração de forma compreensível; não corrige falta de conteúdo repetindo perguntas, trocando dificuldade ou descartando fases silenciosamente.
- [x] No pódio, o histórico corresponde às quatro modalidades e à final disputadas, com a ordem e os resultados corretos.
- [x] Revanche inicia placar zero e um novo sorteio, preservando sala, perfis e continuidade da fila de escolha de temas. Um novo sorteio pode legitimamente repetir a sequência anterior.
- [x] Os controles de protótipos isolados, se mantidos para desenvolvimento/teste, ficam separados da ação padrão de jogar.

## Verificação

- [x] Testar o gerador com aleatoriedade controlada: tamanho do plano, ausência de repetição, final fixa e cobertura das seleções/ordens permitidas, sem testes estatísticos instáveis.
- [x] No catálogo atual de cinco modalidades iniciais, verificar as 120 sequências possíveis de quatro modalidades e a final, incluindo elegibilidade de conteúdo para 2, 4, 8 e 12 jogadores.
- [x] Atualizar o relatório determinístico de estoque para o modo padrão, com reserva, configurações inviáveis, fases sorteadas e ausência de perguntas repetidas.
- [x] Testar aposta/roubo na abertura, pressão em posições diferentes e conservação de pontuação nas transições.
- [x] Percorrer as cinco fases pelo serviço e Socket.IO reais, incluindo classificação, vidas, final, pódio e revanche; rejeitar comandos/timers da fase ou partida anterior.
- [x] Testar queda antes/depois de transições, reconexão sem novo sorteio e espera de sala vazia sem abrir conteúdo novo.
- [x] Executar um percurso do modo padrão em desktop e celular emulado; a T29 amplia a matriz ponta a ponta e os cenários de falha.
- [x] Executar as verificações comuns, atualizar contratos/documentos e registrar evidências antes de concluir a tarefa.

## Cuidados de implementação

Reutilizar estratégias, classificação, final, projeções e fila transacional existentes. Não concatenar partidas isoladas nem recalcular placar/vidas no cliente. A posição aleatória não muda o significado de uma modalidade; orçamento de conteúdo, instruções, permissões e histórico devem usar o mesmo plano oficial.

O sorteio do modo não autoriza expor enunciados, gabaritos, apostas privadas ou seleções ainda ocultas. O cliente não envia uma ordem de fases como autoridade. Ajustar a validação de estoque para o novo plano, sem apresentar a evidência do orçamento antigo como verificação do modo novo.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). A integração e os testes completos devem estar disponíveis antes da publicação da T35.

## Evidências da integração experimental

- Branch `task/36-modo-classico-padrao`; alterações anteriores da T28 preservadas.
- [Implementação e limites](../modo-classico.md): formato separado da modalidade, plano de cinco fases congelado, transições automáticas, conservação de placar, final/pódio/revanche e projeções por destinatário.
- Gerador enumerado sem amostragem: 120 sequências únicas, 24 omissões por modalidade e 24 ocorrências de cada modalidade por posição inicial.
- [Relatório T36](../../data/publication-reports/t36-stock.json): 480 percursos do seletor real no catálogo publicado, 1.260 configurações de temas, 50 perguntas reservadas e nenhuma repetição. O relatório histórico T27 permanece separado.
- Testes do serviço percorrem as cinco fases com quiz simples, velocidade, aposta, roubo e pressão na abertura, além de saldo zero, empate explícito, conexão substituída, estoque insuficiente e revanche.
- A classificação usa somente as regras já consolidadas do protótipo: empate por pontos publica `ranking`/D06 e não distribui vidas; D02/D03 mantêm as pausas explícitas da final. D04/D05 permanecem variantes experimentais. A consolidação e os critérios de desempate dependem da resposta do usuário; nenhum teste os aprova por consequência.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` aprovados. A suíte completa executou 785 testes: 34 de conteúdo, 5 de artes, 186 de shared, 426 de server e 134 de web. Após ajustar a nomenclatura de quiz simples no histórico integrado, os 14 testes de final da web também passaram.
- `pnpm questions:check`, `pnpm questions:simulate --check` e `pnpm questions:simulate:classic --check` aprovados; as evidências T27 e T36 são reproduzíveis separadamente.
- `pnpm --filter @penshow/e2e exec playwright test tests/classic-mode.spec.ts tests/classic-smoke.spec.ts`: quatro testes aprovados em 4,1 minutos. O modo completo percorreu lobby, cinco fases, recarga, pódio e revanche em desktop (45,4 s) e celular (45,9 s), com auditoria de HTTP/socket. O quiz simples isolado também passou nos dois dispositivos. A matriz ampliada de falhas continua na T29.
