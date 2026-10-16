# T32 — Testes com grupos e equilíbrio

- **Depende de:** [T29](./T29-e2e-partida-completa.md), [T30](./T30-acessibilidade-e-responsividade.md), [T31](./T31-sons-e-preferencias.md)
- **Pacotes:** docs, server, web
- **Marco:** M5
- **Branch sugerido:** `task/32-testes-de-grupo-e-equilibrio`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Validar os valores propostos e a duração com partidas observadas antes de tratar o formato como consolidado.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [regras.md](../regras.md)
- [decisoes.md](../decisoes.md)

## Entregáveis

- [ ] Executar sessões com 2, 4 e 8 participantes; verificar capacidade de 12 com sessão ou teste documentado equivalente.
- [ ] Registrar duração por fase, acertos, efeitos de aposta/roubo, mudanças de posição e vantagem inicial na final.
- [ ] Revisar +300 / −150 da quinta fase, bônus de velocidade e limites de roubo/aposta com evidência.
- [ ] Atualizar plano, regras, parâmetros e expectativas dos testes em cada ajuste decidido.

## Critérios de aceite

- [ ] Relatório distingue medição, percepção e sugestão; não apresenta estimativa como tempo observado.
- [ ] Seis decisões consultadas estão resolvidas ou explicitamente mantidas como experimentais num piloto identificado.
- [ ] Não alterar as vidas confirmadas ou a primeira resposta exclusiva da final por conveniência técnica.
- [ ] Duração de grupo grande e perguntas sem dano são relatadas sem prometer limite inexistente.

## Verificação

- [ ] Conferir registros de pelo menos uma partida completa por tamanho efetivamente testado.
- [ ] Reexecutar somente cenários afetados pelos ajustes e o fluxo completo quando mudarem transições.

## Cuidados de implementação

Preferir relatório local e estatísticas agregadas da sessão; não adicionar telemetria externa para cumprir esta tarefa. Publicação definitiva depende de consolidar as regras pendentes.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
