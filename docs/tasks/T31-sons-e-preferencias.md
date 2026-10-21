# T31 — Sons e preferências do jogador

- **Depende de:** [T25](./T25-podio-e-revanche.md), [T21](./T21-quinta-fase-pressao.md)
- **Pacotes:** web
- **Marco:** M5
- **Branch sugerido:** `task/31-sons-e-preferencias`

O status desta tarefa fica somente no [índice](README.md). Implementação, operação e limites estão registrados em [sons](../sons.md).

## Objetivo

Adicionar retorno sonoro consistente sem bloquear a partida ou depender de áudio externo.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [analise-comicle.md](../analise-comicle.md)

## Entregáveis

- [x] Reaproveitar a abordagem de áudio próprio do Comicle para início, acerto, erro, dinamite, dano e vitória.
- [x] Criar serviço de som separado dos componentes, com ativação por gesto do usuário, volume e silêncio.
- [x] Persistir preferências em `penshow.sound`, com fallback se o armazenamento falhar.
- [x] Disparar sons por transições confirmadas, evitando repetição em reenvio ou reconexão da mesma view.

## Critérios de aceite

- [x] Jogo permanece completo com som desligado ou áudio indisponível.
- [x] Reconnect não repete explosão/vitória já consumida; volume não interfere nos timers.
- [x] Nenhuma chamada a serviço de áudio de terceiros ocorre durante a partida.

## Verificação

- [x] Testar preferência, gesto inicial, ambiente sem áudio e deduplicação por transição.
- [ ] Ouvir o fluxo manualmente para conferir intensidade, duração e sobreposição.

## Cuidados de implementação

Sons são efeito de apresentação. Não colocar pontuação ou transição de partida em callbacks de áudio.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.

## Evidências da implementação

- Branch `task/31-sons-e-preferencias`; trabalho anterior preservado.
- Catálogo de seis composições locais, motor separado, store `penshow.sound`, controles acessíveis e observador de transições confirmadas. Sem novas dependências de áudio ou alteração das regras.
- Dezenove testes novos cobrem preferências, gesto, falhas, quota/getter bloqueado, silêncio, comparação do crédito antecipado do roubo, deduplicação, aba oculta e descarte de assinaturas. Suíte geral aprovada com 817 testes.
- Dez cenários de navegador aprovados em desktop/celular, sem retry: seis de som e quatro de acessibilidade. Incluem contexto e processamento de áudio nativos, partida até o pódio, interrupção real do socket e funcionamento sem Web Audio.
- Prévia WAV dos seis avisos e medidas disponíveis nos artefatos indicados em [sons](../sons.md). Formatação, lint, tipos e build aprovados; job `sound` acrescentado à CI, com artefato `sons` e seleção sem duplicação. CI hospedada não executada localmente.
- A escuta humana do fluxo, intensidade percebida e conforto ainda precisa ser realizada. As medições e a prévia não foram registradas como audição manual; por isso a tarefa permanece em andamento no índice.
