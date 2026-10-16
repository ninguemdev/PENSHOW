# T02 — Contratos compartilhados e documentação técnica

- **Depende de:** [T01](./T01-bootstrap-monorepo.md)
- **Pacotes:** shared, docs
- **Marco:** M1
- **Branch sugerido:** `task/02-contratos-e-documentacao`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Definir a linguagem comum de salas, perguntas e partidas antes de ligar os módulos ao transporte.

## Leia antes

- [arquitetura.md](../arquitetura.md)
- [regras.md](../regras.md)
- [plano-do-jogo.md](../plano-do-jogo.md)
- [decisoes.md](../decisoes.md)

## Entregáveis

- [ ] Modelar perfis, membros, papéis, configurações, fases, placar, vidas, ações e confirmações como uniões discriminadas.
- [ ] Definir schemas de payload e respostas; separar tipos editoriais de pergunta, dados privados do servidor e pergunta pública.
- [ ] Criar `docs/protocolo-realtime.md` e `docs/modelo-de-dados.md`, distinguindo contratos disponíveis dos planejados.
- [ ] Registrar as consultas D01 a D06 sem transformá-las em requisitos aprovados; estabelecer IDs e versões de partida, fase, pergunta e ação.

## Critérios de aceite

- [ ] Uma pergunta pública não possui gabarito, explicação antecipada, posições futuras ou identificadores que denunciem a resposta correta.
- [ ] Erros de domínio têm códigos e mensagens de interface em pt-BR; contratos não exigem bibliotecas de transporte.
- [ ] R05, R07 e R08 expressam 5 / 4 / 3 / 2 vidas e uma única resposta aceita por pergunta na final.
- [ ] Documentar decisões pendentes permite concluir a base dos contratos; variantes ainda indefinidas ficam isoladas nos módulos afetados.

## Verificação

- [ ] Validar limites, IDs inválidos, alternativas, papéis e configurações incompatíveis.
- [ ] Cobrir payload extra indevido, dados públicos sem gabarito e rejeição de fase/evento desconhecido.

## Cuidados de implementação

Não publicar o catálogo privado por meio de exports de shared. Atualizações de contratos devem acompanhar os documentos criados nesta tarefa.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
