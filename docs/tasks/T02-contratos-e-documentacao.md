# T02 — Contratos compartilhados e documentação técnica

- **Depende de:** [T01](./T01-bootstrap-monorepo.md)
- **Pacotes:** shared, docs
- **Marco:** M1
- **Branch sugerido:** `task/02-contratos-e-documentacao`

O status desta tarefa fica somente no [índice](README.md). As entregas verificadas estão marcadas abaixo, com evidências ao final.

## Objetivo

Definir a linguagem comum de salas, perguntas e partidas antes de ligar os módulos ao transporte.

## Leia antes

- [arquitetura.md](../arquitetura.md)
- [regras.md](../regras.md)
- [plano-do-jogo.md](../plano-do-jogo.md)
- [decisoes.md](../decisoes.md)

## Entregáveis

- [x] Modelar perfis, membros, papéis, configurações, fases, placar, vidas, ações e confirmações como uniões discriminadas.
- [x] Definir schemas de payload e respostas; separar tipos editoriais de pergunta, dados privados do servidor e pergunta pública.
- [x] Criar `docs/protocolo-realtime.md` e `docs/modelo-de-dados.md`, distinguindo contratos disponíveis dos planejados.
- [x] Registrar as consultas D01 a D06 sem transformá-las em requisitos aprovados; estabelecer IDs e versões de partida, fase, pergunta e ação.

## Critérios de aceite

- [x] Uma pergunta pública não possui gabarito, explicação antecipada, posições futuras ou identificadores que denunciem a resposta correta.
- [x] Erros de domínio têm códigos e mensagens de interface em pt-BR; contratos não exigem bibliotecas de transporte.
- [x] R05, R07 e R08 expressam 5 / 4 / 3 / 2 vidas e uma única resposta aceita por pergunta na final.
- [x] Documentar decisões pendentes permite concluir a base dos contratos; variantes ainda indefinidas ficam isoladas nos módulos afetados.

## Verificação

- [x] Validar limites, IDs inválidos, alternativas, papéis e configurações incompatíveis.
- [x] Cobrir payload extra indevido, dados públicos sem gabarito e rejeição de fase/evento desconhecido.

## Cuidados de implementação

Não publicar o catálogo privado por meio de exports de shared. Atualizações de contratos devem acompanhar os documentos criados nesta tarefa.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.

## Evidências de verificação — 16/10/2026

- Branch `task/02-contratos-e-documentacao`, preservando a base de T01 já presente no workspace.
- Contratos públicos em `packages/shared/src/schemas/`, com exports explícitos em `index.ts`: perfis, papéis/presença, configurações, modalidades, perguntas, placar, classificação, finalistas, 16 fases de visão, 14 comandos e suas confirmações. Objetos estritos rejeitam campos desconhecidos, inclusive dentro de payloads e alternativas.
- IDs de entidades/pergunta/alternativa/ação validados como UUIDv4 e distinguidos por marcas TypeScript. Protocolo versão 1, versão crescente por sala e identificador de formato experimental documentados, com regras de contexto, reenvio e aplicação única para os serviços futuros.
- Tipos `EditorialQuestion`, `ApprovedQuestion` e `PreparedQuestion` definidos somente em `apps/server/src/modules/questions/question.ts`. Shared não importa nem exporta catálogo, tipos editoriais ou mapa privado de alternativas. Os importadores e o conteúdo existente não foram alterados nesta tarefa.
- Testes rejeitam gabarito, explicação, procedência, IDs editoriais, questões futuras, sementes e respostas alheias na pergunta aberta; leitura não aceita alternativas e aposta não aceita enunciado. A geração aleatória/embaralhamento será implementada e verificada em T12; o schema só verifica o formato público dos IDs.
- Regras confirmadas imutáveis em `domain/rules.ts`: vidas 5/4/3/2, primeira resposta válida exclusiva, perda de uma vida por erro ou ataque. Testes cobrem todas as posições de 1 a 12, vida restante positiva, eliminação a zero, danos indevidos e seleção de todos os adversários ativos. Não foi implementado motor, arbitragem concorrente ou aplicação de dano nesta tarefa.
- D01–D06 preservadas como `in-consultation`, com quinta fase pendente/experimental e classificação pendente/resolvida explícitas. Nenhuma política de prazo da final, alvo automático ou desempate foi escolhida como padrão.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm install --frozen-lockfile` e `git diff --check` passaram. Não foi necessário alterar dependências ou a resolução do lockfile.
- **138 testes passaram**: 124 em shared (118 novos contratos e os seis testes de saúde), oito de conteúdo, um do servidor HTTP e cinco da web.
- Os três exemplos JSON de [protocolo-realtime.md](../protocolo-realtime.md) foram lidos e validados contra `clientCommandSchema`/`acknowledgementSchema` compilados. [modelo-de-dados.md](../modelo-de-dados.md) descreve limites, exposição, fases e obrigações que serão executadas nas próximas tarefas.

Os eventos estão contratados, mas ainda não têm handlers. Schemas de fotografias verificam invariantes locais; autorização, projeção real, relógio, concorrência e deduplicação de efeitos pertencem aos serviços das tarefas seguintes. O único endpoint disponível continua sendo `GET /health`.
