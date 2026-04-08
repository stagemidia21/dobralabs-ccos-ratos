/**
 * gerar-story.mjs
 * Gera conteúdo de story via Claude, renderiza como PNG e publica no Instagram
 *
 * Uso: node scripts/gerar-story.mjs "<tema>" [--so-gerar] [--so-publicar <id>]
 *
 * Exemplos:
 *   node scripts/gerar-story.mjs "planos e preços Stage Mídia"
 *   node scripts/gerar-story.mjs "método de tráfego pago" --so-gerar
 *   node scripts/gerar-story.mjs "" --so-publicar story-planos-2026-04-08
 *
 * Tipos de conteúdo de story que funciona bem:
 *   - Apresentação de plano/preço
 *   - Explicação de método/processo
 *   - Oferta direta de serviço
 *   - Bastidores / prova social
 *   - CTA direto
 */

import 'dotenv/config';
import { execFileSync, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { humanizarJSON } from './humanizer-rules.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REMOTION_DIR = path.join(ROOT, 'projetos/carrossel-remotion');
const SRC_DIR = path.join(REMOTION_DIR, 'src');
const OUT_DIR = path.join(REMOTION_DIR, 'out');
const STORIES_DIR = path.join(__dirname, 'stories');
const FRAMES_PER_SLIDE = 300;

const API_KEY = process.env.POSTFORME_API_KEY;
const BASE_URL = 'https://api.postforme.dev';
const IG_USER_ID = '26285906407703501';
const IG_API = 'https://graph.instagram.com';
const THREADS_API = 'https://graph.threads.net';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const authHeaders = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

const FOTOS_STORY = ['opt_c.jpg', 'opt_d.jpg', 'opt_b.jpg', 'opt1.jpg', 'opt2.jpg'];

function escolherFoto() {
  const dia = new Date().getDate();
  return FOTOS_STORY[dia % FOTOS_STORY.length];
}

function callClaude(prompt, timeout = 120000) {
  return execFileSync('claude', ['-p', prompt], {
    cwd: ROOT, timeout, encoding: 'utf8', maxBuffer: 1024 * 1024 * 5,
  }).trim();
}

async function sendTelegram(text) {
  if (!BOT_TOKEN || !CHAT_ID) return;
  for (const chunk of (text.match(/[\s\S]{1,4000}/g) || [text])) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: chunk }),
    });
    await new Promise(r => setTimeout(r, 300));
  }
}

async function getTokens() {
  const r = await fetch(`${BASE_URL}/v1/social-accounts`, { headers: authHeaders });
  const d = await r.json();
  const accs = d.data || d;
  return {
    ig:   accs.find(a => a.platform === 'instagram').access_token,
    th:   accs.find(a => a.platform === 'threads').access_token,
    thId: accs.find(a => a.platform === 'threads').user_id,
  };
}

async function uploadImagem(filePath, filename) {
  const r = await fetch(`${BASE_URL}/v1/media/create-upload-url`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ file_name: filename, content_type: 'image/png' }),
  });
  if (!r.ok) throw new Error(`Upload URL falhou: ${await r.text()}`);
  const { upload_url, media_url } = await r.json();
  const putR = await fetch(upload_url, {
    method: 'PUT', headers: { 'Content-Type': 'image/png' },
    body: fs.readFileSync(filePath),
  });
  if (!putR.ok) throw new Error(`PUT falhou: ${putR.status}`);
  return media_url;
}

async function publicarStoryInstagram(token, imageUrl) {
  const r = await fetch(`${IG_API}/${IG_USER_ID}/media`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'IMAGE',
      image_url: imageUrl,
      media_product_type: 'STORY',
      access_token: token,
    }),
  });
  const d = await r.json();
  if (d.error) throw new Error(`Container story falhou: ${JSON.stringify(d.error)}`);

  const start = Date.now();
  while (Date.now() - start < 60000) {
    await new Promise(r => setTimeout(r, 3000));
    const sr = await fetch(`${IG_API}/${d.id}?fields=status_code&access_token=${token}`);
    const sd = await sr.json();
    if (sd.status_code === 'FINISHED') break;
    if (sd.status_code === 'ERROR') throw new Error(`Container story falhou`);
    process.stdout.write('.');
  }

  const pr = await fetch(`${IG_API}/${IG_USER_ID}/media_publish`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: d.id, access_token: token }),
  });
  const pd = await pr.json();
  if (pd.error) throw new Error(`Publicação story falhou: ${JSON.stringify(pd.error)}`);
  return pd.id;
}

function gerarConteudo(tema) {
  const prompt = `Você é o assistente de conteúdo do @homero.ads (Stage Mídia). Tom: direto, comercial, sem coach. Português BR. Sem padrões de IA.

Tema do story: ${tema}

O story tem objetivo de venda ou apresentação de serviço. Gere de 3 a 6 slides.

Retorne EXATAMENTE este JSON (sem markdown, sem explicação):
{
  "slides": [
    { "tipo": "capa", "title": "TÍTULO IMPACTANTE\\nEM ATÉ 3 LINHAS", "subtitulo": "frase de gancho curta", "tag": "label opcional ex: PLANOS / MÉTODO / SERVIÇO" },
    { "tipo": "corpo", "label": "label curta", "titulo": "PONTO PRINCIPAL\\nEM CAPS", "corpo": "2-3 frases diretas explicando o benefício ou o que está sendo oferecido" },
    { "tipo": "corpo", "label": "label curta", "titulo": "OUTRO PONTO\\nEM CAPS", "corpo": "2-3 frases diretas" },
    { "tipo": "cta", "cta": "CHAMADA DIRETA\\nPRO LINK NA BIO", "sub": "frase de apoio curta" }
  ],
  "legenda": "legenda pra story no Instagram, 80-150 palavras, primeira pessoa, sem hashtags"
}

Regras: títulos em CAPS com \\n pra quebrar linha, corpo sem bullet, legenda curta e direta.`;

  const raw = callClaude(prompt);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Claude não retornou JSON válido: ' + raw.slice(0, 200));
  return JSON.parse(match[0]);
}

async function executar(tema) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const slug = tema.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30).replace(/-+$/, '');
  const storyId = `story-${slug}-${dateStr}`;

  console.log(`\n📸 Gerando story: ${tema}`);
  await sendTelegram(`⏳ Gerando story...\n${tema}`);

  // 1. Gera conteúdo via Claude
  console.log('  Gerando conteúdo...');
  let data = gerarConteudo(tema);
  console.log(`  ✓ ${data.slides.length} slides gerados`);

  // 1b. Humaniza textos
  console.log('  Humanizando textos...');
  data = humanizarJSON(data);
  console.log(`  ✓ Humanizado`);

  // 2. Salva JSON dos dados
  fs.mkdirSync(STORIES_DIR, { recursive: true });
  const foto = escolherFoto();
  data.foto = foto;
  fs.writeFileSync(path.join(STORIES_DIR, `${storyId}.json`), JSON.stringify(data, null, 2));
  console.log(`  ✓ Dados salvos: stories/${storyId}.json`);

  // 3. Cria JSX
  const compId = `Story_${storyId.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const jsxContent = `import { StoryDinamico } from './StoryDinamico.jsx';

const SLIDES = ${JSON.stringify(data.slides, null, 2)};

export function ${compId}() {
  return <StoryDinamico slides={SLIDES} foto={${JSON.stringify(foto)}} />;
}
`;
  fs.writeFileSync(path.join(SRC_DIR, `${compId}.jsx`), jsxContent);
  console.log(`  ✓ JSX criado: ${compId}.jsx`);

  // 4. Registra no Root.jsx
  let root = fs.readFileSync(path.join(SRC_DIR, 'Root.jsx'), 'utf8');
  if (!root.includes(compId)) {
    root = root.replace(
      "import { StoryDinamico } from './StoryDinamico.jsx';",
      `import { StoryDinamico } from './StoryDinamico.jsx';\nimport { ${compId} } from './${compId}.jsx';`
    );
    root = root.replace(
      "      {/* Story 9:16 — dinâmico */}",
      `      <Composition id="${compId}" component={${compId}} durationInFrames={${FRAMES_PER_SLIDE * data.slides.length}} fps={30} width={1080} height={1920} />\n\n      {/* Story 9:16 — dinâmico */}`
    );
    fs.writeFileSync(path.join(SRC_DIR, 'Root.jsx'), root);
    console.log(`  ✓ Registrado no Root.jsx`);
  }

  // 5. Renderiza PNGs
  const outDir = path.join(OUT_DIR, 'stories', storyId);
  fs.mkdirSync(outDir, { recursive: true });
  const remotionBin = path.join(REMOTION_DIR, 'node_modules/.bin/remotion.cmd');

  console.log(`  Renderizando ${data.slides.length} slides...`);
  for (let i = 0; i < data.slides.length; i++) {
    const frame = i * FRAMES_PER_SLIDE + 60;
    const num = String(i + 1).padStart(2, '0');
    const outFile = path.join(outDir, `slide-${num}.png`).replace(/\//g, '\\');
    process.stdout.write(`    Slide ${num}... `);
    execSync(
      `"${remotionBin}" still ${compId} "${outFile}" --frame=${frame} --log=error`,
      { cwd: REMOTION_DIR, stdio: 'pipe', shell: true }
    );
    console.log('OK');
  }

  if (process.argv.includes('--so-gerar')) {
    console.log(`\n✅ PNGs gerados em: out/stories/${storyId}/`);
    console.log(`   Pra publicar: node scripts/gerar-story.mjs "" --so-publicar ${storyId}`);
    return;
  }

  // 6. Upload + publicar
  const tokens = await getTokens();
  console.log('  Fazendo upload...');
  const imageUrls = [];
  const pngs = fs.readdirSync(outDir).filter(f => f.endsWith('.png')).sort();
  for (const png of pngs) {
    process.stdout.write(`    ${png}... `);
    const url = await uploadImagem(path.join(outDir, png), png);
    imageUrls.push(url);
    console.log('OK');
  }

  console.log('  Publicando stories no Instagram...');
  const igIds = [];
  for (let i = 0; i < imageUrls.length; i++) {
    process.stdout.write(`    Story ${i + 1}/${imageUrls.length}... `);
    const id = await publicarStoryInstagram(tokens.ig, imageUrls[i]);
    igIds.push(id);
    console.log(`OK (${id})`);
    if (i < imageUrls.length - 1) await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n✅ ${igIds.length} stories publicados!`);
  await sendTelegram(`✅ Story publicado!\n${igIds.length} slides\n\n${tema}`);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

const soPublicarIdx = process.argv.indexOf('--so-publicar');
if (soPublicarIdx !== -1) {
  // Só publicar PNGs já gerados
  const storyId = process.argv[soPublicarIdx + 1];
  if (!storyId) { console.error('Informe o ID do story'); process.exit(1); }
  // Delega pro publicar-story.mjs
  const { execFileSync: exec } = await import('child_process');
  exec('node', [path.join(__dirname, 'publicar-story.mjs'), storyId], { stdio: 'inherit' });
} else {
  const tema = process.argv[2];
  if (!tema) { console.error('Informe o tema do story'); process.exit(1); }
  executar(tema).catch(err => {
    console.error('Erro:', err.message);
    process.exit(1);
  });
}
