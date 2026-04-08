---
name: story
description: Gera e publica stories de venda no Instagram — planos, métodos, serviços, CTAs. Produz slides 1080x1920 como PNG via Remotion e publica diretamente na API do Instagram.
---

# /story — Story de Venda

## O que faz

Gera de 3 a 6 slides de story vertical (1080x1920) com foco em venda ou apresentação de serviço, renderiza como PNG via Remotion e publica no Instagram Stories (e Threads).

## Quando usar

- Apresentar plano, preço ou pacote
- Explicar método ou processo
- Fazer uma oferta direta
- Compartilhar prova social / resultado de cliente
- CTA direto pro link na bio

## Como funciona

1. Claude gera o conteúdo estruturado (capa + corpo × N + CTA)
2. Remotion renderiza cada slide como PNG (frame 60 = 2s, animações reveladas)
3. Upload via Post for Me CDN
4. Publicação via Instagram Graph API (media_product_type: STORY)

## Estrutura dos slides

- **Capa**: foto de fundo com zoom, tag colorida, título animado linha a linha, subtítulo, @handle
- **Corpo**: fundo escuro com grade, barra lateral laranja, label + contador, título animado, texto
- **CTA**: fundo com gradiente radial, barra inferior laranja, texto centralizado

## Comando de execução

```bash
node scripts/gerar-story.mjs "<tema do story>"
```

**Exemplos reais:**
```bash
node scripts/gerar-story.mjs "planos Stage Mídia — o que está incluído"
node scripts/gerar-story.mjs "por que tráfego pago precisa de gestão humana"
node scripts/gerar-story.mjs "resultado: cliente X saiu de 0 para R$50k em 90 dias"
node scripts/gerar-story.mjs "método Stage de funil — 3 etapas"
```

**Só gerar PNGs (sem publicar):**
```bash
node scripts/gerar-story.mjs "<tema>" --so-gerar
```

**Só publicar PNGs já gerados:**
```bash
node scripts/gerar-story.mjs "" --so-publicar story-<slug>-<data>
```

## Fluxo quando o usuário pede um story

1. Perguntar: "Qual o foco do story?" (plano? método? oferta? resultado?)
2. Se o usuário der tema vago, sugerir ângulo mais específico
3. Executar: `node scripts/gerar-story.mjs "<tema>"`
4. Mostrar legenda gerada e confirmar antes de publicar (se `--so-gerar` foi usado)

## Arquivos gerados

- `scripts/stories/<id>.json` — dados do story (slides + legenda + foto)
- `projetos/carrossel-remotion/src/Story_<id>.jsx` — composição Remotion
- `projetos/carrossel-remotion/out/stories/<id>/slide-01.png ...` — PNGs finais

## Tokens de design

- Fundo: `#0B0B0B`
- Acento: `#F05A1A` (laranja Stage)
- Título: Bebas Neue
- Body: Space Grotesk
- Subtítulo/labels: Syne

## Limites conhecidos

- Instagram Stories: publica cada slide separadamente (não carrossel)
- Threads: publica apenas o primeiro slide
- Facebook: não suporta stories via API de terceiros
