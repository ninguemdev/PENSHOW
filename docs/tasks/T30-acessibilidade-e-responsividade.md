# T30 — Acessibilidade, celular e acabamento visual

- **Depende de:** [T25](./T25-podio-e-revanche.md), [T18](./T18-fase-velocidade.md), [T19](./T19-fase-aposta.md), [T20](./T20-fase-roubo.md), [T21](./T21-quinta-fase-pressao.md)
- **Pacotes:** web, assets
- **Marco:** M5
- **Branch sugerido:** `task/30-acessibilidade-e-responsividade`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Concluir uma interface legível e operável em todas as fases, com visual consistente e estados claros.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [arquitetura.md](../arquitetura.md)
- [decisoes.md](../decisoes.md)

## Decisões em consulta

D07 orienta as artes e a identidade definitiva. Acessibilidade, foco, contraste e responsividade não dependem dessa escolha.

## Entregáveis

- [ ] Revisar telas em celular, tablet e desktop, textos longos, teclado virtual e safe areas.
- [ ] Validar foco, navegação, atalhos 1 a 4, avisos de resultado e interação de aposta/alvo.
- [ ] Aplicar contraste, ícones/textos além de cor, redução de movimento e tamanhos de toque adequados.
- [ ] Finalizar instruções e identidade visual sem expor detalhes de implementação nos fluxos do jogo.

## Critérios de aceite

- [ ] É possível jogar usando só teclado; foco não fica preso nem dispara resposta quando digitando em outro campo.
- [ ] Enunciados e alternativas longas não escondem confirmação, cronômetro ou controles essenciais.
- [ ] Vidas, penalidades e pergunta fechada são compreensíveis com som silenciado e animação reduzida.

## Verificação

- [ ] Testar telas reais com leitores/árvore de acessibilidade e verificações automatizadas adequadas.
- [ ] Revisar manualmente retrato/paisagem, zoom e conexão lenta, incluindo os dois seletores de alvo.

## Cuidados de implementação

Não substituir conteúdo por animação. Componentes comuns corrigem comportamento comum; variações de modalidade ficam em features próprias.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
