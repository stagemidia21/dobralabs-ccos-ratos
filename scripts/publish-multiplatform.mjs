import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_KEY = 'pfm_live_MphZsYgdwKGBKhBCfP3m6r';
const BASE_URL = 'https://api.postforme.dev';

const CONTAS = {
  instagram: 'spc_OLQYtgi2qkckhJPbA56y6',
  threads:   'spc_suZlmVRdsUuK7uoKZ2sp',
  facebook:  'spc_ICb28Y2xx1WbjQDLcXVmN',
  linkedin_page: 'spc_tvTRNzPUZtWkxx7yzGwW',
  linkedin_pessoal: 'spc_e80YbEcrp7zDHltQlBCl',
};

const SLIDES_MP4 = path.join(__dirname, '../projetos/carrossel-remotion/out/slides');
const SLIDES_PNG = path.join(__dirname, '../projetos/carrossel-remotion/out/png');

const LEGENDA = `Pesquisa. Escrita. Design. Exportação. Publicação. Tudo automático.

Montei um sistema que produz carrossel completo do terminal até o Instagram, sem abrir o Canva uma vez.

Claude Code + Playwright + Post for Me. Um comando. Dez plataformas.

Se você ainda faz isso na mão, esse vídeo é pra você.

#IA #Automacao #ClaudeCode #MarketingDigital #ContentCreator #TrafegoPago`;

const authHeaders = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

async function uploadFile(filePath, contentType) {
  const filename = path.basename(filePath);
  process.stdout.write(`  Uploading ${filename}... `);

  const uploadRes = await fetch(`${BASE_URL}/v1/media/create-upload-url`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ file_name: filename, content_type: contentType }),
  });

  if (!uploadRes.ok) throw new Error(`Upload URL failed: ${await uploadRes.text()}`);
  const { upload_url, media_url } = await uploadRes.json();

  const fileBuffer = fs.readFileSync(filePath);
  const putRes = await fetch(upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: fileBuffer,
  });

  if (!putRes.ok) throw new Error(`PUT failed: ${putRes.status}`);
  console.log('OK');
  return media_url;
}

async function publish(accounts, media, label) {
  console.log(`\nPublicando: ${label}...`);
  const res = await fetch(`${BASE_URL}/v1/social-posts`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      caption: LEGENDA,
      social_accounts: accounts,
      media,
      platform_configurations: {
        instagram: { placement: 'timeline' }
      }
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  console.log(`  ✓ ${label} — status: ${data.status} (id: ${data.id})`);
}

async function main() {
  // 1. Instagram — carrossel de vídeo
  console.log('\n── Instagram (carrossel MP4) ──');
  const mp4Files = fs.readdirSync(SLIDES_MP4).filter(f => f.endsWith('.mp4')).sort();
  const mp4Urls = [];
  for (const f of mp4Files) {
    const url = await uploadFile(path.join(SLIDES_MP4, f), 'video/mp4');
    mp4Urls.push({ url });
  }
  await publish([CONTAS.instagram], mp4Urls, 'Instagram carrossel vídeo');

  // 2. Threads — carrossel de PNG
  console.log('\n── Threads (carrossel PNG) ──');
  const pngFiles = fs.readdirSync(SLIDES_PNG).filter(f => f.endsWith('.png')).sort();
  const pngUrls = [];
  for (const f of pngFiles) {
    const url = await uploadFile(path.join(SLIDES_PNG, f), 'image/png');
    pngUrls.push({ url });
  }
  await publish([CONTAS.threads], pngUrls, 'Threads carrossel PNG');

  // 3. Facebook + LinkedIn — só a capa
  console.log('\n── Facebook + LinkedIn (capa) ──');
  const capaUrl = await uploadFile(path.join(SLIDES_PNG, 'slide-01.png'), 'image/png');
  await publish(
    [CONTAS.facebook, CONTAS.linkedin_page, CONTAS.linkedin_pessoal],
    [{ url: capaUrl }],
    'Facebook + LinkedIn capa'
  );

  console.log('\n✓ Publicação completa em todas as plataformas!');
}

main().catch(err => { console.error('Erro:', err.message); process.exit(1); });
