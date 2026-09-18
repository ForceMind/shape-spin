/**
 * Builds release/shape-spin.html — a single self-contained HTML file that can be
 * opened directly from disk (file://) without any server.
 *
 * Strategy:
 *  1. Run `vite build` (via npm script) to produce dist/.
 *  2. Read dist/index.html to find the JS and CSS asset filenames.
 *  3. Read the JS bundle, CSS bundle, and campaign.json.
 *  4. Inline everything into one HTML file:
 *       - CSS goes into a <style> block.
 *       - JS goes into a <script type="module"> block (type=module so top-level
 *         await and import.meta work; for file:// we strip the import since all
 *         code is inlined).
 *       - campaign.json is embedded as a JSON string assigned to a global that
 *         the app reads before falling back to fetch.
 *  5. Write the result to release/shape-spin.html.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const RELEASE_DIR = 'release';
const OUTPUT = join(RELEASE_DIR, 'shape-spin.html');

// ── Step 1: verify dist/ exists ──────────────────────────────────────────────
if (!existsSync(join(DIST, 'index.html'))) {
  console.error('build:standalone requires `npm run build` first so dist/index.html exists.');
  process.exit(1);
}

// ── Step 2: read dist/index.html ─────────────────────────────────────────────
const indexHtml: string = readFileSync(join(DIST, 'index.html'), 'utf8');

// ── Step 3: extract asset filenames ──────────────────────────────────────────
const jsMatch = indexHtml.match(/src="\/assets\/([^"]+\.js)"/);
const cssMatch = indexHtml.match(/href="\/assets\/([^"]+\.css)"/);

if (!jsMatch) {
  console.error('Could not find JS bundle reference in dist/index.html');
  process.exit(1);
}

const jsFile = jsMatch[1]!;
const cssFile = cssMatch ? cssMatch[1] : null;

// ── Step 4: read asset contents ──────────────────────────────────────────────
const jsCode: string = readFileSync(join(DIST, 'assets', jsFile as string), 'utf8');

let cssCode = '';
if (cssFile) {
  cssCode = readFileSync(join(DIST, 'assets', cssFile), 'utf8');
}

// ── Step 5: read campaign.json ───────────────────────────────────────────────
const campaignJsonPath = join(DIST, 'campaign.json');
let campaignJson = '[]';
if (existsSync(campaignJsonPath)) {
  campaignJson = readFileSync(campaignJsonPath, 'utf8');
} else {
  console.warn('Warning: dist/campaign.json not found; standalone will have no levels.');
}

// ── Step 6: build the single-file HTML ───────────────────────────────────────
// We embed campaign.json before the main script so the app finds it via
// the global window.__SHAPE_SPIN_CAMPAIGN__ before it tries fetch().

// For file:// support: replace fetch('campaign.json') with the inlined data
const inlinedJs = jsCode
  .replace(/^\uFEFF/, '')
  .replace(
    /fetch\(['"]campaign\.json['"]\)\)\.json\(\)/g,
    'Promise.resolve(window.__SHAPE_SPIN_CAMPAIGN__))'
  );

// Read the original index.html body (everything between <body> and </body>)
const bodyMatch = indexHtml.match(/<body>([\s\S]*?)<\/body>/);
const rawBody = bodyMatch?.[1]?.trim() ?? '';
// Strip any <script> or <link> tags from the body (Vite injects module scripts)
const bodyContent = rawBody
  .replace(/<script[^>]*>[\s\S]*?<\/script>/gs, '')
  .replace(/<script[^>]*\/>/g, '')
  .replace(/<link[^>]*>/g, '');

// Extract <head> meta tags (charset, viewport, theme-color)
const headMatch = indexHtml.match(/<head>([\s\S]*?)<\/head>/);
const rawHead = headMatch?.[1]?.trim() ?? '';
const headContent = rawHead
  .replace(/<script[^>]*>.*?<\/script>/gs, '')
  .replace(/<script[^>]*\/>/g, '')
  .replace(/<link[^>]*>/g, '');

const html = `<!doctype html>
<html lang="en">
<head>
${headContent}
<style>
${cssCode}
</style>
</head>
<body>
${bodyContent}
<script>
// ── Inlined level data ───────────────────────────────────────────────────────
window.__SHAPE_SPIN_CAMPAIGN__ = ${campaignJson};
</script>
<script>
${inlinedJs}
</script>
</body>
</html>
`;

// ── Step 7: write output ─────────────────────────────────────────────────────
mkdirSync(RELEASE_DIR, { recursive: true });
writeFileSync(OUTPUT, html, 'utf8');

const htmlSize = (html.length / 1024).toFixed(1);
console.log(`build:standalone — wrote ${OUTPUT} (${htmlSize} KB)`);
console.log(`  inlined JS: ${jsFile} (${(jsCode.length / 1024).toFixed(1)} KB)`);
if (cssFile) console.log(`  inlined CSS: ${cssFile} (${(cssCode.length / 1024).toFixed(1)} KB)`);
console.log(`  inlined levels: ${(campaignJson.length / 1024).toFixed(1)} KB (${JSON.parse(campaignJson).length} levels)`);
