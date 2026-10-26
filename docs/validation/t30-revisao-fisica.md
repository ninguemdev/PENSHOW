# T30 — Registro da revisão em aparelho físico

**Estado: não executada.** Não foi identificado aparelho conectado no ambiente de desenvolvimento. O equipamento e as observações precisam ser informados antes de preencher resultados. Emulação, árvore acessível e axe permanecem evidências separadas.

## Identificação da sessão

| Campo | Registro |
|---|---|
| Data e versão do aplicativo | Pendente |
| Aparelho e sistema operacional | Pendente |
| Navegador e versão | Pendente |
| Leitor de tela e versão | TalkBack/VoiceOver/NVDA/outro, a informar |
| Origem local usada para abrir o aplicativo | Pendente |
| Orientação e escala/zoom nativo | Pendente |

Usar a instância de desenvolvimento e duas identidades de jogador, no computador e no telefone ou em dois aparelhos. O teste local não requer publicação na VM. A origem acessada precisa estar permitida na configuração do servidor; não desativar a validação de origem para o teste. Não registrar tokens, IDs do aparelho ou dados pessoais.

## Roteiro e resultado observado

Em cada linha, registrar **passou**, **falhou** ou **não testado**, com uma observação concreta. Ausência de problema na automação não preenche esta tabela.

| Etapa | Como verificar no aparelho | Resultado/observação |
|---|---|---|
| Perfil com teclado virtual | Digitar nome, trocar peças, abrir/fechar teclado e salvar; conferir campo, ação e mensagens visíveis | Pendente |
| Convite e lobby | Abrir convite, entrar, ler nomes longos, copiar link e ajustar preferências sem encobrir ações | Pendente |
| Retrato/paisagem e recorte | Girar o aparelho em lobby, pergunta, alvo e combate; conferir margens do recorte, barras do sistema e controles de toque | Pendente |
| Zoom nativo | Ampliar pelo navegador, sem alterar CSS; conferir leitura, ações, cronômetro e rolagem. Anotar escala e forma de ampliação disponíveis | Pendente |
| Leitor de tela | Percorrer títulos, campos, alternativas, confirmação e placar; conferir nomes, seleção definitiva e anúncio de mudança sem repetir a contagem a cada segundo | Pendente |
| Roubo | Somente o autor escolhe alvo; confirmar saldo, transferência efetiva e ausência de escolha sem transferência | Pendente |
| Final | Escolher alvo, acompanhar perda de vida e eliminação; conferir a informação com som desligado | Pendente |
| Combate por toque | Mover e mirar com dois dedos simultâneos; soltar/cancelar cada toque, girar e voltar de outra aba; controles não devem ficar presos | Pendente |
| Pergunta de sobrevivência | Chegar a zero, ler a pergunta com o leitor de tela, responder e conferir recuperação de uma vida ou eliminação | Pendente |
| Teclado e foco | Se houver teclado disponível, mover/mirar/disparar com foco na arena; sair por Tab ou abrir diálogo deve cessar os controles. Links e atalhos do navegador continuam operáveis | Pendente |
| Retorno e pódio | Minimizar/retomar ou reconectar, conferir estado oficial, campeão e revanche sem duplicar resposta, dano ou resultado | Pendente |

O placar pode ter rolagem horizontal dentro de seu próprio contêiner. A página e os controles principais não devem exigir deslocamento lateral para serem usados.

## Fechamento

Registrar problemas com etapa, comportamento esperado, comportamento observado e aparelho/navegador. Depois de uma correção, repetir a etapa afetada e a sequência necessária para alcançá-la. T30 só recebe aceite físico após esta revisão; itens não testados permanecem identificados. Conforto sonoro pertence à T31 e equilíbrio/duração com grupos à T32.
