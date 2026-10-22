# T34 — Build, container e operação de produção

- **Depende de:** [T28](./T28-privacidade-limites-e-concorrencia.md), [T29](./T29-e2e-partida-completa.md)
- **Pacotes:** raiz, web, server, infra, docs
- **Marco:** M6
- **Branch sugerido:** `task/34-build-e-operacao-de-producao`

O status desta tarefa fica somente no [índice](README.md). A operação do artefato e seus limites estão em [deploy](../deploy.md). A infraestrutura não consolida as regras pendentes da T29/T36: partidas experimentais permanecem desativadas em produção; D08/T35 continuam responsáveis pelo destino e pela publicação real.

## Objetivo

Gerar uma aplicação reproduzível e pronta para hospedar, independente do destino escolhido.

## Leia antes

- [arquitetura.md](../arquitetura.md)
- [planejamento.md](../planejamento.md)
- [decisoes.md](../decisoes.md)

## Entregáveis

- [x] Preparar build de web/server, imagem de produção, configuração validada e exemplos sem credenciais.
- [x] Servir cliente e API/socket com base path próprio, cache apropriado e verificação de saúde.
- [x] Incluir no artefato do servidor somente catálogo aprovado e artes necessárias; preservar licenças.
- [x] Criar `docs/deploy.md` com execução local, variáveis, WebSocket, HTTPS, logs, reinício e retorno à versão anterior.

## Critérios de aceite

- [x] Checkout limpo instala com lockfile e produz artefato que inicia sem ferramentas de desenvolvimento.
- [x] Gabaritos e catálogo não são acessíveis em arquivos estáticos ou bundle do navegador.
- [x] Caminho e socket do PENSHOW não se confundem com `/comicle/`.
- [x] Reinício e falha de conteúdo apresentam o comportamento documentado, sem prometer recuperação inexistente.

## Verificação

- [x] Construir e executar a imagem, testar healthcheck, HTTP, socket e partida curta no artefato final.
- [x] Inspecionar bundle/rotas públicas, variáveis e conteúdo da imagem; testar encerramento e novo início.

## Cuidados de implementação

Não portar configurações da instalação EC2 do Comicle sem verificar pertinência. PostgreSQL só entra se um requisito real justificar mudar a decisão de estado em memória.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.

## Evidências — 22/10/2026

- Branch `task/34-build-e-operacao-de-producao`. Dockerfile com Node 24.18.0 fixado por digest, pnpm 12.9.1, instalação congelada, validação do catálogo/artes e deploy portátil das dependências de produção. O runtime inicia diretamente com Node e não recebe fontes/testes próprios, candidatos, lotes ou ferramentas de desenvolvimento da aplicação.
- `docker build --tag penshow:t34 .` executado com Docker Desktop/Linux. Imagem final validada: `sha256:f48b75e59da915fa5d7002c91cba9c10e04f75764b4ea69885963450902fff1c`. Inspeção confirmou UID 1000, 336 publicáveis privadas, 50 PNGs, licenças e ausência de enunciados do catálogo nos scripts públicos.
- `pnpm test:container penshow:t34` aprovado: HTML e rotas de recarga sob `/penshow/`, JS/CSS com hash/cache, 404 para arquivos privados, CORS, sessão HTTP, WebSocket e polling autenticados, healthcheck Docker, parada com código 0 e reinício sem recuperar sessões/salas. Configuração sem origens, base divergente e catálogo corrompido ou ausente encerram com código 1.
- A mesma imagem, com `NODE_ENV=test` explícito e porta somente em loopback, percorreu seis perguntas com duas identidades, pontuação conferida a partir das revelações e retorno ao lobby. Não há gabarito antecipado nem timing de teste adicionado ao produto. Em `production`, `match:start` continua recusado por `INVALID_PHASE`.
- A primeira tentativa de parada do container retornou 137. A investigação reproduziu separadamente um bloqueio com corpo HTTP incompleto: o teste falhava por timeout antes da correção. `forceCloseConnections` agora fecha HTTP ativo após o `preClose` drenar domínio/realtime; regressão unitária e smoke com `100 Continue` sem envio do corpo passaram. Logs identificam início/fim do encerramento, sem expor requisições.
- Compose validado com `config --quiet` e execução real no projeto isolado `penshow-t34-check`, usando a imagem construída: estado `healthy`, `/api/health` correto e remoção dos recursos de teste. Exemplo de Nginx/HTTPS é material de configuração; certificado, domínio e proxy no provedor real aguardam T35/D08.
- Qualidade local: formatação, lint, typecheck e build aprovados. Suítes aprovadas: 42 testes de conteúdo, cinco de artes, 186 de shared, 449 de server e 163 de web (845 ao todo); servidor reexecutado após a correção final. Playwright `classic-smoke.spec.ts`: dois percursos aprovados, desktop e celular, em 2,6 minutos.
- Job `container` adicionado à CI com build e smoke da imagem. A execução hospedada será conferida no PR; este registro distingue essa execução dos testes locais. Nenhum destino externo foi publicado e nenhum serviço de hospedagem foi contratado.
