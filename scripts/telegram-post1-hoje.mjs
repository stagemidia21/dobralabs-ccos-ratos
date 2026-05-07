/**
 * telegram-post1-hoje.mjs
 * Envia slides do post 1 de hoje para Telegram para publicação manual.
 * Usa a legenda já gerada em _contexto/legenda-post1.txt.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SLIDES_DIR = path.join(ROOT, 'projetos/carrossel-remotion/out/post1');
const LEGENDA_FILE = path.join(ROOT, '_contexto/legenda-post1.txt');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('✗ TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não definidos');
  process.exit(1);
}

const legenda = fs.readFileSync(LEGENDA_FILE, 'utf-8').trim();
const slides = fs.readdirSync(SLIDES_DIR)
  .filter(f => f.endsWith('.jpg'))
  .sort()
  .map(f => path.join(SLIDES_DIR, f));

console.log(`✓ ${slides.length} slides | legenda: ${legenda.slice(0, 60)}...`);

async function sendMessage(text) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' }),
  });
  return r.json();
}

async function sendMediaGroup(slideFiles, caption) {
  const form = new globalThis.FormData();
  const media = [];

  slideFiles.forEach((f, i) => {
    const fieldName = `photo${i}`;
    form.append(fieldName, new Blob([fs.readFileSync(f)], { type: 'image/jpeg' }), path.basename(f));
    const item = { type: 'photo', media: `attach://${fieldName}` };
    if (i === 0) item.caption = caption;
    media.push(item);
  });

  form.append('chat_id', String(CHAT_ID));
  form.append('media', JSON.stringify(media));

  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMediaGroup`, {
    method: 'POST',
    body: form,
  });
  return r.json();
}

// Aviso
await sendMessage(`⚠️ <b>Post das 7h — publicação automática bloqueada</b>\n\nO PostForMe bloqueou requisições desta máquina (IP não autorizado).\n\nSlides gerados com sucesso. Enviando para revisão manual.`);

// Envia slides em lote (máx 10 por grupo)
const BATCH = 10;
for (let i = 0; i < slides.length; i += BATCH) {
  const batch = slides.slice(i, i + BATCH);
  const caption = i === 0 ? legenda : '';
  const res = await sendMediaGroup(batch, caption);
  if (res.ok) {
    console.log(`✓ Grupo ${Math.floor(i / BATCH) + 1} enviado`);
  } else {
    console.error('Erro no grupo, enviando um a um...');
    for (const s of batch) {
      const form = new globalThis.FormData();
      form.append('chat_id', String(CHAT_ID));
      form.append('photo', new Blob([fs.readFileSync(s)], { type: 'image/jpeg' }), path.basename(s));
      const r2 = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, { method: 'POST', body: form });
      const d2 = await r2.json();
      console.log(`  ${path.basename(s)}: ${d2.ok ? 'OK' : JSON.stringify(d2)}`);
    }
  }
}

// Legenda separada para facilitar copiar
await sendMessage(`📝 <b>LEGENDA POST 1 — copie abaixo:</b>\n\n${legenda}`);

console.log('✅ Slides e legenda enviados ao Telegram!');
