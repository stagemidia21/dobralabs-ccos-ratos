import 'dotenv/config';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REMOTION_DIR = path.join(ROOT, 'projetos/carrossel-remotion');
const OUT_DIR = path.join(REMOTION_DIR, 'out/post2');
const REMOTION_BIN = path.join(REMOTION_DIR, 'node_modules/.bin/remotion.cmd');

const API_KEY = process.env.POSTFORME_API_KEY;
const BASE_URL = 'https://api.postforme.dev';
const CONTAS = [
  'spc_OLQYtgi2qkckhJPbA56y6',
  'spc_suZlmVRdsUuK7uoKZ2sp',
  'spc_ICb28Y2xx1WbjQDLcXVmN',
  'spc_tvTRNzPUZtWkxx7yzGwW',
  'spc_e80YbEcrp7zDHltQlBCl',
];
const authHeaders = { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' };

const LEGENDA = `Sempre que falo de Claude Code, alguém pergunta: qual a diferença entre Claude, Claude Code e a API?

São três coisas diferentes. O chat você já conhece. O Claude Code é outro bicho — roda no terminal, acessa seus arquivos e opera dentro da sua estrutura. A API é pra quem está construindo produto: precisa de código pra chamar o modelo.

Se você tem agência, começa pelo Claude Code. É onde fica o contexto dos clientes e a memória da operação. Tudo que o chat joga fora quando você fecha a aba.

Se está começando, o chat ainda resolve. O problema aparece quando você percebe que está explicando o mesmo histórico toda sessão.

#ClaudeCode #IAparaAgências #MarketingDigital #GestãoComIA #StageMidia`;

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
  console.log('\n🎬 Post 2 — Claude vs Claude Code vs Claude API\n');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Renderizando 10 slides...');
  for (let i = 0; i < 10; i++) {
    const start = i * 300;
    const end = start + 299;
    const num = String(i + 1).padStart(2, '0');
    const outFile = path.join(OUT_DIR, `slide-${num}.mp4`).replace(/\//g, '\\');
    process.stdout.write(`  Slide ${num}... `);
    if (fs.existsSync(path.join(OUT_DIR, `slide-${num}.mp4`))) { console.log('já existe, pulando'); continue; }
    execSync(`"${REMOTION_BIN}" render PostDia2 "${outFile}" --frames=${start}-${end} --concurrency=1 --log=error`,
      { cwd: REMOTION_DIR, stdio: 'pipe', shell: true });
    console.log('OK');
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log('\nFazendo upload...');
  const slides = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.mp4')).sort();
  const mediaUrls = [];
  for (const s of slides) {
    process.stdout.write(`  Upload ${s}... `);
    const url = await uploadSlide(path.join(OUT_DIR, s), s);
    mediaUrls.push(url);
    console.log('OK');
  }

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
  console.log(`\n✅ Post 2 publicado! ID: ${data.id}`);
}

main().catch(err => { console.error('Erro:', err.message); process.exit(1); });
