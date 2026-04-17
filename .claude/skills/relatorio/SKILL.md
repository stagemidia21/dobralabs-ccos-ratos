---
name: relatorio
description: Gera relatório de performance de cliente com seção "Leitura Stage" — métricas brutas + interpretação estratégica + recomendações
---

# /relatorio — Relatório de Performance

## Contexto

Ler antes de gerar:
- `_contexto/empresa.md`
- `_contexto/preferencias.md`
- Pasta do cliente em `clientes/[nome]/` para histórico e benchmarks

## O que pedir ao usuário

Se não receber os dados no comando, perguntar:

1. **Cliente** — qual cliente?
2. **Período** — mês/semana específico?
3. **Plataformas** — Meta Ads, Google Ads, ambas?
4. **Dados** — pedir que cole as métricas brutas (CPM, CPC, CTR, verba, resultados, custo por resultado)
5. **Meta acordada** — qual era o CPR ou CAC alvo?

## Estrutura do relatório

### Cabeçalho
```
RELATÓRIO DE PERFORMANCE
[Nome do cliente]
[Período]
Elaborado por Stage Mídia
```

### 1. Resumo executivo
2-3 frases. O que o período foi na prática — sem eufemismos, sem catastrofismo.

### 2. Métricas por plataforma

Para cada plataforma (Meta / Google):

| Métrica | Resultado | Benchmark / Meta | Status |
|---|---|---|---|
| Verba investida | | | |
| Impressões | | | |
| CPM | | | |
| Cliques | | | |
| CPC | | | |
| CTR | | | |
| Resultados | | | |
| Custo por resultado | | | |

### 3. Leitura Stage ← seção obrigatória

Interpretação estratégica das métricas. Formato:

**O que os números dizem:**
[Análise direta — o que está funcionando, o que está frenando, padrões identificados]

**Por que isso está acontecendo:**
[Hipótese técnica — criativo, público, sazonalidade, concorrência, frequência]

**O que fazer agora:**
[2-3 ações concretas com ordem de prioridade]

### 4. Próximos passos

Lista curta com responsável e prazo quando aplicável.

---

## Regras de escrita

- Português BR, acentuação correta
- Nunca métricas sem interpretação
- Tom direto — o cliente paga por decisão, não por dado
- Se o resultado foi ruim, dizer claramente e explicar por quê
- Evitar: "excelente resultado", "superamos as expectativas", "em linha com o mercado" sem evidência
- Salvar em `clientes/[nome]/relatorios/relatorio-[periodo].md`
