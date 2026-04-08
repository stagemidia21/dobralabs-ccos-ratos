/**
 * obsidian.mjs
 * Integração com o vault do Obsidian @homero.ads
 *
 * Funções:
 *   salvarCarrossel(dados, meta) — salva post de feed no vault
 *   salvarStory(dados, meta)     — salva story no vault
 *   lerHistorico(dias)           — lê posts recentes pra informar geração nova
 *   lerPautas()                  — lê pautas existentes
 */

import fs from 'fs';
import path from 'path';

const VAULT = 'C:/Users/homer/OneDrive/Documentos/Backup/Homero Note';
const CARROSSEIS = path.join(VAULT, '@homero.ads/carrosseis');
const STORIES   = path.join(VAULT, '@homero.ads/stories');
const PAUTAS    = path.join(VAULT, '@homero.ads/pautas');
const LEGENDAS  = path.join(VAULT, '@homero.ads/legendas');

// Garante que as pastas existem
[CARROSSEIS, STORIES, PAUTAS, LEGENDAS].forEach(d => fs.mkdirSync(d, { recursive: true }));

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 50)
    .replace(/-+$/, '');
}

/**
 * Monta o markdown de um slide pro histórico
 */
function formatarSlide(s, i) {
  if (s.tipo === 'capa') {
    return `**SLIDE ${i + 1} — CAPA**\n\`${s.title}\`\n${s.fonte || ''}`;
  }
  if (s.tipo === 'cta') {
    return `**SLIDE ${i + 1} — CTA**\n\`${s.cta}\``;
  }
  // texto/corpo
  const label = (s.label || s.tipo).toUpperCase();
  const title = s.title || s.titulo || '';
  const body  = s.body  || s.corpo  || '';
  return `**SLIDE ${i + 1} — ${label}**\n\`${title}\`\n${body}`;
}

/**
 * Salva um carrossel de feed no vault
 * @param {object} dados  - { slides, legenda }
 * @param {object} meta   - { tema, foto, numPost, igId, plataformas }
 */
export function salvarCarrossel(dados, meta = {}) {
  const data = hoje();
  const slug = slugify(meta.tema || 'post');
  const filename = `${slug}-${data}.md`;
  const filepath = path.join(CARROSSEIS, filename);

  // Extrai tags automáticas do tema
  const tags = extrairTags(meta.tema || '');

  const slidesMarkdown = (dados.slides || [])
    .map((s, i) => formatarSlide(s, i))
    .join('\n\n---\n\n');

  const content = `---
tags: [carrossel, ${tags.join(', ')}, publicado]
data: ${data}
foto: ${meta.foto || ''}
post: ${meta.numPost || ''}
plataformas: [instagram, threads, facebook, linkedin]
status: publicado
ig_id: ${meta.igId || ''}
---

# ${meta.tema || slug}

## Slides

${slidesMarkdown}

---

## Legenda

${dados.legenda || ''}
`;

  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`  📓 Obsidian: ${filename}`);
  return filepath;
}

/**
 * Salva um story no vault
 * @param {object} dados  - { slides, legenda }
 * @param {object} meta   - { tema, foto, storyId, igIds }
 */
export function salvarStory(dados, meta = {}) {
  const data = hoje();
  const slug = slugify(meta.tema || 'story');
  const filename = `story-${slug}-${data}.md`;
  const filepath = path.join(STORIES, filename);

  const tags = extrairTags(meta.tema || '');

  const slidesMarkdown = (dados.slides || [])
    .map((s, i) => formatarSlide(s, i))
    .join('\n\n---\n\n');

  const content = `---
tags: [story, ${tags.join(', ')}, publicado]
data: ${data}
foto: ${meta.foto || ''}
story_id: ${meta.storyId || ''}
plataformas: [instagram]
status: publicado
---

# Story — ${meta.tema || slug}

## Slides

${slidesMarkdown}

---

## Legenda

${dados.legenda || ''}
`;

  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`  📓 Obsidian: ${filename}`);
  return filepath;
}

/**
 * Lê posts dos últimos N dias e retorna contexto pra informar geração nova.
 * Usado no prompt do Claude pra evitar repetição de tema/ângulo.
 *
 * @param {number} dias - quantos dias atrás olhar (padrão: 14)
 * @returns {string} bloco de texto com temas e ângulos já publicados
 */
export function lerHistorico(dias = 14) {
  const limite = new Date();
  limite.setDate(limite.getDate() - dias);

  const posts = [];

  for (const dir of [CARROSSEIS, STORIES]) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;

      // Extrai data do nome do arquivo (formato: slug-YYYY-MM-DD.md)
      const dataMatch = file.match(/(\d{4}-\d{2}-\d{2})\.md$/);
      if (!dataMatch) continue;
      const dataArquivo = new Date(dataMatch[1]);
      if (dataArquivo < limite) continue;

      const conteudo = fs.readFileSync(path.join(dir, file), 'utf8');

      // Extrai o título (primeira linha H1)
      const tituloMatch = conteudo.match(/^# (.+)$/m);
      const titulo = tituloMatch ? tituloMatch[1] : file.replace('.md', '');

      // Extrai tags do frontmatter
      const tagsMatch = conteudo.match(/^tags:\s*\[(.+)\]/m);
      const tags = tagsMatch ? tagsMatch[1] : '';

      // Extrai o primeiro slide (ângulo/gancho principal)
      const primeiroSlide = conteudo.match(/\*\*SLIDE 1[^*]*\*\*\n`([^`]+)`/);
      const gancho = primeiroSlide ? primeiroSlide[1] : '';

      const tipo = dir === STORIES ? 'story' : 'carrossel';
      posts.push(`- [${dataMatch[1]}] ${tipo}: "${titulo}" | gancho: "${gancho}" | tags: ${tags}`);
    }
  }

  if (posts.length === 0) return '';

  return `\nCONTEÚDO JÁ PUBLICADO (últimos ${dias} dias — NÃO repetir tema nem ângulo):\n${posts.join('\n')}\n`;
}

/**
 * Lê as pautas do vault
 * @returns {string} conteúdo das pautas recentes
 */
export function lerPautas() {
  if (!fs.existsSync(PAUTAS)) return '';

  const arquivos = fs.readdirSync(PAUTAS)
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse()
    .slice(0, 3); // últimas 3 pautas

  return arquivos
    .map(f => fs.readFileSync(path.join(PAUTAS, f), 'utf8'))
    .join('\n\n---\n\n');
}

/**
 * Extrai tags relevantes do tema pra indexação no vault
 */
function extrairTags(tema) {
  const mapa = {
    'claude':    'claude',
    'gpt':       'openai',
    'openai':    'openai',
    'google':    'google',
    'gemma':     'google',
    'gemini':    'google',
    'ia':        'ia',
    'inteligência artificial': 'ia',
    'tráfego':   'trafego-pago',
    'meta ads':  'meta-ads',
    'google ads':'google-ads',
    'agente':    'agentes-ia',
    'automação': 'automacao',
    'n8n':       'n8n',
    'story':     'story',
    'plano':     'planos',
    'método':    'metodo',
    'agência':   'agencia',
    'linkedin':  'linkedin',
  };

  const temaLower = tema.toLowerCase();
  const tags = ['ia', 'marketing-digital']; // sempre presentes

  for (const [chave, tag] of Object.entries(mapa)) {
    if (temaLower.includes(chave) && !tags.includes(tag)) {
      tags.push(tag);
    }
  }

  return tags;
}
