# Interface web

Base implementada em T05, perfil/editor em T06, criação/convite/lobby em T09 e [quiz clássico por estado em T16](quiz-classico-web.md). A direção visual é **provisória**, conforme D07: papel claro, tinta azul e destaque amarelo. Não representa aprovação de identidade definitiva. Os sinais de pontuação são CSS decorativo, ocultos da árvore acessível. As artes de personagem vêm do catálogo público do Comicle, com [licença e procedência](../THIRD_PARTY_NOTICES.md); não há dependência do editor de quadrinhos.

## Tokens e componentes

| Token | Valor | Uso |
|---|---|---|
| `--ink` | `#17263c` | Texto e ações principais |
| `--paper` | `#fffdf7` | Superfícies |
| `--accent` | `#fbc65b` | Ilustração e identificação provisória |
| `--muted` | `#556074` | Texto auxiliar |
| `--line` | `#d6d5ce` | Divisores decorativos |

Fundo `#f6f3eb`, foco `#2463bb`; tipografia local Trebuchet MS/Segoe UI, sem download externo. Layout limitado a 1248px, margens de 40px e 20px no celular. Abaixo de 700px, hero, etapas e sala passam a uma coluna. CSS nativo mantém a base pequena; Tailwind continua sem consumidor necessário nesta etapa.

`Button` é nativo, com `type="button"` padrão, Enter/Espaço e `disabled`. `Dialog` usa `showModal()`, Escape e contenção explícita de Tab/Shift+Tab; foca a ação segura e restaura o acionador, ou o título se ele tiver sido removido. `Timer` recebe prazo e deslocamento do relógio, mostra segundos por texto, limita a zero e anuncia somente o fim. O prazo oficial continua no servidor. `PlayerChip` apresenta avatar em camadas, nome, papel e conexão por texto. `ConnectionNotice` usa `role="status"`, texto e botão de recuperação; cor é complementar.

## Navegação e caminho base

| Caminho relativo | Tela |
|---|---|
| vazio | Início |
| `perfil` | Nome, editor de personagem, salvamento e exclusão do perfil |
| `criar` | Perfil e preferências para criar uma sala |
| `sala/:code` | Sala com código público válido de seis caracteres |
| `erro` e outros caminhos | Erro com retorno ao início |

O roteador pertence ao PENSHOW e só resolve caminhos dentro de `import.meta.env.BASE_URL`. Por padrão a instalação ocupa `/`. Para compartilhar a origem com outros aplicativos, configure o namespace `/penshow/` por `VITE_BASE_PATH=/penshow/`; links, assets e navegação direta respeitam esse prefixo. Códigos válidos em minúsculas são normalizados; códigos inválidos, segmentos extras e texto malformado vão à tela de erro. O formulário do início também remove espaços do código, sem adivinhar I/O/0/1 nem remover pontuação. A navegação mantém histórico/Voltar, links nativos para abrir em outra aba, título focado e atalho para conteúdo.

A configuração de desenvolvimento preserva os bloqueios padrão do Vite e acrescenta arquivos editoriais (`data/questions/**`), relatórios de importação/publicação e código do servidor (`apps/server/**`) à negação de acesso por `/@fs`. O catálogo privado não é asset público nem importação da web. Há teste HTTP real desse bloqueio, mantendo a aplicação e shared acessíveis.

No PowerShell:

```powershell
$env:VITE_BASE_PATH = '/penshow/'
pnpm --filter @penshow/web build
pnpm --filter @penshow/web preview
Remove-Item Env:VITE_BASE_PATH
```

Também é possível copiar `apps/web/.env.example` para `apps/web/.env.local`. O caminho base precisa ser absoluto, com segmentos alfanuméricos, `_` ou `-`, e terminar em `/`; valores inválidos impedem o build. O fallback SPA do servidor estático precisa servir `index.html` em navegação direta. O namespace de transporte é fixo: `/api/*` encaminha ao HTTP sem `/api`, e `/penshow/socket.io` encaminha HTTP e upgrade WebSocket ao servidor. O base da página não altera esses caminhos. Configure ambos no proxy de produção (T34/T35); esta tarefa não escolhe hospedagem.

## Stores, transporte e armazenamento

Componentes renderizam estado e chamam ações das stores Zustand. A composição fica em `stores/client-stores.ts`; HTTP, Socket.IO, armazenamento e relógio ficam em `lib/`. Não há `fetch` nem abertura de socket nas telas. Factories recebem dependências para testes e descartam respostas antigas após desmontagem. Montagem dupla de desenvolvimento não duplica emissão de sessão.

`session-store` consulta saúde, lê `penshow.session` e verifica uma credencial salva antes do socket. Sem credencial, a tela oferece ativação explícita; consultar a página não cria identidades. Renovar é outra ação explícita. Erro transitório preserva a credencial; 401/403 a descarta. Substituição por outra aba encerra o transporte sem reconquistar a conexão automaticamente; ativação explícita reutiliza a mesma identidade. Expiração limpa a credencial. O token não entra em URL, mensagens, perfil, sala ou estado público da UI. O armazenamento é acessível a scripts da mesma origem, exigindo prevenção de XSS na operação de produção.

`profile-store` usa `penshow.profile`, valida nome e pertinência das peças ao catálogo público antes de persistir. Mantém rascunho separado do perfil salvo, sorteio injetável e recuperação por peça para dados antigos. JSON ou nome inválidos são descartados quando permitido; peças válidas são preservadas quando outras desaparecerem. Bloqueio de storage e quota viram aviso e estado em memória, identificado como disponível apenas na aba. Leitura/escrita, inclusive o getter `window.localStorage`, são protegidas. Não há persistência de sala nem gravação de `penshow.sound` antes de T31. Consulte [avatares](avatares.md) para catálogo, camadas, artes e migração.

`room-store` começa sem aceitar mensagens até a sessão ou uma admissão habilitar a recepção. A primeira visão autenticada e validada estabelece a associação real, mesmo sem código esperado: isso recupera a sala ao recarregar e preserva uma visão enviada antes do ack de criação. Depois, rejeita outra sala/código, outro destinatário e versões repetidas/antigas. Navegar pela aplicação conserva a participação; fim de sessão limpa a visão. `room:removed` confere sala/versão, limpa a associação e impede uma visão atrasada de restaurá-la, preservando a sessão. O código removido permite distinguir esse aviso de um novo convite. Não presume participação por visitar uma URL. Reconexão durante partidas será ampliada em T26.

`lobby-store` coordena as intenções de criar/entrar/sair, preferências, perfil e expulsão. Criar/entrar exige perfil salvo e ativa a sessão pela ação explícita do usuário, aguardando o transporte online antes de emitir. Abrir a página não cria sessão nem entra em sala. A store bloqueia cliques concorrentes, mostra erro público, conserva a visão se o ack se perde e não repete mutações automaticamente. Navegação/desmontagem cancela esperas e efeitos locais de confirmações tardias; uma ação já enviada ainda pode ter sido aplicada pelo servidor. Identidade, associação e autorização continuam sendo verificadas no servidor.

O cliente socket valida envelopes, nome do evento e confirmação por ação/evento. Comandos offline falham antes de emitir e não ficam guardados para envio futuro. Timeout informa ausência de confirmação e não repete mutações silenciosamente. A sincronização usa o ponto médio da ida/volta para exibição. Mensagens inesperadas não substituem a visão válida. O cliente HTTP valida respostas e limita requisições a oito segundos; falhas não mostram exceções privadas.

APIs usadas conforme documentação primária de [Zustand](https://zustand.docs.pmnd.rs/reference/apis/create-store), [useStore](https://zustand.docs.pmnd.rs/reference/hooks/use-store) e [Socket.IO](https://socket.io/docs/v4/client-api/).

## Estados visíveis e limites

- Carregamento: página disponível, aviso de conexão e ativação desabilitada.
- Servidor disponível sem sessão: ativação habilitada; navegação local funciona.
- Conectado: confirmação textual e renovação habilitada.
- Falha HTTP ou queda do socket: aviso textual, ações remotas pausadas e tentativa de recuperação. Perfil local permanece acessível.
- Dados locais ausentes/corrompidos/bloqueados: conteúdo vazio e orientação ou aviso, nunca tela em branco.
- Perfil vazio: nome em branco e personagem sorteado, editáveis por teclado/toque; salvar exige apelido válido.
- Convite sem perfil: oferece preparação com retorno ao código; criação também preserva seu destino após salvar.
- Sala inexistente/cheia: mostra o erro do servidor e retorno ao início. Remoção distingue saída, expulsão e fechamento, conservando a sessão; saída voluntária permite nova tentativa de entrada.
- Lobby: mostra personagens, nome, anfitrião, presença e espectadores; apenas o anfitrião recebe controles de preferências/expulsão/início. Ações remotas ficam pausadas sem conexão.
- Rota desconhecida: erro navegável com retorno ao início.

Textos visíveis ficam em `strings/pt-BR.ts`, além das mensagens públicas dos contratos. Testes por papel/texto cobrem navegação, recuperação, teclado, diálogo, cronômetro, storage e protocolo; a modalidade nativa do diálogo também deve ser exercitada no navegador real, pois jsdom não implementa a camada modal.

Salvar o perfil retorna ao início, onde nome e personagem são exibidos. `perfil?next=<caminho absoluto dentro do base>` pode retornar à criação ou a uma rota de sala válida; destinos externos, outras aplicações, rotas inválidas e retorno ao próprio perfil caem no início. No lobby, editar conserva a associação e oferece aplicar o perfil salvo à sala quando seus campos diferirem; ordem de propriedades JSON não significa mudança de personagem. O editor usa abas com setas/Home/End, botões com estado `aria-pressed`, escolha `Nenhum` para opcionais e prévias decorativas; não usa Canvas.

## Convite, preferências e início

O convite usa somente origem, caminho base e código público. O campo de link fica sempre visível e seleciona o endereço ao receber foco. A cópia tenta a área de transferência; ausência, contexto sem permissão ou recusa mostra instrução para copiar manualmente, mantendo o campo focado/selecionado. Nenhuma credencial entra no endereço.

O formulário valida vagas de 2 a 12 e ao menos um tema pelo contrato compartilhado. Seis preferências iniciais oferecem História, Geografia, Ciência e natureza, Esportes, Artes e literatura e Cultura pop, usando seus slugs públicos; não constituem catálogo editorial publicado nem garantia de perguntas suficientes. Temas desconhecidos recebidos são preservados. Uma fotografia confirmada de configurações refaz o formulário; presença/perfil não descartam rascunhos de preferências. Convidados só veem as configurações, sem controles administrativos.

O lobby identifica o formato atual como quiz clássico de teste, com uma fase e seis perguntas. O anfitrião pode iniciar com dois jogadores conectados, sessão online e fotografia atual da sala. O servidor confere o conteúdo e só disponibiliza o modo em desenvolvimento/teste. Instruções, tema, leitura, resposta, revelação, resultado e conclusão são renderizados na mesma rota pela view. Não há navegação manual entre fases. Espectadores recebem controles indisponíveis, e apenas o anfitrião pode enviar retorno ao lobby após conclusão/interrupção.

`match-store` monta contexto a partir da visão recebida, bloqueia escolhas concorrentes e não modifica placar/fase com base em ack. Timeout de resposta mantém a tentativa bloqueada até recuperação; uma conexão nova precisa receber fotografia antes de habilitar ações. `ownAnswer: submitted` conserva a escolha após reconexão. `viewReady`, época de conexão e chaves de fase/pergunta também impedem feedback atrasado. O relógio usa `time:sync`, com `serverNow` como aproximação inicial, sem decidir transições. Detalhes e verificações estão em [quiz na web](quiz-classico-web.md).

Sair e expulsar usam diálogo com foco na ação segura e Escape. A confirmação vale para a versão apresentada; alteração da sala fecha o diálogo antes que uma escolha antiga seja reaplicada. Permissões e alvo são novamente conferidos no servidor.
