# T10 — Catálogo privado e publicação editorial

- **Depende de:** [T02](./T02-contratos-e-documentacao.md)
- **Pacotes:** server, scripts, data
- **Marco:** M2
- **Branch sugerido:** `task/10-catalogo-e-publicacao-de-perguntas`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Separar candidatos importados das perguntas aprovadas carregadas pelo servidor.

## Leia antes

- [perguntas.md](../perguntas.md)
- [arquitetura.md](../arquitetura.md)

## Entregáveis

- [ ] Evoluir validadores existentes para revisão com referência, data, dificuldade, categoria e resposta única.
- [ ] Definir catálogo publicado em diretório separado e comando determinístico para gerá-lo de registros aprovados.
- [ ] Criar repositório de leitura do catálogo com interface pequena e implementação local.
- [ ] Manter procedência/licença por registro e relatórios de rejeições, duplicatas e disponibilidade por tema/dificuldade.

## Critérios de aceite

- [ ] Candidata, tradução incompleta, pergunta sem revisão e registro rejeitado nunca entram no catálogo publicado.
- [ ] Publicação falha visivelmente se o gabarito ou a procedência forem inválidos.
- [ ] Dados publicados para o servidor não entram em shared nem em `apps/web/public`.

## Verificação

- [ ] Testar promoção e recusa de registros, duas alternativas equivalentes e gabarito inexistente.
- [ ] Testar compilação repetida com saída estável e carregamento com erro de arquivo.

## Cuidados de implementação

Aproveitar `scripts/lib/questions.mjs` e os importadores atuais; não reescrevê-los sem motivo. Validação estrutural não aprova a verdade da resposta.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
