# Identidade anônima e sessão

O servidor já emite, verifica e renova sessões de convidado, sem conta ou senha. Apelido e avatar pertencem ao perfil e não autenticam ninguém. Uma sessão identifica o mesmo `PlayerId` nas reconexões enquanto seu token estiver válido.

O módulo está em `apps/server/src/modules/guest-identity/`. Os contratos públicos estão em `packages/shared/src/schemas/session.ts`; o gerador/hash de produção está em `apps/server/src/platform/session-tokens.ts`. Não há banco nem dependência de histórias/quadrinhos.

## Credencial e armazenamento

O token começa com `penshow_v1_`, seguido de 43 caracteres base64url gerados com 32 bytes aleatórios criptográficos (256 bits). Ele não contém ID, apelido, prazo ou dados de sala. A implementação usa [randomBytes do Node.js](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptorandombytessize-callback).

`GuestSessionStore` mantém somente `{ playerId, tokenHash, expiresAt }`, indexado pelo hash. O hash é SHA-256 da concatenação `penshow:guest-session:v1:` + token. O token em claro só sai na resposta de criação; verificação e renovação não o devolvem. Não há endpoint para listar sessões ou obter hashes.

O formato e o domínio do hash são próprios do PENSHOW. Tokens do Comicle, hashes enviados como Bearer e tokens de outra instância do servidor não autenticam a sessão. Cada aplicação mantém seu registro em memória. `GUEST_SESSION_STORAGE_KEY` define `penshow.session` para o cliente; a persistência no navegador está conectada desde T05, sem ler chaves `comicle.*`.

A abordagem de registro em memória, token opaco, hash, prazo por uso e limpeza foi conferida no [session-store do Comicle no commit analisado](https://github.com/ninguemdev/Comicle/blob/4521f34df78da7de54a30715d50e748c50aa0696/apps/server/src/modules/guest-identity/session-store.ts). A implementação do PENSHOW foi escrita para suas portas e contratos. A renovação aqui é explícita, conforme descrito abaixo; não é uma cópia da renovação deslizante a cada autenticação daquele projeto.

## HTTP

As rotas usam a mesma porta HTTP do healthcheck. `playerId` na URL é UUIDv4 e deve coincidir com o titular identificado pelo token. As rotas de consulta/renovação aceitam apenas `Authorization: Bearer <token>`; não recebem token por query, corpo, cookie ou apelido.

| Método e caminho | Entrada | Resposta de sucesso |
|---|---|---|
| `POST /guest-sessions` | Sem corpo ou `{}`, sem parâmetros de query | 201: `IssuedGuestSession` |
| `GET /guest-sessions/:playerId` | Bearer do titular, sem query | 200: `GuestSession` |
| `POST /guest-sessions/:playerId/renew` | Bearer do titular, sem corpo ou `{}`, sem query | 200: `GuestSession` |

Exemplo de emissão, com credencial apenas ilustrativa:

```json
{
  "scope": "penshow",
  "playerId": "00000000-0000-4000-8000-000000000001",
  "expiresAt": 86401000,
  "token": "penshow_v1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
}
```

Consulta e renovação retornam o mesmo formato sem `token`:

```json
{
  "scope": "penshow",
  "playerId": "00000000-0000-4000-8000-000000000001",
  "expiresAt": 86401000
}
```

Essas respostas e os erros das rotas têm `Cache-Control: no-store` e `Pragma: no-cache`. Corpo inválido, dados adicionais, UUID malformado ou query indevida recebem 400/`INVALID_PAYLOAD`. Token ausente, desconhecido, inválido ou expirado recebe 401/`UNAUTHENTICATED`; a resposta inclui o desafio Bearer do PENSHOW. Um token válido contra outro `playerId` recebe 403/`FORBIDDEN`. Não há distinção pública entre motivos de falha de uma credencial.

A criação não aceita um ID ou nome escolhido pelo navegador. Chamá-la novamente cria outra identidade; não recupera uma sessão pelo apelido. Dois perfis com o mesmo nome continuam com jogadores distintos. A renovação exige o token da própria sessão.

A [T28](privacidade-limites-e-concorrencia.md) limita emissões a 60 e consultas/renovações somadas a 240 por IP remoto a cada 60 segundos, em orçamentos separados. Excesso retorna 429/`RATE_LIMITED` com `Retry-After` e os mesmos cabeçalhos de não armazenamento. O registro comporta até 10.000 sessões por instância; emissão na capacidade recupera expiradas antes de recusar com 503/`SERVER_BUSY`. Novos handshakes e conexões simultâneas também têm limites; reconectar não restaura o orçamento de comandos da identidade.

## Prazo e renovação

- Validade padrão: **24 horas**, configurada por `GUEST_SESSION_TTL_MS=86400000`.
- O limite operacional permitido é de 1 segundo a 7 dias por janela; valores curtos servem aos testes. Isso não altera os tempos do jogo nem as consultas D01–D06.
- O instante de expiração é exclusivo: em `now >= expiresAt`, a credencial não é mais válida.
- Consultar a sessão, autenticar socket, responder ou consultar tempo **não renova** o prazo.
- Renovar antes do prazo conserva `PlayerId`, token e hash. O novo prazo é o maior entre o atual e `now + TTL`; um recuo do relógio não reduz a validade já concedida.
- A janela não é um limite absoluto de vida: uma sessão válida pode ser renovada novamente. Renovação não revive sessão expirada nem preserva dados após reinício.

O token não é rotacionado na renovação, portanto o cliente mantém a mesma credencial e atualiza apenas `expiresAt`. Uma conexão já autenticada continua válida até o novo prazo; o timer de conexão reconfere o registro ao chegar ao prazo anterior. A renovação HTTP não disputa a conexão ativa nem substitui a aba que está jogando.

O registro remove expiradas no acesso e faz uma varredura a cada dez minutos. Uma entrada inativa pode permanecer até a limpeza, mas nunca autentica depois do prazo. A limpeza é agendada pelas portas de T03 e é cancelada no encerramento.

## Socket e substituição de conexão

O cliente conecta em `/penshow/socket.io` com `auth: { token }`. O objeto é estrito: adicionar `playerId`, nickname, token de outro formato ou campos extras recusa a conexão com `connect_error`. O erro contém apenas a mensagem pública e `data` no formato `DomainError`. A implementação segue o fluxo de [middleware e credenciais do Socket.IO](https://socket.io/docs/v4/middlewares/).

`auth: {}` permite somente a conexão anônima usada pela consulta pública `time:sync`; não dá acesso a comandos autenticados. Se uma credencial for apresentada e inválida, ela não é ignorada para conectar anonimamente.

Depois de validar, o servidor apaga `handshake.auth` e conserva uma prova interna com `playerId` e `tokenHash`. Cada comando de negócio reconfere a validade e se aquela ainda é a conexão ativa. Não é possível trocar a identidade de uma conexão alterando um perfil ou enviando outro ID no payload. Para usar outra credencial, é necessário reconectar.

Há uma conexão ativa por identidade. Ao conectar novamente com o mesmo token:

1. O registro passa a apontar para o novo socket.
2. O anterior recebe `session:ended` com `reason: "replaced"` e é desconectado pelo servidor.
3. A desconexão anterior não apaga o vínculo novo.
4. A nova conexão conserva o `PlayerId`, recupera sua associação à sala e publica uma visão completa do lobby, sem criar outro participante nem sobrescrever seu perfil.

A desconexão do servidor não dispara a reconexão automática padrão do cliente Socket.IO, evitando disputa contínua entre abas. Uma reconexão posterior iniciada pelo cliente e com credencial válida pode voltar a assumir a identidade. A posse do token é a credencial; apelido, origem e código de sala não a substituem.

No prazo, a conexão recebe `session:ended` com `reason: "expired"` e é desconectada. O timer considera renovações; mesmo se estiver atrasado, a checagem por comando impede novas ações autenticadas após a expiração. Mutações já aplicadas não são revertidas pela troca/expiração. Comandos de sala ainda aguardando na fila revalidam sessão e conexão antes de alterar estado, sendo rejeitados se a credencial expirou ou outra aba assumiu. A deduplicação de efeitos por `actionId` continua pendente.

Exemplo de evento enviado antes do encerramento:

```json
{
  "protocolVersion": 1,
  "event": "session:ended",
  "payload": { "reason": "replaced" }
}
```

Os eventos `room:view`, `room:removed` e `session:ended` são discriminados por `serverEventSchema`. Nenhum deles contém token ou hash. Presença, associação e projeção individual do lobby já estão conectadas aos handlers autenticados. Uma aba substituída não gera uma ausência intermediária falsa, e sua desconexão não libera a nova conexão. Um comando de negócio ainda sem handler recebe `INVALID_PHASE`, mesmo com token válido.

## Encerramento e reinício

`app.close()` cancela os timers de conexão e varredura, desconecta os sockets, limpa sessões e aguarda trabalho já admitido conforme o ciclo de T03. Não há recuperação após reinício: o processo novo recusa os tokens emitidos pelo anterior. O cliente precisará criar nova sessão; reaproveitar apelido/avatar não recupera automaticamente o jogador antigo.

O estado do registro não integra shared, perfil, visão da sala, logs ou arquivos estáticos. Logs automáticos de requisição permanecem desabilitados; falhas HTTP e do middleware usam mensagens fixas. Testes verificam que credenciais reais emitidas no teste não aparecem nos logs, inclusive em query indevida e exceção inesperada.

## Verificação

As suítes cobrem hash armazenado, token opaco, colisão sem sobrescrita, prazo exato, renovação, varredura, encerramento, reinício, HTTP do titular e rejeição de sessão alheia. Integração em polling/WebSocket verifica autenticação a partir do token emitido em HTTP, preservação da identidade, abas substituídas, expiração e renovação sem sleeps ou espera por prazos reais.

A [interface](interface.md) verifica credenciais salvas, ativa/renova sessões por ações explícitas e conecta o socket autenticado. Erros de storage mantêm funcionamento em memória; substituição de aba não inicia reconexão automática. A renovação preserva o socket existente. O [perfil/editor de T06](avatares.md) mantém dados locais separados da credencial. Autenticar a identidade não comprova participação em uma sala: o [serviço de salas](salas.md) verifica associação e conexão dentro da fila, usando o vínculo autenticado fornecido pelos handlers/sockets. Não foram criados banco ou contas.
