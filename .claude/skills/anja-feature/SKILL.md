---
name: anja-feature
description: Adiciona feature ao app Anja (Next.js + Supabase) mantendo contexto do projeto — stack, rotas, schema e padrões existentes
---

# /anja-feature — Nova Feature no Anja

## Contexto do projeto

**Stack:** Next.js 15 (App Router), TypeScript, Supabase (auth + banco), Tailwind CSS, PM2 (produção)

**Rotas existentes:**
```
app/
  (auth)/           ← login, cadastro
  (dashboard)/
    agenda/         ← Google Calendar integrado
    chat/           ← chat com histórico por sessão (chat_sessions + messages)
    configuracoes/  ← preferências do usuário
    dashboard/      ← página principal
    rotinas/        ← templates de rotinas diárias
    tarefas/        ← lista de tarefas
  onboarding/       ← fluxo inicial
```

**Supabase — tabelas existentes:**
- `profiles` — dados do usuário
- `messages` — mensagens do chat
- `chat_sessions` — sessões do chat com session_id
- `push_subscriptions` — VAPID push notifications (web push configurado)

**Scripts externos (PM2):**
- `projetos/anja/` — app Next.js na porta 3003
- `projetos/anja/scripts/anja-notifier.mjs` — bot Telegram com daily briefing, event reminders e weekly summary

**Convenções:**
- Componentes em `src/components/`
- API routes em `src/app/api/`
- Páginas em `src/app/(dashboard)/[rota]/page.tsx`
- Supabase client: `@/lib/supabase/client` (client-side) e `@/lib/supabase/server` (server-side)
- Auth via middleware — rotas do dashboard são protegidas automaticamente

## Fluxo

1. **Entender a feature** — perguntar o que a feature deve fazer se não estiver claro
2. **Identificar impacto** — quais arquivos/rotas/tabelas são afetados
3. **Verificar o que já existe** — ler arquivos relevantes antes de criar
4. **Planejar antes de executar** — apresentar o plano de implementação
5. **Implementar** — criar/editar arquivos seguindo as convenções do projeto
6. **Build e verificação** — rodar `cd projetos/anja && npm run build` para confirmar sem erros
7. **Restart PM2** — `pm2 restart anja` para aplicar em produção

## Regras

- Nunca criar nova página sem verificar se já existe algo parecido
- Sempre verificar o schema Supabase antes de criar migration nova
- TypeScript strict — sem `any` sem necessidade
- Migrations em `projetos/anja/supabase/migrations/` com nome `NNN_descricao.sql`
- Testar build antes de declarar concluído

## Após implementar

Confirmar:
> "Feature implementada. Build passou. PM2 reiniciado. Quer testar algum caso específico?"
