# T35 — Publicação e validação final

- **Depende de:** [T32](./T32-testes-de-grupo-e-equilibrio.md), [T33](./T33-expansao-para-5000-perguntas.md), [T34](./T34-build-e-operacao-de-producao.md), [T39](./T39-desempate-tiro-top-down.md)
- **Pacotes:** infra, docs
- **Marco:** M6
- **Branch sugerido:** `task/35-publicacao-e-validacao-final`

O status desta tarefa fica somente no [índice](README.md). A preparação local e a aplicação no destino real são evidências distintas; somente a segunda conclui publicação.

## Atualização — 26/10/2026

O usuário solicitou instalar o PENSHOW na VM existente do Comicle, substituindo a espera por uma VM nova. O piloto foi instalado via MCP AWS/SSM na instância `i-05748174e8c875a20`, `us-east-2`, tipo `c7i-flex.large`, e está acessível em [https://dionel.site/penshow/](https://dionel.site/penshow/). O [runtime compartilhado](../../infra/ec2/README.md) usa projeto Compose próprio, API isolada e partidas habilitadas explicitamente em produção. O app e banco do Comicle não foram reiniciados.

O catálogo tem 348 aprovadas, abaixo da meta de 5.000. Esta entrega é piloto e mantém abertos os critérios globais de conteúdo e validação humana. A [evidência técnica](../validation/t35-piloto-compartilhado.md) distingue execução local de publicação real.

O MCP oficial da AWS foi verificado operacionalmente: identidade, descoberta EC2 e execução SSM aprovadas. Os dois testes de publicação no destino real passaram em desktop e celular emulado, com cinco identidades, convite, início do clássico e reconexão. HTTPS, WebSocket, polling autenticado e privacidade também passaram. As duas rotas Cloudflare foram publicadas e os testes passaram também em `https://dionel.site/penshow/`; a partida completa com pessoas, revanche e os demais aceites globais permanecem pendentes.

## Objetivo

Publicar a versão completa no destino definido e verificar o comportamento real entre clientes.

## Leia antes

- [planejamento.md](../planejamento.md)
- [arquitetura.md](../arquitetura.md)
- [decisoes.md](../decisoes.md)

## Hospedagem e ordem de execução — 23/10/2026

Registro histórico: D08 inicialmente previa hospedar como o Comicle, em VM que o usuário ainda criaria, com publicação por último. Essa espera foi substituída pelo pedido de 26/10 acima. URL, acesso e configuração concreta devem ser conferidos; não presumir que os dados ou recursos da instalação do Comicle se aplicam ao PENSHOW. A preparação independente do artefato em T34 está preservada.

## Entregáveis

- [x] Aplicar a configuração do destino escolhido, HTTPS, proxy WebSocket e isolamento do Comicle.
- [ ] Publicar o artefato validado, conferir conteúdo de 5.000 e manter procedimento de retorno.
- [ ] Executar partida completa, reconexão e revanche no ambiente publicado a partir de redes/clientes distintos.
- [x] Atualizar README com URL real, estado da versão e instruções verificadas; registrar evidências da publicação.

## Critérios de aceite

- [x] URL pública real carrega o jogo e suporta sala compartilhada entre clientes externos.
- [ ] Versão publicada corresponde ao commit e ao catálogo validados; todas as decisões de regra necessárias estão consolidadas.
- [ ] Healthcheck, logs e procedimento de retorno funcionam sem expor credenciais.
- [ ] Não marcar publicação concluída por apenas gerar imagem, abrir PR ou escrever documentação.

## Verificação

- [ ] Validar o modo clássico padrão de cinco fases: quatro modalidades distintas sorteadas, final na quinta posição, primeira resposta exclusiva, pódio, revanche e queda do anfitrião no destino real.
- [ ] Conferir em celular e computador e testar que o Comicle continua isolado no mesmo domínio, se compartilhado.

## Cuidados de implementação

Não presumir URL `/penshow/`, servidor EC2 ou serviço pago sem a escolha do destino. Se a meta de conteúdo ainda não foi atingida, apresentar somente piloto identificado, sem concluir esta tarefa.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
