/**
 * fix-publish-post1.mjs
 * Recuperação: gera legenda e publica post 1 via form-data
 * (slides já renderizados em projetos/carrossel-remotion/out/post1/)
 */

import 'dotenv/config';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SLIDES_DIR = path.join(ROOT, 'projetos/carrossel-remotion/out/post1');
const PAUTA_FILE = path.join(ROOT, '_contexto/pauta-do-dia.json');
const CONTEXTO_DIR = path.join(ROOT, '_contexto');

const API_KEY = process.env.POSTFORME_API_KEY;
const BASE_URL = 'https://api.postforme.dev';
const CLAUDE_BIN = '/home/user/.local/bin/claude';

const CONTAS = [
  'spc_OLQYtgi2qkckhJPbA56y6', // instagram homero.ads
  'spc_suZlmVRdsUuK7uoKZ2sp',  // threads
  'spc_ICb28Y2xx1WbjQDLcXVmN', // facebook
  'spc_tvTRNzPUZtWkxx7yzGwW',  // linkedin Stage Mídia
  'spc_e80YbEcrp7zDHltQlBCl',  // linkedin Homero
];

function gerarLegenda(tema, angulo, fonte) {
  const prompt = `Você é o criador de conteúdo do @homero.ads — Homero Zanichelli, fundador da Stage Mídia.
Tom: técnico, direto, primeira pessoa quando natural. Português BR. Sem padrões de IA, sem coach, sem motivacional.
Público: empresários donos de PME, gestores de tráfego com 2+ anos de experiência. NÃO é iniciante, NÃO é dev.

REGRAS EDITORIAIS OBRIGATÓRIAS:
- NUNCA citar concorrentes do Homero
- Terminar com CTA claro (ex: "Me manda um direct com X e te mostro como fazer isso.")
- Exatamente 5 hashtags no final, em linha separada
- 200-300 palavras, primeira pessoa, texto corrido sem bullet points
- Não começar com "Eu" — variar o início

Tema do carrossel: ${tema}
Ângulo central: ${angulo}
${fonte ? `Fonte: ${fonte}` : ''}

Responda SOMENTE com o texto da legenda — sem JSON, sem markdown, sem explicação.`;

  const raw = execFileSync(CLAUDE_BIN, ['-p', prompt], {
    cwd: '/tmp',
    encoding: 'utf-8',
    timeout: 120000,
    maxBuffer: 1024 * 1024,
  });
  return raw.trim();
}

async function publicarFormData(slides, legenda) {
  const form = new FormData();
  form.append('caption', legenda);
  form.append('type', 'carousel');

  for (const conta of CONTAS) {
    form.append('social_accounts[]', conta);
  }

  for (const slide of slides) {
    form.append('images', fs.createReadStream(slide), {
      filename: path.basename(slide),
      contentType: 'image/jpeg',
    });
  }

  const res = await fetch(`${BASE_URL}/v1/post`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      ...form.getHeaders(),
    },
    body: form,
  });

  const body = await res.text();
  return { status: res.status, ok: res.ok, body };
}

async function main() {
  if (!API_KEY) {
    console.error('✗ POSTFORME_API_KEY não encontrada no .env');
    process.exit(1);
  }

  // Verifica slides
  if (!fs.existsSync(SLIDES_DIR)) {
    console.error(`✗ Diretório de slides não encontrado: ${SLIDES_DIR}`);
    process.exit(1);
  }
  const slides = fs.readdirSync(SLIDES_DIR)
    .filter(f => f.endsWith('.jpg'))
    .sort()
    .map(f => path.join(SLIDES_DIR, f));

  if (slides.length === 0) {
    console.error('✗ Nenhum slide JPEG encontrado');
    process.exit(1);
  }
  console.log(`✓ ${slides.length} slides encontrados`);

  // Lê pauta
  const pauta = JSON.parse(fs.readFileSync(PAUTA_FILE, 'utf-8'));
  const post = pauta.posts.find(p => p.n === 1);
  if (!post) {
    console.error('✗ Post 1 não encontrado na pauta');
    process.exit(1);
  }

  const tema = post.tema.replace(/^\*+\s*`?|`?\s*\*+$/g, '').trim();
  const angulo = post.angulo.replace(/^\*+\s*/, '').trim();
  const fonte = post.fonte ? post.fonte.replace(/^\*+\s*/, '').trim() : '';

  console.log(`\nPost 1: ${tema}`);

  // Gera legenda
  console.log('\nGerando legenda...');
  let legenda;
  for (let i = 1; i <= 2; i++) {
    try {
      legenda = gerarLegenda(tema, angulo, fonte);
      break;
    } catch (err) {
      if (i === 2) { console.error('✗ Falha ao gerar legenda:', err.message); process.exit(1); }
      console.log(`  retry ${i}...`);
    }
  }
  console.log('✓ Legenda gerada');

  // Salva legenda
  const legendaPath = path.join(CONTEXTO_DIR, 'legenda-post1.txt');
  fs.writeFileSync(legendaPath, legenda);
  console.log(`  Salva em: ${legendaPath}`);

  // Publica via form-data
  console.log('\nPublicando via form-data...');
  const result = await publicarFormData(slides, legenda);
  console.log(`  Status: ${result.status}`);
  console.log(`  Resposta: ${result.body.substring(0, 500)}`);

  if (!result.ok) {
    console.error('\n✗ Publicação falhou');
    process.exit(1);
  }

  console.log('\n✅ Post 1 publicado com sucesso!');
  console.log('\nLegenda:\n' + legenda);
}

main().catch(err => { console.error('✗ Erro fatal:', err.message); process.exit(1); });
