/**
 * gerar-e-publicar.mjs
 * Gera JSX de carrossel, renderiza 10 slides e publica — tudo automático
 * Uso: node scripts/gerar-e-publicar.mjs <numero_post>
 * Ex:  node scripts/gerar-e-publicar.mjs 1
 */

import 'dotenv/config';
import { execFileSync, execSync } from 'child_process';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { humanizarJSON } from './humanizer-rules.mjs';
import { salvarCarrossel, lerHistorico } from './obsidian.mjs';

const _require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PAUTA_FILE = path.join(ROOT, '_contexto/pauta-do-dia.json');
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

function gerarHTML(slide, slideIndex, totalSlides) {
  const progressWidth = Math.round(((slideIndex + 1) / totalSlides) * 100);
  const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const nl2br = s => esc(s).replace(/\\n/g, '<br>');

  let content = '';
  if (slide.tipo === 'capa') {
    content = `
      <div class="logo">@homero.ads</div>
      <div class="slide-num">${slideIndex + 1}/${totalSlides}</div>
      <div class="overlay"></div>
      <div class="capa-inner">
        <h1 class="capa-title">${nl2br(slide.title)}</h1>
        ${slide.fonte ? `<div class="fonte">${esc(slide.fonte)}</div>` : ''}
      </div>
      <div class="accent-bar"></div>`;
  } else if (slide.tipo === 'texto') {
    content = `
      <div class="logo">@homero.ads</div>
      <div class="slide-num">${slideIndex + 1}/${totalSlides}</div>
      <div class="overlay"></div>
      <div class="texto-inner">
        ${slide.label ? `<div class="label">${esc(slide.label)}</div>` : ''}
        <h2 class="texto-title">${nl2br(slide.title)}</h2>
        <p class="body-text">${esc(slide.body)}</p>
      </div>
      <div class="progress-bar" style="width:${progressWidth}%"></div>`;
  } else if (slide.tipo === 'cta') {
    content = `
      <div class="logo">@homero.ads</div>
      <div class="overlay"></div>
      <div class="cta-inner">
        <div class="cta-label">PRÓXIMO PASSO</div>
        <div class="cta-btn">${esc(slide.cta)}</div>
        <div class="cta-follow">Siga @homero.ads para mais conteúdo</div>
      </div>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Syne:wght@700;800&family=Space+Grotesk:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1080px;overflow:hidden}
body{background:#0B0B0B;color:#fff;font-family:'Space Grotesk',system-ui,sans-serif;position:relative}
.overlay{position:absolute;inset:0;background:linear-gradient(135deg,rgba(11,11,11,.92) 0%,rgba(11,11,11,.70) 100%)}
.logo{position:absolute;top:48px;left:60px;color:#F05A1A;font-family:'Syne',Impact,sans-serif;font-size:26px;font-weight:800;letter-spacing:1px;z-index:10}
.slide-num{position:absolute;top:48px;right:60px;color:rgba(255,255,255,.35);font-size:20px;z-index:10;font-family:'Syne',sans-serif}
.capa-inner{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:130px 60px 90px;z-index:10}
.capa-title{font-family:'Bebas Neue',Impact,'Arial Black',sans-serif;font-size:104px;line-height:.95;color:#fff;text-transform:uppercase;max-width:960px}
.fonte{margin-top:36px;color:#F05A1A;font-size:22px;font-family:'Syne',sans-serif;font-weight:700;letter-spacing:1px}
.accent-bar{position:absolute;bottom:0;left:0;right:0;height:5px;background:#F05A1A;z-index:10}
.texto-inner{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:130px 60px 80px;z-index:10}
.label{color:#F05A1A;font-family:'Syne',sans-serif;font-weight:700;font-size:22px;letter-spacing:3px;text-transform:uppercase;margin-bottom:28px}
.texto-title{font-family:'Bebas Neue',Impact,'Arial Black',sans-serif;font-size:82px;line-height:.95;color:#fff;text-transform:uppercase;margin-bottom:36px;max-width:960px}
.body-text{color:rgba(255,255,255,.88);font-size:32px;line-height:1.55;max-width:960px;font-family:'Space Grotesk',sans-serif;font-weight:400}
.progress-bar{position:absolute;bottom:0;left:0;height:5px;background:#F05A1A;z-index:10}
.cta-inner{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;z-index:10;gap:40px;padding:60px}
.cta-label{color:rgba(255,255,255,.45);font-family:'Syne',sans-serif;font-weight:700;font-size:22px;letter-spacing:4px}
.cta-btn{background:#F05A1A;color:#fff;padding:28px 72px;font-family:'Syne',sans-serif;font-weight:800;font-size:38px;border-radius:8px;text-align:center;box-shadow:0 0 48px rgba(240,90,26,.45)}
.cta-follow{color:rgba(255,255,255,.45);font-size:26px;font-family:'Space Grotesk',sans-serif}
</style></head><body>${content}</body></html>`;
}

async function renderizarSlides(slides, slidesDir) {
  const { chromium } = _require('/opt/node22/lib/node_modules/playwright');
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1080, height: 1080 });
  for (let i = 0; i < slides.length; i++) {
    const html = gerarHTML(slides[i], i, slides.length);
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });
    const num = String(i + 1).padStart(2, '0');
    await page.screenshot({ path: path.join(slidesDir, `slide-${num}.jpg`), type: 'jpeg', quality: 90 });
    process.stdout.write(`    Slide ${num}... OK\n`);
  }
  await browser.close();
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

  // 2. Renderiza slides via Playwright
  const foto = escolherFoto(tema, numPost);
  registrarUso(foto);
  console.log('  Renderizando slides...');
  await renderizarSlides(dados.slides, slidesDir);
  console.log(`  ✓ ${dados.slides.length} slides renderizados`);

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
    let tema, angulo, fonte = '';
    try {
      const pauta = JSON.parse(fs.readFileSync(PAUTA_FILE, 'utf8'));
      if (pauta.data === new Date().toDateString()) {
        const post = pauta.posts.find(p => p.n === numArg);
        if (post) {
          tema = post.tema.replace(/^\*{0,2}\s*`?([^`]+)`?\s*\*{0,2}$/, '$1').trim();
          angulo = post.angulo;
          fonte = post.fonte || '';
        }
      }
    } catch {}
    if (!tema) {
      const p = POSTS_HOJE[numArg - 1];
      tema = p.tema; angulo = p.angulo;
    }
    await processarPost(numArg, tema, angulo, fonte);
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
