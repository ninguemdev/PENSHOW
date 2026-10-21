# Privacidade, limites e concorrência

A auditoria da T28 cobre os cinco protótipos de pontuação, a final, o lobby, a reconexão e o encerramento. O modo completo sorteado continua na T36; estas verificações não consolidam as decisões D02–D06.

## Orçamentos operacionais

`platform/traffic-policy.ts` reúne a política congelada por instância. `buildApp({ trafficPolicy })` aceita uma política interna para composição/testes; o cliente não define limites.

| Recurso | Limite padrão | Identificação |
|---|---|---|
| Emissão de sessões | 60 por 60 segundos | IP remoto HTTP |
| Consulta/renovação de sessões | 240 por 60 segundos, somadas | IP remoto HTTP; orçamento separado da emissão |
| Novos handshakes Engine.IO | 240 por 60 segundos | IP remoto do transporte |
| Eventos de comando | 240 por 60 segundos, somados | Identidade autenticada; IP remoto para anônimos |
| Comandos pendentes | 16 | Conexão socket |
| Sessões armazenadas | 10.000 | Instância |
| Conexões Engine.IO | 2.048 | Instância, inclusive anônimas |
| Salas simultâneas | 500 | Instância |
| Chaves por limitador | 16.384 | Instância; tabela cheia recusa novas chaves |

As janelas começam no primeiro uso de uma chave. Rejeições não estendem a janela. Trocar de socket conserva o orçamento da identidade; conexões anônimas do mesmo IP compartilham o orçamento. Eventos inválidos, desconhecidos e sem callback também consomem orçamento; nenhum deles entra no serviço sem envelope válido e callback. O limite de pendências é verificado antes do despacho e liberado em sucesso ou falha.

Excesso de comandos retorna `RATE_LIMITED` com o `actionId` válido, ou `null` quando ausente/inválido. Não executa serviço nem consome a resposta, aposta ou ataque. A web mostra a mensagem pública e permite tentar manualmente outra vez enquanto o contexto/prazo continuar válido. Não há reenvio automático. Excesso HTTP recebe 429, `Retry-After` conservador de uma janela completa e cabeçalhos de não armazenamento; capacidade esgotada de sessões recebe 503/`SERVER_BUSY`. Criar sala na capacidade recebe `SERVER_BUSY`. Recusa de handshake usa o erro de transporte do Engine.IO.

Os limites de bytes continuam configurados por `HTTP_BODY_LIMIT` e `SOCKET_MESSAGE_LIMIT` (64 KiB por padrão), além dos schemas estritos. Os limites de jogadores/espectadores continuam em `ROOM_LIMITS` e nas configurações da sala.

Os limitadores têm memória limitada e limpeza preguiçosa de entradas expiradas, sem timers extras. Tabelas são limpas no encerramento. Sessões expiradas são removidas por acesso/varredura; na capacidade, uma emissão tenta recuperar expiradas antes de recusar. Fechar sala libera registro, vínculos e timers; fechar transporte libera a vaga de conexão.

Fastify mantém `trustProxy` desabilitado e o handshake usa o endereço remoto real do socket. `X-Forwarded-For` enviado pelo cliente não troca o orçamento. Na composição atual, pessoas atrás do mesmo proxy/NAT compartilham limites por IP; configurar uma topologia de proxy confiável faz parte da operação da T34. Estes valores são tetos funcionais, sem medição de capacidade de produção ou garantia contra ataques distribuídos.

## Matriz de exposição auditada

As visões são projetadas por destinatário após a confirmação da fila. Anfitrião tem o mesmo acesso ao conteúdo que os demais jogadores; espectador não participa dos comandos de jogo. Nenhuma rota HTTP serve catálogo, estado interno de salas ou sessões alheias.

| Etapa | Pode sair | Permanece privado |
|---|---|---|
| Lobby, instruções e escolha de tema | Membros, regras, progresso e temas elegíveis | Conteúdo futuro, reserva da final, sorteios e credenciais |
| Escolha de aposta | Tema/dificuldade, valores permitidos e aposta do destinatário | Enunciado, opções, apostas alheias e gabarito |
| Leitura, inclusive final/dinamite | Enunciado e instante oficial de abertura | Alternativas, gabarito, explicação e conteúdo futuro |
| Resposta aberta | Pergunta/opções públicas, prazo e resposta própria quando aplicável | Alternativa alheia, avaliação de acerto, gabarito e explicação |
| Alvo do roubo | Autor autorizado, alvos e créditos já encerrados | Gabarito/explicação e recibos internos |
| Revelação | Gabarito, explicação e efeitos confirmados; apostas liquidadas | Perguntas futuras, reserva, dados editoriais e credenciais |
| Final: alvo/resolução | Primeira resposta aceita, gabarito e vidas conforme a etapa | Respostas concorrentes rejeitadas, recibos e conteúdo futuro |
| Final sem resposta | Pergunta atual e pendência D02 | Gabarito, explicação e próxima pergunta |
| Final sem alvo | Revelação já autorizada e pendência D03 | Próxima pergunta e recibos privados |
| Resultados/pódio | Placar histórico, resumo liquidado e ordem oficial | Catálogo, checkpoints, tokens, hashes e conexões |
| Reconexão | Fotografia atual correspondente ao destinatário | Escolhas alheias; nenhum novo prazo, resposta, saldo ou vida |
| Erros | Código/mensagem pública e contexto público contratual | Payload recebido, stack, caminhos internos e credenciais |

Logs automáticos de requisição permanecem desabilitados; falhas registram mensagens fixas e serializers/redação descartam objetos sensíveis. Os testes capturam logs reais HTTP e socket e verificam ausência de tokens, respostas e detalhes de exceções. Não há logs por pacote recusado por frequência.

## Evidências automatizadas

- `platform/traffic-policy.test.ts`: isolamento de chaves, excesso, fronteira da janela, recuperação da tabela cheia e limpeza.
- `platform/http-limits.test.ts`: emissão/consulta/renovação, IPs independentes, cabeçalhos, `X-Forwarded-For` sem confiança, capacidade e reaproveitamento de sessões expiradas.
- `platform/realtime/realtime.test.ts`: spam inclusive inválido/sem callback, reconexão sem zerar orçamento, identidade independente, pendências com falha, handshakes, conexões, pacote grande e logs sanitizados.
- `modules/rooms/room.service.test.ts`: capacidade por sala, autorização, associação, teto global sem reserva parcial, liberação de vaga, fila e ciclo de vida.
- `modules/matches/match.realtime.test.ts`: três salas de 12 jogadores em Socket.IO real, uma fila bloqueada sem impedir outra, respostas concorrentes, queda, alvos duplicados, prazos, contexto antigo e HTTP sem catálogo. A mesma suíte percorre as modalidades, etapas e reconexões por WebSocket e polling, com espectadores e verificações de privacidade.
- `modules/matches/match.service.test.ts`: 12 jogadores disputam alvo antes/no prazo, queda e callback concorrente sem duplicar resolução; callbacks cancelados após fechamento são inócuos, sem timers retidos. A suíte também cobre a final, primeira resposta exclusiva, reconexão, vidas e revanche.
- `modules/views/build-player-view.test.ts`, `app.test.ts`, `modules/guest-identity/*.test.ts`: projeção por lista explícita, campos aninhados, sessão titular, erros HTTP e logs sem dados privados.
- `apps/web/src/stores/match-store.test.ts`: resposta/aposta/alvo recusados por frequência conservam a visão oficial e permitem nova tentativa manual.
- `e2e/public-audit.ts` e os oito fluxos de smoke: inspeção de HTTP/frames em navegadores, estágios das modalidades/final, queda e reinício. `apps/web/src/lib/private-content.test.ts` e o build verificam a fronteira de conteúdo privado da web.

Os testes usam portas efêmeras, eventos/barreiras e relógio/sorteio controlados; o cenário de 36 jogadores verifica integridade/isolamento, sem prometer desempenho ou duração real de uma partida. O percurso completo integrado permanece na T29, após a T36.

Em 21/10/2026, passaram `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (765 testes), `pnpm build` e `pnpm questions:check`. Após o build, `pnpm test:e2e:run` aprovou os 16 testes de navegador em desktop/celular (20,7 minutos), usando os prazos reais do jogo e inspeção de HTTP/frames.
