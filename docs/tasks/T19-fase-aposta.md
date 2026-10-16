# T19 — Modalidade de aposta

- **Depende de:** [T17](./T17-primeiro-marco-jogavel.md), [T13](./T13-pontuacao-e-parametros.md)
- **Pacotes:** server, web, shared
- **Marco:** M3
- **Branch sugerido:** `task/19-fase-aposta`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Entregar escolha de risco antes da pergunta, com saldo e apostas protegidos pelo servidor.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [regras.md](../regras.md)
- [arquitetura.md](../arquitetura.md)

## Entregáveis

- [ ] Criar subestado de aposta antes de cada enunciado, com tema, dificuldade e janela proposta de seis segundos.
- [ ] Validar escolhas 0 / 25 / 50 cobertas pelo saldo e assumir zero em ausência de escolha.
- [ ] Resolver acerto como +100 + aposta; erro ou ausência como perda apenas da aposta.
- [ ] Construir controle acessível de aposta, confirmação e revelação individual do efeito no saldo.

## Critérios de aceite

- [ ] Aposta de outro participante e enunciado não vazam antes do fim da etapa de aposta.
- [ ] Saldo insuficiente não permite comprometer pontos inexistentes; escolha zero mantém direito de responder.
- [ ] Reconectar recupera aposta aceita sem reapostar; repetir ação não debita duas vezes.

## Verificação

- [ ] Testar saldo 0, 25 e 50; aposta acima do saldo; prazo e estado inválidos.
- [ ] Conferir exemplos 500 → 650 no acerto com 50 e 500 → 450 no erro, além de aposta ausente.

## Cuidados de implementação

A estratégia calcula os efeitos; o serviço os aplica uma vez. UI não deve manter um saldo alternativo ao enviado na view.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
