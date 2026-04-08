---
name: orq
description: Orquestrador geral de conteúdo @homero.ads. Analisa qualquer pedido do Homero, carrega contexto completo (Obsidian, pauta, histórico), decide o formato certo, coordena todas as etapas com checagem de qualidade e publica. Ativa automaticamente para qualquer intenção de conteúdo.
---

# /orq — Orquestrador Geral @homero.ads

## Quando ativar

Toda vez que o Homero descrever qualquer intenção de conteúdo. Exemplos que disparam o orquestrador:

- "quero falar sobre X"
- "cria um post sobre Y"
- "story de Z"
- "publica sobre W"
- "o que publicar hoje?"
- Uma ideia solta, um tema, uma notícia, um resultado de cliente
- Qualquer pedido que resulte em conteúdo publicável

## Passo 1 — Carregar contexto completo

Antes de qualquer coisa, ler:

1. `scripts/obsidian.mjs` → chamar `lerHistorico(14)` para ver o que foi publicado nos últimos 14 dias
2. `_contexto/estrategia.md` → foco atual e projetos em andamento
3. `_contexto/preferencias.md` → tom, o que evitar
4. `projetos/carrossel-remotion/public/` → listar fotos disponíveis para capa

Usar esse contexto para tomar todas as decisões abaixo. Não listar o que foi lido — apenas usar.

## Passo 2 — Analisar a intenção

Classificar o pedido em uma das categorias:

| Intenção | Formato | Pipeline |
|---|---|---|
| Notícia/tendência de IA/tech | Carrossel feed (10 slides) | `gerar-e-publicar.mjs` |
| Opinião/ângulo do Homero | Carrossel feed (10 slides) | `gerar-e-publicar.mjs` |
| Venda de serviço/plano/mentoria | Story (3-6 slides) | `gerar-story.mjs` |
| Método/processo da Stage | Story ou Carrossel | perguntar |
| Resultado de cliente | Story (prova social) | `gerar-story.mjs` |
| Pauta do dia | Múltiplos formatos | planejar primeiro |
| Dúvida sobre o que publicar | Sugestão baseada no histórico | responder com 3 opções |

Se não for claro, perguntar uma coisa só: "É pra vender algo ou pra construir autoridade?"

## Passo 3 — Verificar histórico

Com `lerHistorico(14)` em mãos:

- O tema já foi abordado nos últimos 14 dias? → sugerir ângulo diferente
- O ângulo específico já foi usado? → propor variação
- É uma sequência natural do que foi publicado? → conectar na legenda

Se houver conflito de tema, avisar antes de gerar: "Publiquei sobre X há N dias com o ângulo Y. Quer um ângulo diferente ou segue mesmo assim?"

## Passo 4 — Escolher imagem de capa

Para carrossel de feed, escolher a imagem mais adequada ao tema:

| Tema | Imagem recomendada |
|---|---|
| Claude / Anthropic | `opt_b.jpg` |
| Google / Gemini / Gemma | `capa-gemma4-hero.jpg` |
| Código / vibe coding | `capa-vibe-coding.jpg` |
| Tráfego pago / negócios | `opt_d.jpg` |
| IA geral / tech | `opt_c.jpg` |
| Pessoal / bastidores | `opt1.jpg` ou `opt2.jpg` |
| Agência / processo | `opt3.jpg` |
| Genérico | rotacionar: `opt_a.jpg`, `opt_b.jpg`, `opt_c.jpg`, `opt_d.jpg` |

Para story de venda: sempre usar `opt_c.jpg` ou `opt_d.jpg` como padrão — fundo escuro funciona melhor com sobreposição de texto.

Se nenhuma das fotos existentes for adequada, avisar: "Nenhuma foto do acervo combina bem com esse tema. Quer adicionar uma nova antes de publicar?"

## Passo 5 — Briefar e confirmar antes de gerar

Mostrar um briefing rápido antes de executar:

```
📋 Briefing
Formato: [carrossel / story]
Tema: [tema confirmado]
Ângulo: [ângulo específico]
Imagem de capa: [foto escolhida]
Diferencial do histórico: [por que esse ângulo ainda não foi feito]

Gerar agora?
```

Aguardar confirmação. Se o Homero ajustar alguma coisa, incorporar antes de rodar.

## Passo 6 — Executar pipeline completo

### Para carrossel:
```bash
node scripts/gerar-e-publicar.mjs <numero_post>
```
Ou gerar inline com o prompt calibrado com o contexto do orquestrador.

### Para story:
```bash
node scripts/gerar-story.mjs "<tema>" --so-gerar
```
Sempre usar `--so-gerar` primeiro. Mostrar o conteúdo gerado antes de publicar.

O pipeline inclui automaticamente:
- ✅ `lerHistorico()` no prompt do Claude (evita repetição)
- ✅ `humanizarJSON()` após geração (remove vícios de IA)
- ✅ `salvarCarrossel()` / `salvarStory()` após publicação (salva no Obsidian)

## Passo 7 — Revisão de qualidade antes de publicar

Após gerar, mostrar o conteúdo e fazer checklist mental:

- [ ] Algum slide com cara de IA? (listas de 3, "crucial", "fundamental", "showcase")
- [ ] Primeira linha da capa é forte o suficiente pra parar o scroll?
- [ ] Body tem 3+ frases por slide ou está vazio demais?
- [ ] CTA é direto e específico?
- [ ] Legenda está em primeira pessoa e sem hashtags genéricas?

Se identificar problema, corrigir inline antes de publicar — não rodar de novo, só editar o JSON em `scripts/stories/<id>.json` ou o JSX gerado.

## Passo 8 — Publicar

Para story, após aprovação:
```bash
node scripts/gerar-story.mjs "" --so-publicar <story-id>
```

Para carrossel: o pipeline já publica automaticamente nas 5 redes.

## Passo 9 — Fechar o loop

Após publicação, confirmar:
- Plataformas onde foi publicado
- ID do post no Instagram
- Que foi salvo no Obsidian

Se houver erro em alguma rede, tentar novamente com o script isolado:
- Instagram: `node scripts/publicar-instagram-direto.mjs`
- Story: `node scripts/publicar-story.mjs <id>`

## Regras permanentes do orquestrador

1. **Nunca publicar sem revisar o conteúdo primeiro** — sempre `--so-gerar` antes de publicar
2. **Nunca repetir tema nos últimos 14 dias** — verificar Obsidian antes de gerar
3. **Humanizer sempre roda** — já embutido nos scripts, mas conferir no output
4. **Imagem de capa deve ser escolhida conscientemente** — não deixar no default aleatório
5. **Salvar no Obsidian é obrigatório** — já automatizado, mas verificar se salvou
6. **Stories com `media_product_type: STORY`** — monitorar se está indo pro lugar certo (bug em investigação)
7. **Primeira pessoa sem inventar experiências** — não escrever "testei" ou "rodei" sem confirmação do Homero

## Bugs conhecidos e contornos

| Bug | Status | Contorno |
|---|---|---|
| Stories indo pro feed (media_product_type ignorado) | Em investigação | Publicar manualmente pelo app até resolver |
| Remotion composition ID com underscore | Corrigido | compName PascalCase, compositionId com hífen |
| Post for Me não publica | Permanente | Usar apenas como CDN, publicar direto via API |
