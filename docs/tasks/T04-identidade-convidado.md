# T04 — Identidade anônima e sessão

- **Depende de:** [T03](./T03-servidor-base.md)
- **Pacotes:** server, shared
- **Marco:** M1
- **Branch sugerido:** `task/04-identidade-convidado`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Permitir jogar sem cadastro mantendo uma identidade estável nas reconexões.

## Leia antes

- [analise-comicle.md](../analise-comicle.md)
- [arquitetura.md](../arquitetura.md)

## Entregáveis

- [ ] Adaptar `guest-identity` do Comicle: emissão de token opaco, armazenamento apenas do hash, expiração e verificação.
- [ ] Implementar rotas de criação/verificação e autenticação dos comandos de sala pelo token.
- [ ] Definir renovação e substituição de conexão sem usar nickname como autenticação.
- [ ] Documentar duração da sessão e comportamento após expiração ou reinício.

## Critérios de aceite

- [ ] Mesmo apelido não permite assumir a identidade de outra pessoa.
- [ ] Token inválido ou expirado não acessa salas autenticadas; logs não contêm token em claro.
- [ ] Identidade do PENSHOW e a do Comicle têm armazenamento e escopos separados.

## Verificação

- [ ] Testar criação, hash armazenado, validade, expiração e renovação.
- [ ] Testar autenticação HTTP/socket e rejeição de sessão alheia.

## Cuidados de implementação

Manter sessões em memória nesta versão. Não importar tabelas de histórias nem adicionar contas de usuário.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
