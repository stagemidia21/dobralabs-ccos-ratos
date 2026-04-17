---
name: pauta-semanal
description: Gera pauta de conteúdo para os próximos 7 dias do @homero.ads com variação de temas, formatos e ângulos
---

# /pauta-semanal — Pauta Semanal

## Contexto

Ler obrigatoriamente antes de gerar:
- `_contexto/empresa.md`
- `_contexto/preferencias.md`
- Histórico Obsidian via `lerHistorico(30)` em `scripts/obsidian.mjs` — últimos 30 dias pra evitar repetição

## Fontes de pauta

1. **Posts virais dos concorrentes** — rodar `scripts/buscar-referencias.mjs` para pegar referências atuais
2. **Notícias de IA e marketing digital** — buscar novidades relevantes da semana
3. **Perguntas frequentes dos clientes** — o que PMEs e gestores perguntam na prática
4. **Conteúdo evergreen** — conceitos que sempre têm demanda (Meta Ads, Google, automação, relatório)

## Formato da pauta

Gerar 3 posts/dia × 7 dias = 21 posts. Organizar por dia com horário sugerido (7h, 12h, 18h).

Para cada post:

```
**Dia [X] — [data] | [horário]**
Tema: `[título direto, imperativo ou dado concreto]`
Ângulo: [o que diferencia esse post de um conteúdo genérico sobre o mesmo tema]
Fonte: [de onde veio a pauta — viral, notícia, Stage Mídia]
Formato: carrossel | story | reels
```

## Critérios de qualidade

- Nunca dois posts sobre o mesmo tema na mesma semana
- Alternar entre: dado de mercado → operacional/prático → posicionamento/autoridade
- Pelo menos 1 post por semana ancorado em novidade real (lançamento, pesquisa, notícia)
- Pelo menos 1 post por semana dirigido especificamente a gestores de tráfego
- Pelo menos 1 post por semana dirigido a donos de PME
- Evitar pauta genérica de "IA vai mudar tudo" sem ângulo específico

## Output

Apresentar a pauta completa em tabela resumida primeiro:

| Dia | Horário | Tema | Ângulo em 1 linha |
|---|---|---|---|

Depois perguntar:
> "Algum dia ou tema você quer ajustar antes de eu detalhar?"

Se aprovado, detalhar cada post com tema, ângulo e fonte.

## Salvar

Salvar pauta aprovada em `_contexto/pauta-semanal-[data-inicio].md`.
