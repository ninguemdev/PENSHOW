# Análise do Comicle

Análise estática em 16/10/2026 do [commit 4521f34](https://github.com/ninguemdev/Comicle/tree/4521f34df78da7de54a30715d50e748c50aa0696). O HTML de `https://dionel.site/comicle/` respondeu com HTTP 200. Não foram executadas as suítes nem uma partida do Comicle nesta análise.

## Arquitetura observada

Monorepo pnpm com `apps/web`, `apps/server` e `packages/shared`. React, Vite, Tailwind e Zustand no cliente; Fastify e Socket.IO no servidor; contratos validados com Zod. O projeto usa PostgreSQL e Drizzle para conteúdo das histórias, enquanto salas e sessões ativas ficam em memória.

O servidor recebe intenções, executa a regra e publica uma visão completa por jogador (`room:view`). Os componentes usam ações das stores. Relógio, agendamento e aleatoriedade são dependências explícitas, o que permite testar regras sem rede e sem esperar tempo real.

## Reaproveitamento por módulo

Os caminhos abaixo são relativos ao repositório Comicle no commit analisado.

| Módulo examinado | O que existe | Aplicação no PENSHOW |
|---|---|---|
| `apps/server/src/modules/rooms/room-code.ts` | Códigos de 6 caracteres, alfabeto sem caracteres ambíguos, tratamento de colisão | Reaproveitar geração e validação |
| `apps/server/src/modules/rooms/room.ts` | Membros, anfitrião, conexões e fila `runExclusive` | Manter a fila; substituir `Match` e configurações de quadrinhos |
| `apps/server/src/modules/rooms/room.service.ts` | Criar, entrar, sair, expulsar, alterar perfil e reconectar | Adaptar: depende de `StoryRepository`, da partida de quadrinhos e de callbacks de presença |
| `apps/server/src/modules/rooms/host-policy.ts` | Autorizações e transferência de anfitrião | Reaproveitar e restringir ações durante perguntas e final |
| `apps/server/src/modules/guest-identity/session-store.ts` | Sessões anônimas, token armazenado como hash e expiração | Manter a abordagem com tokens próprios do PENSHOW |
| `packages/shared/src/schemas/profile.ts` | Validação de nickname e IDs de peças do avatar | Reaproveitar contratos com namespace `@penshow/shared` |
| `packages/shared/src/schemas/text.ts` | Normalização Unicode e limite em pontos de código | Manter para apelidos; o limite atual é de 20 caracteres |
| `packages/shared/src/avatar/` e `domain/avatar.ts` | Catálogo, seleção, sanitização e composição em seis categorias | Reaproveitar catálogo e regras, verificar artes na migração |
| `apps/web/src/features/avatar/` | Editor acessível por teclado e renderizador em camadas | Reaproveitar componentes e adaptar o estilo visual |
| `apps/web/src/stores/profile-store.ts` | Apelido e avatar persistidos, recuperação de catálogo alterado | Mudar a chave `comicle.profile` para `penshow.profile` |
| `apps/web/src/stores/room-store.ts` | Ações com confirmação, sincronização de horário e reconexão | Manter transporte e reconstruir ações do jogo |
| `apps/server/src/modules/views/build-player-view.ts` | Projeção individual e ocultação de conteúdo | Reescrever para perguntas: respostas corretas e escolhas alheias permanecem no servidor |
| `apps/server/src/modules/game-modes/game-mode.ts` | Interface específica de histórias e distribuição de quadros | Reaproveitar a ideia de estratégias, criar uma interface própria de fases |

## Cuidados concretos na migração

1. **Salas não são um pacote independente.** `RoomServiceDeps.storyRepository` e o acesso ao domínio de partidas impedem copiar o serviço sem adaptação. Substituir essa dependência por uma interface pequena de ciclo de vida da sala, somente se necessária.
2. **O contrato de modos é específico de quadrinhos.** Métodos como `storyCount`, `panelsPerRound` e `themeOfStory` não pertencem ao quiz. Um contrato de fases deverá expressar resposta, pontuação e encerramento.
3. **A projeção precisa ser reconstruída.** Uma resposta secreta não pode chegar como propriedade escondida no cliente, inclusive para espectadores ou anfitrião.
4. **Identidade é separada do nome.** Um apelido não autentica um jogador. Preservar identidade estável na reconexão e não permitir que trocar de nome restaure vidas ou apague respostas.
5. **Armazenamento deve ser isolado.** Trocar chaves locais, nomes de pacotes, variáveis, banco quando existir e caminho do socket; publicar em `/penshow/` não pode conectar ao jogo em `/comicle/`.
6. **Persistência não implica recuperação.** O Comicle usa sessões e salas em memória. Reiniciar o processo não restaura automaticamente uma partida; recuperação do PENSHOW precisa de decisão e implementação próprias.
7. **Migrar por módulos e dependências reais.** Não trazer editor de desenho, histórias, PNGs, migrações de quadrinhos nem configurações da instalação do outro jogo.

## Limites atuais aproveitáveis

O código analisado permite 2 a 12 jogadores. A transferência por queda do anfitrião tem carência de 30 segundos; a remoção no lobby ocorre depois de 120 segundos; a duração máxima da sala é 12 horas. São valores existentes no Comicle, não decisões já aprovadas para o PENSHOW.

## Conclusão técnica

Manter o monólito modular, a autoridade do servidor, as projeções individuais e a serialização por sala. Migrar primeiro identidade e avatares, depois salas. Implementar partidas, perguntas, classificação e final em módulos próprios. Reutilização será seletiva, com licença e procedência dos arquivos efetivamente copiados preservadas.
