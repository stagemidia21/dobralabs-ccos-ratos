/**
 * publicar-instagram-direto.mjs
 * Publica carrossel de vídeo direto na API do Instagram (bypassa Post for Me)
 * Uso: node scripts/publicar-instagram-direto.mjs <post-dir> <legenda>
 *   ex: node scripts/publicar-instagram-direto.mjs out/post1 "legenda aqui"
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const POSTFORME_KEY = process.env.POSTFORME_API_KEY;
const IG_USER_ID = '26285906407703501';
const IG_API = 'https://graph.instagram.com';

async function getIGToken() {
  const r = await fetch('https://api.postforme.dev/v1/social-accounts', {
    headers: { 'Authorization': `Bearer ${POSTFORME_KEY}` }
  });
  const d = await r.json();
  const accs = d.data || d;
  return accs.find(a => a.platform === 'instagram').access_token;
}

async function uploadToPostForMe(filePath) {
  const filename = path.basename(filePath);
  const hdrs = { 'Authorization': `Bearer ${POSTFORME_KEY}`, 'Content-Type': 'application/json' };
  const r = await fetch('https://api.postforme.dev/v1/media/create-upload-url', {
    method: 'POST', headers: hdrs,
    body: JSON.stringify({ file_name: filename, content_type: 'video/mp4' })
  });
  const { upload_url, media_url } = await r.json();
  await fetch(upload_url, { method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: fs.readFileSync(filePath) });
  return media_url;
}

async function createVideoContainer(token, videoUrl) {
  const r = await fetch(`${IG_API}/${IG_USER_ID}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ media_type: 'VIDEO', video_url: videoUrl, is_carousel_item: 'true', access_token: token })
  });
  const d = await r.json();
  if (d.error) throw new Error(`Erro criando container: ${JSON.stringify(d.error)}`);
  return d.id;
}

async function waitForContainer(token, containerId, maxWaitMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, 5000));
    const r = await fetch(`${IG_API}/${containerId}?fields=status_code,status&access_token=${token}`);
    const d = await r.json();
    if (d.status_code === 'FINISHED') return true;
    if (d.status_code === 'ERROR') throw new Error(`Container ${containerId} falhou: ${d.status}`);
    process.stdout.write('.');
  }
  throw new Error(`Timeout aguardando container ${containerId}`);
}

async function createCarouselContainer(token, childIds, caption) {
  const r = await fetch(`${IG_API}/${IG_USER_ID}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ media_type: 'CAROUSEL', children: childIds.join(','), caption, access_token: token })
  });
  const d = await r.json();
  if (d.error) throw new Error(`Erro criando carrossel: ${JSON.stringify(d.error)}`);
  return d.id;
}

async function publishContainer(token, creationId) {
  const r = await fetch(`${IG_API}/${IG_USER_ID}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: creationId, access_token: token })
  });
  const d = await r.json();
  if (d.error) throw new Error(`Erro publicando: ${JSON.stringify(d.error)}`);
  return d.id;
}

export async function publicarCarrosselInstagram(slidesDir, caption) {
  console.log('\nBuscando token do Instagram...');
  const token = await getIGToken();

  const slides = fs.readdirSync(slidesDir).filter(f => f.endsWith('.mp4')).sort();
  console.log(`${slides.length} slides encontrados\n`);

  // Upload dos slides pro Post for Me storage (CDN público)
  console.log('Fazendo upload dos slides...');
  const mediaUrls = [];
  for (const s of slides) {
    process.stdout.write(`  ${s}... `);
    const url = await uploadToPostForMe(path.join(slidesDir, s));
    mediaUrls.push(url);
    console.log('OK');
  }

  // Criando containers de vídeo no Instagram
  console.log('\nCriando containers de vídeo no Instagram...');
  const containerIds = [];
  for (let i = 0; i < mediaUrls.length; i++) {
    process.stdout.write(`  Container ${i + 1}/${mediaUrls.length}... `);
    const id = await createVideoContainer(token, mediaUrls[i]);
    containerIds.push(id);
    console.log(`OK (${id})`);
  }

  // Aguardando processamento
  console.log('\nAguardando processamento dos vídeos no Instagram');
  for (let i = 0; i < containerIds.length; i++) {
    process.stdout.write(`  Slide ${i + 1}... `);
    await waitForContainer(token, containerIds[i]);
    console.log(' PRONTO');
  }

  // Criando container do carrossel
  console.log('\nCriando container do carrossel...');
  const carrosselId = await createCarouselContainer(token, containerIds, caption);
  console.log(`OK (${carrosselId})`);

  // Aguardar carrossel container ficar pronto
  console.log('Aguardando carrossel container...');
  await waitForContainer(token, carrosselId, 60000);
  console.log('PRONTO');

  // Publicando
  console.log('Publicando...');
  const postId = await publishContainer(token, carrosselId);
  console.log(`\n✅ Publicado no Instagram! Post ID: ${postId}`);
  console.log(`   https://www.instagram.com/p/${postId}/`);
  return postId;
}

// Execução direta
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Uso: node publicar-instagram-direto.mjs <slides-dir> "<legenda>"');
  process.exit(1);
}
const [dir, caption] = args;
const slidesDir = path.isAbsolute(dir) ? dir : path.join(ROOT, dir);
publicarCarrosselInstagram(slidesDir, caption).catch(e => { console.error('Erro:', e.message); process.exit(1); });
