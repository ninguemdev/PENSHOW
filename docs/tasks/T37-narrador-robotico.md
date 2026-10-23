# T37 — Narrador robótico antes das respostas

- **Depende de:** base de perguntas e final de T16/T24; integração de som de T31
- **Pacotes:** server, web, shared, scripts, e2e, infra, docs
- **Marco:** M5
- **Branch:** `feat/narrador-robotico`

Solicitada em 23/10/2026: narrar perguntas antes de responder, com voz totalmente robotizada. A primeira versão narra somente o enunciado, conforme hipótese comunicada durante o trabalho. O status fica no [índice](README.md); operação e limites em [narrador robótico](../narrador-robotico.md).

## Entregáveis e aceite

- [x] Voz clássica e propositalmente robótica em pt-BR, sem modelo neural, voz humana clonada ou dependência de voz instalada no aparelho.
- [x] Preparar gravações dos enunciados aprovados e prévia audível, mantendo gabaritos, alternativas e arquivos editoriais privados.
- [x] Reservar no servidor a duração medida antes de abrir respostas, em todas as modalidades e na final; manter a janela de resposta completa e a primeira resposta exclusiva.
- [x] Ativação por gesto, volume próprio, preferência local, falha de áudio sem impedir jogo e cancelamento de narrações antigas.
- [x] Rota autenticada limitada à pergunta atual da sala, sem URLs com credenciais ou acesso ao catálogo inteiro.
- [x] Integrar geração ao desenvolvimento/build, imagem Docker e testes/CI; preservar procedência e licenças.
- [x] Testar áudio real, fluxo de duas identidades, recarga, desktop/celular e regressão dos efeitos existentes.

## Evidências

- Motor eSpeak NG via ferramenta `@echogarden/espeak-ng-emscripten` 0.3.5 em dependência de desenvolvimento. Entonação zerada, pitch fixo e 336 enunciados preparados em PCM16/22.050 Hz. O motor não entra no bundle web ou nas dependências de execução; gravações e manifesto permanecem privados.
- Server usa duração da gravação + 1.500 ms (ou mínimo anterior, se maior); recusa respostas durante leitura e só inicia então o prazo integral. Os testes comuns e da final verificam esse comportamento, sem callbacks de áudio alterando regras.
- Testes de rede autenticam sessão/membro, recusam ouvinte externo e gravação de etapa encerrada; publicação da view conserva somente o enunciado e metadados de duração/voz antes de abrir alternativas. O manifesto é conferido por texto, bytes, duração e integridade no startup.
- Playwright dedicado: dois testes aprovados em desktop/celular; PCM não silencioso, `AudioBufferSourceNode` e `AudioContext` nativos, amostra WAV anexada, presença/recarga sem duplicar leitura e resposta após abertura. Suíte de som completa com os novos casos: oito testes aprovados em 2,4 minutos, sem retry, incluindo funcionamento sem Web Audio e percurso até o pódio.
- Validação local: formatação, lint, tipos e build aprovados. Suítes: 43 conteúdo, cinco artes, 186 shared, 455 server e 168 web (857 ao todo), com a suíte do servidor reexecutada incluindo o último teste de integridade. Regressão final de acessibilidade + narrador: seis testes aprovados em 3,5 minutos, sem retry.
- A conferência final da API nativa detectou a escala inteira dos parâmetros; preset corrigido para 165 palavras/minuto, pitch 35 e variação zero, com leitura dos parâmetros efetivos para impedir arredondamento silencioso. Após o ajuste, geração, PCM real, integridade, rota autenticada e dois percursos de navegador passaram novamente (25,5 s no Playwright).
- Imagem final `penshow:narrator` construída e `pnpm test:container penshow:narrator` aprovado com narração habilitada: inspeção do runtime sem sintetizador, enunciados atuais autenticados em WAV, duração conferida, seis perguntas, pontuação real, retorno ao lobby, privacidade, falhas de startup e parada/reinício. Áudios privados preparados no builder; nenhum deploy externo.
- A escuta humana da prévia e avaliação de inteligibilidade/conforto continuam disponíveis ao usuário; os testes não foram apresentados como audição humana. Regras D01–D08, T35 e meta editorial permanecem independentes.
