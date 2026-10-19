# T04 — Identidade anônima e sessão

- **Depende de:** [T03](./T03-servidor-base.md)
- **Pacotes:** server, shared
- **Marco:** M1
- **Branch sugerido:** `task/04-identidade-convidado`

O status desta tarefa fica somente no [índice](README.md). As entregas verificadas estão marcadas abaixo, com evidências ao final.

## Objetivo

Permitir jogar sem cadastro mantendo uma identidade estável nas reconexões.

## Leia antes

- [analise-comicle.md](../analise-comicle.md)
- [arquitetura.md](../arquitetura.md)

## Entregáveis

- [x] Adaptar `guest-identity` do Comicle: emissão de token opaco, armazenamento apenas do hash, expiração e verificação.
- [x] Implementar rotas de criação/verificação e autenticação dos comandos de sala pelo token.
- [x] Definir renovação e substituição de conexão sem usar nickname como autenticação.
- [x] Documentar duração da sessão e comportamento após expiração ou reinício.

## Critérios de aceite

- [x] Mesmo apelido não permite assumir a identidade de outra pessoa.
- [x] Token inválido ou expirado não acessa salas autenticadas; logs não contêm token em claro.
- [x] Identidade do PENSHOW e a do Comicle têm armazenamento e escopos separados.

## Verificação

- [x] Testar criação, hash armazenado, validade, expiração e renovação.
- [x] Testar autenticação HTTP/socket e rejeição de sessão alheia.

## Cuidados de implementação

Manter sessões em memória nesta versão. Não importar tabelas de histórias nem adicionar contas de usuário.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.

## Evidências de verificação — 16/10/2026

- Branch `task/04-identidade-convidado`, preservando as entregas anteriores presentes no workspace.
- `GuestSessionStore` em `apps/server/src/modules/guest-identity/` guarda somente ID, hash e prazo, com limpeza no acesso e varredura periódica. Token opaco de 256 bits emitido por `crypto.randomBytes`, prefixo `penshow_v1_`, hash SHA-256 com domínio próprio. Não há banco, contas ou importação de tabelas do Comicle.
- Schemas públicos de emissão, consulta, credenciais e encerramento de sessão em `packages/shared/src/schemas/session.ts`. Status público não aceita token/hash; emissão é a única resposta que devolve o token. O contrato define `penshow.session` para a persistência do navegador a conectar em T05.
- `POST /guest-sessions` emite sessão sem nome/ID escolhidos pelo cliente; `GET /guest-sessions/:playerId` verifica o titular; `POST /guest-sessions/:playerId/renew` renova antes do prazo. Consulta/renovação usam Bearer, rejeitam token na URL e não permitem acessar outro titular. Respostas usam `no-store`; falhas de credencial recebem 401 e sessão alheia com credencial válida recebe 403.
- Validade padrão de 24 horas, ajustável por `GUEST_SESSION_TTL_MS` entre 1 segundo e 7 dias. Renovação explícita mantém ID e token; autenticar/consultar não renova. O instante de expiração é exclusivo e credenciais expiradas não são reativadas. Reinício limpa o registro e invalida as credenciais anteriores.
- Socket autentica `{ token }`, remove credenciais em claro do handshake e guarda prova interna com hash/ID. Cada comando de negócio reconfere validade e conexão ativa. Novo socket do mesmo titular substitui o anterior, com `session:ended`/`replaced`; expiração notifica `expired` e encerra a conexão. Desconexão antiga não apaga o vínculo novo.
- Testes reais em polling e WebSocket usam credenciais emitidas por HTTP, verificam identidade preservada, substituição, reconexão, renovação e prazo exato. Testes também verificam o bloqueio por comando antes de o timer executar, rejeição de token de outra instância, ID declarado no handshake e dois perfis de mesmo nome com atores distintos.
- Captura de logs HTTP/socket confirma ausência de tokens emitidos, inclusive em URL indevida e exceções inesperadas de emissão/autenticação. Erros públicos não expõem token ou stack. Testes do registro confirmam hash armazenado, validade, limpeza, renovação, colisão sem sobrescrita e perda de sessão após reinício.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm install --frozen-lockfile` e `git diff --check` passaram, sem novas dependências. **243 testes passaram**: 96 de servidor, 134 de shared, oito de conteúdo e cinco da web.
- O executável compilado `apps/server/dist/main.js` foi iniciado em processo próprio e porta efêmera: emissão HTTP 201 com `no-store`, verificação 200, renovação 200, autenticação WebSocket e substituição real da conexão. O registro de comandos reconheceu a sessão e retornou `INVALID_PHASE` para o serviço de sala ainda ausente, sem sucesso fictício ou token nos logs.
- Os três exemplos JSON de [sessões](../sessoes.md) foram validados contra os schemas compilados. Protocolo, modelo de dados, servidor, arquitetura, README e `.env.example` foram atualizados.

O controle de participação/permissões em uma sala depende dos serviços de T07; os testes desta tarefa comprovam a identidade entregue ao handler, sem implementar salas fictícias. Presença/projeções de T08 e persistência/telas de T05/T06 continuam nas suas tarefas. D01–D06 permanecem em consulta.
