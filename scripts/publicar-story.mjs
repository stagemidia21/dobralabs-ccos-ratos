/**
 * publicar-story.mjs
 * Publica PNGs de story no Instagram (e opcionalmente Threads e Facebook)
 *
 * Uso: node scripts/publicar-story.mjs <id-do-story> [--ig-only]
 * Ex:  node scripts/publicar-story.mjs story-planos-2026-04-08
 *
 * Lê PNGs de projetos/carrossel-remotion/out/stories/<id>/
 * Lê legenda de scripts/stories/<id>.json
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REMOTION_DIR = path.join(ROOT, 'projetos/carrossel-remotion');
const STORIES_DIR = path.join(__dirname, 'stories');

const API_KEY = process.env.POSTFORME_API_KEY;
const BASE_URL = 'https://api.postforme.dev';
const IG_USER_ID = '26285906407703501';
const IG_API = 'https://graph.instagram.com';
const THREADS_API = 'https://graph.threads.net';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const authHeaders = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

const storyId = process.argv[2];
const igOnly = process.argv.includes('--ig-only');

if (!storyId) {
  console.error('Uso: node scripts/publicar-story.mjs <id-do-story>');
  process.exit(1);
}

const dataFile = path.join(STORIES_DIR, `${storyId}.json`);
if (!fs.existsSync(dataFile)) {
  console.error(`Dados não encontrados: ${dataFile}`);
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const legenda = data.legenda || '';

const outDir = path.join(REMOTION_DIR, 'out', 'stories', storyId);
if (!fs.existsSync(outDir)) {
  console.error(`PNGs não encontrados em: ${outDir}`);
  console.error('Rode primeiro: node scripts/render-story.mjs ' + storyId);
  process.exit(1);
}

const pngs = fs.readdirSync(outDir).filter(f => f.endsWith('.png')).sort();
if (pngs.length === 0) {
  console.error('Nenhum PNG encontrado em ' + outDir);
  process.exit(1);
}

async function sendTelegram(text) {
  if (!BOT_TOKEN || !CHAT_ID) return;
  for (const chunk of (text.match(/[\s\S]{1,4000}/g) || [text])) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: chunk }),
    });
    await new Promise(r => setTimeout(r, 300));
  }
}

async function getTokens() {
  const r = await fetch(`${BASE_URL}/v1/social-accounts`, { headers: authHeaders });
  const d = await r.json();
  const accs = d.data || d;
  return {
    ig:   accs.find(a => a.platform === 'instagram').access_token,
    th:   accs.find(a => a.platform === 'threads').access_token,
    thId: accs.find(a => a.platform === 'threads').user_id,
  };
}

async function uploadImagem(filePath, filename) {
  const r = await fetch(`${BASE_URL}/v1/media/create-upload-url`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ file_name: filename, content_type: 'image/png' }),
  });
  if (!r.ok) throw new Error(`Upload URL falhou: ${await r.text()}`);
  const { upload_url, media_url } = await r.json();
  const putR = await fetch(upload_url, {
    method: 'PUT', headers: { 'Content-Type': 'image/png' },
    body: fs.readFileSync(filePath),
  });
  if (!putR.ok) throw new Error(`PUT falhou: ${putR.status}`);
  return media_url;
}

async function publicarStoryInstagram(token, imageUrl) {
  // Story individual: media_product_type=STORY
  const r = await fetch(`${IG_API}/${IG_USER_ID}/media`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'IMAGE',
      image_url: imageUrl,
      media_product_type: 'STORY',
      access_token: token,
    }),
  });
  const d = await r.json();
  if (d.error) throw new Error(`Container story falhou: ${JSON.stringify(d.error)}`);
  const containerId = d.id;

  // Aguarda FINISHED
  const start = Date.now();
  while (Date.now() - start < 60000) {
    await new Promise(r => setTimeout(r, 3000));
    const sr = await fetch(`${IG_API}/${containerId}?fields=status_code&access_token=${token}`);
    const sd = await sr.json();
    if (sd.status_code === 'FINISHED') break;
    if (sd.status_code === 'ERROR') throw new Error(`Container story ${containerId} falhou`);
    process.stdout.write('.');
  }

  // Publica
  const pr = await fetch(`${IG_API}/${IG_USER_ID}/media_publish`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: containerId, access_token: token }),
  });
  const pd = await pr.json();
  if (pd.error) throw new Error(`Publicação story falhou: ${JSON.stringify(pd.error)}`);
  return pd.id;
}

async function publicarStoryThreads(token, userId, imageUrl) {
  // Threads story — IMAGE simples
  const r = await fetch(`${THREADS_API}/${userId}/threads`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'IMAGE',
      image_url: imageUrl,
      text: legenda.slice(0, 500),
      access_token: token,
    }),
  });
  const d = await r.json();
  if (d.error) throw new Error(`Threads container falhou: ${JSON.stringify(d.error)}`);

  // Aguarda FINISHED
  const start = Date.now();
  while (Date.now() - start < 60000) {
    await new Promise(r => setTimeout(r, 3000));
    const sr = await fetch(`${THREADS_API}/${d.id}?fields=status&access_token=${token}`);
    const sd = await sr.json();
    if (sd.status === 'FINISHED') break;
    if (sd.status === 'ERROR') throw new Error(`Threads container ${d.id} falhou`);
    process.stdout.write('.');
  }

  // Publica
  const pr = await fetch(`${THREADS_API}/${userId}/threads_publish`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: d.id, access_token: token }),
  });
  const pd = await pr.json();
  if (pd.error) throw new Error(`Threads publish falhou: ${JSON.stringify(pd.error)}`);
  return pd.id;
}

async function main() {
  const tokens = await getTokens();
  console.log(`\n📸 Story: ${storyId}`);
  console.log(`   ${pngs.length} imagens encontradas\n`);

  await sendTelegram(`⏳ Publicando story: ${storyId}\n${pngs.length} slides`);

  // Upload de todas as imagens
  console.log('Fazendo upload das imagens...');
  const imageUrls = [];
  for (const png of pngs) {
    process.stdout.write(`  ${png}... `);
    const url = await uploadImagem(path.join(outDir, png), png);
    imageUrls.push(url);
    console.log('OK');
  }

  // Publica cada imagem como story individual
  console.log('\nPublicando stories no Instagram...');
  const igIds = [];
  for (let i = 0; i < imageUrls.length; i++) {
    process.stdout.write(`  Story ${i + 1}/${imageUrls.length}... `);
    const id = await publicarStoryInstagram(tokens.ig, imageUrls[i]);
    igIds.push(id);
    console.log(`OK (${id})`);
    // Pausa entre stories pra evitar rate limit
    if (i < imageUrls.length - 1) await new Promise(r => setTimeout(r, 2000));
  }

  if (!igOnly) {
    // Publica primeiro slide como Threads
    try {
      process.stdout.write('\nThreads (primeiro slide)... ');
      await publicarStoryThreads(tokens.th, tokens.thId, imageUrls[0]);
      console.log('OK');
    } catch (e) {
      console.log(`ERRO: ${e.message}`);
    }
  }

  console.log(`\n✅ ${igIds.length} stories publicados no Instagram!`);
  await sendTelegram(`✅ Story publicado!\n${igIds.length} slides no Instagram`);
}

main().catch(async err => {
  console.error('Erro fatal:', err.message);
  await sendTelegram(`💥 Erro no story: ${err.message}`).catch(() => {});
  process.exit(1);
});
