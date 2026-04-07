import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MY_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!BOT_TOKEN) { console.error('TELEGRAM_BOT_TOKEN não definido'); process.exit(1); }
if (!ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY não definido'); process.exit(1); }

const bot = new Telegraf(BOT_TOKEN);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// Estado por sessão
const state = {};

function getState(chatId) {
  if (!state[chatId]) state[chatId] = { fase: 'idle', draft: null, formato: null };
  return state[chatId];
}

// Prompt de geração de conteúdo
async function gerarConteudo(input, formato) {
  const formatoDesc = {
    carrossel: '10 slides pra carrossel (título + body por slide, máx 10 slides)',
    feed: 'post de feed (1 imagem + legenda completa)',
    carrossel_video: '10 slides pra carrossel vídeo (label + título em CAPS + body por slide)',
  }[formato];

  const system = `Você é o assistente de conteúdo do @homero.ads (Homero Zanichelli, Stage Mídia).
Tom: técnico, direto, premium. Sem enrolação. Português BR.
Nunca fabricar experiência pessoal que o Homero não confirmou.
Sempre gerar copy que soa humano, sem padrões de IA.

Formato de saída: ${formatoDesc}

Ao final, inclua uma LEGENDA completa com hashtags.`;

  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2000,
    system,
    messages: [{ role: 'user', content: `Tema/notícia: ${input}\n\nGere o conteúdo completo.` }],
  });

  return msg.content[0].text;
}

// Segurança: só responde pro Homero
function isAuthorized(ctx) {
  if (!MY_CHAT_ID) return true; // se não configurou ainda, libera
  return String(ctx.chat.id) === String(MY_CHAT_ID);
}

// /start
bot.start((ctx) => {
  if (!MY_CHAT_ID) {
    // Salva o chat_id automaticamente na primeira vez
    const envPath = path.join(ROOT, '.env');
    let env = fs.readFileSync(envPath, 'utf8');
    env = env.replace('TELEGRAM_CHAT_ID=', `TELEGRAM_CHAT_ID=${ctx.chat.id}`);
    fs.writeFileSync(envPath, env);
    console.log(`Chat ID registrado: ${ctx.chat.id}`);
  }

  ctx.reply(
    `Oi Homero 👋\n\nManda uma notícia, link ou tema e eu gero o conteúdo.\n\nEscolhe o formato:`,
    Markup.keyboard([
      ['📱 Carrossel Vídeo', '🖼 Carrossel Imagem'],
      ['📸 Feed'],
    ]).resize()
  );
});

// /status
bot.command('status', (ctx) => {
  const s = getState(ctx.chat.id);
  ctx.reply(`Fase atual: ${s.fase}\nFormato: ${s.formato || '—'}`);
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
  ctx.reply(`Formato: *${ctx.message.text}*\n\nManda o tema, notícia ou link:`, { parse_mode: 'Markdown' });
});

// Aprovação
bot.hears([/^(ok|sim|publica|✅|aprova)/i], async (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);

  if (s.fase !== 'revisando') {
    return ctx.reply('Nenhum draft pra aprovar. Manda um tema primeiro.');
  }

  s.fase = 'publicando';
  await ctx.reply('Publicando em todas as plataformas...');

  try {
    // Publica via script existente (carrossel vídeo)
    if (s.formato === 'carrossel_video') {
      execSync(`node ${path.join(ROOT, 'scripts/publish-multiplatform.mjs')}`, {
        cwd: ROOT, stdio: 'inherit',
      });
    }
    await ctx.reply('✅ Publicado em Instagram, Threads, Facebook e LinkedIn!');
  } catch (err) {
    await ctx.reply(`❌ Erro ao publicar: ${err.message}`);
  }

  s.fase = 'idle';
  s.draft = null;
});

// Rejeição / feedback
bot.hears([/^(não|nao|refaz|ajusta|muda)/i], async (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);
  if (s.fase !== 'revisando') return;

  s.fase = 'aguardando_tema';
  ctx.reply('Ok. Manda o feedback ou um novo tema:');
});

// Mensagem de texto genérica = tema
bot.on('text', async (ctx) => {
  if (!isAuthorized(ctx)) return;
  const s = getState(ctx.chat.id);

  // Se não escolheu formato ainda
  if (!s.formato) {
    return ctx.reply(
      'Escolhe o formato primeiro:',
      Markup.keyboard([
        ['📱 Carrossel Vídeo', '🖼 Carrossel Imagem'],
        ['📸 Feed'],
      ]).resize()
    );
  }

  const tema = ctx.message.text;
  s.fase = 'gerando';

  const msg = await ctx.reply('⏳ Gerando conteúdo...');

  try {
    const draft = await gerarConteudo(tema, s.formato);
    s.draft = draft;
    s.fase = 'revisando';

    // Divide se muito longo pro Telegram (limite 4096 chars)
    const chunks = draft.match(/.{1,4000}/gs) || [draft];
    for (const chunk of chunks) {
      await ctx.reply(chunk);
    }

    await ctx.reply(
      'Como ficou?',
      Markup.keyboard([
        ['✅ Publica', '❌ Refaz'],
      ]).resize()
    );
  } catch (err) {
    s.fase = 'idle';
    await ctx.reply(`Erro: ${err.message}`);
  }
});

bot.launch();
console.log('🤖 Bot iniciado. Ctrl+C pra parar.');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
