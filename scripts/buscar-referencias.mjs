/**
 * buscar-referencias.mjs
 * Raspa os posts recentes dos perfis de referência via Apify
 * e busca notícias de IA dos últimos 2 dias.
 * Salva o resultado em _contexto/referencias-do-dia.json
 */

import 'dotenv/config';
import { ApifyClient } from 'apify-client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const client = new ApifyClient({ token: process.env.APIFY_API_KEY });

const PERFIS = [
  'viverdeia',
  'bruno.ai1',
  'bubows.ai',
  'thaleslaray',
  'kaique.editor',
  'eusouier',
  'castilho.ia',
  'rafa.grandi',
  'gabreiss_',
];

const FONTES_NOTICIAS = [
  'https://blog.anthropic.com',
  'https://blog.google',
  'https://ai.meta.com/blog',
  'https://the-decoder.com',
  'https://huggingface.co/blog',
  'https://techcrunch.com/category/artificial-intelligence',
  'https://exame.com/tecnologia',
];

async function rasparPerfis() {
  console.log('📱 Buscando posts dos perfis de referência...');

  const run = await client.actor('apify/instagram-scraper').call({
    directUrls: PERFIS.map(p => `https://www.instagram.com/${p}/`),
    resultsType: 'posts',
    resultsLimit: 3, // 3 posts mais recentes por perfil
    addParentData: false,
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  // Filtra posts das últimas 48h
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const recentes = items.filter(post => {
    const ts = new Date(post.timestamp).getTime();
    return ts > cutoff;
  });

  console.log(`  → ${recentes.length} posts nas últimas 48h (de ${items.length} total)`);

  return recentes.map(post => ({
    perfil: post.ownerUsername,
    caption: post.caption?.slice(0, 400) || '',
    likes: post.likesCount,
    comments: post.commentsCount,
    url: post.url,
    data: post.timestamp,
  }));
}

async function rasparNoticias() {
  console.log('📰 Buscando notícias dos últimos 2 dias...');

  const run = await client.actor('apify/website-content-crawler').call({
    startUrls: FONTES_NOTICIAS.map(url => ({ url })),
    maxCrawlDepth: 1,
    maxCrawlPages: 5,
    crawlerType: 'cheerio',
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  return items.slice(0, 15).map(page => ({
    titulo: page.metadata?.title || page.url,
    url: page.url,
    resumo: page.text?.slice(0, 300) || '',
  }));
}

async function main() {
  const output = {
    gerado_em: new Date().toISOString(),
    posts_referencia: [],
    noticias: [],
  };

  try {
    output.posts_referencia = await rasparPerfis();
  } catch (err) {
    console.warn('  ⚠ Erro ao raspar perfis:', err.message);
  }

  try {
    output.noticias = await rasparNoticias();
  } catch (err) {
    console.warn('  ⚠ Erro ao buscar notícias:', err.message);
  }

  const dest = path.join(ROOT, '_contexto', 'referencias-do-dia.json');
  fs.mkdirSync(path.join(ROOT, '_contexto'), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(output, null, 2));

  console.log(`\n✓ Salvo em _contexto/referencias-do-dia.json`);
  console.log(`  Posts de referência: ${output.posts_referencia.length}`);
  console.log(`  Notícias: ${output.noticias.length}`);

  // Resumo pro terminal
  if (output.posts_referencia.length > 0) {
    console.log('\n📱 POSTS EM ALTA:');
    output.posts_referencia.forEach(p => {
      console.log(`  @${p.perfil} — ${p.likes} likes — ${p.caption.slice(0, 80)}...`);
    });
  }

  if (output.noticias.length > 0) {
    console.log('\n📰 NOTÍCIAS:');
    output.noticias.forEach(n => {
      console.log(`  ${n.titulo.slice(0, 80)}`);
    });
  }

  return output;
}

main().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
