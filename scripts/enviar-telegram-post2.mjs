import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SLIDES_DIR = '/home/user/dobralabs-ccos-ratos/projetos/carrossel-remotion/out/post2';

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não definidos');
  process.exit(1);
}

const CLAUDE_BIN = '/opt/node22/bin/claude';
const prompt = `Você é o criador de conteúdo do @homero.ads — Homero Zanichelli, fundador da Stage Mídia.
Tom: técnico, direto, primeira pessoa quando natural. Português BR.

Tema: Seu gestor de tráfego está otimizando pra métrica errada no Meta.
Ângulo: Comparar campanha otimizada por CPL vs campanha otimizada por LTV (com dado de compra via Conversions API + IA de scoring). Mostrar caso onde CPL sobe 18% e receita sobe 41% — empresário que olha só o custo do lead está perdendo dinheiro todo dia.

Gere APENAS a legenda para Instagram (200-300 palavras, primeira pessoa, contextualiza o tema, termina com CTA claro, exatamente 5 hashtags no final). Sem JSON, só o texto puro da legenda.`;

console.log('Gerando legenda via Claude...');
let legenda;
try {
  legenda = execFileSync(CLAUDE_BIN, ['-p', prompt], {
    cwd: '/tmp', timeout: 60000, encoding: 'utf8', maxBuffer: 1024 * 1024 * 2,
  }).trim();
  console.log('Legenda gerada:', legenda.slice(0, 80) + '...');
} catch(e) {
  legenda = 'Seu gestor de tráfego pode estar otimizando pra métrica errada no Meta. CPL baixo não significa mais receita — veja o carrossel. #trafegopago #meta #marketingdigital #ia #stagemidia';
  console.log('Legenda de fallback usada');
}

async function sendMessage(text) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text }),
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

const slides = fs.readdirSync(SLIDES_DIR).filter(f => f.endsWith('.jpg')).sort()
  .map(f => path.join(SLIDES_DIR, f));

console.log(`Enviando ${slides.length} slides para o Telegram...`);

await sendMessage(`⚠️ Post das 12h — PUBLICAÇÃO BLOQUEADA\n\nO PostForMe está rejeitando requisições deste host com "Host not in allowlist" (bloqueio de IP).\n\nTema: "Seu gestor de tráfego está otimizando pra métrica errada no Meta."\n\nOs ${slides.length} slides foram gerados com sucesso. Enviando abaixo para revisão manual.`);

const BATCH = 10;
for (let i = 0; i < slides.length; i += BATCH) {
  const batch = slides.slice(i, i + BATCH);
  const caption = i === 0 ? legenda : '';
  const res = await sendMediaGroup(batch, caption);
  if (res.ok) {
    console.log(`✓ Grupo ${Math.floor(i / BATCH) + 1} enviado`);
  } else {
    console.error(`Erro ao enviar grupo: ${JSON.stringify(res)}`);
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

await sendMessage(`📝 LEGENDA PRONTA (Post 12h):\n\n${legenda}`);
console.log('✅ Slides e legenda enviados ao Telegram!');
