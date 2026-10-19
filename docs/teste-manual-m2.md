# Roteiro de inspeção — quiz clássico de teste

Escopo: protótipo de uma fase/seis perguntas, disponível em desenvolvimento/teste. Usar apenas perguntas publicadas; uma importação candidata não habilita conteúdo. As etapas podem ser seguidas com duas pessoas ou com duas janelas isoladas; uma aba comum compartilha a identidade e serve para testar substituição, não para criar o segundo jogador.

## Preparação

1. Executar `pnpm install --frozen-lockfile`, `pnpm questions:check` e `pnpm dev`.
2. Abrir `http://127.0.0.1:5173` em dois perfis/contextos de navegador independentes, sem dados anteriores. Testar desktop por teclado e celular em orientação vertical. Para reproduzir a execução automatizada, usar os comandos de [smoke-m2.md](smoke-m2.md).
3. Conservar as telas lado a lado para conferir progresso, pontos e respostas. Não usar ferramentas de desenvolvimento para inserir uma view ou alterar placar.

## Percurso e resultados esperados

| ID | Ação | Resultado esperado |
|---|---|---|
| M01 | Preparar nome e personagem na primeira janela | Salvar retorna ao início; nenhuma sessão é criada só por visitar a página |
| M02 | Criar sala com duas vagas | Aparece um jogador e código/link; iniciar fica indisponível enquanto falta o segundo |
| M03 | Copiar convite e abrir na segunda janela | Link contém só código público; cópia funciona ou mantém campo/instrução manual |
| M04 | Preparar o segundo perfil pelo convite e entrar | Duas pessoas, dois IDs, mesmo código; convidado não tem controles de anfitrião |
| M05 | Editar nome e personagem do anfitrião e aplicar ao lobby | Ambas as telas recebem o novo perfil sem criar outro jogador |
| M06 | Abrir diálogo de saída e pressionar Escape | Foco começa em continuar; cancelamento não remove jogador e restaura o acionador |
| M07 | Recarregar o anfitrião | Mesmo perfil, identidade, sala e quantidade de jogadores |
| M08 | Abrir o convite em outra aba do segundo contexto | A aba antiga informa substituição; a nova recupera a vaga, sem terceiro jogador |
| M09 | Iniciar, confirmar pronto e escolher tema | Anúncio de quiz de teste, uma fase/seis perguntas; só o responsável escolhe o tema |
| M10 | Acompanhar leitura e depois responder nas duas telas | Alternativas só aparecem na abertura; Enter/toque envia imediatamente uma escolha definitiva |
| M11 | Enviar duas respostas quase simultâneas | Só uma resposta por jogador; gabarito/pontos aparecem depois do fechamento |
| M12 | Recarregar após responder, enquanto o outro ainda não respondeu | Escolha confirmada continua bloqueada; mesma pergunta e prazo, sem nova tentativa |
| M13 | Deixar uma resposta ausente e aguardar o estado mudar | Cronômetro chega a zero; ausência não pontua; próxima etapa vem do servidor |
| M14 | Conferir acerto, erro, explicação e variação | +100 por acerto, zero por erro/ausência; saldos/acertos coincidem entre as telas |
| M15 | Atravessar seis perguntas e resultado | Nenhuma repetição, três fáceis/três médias, conclusão explícita do protótipo sem vidas/final |
| M16 | Retornar ao lobby como anfitrião | As duas telas voltam ao mesmo lobby e conservam os dois jogadores |
| M17 | Inspecionar o celular | Opções empilhadas, toque confortável, nome/enunciado legíveis e página sem rolagem horizontal; placar pode rolar em sua própria região |

## Registro da T17

Ambientes de execução: Chromium/Playwright no Windows, desktop **1280×900** e celular emulado **360×780** com toque, contextos isolados e aplicação real. A reprodução do roteiro é assistida por automação; as capturas do resultado são inspecionadas visualmente. Isso não representa teste em aparelho físico nem aprovação final de acessibilidade/visual.

O smoke exercita M01–M17 e confere mensagens públicas por polling/WebSocket. As perguntas são selecionadas do catálogo local aprovado, sem resposta simulada. A sequência de respostas dos testes tem resultado esperado **500/200 pontos** e **5/2 acertos**. Resultados e evidências da execução estão na [T17](tasks/T17-primeiro-marco-jogavel.md) e no relatório local do Playwright.

## Falhas e acompanhamento

Para uma falha funcional nova, registrar ambiente/viewport, ID acima, ação, resultado observado, resultado esperado e captura/trace. Conferir se a mesma situação ocorre com outra pergunta e se a identidade/sala estão preservadas; não repetir mutações automaticamente para tentar ocultar o problema.

| Ocorrência de implementação | Observado | Resultado esperado / encaminhamento |
|---|---|---|
| Tipagem do teardown do Vite | O tipo de servidor também admite HTTP/2 e não garante `closeAllConnections` | Guardar a chamada pela existência do método; correção aplicada e tipagem aprovada |
| Espera da leitura em duas telas | Esperar a abertura da primeira antes de conferir a leitura da segunda pode perder a janela de três segundos | Conferir a leitura das duas antes de aguardar abertura; percurso corrigido sem sleeps |

Essas ocorrências pertencem ao harness e foram corrigidas antes da execução final. Em 19/10/2026, os dois projetos passaram sem retry, com **500/200** nas duas telas, retorno ao lobby e auditoria pública aprovada. As capturas desktop/móvel da conclusão foram inspecionadas: conteúdo legível, placar correto e ausência de transbordamento da página. Nenhuma falha funcional nova foi reproduzida na matriz final. Refinamento visual, testes físicos de celular e bateria ampla de acessibilidade continuam na T30; grupos maiores e equilíbrio, na T32.
