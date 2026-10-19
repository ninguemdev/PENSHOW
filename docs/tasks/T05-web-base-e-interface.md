# T05 — Web base, interface e navegação

- **Depende de:** [T02](./T02-contratos-e-documentacao.md)
- **Pacotes:** web
- **Marco:** M1
- **Branch sugerido:** `task/05-web-base-e-interface`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Preparar navegação, componentes e stores com a mesma separação de responsabilidades do Comicle.

## Leia antes

- [arquitetura.md](../arquitetura.md)
- [plano-do-jogo.md](../plano-do-jogo.md)

## Decisões em consulta

D07 orienta a identidade visual definitiva; componentes funcionais podem usar estilos provisórios claramente identificados.

## Entregáveis

- [x] Criar rotas de início, perfil, sala e erro, com suporte a caminho base configurável.
- [x] Preparar stores de sessão, perfil e sala, cliente HTTP/socket e armazenamento local seguro.
- [x] Centralizar textos em `strings/pt-BR.ts`; criar Button, Dialog, Timer, PlayerChip e aviso de conexão com semântica acessível.
- [x] Criar `docs/interface.md` com tokens, navegação, estados de carregamento, erro e ausência de dados.

## Critérios de aceite

- [x] Componentes enviam intenções pelas stores e não abrem conexões diretamente.
- [x] Bloqueio de localStorage ou falha de rede não produz tela em branco.
- [x] Cronômetro e cores não são os únicos meios de entender estado e ações.
- [x] Rotas e chaves locais usam namespace do PENSHOW.

## Verificação

- [x] Testar navegação inválida, leitura de armazenamento corrompido e recuperação de erro.
- [x] Testar foco do diálogo, acionamento por teclado e estados offline nas ações.

## Cuidados de implementação

Reutilizar componentes úteis do Comicle; não portar telas de desenho ou quadrinhos. O tratamento dos contratos deve evoluir junto das tarefas de jogo.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.

## Evidências de verificação — 16/10/2026

- Branch `task/05-web-base-e-interface`, preservando as entregas anteriores do workspace. Implementação em `apps/web/src/features/`, `stores/`, `lib/` e `ui/`; textos em `strings/pt-BR.ts`.
- Rotas início/perfil/sala/erro com navegação por links, Enter, histórico e foco no título. Base `/` por padrão; build e preview reais também exercitados sob `/penshow/` com `VITE_BASE_PATH`. O socket mantém `/penshow/socket.io`; HTTP usa `/api`. Chaves locais próprias `penshow.session` e `penshow.profile`; identidade/rotas do Comicle não são reutilizadas.
- Zustand 5.0.15, Socket.IO Client 4.8.4 e Zod 4.6.7 com versões fixadas; user-event 14.6.8 para interações. As stores recebem dependências; telas não fazem fetch nem abrem sockets. CSS nativo sustenta o estilo provisório permitido por D07, sem antecipar decisão visual ou hospedagem.
- Sessão é verificada por HTTP antes da conexão; emissão/renovação explícitas, renovação sem substituir socket, reuso da identidade após recarregar, mensagens de expiração/substituição e descarte de respostas atrasadas. Falhas transitórias preservam credenciais e permitem retry; substituição não reconecta automaticamente. Token não é colocado em URL ou visão pública da UI.
- Storage com getter bloqueado, quota e JSON/schema inválidos tem fallback em memória e aviso. Perfil usa normalização pública; IDs do catálogo e editor continuam T06. A sala aceita apenas projeção validada para destinatário/código esperado, com versão crescente; a URL não inventa participação.
- Transporte rejeita envio offline, eventos inválidos/canais trocados e confirmações sem correlação, tratando timeout sem sucesso fictício ou reenvio automático. Relógio é apenas visual; cronômetro mostra segundos e anuncia o fim, sem depender só de cor.
- **39 testes web** em seis arquivos: rotas inválidas/base, teclado, diálogo/Tab/Shift+Tab/cancelamento/foco, falha e recuperação de rede, armazenamento corrompido/bloqueado, StrictMode, sessão/renovação/substituição/expiração concorrente, filtro de visões e contratos HTTP/socket. As suítes existentes continuam passando: **277 testes no total** (134 shared, 96 servidor, 39 web, oito conteúdo).
- Chrome headless com servidor compilado e preview de produção reais: base `/penshow/`, ativação/renovação HTTP, socket autenticado, identidade preservada após reload, perfil salvo, abertura do diálogo por Enter, Tab contido, Escape e retorno do foco; rota direta de sala vazia, código inválido e rota de histórico malformada. Também foram exercitados JSON corrompido, getter de localStorage bloqueado, parada/reinício do servidor e retry sem tela em branco. Sem exceções de runtime capturadas.
- Capturas desktop (1440px) e celular (390px) inspecionadas, sem overflow horizontal no celular. Artefatos locais temporários em `%TEMP%/penshow-t05-*`; não foram incluídos no bundle.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm install --frozen-lockfile` e `git diff --check` passaram. Build padrão restaurado para `/` após verificar o prefixo alternativo. Nenhuma publicação foi feita; a CI hospedada depende do envio do branch.
- Tokens, navegação, proxies, estado vazio/carregamento/erro e limites estão em [interface](../interface.md); README, arquitetura, desenvolvimento e sessões foram atualizados.

Criar/entrar em salas permanece desabilitado com explicação até T07–T09. Perfil vazio informa a disponibilidade futura do editor de T06. Cronômetro e PlayerChip são componentes preparados para as telas de jogo, sem uma partida fictícia. D01–D08 mantêm o estado das consultas existentes.
