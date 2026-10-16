# T18 — Modalidade de velocidade

- **Depende de:** [T17](./T17-primeiro-marco-jogavel.md)
- **Pacotes:** server, web, shared
- **Marco:** M3
- **Branch sugerido:** `task/18-fase-velocidade`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Adicionar o bônus por faixas de tempo com cálculo oficial no servidor e explicação na interface.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [regras.md](../regras.md)

## Entregáveis

- [ ] Implementar estratégia de seis perguntas com +100 de base e bônus propostos de +50 / +25 / 0.
- [ ] Usar recepção no servidor, intervalos [0,5), [5,10), [10,15) e rejeição no prazo final.
- [ ] Criar instrução e revelação do bônus por faixa, reutilizando a tela comum de pergunta.
- [ ] Registrar a estratégia no motor e ampliar contratos, CI e testes da modalidade.

## Critérios de aceite

- [ ] Erro rápido continua valendo zero; ninguém ganha bônus por somente clicar primeiro.
- [ ] Valores de regra não são duplicados no cliente; a tela explica base, bônus e total.
- [ ] Relógio adulterado no cliente não altera o resultado; ajuste de exibição não modifica o prazo.

## Verificação

- [ ] Testar 4,999 s, 5 s, 9,999 s, 10 s e prazo de 15 s com relógio controlado.
- [ ] Validar dois jogadores com a mesma faixa, erro em 2 s e reconexão após resposta.

## Cuidados de implementação

Usar os padrões propostos como parâmetros e incorporar D01 quando resolvida. Se o lote inicial não cobrir uma partida longa, testar a estratégia com fixtures isoladas; T27 habilita o conteúdo amplo.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
