# T06 — Perfil, nomes e editor de personagens

- **Depende de:** [T05](./T05-web-base-e-interface.md)
- **Pacotes:** web, shared, assets
- **Marco:** M1
- **Branch sugerido:** `task/06-perfil-e-avatares`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Reaproveitar o sistema de nome e personagem do Comicle com identidade e armazenamento próprios.

## Leia antes

- [analise-comicle.md](../analise-comicle.md)
- [arquitetura.md](../arquitetura.md)

## Entregáveis

- [x] Migrar catálogo, regras de seleção/sanitização, artes necessárias, editor e renderizador em camadas.
- [x] Implementar perfil com apelido normalizado, validação compartilhada e retorno ao fluxo de entrada após salvar.
- [x] Persistir em `penshow.profile`; recuperar partes válidas quando o catálogo mudar.
- [x] Adaptar o verificador de artes e manter licença e procedência dos arquivos efetivamente reutilizados.

## Critérios de aceite

- [x] Primeira visita permite montar ou sortear o personagem e salvar um nome válido.
- [x] Avatar permanece após recarregar; opções inválidas são saneadas sem apagar partes válidas.
- [x] Editor funciona por teclado e toque; não há dependência de Canvas ou editor de quadrinhos.

## Verificação

- [x] Testar nickname vazio, longo e Unicode; sorteio determinístico e sanitização de catálogo.
- [x] Testar seleção, opção sem acessório, persistência e artes ausentes/inseguras.

## Cuidados de implementação

Preservar a identidade Git configurada e as licenças dos arquivos reutilizados. IDs de personagem são públicos; credenciais de sessão não pertencem ao perfil.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.

## Evidências de verificação — 16/10/2026

- Branch `task/06-perfil-e-avatares`, preservando as entregas anteriores presentes no workspace e a configuração de identidade Git.
- Catálogo e 50 PNGs copiados do Comicle no commit `4521f34df78da7de54a30715d50e748c50aa0696`. Regras de catálogo/seleção/sanitização, editor, camadas, recuperação de perfil, retorno e verificador adaptados ao PENSHOW, sem Canvas, gerador ou módulos de quadrinhos. A licença MIT original está em `licenses/comicle-LICENSE.txt`, também distribuída na web; `THIRD_PARTY_NOTICES.md` identifica os arquivos derivados e `licenses/comicle-avatars.json` registra os hashes das artes copiadas. O teste confere esses hashes e a cópia pública da licença.
- Shared valida cada ID na categoria correta, além da estrutura já contratada. Catálogo estrito rejeita duplicatas, ausência de opções obrigatórias ativas e caminhos não locais; apenas PNG no caminho exato da categoria/ID é aceito. Peças aposentadas continuam renderizáveis, saindo do editor/sorteio. RNG injetável e sanitização por categoria têm testes determinísticos.
- `profile-store` separa rascunho e perfil salvo; primeira visita oferece nome vazio e avatar sorteado. Normaliza apelido por NFC/espaços, valida o limite de 1–20 pontos de código e bloqueia controles/invisíveis. Persiste somente nome/avatar em `penshow.profile`; leitura antiga recupera peças válidas e regrava as restantes saneadas. Falha de storage mantém o perfil na aba, com aviso e confirmação correspondente; identidade/token de sessão não entram no perfil.
- `AvatarEditor` usa seis abas, setas/Home/End, botões com estado acessível, prévias compostas e Nenhum nas categorias opcionais. `AvatarRenderer` empilha imagens na ordem cabeça/bochechas/olhos/boca/acessório/chapéu, com rótulo acessível ou decoração, respeitando o caminho base. `PlayerChip` e início usam o mesmo renderizador.
- Salvar retorna ao início ou a uma rota válida de sala indicada em `next` dentro do base; retorno externo, outra aplicação e rota inválida caem no início. A entrada efetiva na sala continua em T09.
- **311 testes passaram**: 151 shared, 96 servidor, 51 web, oito de conteúdo e cinco de artes. Cobertura inclui nomes vazios/longos/Unicode, sorteio determinístico, aposentadoria, partes inválidas, seleção por teclado, opção Nenhum, persistência/reload, retorno seguro, storage bloqueado/quota e separação de sessão. Fixtures anteriores foram atualizadas para IDs reais do catálogo.
- `pnpm avatars:check` passou nas **50 artes**. O verificador também rejeita ausência, órfãos, duplicatas, links, SVG/script disfarçado, tamanho excessivo, dimensão incorreta, PNG truncado/CRC/filtro inválido, imagem opaca/vazia, animação e conteúdo após IEND. Descompressão é limitada ao tamanho esperado. O check foi adicionado à CI e os testes de artes ao `pnpm test`, sem novas dependências.
- Chrome headless com servidor compilado e preview reais sob `/penshow/`: primeiro acesso com nome vazio, 50 imagens distintas carregadas, erro/foco ao salvar nome vazio, nome com acento combinado normalizado, seleção de Coroa por Enter, persistência e recuperação após reload, seleção/remoção de acessório por toque, recuperação parcial de catálogo antigo e retorno ao convite. Storage bloqueado também permite salvar e continuar em memória. Nenhuma exceção de runtime capturada.
- Capturas desktop (1440px) e celular (390px) inspecionadas; ausência de overflow horizontal também verificada em 320px. Artefatos locais em `%TEMP%/penshow-t06-*`, fora do bundle. Build padrão restaurado para `/` após verificar o base alternativo.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm avatars:check`, `pnpm build`, `pnpm install --frozen-lockfile` e `git diff --check` passaram. A execução hospedada da CI depende do envio do branch.
- Documentação em [avatares](../avatares.md), [interface](../interface.md), modelo de dados, protocolo, desenvolvimento e README atualizada. D07 continua sem direção visual definitiva, e D08 sem destino de hospedagem escolhido.
