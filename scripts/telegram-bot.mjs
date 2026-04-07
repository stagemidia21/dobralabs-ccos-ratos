import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import Anthropic from '@anthropic-ai/sdk';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MY_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!BOT_TOKEN || !ANTHROPIC_API_KEY) {
  console.error('Faltam variáveis de ambiente. Verifique .env');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// Estado por chat
const state = {};
function getState(id) {
  if (!state[id]) state[id] = { fase: 'idle', draft: null, formato: null, pauta: null, postAtual: 0 };
  return state[id];
}

function isAuthorized(ctx) {
  if (!MY_CHAT_ID) return true;
  return String(ctx.chat.id) === String(MY_CHAT_ID);
}

// Manda mensagem em chunks (limite Telegram: 4096 chars)
async function sendLong(ctx, text, extra = {}) {
  const chunks = text.match(/[\s\S]{1,4000}/g) || [text];
  for (const chunk of chunks) {
    await ctx.reply(chunk, extra);
  }
}

// ─── GERAÇÃO DE CONTEÚDO ────────────────────────────────────────────────────

async function gerarPauta(referencias) {
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });

  const refsTexto = referencias
    ? `\nPOSTS EM ALTA NOS PERFIS DE REFERÊNCIA:\n${referencias.posts_referencia.map(p =>
        `@${p.perfil} (${p.likes} likes): ${p.caption.slice(0, 150)}`
      ).join('\n')}\n\nNOTÍCIAS COLETADAS:\n${referencias.noticias.map(n =>
        `• ${n.titulo}`
      ).join('\n')}`
    : '';

  const prompt = `Você é o assistente de pauta do @homero.ads (Homero Zanichelli — Stage Mídia, Head Tech & IA).
Tom: técnico, direto, sem enrolação. Linha editorial: Claude Code, IA aplicada a negócios, tráfego pago.
Hoje: ${hoje}
${refsTexto}

Gere a PAUTA DO DIA com 6 posts no formato:

📅 PAUTA — ${hoje}

POST 1 | 08h | 📸 FEED
Tema: [tema direto]
Ângulo: [como abordar — diferente dos concorrentes]
Fonte: [notícia/série Claude Code/viral adaptado]

POST 2 | 10h | 🖼 CARROSSEL IMAGEM
Tema: ...
Ângulo: ...
Fonte: ...

POST 3 | 12h | 📱 CARROSSEL VÍDEO
Tema: ...
Ângulo: ...
Fonte: ...

POST 4 | 15h | 📸 FEED
...

POST 5 | 18h | 🖼 CARROSSEL IMAGEM
...

POST 6 | 20h | 📱 CARROSSEL VÍDEO
...

Regras:
- Pelo menos 1 post sobre Claude Code/IA aplicada
- Pelo menos 1 post baseado em notícia do dia
- Ângulos diferentes dos concorrentes
- Nunca repetir formato consecutivo no mesmo tema`;

  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  return msg.content[0].text;
}

async function gerarConteudoPost(tema, angulo, formato) {
  const formatoDesc = {
    feed: 'post de feed: 1 imagem estática + legenda completa (150-300 palavras) com CTA e hashtags',
    carrossel: '10 slides de carrossel imagem: label + título em CAPS (máx 4 linhas) + body (2-3 frases densas) por slide + legenda',
    carrossel_video: '10 slides de carrossel vídeo: label + título em CAPS (máx 4 linhas, use \\n pra quebrar) + body (3-5 frases) por slide + legenda completa',
  }[formato] || 'post completo';

  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2500,
    system: `Você é o assistente de conteúdo do @homero.ads (Homero Zanichelli — Stage Mídia).
Tom: técnico, direto, premium. Sem enrolação. Português BR. Sem padrões de IA. Textos densos e específicos.
Nunca fabricar experiência pessoal não confirmada pelo usuário.`,
    messages: [{ role: 'user', content: `Tema: ${tema}\nÂngulo: ${angulo}\nFormato: ${formatoDesc}\n\nGere o conteúdo completo.` }],
  });

  return msg.content[0].text;
}

// ─── HANDLERS ───────────────────────────────────────────────────────────────

bot.start(async (ctx) => {
  if (!MY_CHAT_ID) {
    const envPath = path.join(ROOT, '.env');
    let env = fs.readFileSync(envPath, 'utf8');
    env = env.replace('TELEGRAM_CHAT_ID=', `TELEGRAM_CHAT_ID=${ctx.chat.id}`);
    fs.writeFileSync(envPath, env);
    console.log(`Chat ID registrado: ${ctx.chat.id}`);
  }

  await ctx.reply(
    `🤖 *Homero Squad Bot* — Online\n\nComandos disponíveis:`,
    { parse_mode: 'Markdown' }
  );
  await ctx.reply(
    `/pauta — Pesquisa do dia + 6 posts pra aprovar\n` +
    `/gerar — Gera um post avulso\n` +
    `/status — Estado atual\n` +
    `/help — Todos os comandos`,
    Markup.keyboard([
      ['📅 /pauta — Pauta do dia'],
      ['✍️ /gerar — Post avulso'],
      ['📊 /status'],
    ]).resize()
  );
});

// /help
bot.command('help', async (ctx) => {
  await ctx.reply(
    `*Comandos do bot:*\n\n` +
    `📅 /pauta — Busca notícias + referências e gera 6 posts do dia pra aprovar\n` +
    `✍️ /gerar — Gera um post avulso (você escolhe tema e formato)\n` +
    `✅ /aprovar N — Aprova o post N da pauta e gera o conteúdo completo\n` +
    `❌ /recusar N — Recusa o post N e pede substituição\n` +
    `📊 /status — Estado atual da sessão\n` +
    `🔄 /refazer — Refaz o último conteúdo gerado`,
    { parse_mode: 'Markdown' }
  );
});

// /status
bot.command('status', (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);
  ctx.reply(`Fase: ${s.fase}\nFormato atual: ${s.formato || '—'}\nPost atual: ${s.postAtual || '—'}`);
});

// /pauta — fluxo principal
bot.command('pauta', async (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);
  s.fase = 'buscando';

  await ctx.reply('🔍 Buscando notícias e posts de referência...');

  // Tentar ler cache do dia
  let referencias = null;
  const cacheFile = path.join(ROOT, '_contexto', 'referencias-do-dia.json');
  if (fs.existsSync(cacheFile)) {
    try {
      const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      const cacheDate = new Date(cache.gerado_em).toDateString();
      if (cacheDate === new Date().toDateString()) {
        referencias = cache;
        await ctx.reply('✅ Usando cache de hoje.');
      }
    } catch {}
  }

  // Se não tem cache, busca agora
  if (!referencias) {
    try {
      await ctx.reply('⏳ Coletando dados via Apify (pode demorar ~2min)...');
      execSync(`node ${path.join(ROOT, 'scripts/buscar-referencias.mjs')}`, { cwd: ROOT, stdio: 'ignore' });
      referencias = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    } catch (err) {
      await ctx.reply(`⚠️ Erro ao buscar dados: ${err.message}\nContinuando sem referências externas.`);
    }
  }

  // Envia resumo da pesquisa
  if (referencias) {
    let resumo = `📊 *PESQUISA DO DIA*\n\n`;

    if (referencias.posts_referencia?.length > 0) {
      resumo += `📱 *Posts em alta (48h):*\n`;
      referencias.posts_referencia.slice(0, 5).forEach(p => {
        resumo += `• @${p.perfil} — ${p.likes > 0 ? p.likes + ' likes' : ''}\n  ${p.caption.slice(0, 100)}...\n`;
      });
      resumo += '\n';
    }

    if (referencias.noticias?.length > 0) {
      resumo += `📰 *Notícias coletadas:*\n`;
      referencias.noticias.slice(0, 6).forEach(n => {
        resumo += `• ${n.titulo.slice(0, 70)}\n`;
      });
    }

    await sendLong(ctx, resumo, { parse_mode: 'Markdown' });
  }

  // Gera pauta
  await ctx.reply('📋 Gerando pauta do dia...');
  try {
    const pauta = await gerarPauta(referencias);
    s.pauta = pauta;
    s.fase = 'revisando_pauta';

    await sendLong(ctx, pauta);
    await ctx.reply(
      'Aprova a pauta ou quer trocar algum post?\n\n' +
      'Use /aprovar 1 pra gerar o conteúdo do post 1, ou manda feedback.',
      Markup.keyboard([
        ['✅ Aprovar tudo', '🔄 Refazer pauta'],
        ['📅 /pauta — Nova busca'],
      ]).resize()
    );
  } catch (err) {
    s.fase = 'idle';
    await ctx.reply(`❌ Erro ao gerar pauta: ${err.message}`);
  }
});

// /aprovar N
bot.command('aprovar', async (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);

  if (!s.pauta) return ctx.reply('Rode /pauta primeiro.');

  const n = parseInt(ctx.message.text.split(' ')[1]);
  if (!n || n < 1 || n > 6) return ctx.reply('Use: /aprovar 1 a 6');

  s.postAtual = n;
  s.fase = 'gerando';

  // Extrai o post N da pauta
  const linhas = s.pauta.split('\n');
  const postIdx = linhas.findIndex(l => l.includes(`POST ${n} |`));
  const postLines = linhas.slice(postIdx, postIdx + 5).join('\n');

  // Detecta formato
  let formato = 'feed';
  if (postLines.includes('CARROSSEL VÍDEO') || postLines.includes('📱')) formato = 'carrossel_video';
  else if (postLines.includes('CARROSSEL IMAGEM') || postLines.includes('🖼')) formato = 'carrossel';

  s.formato = formato;

  const tema = (postLines.match(/Tema:\s*(.+)/) || [])[1] || 'tema do post';
  const angulo = (postLines.match(/Ângulo:\s*(.+)/) || [])[1] || '';

  await ctx.reply(`⏳ Gerando Post ${n} (${formato})...\nTema: ${tema}`);

  try {
    const conteudo = await gerarConteudoPost(tema, angulo, formato);
    s.draft = conteudo;
    s.fase = 'revisando_post';

    await sendLong(ctx, `📝 *Post ${n} — ${formato.toUpperCase()}*\n\n${conteudo}`, { parse_mode: 'Markdown' });
    await ctx.reply(
      'Aprova esse conteúdo?',
      Markup.keyboard([
        ['✅ Publica', '🔄 Refazer'],
        [`⬅️ Post ${n > 1 ? n - 1 : 1}`, `➡️ Post ${n < 6 ? n + 1 : 6}`],
      ]).resize()
    );
  } catch (err) {
    s.fase = 'revisando_pauta';
    await ctx.reply(`❌ Erro: ${err.message}`);
  }
});

// /gerar — post avulso
bot.command('gerar', async (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);
  s.fase = 'aguardando_tema';

  await ctx.reply(
    'Qual o formato?',
    Markup.keyboard([
      ['📱 Carrossel Vídeo', '🖼 Carrossel Imagem'],
      ['📸 Feed'],
    ]).resize()
  );
});

// Seleção de formato via teclado
bot.hears(['📱 Carrossel Vídeo', '🖼 Carrossel Imagem', '📸 Feed'], (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);
  const mapa = {
    '📱 Carrossel Vídeo': 'carrossel_video',
    '🖼 Carrossel Imagem': 'carrossel',
    '📸 Feed': 'feed',
  };
  s.formato = mapa[ctx.message.text];
  s.fase = 'aguardando_tema';
  ctx.reply(`Formato: *${ctx.message.text}*\nManda o tema ou notícia:`, { parse_mode: 'Markdown' });
});

// Aprovar tudo
bot.hears('✅ Aprovar tudo', async (ctx) => {
  if (!isAuthorized(ctx)) return;
  ctx.reply('Ótimo! Use /aprovar 1 pra começar a gerar os posts em ordem.');
});

// Refazer pauta
bot.hears('🔄 Refazer pauta', async (ctx) => {
  if (!isAuthorized(ctx)) return;
  ctx.reply('Rodando /pauta novamente...');
  ctx.message.text = '/pauta';
  bot.handleUpdate({ ...ctx.update, message: { ...ctx.message, text: '/pauta' } });
});

// Publica
bot.hears('✅ Publica', async (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);
  if (s.fase !== 'revisando_post') return ctx.reply('Nenhum draft pra publicar.');

  s.fase = 'publicando';
  await ctx.reply('📤 Publicando...');

  try {
    if (s.formato === 'carrossel_video') {
      execSync(`node ${path.join(ROOT, 'scripts/publish-multiplatform.mjs')}`, { cwd: ROOT });
    }
    await ctx.reply('✅ Publicado em Instagram, Threads, Facebook e LinkedIn!');
  } catch (err) {
    await ctx.reply(`❌ Erro: ${err.message}`);
  }

  s.fase = 'revisando_pauta';
  const prox = (s.postAtual || 0) + 1;
  if (prox <= 6) {
    await ctx.reply(`Próximo: /aprovar ${prox}`);
  }
});

// Refazer post
bot.hears('🔄 Refazer', async (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);
  if (!s.postAtual) return ctx.reply('Nenhum post em andamento.');
  ctx.reply(`Refazendo post ${s.postAtual}... Manda um feedback ou deixa em branco:`);
  s.fase = 'aguardando_feedback';
});

// Texto livre — tema ou feedback
bot.on('text', async (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);
  const texto = ctx.message.text;

  // Ignora comandos e botões
  if (texto.startsWith('/') || ['✅ Publica', '🔄 Refazer', '✅ Aprovar tudo', '🔄 Refazer pauta', '📅 /pauta — Nova busca'].includes(texto)) return;

  if (s.fase === 'aguardando_tema' && s.formato) {
    s.fase = 'gerando';
    await ctx.reply(`⏳ Gerando ${s.formato}...`);
    try {
      const conteudo = await gerarConteudoPost(texto, '', s.formato);
      s.draft = conteudo;
      s.fase = 'revisando_post';
      await sendLong(ctx, conteudo);
      await ctx.reply('Como ficou?', Markup.keyboard([['✅ Publica', '🔄 Refazer']]).resize());
    } catch (err) {
      s.fase = 'idle';
      await ctx.reply(`❌ Erro: ${err.message}`);
    }
    return;
  }

  if (s.fase === 'aguardando_feedback' && s.postAtual) {
    s.fase = 'gerando';
    const pauta = s.pauta || '';
    const linhas = pauta.split('\n');
    const postIdx = linhas.findIndex(l => l.includes(`POST ${s.postAtual} |`));
    const postLines = linhas.slice(postIdx, postIdx + 5).join('\n');
    const tema = (postLines.match(/Tema:\s*(.+)/) || [])[1] || 'tema';
    const angulo = texto; // feedback vira o novo ângulo

    await ctx.reply('⏳ Refazendo...');
    try {
      const conteudo = await gerarConteudoPost(tema, angulo, s.formato);
      s.draft = conteudo;
      s.fase = 'revisando_post';
      await sendLong(ctx, conteudo);
      await ctx.reply('Como ficou?', Markup.keyboard([['✅ Publica', '🔄 Refazer']]).resize());
    } catch (err) {
      s.fase = 'idle';
      await ctx.reply(`❌ Erro: ${err.message}`);
    }
    return;
  }

  // Estado idle — sugerir o que fazer
  if (s.fase === 'idle' || !s.fase) {
    await ctx.reply(
      'Use /pauta pra ver a pauta do dia ou /gerar pra criar um post avulso.',
      Markup.keyboard([
        ['📅 /pauta — Pauta do dia'],
        ['✍️ /gerar — Post avulso'],
      ]).resize()
    );
  }
});

bot.launch();
console.log('🤖 Homero Squad Bot — Online');
console.log(`Chat autorizado: ${MY_CHAT_ID || 'qualquer (configure TELEGRAM_CHAT_ID)'}`);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
