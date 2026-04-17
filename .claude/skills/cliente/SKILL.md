---
name: cliente
description: Cria pasta e estrutura completa para novo cliente ativo — briefing, histórico, relatórios e contexto de campanha
---

# /cliente — Novo Cliente

## O que faz

Cria a estrutura de pastas e arquivos iniciais para um novo cliente ativo na agência.

## O que pedir

1. **Nome do cliente** (como vai aparecer na pasta, ex: `el-toro`, `bloom-beauty`)
2. **Nome comercial completo** (ex: El Toro Casa do Churrasco)
3. **Segmento** (ex: restaurante, estética automotiva, clínica veterinária)
4. **Cidade/região**
5. **Plataformas contratadas** (Meta Ads, Google Ads, ambas)
6. **Orçamento de mídia mensal**
7. **Objetivo principal** (leads, vendas, awareness)
8. **Contato principal** (nome e canal)
9. **Data de início**

## Estrutura criada

```
clientes/[nome-cliente]/
  contexto.md          ← briefing, objetivo, público-alvo, diferenciais
  campanha-atual.md    ← estrutura de campanhas ativas, criativos, segmentações
  historico.md         ← linha do tempo: reuniões, mudanças, resultados relevantes
  relatorios/          ← pasta vazia para relatórios mensais
```

## Conteúdo de contexto.md

```markdown
# [Nome Comercial]

**Segmento:** [segmento]
**Cidade:** [cidade]
**Início:** [data]
**Plataformas:** [Meta / Google / ambas]
**Orçamento de mídia:** R$ [X]/mês

## Objetivo
[Objetivo principal da campanha]

## Público-alvo
[Descrição do público — quem compra, faixa etária, comportamento]

## Diferenciais do negócio
[O que diferencia do concorrente — importante pra copy de anúncio]

## Tom e restrições
[Alguma restrição de comunicação? Palavras proibidas? Identidade visual?]

## Contato
[Nome] — [canal, ex: WhatsApp]
```

## Conteúdo de campanha-atual.md

```markdown
# Campanhas Ativas — [Nome]

**Atualizado em:** [data]

## Meta Ads

### Campanha: [nome]
- Objetivo: [conversão / tráfego / alcance]
- Público: [segmentação]
- Orçamento diário: R$ [X]
- Criativos ativos: [descrever]
- CPR atual: R$ [X]

## Google Ads

### Campanha: [nome]
- Tipo: [busca / performance max / display]
- Palavras-chave principais: [lista]
- Orçamento diário: R$ [X]
```

## Conteúdo de historico.md

```markdown
# Histórico — [Nome]

## [Data início]
- Início da gestão
- [Contexto inicial: o que existia antes, o que foi herdado]
```

## Após criar

Confirmar o que foi criado e perguntar:
> "Quer já preencher o contexto da campanha ou deixa pra depois?"

Adicionar o cliente na lista de clientes ativos em `_contexto/empresa.md` se ainda não estiver lá.
