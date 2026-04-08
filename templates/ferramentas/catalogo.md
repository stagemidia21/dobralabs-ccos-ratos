# Catalogo de Ferramentas

Referencia de APIs, CLIs e conectores que podem ser usados dentro de skills do Claude Code.
Consulte este arquivo antes de criar skills novas pra saber o que ja esta disponivel.

---

## Criar visuais (HTML pra PNG)

### Playwright CLI
**O que faz:** Renderiza qualquer HTML em imagem PNG (carrosseis, slides, propostas, cards)
**Precisa de conta:** Nao, roda local
**Como instalar:**
```bash
npx playwright install chromium
```
**Como usar numa skill:**
```bash
npx playwright screenshot --viewport-size=1080,1350 --full-page "file:///caminho/slide.html" "slide.png"
```
**Tamanhos comuns:**
- Instagram feed: 1080x1350
- Instagram/TikTok story: 1080x1920
- Slide 16:9: 1920x1080
- Card quadrado: 1080x1080

---

## Publicar na web

### Cloudflare Pages API
**O que faz:** Publica arquivos HTML com link publico (propostas, landing pages, estudos)
**Precisa de conta:** Sim, Cloudflare (gratis)
**Configurar:** Salvar `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` no `.env`
**Quando usar:** Sempre que a skill gerar um HTML que precisa ser compartilhado por link

---

## Publicar em redes sociais

### Post for Me API
**O que faz:** CDN para upload de arquivos (video/imagem) com URL publica. NAO usar pra publicacao — quebrado desde 2026-04-06
**Precisa de conta:** Sim, postforme.dev
**Configurar:** Salvar `POSTFORME_API_KEY` no `.env`
**Como usar:** Apenas para `create-upload-url` e PUT do arquivo. Publicacao direto via API de cada rede.
**Quando usar:** Upload de MP4/PNG antes de publicar em Instagram, Threads, Facebook

### APIs diretas de redes sociais
**O que faz:** Publicacao direta em Instagram, Threads, Facebook, LinkedIn sem intermediario
**Implementado em:** `scripts/gerar-e-publicar.mjs` e `scripts/gerar-story.mjs`
**Instagram:** `https://graph.instagram.com` — USER_ID: `26285906407703501`
**Threads:** `https://graph.threads.net` — carrossel e imagem story
**Facebook:** `https://graph.facebook.com/v19.0` — video unico (sem carrossel)
**LinkedIn:** `https://api.linkedin.com/v2/ugcPosts` — texto (sem midia nativa)
**Quando usar:** Sempre que precisar publicar conteudo — nunca usar Post for Me pra isso

---

## Buscar conteudo da web

### WebFetch (nativo)
**O que faz:** Le o conteudo de qualquer URL e traz como texto
**Precisa de conta:** Nao, ja vem no Claude Code
**Quando usar:** Pesquisa de referencias, ler artigos, buscar dados de sites

### WebSearch (nativo)
**O que faz:** Pesquisa no Google e traz resultados
**Precisa de conta:** Nao, ja vem no Claude Code
**Quando usar:** Quando o usuario precisa pesquisar antes de criar conteudo

### Jina Reader
**O que faz:** Converte qualquer URL em markdown limpo (melhor que WebFetch pra artigos longos)
**Precisa de conta:** Nao
**Como usar:** Acessar `https://r.jina.ai/{URL}` via WebFetch
**Quando usar:** Extrair texto de artigos, blog posts, paginas com muito HTML

---

## Extrair conteudo de video

### yt-dlp (CLI)
**O que faz:** Baixa transcricoes/legendas de videos do YouTube
**Precisa de conta:** Nao, roda local
**Como instalar:**
```bash
brew install yt-dlp
```
**Quando usar:** Skills que partem de um video pra criar conteudo (carrossel, newsletter, roteiro)

---

## Gerar imagens com IA

### Gemini (Google AI)
**O que faz:** Gera imagens a partir de texto
**Precisa de conta:** Sim, Google AI Studio (gratis ate certo limite)
**Configurar:** Salvar `GEMINI_API_KEY` no `.env`
**Quando usar:** Capas, ilustracoes, imagens pra posts

### DALL-E (OpenAI)
**O que faz:** Gera imagens a partir de texto
**Precisa de conta:** Sim, OpenAI (pago)
**Configurar:** Salvar `OPENAI_API_KEY` no `.env`
**Quando usar:** Alternativa ao Gemini pra geracao de imagens

---

## Obsidian (vault local)

### obsidian.mjs (modulo interno)
**O que faz:** Le e escreve notas no vault do Obsidian automaticamente apos cada publicacao
**Vault:** `C:/Users/homer/OneDrive/Documentos/Backup/Homero Note`
**MCP instalado:** `mcp-obsidian` — scope global, conectado
**Modulo:** `scripts/obsidian.mjs`
**Funcoes disponiveis:**
- `salvarCarrossel(dados, meta)` — salva post de feed em `@homero.ads/carrosseis/`
- `salvarStory(dados, meta)` — salva story em `@homero.ads/stories/`
- `lerHistorico(dias)` — le posts recentes pra evitar repeticao de tema no prompt do Claude
- `lerPautas()` — le pautas do vault pra usar como contexto
**Quando usar:** Sempre que gerar ou publicar conteudo — ja integrado nos pipelines principais

---

## Conectar com plataformas (MCPs)

MCPs sao conectores que dao acesso direto a plataformas dentro do Claude Code.
O Claude passa a usar esses conectores automaticamente quando fizer sentido.

Pra verificar quais MCPs ja estao instalados: `claude mcp list`
Pra remover um MCP: `claude mcp remove nome-do-mcp`

### Obsidian (MCP)
**Status: INSTALADO E CONECTADO**
**Vault:** `C:/Users/homer/OneDrive/Documentos/Backup/Homero Note`
**Instalado com:** `mcp-obsidian` (scope user — disponivel em todos os projetos)

### Notion
**O que faz:** Acessa projetos, bases de dados, briefings e tarefas do Notion
**Precisa de conta:** Sim, API key em notion.so/my-integrations
**Como instalar:**
```bash
claude mcp add notion -- npx -y @notionhq/notion-mcp-server
```
**Quando usar:** Skills que precisam ler/escrever tarefas, bases de clientes, documentos

### Gmail
**O que faz:** Le e compoe emails sem sair do Claude Code
**Precisa de conta:** Sim, OAuth Google
**Como instalar:**
```bash
claude mcp add gmail -- npx -y @gongrzhe/server-gmail-autoauth-mcp
```
**Quando usar:** Skills de email, follow-up, comunicacao com clientes

### Google Calendar
**O que faz:** Ve agenda, cria eventos e encontra horarios disponiveis
**Precisa de conta:** Sim, OAuth Google
**Como instalar:**
```bash
claude mcp add google-calendar -- npx -y @gongrzhe/server-google-calendar-autoauth-mcp
```
**Quando usar:** Skills de agendamento, planejamento, organizacao de reunioes

### Canva
**O que faz:** Acessa designs, cria novos assets visuais direto pelo Claude
**Precisa de conta:** Sim, Canva Pro
**Como instalar:**
```bash
claude mcp add canva -- npx -y @canva/canva-mcp-server
```
**Quando usar:** Skills de design, criacao visual, materiais de marca

### Facebook Ads (Meta)
**O que faz:** Gerencia campanhas do Meta (Facebook/Instagram Ads)
**Precisa de conta:** Sim, Token Meta Business
**Quando usar:** Skills de gestao de midia paga, relatorios de performance

### Google Ads
**O que faz:** Acessa e edita campanhas, busca dados de performance
**Precisa de conta:** Sim, credenciais Google Ads
**Quando usar:** Skills de gestao de midia paga, relatorios de performance

### N8N
**O que faz:** Dispara automacoes e workflows do N8N
**Precisa de conta:** Sim, instancia N8N + API key
**Como instalar:**
```bash
claude mcp add n8n -- npx -y n8n-mcp
```
**Quando usar:** Skills que precisam disparar automacoes externas

### Supabase
**O que faz:** Banco de dados e backend completo
**Precisa de conta:** Sim, projeto Supabase
**Quando usar:** Skills que precisam guardar dados, autenticacao, backend

### Telegram
**O que faz:** Envia e recebe mensagens via bot do Telegram
**Precisa de conta:** Sim, bot token do BotFather
**Quando usar:** Skills de notificacao, comunicacao automatica

---

## Como adicionar ferramentas novas

Se voce usa uma API ou ferramenta que nao esta nessa lista, adicione aqui seguindo o formato:

```markdown
### Nome da Ferramenta
**O que faz:** [descricao em uma frase]
**Precisa de conta:** [Sim/Nao]
**Configurar:** [o que salvar no .env, se aplicavel]
**Como usar numa skill:** [comando ou instrucao]
**Quando usar:** [em que tipo de skill faz sentido]
```
