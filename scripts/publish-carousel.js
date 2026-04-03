/**
 * publish-carousel.js
 * Faz upload dos PNGs e publica carrossel via Post for Me API
 * Usa fetch nativo do Node 18+
 */

const fs = require('fs');
const path = require('path');

const API_KEY = process.env.POSTFORME_API_KEY;
const BASE_URL = 'https://api.postforme.dev';

const PASTA = 'conteudo/carrosseis/claude-code-vazamento/instagram';
const CONTA_INSTAGRAM = 'spc_OLQYtgi2qkckhJPbA56y6';
const LEGENDA = `A Anthropic vazou o próprio código por acidente. 512 mil linhas de TypeScript. E dentro tinha coisa que eles nunca tinham anunciado.

Undercover Mode, Proactive, Voice, Bridge — features com nome, sem comunicado.

O que está vindo vai mudar seu fluxo de trabalho de um jeito que nenhum release oficial avisou ainda.

Salva esse carrossel. Você vai precisar relembrar quando lançar.

#IA #InteligenciaArtificial #ClaudeCode #Anthropic #MarketingDigital #TrafegoPago #Automacao`;

async function main() {
  if (!API_KEY) {
    console.error('POSTFORME_API_KEY não encontrada no .env');
    process.exit(1);
  }

  const authHeaders = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  };

  const pngs = fs.readdirSync(PASTA)
    .filter(f => f.endsWith('.png'))
    .sort()
    .map(f => path.join(PASTA, f));

  console.log(`Encontrados ${pngs.length} slides para upload`);

  const mediaUrls = [];

  for (const png of pngs) {
    const filename = path.basename(png);
    process.stdout.write(`Uploading ${filename}... `);

    // Pede URL de upload
    const uploadRes = await fetch(`${BASE_URL}/v1/media/create-upload-url`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ file_name: filename, content_type: 'image/png' }),
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      console.error(`\nErro ao criar upload URL (${uploadRes.status}):`, err);
      process.exit(1);
    }

    const { upload_url, media_url } = await uploadRes.json();

    // Faz o upload do arquivo
    const fileBuffer = fs.readFileSync(png);
    const putRes = await fetch(upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: fileBuffer,
    });

    if (!putRes.ok) {
      console.error(`\nErro ao fazer upload (${putRes.status})`);
      process.exit(1);
    }

    mediaUrls.push({ url: media_url });
    console.log('OK');
  }

  console.log(`\nPublicando carrossel com ${mediaUrls.length} slides no Instagram...`);

  const postRes = await fetch(`${BASE_URL}/v1/social-posts`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      caption: LEGENDA,
      social_accounts: [CONTA_INSTAGRAM],
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

  console.log('\nPublicado com sucesso!');
  console.log(JSON.stringify(postData, null, 2));
}

main().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
