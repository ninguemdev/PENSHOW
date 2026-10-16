# T31 — Sons e preferências do jogador

- **Depende de:** [T25](./T25-podio-e-revanche.md), [T21](./T21-quinta-fase-pressao.md)
- **Pacotes:** web
- **Marco:** M5
- **Branch sugerido:** `task/31-sons-e-preferencias`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Adicionar retorno sonoro consistente sem bloquear a partida ou depender de áudio externo.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [analise-comicle.md](../analise-comicle.md)

## Entregáveis

- [ ] Reaproveitar a abordagem de áudio próprio do Comicle para início, acerto, erro, dinamite, dano e vitória.
- [ ] Criar serviço de som separado dos componentes, com ativação por gesto do usuário, volume e silêncio.
- [ ] Persistir preferências em `penshow.sound`, com fallback se o armazenamento falhar.
- [ ] Disparar sons por transições confirmadas, evitando repetição em reenvio ou reconexão da mesma view.

## Critérios de aceite

- [ ] Jogo permanece completo com som desligado ou áudio indisponível.
- [ ] Reconnect não repete explosão/vitória já consumida; volume não interfere nos timers.
- [ ] Nenhuma chamada a serviço de áudio de terceiros ocorre durante a partida.

## Verificação

- [ ] Testar preferência, gesto inicial, ambiente sem áudio e deduplicação por transição.
- [ ] Ouvir o fluxo manualmente para conferir intensidade, duração e sobreposição.

## Cuidados de implementação

Sons são efeito de apresentação. Não colocar pontuação ou transição de partida em callbacks de áudio.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
