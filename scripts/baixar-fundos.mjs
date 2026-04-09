/**
 * baixar-fundos.mjs
 * Baixa 20 fotos do Pexels pro banco de fundos do carrossel
 *
 * Uso: node scripts/baixar-fundos.mjs
 * Requer: PEXELS_API_KEY no .env
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'projetos/carrossel-remotion/public/fundos');

const API_KEY = process.env.PEXELS_API_KEY;
if (!API_KEY) {
  console.error('Falta PEXELS_API_KEY no .env');
  console.error('Crie uma grátis em: https://www.pexels.com/api/');
  process.exit(1);
}

// Temas das fotos — personalizados pro perfil @homero.ads
const BUSCAS = [
  { query: 'macbook pro desk dark',          qtd: 3, prefix: 'macbook' },
  { query: 'luxury car interior dark',       qtd: 3, prefix: 'carro' },
  { query: 'iphone dark aesthetic desk',     qtd: 2, prefix: 'iphone' },
  { query: 'dark code screen monitor',       qtd: 3, prefix: 'codigo' },
  { query: 'luxury watch dark background',   qtd: 2, prefix: 'relogio' },
  { query: 'dark minimal workspace setup',   qtd: 3, prefix: 'setup' },
  { query: 'night city aerial dark',         qtd: 2, prefix: 'cidade' },
  { query: 'black business luxury premium',  qtd: 2, prefix: 'premium' },
];

async function buscarFotos(query, perPage = 3) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape&size=large`;
  const r = await fetch(url, { headers: { Authorization: API_KEY } });
  if (!r.ok) throw new Error(`Pexels erro ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d.photos || [];
}

async function baixarFoto(url, destPath) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Download falhou: ${r.status}`);
  const buf = await r.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buf));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let total = 0;
  const index = []; // pra gerar o FUNDOS.md com os nomes

  for (const busca of BUSCAS) {
    console.log(`\n🔍 ${busca.query} (${busca.qtd} fotos)...`);
    try {
      const fotos = await buscarFotos(busca.query, busca.qtd);
      for (let i = 0; i < fotos.length; i++) {
        const foto = fotos[i];
        const num = String(total + 1).padStart(2, '0');
        const nome = `${busca.prefix}-${num}.jpg`;
        const dest = path.join(OUT_DIR, nome);

        process.stdout.write(`  ${nome}... `);
        await baixarFoto(foto.src.large2x || foto.src.large, dest);
        console.log(`OK (${foto.width}x${foto.height})`);

        index.push({
          arquivo: nome,
          tema: busca.prefix,
          autor: foto.photographer,
          pexels: foto.url,
        });
        total++;
      }
    } catch (err) {
      console.log(`  ERRO: ${err.message}`);
    }

    // Rate limit Pexels: 200 req/min — pequeno delay entre buscas
    await new Promise(r => setTimeout(r, 500));
  }

  // Salva índice com créditos
  const indexPath = path.join(OUT_DIR, 'INDEX.md');
  let md = `# Banco de Fundos — @homero.ads\n\nTotal: ${total} fotos\n\n`;
  md += '| Arquivo | Tema | Fotógrafo | Link |\n|---|---|---|---|\n';
  for (const f of index) {
    md += `| ${f.arquivo} | ${f.tema} | ${f.autor} | [Pexels](${f.pexels}) |\n`;
  }
  fs.writeFileSync(indexPath, md);

  console.log(`\n✅ ${total} fotos baixadas em public/fundos/`);
  console.log(`📋 Índice salvo em public/fundos/INDEX.md`);
  console.log(`\nPróximo passo: node scripts/atualizar-rotacao-fundos.mjs`);
}

main().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
