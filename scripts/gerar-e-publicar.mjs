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

function escolherFoto(tema) {
  const t = tema.toLowerCase();
  if (t.includes('google') || t.includes('tráfego') || t.includes('ads')) return FOTOS.google;
  if (t.includes('agente') || t.includes('dorme') || t.includes('n8n')) return FOTOS.agente;
  if (t.includes('vibe') || t.includes('código') || t.includes('codigo')) return FOTOS.codigo;
  if (t.includes('limite') || t.includes('workflow')) return FOTOS.limite;
  return FOTOS.dev;
}

function callClaude(prompt, timeout = 180000) {
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

// Gera o JSX do carrossel com SlideCapaFoto + SlideTexto × 8 + SlideCTA
function gerarJSX(compId, foto, slides) {
  const D = 'SLIDE_DURATION_FRAMES';

  const sequences = slides.map((s, i) => {
    if (i === 0) {
      // Capa
      return `
      <Sequence from={0} durationInFrames={${D}}>
        <SlideCapaFoto
          imageSrc="${foto}"
          title={"${s.title.replace(/"/g, '\\"')}"}
          fonte="${s.fonte || 'Fonte: @homero.ads'}"
          slideNum={1} total={${slides.length}}
        />
      </Sequence>`;
    }
    if (i === slides.length - 1) {
      // CTA
      return `
      <Sequence from={${i} * ${D}} durationInFrames={${D}}>
        <SlideCTA
          handle="@homero.ads"
          sub="IA aplicada a resultados reais"
          cta="${s.cta || 'Seguir agora'}"
        />
      </Sequence>`;
    }
    // Slide texto
    return `
      <Sequence from={${i} * ${D}} durationInFrames={${D}}>
        <SlideTexto
          label="${s.label.replace(/"/g, '\\"')}"
          title={"${s.title.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"}
          body={"${s.body.replace(/"/g, '\\"').replace(/\n/g, ' ').replace(/\r/g, '')}"}
          slideNum={${i + 1}} total={${slides.length}}
        />
      </Sequence>`;
  });

  return `import { Sequence } from 'remotion';
import { SlideCapaFoto } from './slides/SlideCapaFoto.jsx';
import { SlideTexto } from './slides/SlideTexto.jsx';
import { SlideCTA } from './slides/SlideCTA.jsx';
import { SLIDE_DURATION_FRAMES } from './tokens.js';

export function ${compId}() {
  return (
    <>
      ${sequences.join('\n')}
    </>
  );
}
`;
}

// Gera os dados dos slides via Claude
function gerarSlides(tema, angulo, fonte, legenda) {
  const prompt = `Você é o assistente de conteúdo do @homero.ads (Stage Mídia). Tom: técnico, direto, sem coach. Português BR. Sem padrões de IA.

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

Regras: títulos em CAPS, usar \\n pra quebrar linha, máximo 4 linhas por título, body sem bullet, legenda sem padrões de IA.`;

  const raw = callClaude(prompt);
  // Extrai JSON mesmo se vier com texto ao redor
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Claude não retornou JSON válido: ' + raw.slice(0, 200));
  return JSON.parse(match[0]);
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

async function publicar(mediaUrls, legenda) {
  const res = await fetch(`${BASE_URL}/v1/social-posts`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({
      caption: legenda,
      social_accounts: CONTAS,
      media: mediaUrls.map(url => ({ url })),
      platform_configurations: { instagram: { placement: 'timeline' } },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data.id;
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

  // 2. Cria JSX
  const foto = escolherFoto(tema);
  const jsx = gerarJSX(compId, foto, dados.slides);
  const jsxPath = path.join(SRC_DIR, `${compId}.jsx`);
  fs.writeFileSync(jsxPath, jsx);
  console.log(`  ✓ JSX criado: ${compId}.jsx`);

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
  console.log('  Renderizando slides...');
  for (let i = 0; i < dados.slides.length; i++) {
    const start = i * FRAMES_PER_SLIDE;
    const end = start + FRAMES_PER_SLIDE - 1;
    const num = String(i + 1).padStart(2, '0');
    const outFile = path.join(slidesDir, `slide-${num}.mp4`);
    process.stdout.write(`    Slide ${num}... `);
    const outFileWin = outFile.replace(/\//g, '\\');
    const remotionBin = path.join(REMOTION_DIR, 'node_modules/.bin/remotion.cmd');
    execSync(
      `"${remotionBin}" render ${compId} "${outFileWin}" --frames=${start}-${end} --log=error`,
      { cwd: REMOTION_DIR, stdio: 'pipe', shell: true }
    );
    console.log('OK');
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

  const postId = await publicar(mediaUrls, dados.legenda);
  console.log(`  ✅ Post ${numPost} publicado! ID: ${postId}`);
  await sendTelegram(`✅ Post ${numPost}/6 publicado!\n\nLegenda:\n${dados.legenda}`);

  return postId;
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

// ─── MAIN ────────────────────────────────────────────────────────────────────

const numArg = parseInt(process.argv[2]);

async function main() {
  if (numArg >= 1 && numArg <= 6) {
    // Roda um post específico
    const p = POSTS_HOJE[numArg - 1];
    await processarPost(numArg, p.tema, p.angulo);
  } else {
    // Roda todos os 6 em sequência
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
