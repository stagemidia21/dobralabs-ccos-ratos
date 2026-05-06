/**
 * Upload alternativo do post1 usando /v1/post com form-data
 * Slides já estão renderizados — apenas faz o upload e publica
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = '/home/user/dobralabs-ccos-ratos';
const SLIDES_DIR = path.join(ROOT, 'projetos/carrossel-remotion/out/post1');

const API_KEY = process.env.POSTFORME_API_KEY;
const BASE_URL = 'https://api.postforme.dev';

const LEGENDA = `Claude Code não é ferramenta de programador.

Comecei a usar pra redigir proposta com contexto real do cliente. Depois pra montar relatório sem transformar isso em 2 horas de reunião. Depois pra criar SOP. Depois pra automatizar briefing.

Hoje é o sistema operacional da minha agência.

Cada cliente tem pasta própria. O CLAUDE.md carrega as regras da Stage Mídia. As skills estão configuradas pra cada tipo de entrega. Quando abro uma sessão, o sistema já sabe o contexto.

Não escrevi uma linha de código. Só montei o ambiente certo.

Dono de agência que acha que IA é coisa de dev está perdendo tempo e dinheiro. Não de futuro — de agora.

#ClaudeCode #GestãoComIA #AgênciasDigitais #MarketingDigital #StageMidia`;

// Contas PostForMe
const CONTAS = [
  'spc_OLQYtgi2qkckhJPbA56y6', // instagram homero.ads
  'spc_suZlmVRdsUuK7uoKZ2sp',  // threads
  'spc_ICb28Y2xx1WbjQDLcXVmN', // facebook
  'spc_tvTRNzPUZtWkxx7yzGwW',  // linkedin Stage Mídia
  'spc_e80YbEcrp7zDHltQlBCl',  // linkedin Homero
];

async function main() {
  if (!API_KEY) {
    console.error('POSTFORME_API_KEY não encontrada');
    process.exit(1);
  }

  const slides = fs.readdirSync(SLIDES_DIR)
    .filter(f => f.endsWith('.jpg'))
    .sort()
    .map(f => path.join(SLIDES_DIR, f));

  if (slides.length === 0) {
    console.error('Nenhum slide JPEG encontrado em:', SLIDES_DIR);
    process.exit(1);
  }

  console.log(`Encontrados ${slides.length} slides`);

  // Tenta primeiro /v1/social-posts com upload via create-upload-url (approach 1)
  // Se falhar, tenta /v1/post com form-data (approach 2)

  // Approach 1: create-upload-url
  console.log('\n→ Testando create-upload-url...');
  const testR = await fetch(`${BASE_URL}/v1/media/create-upload-url`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file_name: 'slide-01.jpg', content_type: 'image/jpeg' }),
  });
  const testBody = await testR.text();
  console.log(`  Status: ${testR.status} — ${testBody.substring(0, 200)}`);

  if (!testR.ok) {
    console.log('\n→ create-upload-url bloqueado. Tentando /v1/post com form-data...');

    // Approach 2: form-data direto
    const form = new FormData();
    form.append('caption', LEGENDA);
    form.append('type', 'carousel');

    // Adiciona contas individualmente
    for (const conta of CONTAS) {
      form.append('social_accounts[]', conta);
    }

    for (const slide of slides) {
      form.append('images', fs.createReadStream(slide), {
        filename: path.basename(slide),
        contentType: 'image/jpeg',
      });
    }

    const res = await fetch(`${BASE_URL}/v1/post`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        ...form.getHeaders(),
      },
      body: form,
    });

    const data = await res.text();
    console.log(`  Status: ${res.status}`);
    console.log(`  Resposta: ${data.substring(0, 500)}`);

    if (!res.ok) {
      console.error('\n✗ Ambas as abordagens falharam.');
      process.exit(1);
    }

    console.log('\n✓ Publicado via form-data!');
    return;
  }

  // Approach 1 funcionou — upload normal
  console.log('\n→ create-upload-url disponível! Fazendo upload...');
  const mediaUrls = [];
  for (const slide of slides) {
    process.stdout.write(`  Upload ${path.basename(slide)}... `);
    const urlData = JSON.parse(testBody.includes('upload_url') ? testBody : '{}');

    const uploadRes = await fetch(`${BASE_URL}/v1/media/create-upload-url`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file_name: path.basename(slide), content_type: 'image/jpeg' }),
    });

    if (!uploadRes.ok) {
      console.error(`Falhou: ${await uploadRes.text()}`);
      break;
    }

    const { upload_url, media_url } = await uploadRes.json();
    const putRes = await fetch(upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: fs.readFileSync(slide),
    });

    if (!putRes.ok) {
      console.error(`PUT falhou: ${putRes.status}`);
      break;
    }

    mediaUrls.push(media_url);
    console.log('OK');
  }

  if (mediaUrls.length === slides.length) {
    console.log('\n→ Publicando em todas as redes...');
    const publishRes = await fetch(`${BASE_URL}/v1/social-posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        caption: LEGENDA,
        media: mediaUrls.map(url => ({ url })),
        social_accounts: CONTAS,
      }),
    });

    const publishData = await publishRes.text();
    console.log(`  Status: ${publishRes.status}`);
    console.log(`  Resposta: ${publishData.substring(0, 500)}`);
    if (publishRes.ok) console.log('\n✓ Publicado!');
    else console.error('\n✗ Erro ao publicar');
  }
}

main().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
