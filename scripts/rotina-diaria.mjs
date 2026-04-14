/**
 * rotina-diaria.mjs
 * Rotina automática diária @homero.ads
 *
 * Fluxo:
 *   1. Busca referências (posts virais + notícias)
 *   2. Gera pauta de 3 carrosseis via Claude
 *   3. Publica: 7h, 12h, 18h
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
      ).join('\n')}\n\nNOTÍCIAS DO DIA (com fonte e data):\n${referencias.noticias.map(n =>
        `• ${n.titulo} — Fonte: ${n.fonte || n.veiculo || 'desconhecida'}, ${new Date().toLocaleDateString('pt-BR')}`
      ).join('\n')}`
    : '';

  const prompt = `Você é o estrategista de conteúdo do @homero.ads (Homero Zanichelli — Stage Mídia).
Público-alvo: empresários donos de PME que querem usar IA pra crescer e gestor de tráfego pago.
Linha editorial: IA aplicada a negócios reais, tráfego pago, automação, Claude Code OS.
Tom: técnico, direto, sem coach, sem motivacional. Português BR.
Hoje: ${hoje}
${refsTexto}

Gere a pauta de EXATAMENTE 3 CARROSSEIS VÍDEO — os 3 mais relevantes do dia.
Critério de seleção: potencial de parar o scroll, ângulo diferente do que todo mundo faz, dado concreto no centro.

POST 1 | CARROSSEL VÍDEO — publica às 7h
Tema: [max 80 chars — gancho forte, primeira coisa que o empresário vê de manhã]
Ângulo: [abordagem específica, max 200 chars]
Fonte: [nome do veículo e data, ex: "TechCrunch, 13/04/2026" — ou "Stage Mídia" se não vier de notícia]

POST 2 | CARROSSEL VÍDEO — publica às 12h
Tema: [max 80 chars — pico de atenção do meio-dia]
Ângulo: [abordagem específica, max 200 chars]
Fonte: ...

POST 3 | CARROSSEL VÍDEO — publica às 18h
Tema: [max 80 chars — encerramento do dia útil, empresário saindo do trabalho]
Ângulo: [abordagem específica, max 200 chars]
Fonte: ...

Regras:
- Pelo menos 1 baseado em notícia do dia com dado real (Fonte preenchida)
- Ângulos completamente diferentes entre si
- Pelo menos 1 sobre IA aplicada a negócio ou tráfego pago
- NUNCA repetir tema de posts já publicados nos últimos 14 dias
- Foco em resultado prático para empresário, nunca teoria`;

  // Retry até 3x — Claude CLI pode dar ETIMEDOUT intermitente
  for (let t = 1; t <= 3; t++) {
    try {
      if (t > 1) {
        console.log(`  (retry ${t - 1} pauta...)`);
        execSync(`node -e "setTimeout(()=>{},${8000 * t})"`, { shell: true });
      }
      return callClaude(prompt, t === 3 ? 300000 : 240000);
    } catch (err) {
      if (t >= 3) throw err;
    }
  }
}

// Horários fixos de publicação: 7h, 12h, 18h
const HORARIOS = [7, 12, 18];

function parsePauta(texto) {
  const posts = [];
  for (let n = 1; n <= 3; n++) {
    const linhas = texto.split('\n');
    const idx = linhas.findIndex(l => l.match(new RegExp(`POST ${n}\\s*\\|`)));
    if (idx === -1) continue;
    const bloco = linhas.slice(idx, idx + 8).join('\n');
    const tema   = (bloco.match(/Tema:\s*(.+)/) || [])[1]?.trim();
    const angulo = (bloco.match(/Ângulo:\s*(.+)/) || [])[1]?.trim() || '';
    const fonte  = (bloco.match(/Fonte:\s*(.+)/) || [])[1]?.trim() || 'Stage Mídia';
    if (tema) posts.push({ n, tema, angulo, fonte, hora: HORARIOS[n - 1] });
  }
  return posts;
}

// ─── PUBLICAR UM POST ─────────────────────────────────────────────────────────

function publicarPost(n, tema, angulo, fonte = '') {
  return new Promise((resolve, reject) => {
    const script = path.join(ROOT, 'scripts/gerar-e-publicar.mjs');
    const args = [script, '--tema', tema, '--angulo', angulo, '--num', String(n)];
    if (fonte) args.push('--fonte', fonte);
    const proc = spawn('node', args, { cwd: ROOT, stdio: 'inherit' });
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`Post ${n} saiu com código ${code}`)));
  });
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const postArg = parseInt(process.argv[process.argv.indexOf('--post') + 1]);
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  console.log(`\n🚀 Rotina diária @homero.ads — ${hoje}`);
  await tg(`🚀 Rotina iniciada — ${hoje}\n3 carrosseis vídeo: 7h, 12h, 18h`);

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
    posts.forEach(p => { resumo += `*${p.hora}h* ${p.tema}\n`; });
    resumo += `\n🎬 3 carrosseis vídeo — 7h, 12h, 18h`;
    await tg(resumo);
  }

  // 3. Roda posts nos horários fixos: 7h, 12h, 18h
  const postsFiltrados = postArg ? posts.filter(p => p.n === postArg) : posts;

  for (let i = 0; i < postsFiltrados.length; i++) {
    const post = postsFiltrados[i];

    // Aguarda até o horário agendado (só se não for --post manual)
    if (!postArg && post.hora) {
      const agora = new Date();
      const alvo = new Date();
      alvo.setHours(post.hora, 0, 0, 0);
      const espera = alvo.getTime() - agora.getTime();
      if (espera > 60000) { // só espera se faltam mais de 1 minuto
        console.log(`\n⏳ Aguardando horário do post ${post.n} (${post.hora}h)...`);
        await new Promise(r => setTimeout(r, espera));
      }
    }

    console.log(`\n▶ Post ${post.n}/3 (${post.hora}h): ${post.tema}`);

    try {
      await publicarPost(post.n, post.tema, post.angulo, post.fonte || '');
    } catch (err) {
      console.error(`  ✗ Falhou: ${err.message}`);
      await tg(`❌ Post ${post.n} falhou: ${err.message}`);
    }
  }

  console.log('\n🎉 Rotina do dia concluída!');
  await tg(`🎉 Rotina concluída!\n${postsFiltrados.length}/3 posts publicados hoje.`);
}

main().catch(async err => {
  console.error('Erro fatal:', err.message);
  await tg(`💥 Rotina falhou: ${err.message}`).catch(() => {});
  process.exit(1);
});
