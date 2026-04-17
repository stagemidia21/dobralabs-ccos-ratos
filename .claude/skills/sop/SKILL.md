---
name: sop
description: Cria SOP (Standard Operating Procedure) para qualquer processo da agência ou operação pessoal
---

# /sop — Standard Operating Procedure

## Quando usar

Quando um processo novo foi mapeado ou um processo existente precisa ser documentado para:
- Não depender da memória do Homero
- Poder delegar ou automatizar no futuro
- Servir de base para uma skill do Claude Code

## O que pedir

Se não receber contexto suficiente:

1. **Nome do processo** — como vai ser chamado
2. **Objetivo** — qual entregável ou resultado esse processo produz
3. **Frequência** — diário, semanal, por demanda?
4. **Quem executa** — Homero, equipe, Claude, automatizado?
5. **Ferramentas envolvidas** — Meta, Google, Notion, Claude, planilha, etc.
6. **Passo a passo atual** — como o Homero faz hoje (mesmo que bagunçado)

## Estrutura do SOP

```markdown
# SOP: [Nome do Processo]

**Objetivo:** [em uma frase]
**Frequência:** [diário / semanal / por demanda]
**Responsável:** [Homero / equipe / automatizado]
**Tempo estimado:** [X min]
**Última atualização:** [data]

---

## Pré-requisitos

- [Acesso necessário]
- [Dado ou arquivo necessário antes de começar]

---

## Passo a passo

### 1. [Nome da etapa]
[Descrição clara do que fazer. Uma ação por step.]

**Ferramenta:** [qual usar]
**Output esperado:** [o que sai dessa etapa]

### 2. [Nome da etapa]
...

---

## Critérios de conclusão

- [ ] [O que confirma que o processo foi feito corretamente]
- [ ] [Segundo critério]

---

## Erros comuns

| Problema | Causa | Solução |
|---|---|---|
| [erro] | [por que acontece] | [como resolver] |

---

## Notas

[Qualquer contexto extra que não cabe no passo a passo]
```

## Onde salvar

- Processos da agência → `clientes/[nome]/sops/` ou `_contexto/sops/`
- Processos de conteúdo → `conteudo/sops/`
- Processos técnicos → `scripts/sops/` ou documentar direto no README do projeto

Após criar, perguntar:
> "Esse processo tem potencial pra virar uma skill automatizada? Quer que eu crie?"
