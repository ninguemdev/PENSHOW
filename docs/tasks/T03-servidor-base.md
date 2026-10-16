# T03 — Servidor e infraestrutura de tempo real

- **Depende de:** [T02](./T02-contratos-e-documentacao.md)
- **Pacotes:** server
- **Marco:** M1
- **Branch sugerido:** `task/03-servidor-base`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Preparar Fastify, Socket.IO e dependências injetáveis para receber comandos de jogo com previsibilidade.

## Leia antes

- [arquitetura.md](../arquitetura.md)
- [analise-comicle.md](../analise-comicle.md)

## Entregáveis

- [ ] Compor `buildApp(deps)` e inicialização separada em `main.ts`; validar configuração e expor healthcheck.
- [ ] Criar portas pequenas para relógio, agendador, IDs e sorteio, com implementações de produção e suportes determinísticos de teste.
- [ ] Configurar transporte, origem permitida, limites básicos de payload, erros públicos e logs sem tokens ou respostas.
- [ ] Definir registro de handlers finos: validar entrada, identificar ator e delegar ao serviço; preparar encerramento com limpeza de recursos.

## Critérios de aceite

- [ ] Testes podem iniciar e fechar o servidor sem abrir portas fixas nem esperar timers reais.
- [ ] Domínio não usa relógio ou aleatoriedade globais; falha de comando não expõe stack trace ao cliente.
- [ ] Timers e conexões são limpos ao encerrar a aplicação; configuração inválida falha com mensagem compreensível.

## Verificação

- [ ] Testar healthcheck, erro inesperado sanitizado, configuração inválida e encerramento.
- [ ] Verificar agendamento, cancelamento e execução com relógio controlado.

## Cuidados de implementação

A composição conhece as implementações; os módulos de regra dependem das portas. Rate limits específicos serão ampliados na T28.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
