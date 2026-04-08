/**
 * render-story.mjs
 * Renderiza slides de story (1080x1920) como PNGs — um frame por slide
 *
 * Uso: node scripts/render-story.mjs <id-do-story>
 * Ex:  node scripts/render-story.mjs story-planos-2026-04-08
 *
 * Lê o arquivo scripts/stories/<id>.json com os dados dos slides.
 * Gera os PNGs em projetos/carrossel-remotion/out/stories/<id>/slide-01.png ...
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REMOTION_DIR = path.join(ROOT, 'projetos/carrossel-remotion');
const SRC_DIR = path.join(REMOTION_DIR, 'src');
const OUT_DIR = path.join(REMOTION_DIR, 'out');
const STORIES_DIR = path.join(__dirname, 'stories');

const storyId = process.argv[2];
if (!storyId) {
  console.error('Uso: node scripts/render-story.mjs <id-do-story>');
  process.exit(1);
}

const dataFile = path.join(STORIES_DIR, `${storyId}.json`);
if (!fs.existsSync(dataFile)) {
  console.error(`Arquivo não encontrado: ${dataFile}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const { slides, foto = 'opt_c.jpg' } = data;
const FRAMES_PER_SLIDE = 300; // mesmo que SLIDE_DURATION_FRAMES

// Gera JSX dinâmico pro story
const compId = `Story_${storyId.replace(/[^a-zA-Z0-9]/g, '_')}`;
const jsxContent = `import { StoryDinamico } from './StoryDinamico.jsx';

const SLIDES = ${JSON.stringify(slides, null, 2)};

export function ${compId}() {
  return <StoryDinamico slides={SLIDES} foto={${JSON.stringify(foto)}} />;
}
`;

const jsxPath = path.join(SRC_DIR, `${compId}.jsx`);
fs.writeFileSync(jsxPath, jsxContent);
console.log(`JSX criado: ${compId}.jsx`);

// Registra no Root.jsx se ainda não estiver
let root = fs.readFileSync(path.join(SRC_DIR, 'Root.jsx'), 'utf8');
if (!root.includes(compId)) {
  root = root.replace(
    "import { StoryDinamico } from './StoryDinamico.jsx';",
    `import { StoryDinamico } from './StoryDinamico.jsx';\nimport { ${compId} } from './${compId}.jsx';`
  );
  root = root.replace(
    "      {/* Story 9:16 — dinâmico */}",
    `      <Composition id="${compId}" component={${compId}} durationInFrames={${FRAMES_PER_SLIDE * slides.length}} fps={30} width={1080} height={1920} />\n\n      {/* Story 9:16 — dinâmico */}`
  );
  fs.writeFileSync(path.join(SRC_DIR, 'Root.jsx'), root);
  console.log(`Registrado no Root.jsx`);
}

// Renderiza cada slide como PNG (frame central de cada sequência)
const outDir = path.join(OUT_DIR, 'stories', storyId);
fs.mkdirSync(outDir, { recursive: true });

const remotionBin = path.join(REMOTION_DIR, 'node_modules/.bin/remotion.cmd');

console.log(`\nRenderizando ${slides.length} slides como PNG...`);
for (let i = 0; i < slides.length; i++) {
  const frame = i * FRAMES_PER_SLIDE + 60; // frame 60 = 2s dentro do slide (animações já reveladas)
  const num = String(i + 1).padStart(2, '0');
  const outFile = path.join(outDir, `slide-${num}.png`).replace(/\//g, '\\');
  process.stdout.write(`  Slide ${num}... `);
  execSync(
    `"${remotionBin}" still ${compId} "${outFile}" --frame=${frame} --log=error`,
    { cwd: REMOTION_DIR, stdio: 'pipe', shell: true }
  );
  console.log('OK');
}

console.log(`\n✅ ${slides.length} PNGs gerados em: out/stories/${storyId}/`);
