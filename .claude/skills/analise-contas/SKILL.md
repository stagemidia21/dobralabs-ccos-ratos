---
name: analise-contas
description: Análise diária das contas de tráfego pago (Meta Ads + Google Ads) — puxa métricas do dia, identifica anomalias e envia resumo pelo Telegram
---

# /analise-contas — Análise Diária das Contas

## Pré-requisitos

### Meta Ads
- **Token necessário**: User Access Token (não Page Token) com permissão `ads_read`
- **Como gerar**: Graph API Explorer → selecionar app → adicionar `ads_read` → gerar token de longa duração
- **Onde salvar**: `_contexto/tokens.json` ou variável de ambiente `META_USER_TOKEN`
- **Status**: ⚠️ Pendente — o token atual (PostForMe) é Page Token, sem acesso a ad accounts

### Google Ads
- **Token necessário**: Google Ads API Developer Token + OAuth2
- **Status**: ⚠️ Pendente — não configurado ainda

---

## Fluxo

```
1. Carregar contas ativas
2. Puxar métricas do dia (Meta + Google)
3. Calcular variações vs. dia anterior / média dos últimos 7 dias
4. Identificar anomalias
5. Gerar resumo em texto
6. Enviar pelo Telegram
```

---

## Contas ativas

Clientes: El Toro, Acqua, Centrovet, Bia Pilates, Espaço Kyrios, Bloom Beauty, Garagem 65, Viva Cor, Sandrão.

---

## Métricas Meta Ads (por conta, por dia)

Via API:
```
GET /act_{ad_account_id}/insights
  ?fields=spend,impressions,reach,clicks,ctr,cpm,cpc,actions,action_values
  &date_preset=today
  &level=account
  Authorization: Bearer {META_USER_TOKEN}
```

**Métricas relevantes por conta:**
- Verba gasta vs. orçamento diário (% consumido)
- CPM, CPC, CTR vs. média dos últimos 7 dias
- Resultados (leads, vendas, mensagens) do dia
- Custo por resultado vs. meta

**Anomalias a detectar:**
- Verba < 70% do orçamento até 18h → campanha freando
- CPC > 2x a média → criativo cansado ou público saturado
- CTR < 0.5% → problema de criativo ou segmentação
- Zero resultados com verba gasta → campanha rodando sem converter
- Verba 0 com campanha ativa → campanha pausada ou limite de conta atingido

---

## Métricas Google Ads (por conta, por dia)

Via API (quando configurado):
```
campaigns → metrics: cost, clicks, impressions, ctr, average_cpc, conversions, cost_per_conversion
date_range: TODAY
```

**Anomalias:**
- CTR < 2% em busca → título ou extensão problema
- CPA > 2x meta → lance ou matching ruim
- Zero cliques com budget disponível → ad reprovado ou lance baixo demais

---

## Output — Resumo do dia

Formato do resumo enviado pelo Telegram:

```
📊 Análise diária — {data}

{Para cada conta com anomalia:}
🔴 [Nome do cliente]
  ↳ [anomalia detectada em linguagem direta]
  ↳ [sugestão de ação]

✅ Contas sem alerta: [lista]

⏱ Gerado às {hora}
```

Se não houver anomalias: "✅ Todas as contas dentro do padrão hoje."

---

## Implementação

Quando os tokens estiverem disponíveis, criar:
- `scripts/analise-contas.mjs` — script principal
- Adicionar ao cron ou rodar manualmente com `/analise-contas`

O script vai:
1. Ler `_contexto/contas.json` com IDs das ad accounts por cliente
2. Puxar métricas via API Meta e/ou Google
3. Passar dados pro Claude via prompt estruturado
4. Claude destaca anomalias e sugere ações
5. Script envia pelo Telegram

---

## Status

- [x] Processo mapeado
- [x] Métricas e anomalias definidas
- [x] Formato de output definido
- [ ] Meta User Token gerado e salvo
- [ ] `_contexto/contas.json` criado com IDs das ad accounts
- [ ] Google Ads API configurado
- [ ] `scripts/analise-contas.mjs` implementado

---

## Para configurar o Meta User Token

1. Acessar: https://developers.facebook.com/tools/explorer
2. Selecionar seu app (ou criar um app de tipo Business)
3. Adicionar permissão: `ads_read`
4. Clicar em "Generate Access Token"
5. Converter para token de longa duração:
   ```
   GET /oauth/access_token
     ?grant_type=fb_exchange_token
     &client_id={APP_ID}
     &client_secret={APP_SECRET}
     &fb_exchange_token={SHORT_TOKEN}
   ```
6. Salvar em `_contexto/tokens.json`:
   ```json
   { "meta_user_token": "EAA..." }
   ```
