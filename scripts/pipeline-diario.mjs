/**
 * pipeline-diario.mjs
 * Roda todo dia automaticamente:
 * 1. Busca referências (Apify) — usa cache se já rodou hoje
 * 2. Gera pauta com 6 posts via OpenRouter
 * 3. Gera conteúdo completo de cada post
 * 4. Salva tudo na vault do Obsidian
 * 5. Envia resumo pro Telegram com opção de aprovar
 */

import 'dotenv/config';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const VAULT = 'C:\\Users\\homer\\OneDrive\\Documentos\\Backup\\Homero Note\\@homero.ads';

const ai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://stage-midia.com.br',
    'X-Title': 'Pipeline Diário Stage Mídia',
  },
});

async function callAI(system, user, maxTokens = 1500) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user });
  const resp = await ai.chat.completions.create({
    model: 'anthropic/claude-opus-4',
    max_tokens: maxTokens,
    messages,
  });
  return resp.choices[0].message.content;
}

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

async function buscarReferencias() {
  const cacheFile = path.join(ROOT, '_contexto', 'referencias-do-dia.json');
  if (fs.existsSync(cacheFile)) {
    const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (new Date(cache.gerado_em).toDateString() === new Date().toDateString()) {
      console.log('✓ Usando cache de referências de hoje');
      return cache;
    }
  }
  console.log('📡 Buscando referências via Apify...');
  execSync(`node ${path.join(ROOT, 'scripts/buscar-referencias.mjs')}`, { cwd: ROOT, stdio: 'inherit' });
  return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
}

async function gerarPauta(refs) {
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const refsTexto = refs
    ? `POSTS EM ALTA:\n${refs.posts_referencia.map(p => `@${p.perfil}: ${p.caption.slice(0, 150)}`).join('\n')}\n\nNOTÍCIAS:\n${refs.noticias.map(n => `• ${n.titulo}`).join('\n')}`
    : '';

  return callAI(null, `Você é o assistente de pauta do @homero.ads (Stage Mídia). Linha editorial: Claude Code OS — IA aplicada a negócios e tráfego pago. Tom: técnico, direto, sem enrolação.

Hoje: ${hoje}
${refsTexto}

Gere pauta com 6 posts:

POST 1 | 📸 FEED
Tema: ...
Ângulo: ...
Fonte: ...

POST 2 | 🖼 CARROSSEL IMAGEM
Tema: ...
Ângulo: ...
Fonte: ...

POST 3 | 📱 CARROSSEL VÍDEO
Tema: ...
Ângulo: ...
Fonte: ...

POST 4 | 📸 FEED
...

POST 5 | 🖼 CARROSSEL IMAGEM
...

POST 6 | 📱 CARROSSEL VÍDEO
...

Regras: pelo menos 1 Claude Code, pelo menos 1 notícia do dia, ângulos diferentes dos concorrentes.`, 1200);
}

async function gerarConteudo(tema, angulo, formato) {
  const desc = {
    feed: 'post de feed Instagram: copy de 150-300 palavras + CTA + hashtags',
    carrossel: '10 slides de carrossel imagem: SLIDE N — Label + Título em CAPS + Body (2-3 frases)',
    carrossel_video: '10 slides de carrossel vídeo: SLIDE N — Label + Título em CAPS com \\n pra quebrar + Body (3-5 frases)',
  }[formato];

  return callAI(
    'Você é o assistente de conteúdo do @homero.ads. Tom: técnico, direto, premium. Português BR. Sem padrões de IA. Nunca fabricar experiência não confirmada.',
    `Tema: ${tema}\nÂngulo: ${angulo}\nFormato: ${desc}\n\nGere o conteúdo completo.`,
    2500
  );
}

function detectarFormato(linhaPost) {
  if (linhaPost.includes('CARROSSEL VÍDEO') || linhaPost.includes('📱')) return 'carrossel_video';
  if (linhaPost.includes('CARROSSEL IMAGEM') || linhaPost.includes('🖼')) return 'carrossel';
  return 'feed';
}

async function salvarVault(data, posts) {
  const dataStr = new Date().toISOString().slice(0, 10);
  const pastaVault = path.join(VAULT, 'pautas');
  if (!fs.existsSync(pastaVault)) fs.mkdirSync(pastaVault, { recursive: true });

  let md = `# Pauta ${dataStr}\n\n`;
  md += `## Pauta\n\n${data.pauta}\n\n`;
  md += `---\n\n## Conteúdos Gerados\n\n`;
  posts.forEach((p, i) => {
    md += `### Post ${i + 1} — ${p.formato.toUpperCase()}\n\n`;
    md += `**Tema:** ${p.tema}\n**Ângulo:** ${p.angulo}\n\n`;
    md += `${p.conteudo}\n\n---\n\n`;
  });

  const dest = path.join(pastaVault, `pauta-${dataStr}.md`);
  fs.writeFileSync(dest, md);
  console.log(`✓ Salvo em ${dest}`);
}

async function main() {
  const dataStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  console.log(`\n🚀 Pipeline Diário — ${dataStr}\n`);

  await sendTelegram(`🚀 Pipeline iniciado — ${dataStr}\n\n⏳ Buscando referências e gerando pauta...`);

  // 1. Referências
  let refs = null;
  try {
    refs = await buscarReferencias();
    console.log(`✓ ${refs.posts_referencia.length} posts, ${refs.noticias.length} notícias`);
  } catch (err) {
    console.warn('⚠ Sem referências:', err.message);
  }

  // 2. Pauta
  console.log('\n📋 Gerando pauta...');
  const pauta = await gerarPauta(refs);
  console.log('✓ Pauta gerada');

  // 3. Posts
  const linhas = pauta.split('\n');
  const posts = [];

  console.log('\n📝 Gerando conteúdo dos 6 posts...');
  for (let n = 1; n <= 6; n++) {
    const idx = linhas.findIndex(l => l.match(new RegExp(`POST ${n}\\s*\\|`)));
    if (idx === -1) {
      console.warn(`⚠ Post ${n} não encontrado na pauta`);
      continue;
    }
    const bloco = linhas.slice(idx, idx + 6).join('\n');
    const formato = detectarFormato(bloco);
    const tema = (bloco.match(/Tema:\s*(.+)/) || [])[1] || 'tema';
    const angulo = (bloco.match(/Ângulo:\s*(.+)/) || [])[1] || '';

    console.log(`  Post ${n} (${formato}): ${tema}`);
    try {
      const conteudo = await gerarConteudo(tema, angulo, formato);
      posts.push({ n, tema, angulo, formato, conteudo });
      console.log(`  ✓ Post ${n} gerado`);
    } catch (err) {
      console.error(`  ✗ Post ${n} falhou: ${err.message}`);
      posts.push({ n, tema, angulo, formato, conteudo: null, erro: err.message });
    }
  }

  // 4. Salvar na vault
  try {
    await salvarVault({ pauta }, posts);
  } catch (err) {
    console.warn('⚠ Erro ao salvar vault:', err.message);
  }

  // 5. Enviar pro Telegram
  const ok = posts.filter(p => p.conteudo).length;
  await sendTelegram(`✅ Pipeline concluído!\n\n${ok}/6 posts gerados.\n\nPauta:\n${pauta}`);

  for (const p of posts) {
    if (!p.conteudo) {
      await sendTelegram(`❌ Post ${p.n} falhou: ${p.erro}`);
      continue;
    }
    const header = `📝 POST ${p.n} — ${p.formato.toUpperCase()}\nTema: ${p.tema}\n\n`;
    await sendTelegram(header + p.conteudo);
  }

  await sendTelegram(`🎯 Todos os ${ok} posts enviados acima. Revise e use o bot pra publicar individualmente com /aprovar N, ou publique direto pelo script.`);

  console.log(`\n✅ Pipeline concluído — ${ok}/6 posts gerados\n`);
}

main().catch(err => {
  console.error('Erro fatal:', err);
  sendTelegram(`💥 Erro no pipeline: ${err.message}`).catch(() => {});
  process.exit(1);
});
