---
name: ig-autodm-regra
description: Adiciona nova regra de auto-DM no Instagram sem precisar lembrar a estrutura do worker.js
---

# /ig-autodm-regra — Nova Regra de Auto-DM

## O que faz

Adiciona uma nova regra no array `REGRAS` do arquivo `projetos/ig-autodm/worker.js` e faz deploy no Cloudflare.

## O que pedir

1. **Palavras-chave** — quais comentários disparam o DM? (ex: "pdf", "quero", "link")
2. **Mensagem do DM** — o que vai ser enviado (pode incluir link)
3. **Post específico?** — só dispara num post específico ou em qualquer post?
   - Se específico: qual o ID do post? (disponível na URL do post)

## Estrutura da regra

```js
{
  keywords: ['palavra1', 'palavra2'],
  message: 'Mensagem que será enviada por DM.\n\nhttps://link-aqui.com',
  mediaId: null,  // null = qualquer post | '123456789' = post específico
}
```

## Processo

1. Ler `projetos/ig-autodm/worker.js`
2. Identificar onde termina o array `REGRAS`
3. Adicionar a nova regra antes do fechamento `]`
4. Mostrar a regra adicionada para confirmação
5. Após confirmar, fazer deploy:

```bash
cd projetos/ig-autodm
wrangler deploy
```

## Limitações importantes

- Só envia DM pra quem já segue você OU comentou/mandou mensagem nas últimas 24h
- Limite: 200 DMs/hora
- O token do Instagram expira — se o DM não for enviado, verificar se o token ainda é válido

## Listagem de regras ativas

Se o usuário pedir `/ig-autodm-regra listar`, mostrar todas as regras ativas do `worker.js` em formato resumido:

| # | Palavras-chave | Post | Mensagem (início) |
|---|---|---|---|
| 1 | pdf, quero | qualquer | "Aqui está o PDF..." |
