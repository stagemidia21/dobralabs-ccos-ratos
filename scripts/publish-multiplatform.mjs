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

const LEGENDA = `O Google lançou o Gemma 4 em 2 de abril.

Open source, Apache 2.0, multimodal, roda local. O 31B bate o Qwen 3.5 32B em raciocínio e código no benchmark oficial.

Baixa no Hugging Face, Kaggle ou Ollama. Testa no browser pelo Google AI Studio sem instalar nada.

A base técnica é a mesma do Gemini 3. De graça. Sem royalty em produto comercial.

O Google não fez isso por bondade. Mas quem constrói em cima enquanto todo mundo discute se vale a pena já está na frente.

Fonte: Google DeepMind, blog.google

#IA #Gemma4 #Google #OpenSource #MarketingDigital`;

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

  // 3. Facebook + LinkedIn — carrossel PNG
  console.log('\n── Facebook + LinkedIn (carrossel PNG) ──');
  await publish(
    [CONTAS.facebook, CONTAS.linkedin_page, CONTAS.linkedin_pessoal],
    pngUrls,
    'Facebook + LinkedIn carrossel PNG'
  );

  console.log('\n✓ Publicação completa em todas as plataformas!');
}

main().catch(err => { console.error('Erro:', err.message); process.exit(1); });
