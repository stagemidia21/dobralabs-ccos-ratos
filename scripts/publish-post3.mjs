/**
 * publish-post3.mjs
 * Post 3 — Carrossel Vídeo: Google + IA em 2026 (tráfego pago)
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const API_KEY = process.env.POSTFORME_API_KEY;
const BASE_URL = 'https://api.postforme.dev';
const CONTAS = [
  'spc_OLQYtgi2qkckhJPbA56y6', // instagram homero.ads
  'spc_suZlmVRdsUuK7uoKZ2sp',  // threads homero.ads
  'spc_ICb28Y2xx1WbjQDLcXVmN', // facebook homero.ads
  'spc_tvTRNzPUZtWkxx7yzGwW',  // linkedin Stage Mídia
  'spc_e80YbEcrp7zDHltQlBCl',  // linkedin Homero Zanichelli
];

const LEGENDA = `O Google não te avisa quando a IA assume o controle. Ela simplesmente assume.

Performance Max, Smart Bidding e Broad Match com IA não são recursos opcionais em 2026. São a infraestrutura padrão. E a maioria dos gestores ainda aplica lógica de 2020 num sistema que mudou completamente.

Já trabalhei em contas onde o algoritmo performava bem por dentro enquanto o negócio do cliente sangrava por fora. tCPA no alvo, CAC destruindo a margem. Acontece quando a configuração de conversão não reflete o que importa de verdade pro negócio.

A IA otimiza o que você define. Se você definir errado, ela vai ser muito eficiente no lugar errado.

O gestor que sobrevive não é o que briga contra automação. É o que entende onde o algoritmo tem ponto cego — e cobre com dados de primeira parte, estratégia de conta e inteligência de negócio.

#GoogleAds #TráfegoPago #PerformanceMax #PaidMedia #IAparaNegocios`;

const VIDEO_PATH = path.join(ROOT, 'projetos/carrossel-remotion/out/carrossel3.mp4');

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`  Retry ${i + 1}/${retries}...`);
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
}

const authHeaders = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

async function main() {
  console.log('📤 Publicando Post 3 — Google + IA (tráfego pago)\n');

  // Upload do vídeo
  console.log('Fazendo upload do vídeo...');
  const uploadRes = await fetchWithRetry(`${BASE_URL}/v1/media/create-upload-url`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ file_name: 'carrossel3.mp4', content_type: 'video/mp4' }),
  });

  if (!uploadRes.ok) throw new Error(`Upload URL falhou: ${await uploadRes.text()}`);
  const { upload_url, media_url } = await uploadRes.json();

  const fileBuffer = fs.readFileSync(VIDEO_PATH);
  const putRes = await fetchWithRetry(upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4' },
    body: fileBuffer,
  });
  if (!putRes.ok) throw new Error(`PUT falhou: ${putRes.status}`);
  console.log('✓ Upload completo');

  // Publicar
  console.log('Publicando...');
  const postRes = await fetchWithRetry(`${BASE_URL}/v1/social-posts`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      caption: LEGENDA,
      social_accounts: CONTAS,
      media: [{ url: media_url }],
      platform_configurations: { instagram: { placement: 'timeline' } },
    }),
  });

  const data = await postRes.json();
  if (!postRes.ok) {
    console.error('Erro:', JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log('\n✅ Post 3 publicado!');
  console.log(JSON.stringify(data, null, 2));
}

main().catch(err => { console.error('Erro:', err.message); process.exit(1); });
