---
name: carrossel
description: >
  Cria carrosséis completos para Instagram e TikTok com a identidade visual da Stage Mídia.
  Gera o texto dos slides, cria os HTMLs no estilo dark premium (#0B0B0B + laranja #F05A1A),
  renderiza em PNG via Playwright e pergunta se quer versão TikTok.
  Use quando o usuário mencionar "carrossel", "carousel", "slides instagram",
  "slides tiktok", "faz um carrossel", ou pedir pra transformar um tema em carrossel.
---

# /carrossel — Criação de Carrossel

## Dependências

- **Identidade visual:** `marca/design-guide.md` — LER ANTES de criar qualquer HTML
- **Contexto do negócio:** `_contexto/empresa.md`
- **Tom de voz:** `_contexto/preferencias.md`
- **Playwright CLI:** `npx playwright screenshot` para renderizar HTMLs em PNG.
  Se nunca usou, rodar uma vez: `npx playwright install chromium`
- **Post for Me (opcional):** `POSTFORME_API_KEY` no `.env` para publicar direto no Instagram

## Input

O usuário fornece:
- Link de notícia, post viral de concorrente, ou ideia/texto livre
- Número do episódio ou série (se aplicável)
- Foto pra capa (opcional — se não fornecer, cria capa sem foto)
- Se não especificar, perguntar: "Esse carrossel é pra conta da Stage ou pro O REII?"

---

## Identidade Visual — Stage Mídia / O REII

- **Fundo:** `#0B0B0B`
- **Destaque/CTA:** `#F05A1A` (laranja Stage)
- **Texto:** `#FFFFFF`
- **Cards/fundo alternativo:** `#141414`
- **Títulos:** Bebas Neue (Google Fonts)
- **Subtítulos:** Syne (Google Fonts)
- **Corpo:** Space Grotesk (Google Fonts)
- **Estilo:** dark premium, glow sutil em laranja nos elementos de destaque, bordas finas em #F05A1A ou #ffffff20
- **Nunca:** fundo branco, gradientes coloridos, layout de agência genérica

---

## Workflow em 3 Fases

### Fase 1 — Texto

1. Ler `_contexto/preferencias.md` pra calibrar o tom de voz
2. Ler `_contexto/empresa.md` pra entender o contexto e o público
3. Se o input for um link, usar WebFetch pra buscar o conteúdo
4. Definir o ângulo do carrossel: educacional, oportunidade, contrário, provocativo ou inspiracional
5. Escrever 8-10 slides seguindo o fluxo:
   - **Slide 1 (Capa):** 3 opções de título (max 8 palavras cada) + subtítulo — o usuário escolhe antes de continuar
   - **Slides 2-3 (Contexto):** o que é / por que importa
   - **Slides 4-7 (Desenvolvimento):** um insight por slide, opinião clara
   - **Slide 8-9 (Implicação):** "o que isso muda pra quem tá lendo?"
   - **Slide final (CTA):** chamada pra ação + menção ao @homero.ads ou Stage Mídia (conforme a conta)

**Tom do texto:**
- Frases longas e naturais (2-4 frases por slide), não bullet points disfarçados
- Frases curtas e picotadas ficam com cara de IA — evitar
- Manter o curiosity gap entre slides, mas dentro de cada slide o texto deve fluir
- Técnico, direto e com opinião — nunca genérico
- Sem fórmulas de criador de conteúdo ("ei pessoal", "não esquece de dar like")

6. Salvar o texto em `conteudo/carrosseis/[tema]/carousel-text.md`

**CHECKPOINT:** mostrar o texto completo + as 3 opções de capa. Esperar o usuário escolher a capa e aprovar o texto antes de seguir pra Fase 2.

---

### Fase 2 — Visual (HTMLs + PNGs)

1. Ler `marca/design-guide.md` pra confirmar a identidade visual
2. Criar HTMLs (1080x1350px, inline CSS, Google Fonts como única dependência externa)

**Padrão visual dos slides:**
- Fundo: `#0B0B0B`
- Texto principal: `#FFFFFF`
- Destaque: `#F05A1A`
- Tipografia: Bebas Neue (títulos), Syne (subtítulos), Space Grotesk (corpo)
- Variação de layout: não fazer todos os slides iguais — usar pelo menos 2 layouts (ex: texto simples, destaque com número grande, card com borda laranja, citação em destaque)
- Glow sutil em laranja nos elementos principais: `box-shadow: 0 0 20px #F05A1A40`
- Bordas finas: `1px solid #F05A1A` ou `1px solid #ffffff20`
- Último slide: só branding e CTA, sem texto longo

3. Salvar HTMLs em `conteudo/carrosseis/[tema]/instagram/`
4. Renderizar cada HTML em PNG via CLI:
   ```bash
   npx playwright screenshot --viewport-size=1080,1350 --full-page "file:///caminho/absoluto/slide-XX.html" "slide-XX.png"
   ```
   - Renderizar slide 1 primeiro e mostrar pro usuário antes de renderizar os demais

**CHECKPOINT:** mostrar slide 1 renderizado. Se aprovado, renderizar os demais.

Salvar PNGs em `conteudo/carrosseis/[tema]/instagram/`.

---

### Fase 3 — Versão TikTok (opcional)

Após finalizar o Instagram, perguntar:
> "Quer a versão TikTok também? (1080x1920, formato vertical para stories/reels)"

Se sim:
- Adaptar os HTMLs: height 1920px, ajustar padding, aumentar fonte levemente
- Renderizar via CLI:
  ```bash
  npx playwright screenshot --viewport-size=1080,1920 --full-page "file:///caminho/absoluto/slide-XX.html" "slide-XX.png"
  ```
- Salvar em `conteudo/carrosseis/[tema]/tiktok/`

---

## Output final

```
conteudo/carrosseis/[tema]/
  carousel-text.md          ← texto aprovado + legenda sugerida
  instagram/
    slide-01.html → slide-01.png
    slide-02.html → slide-02.png
    ...
  tiktok/ (se solicitado)
    slide-01.html → slide-01.png
    ...
```

---

### Fase 4 — Publicação no Instagram (opcional)

Após finalizar os PNGs, perguntar:
> "Quer publicar direto no Instagram agora?"

Se sim, verificar se `POSTFORME_API_KEY` existe no `.env`. Se não existir:
> "Você precisa da chave do Post for Me no .env. Cria conta em postforme.dev, pega a API key e salva assim no .env: `POSTFORME_API_KEY=sua_chave`"

Se existir, usar a legenda de `carousel-text.md` e rodar:
```bash
node --env-file=.env scripts/publish-postforme.js \
  --pasta conteudo/carrosseis/[tema]/instagram \
  --legenda "[legenda do carousel-text.md]" \
  --conta instagram
```

Confirmar após publicar:
> "Publicado no Instagram."

---

## Regras

- Texto aprovado na Fase 1 não muda na Fase 2
- Sempre mostrar slide 1 antes de renderizar os demais
- Se o usuário pedir ajuste no visual, editar o HTML e re-renderizar apenas o slide alterado
- Nunca usar travessões (—) no texto
- Nunca usar visuais genéricos, gradientes coloridos ou fundo branco
