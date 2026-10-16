# T35 — Publicação e validação final

- **Depende de:** [T32](./T32-testes-de-grupo-e-equilibrio.md), [T33](./T33-expansao-para-5000-perguntas.md), [T34](./T34-build-e-operacao-de-producao.md)
- **Pacotes:** infra, docs
- **Marco:** M6
- **Branch sugerido:** `task/35-publicacao-e-validacao-final`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Publicar a versão completa no destino definido e verificar o comportamento real entre clientes.

## Leia antes

- [planejamento.md](../planejamento.md)
- [arquitetura.md](../arquitetura.md)
- [decisoes.md](../decisoes.md)

## Decisões em consulta

D08 define destino, URL e acesso de hospedagem. Preparação de build e documentação avança em T34; qualquer publicação real exige destino e escopo concretos definidos.

## Entregáveis

- [ ] Aplicar a configuração do destino escolhido, HTTPS, proxy WebSocket e isolamento do Comicle.
- [ ] Publicar o artefato validado, conferir conteúdo de 5.000 e manter procedimento de retorno.
- [ ] Executar partida completa, reconexão e revanche no ambiente publicado a partir de redes/clientes distintos.
- [ ] Atualizar README com URL real, estado da versão e instruções verificadas; registrar evidências da publicação.

## Critérios de aceite

- [ ] URL pública real carrega o jogo e suporta sala compartilhada entre clientes externos.
- [ ] Versão publicada corresponde ao commit e ao catálogo validados; todas as decisões de regra necessárias estão consolidadas.
- [ ] Healthcheck, logs e procedimento de retorno funcionam sem expor credenciais.
- [ ] Não marcar publicação concluída por apenas gerar imagem, abrir PR ou escrever documentação.

## Verificação

- [ ] Validar o fluxo de seis fases, primeira resposta exclusiva, pódio, revanche e queda do anfitrião no destino real.
- [ ] Conferir em celular e computador e testar que o Comicle continua isolado no mesmo domínio, se compartilhado.

## Cuidados de implementação

Não presumir URL `/penshow/`, servidor EC2 ou serviço pago sem a escolha do destino. Se a meta de conteúdo ainda não foi atingida, apresentar somente piloto identificado, sem concluir esta tarefa.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
