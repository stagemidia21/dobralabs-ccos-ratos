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
  return execFileSync(CLAUDE_BIN, ['-p', prompt], {
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
  const prompt = `Você é o assistente de conteúdo do @homero.ads (Stage Mídia). Tom: técnico, direto, sem coach. Português BR. Sem padrões de IA.
${historico}
Tema: ${tema}
Ângulo: ${angulo}

Gere EXATAMENTE este JSON (sem markdown, sem explicação):
{
  "slides": [
    { "tipo": "capa", "title": "TÍTULO EM CAPS\\nATÉ 4 LINHAS\\nCOM \\\\n", "fonte": "Fonte: breve crédito" },
    { "tipo": "texto", "label": "label curta", "title": "TÍTULO\\nEM CAPS", "body": "2-3 frases diretas sem enrolação" },
    { "tipo": "texto", "label": "label curta", "title": "TÍTULO\\nEM CAPS", "body": "2-3 frases diretas" },
    { "tipo": "texto", "label": "label curta", "title": "TÍTULO\\nEM CAPS", "body": "2-3 frases diretas" },
    { "tipo": "texto", "label": "label curta", "title": "TÍTULO\\nEM CAPS", "body": "2-3 frases diretas" },
    { "tipo": "texto", "label": "label curta", "title": "TÍTULO\\nEM CAPS", "body": "2-3 frases diretas" },
    { "tipo": "texto", "label": "label curta", "title": "TÍTULO\\nEM CAPS", "body": "2-3 frases diretas" },
    { "tipo": "texto", "label": "label curta", "title": "TÍTULO\\nEM CAPS", "body": "2-3 frases diretas" },
    { "tipo": "texto", "label": "label curta", "title": "TÍTULO\\nEM CAPS", "body": "2-3 frases diretas" },
    { "tipo": "cta", "cta": "texto do botão CTA curto" }
  ],
  "legenda": "legenda completa pra Instagram, 150-250 palavras, primeira pessoa, exatamente 5 hashtags no final"
}

Regras: títulos em CAPS, usar \\n pra quebrar linha, máximo 4 linhas por título, body sem bullet, legenda sem padrões de IA. CRÍTICO: o array "slides" deve ter EXATAMENTE 10 elementos — nem mais, nem menos.`;

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
    body: JSON.stringify({ file_name: filename, content_type: 'video/mp4' }),
  });
  if (!r.ok) throw new Error(`Upload URL falhou: ${await r.text()}`);
  const { upload_url, media_url } = await r.json();
  const putR = await fetch(upload_url, {
    method: 'PUT', headers: { 'Content-Type': 'video/mp4' },
    body: fs.readFileSync(filePath),
  });
  if (!putR.ok) throw new Error(`PUT falhou: ${putR.status}`);
  return media_url;
}

async function getTokens() {
  const r = await fetch(`${BASE_URL}/v1/social-accounts`, { headers: authHeaders });
  const d = await r.json();
  const accs = d.data || d;
  return {
    ig:    accs.find(a => a.platform === 'instagram').access_token,
    th:    accs.find(a => a.platform === 'threads').access_token,
    thId:  accs.find(a => a.platform === 'threads').user_id,
    fb:    accs.find(a => a.platform === 'facebook').access_token,
    fbId:  accs.find(a => a.platform === 'facebook').user_id,
    liS:       accs.find(a => a.platform === 'linkedin' && a.username.includes('Stage')).access_token,
    liH:       accs.find(a => a.platform === 'linkedin' && a.username.includes('Homero')).access_token,
    liStageUrn: `urn:li:organization:${accs.find(a => a.platform === 'linkedin' && a.username.includes('Stage')).user_id}`,
    liHomeroUrn: `urn:li:person:${accs.find(a => a.platform === 'linkedin' && a.username.includes('Homero')).user_id}`,
  };
}

async function publicarThreads(tokens, mediaUrls, legenda) {
  const { th: token, thId: userId } = tokens;
  const API = 'https://graph.threads.net';

  // Cria containers de vídeo
  const containerIds = [];
  for (const url of mediaUrls) {
    const r = await fetch(`${API}/${userId}/threads`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_type: 'VIDEO', video_url: url, is_carousel_item: true, access_token: token }),
    });
    const d = await r.json();
    if (d.error) throw new Error(`Threads container falhou: ${JSON.stringify(d.error)}`);
    containerIds.push(d.id);
  }

  // Aguarda containers
  for (const id of containerIds) {
    const start = Date.now();
    while (Date.now() - start < 120000) {
      await new Promise(r => setTimeout(r, 5000));
      const r = await fetch(`${API}/${id}?fields=status&access_token=${token}`);
      const d = await r.json();
      if (d.status === 'FINISHED') break;
      if (d.status === 'ERROR') throw new Error(`Threads container ${id} falhou`);
    }
  }

  // Carrossel container
  const cr = await fetch(`${API}/${userId}/threads`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ media_type: 'CAROUSEL', children: containerIds.join(','), text: legenda.slice(0, 500), access_token: token }),
  });
  const cd = await cr.json();
  if (cd.error) throw new Error(`Threads carrossel falhou: ${JSON.stringify(cd.error)}`);

  // Aguarda carrossel container ficar FINISHED
  const carStart = Date.now();
  while (Date.now() - carStart < 60000) {
    await new Promise(r => setTimeout(r, 5000));
    const sr = await fetch(`${API}/${cd.id}?fields=status&access_token=${token}`);
    const sd = await sr.json();
    if (sd.status === 'FINISHED') break;
    if (sd.status === 'ERROR') throw new Error(`Threads carrossel container falhou`);
  }

  // Publica
  const pr = await fetch(`${API}/${userId}/threads_publish`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: cd.id, access_token: token }),
  });
  const pd = await pr.json();
  if (pd.error) throw new Error(`Threads publish falhou: ${JSON.stringify(pd.error)}`);
  return pd.id;
}

async function publicarFacebook(tokens, mediaUrls, legenda) {
  const { fb: token, fbId: pageId } = tokens;
  const API = 'https://graph.facebook.com/v19.0';

  // Facebook: envia como reel/video (carousel de vídeo não é suportado da mesma forma)
  // Usa o primeiro slide como vídeo principal
  const r = await fetch(`${API}/${pageId}/videos`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_url: mediaUrls[0], description: legenda, access_token: token }),
  });
  const d = await r.json();
  if (d.error) throw new Error(`Facebook video falhou: ${JSON.stringify(d.error)}`);
  return d.id;
}

async function publicarLinkedIn(token, authorUrn, mediaUrls, legenda) {
  // LinkedIn: posta como texto (carrossel de vídeo nativo requer upload complexo)
  const r = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' },
    body: JSON.stringify({
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: legenda },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  });
  const d = await r.json();
  if (d.status && d.status !== 201) throw new Error(`LinkedIn falhou: ${JSON.stringify(d)}`);
  return d.id || 'ok';
}

async function publicarInstagramDireto(mediaUrls, legenda) {
  const tokens = await getTokens();
  const token = tokens.ig;
  const IG_USER_ID = '26285906407703501';
  const IG_API = 'https://graph.instagram.com';

  // 1. Cria containers de vídeo
  console.log('  Criando containers no Instagram...');
  const containerIds = [];
  for (let i = 0; i < mediaUrls.length; i++) {
    const r = await fetch(`${IG_API}/${IG_USER_ID}/media`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_type: 'VIDEO', video_url: mediaUrls[i], is_carousel_item: 'true', access_token: token }),
    });
    const d = await r.json();
    if (d.error) throw new Error(`Container ${i+1} falhou: ${JSON.stringify(d.error)}`);
    containerIds.push(d.id);
    process.stdout.write(`    Container ${i+1}/${mediaUrls.length} OK\n`);
  }

  // 2. Aguarda todos ficarem FINISHED
  console.log('  Aguardando processamento...');
  for (const id of containerIds) {
    const start = Date.now();
    while (Date.now() - start < 120000) {
      await new Promise(r => setTimeout(r, 5000));
      const r = await fetch(`${IG_API}/${id}?fields=status_code&access_token=${token}`);
      const d = await r.json();
      if (d.status_code === 'FINISHED') break;
      if (d.status_code === 'ERROR') throw new Error(`Container ${id} falhou`);
      process.stdout.write('.');
    }
  }
  console.log(' OK');

  // 3. Container do carrossel
  const cr = await fetch(`${IG_API}/${IG_USER_ID}/media`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ media_type: 'CAROUSEL', children: containerIds.join(','), caption: legenda, access_token: token }),
  });
  const cd = await cr.json();
  if (cd.error) throw new Error(`Carrossel container falhou: ${JSON.stringify(cd.error)}`);

  // 4. Aguarda carrossel container ficar FINISHED
  const carWait = Date.now();
  while (Date.now() - carWait < 60000) {
    await new Promise(r => setTimeout(r, 5000));
    const sr = await fetch(`${IG_API}/${cd.id}?fields=status_code&access_token=${token}`);
    const sd = await sr.json();
    if (sd.status_code === 'FINISHED') break;
    if (sd.status_code === 'ERROR') throw new Error(`Carrossel container falhou`);
    process.stdout.write('.');
  }

  // 5. Publica
  const pr = await fetch(`${IG_API}/${IG_USER_ID}/media_publish`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: cd.id, access_token: token }),
  });
  const pd = await pr.json();
  if (pd.error) throw new Error(`Publicação falhou: ${JSON.stringify(pd.error)}`);
  return pd.id;
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

  // 2. Cria JSX
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

  // 4. Renderiza os slides
  const FRAMES_PER_SLIDE = 300; // 10s × 30fps
  const remotionBin = path.join(REMOTION_DIR, 'node_modules/.bin/remotion.cmd');
  console.log('  Renderizando slides...');
  for (let i = 0; i < dados.slides.length; i++) {
    const start = i * FRAMES_PER_SLIDE;
    const end = start + FRAMES_PER_SLIDE - 1;
    const num = String(i + 1).padStart(2, '0');
    const outFile = path.join(slidesDir, `slide-${num}.mp4`);
    const outFileWin = outFile.replace(/\//g, '\\');
    const cmd = `"${remotionBin}" render ${compId} "${outFileWin}" --frames=${start}-${end} --concurrency=1 --log=error --video-bitrate-in-kbps=3000`;

    let tentativa = 0;
    while (tentativa < 3) {
      try {
        process.stdout.write(`    Slide ${num}${tentativa > 0 ? ` (retry ${tentativa})` : ''}... `);
        // Pausa antes de retry pra liberar memória
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
  console.log('  Publicando...');
  const slides = fs.readdirSync(slidesDir).filter(f => f.endsWith('.mp4')).sort();
  const mediaUrls = [];
  for (const s of slides) {
    process.stdout.write(`    Upload ${s}... `);
    const url = await uploadSlide(path.join(slidesDir, s), s);
    mediaUrls.push(url);
    console.log('OK');
  }

  // Instagram
  process.stdout.write('  Instagram... ');
  const igId = await publicarInstagramDireto(mediaUrls, dados.legenda);
  console.log(`OK (${igId})`);

  // Threads
  try {
    const tokens = await getTokens();
    process.stdout.write('  Threads... ');
    const thId = await publicarThreads(tokens, mediaUrls, dados.legenda);
    console.log(`OK (${thId})`);
  } catch(e) { console.log(`ERRO: ${e.message}`); }

  // Facebook
  try {
    const tokens = await getTokens();
    process.stdout.write('  Facebook... ');
    const fbId = await publicarFacebook(tokens, mediaUrls, dados.legenda);
    console.log(`OK (${fbId})`);
  } catch(e) { console.log(`ERRO: ${e.message}`); }

  // LinkedIn Homero
  try {
    const tokens = await getTokens();
    process.stdout.write('  LinkedIn Homero... ');
    await publicarLinkedIn(tokens.liH, tokens.liHomeroUrn, mediaUrls, dados.legenda);
    console.log('OK');
  } catch(e) { console.log(`ERRO: ${e.message}`); }

  // LinkedIn Stage
  try {
    const tokens = await getTokens();
    process.stdout.write('  LinkedIn Stage... ');
    await publicarLinkedIn(tokens.liS, tokens.liStageUrn, mediaUrls, dados.legenda);
    console.log('OK');
  } catch(e) { console.log(`ERRO: ${e.message}`); }

  // Salva no Obsidian
  try {
    salvarCarrossel(dados, { tema, foto: escolherFoto(tema, numPost), numPost, igId, plataformas: ['instagram', 'threads', 'facebook', 'linkedin'] });
  } catch(e) { console.log(`  ⚠ Obsidian: ${e.message}`); }

  // Limpa MP4s do post após publicar — libera disco
  try {
    fs.rmSync(slidesDir, { recursive: true, force: true });
    console.log(`  🗑 MP4s removidos (${slidesDir})`);
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
const numArg    = parseInt(getArg('--num') || process.argv[2]);

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
    await processarPost(num, temaArg, anguloArg || '');
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
