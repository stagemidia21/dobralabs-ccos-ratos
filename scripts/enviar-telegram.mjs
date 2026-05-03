import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SLIDES_DIR = '/home/user/dobralabs-ccos-ratos/projetos/carrossel-remotion/out/post1';

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não definidos');
  process.exit(1);
}

// Gera legenda via Claude
console.log('Gerando legenda via Claude...');
const CLAUDE_BIN = '/opt/node22/bin/claude';
const prompt = `Você é o criador de conteúdo do @homero.ads — Homero Zanichelli, fundador da Stage Mídia.
Tom: técnico, direto, primeira pessoa quando natural. Português BR.

Tema: Claude Code não é só pra dev — é pra quem opera negócio
Ângulo: Mostrar o lado do gestor/dono de agência: usar pra redigir proposta, montar relatório, criar SOP, automatizar briefing. Claude Code como sistema operacional do negócio, não do código.

Gere APENAS a legenda para Instagram (200-300 palavras, primeira pessoa, contextualiza o tema, termina com CTA claro, exatamente 5 hashtags no final). Sem JSON, só o texto puro da legenda.`;

let legenda;
try {
  legenda = execFileSync(CLAUDE_BIN, ['-p', prompt], {
    cwd: '/tmp', timeout: 60000, encoding: 'utf8', maxBuffer: 1024 * 1024 * 2,
  }).trim();
  console.log('Legenda gerada:', legenda.slice(0, 80) + '...');
} catch(e) {
  legenda = 'Claude Code não é só pra dev — é pra quem opera negócio. Veja o carrossel completo. #claudecode #ia #marketing #agencia #trafegopago';
  console.log('Legenda de fallback usada');
}

// Envia aviso de erro
async function sendMessage(text) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text }),
  });
  return r.json();
}

// Envia slides como media group
async function sendMediaGroup(slideFiles, caption) {
  const FormData = (await import('node:buffer')).Buffer;
  
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

// Aviso de bloqueio
await sendMessage(`⚠️ Post das 7h — PUBLICAÇÃO BLOQUEADA\n\nO PostForMe está rejeitando requisições deste host com "Host not in allowlist" (bloqueio de IP).\n\nOs 10 slides foram gerados com sucesso. Enviando abaixo para revisão manual.`);

// Envia em grupos de 10 (limite do Telegram)
const BATCH = 10;
for (let i = 0; i < slides.length; i += BATCH) {
  const batch = slides.slice(i, i + BATCH);
  const caption = i === 0 ? legenda : '';
  const res = await sendMediaGroup(batch, caption);
  if (res.ok) {
    console.log(`✓ Grupo ${Math.floor(i/BATCH)+1} enviado`);
  } else {
    console.error(`Erro ao enviar grupo: ${JSON.stringify(res)}`);
    // Fallback: envia uma por uma
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

// Envia legenda separada
await sendMessage(`📝 LEGENDA PRONTA:\n\n${legenda}`);

console.log('✅ Slides e legenda enviados ao Telegram!');
