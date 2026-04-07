/**
 * publish-post6.mjs
 * Post 6 — Carrossel Vídeo: Como montar agente de IA que trabalha enquanto você dorme
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

const LEGENDA = `Montei um agente que redige relatório de cliente automaticamente. Sem eu tocar em nada.

Briefing chega via WhatsApp. O n8n captura e estrutura os dados. O Claude redige com base no template da agência. O Notion recebe a página pronta, com status e link do cliente.

Tempo de geração: menos de 30 segundos. Meu trabalho virou uma revisão de 5 minutos antes de aprovar.

Custo mensal pra rodar isso pra 8 clientes com relatório semanal: menos de R$ 60.

O erro mais comum é achar que o problema é a IA. O problema é não ter arquitetura. IA sem fluxo bem estruturado só gera lixo mais rápido.

Comenta AGENTE que te explico como começar.

#AutomaçãoComIA #n8n #AgênciasDigitais #MarketingDigital #ClaudeCode`;

const VIDEO_PATH = path.join(ROOT, 'projetos/carrossel-remotion/out/carrossel4.mp4');

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
  console.log('📤 Publicando Post 6 — Agente de IA (enquanto você dorme)\n');

  console.log('Fazendo upload do vídeo...');
  const uploadRes = await fetchWithRetry(`${BASE_URL}/v1/media/create-upload-url`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ file_name: 'carrossel4.mp4', content_type: 'video/mp4' }),
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

  console.log('\n✅ Post 6 publicado!');
  console.log(JSON.stringify(data, null, 2));
}

main().catch(err => { console.error('Erro:', err.message); process.exit(1); });
