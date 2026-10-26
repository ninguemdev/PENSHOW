# Cabelo do PENSHOW

- Arquivo: `apps/web/public/avatars/hair/hair-tousled.png`.
- Adicionado em 26/10/2026 para o editor da T40; distribuído sob a licença MIT do PENSHOW.
- Criado com a ferramenta integrada `image_gen`, usando cabeça redonda e boné do catálogo Comicle como referências de estilo e enquadramento. Não substitui nenhuma arte migrada.
- Preparação técnica: redimensionamento para 1024 × 1024 e conversão para PNG indexado com 64 cores e transparência, dentro do limite de 100 KB do catálogo. Sem dependência nova em runtime.
- SHA-256: `5029611b87f11a361bd60c568aa528fa1f69340406797595b6919eaaca778377`.

Prompt enviado à ferramenta integrada:

> Create a new standalone HAIR layer PNG asset for the PENSHOW avatar editor, matching these style references, not editing them. Output 1024x1024 RGBA on a fully transparent background. Only short tousled dark brown hair with a few tufts and a side-swept fringe; no face, head, skin, eyes, mouth, hat, text or shadows. Match the bold rough black scribbled outlines and colored-pencil fill of the supplied references. Essential registration: existing head occupies x=160..860 y=240..900 on a 1024 square; hair should occupy approximately x=180..840 y=150..420, hugging the upper arc of that head, with transparent empty area below the fringe and around it. Broad readable silhouette, limited flat brown palette, lightly sketched highlights. Keep entire hair inside canvas. This is a separate overlay for the head; do not draw or include the yellow head. Save generated image as a local PNG and return its path if available.
