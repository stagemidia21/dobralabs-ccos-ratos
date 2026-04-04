import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_KEY = 'pfm_live_MphZsYgdwKGBKhBCfP3m6r';
const BASE_URL = 'https://api.postforme.dev';
const CONTAS = [
  'spc_OLQYtgi2qkckhJPbA56y6', // instagram homero.ads
  'spc_suZlmVRdsUuK7uoKZ2sp',  // threads homero.ads
  'spc_ICb28Y2xx1WbjQDLcXVmN', // facebook homero.ads
  'spc_tvTRNzPUZtWkxx7yzGwW',  // linkedin Stage Mídia
  'spc_e80YbEcrp7zDHltQlBCl',  // linkedin Homero Zanichelli
];

const SLIDES_DIR = path.join(__dirname, '../projetos/carrossel-remotion/out/slides');

const LEGENDA = `Pesquisa. Escrita. Design. Exportação. Publicação. Tudo automático.

Montei um sistema que produz carrossel completo do terminal até o Instagram, sem abrir o Canva uma vez.

Claude Code + Playwright + Post for Me. Um comando. Dez plataformas.

Se você ainda faz isso na mão, esse vídeo é pra você.

#IA #Automacao #ClaudeCode #MarketingDigital #ContentCreator #TrafegoPago`;

const authHeaders = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

async function main() {
  const slides = fs.readdirSync(SLIDES_DIR)
    .filter(f => f.endsWith('.mp4'))
    .sort()
    .map(f => path.join(SLIDES_DIR, f));

  console.log(`${slides.length} slides encontrados\n`);

  const mediaUrls = [];

  for (const slide of slides) {
    const filename = path.basename(slide);
    process.stdout.write(`Uploading ${filename}... `);

    const uploadRes = await fetch(`${BASE_URL}/v1/media/create-upload-url`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ file_name: filename, content_type: 'video/mp4' }),
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      console.error(`\nErro upload URL (${uploadRes.status}):`, err);
      process.exit(1);
    }

    const { upload_url, media_url } = await uploadRes.json();

    const fileBuffer = fs.readFileSync(slide);
    const putRes = await fetch(upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': 'video/mp4' },
      body: fileBuffer,
    });

    if (!putRes.ok) {
      console.error(`\nErro ao fazer upload (${putRes.status})`);
      process.exit(1);
    }

    mediaUrls.push({ url: media_url });
    console.log('OK');
  }

  console.log(`\nPublicando carrossel de vídeo no Instagram...`);

  const postRes = await fetch(`${BASE_URL}/v1/social-posts`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      caption: LEGENDA,
      social_accounts: CONTAS,
      media: mediaUrls,
      platform_configurations: {
        instagram: { placement: 'timeline' }
      }
    }),
  });

  const postData = await postRes.json();

  if (!postRes.ok) {
    console.error('Erro ao publicar:', JSON.stringify(postData, null, 2));
    process.exit(1);
  }

  console.log('\nPublicado!');
  console.log(JSON.stringify(postData, null, 2));
}

main().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
