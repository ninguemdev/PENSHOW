# T26 — Reconexão em todas as fases e ciclo de vida

- **Depende de:** [T25](./T25-podio-e-revanche.md), [T18](./T18-fase-velocidade.md), [T19](./T19-fase-aposta.md), [T20](./T20-fase-roubo.md), [T21](./T21-quinta-fase-pressao.md)
- **Pacotes:** server, web, shared, docs
- **Marco:** M4
- **Branch sugerido:** `task/26-reconexao-e-ciclo-de-vida`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Manter estado e permissões consistentes durante quedas, troca de aba, ausência do anfitrião e sala vazia.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [arquitetura.md](../arquitetura.md)
- [analise-comicle.md](../analise-comicle.md)

## Entregáveis

- [ ] Construir matriz de reconexão por instrução, tema, leitura, resposta, aposta, roubo, dinamite, final e pódio.
- [ ] Implementar reentrada com mesma identidade, fotografia atual e descarte de views/timers antigos.
- [ ] Aplicar transferência de anfitrião, carência de sala sem conectados e retomada no próximo passo pendente.
- [ ] Documentar a matriz e o encerramento após reinício em `docs/cenarios-de-reconexao.md`.

## Critérios de aceite

- [ ] Reconectar não devolve aposta, tentativa, direito de ataque consumido, pontuação ou vidas perdidas.
- [ ] Não existem dois controladores ativos para a mesma identidade.
- [ ] Sala sem conectados resolve a janela atual e não abre outra pergunta enquanto aguarda retorno.
- [ ] Reinício não promete recuperar uma partida que só existia em memória.

## Verificação

- [ ] Cobrir queda antes/depois do envio, entre resposta e ataque, durante dinamite e no pódio.
- [ ] Testar retorno antes/depois dos 120 s propostos e anfitrião antes/depois da carência de 30 s com relógio controlado.

## Cuidados de implementação

Definir regra de cada célula antes de corrigir com condicionais locais. Contratos de sessão e fila de sala são reaproveitados, não duplicados.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
