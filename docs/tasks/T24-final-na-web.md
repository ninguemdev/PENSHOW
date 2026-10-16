# T24 — Final na web e visualização das vidas

- **Depende de:** [T16](./T16-quiz-classico-web.md), [T23](./T23-final-no-servidor.md)
- **Pacotes:** web
- **Marco:** M3
- **Branch sugerido:** `task/24-final-na-web`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Exibir a vantagem inicial, a disputa da primeira resposta e a escolha de alvo sem prometer prioridade antes da confirmação.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [arquitetura.md](../arquitetura.md)

## Entregáveis

- [ ] Criar instrução da final e animação informativa de pontos/colocação para vidas.
- [ ] Exibir vidas, enunciado, alternativas, estado de pergunta fechada e primeiro respondente confirmado.
- [ ] Disponibilizar escolha de alvo somente ao vencedor do acerto, com prazo e adversários elegíveis.
- [ ] Mostrar perda de vida, eliminação e espectador com foco e avisos acessíveis.

## Critérios de aceite

- [ ] Um clique não mostra sucesso de prioridade até o servidor aceitar a resposta.
- [ ] Jogador eliminado assiste sem controles de resposta/ataque; reconexão restaura a tela correta.
- [ ] Outros jogadores não recebem a escolha de alvo como ação habilitada.
- [ ] Alterações de vida são legíveis sem depender de som, cor ou animação.

## Verificação

- [ ] Testar primeiro erro, primeiro acerto, resposta rejeitada e ataque a um adversário offline.
- [ ] Validar duas abas concorrendo com servidor real e interface móvel em escolha de alvo.

## Cuidados de implementação

Reutilizar componentes de pergunta, mas não o comportamento de coletar respostas de todos das fases iniciais.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
