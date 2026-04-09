/**
 * rotina-diaria.mjs
 * Rotina automática diária @homero.ads
 *
 * Fluxo:
 *   1. Busca referências (posts virais + notícias)
 *   2. Gera pauta de 10 carrosseis via Claude
 *   3. Publica 1 post a cada 90 minutos (7h → 21h30)
 *
 * PM2 cron: inicia às 7h, posts saem ao longo do dia
 * Uso manual: node scripts/rotina-diaria.mjs [--post N]
 */

import 'dotenv/config';
import { execSync, execFileSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;
const PAUTA_FILE = path.join(ROOT, '_contexto/pauta-do-dia.json');
const CACHE_FILE = path.join(ROOT, '_contexto/referencias-do-dia.json');

// Intervalo entre posts: 90 minutos
const INTERVALO_MS = 90 * 60 * 1000;

// ─── CLAUDE ──────────────────────────────────────────────────────────────────

const CLAUDE_BIN = process.platform === 'win32'
  ? path.join(process.env.USERPROFILE || 'C:/Users/homer', '.local/bin/claude.exe')
  : '/home/' + (process.env.USER || 'homer') + '/.local/bin/claude';

function callClaude(prompt, timeout = 120000) {
  return execFileSync(CLAUDE_BIN, ['-p', prompt], {
    cwd: ROOT, timeout, encoding: 'utf8', maxBuffer: 1024 * 1024 * 5,
  }).trim();
}

// ─── TELEGRAM ────────────────────────────────────────────────────────────────

async function tg(text) {
  if (!BOT_TOKEN || !CHAT_ID) return;
  for (const chunk of (text.match(/[\s\S]{1,4000}/g) || [text])) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: chunk }),
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 300));
  }
}

// ─── REFERÊNCIAS ─────────────────────────────────────────────────────────────

function buscarReferencias() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (new Date(cache.gerado_em).toDateString() === new Date().toDateString()) {
        console.log('  ✓ Referências: cache de hoje');
        return cache;
      }
    }
    console.log('  Coletando referências via Apify...');
    execSync(`node ${path.join(ROOT, 'scripts/buscar-referencias.mjs')}`, {
      cwd: ROOT, stdio: 'ignore', timeout: 180000,
    });
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch (err) {
    console.log(`  ⚠ Sem referências externas: ${err.message}`);
    return null;
  }
}

// ─── PAUTA ───────────────────────────────────────────────────────────────────

function gerarPauta(referencias) {
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  const refsTexto = referencias
    ? `\nPOSTS EM ALTA (últimas 48h):\n${referencias.posts_referencia.map(p =>
        `@${p.perfil} (${p.comments} comentários): ${p.caption.slice(0, 150)}`
      ).join('\n')}\n\nNOTÍCIAS:\n${referencias.noticias.map(n => `• ${n.titulo}`).join('\n')}`
    : '';

  const prompt = `Você é o estrategista de conteúdo do @homero.ads (Homero Zanichelli — Stage Mídia).
Público-alvo: empresários donos de PME que querem usar IA pra crescer e gestor de tráfego pago.
Linha editorial: IA aplicada a negócios reais, tráfego pago, automação, Claude Code OS.
Tom: técnico, direto, sem coach, sem motivacional. Português BR.
Hoje: ${hoje}
${refsTexto}

Gere a pauta de 10 CARROSSEIS VÍDEO (sem texto antes/depois, sem story, sem feed).
Cada carrossel vira um vídeo de 10 slides publicado em todas as redes.

POST 1 | CARROSSEL VÍDEO
Tema: [max 80 chars]
Ângulo: [abordagem específica diferente dos concorrentes, max 200 chars]

POST 2 | CARROSSEL VÍDEO
Tema: ...
Ângulo: ...

POST 3 | CARROSSEL VÍDEO
Tema: ...
Ângulo: ...

POST 4 | CARROSSEL VÍDEO
Tema: ...
Ângulo: ...

POST 5 | CARROSSEL VÍDEO
Tema: ...
Ângulo: ...

POST 6 | CARROSSEL VÍDEO
Tema: ...
Ângulo: ...

POST 7 | CARROSSEL VÍDEO
Tema: ...
Ângulo: ...

POST 8 | CARROSSEL VÍDEO
Tema: ...
Ângulo: ...

POST 9 | CARROSSEL VÍDEO
Tema: ...
Ângulo: ...

POST 10 | CARROSSEL VÍDEO
Tema: ...
Ângulo: ...

Regras:
- Pelo menos 2 baseados em notícia do dia
- Pelo menos 1 sobre Claude Code
- Pelo menos 1 sobre tráfego pago / Meta Ads / Google Ads
- Ângulos DIFERENTES entre si, nunca repetir abordagem
- Foco em resultado prático para empresário, nunca teoria`;

  return callClaude(prompt, 120000);
}

function parsePauta(texto) {
  const posts = [];
  for (let n = 1; n <= 10; n++) {
    const linhas = texto.split('\n');
    const idx = linhas.findIndex(l => l.match(new RegExp(`POST ${n}\\s*\\|`)));
    if (idx === -1) continue;
    const bloco = linhas.slice(idx, idx + 6).join('\n');
    const tema   = (bloco.match(/Tema:\s*(.+)/) || [])[1]?.trim();
    const angulo = (bloco.match(/Ângulo:\s*(.+)/) || [])[1]?.trim() || '';
    if (tema) posts.push({ n, tema, angulo });
  }
  return posts;
}

// ─── PUBLICAR UM POST ─────────────────────────────────────────────────────────

function publicarPost(n, tema, angulo) {
  return new Promise((resolve, reject) => {
    const script = path.join(ROOT, 'scripts/gerar-e-publicar.mjs');
    const proc = spawn('node', [script, '--tema', tema, '--angulo', angulo, '--num', String(n)], {
      cwd: ROOT, stdio: 'inherit',
    });
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`Post ${n} saiu com código ${code}`)));
  });
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const postArg = parseInt(process.argv[process.argv.indexOf('--post') + 1]);
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  console.log(`\n🚀 Rotina diária @homero.ads — ${hoje}`);
  await tg(`🚀 Rotina iniciada — ${hoje}\n10 carrosseis vídeo ao longo do dia`);

  // 1. Referências
  console.log('\n📡 Buscando referências...');
  const refs = buscarReferencias();

  // 2. Pauta — gera ou carrega do dia
  let posts = [];
  if (fs.existsSync(PAUTA_FILE)) {
    const salva = JSON.parse(fs.readFileSync(PAUTA_FILE, 'utf8'));
    if (salva.data === new Date().toDateString()) {
      posts = salva.posts;
      console.log(`  ✓ Pauta de hoje carregada (${posts.length} posts)`);
    }
  }

  if (posts.length === 0) {
    console.log('\n📋 Gerando pauta...');
    const pautaTexto = gerarPauta(refs);
    posts = parsePauta(pautaTexto);
    fs.writeFileSync(PAUTA_FILE, JSON.stringify({
      data: new Date().toDateString(),
      gerado_em: new Date().toISOString(),
      posts,
      texto: pautaTexto,
    }, null, 2));
    console.log(`  ✓ ${posts.length} posts na pauta`);

    // Manda pauta no Telegram pra review
    let resumo = `📋 *PAUTA DO DIA — ${hoje}*\n\n`;
    posts.forEach(p => { resumo += `*${p.n}.* ${p.tema}\n`; });
    resumo += `\n⏱ Publicação: 1 post a cada 90min\n🎬 Todos como carrossel vídeo`;
    await tg(resumo);
  }

  // 3. Roda posts em sequência com intervalo
  const postsFiltrados = postArg ? posts.filter(p => p.n === postArg) : posts;

  for (let i = 0; i < postsFiltrados.length; i++) {
    const post = postsFiltrados[i];

    console.log(`\n▶ Post ${post.n}/10: ${post.tema}`);

    try {
      await publicarPost(post.n, post.tema, post.angulo);
    } catch (err) {
      console.error(`  ✗ Falhou: ${err.message}`);
      await tg(`❌ Post ${post.n} falhou: ${err.message}`);
    }

    // Aguarda 90min antes do próximo (exceto no último)
    if (i < postsFiltrados.length - 1) {
      const proxHora = new Date(Date.now() + INTERVALO_MS);
      console.log(`\n⏳ Próximo post às ${proxHora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}...`);
      await tg(`⏳ Post ${post.n} publicado. Próximo em 90 minutos.`);
      await new Promise(r => setTimeout(r, INTERVALO_MS));
    }
  }

  console.log('\n🎉 Rotina do dia concluída!');
  await tg(`🎉 Rotina concluída!\n${postsFiltrados.length} posts publicados hoje.`);
}

main().catch(async err => {
  console.error('Erro fatal:', err.message);
  await tg(`💥 Rotina falhou: ${err.message}`).catch(() => {});
  process.exit(1);
});
