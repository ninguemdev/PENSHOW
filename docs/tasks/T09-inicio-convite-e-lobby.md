# T09 — Início, convite e lobby

- **Depende de:** [T06](./T06-perfil-e-avatares.md), [T08](./T08-salas-realtime-e-projecao.md)
- **Pacotes:** web
- **Marco:** M1
- **Branch sugerido:** `task/09-inicio-convite-e-lobby`

O status desta tarefa fica somente no [índice](README.md). As evidências abaixo descrevem os arquivos implementados e as verificações executadas.

## Objetivo

Entregar o fluxo de formar um grupo com nome, personagem, código e convite.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [arquitetura.md](../arquitetura.md)

## Entregáveis

- [x] Integrar sessão, perfil, criação e entrada por código/link com estados de carregamento e erro.
- [x] Mostrar jogadores, avatares, anfitrião, presença, espectadores e configurações de quiz.
- [x] Implementar cópia de convite com alternativa visível quando indisponível e normalização do código.
- [x] Exibir resumo da final e preparar a ação de início, habilitada somente quando houver motor e conteúdo elegíveis.

## Critérios de aceite

- [x] Criador e convidados chegam à mesma sala sem cadastro ou edição manual de URL.
- [x] Não anfitrião não recebe controles administrativos; servidor também rejeita ações indevidas.
- [x] A interface representa o papel de espectador quando recebido na view; a integração com chegada durante partida será concluída com o motor e a T16.
- [x] Sala inexistente, cheia ou removida tem saída compreensível.

## Verificação

- [x] Testar criação/entrada por navegação e stores; código inválido, perfil faltante e erro de rede.
- [x] Validar em duas sessões e viewport móvel, incluindo convite sem acesso à área de transferência.

## Cuidados de implementação

Não simular partida concluída nem habilitar início sem dependências. Controles ainda indisponíveis devem indicar seu estado real.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.

## Evidências de verificação — 17/10/2026

- Branch `task/09-inicio-convite-e-lobby`, preservando o trabalho anterior do workspace. Implementação restrita à web e documentação, sem novas dependências ou mudança do protocolo/servidor.
- `features/home/home-page.tsx` oferece criação e formulário de código; `create-room-page.tsx` apresenta perfil e preferências. A rota `criar` e o retorno seguro do editor conservam o destino de criação ou convite. Letras minúsculas e espaços do código são normalizados; caracteres ambíguos, pontuação e tamanhos incorretos são rejeitados antes de emitir.
- `stores/lobby-store.ts` coordena os seis comandos de sala pelos contratos existentes. Criação/entrada exigem perfil e ativam a sessão por intenção explícita, esperando a conexão online. Páginas não criam sessão/associação ao abrir. Ações concorrentes ficam bloqueadas, erros públicos são apresentados, esperas são canceladas ao navegar e respostas tardias não redirecionam a página. Não há retry automático de mutações.
- `room-store` recebe a primeira fotografia autenticada mesmo antes do ack ou sem código conhecido, permitindo recuperar a associação após reload. Fotografias posteriores conservam sala, destinatário e versão. Navegação local conserva a participação; remoção/fim de sessão limpam o estado apropriado. Confirmação perdida conserva a fotografia já recebida. Após saída voluntária, outro clique permite nova entrada; expulsão e fechamento oferecem retorno ao início.
- `room-page.tsx` apresenta personagens, nomes, presença, anfitrião, espectador e preferências confirmadas. Apenas o anfitrião no lobby recebe edição de vagas/temas e expulsão; o servidor continua autorizando as ações. Edição local de perfil conserva a sala e oferece aplicar os campos alterados. Comparação usa os campos do avatar, sem confundir ordem de propriedades JSON com mudança de aparência.
- Preferências usam validação compartilhada: 2–12 vagas e ao menos um tema. As seis opções iniciais são preferências para conteúdo futuro, com aviso explícito de preparação; temas recebidos fora dessa lista são preservados. O resumo apresenta seis etapas experimentais e as regras confirmadas da final. `Iniciar partida` permanece desabilitado e explica a indisponibilidade, inclusive com dois jogadores conectados; não emite `match:start`.
- `invite-panel.tsx` sempre mostra o endereço com origem/base/código públicos. Cópia bem-sucedida é confirmada; API ausente/recusada orienta a cópia manual, com foco e seleção do link. Nenhuma credencial entra no convite. Saída/expulsão têm confirmação, foco seguro e Escape; mudança da versão invalida o diálogo antigo.
- Testes web cobrem criação e entrada por navegação, perfil ausente com retorno, normalização/código inválido, preferência vazia, erro de rede, espera por conexão, cliques concorrentes, resposta tardia, ack perdido, sala inexistente/cheia, associação recuperada, espectador, presença desconectada, ausência de controles administrativos, remoção, saída/nova entrada, falha de saída e cópia aceita/recusada. A suíte de servidor existente passou novamente, incluindo rejeição de convidado sem permissão e identidade/associação incorretas em rede real.
- Chrome headless com servidor compilado e preview reais sob `/penshow/`, em duas instâncias com armazenamento independente: criar com perfil obrigatório, convidar por link em minúsculas, preparar perfil do convidado, compartilhar lobby, mudar vagas/perfil e observar no outro cliente, recarregar sem novo join, navegar e retornar, sair/transferir anfitrião, entrar novamente, expulsar e tratar sala inexistente. Foi simulada recusa da API de área de transferência no navegador para conferir instrução, seleção e foco; Escape também foi exercitado no diálogo nativo. Nenhuma exceção de runtime capturada.
- Capturas desktop (1440px) e celular (390px) inspecionadas; ausência de overflow horizontal conferida em 320px e 390px. Artefatos finais em `%TEMP%/penshow-t09-PBRM9x` (`lobby-desktop.png`, `lobby-mobile.png`, `missing-room.png`); roteiro local `%TEMP%/penshow-t09-smoke.mjs`, fora do bundle. Build padrão restaurado para `/` após verificar o base alternativo. Processos de teste foram encerrados.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm avatars:check`, `pnpm install --frozen-lockfile` e `git diff --check` passaram. **396 testes**: 159 shared, 150 server, 74 web, oito de conteúdo e cinco de artes; 50 artes verificadas. Os novos testes web entram automaticamente na CI existente. A execução hospedada depende do envio do branch.
- [Interface](../interface.md), [salas](../salas.md), [avatares](../avatares.md), desenvolvimento e README atualizados. Esta entrega completa o fluxo de grupo do marco M1; partidas, catálogo editorial e publicação continuam nas tarefas seguintes. D01–D08 não foram tratadas como aprovadas.
