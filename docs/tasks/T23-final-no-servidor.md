# T23 — Final no servidor com primeira resposta exclusiva

- **Depende de:** [T14](./T14-motor-comum-de-partida.md), [T22](./T22-classificacao-e-vidas.md)
- **Pacotes:** server, shared
- **Marco:** M3
- **Branch sugerido:** `task/23-final-no-servidor`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Implementar a disputa de vidas com uma única resposta aceita por pergunta e dano aplicado uma única vez.

## Leia antes

- [regras.md](../regras.md)
- [plano-do-jogo.md](../plano-do-jogo.md)
- [arquitetura.md](../arquitetura.md)
- [decisoes.md](../decisoes.md)

## Decisões em consulta

D02 trata de ninguém responder e D03 de ausência de alvo. O núcleo de erro/acerto é confirmado e pode avançar; resolver as duas políticas antes de considerar a final completa.

## Entregáveis

- [ ] Na fila da sala, aceitar a primeira resposta válida e fechar a pergunta antes de avaliar o gabarito.
- [ ] Em erro, retirar uma vida do autor; em acerto, autorizar somente esse ator a escolher outro participante com vida.
- [ ] Aplicar uma perda ao alvo, resolver eliminação e iniciar pergunta inédita ou declarar o último sobrevivente.
- [ ] Integrar prazos, fallback escolhido em D02/D03, autoridade de tempo, IDs de ação e projeções sem dados privados.

## Critérios de aceite

- [ ] Primeiro errado seguido de outro correto produz uma perda no primeiro e nenhuma avaliação da segunda tentativa.
- [ ] Duas respostas corretas concorrentes concedem um único direito de ataque.
- [ ] Uma pergunta respondida não acumula erro e ataque; reenvio não restaura vidas nem duplica dano.
- [ ] Alvo desconectado continua elegível se tiver vidas; eliminado ou autor do ataque não é alvo válido.
- [ ] O motor não concede vitória por placar ao atingir um limite arbitrário de perguntas.

## Verificação

- [ ] Integrar respostas concorrentes, resposta exatamente no prazo, pacote inválido e tentativa de espectador.
- [ ] Testar líder com quatro perdas e quinta eliminação, ataque repetido, alvo já eliminado e ausência de escolha conforme D03.

## Cuidados de implementação

Recepção e desempate técnico de concorrência pertencem ao servidor. Nunca aceitar timestamp do cliente como prova de ter respondido antes.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
