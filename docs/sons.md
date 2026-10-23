# Sons e preferências do jogador

O [narrador robótico](narrador-robotico.md) acrescenta leitura de enunciados com volume/ativação próprios. As regras de gravação, privacidade e sincronização dessa voz estão no guia específico; os seis efeitos abaixo continuam independentes.

A T31 acrescenta seis avisos sintetizados no próprio navegador. A abordagem vem do [áudio do Comicle no commit analisado](https://github.com/ninguemdev/Comicle/tree/4521f34df78da7de54a30715d50e748c50aa0696/apps/web/src/features/sound): catálogo declarativo, motor Web Audio, preferências separadas e efeitos derivados da visão. A implementação e as composições são próprias do PENSHOW; nenhum arquivo de áudio ou código do Comicle foi copiado nesta tarefa.

## Controles e persistência

O jogo começa com som desligado e volume de 40%. O botão **Ativar som** cria ou retoma o contexto dentro do gesto do jogador. A preferência salva não autoriza autoplay ao recarregar: a nova aba oferece ativação, preservando volume e silêncio. **Testar som** reproduz o aviso de início; **Silenciar som** interrompe também notas que ainda começariam. É possível silenciar durante a ativação ou após falha de áudio.

O controle de volume vai de 0 a 100%, sem alterar o silêncio escolhido. Volume zero interrompe fontes; voltar a aumentá-lo não reproduz avisos passados. Os controles usam botões nativos, nomes acessíveis e slider operável por teclado. Erro de áudio aparece como status textual e permite continuar jogando ou tentar outra vez.

`penshow.sound` armazena somente `{ version: 1, volume: number, muted: boolean }`, com volume de 0 a 1. JSON inválido, versão/formato desconhecido e números fora do intervalo recuperam o padrão silencioso. Getter de localStorage bloqueado, falha de leitura e quota de gravação mantêm a escolha em memória nesta aba e exibem aviso próprio. Não há sincronização de preferências entre abas.

## Quando cada aviso toca

| Aviso | Transição confirmada |
|---|---|
| Início | Instruções de uma nova fase, incluindo a entrada na final |
| Acerto | Resultado correto do próprio jogador; na final, confirmação de que ele acertou e escolhe alvo |
| Erro | Resultado sem acerto do próprio jogador, incluindo ausência de resposta nas fases comuns |
| Explosão | Resultado `exploded` da dinamite experimental, para todos os participantes/observadores com som ativado |
| Dano | Resolução com perda de vida na final, sem sobrepor outro aviso de erro |
| Vitória | Pódio confirmado, para o grupo; o vencedor continua identificado por texto |

No roubo, o crédito antecede a escolha de alvo. O comparador conserva o contador de acertos do início da pergunta, evitando interpretar esse crédito antecipado como erro na revelação. Isso funciona mesmo com crédito configurado em zero. Não há antecipação de resultado por clique ou ack, nem acesso a respostas privadas alheias. A dinamite apenas acompanha a variante já publicada pela view; D04 continua em consulta.

O controlador observa stores de sala/sessão fora dos componentes de fase. O tracker mantém identidade de sala/jogador/partida, versão, época da conexão e chaves de fase/pergunta consumidas. A primeira fotografia e a primeira visão de uma conexão nova são referência silenciosa. Reenvio, presença, remontagem React e reconexão não repetem a mesma explosão ou vitória. Nova partida recebe chaves novas.

Com áudio desligado, indisponível ou ainda bloqueado, os avisos são consumidos sem fila. Aba oculta e conexão não sincronizada interrompem o áudio e consomem os estados recebidos sem reproduzi-los ao voltar. O motor também exige um contexto em execução; suspensão pelo navegador oferece nova ativação quando um aviso não puder tocar.

## Motor e duração

`sound-catalog.ts` contém as frequências, ondas, ganhos e durações. `sound-engine.ts` cria osciladores e envelopes com ataque/fade curtos e limita o ganho principal a `0,5 × volume²`. Uma nova composição substitui as fontes da anterior; não há som contínuo ou tique por segundo. O maior aviso termina em até 0,675 s, incluindo a cauda de parada. O áudio não usa callbacks para pontuação, timers ou mudança de etapa.

Os únicos recursos do motor dos seis avisos são os nós Web Audio locais. Esses efeitos não baixam MP3/WAV nem dependem de voz remota ou serviço externo. `AudioContext` é criado/retomado no gesto explícito, conforme as [boas práticas do Web Audio](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices). Falhas de criação, resume e descarte ficam no serviço e não interrompem a partida.

## Verificação e prévia

```sh
pnpm build
pnpm test:e2e:sound
```

O teste de fluxo usa web compilada, servidor, HTTP e Socket.IO reais, com perfil privado de quantidade/timing. Instrumenta o Web Audio nativo para contar fontes; não substitui playback nem ignora políticas de autoplay. Percorre as modalidades, força o fechamento real de um transporte, confere a conexão nova sem repetir explosão e recarrega o pódio sem repetir vitória. Outro percurso verifica resposta e prazo sem Web Audio. A auditoria de rede recusa chamadas externas.

O teste de renderização compila o mesmo motor em memória e usa o grafo nativo de um `OfflineAudioContext` para produzir os seis sinais. Mede pico, RMS e término, verifica silêncio, curva de volume e substituição sem sobreposição. A adaptação do contexto offline serve somente ao processamento; a ativação é verificada separadamente no fluxo com `AudioContext` real.

Os artefatos em `e2e/test-results/sound-render-*/` incluem `penshow-sons-inicio-acerto-erro-explosao-dano-vitoria.wav`, prévia mono PCM de 44,1 kHz com os seis avisos nessa ordem e pausas entre eles. `medidas-audio.json` acompanha o relatório Playwright. O job `sound` da CI publica esses relatórios e a prévia no artefato `sons`, sem duplicar os testes históricos.

A prévia e as medições não substituem escuta humana. A revisão de intensidade percebida, timbre e conforto no fluxo, com alto-falante e fones, continua pendente; não foi registrada como realizada. Safari/iOS e hardware físico também precisam dessa conferência. A tarefa permanece aberta nesse item de aceite.

## Evidências

- Suíte geral: 817 testes aprovados (34 conteúdo, 5 artes, 186 shared, 429 server e 163 web), incluindo 19 casos novos de som.
- Dez cenários de navegador aprovados em 4,3 minutos, sem retry: seis de som e quatro de regressão de acessibilidade, em desktop/celular. Incluem as seis composições no motor real, gesto explícito, silêncio, volume, queda real do transporte, primeira fotografia do reconnect, recarga no pódio e áudio indisponível. Nenhuma violação detectada nas varreduras axe executadas.
- Prévia WAV de 6,3 segundos gerada em ambos os projetos; pico PCM de 0,1111 em escala de −1 a 1, sem saturação. Os testes confirmam cauda silenciosa, término de cada aviso antes de 0,7 s, RMS a 40% igual a 0,16 do RMS a 100% e substituição do aviso de vitória pelo de erro sem som residual da vitória. Não equivalem a escuta humana.
- Problema encontrado no percurso real: o crédito antecipado do roubo fazia a revelação tocar erro mesmo após acerto. Corrigido comparando o contador do início da pergunta; regressões de crédito de 100 e zero aprovadas e partida real reexecutada nos dois projetos.
- Formatação, lint, tipos e build aprovados. A captura de lobby a 320 px com texto a 200% foi inspecionada com os novos controles; nomes, botões e slider permanecem disponíveis sem rolagem horizontal. A CI hospedada não foi executada nesta tarefa.
