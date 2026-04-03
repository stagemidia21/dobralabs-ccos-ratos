/**
 * publish-postforme.js
 * Publica carrossel no Instagram via Post for Me API (postforme.dev)
 *
 * Uso:
 *   node --env-file=.env scripts/publish-postforme.js \
 *     --pasta conteudo/carrosseis/[tema]/instagram \
 *     --legenda "legenda do post" \
 *     --conta instagram
 *
 * Variáveis necessárias no .env:
 *   POSTFORME_API_KEY=sua_chave_aqui
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : null;
};

const pasta = getArg('--pasta');
const legenda = getArg('--legenda');
const conta = getArg('--conta') || 'instagram';
const apiKey = process.env.POSTFORME_API_KEY;

if (!apiKey) {
  console.error('Erro: POSTFORME_API_KEY nao encontrada no .env');
  process.exit(1);
}

if (!pasta) {
  console.error('Erro: informe a pasta com --pasta caminho/da/pasta');
  process.exit(1);
}

if (!legenda) {
  console.error('Erro: informe a legenda com --legenda "texto da legenda"');
  process.exit(1);
}

// Pega todos os PNGs da pasta em ordem
const pngs = fs.readdirSync(pasta)
  .filter(f => f.endsWith('.png'))
  .sort()
  .map(f => path.resolve(pasta, f));

if (pngs.length === 0) {
  console.error('Erro: nenhum PNG encontrado na pasta:', pasta);
  process.exit(1);
}

console.log(`Publicando ${pngs.length} slides no ${conta}...`);
console.log('Slides:', pngs.map(p => path.basename(p)).join(', '));

// Monta o payload pro Post for Me
const FormData = require('form-data');
const fetch = require('node-fetch');

async function publish() {
  const form = new FormData();
  form.append('platform', conta);
  form.append('caption', legenda);
  form.append('type', 'carousel');

  for (const png of pngs) {
    form.append('images', fs.createReadStream(png));
  }

  const res = await fetch('https://api.postforme.dev/v1/post', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      ...form.getHeaders()
    },
    body: form
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('Erro ao publicar:', data);
    process.exit(1);
  }

  console.log('Publicado com sucesso!');
  console.log('URL:', data.url || data.post_url || JSON.stringify(data));
}

publish().catch(err => {
  console.error('Erro inesperado:', err.message);
  process.exit(1);
});
