# Reconexão e ciclo de vida

A T26 aplica a política operacional do protótipo aos percursos já disponíveis: fases isoladas, final e pódio. D02/D03/D04/D05/D06 continuam com os limites das tarefas anteriores; reconectar não escolhe políticas de produto nem transforma o protótipo em sequência completa das cinco fases.

## Matriz por etapa

| Etapa | Retorno com a janela ainda aberta | Janela encerrada durante a ausência | Se a sala estiver sem conectados |
|---|---|---|---|
| Lobby | Mesma identidade, perfil, vaga e anfitrião, respeitando as carências | Ausente removido deve entrar novamente; o código pode já ter expirado | TTL de 120 s; não cria partida |
| Instruções | Conserva prontos e prazo; não reinicia preparação | Continua do passo seguinte, sem novo tempo para declarar prontidão | Ao vencer o prazo, aguarda retorno antes de oferecer tema ou abrir a final |
| Tema | Mesma pessoa escolhendo, opções e prazo | Escolha manual não volta a ser aceita; segue a escolha por timeout | Conserva o passo pendente e executa o fallback normal ao retomar, antes de preparar a pergunta |
| Leitura | Mesmo enunciado e `opensAt`, sem repetir os três segundos | Abre/resolve a janela dessa mesma pergunta com o prazo original | A pergunta já em curso chega à resolução; não inicia outra |
| Clássico/velocidade | Resposta recebida continua definitiva; bônus usa o recibo original | Ausência resolve pela regra normal; não refaz crédito | Aplica uma resolução e aguarda depois da revelação |
| Aposta | Escolha privada e prazo conservados; não devolve saldo nem permite trocar aposta | A janela fecha; quem não escolheu mantém a regra de aposta zero | Aguarda antes de mostrar o enunciado. Aposta já escolhida é conservada para a liquidação normal |
| Roubo | Respostas/direito de roubo, autor, alvos e prazo conservados | Sem escolha no prazo, encerra sem transferência, conforme o protótipo | Fecha as janelas da pergunta atual, inclusive alvo; depois aguarda |
| Dinamite | Mesmo dono, ciclo, pergunta e prazo individual | Erro/ausência aplica a penalidade normal uma vez | Resolve somente o turno atual; próximo turno recebe leitura e prazo completos quando a sala retoma |
| Final — instruções | Mesmas vidas iniciais e prontidão | Não reconverte placar nem restaura vidas | Aguarda antes da primeira pergunta |
| Final — pergunta | Mesma pergunta/prazo e uma única oportunidade global | Primeiro erro e ataque já confirmados não são desfeitos; sem resposta permanece D02 | A janela atual fecha normalmente. D02 não produz perda automática |
| Final — alvo | Apenas o autor do acerto conserva a escolha até o prazo original; alvo offline continua elegível | Ataque aplicado não é repetido; ausência de alvo permanece D03 | Não inventa alvo/dano nem retoma um direito vencido |
| Final — resolução | Vidas, histórico e eliminações conservados | Segue para a próxima pergunta ou para o sobrevivente confirmado | Com disputa ainda ativa, aguarda antes de outra pergunta; se o único sobrevivente já foi confirmado, pode apresentar o pódio |
| Pódio | Mesma ordem final e histórico; só anfitrião prepara revanche | Não recalcula campeão nem começa outra partida automaticamente | Conserva resultado até retorno ou expiração da sala |

A resolução pode ocorrer antes ou depois do envio local. O que decide é o comando validado e recebido pelo servidor. Se a confirmação não chegou, a web bloqueia outra tentativa e recupera a projeção: resposta recebida permanece consumida; resposta nunca recebida pode ser enviada somente enquanto a janela oficial ainda permitir. O transporte não repete mutações automaticamente.

## Sala vazia e retomada

Uma sala está vazia quando nenhum membro tem conexão ativa. Espectadores e eliminados contam como presença, sem ganhar permissão de responder ou atacar. A espera não é uma pausa manual e não congela o prazo de uma pergunta em curso.

O serviço deixa leitura, resposta e escolha de alvo da pergunta atual chegarem à resolução normal. Nas fronteiras de instrução, tema, aposta, revelação e resultado de fase, conserva o estado/prazo anterior e marca o agregado como suspenso. Cancela o timer de jogo nesse ponto. A projeção inclui `waitingForPlayers: true`, com aviso e controles bloqueados; não expõe a próxima pergunta nem sorteia conteúdo novo enquanto espera.

Ao retornar uma conexão autenticada, o serviço agenda o timer já vencido para executar somente o próximo passo pendente, pela mesma fila da sala. O estágio anterior não ganha prazo adicional. Uma pergunta nova recebe sua leitura e janela próprias, usando os IDs e o estado oficiais. Respostas, apostas, acertos, transferências, vidas e eliminações confirmados não são reaplicados. D02/D03 permanecem pausas explícitas de regras, mesmo depois de reconectar.

O TTL de sala vazia conta da **última desconexão**, não da resolução, da entrada em espera ou da troca de anfitrião. Antes de 120 s o estado pode ser retomado. No instante de 120 s ou depois, a sala expira, libera registro/código/associações e não inventa vencedor. Os valores continuam parâmetros experimentais injetáveis. Timers atrasados também reconferem o prazo absoluto na fila; uma conexão tardia não cancela uma expiração já devida.

## Anfitrião e identidade

O anfitrião que cai conserva o controle por até 30 s. O retorno antes desse instante cancela a transferência. No prazo, o controle passa ao jogador conectado mais antigo; retornar depois não toma o controle de volta. Sem jogador elegível conectado, a posição fica pendente para o primeiro jogador que retornar. Espectadores não assumem o anfitrião da partida. Saída voluntária mantém a transferência imediata existente.

`ActiveConnections` mantém um controlador por identidade. Outra aba com a mesma sessão substitui a conexão anterior e emite `session:ended`. A desconexão dessa aba antiga não derruba a nova. Cada comando reconfere identidade, conexão e permissão depois de aguardar a fila. Trocar de aba não muda o elenco nem restaura direitos já consumidos.

## Reconciliação da web

Em cada conexão, a web envia `room:sync` com payload vazio, além da sincronização de relógio. O servidor procura exclusivamente a associação da identidade autenticada, devolvendo `present` com sala/versão ou `absent`. Não aceita sala, nome ou ator fornecido pelo cliente para essa consulta.

Quando a associação existe, a reentrada publica uma fotografia atual com versão nova, papel, presença e permissões. Até recebê-la, a web mantém as ações bloqueadas. Quando não existe, descarta a fotografia antiga sem apagar perfil ou uma sessão ainda válida. A confirmação é vinculada à geração/época da conexão: uma consulta antiga não remove uma sala nova. Falha da consulta não autoriza usar a fotografia em cache.

As maiores versões recebidas ficam registradas por sala/identidade mesmo ao descartar a fotografia durante navegação. Views antigas ou repetidas não restauram perguntas ou placares. A T25 também descarta confirmações de ações após outra partida ou retorno ao lobby.

## Expiração e reinício

No lobby, uma queda ainda segue a remoção após a carência de 120 s; vagas da partida em curso permanecem reservadas até o ciclo previsto. A sala vazia expira após seu TTL e a idade máxima permanece em 12 horas. Fechar/reiniciar cancela timers e associações; callbacks antigos conferem sala, fase, revisão e token antes de agir.

Salas, partidas e sessões do servidor continuam somente em memória. Reinício não recupera uma partida, histórico, credencial ou sala anterior. A sessão antiga é recusada; a interface informa o encerramento e exige ativar outra sessão. O perfil salvo no navegador é independente e permanece disponível. Mesmo sem reinício, `room:sync` reconcilia uma sala expirada ou uma associação removida sem deixar controles antigos ativos.

## Verificação

Testes de serviço cobrem ausência em cada modalidade, fronteiras sem nova pergunta, retorno antes do fechamento da janela, aplicação única, retomada antes do TTL, D02/D03 e callbacks antigos. Testes de sala usam os valores de 30/120 segundos e relógio controlado, inclusive limites exatos e callbacks atrasados. A matriz Socket.IO percorre instrução, tema, leitura, resposta antes/depois do envio, aposta, roubo e dinamite em WebSocket e polling; testes de final/pódio complementam a matriz. Reinício é exercitado com outro aplicativo e recusa da credencial anterior.

Testes da web verificam ausência de sala, consultas atrasadas/falhas, versão antiga após navegação e bloqueio durante espera. O smoke de reconexão usa relógios reais, sala vazia, retorno, transferência do anfitrião, resposta consumida e segunda aba, em desktop/celular emulado. O percurso de final/revanche verifica recuperação da escolha e do pódio sem restaurar vidas. Resultados executados estão na [T26](tasks/T26-reconexao-e-ciclo-de-vida.md).
