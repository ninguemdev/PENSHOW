# Narrador robótico

O PENSHOW pode ler o enunciado em português brasileiro com voz propositalmente robótica. A voz usa eSpeak NG, síntese clássica por formantes, com variação de entonação zerada; não usa modelo neural, voz humana clonada, serviço remoto ou vozes do sistema operacional. O timbre é o mesmo no desktop e no celular. Somente o enunciado é narrado nesta entrega; alternativas e gabaritos não entram nas gravações.

## Ouvir e ativar

Na interface, clique em **Ativar narrador robótico** e depois em **Ouvir a voz do robô**. O controle tem volume próprio, independente dos efeitos de acerto/erro. Começa desligado para respeitar o gesto de ativação do navegador; `penshow.narrator` guarda apenas habilitação e volume. Após recarregar, a preferência é restaurada, mas a aba exige nova ativação de áudio. Preferência inválida ou falha de armazenamento tem fallback em memória e aviso textual.

Após `pnpm narrations:build`, a prévia WAV fica em `data/narration/generated/preview.wav`. O endpoint `/api/narration/preview` oferece a mesma amostra quando a narração está habilitada no servidor. A prévia usa texto de demonstração, sem conteúdo privado da partida. O teste de navegador também a anexa como `voz-robotica-pt-br.wav`.

## Leitura e resposta

O servidor mede a duração do PCM gerado para cada pergunta. As modalidades comuns e a final reservam o maior entre o tempo mínimo de leitura configurado e **duração da gravação + 1.500 ms**. Esse tempo vale para todos os participantes, inclusive quem desligou a voz ou está sem áudio. A aposta conserva sua escolha privada antes de revelar o enunciado.

Durante a leitura, as alternativas permanecem ocultas e comandos de resposta são recusados pelo servidor. Só depois da leitura abre a janela completa de resposta; a narração não consome esse prazo nem escolhe a prioridade da final. Callbacks de áudio não avançam fase, não concedem pontos e não removem vidas. As propostas D01–D06 permanecem pendentes.

O cliente usa o relógio sincronizado e agenda o áudio para terminar 300 ms antes de `opensAt`. A margem anterior permite buscar/decodificar a gravação. Entrada tardia ou reconexão durante a leitura continua no ponto correspondente do áudio, sem reiniciar a pergunta ou ganhar tempo. Mudança de etapa, aba oculta, desligamento e descarte cancelam fontes e downloads. Falha de áudio mantém o texto e o jogo utilizáveis; não há fila de gravações antigas para tocar depois. Uma rede lenta pode causar retomada no meio do enunciado ou impedir o áudio daquela pergunta.

## Preparação e runtime

```sh
pnpm narrations:build
pnpm dev
```

`pnpm dev`, `pnpm build` e `pnpm test` preparam as gravações automaticamente. `NARRATION_ENABLED=true` é o padrão em desenvolvimento/produção; em `NODE_ENV=test`, o padrão é `false`, mantendo os testes existentes com seus tempos privados. Os testes de narração habilitam a função explicitamente. `NARRATION_ENABLED=false` conserva o fluxo textual com o tempo mínimo anterior.

A ferramenta usa `@echogarden/espeak-ng-emscripten` 0.3.5 como dependência de desenvolvimento e gera WAV mono PCM16 de 22.050 Hz. O preset usa 165 palavras/minuto, pitch 35 e variação de entonação zero; os parâmetros efetivos são conferidos no sintetizador. O motor não integra o bundle ou o runtime do servidor. O manifesto privado registra identidade editorial, hash do texto, identidade da configuração, hash do arquivo e duração medida. O build reaproveita gravações intactas; pergunta corrigida ou configuração alterada produz outra gravação. As alternativas continuam embaralhadas apenas no seletor oficial.

Os arquivos ficam em `data/narration/generated`, fora do Git e da raiz estática. O Docker os gera no builder e copia somente as gravações/manifesto para o estágio final, junto das licenças. O servidor recusa startup com gravações ausentes, incompatíveis com o catálogo ou corrompidas; execute `pnpm narrations:build` após mudar a publicação. Não editar manifesto ou áudio manualmente. Conteúdo aprovado e regras editoriais permanecem intactos.

## Privacidade

`GET /api/rooms/:roomId/narration/:questionId` exige Bearer de uma sessão válida, associação à sala e correspondência com a pergunta atual durante leitura/resposta. Espectadores da sala podem ouvir. Não oferece índice de arquivos, IDs editoriais, respostas corretas ou áudio de perguntas futuras/encerradas. As rotas históricas sem `/api` existem para o proxy Vite; os limites HTTP são compartilhados entre aliases. Respostas usam `Cache-Control: no-store`.

O servidor valida o manifesto contra o catálogo publicado e confere integridade/duração dos arquivos ao iniciar. Diretórios privados de áudio são bloqueados também no `/@fs` do Vite. O cliente recebe somente voz/duração na etapa de leitura e busca o WAV pelo ID público da pergunta atual. Tokens seguem em cabeçalho, sem parâmetros de URL.

## Verificação

```sh
pnpm test
pnpm build
pnpm test:e2e:narrator
```

As suítes cobrem PCM real não silencioso, duração, bloqueio de respostas antes de abrir, janela integral comum/final, acesso por sessão/sala/etapa, preferências, repetição por presença, cancelamento e falhas. Playwright observa `AudioContext` e `AudioBufferSourceNode` nativos, incluindo PCM e reprodução reais, sem bypass de autoplay. O percurso usa servidor, HTTP, socket, catálogo e motor oficiais, com uma segunda identidade sem narração, recarga e resposta depois da leitura em desktop/celular. O job `sound` inclui esses testes e preserva os WAVs nos artefatos.

Os testes medem e executam áudio; não equivalem a julgamento humano do timbre, inteligibilidade ou conforto. A prévia permite essa avaliação. Safari/iOS, leitores de tela e hardware físico continuam precisando de revisão humana, assim como os demais sons.

Procedência e licenças: [avisos de terceiros](../THIRD_PARTY_NOTICES.md). Referências: [eSpeak NG em português](https://github.com/espeak-ng/espeak-ng/blob/master/docs/languages/roa/pt.md), [configuração de voz e entonação](https://github.com/espeak-ng/espeak-ng/blob/master/docs/voices.md), [compilação Echogarden](https://github.com/echogarden-project/espeak-ng-emscripten).
