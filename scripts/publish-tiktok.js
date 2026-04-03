/**
 * publish-tiktok.js
 * Faz upload dos PNGs TikTok e publica via Post for Me API
 */

const fs = require('fs');
const path = require('path');

const API_KEY = process.env.POSTFORME_API_KEY;
const BASE_URL = 'https://api.postforme.dev';

const PASTA = 'conteudo/carrosseis/claude-code-vazamento/tiktok';

// TikTok @homero.ads (business) e TikTok Homero Zanichelli
const CONTAS = [
  'spc_fGSQlvGbOwkpoDuKWBWxs',
  'spc_P2ekncSiXqF52dg6zXExV'
];

const LEGENDA = `A Anthropic vazou o próprio código por acidente. 512 mil linhas de TypeScript. E dentro tinha coisa que eles nunca tinham anunciado.

Undercover Mode, Proactive, Voice, Bridge — features com nome, sem comunicado.

O que está vindo vai mudar seu fluxo de trabalho de um jeito que nenhum release oficial avisou ainda.

Salva esse carrossel. Você vai precisar relembrar quando lançar.

#IA #InteligenciaArtificial #ClaudeCode #Anthropic #MarketingDigital #TrafegoPago #Automacao`;

async function main() {
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

    const uploadRes = await fetch(`${BASE_URL}/v1/media/create-upload-url`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ file_name: filename, content_type: 'image/png' }),
    });

    if (!uploadRes.ok) {
      console.error(`\nErro (${uploadRes.status}):`, await uploadRes.text());
      process.exit(1);
    }

    const { upload_url, media_url } = await uploadRes.json();

    const putRes = await fetch(upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: fs.readFileSync(png),
    });

    if (!putRes.ok) {
      console.error(`\nErro upload (${putRes.status})`);
      process.exit(1);
    }

    mediaUrls.push({ url: media_url });
    console.log('OK');
  }

  console.log(`\nPublicando no TikTok...`);

  const postRes = await fetch(`${BASE_URL}/v1/social-posts`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      caption: LEGENDA,
      social_accounts: CONTAS,
      media: mediaUrls,
    }),
  });

  const data = await postRes.json();

  if (!postRes.ok) {
    console.error('Erro ao publicar:', JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log('\nPublicado com sucesso!');
  console.log('Post ID:', data.id);
  console.log('Status:', data.status);
}

main().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
