/**
 * gerar-e-publicar.mjs
 * Gera JSX de carrossel, renderiza 10 slides e publica — tudo automático
 * Uso: node scripts/gerar-e-publicar.mjs <numero_post>
 * Ex:  node scripts/gerar-e-publicar.mjs 1
 */

import 'dotenv/config';
import { execFileSync, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { humanizarJSON } from './humanizer-rules.mjs';
import { salvarCarrossel, lerHistorico } from './obsidian.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REMOTION_DIR = path.join(ROOT, 'projetos/carrossel-remotion');
const PUBLIC_DIR = path.join(REMOTION_DIR, 'public');
const SRC_DIR = path.join(REMOTION_DIR, 'src');
const OUT_DIR = path.join(REMOTION_DIR, 'out');

const API_KEY = process.env.POSTFORME_API_KEY;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const BASE_URL = 'https://api.postforme.dev';
const CONTAS = [
  'spc_OLQYtgi2qkckhJPbA56y6', // instagram
  'spc_suZlmVRdsUuK7uoKZ2sp',  // threads
  'spc_ICb28Y2xx1WbjQDLcXVmN', // facebook
  'spc_tvTRNzPUZtWkxx7yzGwW',  // linkedin Stage
  'spc_e80YbEcrp7zDHltQlBCl',  // linkedin Homero
];
const authHeaders = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

// Mapa de foto por tema (escolhe a mais relevante)
const FOTOS = {
  default: 'opt_b.jpg',      // foto escura, boa pra texto
  dev:     'opt_c.jpg',      // tech/dark
  google:  'capa-gemma4-hero.jpg',
  agente:  'opt_d.jpg',
  claude:  'opt_b.jpg',
  limite:  'opt_c.jpg',
  codigo:  'capa-vibe-coding.jpg',
};

// Rotação com histórico — nunca repete o mesmo fundo na mesma semana
const FOTOS_FALLBACK = ['opt_c.jpg', 'opt_b.jpg', 'opt_d.jpg', 'opt1.jpg', 'opt2.jpg', 'opt3.jpg'];
const FUNDOS_DIR = path.join(PUBLIC_DIR, 'fundos');
const HISTORICO_PATH = path.join(ROOT, '_contexto/fundos-historico.json');

function listarFundos() {
  if (fs.existsSync(FUNDOS_DIR)) {
    const arquivos = fs.readdirSync(FUNDOS_DIR)
      .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
      .sort();
    if (arquivos.length > 0) return arquivos.map(f => `fundos/${f}`);
  }
  return FOTOS_FALLBACK;
}

function carregarHistorico() {
  try { return JSON.parse(fs.readFileSync(HISTORICO_PATH, 'utf8')); } catch { return {}; }
}

function registrarUso(foto) {
  const h = carregarHistorico();
  h[foto] = new Date().toISOString();
  fs.mkdirSync(path.dirname(HISTORICO_PATH), { recursive: true });
  fs.writeFileSync(HISTORICO_PATH, JSON.stringify(h, null, 2));
}

function escolherFoto(tema, numPost = 0) {
  const banco = listarFundos();
  const historico = carregarHistorico();
  const umaSemana = 7 * 24 * 60 * 60 * 1000;
  const agora = Date.now();

  // Ordena pelo uso mais antigo (ou nunca usadas primeiro)
  const ordenadas = [...banco].sort((a, b) => {
    const ua = historico[a] ? new Date(historico[a]).getTime() : 0;
    const ub = historico[b] ? new Date(historico[b]).getTime() : 0;
    return ua - ub;
  });

  // Pega a que foi usada há mais tempo (ou nunca)
  const escolhida = ordenadas[numPost % ordenadas.length] || banco[0];
  return escolhida;
}

const CLAUDE_BIN = process.platform === 'win32'
  ? path.join(process.env.USERPROFILE || 'C:/Users/homer', '.local/bin/claude.exe')
  : '/home/' + (process.env.USER || 'homer') + '/.local/bin/claude';

function callClaude(prompt, timeout = 180000) {
  // Run from /tmp to avoid loading project CLAUDE.md which causes Claude to
  // respond about git state instead of the actual prompt.
  return execFileSync(CLAUDE_BIN, ['-p', prompt], {
    cwd: '/tmp', timeout, encoding: 'utf8', maxBuffer: 1024 * 1024 * 5,
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

// Gera o JSX do carrossel usando CarrosselDinamico + JSON.stringify
// Assim apóstrofes e aspas no texto NUNCA quebram o esbuild
function gerarJSX(compId, foto, slides) {
  const slidesJson = JSON.stringify(slides, null, 2);
  return `import { CarrosselDinamico } from './CarrosselDinamico.jsx';

const SLIDES = ${slidesJson};

export function ${compId}() {
  return <CarrosselDinamico slides={SLIDES} foto={${JSON.stringify(foto)}} />;
}
`;
}

// Gera os dados dos slides via Claude
function gerarSlides(tema, angulo, fonte, legenda) {
  const historico = lerHistorico(14);
  const fonteTexto = fonte ? `\nFONTE/NOTÍCIA ORIGINAL:\n${fonte}\n` : '';

  const prompt = `Você é o criador de conteúdo do @homero.ads — Homero Zanichelli, fundador da Stage Mídia.
Tom: técnico, direto, primeira pessoa quando natural. Português BR. Sem padrões de IA, sem coach, sem motivacional.
Público: empresários donos de PME, gestores de tráfego com 2+ anos de experiência. NÃO é iniciante, NÃO é dev.

REGRAS EDITORIAIS OBRIGATÓRIAS:
- NUNCA citar concorrentes do Homero (outras agências, outros gestores, outros criadores de conteúdo de marketing)
- Se o tema veio de uma notícia, cobrir os fatos completos — não resumir nem pular partes importantes
- Campo "fonte" na capa: citar a fonte real (ex: "Fonte: The New York Times", "Fonte: TechCrunch", "Fonte: Meta Newsroom"). Se não tiver fonte externa, usar "Stage Mídia"
- Body de cada slide: denso, com dado concreto ou situação real — não frase vaga
- Cada slide deve ter uma ideia completa, não metade de um raciocínio

${historico}
${fonteTexto}
Tema: ${tema}
Ângulo: ${angulo}

Gere EXATAMENTE este JSON (sem markdown, sem explicação):
{
  "slides": [
    { "tipo": "capa", "title": "TÍTULO EM CAPS\\nATÉ 4 LINHAS\\nCOM \\\\n", "fonte": "Fonte: [nome da fonte real]" },
    { "tipo": "texto", "label": "label curta", "title": "TÍTULO\\nEM CAPS", "body": "2-4 frases diretas com dado concreto" },
    { "tipo": "texto", "label": "label curta", "title": "TÍTULO\\nEM CAPS", "body": "2-4 frases diretas com dado concreto" },
    { "tipo": "texto", "label": "label curta", "title": "TÍTULO\\nEM CAPS", "body": "2-4 frases diretas com dado concreto" },
    { "tipo": "texto", "label": "label curta", "title": "TÍTULO\\nEM CAPS", "body": "2-4 frases diretas com dado concreto" },
    { "tipo": "texto", "label": "label curta", "title": "TÍTULO\\nEM CAPS", "body": "2-4 frases diretas com dado concreto" },
    { "tipo": "texto", "label": "label curta", "title": "TÍTULO\\nEM CAPS", "body": "2-4 frases diretas com dado concreto" },
    { "tipo": "texto", "label": "label curta", "title": "TÍTULO\\nEM CAPS", "body": "2-4 frases diretas com dado concreto" },
    { "tipo": "texto", "label": "label curta", "title": "TÍTULO\\nEM CAPS", "body": "2-4 frases diretas com dado concreto" },
    { "tipo": "cta", "cta": "texto do botão CTA curto e direto" }
  ],
  "legenda": "legenda completa pra Instagram, 200-300 palavras, primeira pessoa, contextualiza o tema, termina com CTA claro, exatamente 5 hashtags no final"
}

CRÍTICO: o array "slides" deve ter EXATAMENTE 10 elementos — nem mais, nem menos.
Títulos em CAPS, usar \\n pra quebrar linha, máximo 4 linhas por título, body sem bullet.`;

  // Tenta até 3 vezes — JSON inválido e ETIMEDOUT são intermitentes
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      if (tentativa > 1) {
        console.log(`    (retry ${tentativa - 1} geração...)`);
        execSync(`node -e "setTimeout(()=>{},${5000 * tentativa})"`, { shell: true });
      }
      const raw = callClaude(prompt, tentativa === 3 ? 240000 : 180000);
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Sem JSON no output');
      // Sanitiza caracteres de controle dentro de strings JSON antes de parsear
      const sanitized = match[0].replace(/("(?:[^"\\]|\\.)*")/g, m =>
        m.replace(/[\x00-\x1f]/g, c => {
          if (c === '\n') return '\\n';
          if (c === '\r') return '\\r';
          if (c === '\t') return '\\t';
          return '';
        })
      );
      const parsed = JSON.parse(sanitized);
      // Garante exatamente 10 slides — trunca se Claude mandar mais
      if (parsed.slides && parsed.slides.length > 10) {
        parsed.slides = parsed.slides.slice(0, 10);
      }
      return parsed;
    } catch (err) {
      if (tentativa >= 3) throw new Error('Claude não retornou JSON válido após 3 tentativas: ' + err.message);
    }
  }
}

async function uploadSlide(filePath, filename) {
  const r = await fetch(`${BASE_URL}/v1/media/create-upload-url`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ file_name: filename, content_type: 'image/jpeg' }),
  });
  if (!r.ok) throw new Error(`Upload URL falhou: ${await r.text()}`);
  const { upload_url, media_url } = await r.json();
  const putR = await fetch(upload_url, {
    method: 'PUT', headers: { 'Content-Type': 'image/jpeg' },
    body: fs.readFileSync(filePath),
  });
  if (!putR.ok) throw new Error(`PUT falhou: ${putR.status}`);
  return media_url;
}

// IDs das contas conectadas no PostForMe
const CONTAS_PFM = {
  instagram:       'spc_OLQYtgi2qkckhJPbA56y6',
  threads:         'spc_suZlmVRdsUuK7uoKZ2sp',
  facebook:        'spc_ICb28Y2xx1WbjQDLcXVmN',
  linkedin_homero: 'spc_e80YbEcrp7zDHltQlBCl',
  linkedin_stage:  'spc_tvTRNzPUZtWkxx7yzGwW',
  tiktok_business: 'spc_fGSQlvGbOwkpoDuKWBWxs',
  pinterest:       'spc_rJdrDhfjsUVrPxhQqA3z',
};

async function publicarTodas(mediaUrls, legenda) {
  const r = await fetch(`${BASE_URL}/v1/social-posts`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      caption: legenda,
      media: mediaUrls.map(url => ({ url })),
      social_accounts: Object.values(CONTAS_PFM),
    }),
  });
  if (!r.ok) throw new Error(`PostForMe falhou: ${await r.text()}`);
  return await r.json();
}

async function aguardarResultados(postId, timeoutMs = 120000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    await new Promise(r => setTimeout(r, 5000));
    const r = await fetch(`${BASE_URL}/v1/social-posts/${postId}/results`, { headers: authHeaders });
    if (!r.ok) break;
    const d = await r.json();
    const results = d.data || d;
    if (Array.isArray(results) && results.length > 0) return results;
  }
  return [];
}

async function processarPost(numPost, tema, angulo, fonte = '') {
  const compId = `PostDia${numPost}`;
  const slidesDir = path.join(OUT_DIR, `post${numPost}`);
  fs.mkdirSync(slidesDir, { recursive: true });

  console.log(`\n🎬 Post ${numPost}: ${tema}`);
  await sendTelegram(`⏳ Post ${numPost}/6 — Gerando conteúdo...\n${tema}`);

  // 1. Gera slides via Claude
  console.log('  Gerando slides...');
  let dados;
  try {
    dados = gerarSlides(tema, angulo, fonte, '');
  } catch (err) {
    throw new Error(`Geração falhou: ${err.message}`);
  }
  console.log(`  ✓ ${dados.slides.length} slides gerados`);

  // 1b. Humaniza textos
  console.log('  Humanizando textos...');
  dados = humanizarJSON(dados);
  console.log(`  ✓ Humanizado`);

  // 2. Escolhe fundo do banco de fotos
  const foto = escolherFoto(tema, numPost);
  registrarUso(foto);
  const jsx = gerarJSX(compId, foto, dados.slides);
  const jsxPath = path.join(SRC_DIR, `${compId}.jsx`);
  fs.writeFileSync(jsxPath, jsx);
  console.log(`  ✓ JSX criado: ${compId}.jsx (fundo: ${foto})`);

  // 3. Registra no Root.jsx
  let root = fs.readFileSync(path.join(SRC_DIR, 'Root.jsx'), 'utf8');
  if (!root.includes(compId)) {
    root = root.replace(
      "import { SlideFeed1, SlideFeed4 } from './SlideFeed.jsx';",
      `import { SlideFeed1, SlideFeed4 } from './SlideFeed.jsx';\nimport { ${compId} } from './${compId}.jsx';`
    );
    // Adiciona composition antes do TikTok
    root = root.replace(
      "      {/* TikTok / Reels 9:16 */}",
      `      <Composition id="${compId}" component={${compId}} durationInFrames={SLIDE_DURATION_FRAMES * ${dados.slides.length}} fps={FPS} width={INSTAGRAM.width} height={INSTAGRAM.height} />\n\n      {/* TikTok / Reels 9:16 */}`
    );
    fs.writeFileSync(path.join(SRC_DIR, 'Root.jsx'), root);
    console.log(`  ✓ Registrado no Root.jsx`);
  }

  // 4. Renderiza os slides como imagem estática (remotion still)
  const FRAMES_PER_SLIDE = 300; // 10s × 30fps — usado só pra calcular frame do meio
  const remotionBin = path.join(REMOTION_DIR, 'node_modules/.bin/remotion.cmd');
  console.log('  Renderizando slides (imagem)...');
  for (let i = 0; i < dados.slides.length; i++) {
    const frameDoMeio = i * FRAMES_PER_SLIDE + Math.floor(FRAMES_PER_SLIDE / 2);
    const num = String(i + 1).padStart(2, '0');
    const outFile = path.join(slidesDir, `slide-${num}.jpg`);
    const outFileWin = outFile.replace(/\//g, '\\');
    const cmd = `"${remotionBin}" still ${compId} "${outFileWin}" --frame=${frameDoMeio} --image-format=jpeg --jpeg-quality=90 --log=error`;

    let tentativa = 0;
    while (tentativa < 3) {
      try {
        process.stdout.write(`    Slide ${num}${tentativa > 0 ? ` (retry ${tentativa})` : ''}... `);
        if (tentativa > 0) await new Promise(r => setTimeout(r, 3000 * tentativa));
        execSync(cmd, { cwd: REMOTION_DIR, stdio: 'pipe', shell: true });
        console.log('OK');
        break;
      } catch (err) {
        tentativa++;
        if (tentativa >= 3) throw new Error(`Slide ${num} falhou após 3 tentativas: ${err.message.slice(0, 100)}`);
        console.log(`falhou, retry ${tentativa}...`);
      }
    }
  }

  // 5. Upload + publicar
  if (DRY_RUN) {
    const slides = fs.readdirSync(slidesDir).filter(f => f.endsWith('.jpg')).sort();
    console.log(`  🧪 DRY RUN — ${slides.length} slides em ${slidesDir}`);
    console.log(`  Legenda: ${dados.legenda.slice(0, 120)}...`);
    console.log(`  ✅ Post ${numPost} (dry run) — nada publicado.`);
    return 'dry-run';
  }

  console.log('  Publicando...');
  const slides = fs.readdirSync(slidesDir).filter(f => f.endsWith('.jpg')).sort();
  const mediaUrls = [];
  for (const s of slides) {
    process.stdout.write(`    Upload ${s}... `);
    const url = await uploadSlide(path.join(slidesDir, s), s);
    mediaUrls.push(url);
    console.log('OK');
  }

  process.stdout.write('  Publicando em todas as redes... ');
  const pfmPost = await publicarTodas(mediaUrls, dados.legenda);
  const pfmId = pfmPost.id || pfmPost.external_id || 'ok';
  console.log(`OK (${pfmId})`);

  // Aguarda resultados por plataforma
  const resultados = await aguardarResultados(pfmId);
  const redes = ['instagram', 'threads', 'facebook', 'linkedin_homero', 'linkedin_stage', 'tiktok_business', 'pinterest'];
  if (resultados.length > 0) {
    resultados.forEach(r => {
      const status = r.status === 'success' ? 'OK' : `ERRO: ${r.error_message || r.status}`;
      console.log(`    ${r.platform || r.social_account?.platform}: ${status}`);
    });
  } else {
    redes.forEach(r => console.log(`    ${r}: processando...`));
  }

  const igId = resultados.find(r => r.platform === 'instagram')?.external_id || pfmId;

  // Salva no Obsidian
  try {
    salvarCarrossel(dados, { tema, foto: escolherFoto(tema, numPost), numPost, igId, plataformas: Object.keys(CONTAS_PFM) });
  } catch(e) { console.log(`  ⚠ Obsidian: ${e.message}`); }

  // Limpa slides do post após publicar — libera disco
  try {
    fs.rmSync(slidesDir, { recursive: true, force: true });
    console.log(`  🗑 Slides removidos (${slidesDir})`);
  } catch(e) { console.log(`  ⚠ Limpeza: ${e.message}`); }

  console.log(`  ✅ Post ${numPost} concluído!`);
  await sendTelegram(`✅ Post ${numPost}/6 publicado em todas as redes!\n\nLegenda:\n${dados.legenda}`);

  return igId;
}

// ─── PAUTA DE HOJE ──────────────────────────────────────────────────────────

const POSTS_HOJE = [
  {
    tema: 'Claude Code não é só pra dev — é pra quem opera negócio',
    angulo: 'Mostrar o lado do gestor/dono de agência: usar pra redigir proposta, montar relatório, criar SOP, automatizar briefing. Claude Code como sistema operacional do negócio, não do código.',
  },
  {
    tema: 'O que é Claude, Claude Code e Claude API — e quando usar cada um',
    angulo: 'Virar pelo lado prático de negócio: qual dos 3 você deveria estar usando se tem agência ou vende serviço? Cada slide = uma situação real de quem vende serviço.',
  },
  {
    tema: 'Google + IA em 2026: o que mudou de verdade pra quem faz tráfego pago',
    angulo: 'O que isso significa pra quem roda campanha no Google Ads hoje? Performance Max, Smart Bidding, lances automáticos — onde a IA já decide e onde ainda precisa de gestor.',
  },
  {
    tema: 'Por que Claude Code explodiu agora — e não há 2 anos',
    angulo: 'O que mudou no comportamento do consumidor de IA que tornou isso mainstream agora? Custo de token caiu, contexto expandiu, o usuário ficou mais exigente. A ferramenta já estava lá — a demanda é que chegou.',
  },
  {
    tema: 'Os 5 limites reais do Claude que travam seu workflow (e como contornar)',
    angulo: 'Traduzir pra realidade de agência: sem memória entre sessões, sem dados em tempo real, sem execução autônoma, sem integração nativa. Cada limite com workaround prático que Homero já usa.',
  },
  {
    tema: 'Como montar um agente de IA que trabalha enquanto você dorme — passo a passo real',
    angulo: 'Fluxo concreto: briefing de cliente entra via WhatsApp → n8n processa → Claude redige relatório → entrega no Notion. Sem buzzword. Só o fluxo, as ferramentas, o tempo economizado.',
  },
];

// ─── LOCK FILE — serializa processos, evita Bun crash por concorrência ────────

const LOCK_FILE = path.join(ROOT, '_contexto/publish.lock');
const LOCK_MAX_AGE = 40 * 60 * 1000; // 40 min — stale lock

async function acquireLock() {
  while (fs.existsSync(LOCK_FILE)) {
    try {
      const lock = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
      const age = Date.now() - new Date(lock.started).getTime();
      if (age > LOCK_MAX_AGE) {
        console.log('  ⚠ Lock expirado, removendo...');
        fs.unlinkSync(LOCK_FILE);
        break;
      }
      console.log(`  ⏳ Aguardando lock do post ${lock.num || '?'} (${Math.round(age / 60000)}min)...`);
      await new Promise(r => setTimeout(r, 20000));
    } catch { break; }
  }
  fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, started: new Date().toISOString(), num: numArg || temaArg }));
}

function releaseLock() {
  try { fs.unlinkSync(LOCK_FILE); } catch {}
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
// Uso:
//   node gerar-e-publicar.mjs --tema "tema" --angulo "angulo" [--num N]
//   node gerar-e-publicar.mjs N          → post N da pauta hardcoded (legado)
//   node gerar-e-publicar.mjs            → todos os 6 da pauta hardcoded

function getArg(name) {
  const idx = process.argv.indexOf(name);
  return idx !== -1 ? process.argv[idx + 1] : null;
}

const temaArg   = getArg('--tema');
const anguloArg = getArg('--angulo');
const fonteArg  = getArg('--fonte');
const numArg    = parseInt(getArg('--num') || process.argv[2]);
const DRY_RUN   = process.argv.includes('--dry-run');

async function main() {
  await acquireLock();

  // Garante que o lock é liberado em qualquer saída
  process.on('exit', releaseLock);
  process.on('SIGINT', () => { releaseLock(); process.exit(1); });
  process.on('SIGTERM', () => { releaseLock(); process.exit(1); });
  process.on('uncaughtException', (err) => { releaseLock(); console.error(err); process.exit(1); });

  if (temaArg) {
    // Chamada dinâmica vinda do bot
    const num = (!isNaN(numArg) && numArg >= 1) ? numArg : 1;
    await processarPost(num, temaArg, anguloArg || '', fonteArg || '');
  } else if (!isNaN(numArg) && numArg >= 1 && numArg <= 6) {
    // Post específico da pauta hardcoded
    const p = POSTS_HOJE[numArg - 1];
    await processarPost(numArg, p.tema, p.angulo);
  } else {
    // Todos os 6 da pauta hardcoded
    await sendTelegram('🚀 Iniciando produção dos 6 posts do dia...');
    for (let i = 0; i < POSTS_HOJE.length; i++) {
      const p = POSTS_HOJE[i];
      try {
        await processarPost(i + 1, p.tema, p.angulo);
      } catch (err) {
        console.error(`  ✗ Post ${i + 1} falhou: ${err.message}`);
        await sendTelegram(`❌ Post ${i + 1} falhou: ${err.message}`);
      }
    }
    await sendTelegram('🎉 Produção do dia concluída!');
  }
}

main().catch(async err => {
  console.error('Erro fatal:', err.message);
  await sendTelegram(`💥 Erro: ${err.message}`).catch(() => {});
  process.exit(1);
});
