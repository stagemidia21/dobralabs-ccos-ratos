/**
 * humanizer-rules.mjs
 * Regras do /humanizer embutidas para uso nos scripts de geração automática.
 * Fonte: ~/.claude/skills/humanizer/SKILL.md
 *
 * Uso: import { humanizarJSON } from './humanizer-rules.mjs';
 */

import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const CLAUDE_BIN = process.platform === 'win32'
  ? path.join(process.env.USERPROFILE || 'C:/Users/homer', '.local/bin/claude.exe')
  : '/home/' + (process.env.USER || 'homer') + '/.local/bin/claude';

function callClaude(prompt, timeout = 120000) {
  return execFileSync(CLAUDE_BIN, ['-p', prompt], {
    cwd: ROOT, timeout, encoding: 'utf8', maxBuffer: 1024 * 1024 * 5,
  }).trim();
}

export const HUMANIZER_INSTRUCOES = `
Você é um editor de texto especializado em remover vícios de escrita de IA.
Tom alvo: técnico, direto, primeira pessoa quando natural, sem enrolação. Português BR.

PADRÕES A ELIMINAR:
1. Palavras de IA: "crucial", "pivotal", "destacar", "ressaltar", "fundamental", "essencial", "robusto", "abrangente", "insights", "landscape", "ecossistema" (no sentido figurado), "transformador", "revolucionário", "inovador" (sem fato concreto), "valioso"
2. Linguagem promocional: "vibrante", "profundo", "showcasing", "nestled", "breathtaking", "groundbreaking"
3. Frases participiais de enfeite: "destacando que...", "garantindo que...", "refletindo...", "contribuindo para..."
4. Falsa autoridade: "especialistas afirmam", "estudos mostram", "segundo observadores"
5. Paralelismo negativo: "Não é só X, é Y", "Não se trata apenas de X"
6. Regra de três forçada: listas de exatamente três elementos sem razão real
7. Conclusões genéricas otimistas: "o futuro é promissor", "tempos empolgantes pela frente"
8. Travessões em excesso — assim — que fragmentam o texto sem necessidade
9. Negrito excessivo em frases que não precisam de ênfase
10. Frases de chatbot: "Ótima pergunta!", "Espero que ajude", "Não hesite em perguntar"
11. Hedging excessivo: "pode potencialmente", "poderia possivelmente ser argumentado"
12. Anúncios do que vai fazer: "Vamos explorar", "Vamos mergulhar em", "Sem mais delongas"
13. Variação elegante: trocar "o produto" por "a solução", "o sistema", "a ferramenta" sem necessidade

COMO REESCREVER:
- Frases diretas, sujeito + verbo + objeto
- Variar comprimento de frases: curtas e longas misturadas
- Usar "é/são/tem" no lugar de "serve como", "funciona como", "representa"
- Detalhes concretos no lugar de afirmações vagas
- Primeira pessoa onde couber naturalmente
- Sem enfeites motivacionais
`;

/**
 * Humaniza todos os campos de texto de um objeto de slides + legenda.
 * Retorna o mesmo objeto com os textos reescritos.
 *
 * @param {object} dados - { slides: [...], legenda: string }
 * @returns {object} dados humanizados
 */
export function humanizarJSON(dados) {
  const camposParaHumanizar = extrairTextos(dados);
  const textosBrutos = JSON.stringify(camposParaHumanizar, null, 2);

  const prompt = `${HUMANIZER_INSTRUCOES}

Abaixo estão os textos de slides e legenda de um carrossel/story de conteúdo de marketing digital (@homero.ads / Stage Mídia).
Humanize TODOS os campos de texto mantendo o significado, o tom técnico e direto, e o formato em CAPS onde já está em CAPS.
NÃO altere campos "tipo", "label", "tag", "fonte", "numero", "total".
Retorne EXATAMENTE o mesmo JSON com os textos reescritos. Sem markdown, sem explicação.

${textosBrutos}`;

  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      if (tentativa > 1) {
        console.warn(`  ⚠ Humanizer retry ${tentativa - 1}...`);
        // Pausa entre retries pra deixar o Claude CLI respirar
        const delay = 10000 * tentativa;
        const end = Date.now() + delay;
        while (Date.now() < end) { /* spin wait síncrono */ }
      }
      const raw = callClaude(prompt, 240000);
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Sem JSON');
      const humanizado = JSON.parse(match[0]);
      return mesclarHumanizado(dados, humanizado);
    } catch (err) {
      if (tentativa >= 3) {
        console.warn(`  ⚠ Humanizer falhou após 3 tentativas — usando texto original`);
        return dados;
      }
    }
  }
  return dados;
}

// Extrai só os campos editáveis pra mandar pro Claude (menos tokens)
function extrairTextos(dados) {
  const result = { legenda: dados.legenda || '' };
  result.slides = (dados.slides || []).map(s => {
    const slide = { tipo: s.tipo };
    if (s.title)     slide.title = s.title;
    if (s.titulo)    slide.titulo = s.titulo;
    if (s.subtitulo) slide.subtitulo = s.subtitulo;
    if (s.body)      slide.body = s.body;
    if (s.corpo)     slide.corpo = s.corpo;
    if (s.cta)       slide.cta = s.cta;
    if (s.sub)       slide.sub = s.sub;
    // preservar campos não editáveis
    if (s.label)     slide.label = s.label;
    if (s.tag)       slide.tag = s.tag;
    if (s.fonte)     slide.fonte = s.fonte;
    if (s.numero !== undefined) slide.numero = s.numero;
    if (s.total !== undefined)  slide.total = s.total;
    return slide;
  });
  return result;
}

// Mescla os textos humanizados de volta nos dados originais
function mesclarHumanizado(original, humanizado) {
  const result = { ...original, legenda: humanizado.legenda || original.legenda };
  result.slides = (original.slides || []).map((s, i) => {
    const h = (humanizado.slides || [])[i] || {};
    return { ...s, ...h, tipo: s.tipo }; // tipo nunca muda
  });
  return result;
}
