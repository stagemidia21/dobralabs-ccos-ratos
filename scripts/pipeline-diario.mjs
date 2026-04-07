/**
 * pipeline-diario.mjs
 * Pipeline automático de conteúdo — @homero.ads
 * Usa Claude Code CLI (OAuth) como LLM — sem custo de API
 *
 * 1. Busca referências via Apify (cache diário)
 * 2. Gera pauta com 6 posts
 * 3. Gera conteúdo completo de cada post
 * 4. Salva na vault do Obsidian
 * 5. Envia tudo pro Telegram
 */

import 'dotenv/config';
import { execSync, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const VAULT = 'C:\\Users\\homer\\OneDrive\\Documentos\\Backup\\Homero Note\\@homero.ads';

// ─── TELEGRAM ───────────────────────────────────────────────────────────────

async function sendTelegram(text) {
  if (!BOT_TOKEN || !CHAT_ID) return;
  const chunks = text.match(/[\s\S]{1,4000}/g) || [text];
  for (const chunk of chunks) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: chunk }),
    });
  }
}

// ─── CLAUDE CLI ──────────────────────────────────────────────────────────────

function callClaude(prompt, maxWait = 120000) {
  try {
    const result = execFileSync('claude', ['-p', prompt], {
      cwd: ROOT,
      timeout: maxWait,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 5, // 5MB
    });
    return result.trim();
  } catch (err) {
    throw new Error(`Claude CLI falhou: ${err.message}`);
  }
}

// ─── REFERÊNCIAS ─────────────────────────────────────────────────────────────

async function buscarReferencias() {
  const cacheFile = path.join(ROOT, '_contexto', 'referencias-do-dia.json');
  if (fs.existsSync(cacheFile)) {
    const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (new Date(cache.gerado_em).toDateString() === new Date().toDateString()) {
      console.log('✓ Cache de referências de hoje disponível');
      return cache;
    }
  }
  console.log('📡 Buscando referências via Apify...');
  execSync(`node ${path.join(ROOT, 'scripts/buscar-referencias.mjs')}`, {
    cwd: ROOT,
    stdio: 'inherit',
    timeout: 180000,
  });
  return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
}

// ─── GERAÇÃO DE PAUTA ────────────────────────────────────────────────────────

function gerarPauta(refs) {
  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const refsTexto = refs
    ? `\nPOSTS EM ALTA (últimas 48h):\n${refs.posts_referencia.map(p =>
        `@${p.perfil}: ${p.caption.slice(0, 150)}`
      ).join('\n')}\n\nNOTÍCIAS DO DIA:\n${refs.noticias.map(n =>
        `• ${n.titulo}`
      ).join('\n')}`
    : '';

  const prompt = `Você é o assistente de pauta do @homero.ads (Homero Zanichelli — Stage Mídia).
Linha editorial: Claude Code OS — IA aplicada a negócios, tráfego pago e automação.
Tom: técnico, direto, sem enrolação, sem teoria. Português BR.
Hoje: ${hoje}
${refsTexto}

Gere APENAS a pauta com 6 posts no formato exato abaixo (sem texto antes ou depois):

POST 1 | FEED
Tema: [tema direto]
Ângulo: [como abordar — diferente dos concorrentes]
Fonte: [notícia/série Claude Code/viral]

POST 2 | CARROSSEL IMAGEM
Tema: ...
Ângulo: ...
Fonte: ...

POST 3 | CARROSSEL VÍDEO
Tema: ...
Ângulo: ...
Fonte: ...

POST 4 | FEED
Tema: ...
Ângulo: ...
Fonte: ...

POST 5 | CARROSSEL IMAGEM
Tema: ...
Ângulo: ...
Fonte: ...

POST 6 | CARROSSEL VÍDEO
Tema: ...
Ângulo: ...
Fonte: ...

Regras: pelo menos 1 post de Claude Code, pelo menos 1 baseado em notícia do dia, ângulos diferentes dos concorrentes, nunca repetir ângulo no mesmo dia.`;

  console.log('📋 Gerando pauta...');
  return callClaude(prompt);
}

// ─── GERAÇÃO DE CONTEÚDO ─────────────────────────────────────────────────────

function gerarConteudo(tema, angulo, formato) {
  const desc = {
    feed: 'post de feed Instagram: copy de 200-350 palavras, técnica e direta, com CTA específico e hashtags relevantes',
    carrossel: `10 slides de carrossel imagem. Formato de cada slide:
SLIDE N — [Label curta]
Título: [CAPS, máx 4 linhas, impactante]
Body: [2-3 frases densas, sem enrolação]
Incluir legenda completa ao final.`,
    carrossel_video: `10 slides de carrossel vídeo. Formato de cada slide:
SLIDE N — [Label curta]
Título: [CAPS, máx 4 linhas, usa \\n pra quebrar linha]
Body: [3-5 frases, mais denso que imagem]
Incluir legenda completa ao final.`,
  }[formato];

  const prompt = `Você é o assistente de conteúdo do @homero.ads (Homero Zanichelli — Stage Mídia).
Tom: técnico, direto, premium. Sem enrolação. Português BR com acentuação correta.
Evitar: padrões de IA, bullets desnecessários, frases genéricas, experiência não confirmada pelo usuário.
Posicionamento: "Sou o cara que entra quando a agência diz que já fez de tudo."

Tema: ${tema}
Ângulo: ${angulo}
Formato: ${desc}

Gere o conteúdo completo, direto ao ponto.`;

  return callClaude(prompt, 180000);
}

// ─── VAULT ──────────────────────────────────────────────────────────────────

function salvarVault(pauta, posts) {
  const dataStr = new Date().toISOString().slice(0, 10);
  const pastaVault = path.join(VAULT, 'pautas');
  fs.mkdirSync(pastaVault, { recursive: true });

  let md = `# Pauta ${dataStr}\n\nGerado automaticamente pelo pipeline-diario.mjs\n\n`;
  md += `## Pauta do Dia\n\n${pauta}\n\n---\n\n## Conteúdos Gerados\n\n`;
  posts.forEach(p => {
    md += `### Post ${p.n} — ${p.formato.toUpperCase()}\n\n`;
    md += `**Tema:** ${p.tema}\n**Ângulo:** ${p.angulo}\n\n`;
    md += p.conteudo ? `${p.conteudo}\n\n` : `❌ Falhou: ${p.erro}\n\n`;
    md += '---\n\n';
  });

  const dest = path.join(pastaVault, `pauta-${dataStr}.md`);
  fs.writeFileSync(dest, md);
  console.log(`✓ Salvo em vault: pauta-${dataStr}.md`);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  const dataStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  console.log(`\n🚀 Pipeline Diário — ${dataStr}\n`);

  await sendTelegram(`🚀 Pipeline iniciado — ${dataStr}\n⏳ Buscando referências...`);

  // 1. Referências
  let refs = null;
  try {
    refs = await buscarReferencias();
    console.log(`✓ ${refs.posts_referencia.length} posts, ${refs.noticias.length} notícias`);
  } catch (err) {
    console.warn('⚠ Sem referências externas:', err.message);
    await sendTelegram(`⚠️ Apify falhou, continuando sem referências: ${err.message}`);
  }

  // 2. Pauta
  let pauta;
  try {
    pauta = gerarPauta(refs);
    console.log('✓ Pauta gerada');
    await sendTelegram(`📋 PAUTA DO DIA — ${dataStr}\n\n${pauta}`);
  } catch (err) {
    const msg = `❌ Falha ao gerar pauta: ${err.message}`;
    console.error(msg);
    await sendTelegram(msg);
    process.exit(1);
  }

  // 3. Posts
  const linhas = pauta.split('\n');
  const posts = [];

  console.log('\n📝 Gerando conteúdo dos 6 posts...');
  await sendTelegram('📝 Gerando conteúdo dos 6 posts...');

  for (let n = 1; n <= 6; n++) {
    const idx = linhas.findIndex(l => l.match(new RegExp(`^POST ${n}\\s*\\|`)));
    if (idx === -1) {
      console.warn(`⚠ POST ${n} não encontrado`);
      posts.push({ n, tema: '?', angulo: '', formato: 'feed', conteudo: null, erro: 'não encontrado na pauta' });
      continue;
    }

    const bloco = linhas.slice(idx, idx + 6).join('\n');
    const linhaPost = linhas[idx];
    let formato = 'feed';
    if (linhaPost.includes('CARROSSEL VÍDEO') || linhaPost.includes('CARROSSEL VIDEO')) formato = 'carrossel_video';
    else if (linhaPost.includes('CARROSSEL IMAGEM')) formato = 'carrossel';

    const tema = (bloco.match(/Tema:\s*(.+)/) || [])[1]?.trim() || 'tema';
    const angulo = (bloco.match(/Ângulo:\s*(.+)/) || [])[1]?.trim() || '';

    console.log(`  Post ${n} (${formato}): ${tema}`);

    try {
      const conteudo = gerarConteudo(tema, angulo, formato);
      posts.push({ n, tema, angulo, formato, conteudo });
      console.log(`  ✓ Post ${n} gerado`);

      // Envia pro Telegram imediatamente
      await sendTelegram(`📝 POST ${n} — ${formato.toUpperCase()}\nTema: ${tema}\n\n${conteudo}`);
    } catch (err) {
      console.error(`  ✗ Post ${n} falhou: ${err.message}`);
      posts.push({ n, tema, angulo, formato, conteudo: null, erro: err.message });
      await sendTelegram(`❌ Post ${n} falhou: ${err.message}`);
    }
  }

  // 4. Vault
  try {
    salvarVault(pauta, posts);
  } catch (err) {
    console.warn('⚠ Erro ao salvar vault:', err.message);
  }

  // 5. Resumo final
  const ok = posts.filter(p => p.conteudo).length;
  const resumo = `✅ Pipeline concluído — ${ok}/6 posts gerados\n\n` +
    posts.map(p => `${p.conteudo ? '✓' : '✗'} Post ${p.n} (${p.formato}): ${p.tema}`).join('\n');

  console.log(`\n${resumo}`);
  await sendTelegram(resumo);
}

main().catch(async err => {
  console.error('Erro fatal:', err);
  await sendTelegram(`💥 Pipeline falhou: ${err.message}`).catch(() => {});
  process.exit(1);
});
