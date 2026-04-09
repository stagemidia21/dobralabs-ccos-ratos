import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import { execSync, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MY_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!BOT_TOKEN) {
  console.error('Falta TELEGRAM_BOT_TOKEN no .env');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

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

// ─── CLAUDE CLI (OAuth — sem custo de API) ──────────────────────────────────

const CLAUDE_BIN = process.platform === 'win32'
  ? path.join(process.env.USERPROFILE || 'C:/Users/homer', '.local/bin/claude.exe')
  : '/home/' + (process.env.USER || 'homer') + '/.local/bin/claude';

function callClaude(prompt, timeout = 120000) {
  return execFileSync(CLAUDE_BIN, ['-p', prompt], {
    cwd: ROOT,
    timeout,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 5,
  }).trim();
}

function humanizar(texto, contexto = '') {
  const prompt = `Editor de conteúdo do @homero.ads. Tom: técnico, direto, sem coach, sem papo motivacional.
${contexto ? `Contexto: ${contexto}\n` : ''}
Texto:
---
${texto}
---
Reescreva eliminando padrões de IA: sem "crucial/vital/pivotal/landscape/underscore/testament/enhance/foster/showcase", sem "não é só X é Y", sem rule of three forçado, sem em-dash em excesso, sem bullets desnecessários. Máximo 5 hashtags. Frases curtas e diretas. Varie o ritmo. Primeira pessoa quando couber. Entregue APENAS o texto reescrito.`;
  return callClaude(prompt, 180000);
}

// ─── GERAÇÃO DE CONTEÚDO ────────────────────────────────────────────────────

function gerarPauta(referencias) {
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });

  const refsTexto = referencias
    ? `\nPOSTS EM ALTA:\n${referencias.posts_referencia.map(p =>
        `@${p.perfil}: ${p.caption.slice(0, 150)}`
      ).join('\n')}\n\nNOTÍCIAS:\n${referencias.noticias.map(n =>
        `• ${n.titulo}`
      ).join('\n')}`
    : '';

  const prompt = `Assistente de pauta do @homero.ads (Stage Mídia). Linha editorial: Claude Code OS — IA aplicada a negócios e tráfego pago. Tom: técnico, direto.
Hoje: ${hoje}
${refsTexto}

Gere APENAS a pauta com 6 posts (sem texto antes ou depois):

POST 1 | FEED
Tema: ...
Ângulo: ...
Fonte: ...

POST 2 | CARROSSEL IMAGEM
Tema: ...
Ângulo: ...
Fonte: ...

POST 3 | CARROSSEL VÍDEO
Tema: ...
Ângulo: ...
Fonte: ...

POST 4 | FEED
Tema: ...
Ângulo: ...
Fonte: ...

POST 5 | CARROSSEL IMAGEM
Tema: ...
Ângulo: ...
Fonte: ...

POST 6 | CARROSSEL VÍDEO
Tema: ...
Ângulo: ...
Fonte: ...

Regras: pelo menos 1 Claude Code, pelo menos 1 notícia do dia, ângulos diferentes dos concorrentes.`;

  return callClaude(prompt);
}

function gerarConteudoPost(tema, angulo, formato) {
  const formatoDesc = {
    feed: 'post de feed Instagram: 200-300 palavras, primeira pessoa, CTA direto, exatamente 5 hashtags',
    carrossel: '10 slides de carrossel imagem: SLIDE N — Label + Título CAPS (máx 4 linhas) + Body (2-3 frases). Ao final: LEGENDA + 5 hashtags.',
    carrossel_video: '10 slides de carrossel vídeo: SLIDE N — Label + Título CAPS (\\n pra quebrar) + Body (3-5 frases). Ao final: LEGENDA + 5 hashtags.',
  }[formato] || 'post completo';

  const prompt = `Conteúdo do @homero.ads (Stage Mídia). Tom: técnico, direto, sem enrolação. Português BR. Sem padrões de IA. Primeira pessoa. Nunca fabricar experiência não confirmada.

Tema: ${tema}
Ângulo: ${angulo}
Formato: ${formatoDesc}

Gere o conteúdo completo. Sem preâmbulo.`;

  const rascunho = callClaude(prompt, 180000);
  return humanizar(rascunho, `Post ${formato}: ${tema}`);
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

  await ctx.reply(`🤖 *Homero Squad Bot* — Online`, { parse_mode: 'Markdown' });
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

bot.command('help', async (ctx) => {
  await ctx.reply(
    `*Comandos do bot:*\n\n` +
    `📅 /pauta — Busca notícias + referências e gera 6 posts do dia\n` +
    `✍️ /gerar — Gera um post avulso\n` +
    `✅ /aprovar N — Gera conteúdo do post N\n` +
    `❌ /recusar N — Recusa e pede substituição\n` +
    `📊 /status — Estado atual\n` +
    `🔄 /refazer — Refaz o último post`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('status', (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);
  ctx.reply(`Fase: ${s.fase}\nFormato: ${s.formato || '—'}\nPost atual: ${s.postAtual || '—'}`);
});

// /pauta — fluxo principal
bot.command('pauta', async (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);
  s.fase = 'buscando';

  await ctx.reply('🔍 Buscando notícias e posts de referência...');

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

  if (!referencias) {
    try {
      await ctx.reply('⏳ Coletando dados via Apify (~2min)...');
      execSync(`node ${path.join(ROOT, 'scripts/buscar-referencias.mjs')}`, { cwd: ROOT, stdio: 'ignore' });
      referencias = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    } catch (err) {
      await ctx.reply(`⚠️ Erro ao buscar dados: ${err.message}\nContinuando sem referências externas.`);
    }
  }

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

  await ctx.reply('📋 Gerando pauta do dia...');
  try {
    const pauta = await gerarPauta(referencias);
    s.pauta = pauta;
    s.referencias = referencias;
    s.fase = 'revisando_pauta';

    await sendLong(ctx, pauta);
    await ctx.reply(
      'Aprova a pauta ou quer trocar algum?\n\n' +
      '• /aprovar 1 — gera post 1\n' +
      '• "✅ Aprovar tudo" — gera e manda todos os 6 em sequência',
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

  await gerarPost(ctx, s, n);
});

async function gerarPost(ctx, s, n) {
  s.postAtual = n;
  s.fase = 'gerando';

  const linhas = s.pauta.split('\n');
  const postIdx = linhas.findIndex(l => l.match(new RegExp(`POST ${n}\\s*\\|`)));
  const postLines = linhas.slice(postIdx, postIdx + 6).join('\n');

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
      'Aprova?',
      Markup.keyboard([
        ['✅ Publica', '🔄 Refazer'],
        [`⬅️ Post ${n > 1 ? n - 1 : 1}`, `➡️ Post ${n < 6 ? n + 1 : 6}`],
      ]).resize()
    );
  } catch (err) {
    s.fase = 'revisando_pauta';
    await ctx.reply(`❌ Erro: ${err.message}`);
  }
}

// /gerar — post avulso
bot.command('gerar', async (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);
  s.fase = 'aguardando_formato';

  await ctx.reply(
    'Qual o formato?',
    Markup.keyboard([
      ['📱 Carrossel Vídeo', '🖼 Carrossel Imagem'],
      ['📸 Feed'],
    ]).resize()
  );
});

// Seleção de formato
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

// Aprovar tudo — gera todos os 6 em sequência
bot.hears('✅ Aprovar tudo', async (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);
  if (!s.pauta) return ctx.reply('Rode /pauta primeiro.');

  await ctx.reply('🚀 Gerando todos os 6 posts em sequência... (pode demorar alguns minutos)');

  const drafts = [];
  for (let n = 1; n <= 6; n++) {
    const linhas = s.pauta.split('\n');
    const postIdx = linhas.findIndex(l => l.match(new RegExp(`POST ${n}\\s*\\|`)));
    const postLines = linhas.slice(postIdx, postIdx + 6).join('\n');

    let formato = 'feed';
    if (postLines.includes('CARROSSEL VÍDEO') || postLines.includes('📱')) formato = 'carrossel_video';
    else if (postLines.includes('CARROSSEL IMAGEM') || postLines.includes('🖼')) formato = 'carrossel';

    const tema = (postLines.match(/Tema:\s*(.+)/) || [])[1] || 'tema';
    const angulo = (postLines.match(/Ângulo:\s*(.+)/) || [])[1] || '';

    await ctx.reply(`⏳ Post ${n}/6 — ${tema}`);

    try {
      const conteudo = await gerarConteudoPost(tema, angulo, formato);
      drafts.push({ n, tema, formato, conteudo });
      await sendLong(ctx, `📝 *Post ${n} — ${formato.toUpperCase()}*\n\n${conteudo}`, { parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply(`❌ Post ${n} falhou: ${err.message}`);
      drafts.push({ n, tema, formato, conteudo: null, erro: err.message });
    }
  }

  s.todos_drafts = drafts;
  s.fase = 'revisando_pauta';

  const ok = drafts.filter(d => d.conteudo).length;
  await ctx.reply(
    `✅ ${ok}/6 posts gerados!\n\n` +
    `Os conteúdos estão acima. Revise e use /aprovar N pra ajustar algum individualmente.`,
    Markup.keyboard([
      ['📅 /pauta — Nova busca'],
      ['✍️ /gerar — Post avulso'],
    ]).resize()
  );
});

// Refazer pauta
bot.hears('🔄 Refazer pauta', async (ctx) => {
  if (!isAuthorized(ctx)) return;
  await ctx.reply('♻️ Refazendo pauta...');
  const s = getState(ctx.chat.id);
  s.pauta = null;
  s.fase = 'idle';
  // Re-trigger /pauta
  await gerarEEnviarPauta(ctx, s);
});

async function gerarEEnviarPauta(ctx, s) {
  s.fase = 'revisando_pauta';
  try {
    const pauta = await gerarPauta(s.referencias || null);
    s.pauta = pauta;
    await sendLong(ctx, pauta);
    await ctx.reply(
      'Aprova ou quer trocar algum?',
      Markup.keyboard([
        ['✅ Aprovar tudo', '🔄 Refazer pauta'],
      ]).resize()
    );
  } catch (err) {
    s.fase = 'idle';
    await ctx.reply(`❌ Erro: ${err.message}`);
  }
}

// Publica
bot.hears('✅ Publica', async (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);
  if (s.fase !== 'revisando_post') return ctx.reply('Nenhum draft pra publicar. Use /aprovar N primeiro.');

  s.fase = 'publicando';
  await ctx.reply('📤 Publicando...');

  try {
    if (s.formato === 'carrossel_video') {
      execSync(`node ${path.join(ROOT, 'scripts/publish-multiplatform.mjs')}`, { cwd: ROOT });
    }
    await ctx.reply('✅ Publicado em Instagram, Threads, Facebook e LinkedIn!');
  } catch (err) {
    await ctx.reply(`❌ Erro na publicação: ${err.message}`);
  }

  s.fase = 'revisando_pauta';
  const prox = (s.postAtual || 0) + 1;
  if (prox <= 6) {
    await ctx.reply(
      `Próximo: Post ${prox}`,
      Markup.keyboard([
        [`✅ Gerar Post ${prox}`, '⏭ Pular'],
        ['📅 /pauta — Nova busca'],
      ]).resize()
    );
  } else {
    await ctx.reply('🎉 Todos os 6 posts do dia concluídos!');
  }
});

// Navegar entre posts
bot.hears(/^[➡️⬅️] Post (\d)$/, async (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);
  const match = ctx.message.text.match(/Post (\d)/);
  if (match) await gerarPost(ctx, s, parseInt(match[1]));
});

bot.hears(/^✅ Gerar Post (\d)$/, async (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);
  const match = ctx.message.text.match(/Post (\d)/);
  if (match) await gerarPost(ctx, s, parseInt(match[1]));
});

// Refazer post
bot.hears('🔄 Refazer', async (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);
  if (!s.postAtual) return ctx.reply('Nenhum post em andamento.');
  s.fase = 'aguardando_feedback';
  ctx.reply(`Manda o feedback pro Post ${s.postAtual} (ou deixa em branco pra refazer igual):`);
});

// Pular
bot.hears('⏭ Pular', async (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);
  const prox = (s.postAtual || 0) + 1;
  if (prox <= 6) {
    await gerarPost(ctx, s, prox);
  } else {
    await ctx.reply('🎉 Todos os posts do dia concluídos!');
  }
});

// Texto livre
bot.on('text', async (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);
  const texto = ctx.message.text;

  const botoes = ['✅ Publica', '🔄 Refazer', '✅ Aprovar tudo', '🔄 Refazer pauta',
    '📅 /pauta — Nova busca', '⏭ Pular', '📊 /status'];
  if (texto.startsWith('/') || botoes.includes(texto) || texto.match(/^[➡️⬅️✅] Post \d$/)) return;

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
    const linhas = (s.pauta || '').split('\n');
    const postIdx = linhas.findIndex(l => l.match(new RegExp(`POST ${s.postAtual}\\s*\\|`)));
    const postLines = linhas.slice(postIdx, postIdx + 6).join('\n');
    const tema = (postLines.match(/Tema:\s*(.+)/) || [])[1] || 'tema';

    await ctx.reply('⏳ Refazendo...');
    try {
      const conteudo = await gerarConteudoPost(tema, texto, s.formato);
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
console.log('🤖 Homero Squad Bot — Online (Claude CLI)');
console.log(`Chat autorizado: ${MY_CHAT_ID || 'qualquer (configure TELEGRAM_CHAT_ID)'}`);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
