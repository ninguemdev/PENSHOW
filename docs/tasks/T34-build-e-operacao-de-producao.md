# T34 — Build, container e operação de produção

- **Depende de:** [T28](./T28-privacidade-limites-e-concorrencia.md), [T29](./T29-e2e-partida-completa.md)
- **Pacotes:** raiz, web, server, infra, docs
- **Marco:** M6
- **Branch sugerido:** `task/34-build-e-operacao-de-producao`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Gerar uma aplicação reproduzível e pronta para hospedar, independente do destino escolhido.

## Leia antes

- [arquitetura.md](../arquitetura.md)
- [planejamento.md](../planejamento.md)
- [decisoes.md](../decisoes.md)

## Entregáveis

- [ ] Preparar build de web/server, imagem de produção, configuração validada e exemplos sem credenciais.
- [ ] Servir cliente e API/socket com base path próprio, cache apropriado e verificação de saúde.
- [ ] Incluir no artefato do servidor somente catálogo aprovado e artes necessárias; preservar licenças.
- [ ] Criar `docs/deploy.md` com execução local, variáveis, WebSocket, HTTPS, logs, reinício e retorno à versão anterior.

## Critérios de aceite

- [ ] Checkout limpo instala com lockfile e produz artefato que inicia sem ferramentas de desenvolvimento.
- [ ] Gabaritos e catálogo não são acessíveis em arquivos estáticos ou bundle do navegador.
- [ ] Caminho e socket do PENSHOW não se confundem com `/comicle/`.
- [ ] Reinício e falha de conteúdo apresentam o comportamento documentado, sem prometer recuperação inexistente.

## Verificação

- [ ] Construir e executar a imagem, testar healthcheck, HTTP, socket e partida curta no artefato final.
- [ ] Inspecionar bundle/rotas públicas, variáveis e conteúdo da imagem; testar encerramento e novo início.

## Cuidados de implementação

Não portar configurações da instalação EC2 do Comicle sem verificar pertinência. PostgreSQL só entra se um requisito real justificar mudar a decisão de estado em memória.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
