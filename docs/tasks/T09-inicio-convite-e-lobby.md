# T09 — Início, convite e lobby

- **Depende de:** [T06](./T06-perfil-e-avatares.md), [T08](./T08-salas-realtime-e-projecao.md)
- **Pacotes:** web
- **Marco:** M1
- **Branch sugerido:** `task/09-inicio-convite-e-lobby`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Entregar o fluxo de formar um grupo com nome, personagem, código e convite.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [arquitetura.md](../arquitetura.md)

## Entregáveis

- [ ] Integrar sessão, perfil, criação e entrada por código/link com estados de carregamento e erro.
- [ ] Mostrar jogadores, avatares, anfitrião, presença, espectadores e configurações de quiz.
- [ ] Implementar cópia de convite com alternativa visível quando indisponível e normalização do código.
- [ ] Exibir resumo da final e preparar a ação de início, habilitada somente quando houver motor e conteúdo elegíveis.

## Critérios de aceite

- [ ] Criador e convidados chegam à mesma sala sem cadastro ou edição manual de URL.
- [ ] Não anfitrião não recebe controles administrativos; servidor também rejeita ações indevidas.
- [ ] A interface representa o papel de espectador quando recebido na view; a integração com chegada durante partida será concluída com o motor e a T16.
- [ ] Sala inexistente, cheia ou removida tem saída compreensível.

## Verificação

- [ ] Testar criação/entrada por navegação e stores; código inválido, perfil faltante e erro de rede.
- [ ] Validar em duas sessões e viewport móvel, incluindo convite sem acesso à área de transferência.

## Cuidados de implementação

Não simular partida concluída nem habilitar início sem dependências. Controles ainda indisponíveis devem indicar seu estado real.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
