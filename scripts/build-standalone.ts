/**
 * Builds release/shape-spin.html from the same source as dist/. The single-file
 * builder runs after `vite build` and inlines the produced bundle. Until the app
 * entry (src/main.ts) exists, this script reports the blocker instead of faking
 * an output file.
 */
import { existsSync } from 'node:fs';

if (!existsSync('dist/index.html')) {
  console.error('build:standalone requires `npm run build` first so dist/index.html exists.');
  console.error('The full application entry is completed in stage 1–2; this script then inlines the bundle into release/shape-spin.html.');
  process.exit(1);
}
console.error('build:standalone is not implemented yet. It must inline the production bundle from dist/ into a playable single file; a placeholder HTML is not acceptable.');
process.exit(1);
