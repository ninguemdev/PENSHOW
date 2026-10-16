# Referência do Brain Show

Pesquisa em 16/10/2026. Esta é uma análise das informações públicas, não uma inspeção do código ou uma sessão jogada. As regras numéricas do PENSHOW abaixo são propostas próprias.

## O que a fonte oficial confirma

A [página oficial na Steam](https://store.steampowered.com/app/2235150/) descreve um quiz de competição entre amigos: até oito participantes, mais de cinco mil perguntas em 41 categorias e 13 modalidades. Destaca seleção de temas, roubo de pontos, apostas e eliminações. Isso confirma a variedade da referência; não fornece um regulamento completo das 13 modalidades.

## O que depende de relatos de jogadores

Uma [análise de jogador na comunidade Steam](https://steamcommunity.com/app/2235150/reviews/?browsefilter=toprated) descreve cinco etapas antes da final, escolha de categoria entre alternativas, provas de velocidade, apostas, passagem de dinamite, provas com duas opções e fases de sobrevivência. Relata uma final com energia derivada da pontuação, ataques e oportunidades de recuperação. Esses detalhes são relato, podem variar por versão e não estabelecem fórmulas oficiais.

Outras [avaliações da comunidade](https://steamcommunity.com/app/2235150/reviews/?browsefilter=toprated) apontam problemas de temporização na dinamite, pouco peso do placar na final e baixa personalização das rodadas. São opiniões úteis para orientar testes de equilíbrio, não comprovação de um defeito universal.

Não foi encontrado regulamento oficial completo que permita afirmar nomes, ordem, limites e fórmulas de todas as 13 modalidades. Não presumir que o PENSHOW reproduz exatamente essas regras.

## Aplicação proposta ao PENSHOW

O fluxo inicial terá cinco fases de pontuação e uma final. O planejamento começa com cinco modalidades e deixa três alternativas para expansão. As fichas completas estão em [regras](regras.md).

| Modalidade proposta | Experiência pretendida | Principal cuidado |
|---|---|---|
| Quiz clássico | Todos respondem à mesma pergunta | Uma resposta por jogador, prazo igual |
| Velocidade | Bônus por acertar cedo | Conhecimento deve valer mais que alguns milissegundos de rede |
| Aposta | Escolher o risco antes de ver a pergunta | Limitar a aposta e impedir saldo negativo |
| Roubo de pontos | Escolher adversário após acertar | Não criar pontos ao transferir; não roubar além do saldo |
| Pressão / dinamite | Tensão de uma sequência de turnos | Cada jogador deve receber tempo real para responder |
| Final | Converter a colocação em vidas e disputar a vitória | Aplicação explícita de 4 / 3 / 2 / 1 vidas |

Alternativas futuras: duas opções, sequência de acertos e sobrevivência restrita à fase. O visual, os textos, os sons e o conteúdo do PENSHOW serão próprios ou reutilizados do Comicle conforme a licença; o banco de perguntas do Brain Show não foi obtido nem copiado.

## Critérios de equilíbrio

- Mostrar instruções curtas e um exemplo antes de cada modalidade.
- Mostrar claramente a vantagem em vidas antes da final.
- Evitar eliminação definitiva nas cinco fases iniciais, para todos continuarem jogando.
- Impedir que uma passagem de dinamite entregue ao próximo jogador um prazo já esgotado.
- Resolver empates antes da conversão em vidas, sem favorecer ordem de conexão.
- Testar final com dois, três, quatro e doze participantes, inclusive ataques concentrados.
- Separar fatos pesquisados, requisitos pedidos e propostas para discussão.
