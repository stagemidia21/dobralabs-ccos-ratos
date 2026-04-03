---
name: roteiro-post
description: >
  Transforma notícia, post viral de concorrente, link ou ideia em conteúdo pronto
  para feed do Instagram, thread (X ou LinkedIn) ou legenda. Calibra o tom ao
  posicionamento do O REII / @homero.ads ou Stage Mídia.
  Use quando o usuário pedir "faz um post", "transforma isso num feed",
  "escreve uma thread", "cria uma legenda sobre isso", ou mandar um link pra virar conteúdo.
---

# /roteiro-post — Post e Thread

## Dependências

- **Contexto do negócio:** `_contexto/empresa.md`
- **Tom de voz:** `_contexto/preferencias.md`

---

## Posicionamento do O REII / @homero.ads

Autoridade em tráfego pago, funis e IA aplicada a marketing. Tom técnico, direto e com opinião. Fala pra gestores de tráfego, donos de agência e empreendedores que já estão no jogo — não pra iniciantes. Não explica o óbvio. Não motiva. Provoca, questiona ou entrega insight real.

---

## Workflow

### Passo 1 — Entender o pedido

Identificar:
1. **O conteúdo fonte:** link de notícia, post viral, texto ou assunto livre
2. **O formato de saída:** feed (post Instagram/LinkedIn), thread (X ou LinkedIn)
3. **A conta:** O REII / @homero.ads ou Stage Mídia (perguntar se não estiver claro)

Se for um link, usar WebFetch pra buscar o conteúdo.

### Passo 2 — Escrever o conteúdo

**Feed (Instagram/LinkedIn):**
- Hook nas primeiras 2 linhas — tem que parar o scroll sem ser clickbait
- Desenvolvimento em parágrafos curtos com progressão lógica
- Opinião ou insight concreto — nunca só parafrasear a notícia
- CTA no final (pergunta, salvar, seguir)
- 5-8 hashtags relevantes ao nicho (tráfego pago, marketing digital, IA)

**Thread (X ou LinkedIn):**
- Post 1: hook que para o scroll — afirmação forte ou dado surpreendente
- Posts 2-7: um ponto por post, progressão lógica, cada um funciona sozinho
- Post final: conclusão + CTA (seguir, comentar, ou link)

**Regras de tom:**
- Técnico e direto — sem enrolação
- Com opinião clara — não "depende", não "pode ser que"
- Nunca: "ei pessoal", "não esquece de dar like", "comenta aqui embaixo", palavrões motivacionais
- Nunca genérico — se alguém sem contexto pudesse ter escrito, reescrever
- Português BR correto, sem erros de acentuação

### Passo 3 — Salvar

Salvar em `conteudo/roteiros/roteiro-[tema]-[data].md`

---

## Output

Entregar o conteúdo pronto pra copiar e colar. Se for feed, incluir a legenda completa. Se for thread, numerar os posts (1/, 2/, ...).
