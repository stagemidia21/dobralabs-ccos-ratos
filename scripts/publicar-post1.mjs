/**
 * publicar-post1.mjs
 * Renderiza os 10 slides do PostDia1 e publica como carrossel
 */
import 'dotenv/config';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REMOTION_DIR = path.join(ROOT, 'projetos/carrossel-remotion');
const OUT_DIR = path.join(REMOTION_DIR, 'out/post1');
const REMOTION_BIN = path.join(REMOTION_DIR, 'node_modules/.bin/remotion.cmd');

const API_KEY = process.env.POSTFORME_API_KEY;
const BASE_URL = 'https://api.postforme.dev';
const CONTAS = [
  'spc_OLQYtgi2qkckhJPbA56y6', // instagram homero.ads
  'spc_suZlmVRdsUuK7uoKZ2sp',  // threads
  'spc_ICb28Y2xx1WbjQDLcXVmN', // facebook
  'spc_tvTRNzPUZtWkxx7yzGwW',  // linkedin Stage Mídia
  'spc_e80YbEcrp7zDHltQlBCl',  // linkedin Homero
];
const authHeaders = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

const LEGENDA = `Sempre ouvi que Claude Code era coisa de programador. Fui testar sem escrever uma linha de código. Hoje é a ferramenta que mais uso na agência.

Não uso pra gerar código. Uso pra escrever proposta com contexto real do cliente. Pra documentar processo sem transformar isso em reunião de 2 horas. Pra pensar uma estratégia antes de me comprometer com ela.

Tem uma estrutura por baixo disso: cada cliente com pasta própria, CLAUDE.md com as regras da agência, skills configuradas pra cada tipo de entrega. Quando abro uma sessão, o sistema já sabe o que precisa saber.

Dono de agência que acha que IA é só pra quem programa tá perdendo tempo e dinheiro. Simples assim.

#ClaudeCode #GestãoComIA #AgênciasDigitais #MarketingDigital #StageMidia`;

const FRAMES_PER_SLIDE = 300; // 10s × 30fps
const TOTAL_SLIDES = 10;
const COMP_ID = 'PostDia1';

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

async function main() {
  console.log('\n🎬 Post 1 — Claude Code não é só pra dev\n');

  // 1. Cria pasta de saída
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 2. Renderiza cada slide
  console.log('Renderizando 10 slides...');
  for (let i = 0; i < TOTAL_SLIDES; i++) {
    const start = i * FRAMES_PER_SLIDE;
    const end = start + FRAMES_PER_SLIDE - 1;
    const num = String(i + 1).padStart(2, '0');
    const outFile = path.join(OUT_DIR, `slide-${num}.mp4`);
    const outFileWin = outFile.replace(/\//g, '\\');
    process.stdout.write(`  Slide ${num}... `);
    execSync(
      `"${REMOTION_BIN}" render ${COMP_ID} "${outFileWin}" --frames=${start}-${end} --log=error`,
      { cwd: REMOTION_DIR, stdio: 'pipe', shell: true }
    );
    console.log('OK');
  }

  // 3. Upload de cada slide
  console.log('\nFazendo upload...');
  const slides = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.mp4')).sort();
  const mediaUrls = [];
  for (const s of slides) {
    process.stdout.write(`  Upload ${s}... `);
    const url = await uploadSlide(path.join(OUT_DIR, s), s);
    mediaUrls.push(url);
    console.log('OK');
  }

  // 4. Publicar
  console.log('\nPublicando...');
  const res = await fetch(`${BASE_URL}/v1/social-posts`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({
      caption: LEGENDA,
      social_accounts: CONTAS,
      media: mediaUrls.map(url => ({ url })),
      platform_configurations: { instagram: { placement: 'timeline' } },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));

  console.log(`\n✅ Post 1 publicado! ID: ${data.id}`);
}

main().catch(err => { console.error('Erro:', err.message); process.exit(1); });
