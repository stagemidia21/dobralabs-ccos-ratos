# Stage Mídia — Claude Code OS

## O que é esse workspace

Workspace central de operações do Homero Zanichelli — agência Stage Mídia, projetos próprios (SaaS, infoprodutos, conteúdo) e papel como Head Tech & IA na Axis Revenue.

**Estrutura de pastas:**
- `_contexto/` — memória do sistema (não apagar)
- `marca/` — design-guide e identidade visual
- `clientes/` — um subdiretório por cliente ativo
- `briefings/` — briefings recebidos
- `propostas/` — propostas em andamento e enviadas
- `conteudo/` — produção de conteúdo (O REII / @homero.ads)
- `projetos/` — projetos próprios em desenvolvimento (SaaS, NEXT OS, Círculo, Podcast)
- `dados/` — arquivos para análise (CSV, PDF, prints, referências)
- `templates/skills/` — templates de skills prontos pra personalizar com /mapear
- `templates/ferramentas/catalogo.md` — APIs e ferramentas disponíveis pra usar em skills
- `tarefas.md` — lista de tarefas corrente

## Sobre o negócio

Homero Zanichelli é fundador e CEO da Stage Mídia Soluções Digitais, agência especializada em tráfego pago (Meta Ads, Google Ads, TikTok, LinkedIn), funis de vendas, automação com IA e marketing via WhatsApp para PMEs e negócios locais. Posicionamento: "Sou o cara que entra quando a agência diz que já fez de tudo — e o resultado não veio." Também atua como Head Tech & IA e Gestor de Tráfego Pago na Axis Revenue.

## O que mais fazemos aqui

- Relatórios de performance com callouts "Leitura Stage" (métricas + interpretação estratégica)
- Propostas comerciais para novos clientes
- Gestão e documentação de clientes ativos
- Produção de conteúdo para @homero.ads / O REII
- SOPs, sistemas operacionais e automações (Stage NEXT OS™)
- Desenvolvimento do SaaS Social Media OS (3 tiers: Solo, Agência, Enterprise)
- Materiais do Círculo Stage Next™ e infoprodutos

## Clientes ativos

El Toro Casa do Churrasco, Acqua Estética Automotiva, Centrovet Itatiba, Bia Vasconcelos Pilates, Espaço Kyrios, Bloom Beauty, Garagem 65, Viva Cor Decoração, Sandrão.

## Equipe

- Stage Mídia: Homero como founder com controle total (desde 2022)
- Axis Revenue: Junior Bacelar (CEO), Diego Almeida (Head Revenue), Victor Veludo (Head Operations), Nicolas

## Tom de voz

Técnico, direto, premium e objetivo. Sem rodeios, sem enrolação. Outputs densos com interpretação estratégica — nunca apenas dados brutos. Português BR com acentuação correta. Alta exigência com credibilidade e qualidade do texto.

Evitar: textos repetitivos, genéricos ou com cara de IA; bullets desnecessários; erros de acentuação; métricas sem interpretação; respostas que parecem "feitas pra qualquer um"; palavrões motivacionais.

## Regras do sistema

- Propostas salvar em `propostas/`
- Clientes novos: criar pasta em `clientes/[nome-cliente]/`
- Relatórios: sempre incluir seção "Leitura Stage" com interpretação estratégica além dos números
- Conteúdo do alter ego O REII: salvar em `conteudo/`
- Projetos próprios (SaaS, NEXT OS, Círculo, Podcast): salvar em `projetos/`

## Ferramentas conectadas

- [x] Obsidian — vault: `C:/Users/homer/OneDrive/Documentos/Backup/Homero Note` | MCP: `mcp-obsidian` (global) | módulo: `scripts/obsidian.mjs`
- [x] Notion — MCP instalado (claude.ai)
- [x] Gmail — MCP instalado (claude.ai)
- [x] Google Calendar — MCP instalado (claude.ai)
- [x] Canva — MCP instalado (claude.ai)
- [x] Figma — MCP instalado (claude.ai)
- [ ] n8n
- [ ] Supabase

## Obsidian — inteligência de conteúdo

O vault funciona como memória histórica do pipeline de conteúdo. Regras:

- Todo carrossel publicado → salvo automaticamente em `@homero.ads/carrosseis/`
- Todo story publicado → salvo automaticamente em `@homero.ads/stories/`
- Antes de gerar conteúdo novo → `lerHistorico(14)` informa o Claude dos temas já publicados nos últimos 14 dias
- Pautas do vault (`@homero.ads/pautas/`) podem ser lidas com `lerPautas()` antes de gerar

Ao criar skills de conteúdo, sempre importar `scripts/obsidian.mjs` e chamar `salvarCarrossel` ou `salvarStory` ao final.

---

## Contexto do negócio

No início de toda conversa, ler os seguintes arquivos (se existirem e estiverem configurados):

1. `_contexto/empresa.md` — quem é o usuário, o que faz, como funciona o negócio
2. `_contexto/preferencias.md` — tom de voz, estilo de escrita, o que evitar
3. `_contexto/estrategia.md` — foco atual, prioridades, o que pode esperar

Usar essas informações como base pra qualquer resposta ou decisão. Ao sugerir prioridades, formatos ou abordagens, considerar o foco atual descrito em `estrategia.md`.

Para qualquer tarefa visual (carrossel, proposta, slide, landing page), consultar `marca/design-guide.md` como referência de estilo.

Não é necessário listar o que foi lido nem confirmar a leitura. Apenas usar o contexto naturalmente.

---

## Orquestrador de conteúdo

Qualquer intenção de conteúdo — tema solto, ideia, "quero falar sobre X", pedido de post/story/carrossel — ativa automaticamente a skill `/orq`.

O orquestrador: lê histórico do Obsidian → verifica repetição → escolhe imagem → briefa → gera → humaniza → revisa → publica → salva.

Nunca gerar conteúdo sem passar pelo orquestrador. Nunca publicar sem revisar primeiro.

## Fluxo de trabalho

Antes de executar qualquer tarefa, verificar se existe uma skill relevante em `.claude/skills/` ou `.claude/commands/`.
Se encontrar, seguir as instruções da skill.
Se não encontrar, executar a tarefa normalmente.

Ao concluir uma tarefa que não tinha skill mas parece repetível (o usuário provavelmente vai pedir de novo no futuro), perguntar:

> "Isso pode virar uma skill pra próxima vez. Quer que eu crie?"

Não perguntar pra tarefas pontuais ou perguntas simples. Só quando o padrão de repetição for claro.

---

## Aprender com correções

Quando o usuário corrigir algo, melhorar uma resposta ou dar uma instrução que parece permanente (frases como "na verdade é assim", "não faça mais isso", "prefiro assim", "sempre que...", "evita...", "da próxima vez..."), perguntar:

> "Quer que eu salve isso pra não precisar repetir?"

Se sim, identificar onde faz mais sentido salvar:

- **Sobre o negócio** (quem são os clientes, como funciona a empresa, serviços, mercado) → adicionar em `_contexto/empresa.md`
- **Sobre preferências e estilo** (tom de voz, formato de resposta, o que evitar, como estruturar textos) → adicionar em `_contexto/preferencias.md`
- **Sobre prioridades e foco atual** (projetos em andamento, metas do momento, prazos importantes, o que é prioridade agora) → adicionar em `_contexto/estrategia.md`
- **Regra de comportamento nessa pasta** (onde salvar arquivos, como nomear, fluxos específicos) → adicionar no próprio `CLAUDE.md`

Salvar com uma linha nova clara, sem reformatar o arquivo inteiro. Confirmar o que foi salvo mostrando a linha adicionada.

Não perguntar se a correção for óbvia de contexto imediato (ex: "na verdade o arquivo se chama X"). Só perguntar quando a informação tiver valor duradouro.

---

## Criação de skills

Quando o usuário pedir pra criar uma nova skill:

1. Verificar se existe um template relevante em `templates/skills/`. Se existir, usar como base e adaptar pro contexto do usuário
2. Perguntar: "Essa skill é específica pra esse projeto ou vai ser útil em qualquer projeto?"
   - Específica desse negócio → salvar em `.claude/skills/nome-da-skill/SKILL.md` (local)
   - Útil em qualquer projeto → salvar em `~/.claude/skills/nome-da-skill/SKILL.md` (global)
3. Ler `_contexto/empresa.md` e `_contexto/preferencias.md` pra calibrar o conteúdo da skill ao contexto do negócio
4. Se a skill precisar de arquivos de apoio (templates, referências, exemplos), criar dentro da pasta da skill
5. Seguir o fluxo da skill-creator nativa do Claude Code
