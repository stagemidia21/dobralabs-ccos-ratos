import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import { execSync, execFileSync, spawn } from 'child_process';
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
  if (!state[id]) state[id] = { fase: 'idle', pauta: null, referencias: null };
  return state[id];
}

function isAuthorized(ctx) {
  if (!MY_CHAT_ID) return true;
  return String(ctx.chat.id) === String(MY_CHAT_ID);
}

async function sendLong(ctx, text, extra = {}) {
  const chunks = text.match(/[\s\S]{1,4000}/g) || [text];
  for (const chunk of chunks) await ctx.reply(chunk, extra);
}

// ─── CLAUDE CLI ──────────────────────────────────────────────────────────────

const CLAUDE_BIN = process.platform === 'win32'
  ? path.join(process.env.USERPROFILE || 'C:/Users/homer', '.local/bin/claude.exe')
  : '/home/' + (process.env.USER || 'homer') + '/.local/bin/claude';

function callClaude(prompt, timeout = 120000) {
  return execFileSync(CLAUDE_BIN, ['-p', prompt], {
    cwd: ROOT, timeout, encoding: 'utf8', maxBuffer: 1024 * 1024 * 5,
  }).trim();
}

// ─── PAUTA ───────────────────────────────────────────────────────────────────

function gerarPauta(referencias) {
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
  const refsTexto = referencias
    ? `\nPOSTS EM ALTA:\n${referencias.posts_referencia.map(p =>
        `@${p.perfil}: ${p.caption.slice(0, 150)}`
      ).join('\n')}\n\nNOTÍCIAS:\n${referencias.noticias.map(n => `• ${n.titulo}`).join('\n')}`
    : '';

  const prompt = `Pauta do @homero.ads (Stage Mídia). Linha editorial: IA aplicada a negócios, tráfego pago, automação para empresários. Tom: técnico, direto, sem coach.
Hoje: ${hoje}
${refsTexto}

Gere EXATAMENTE 3 CARROSSEIS VÍDEO — os 3 melhores do dia. Sem feed, sem story.

POST 1 | CARROSSEL VÍDEO — 7h
Tema: [max 80 chars]
Ângulo: [abordagem específica, max 200 chars]
Fonte: [veículo e data ou "Stage Mídia"]

POST 2 | CARROSSEL VÍDEO — 12h
Tema: ...
Ângulo: ...
Fonte: ...

POST 3 | CARROSSEL VÍDEO — 18h
Tema: ...
Ângulo: ...
Fonte: ...

Regras: ângulos diferentes entre si, pelo menos 1 baseado em notícia do dia, foco em resultado prático para empresário.`;

  return callClaude(prompt, 120000);
}

function parsePauta(pauta) {
  const HORARIOS = [7, 12, 18];
  const posts = [];
  for (let n = 1; n <= 3; n++) {
    const linhas = pauta.split('\n');
    const idx = linhas.findIndex(l => l.match(new RegExp(`POST ${n}\\s*\\|`)));
    if (idx === -1) continue;
    const bloco = linhas.slice(idx, idx + 8).join('\n');
    const tema   = (bloco.match(/Tema:\s*(.+)/) || [])[1]?.trim() || `Post ${n}`;
    const angulo = (bloco.match(/Ângulo:\s*(.+)/) || [])[1]?.trim() || '';
    const fonte  = (bloco.match(/Fonte:\s*(.+)/) || [])[1]?.trim() || 'Stage Mídia';
    posts.push({ n, tema, angulo, fonte, hora: HORARIOS[n - 1] });
  }
  return posts;
}

// ─── EXECUTA CARROSSEL VÍA gerar-e-publicar.mjs (em background) ──────────────

function rodarCarrossel(n, tema, angulo, fonte = '') {
  const script = path.join(ROOT, 'scripts/gerar-e-publicar.mjs');
  const args = [script, '--tema', tema, '--angulo', angulo, '--num', String(n)];
  if (fonte) args.push('--fonte', fonte);
  const proc = spawn('node', args, { cwd: ROOT, stdio: 'ignore', detached: true });
  proc.unref();
}

// ─── HANDLERS ────────────────────────────────────────────────────────────────

bot.start(async (ctx) => {
  if (!MY_CHAT_ID) {
    const envPath = path.join(ROOT, '.env');
    let env = fs.readFileSync(envPath, 'utf8');
    env = env.replace('TELEGRAM_CHAT_ID=', `TELEGRAM_CHAT_ID=${ctx.chat.id}`);
    fs.writeFileSync(envPath, env);
    console.log(`Chat ID registrado: ${ctx.chat.id}`);
  }
  await ctx.reply(
    `🤖 *Homero Squad Bot* — Online\n\n📅 /pauta — pauta do dia (6 carrosseis)\n📸 /story <tema> — story\n📊 /status`,
    { parse_mode: 'Markdown',
      ...Markup.keyboard([['📅 /pauta — Pauta do dia'], ['📸 /story'], ['📊 /status']]).resize() }
  );
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    `*Comandos:*\n\n` +
    `📅 /pauta — Busca referências + gera 6 carrosseis vídeo\n` +
    `✅ /aprovar N — Roda o carrossel N (render + publica)\n` +
    `📸 /story <tema> — Gera e publica um story\n` +
    `🔄 /refazer — Regera a pauta\n` +
    `📊 /status — Estado atual`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('status', (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);
  ctx.reply(`Fase: ${s.fase}\nPauta: ${s.pauta ? 'carregada' : 'nenhuma'}`);
});

// /pauta — fluxo principal
bot.command('pauta', async (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);
  s.fase = 'buscando';

  await ctx.reply('🔍 Buscando referências...');

  let referencias = null;
  const cacheFile = path.join(ROOT, '_contexto', 'referencias-do-dia.json');
  if (fs.existsSync(cacheFile)) {
    try {
      const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (new Date(cache.gerado_em).toDateString() === new Date().toDateString()) {
        referencias = cache;
      }
    } catch {}
  }

  if (!referencias) {
    try {
      await ctx.reply('⏳ Coletando via Apify (~2min)...');
      execSync(`node ${path.join(ROOT, 'scripts/buscar-referencias.mjs')}`, { cwd: ROOT, stdio: 'ignore', timeout: 180000 });
      referencias = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    } catch {
      await ctx.reply('⚠️ Sem dados externos. Gerando pauta sem referências.');
    }
  }

  if (referencias?.posts_referencia?.length > 0) {
    let resumo = `📊 *Posts em alta:*\n`;
    referencias.posts_referencia.slice(0, 4).forEach(p => {
      resumo += `• @${p.perfil}: ${p.caption.slice(0, 80)}...\n`;
    });
    await sendLong(ctx, resumo, { parse_mode: 'Markdown' });
  }

  await ctx.reply('📋 Gerando pauta...');
  try {
    const pauta = gerarPauta(referencias);
    s.pauta = pauta;
    s.referencias = referencias;
    s.posts = parsePauta(pauta);
    s.fase = 'revisando_pauta';

    await sendLong(ctx, pauta);
    await ctx.reply(
      `Aprova? Use /aprovar N pra rodar um post ou "✅ Aprovar tudo" pra rodar os 3.\n\nCada post: Claude gera → Remotion renderiza → publica em todas as redes.`,
      Markup.keyboard([
        ['✅ Aprovar tudo', '🔄 Refazer pauta'],
        ['/aprovar 1', '/aprovar 2', '/aprovar 3'],
      ]).resize()
    );
  } catch (err) {
    s.fase = 'idle';
    await ctx.reply(`❌ Erro ao gerar pauta: ${err.message}`);
  }
});

// /aprovar N — roda o carrossel via gerar-e-publicar.mjs
bot.command('aprovar', async (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);
  if (!s.pauta || !s.posts?.length) return ctx.reply('Rode /pauta primeiro.');

  const n = parseInt(ctx.message.text.split(' ')[1]);
  if (!n || n < 1 || n > 3) return ctx.reply('Use: /aprovar 1, 2 ou 3');

  const post = s.posts.find(p => p.n === n);
  if (!post) return ctx.reply(`Post ${n} não encontrado na pauta.`);

  await ctx.reply(
    `🎬 Post ${n} (${post.hora}h) em produção:\n${post.tema}\n\nRodando Remotion... ~5-8min.`
  );

  rodarCarrossel(n, post.tema, post.angulo, post.fonte || '');
});

// Aprovar tudo — dispara os 3 em sequência no background
bot.hears('✅ Aprovar tudo', async (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);
  if (!s.pauta || !s.posts?.length) return ctx.reply('Rode /pauta primeiro.');

  await ctx.reply(
    `🚀 Disparando os 3 carrosseis em produção.\n\nCada um notifica aqui quando publicar. ~15-20min no total.`,
    Markup.keyboard([['📅 /pauta — Nova busca'], ['📊 /status']]).resize()
  );

  setImmediate(async () => {
    for (const post of s.posts) {
      rodarCarrossel(post.n, post.tema, post.angulo, post.fonte || '');
      await new Promise(r => setTimeout(r, 5000));
    }
  });
});

// Refazer pauta
bot.hears('🔄 Refazer pauta', async (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);
  s.pauta = null;
  s.posts = null;
  await ctx.reply('♻️ Refazendo pauta...');
  try {
    const pauta = gerarPauta(s.referencias || null);
    s.pauta = pauta;
    s.posts = parsePauta(pauta);
    s.fase = 'revisando_pauta';
    await sendLong(ctx, pauta);
    await ctx.reply(
      'Nova pauta gerada. /aprovar N pra rodar.',
      Markup.keyboard([
        ['✅ Aprovar tudo', '🔄 Refazer pauta'],
        ['/aprovar 1', '/aprovar 2', '/aprovar 3'],
      ]).resize()
    );
  } catch (err) {
    await ctx.reply(`❌ Erro: ${err.message}`);
  }
});

// /story <tema>
bot.command('story', async (ctx) => {
  if (!isAuthorized(ctx)) return;
  const tema = ctx.message.text.replace('/story', '').trim();
  if (!tema) {
    await ctx.reply('Informe o tema:\n/story planos Stage Mídia — o que está incluído');
    return;
  }
  await ctx.reply(`📸 Story em produção...\n${tema}\n\n⏳ ~3-5min (render + upload)`);
  const script = path.join(ROOT, 'scripts/gerar-story.mjs');
  const proc = spawn('node', [script, tema], { cwd: ROOT, stdio: 'ignore', detached: true });
  proc.unref();
});

// Texto livre
bot.on('text', async (ctx) => {
  if (!isAuthorized(ctx)) return;
  const texto = ctx.message.text;
  if (texto.startsWith('/') || ['✅ Aprovar tudo', '🔄 Refazer pauta', '📅 /pauta — Pauta do dia', '📊 /status', '📸 /story'].includes(texto)) return;
  await ctx.reply(
    'Use /pauta pra gerar a pauta do dia ou /aprovar N pra rodar um post específico.',
    Markup.keyboard([['📅 /pauta — Pauta do dia'], ['📊 /status']]).resize()
  );
});

bot.launch();
console.log('🤖 Homero Squad Bot — Online');
console.log(`Chat autorizado: ${MY_CHAT_ID || 'qualquer'}`);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
