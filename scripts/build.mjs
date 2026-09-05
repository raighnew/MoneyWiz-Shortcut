// Bundles src/main.ts (and everything it imports) into the single
// self-contained script at dist/MoneyWiz.js that Scriptable runs.
// Type checking is tsc's job (`npm run typecheck`); esbuild only bundles.
import { build } from 'esbuild'

// Scriptable metadata comments must be the very first lines of the file.
const SCRIPTABLE_HEADER = `// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: yen-sign;
//
// GENERATED FILE — bundled from src/ by \`npm run build\`. Edit the
// TypeScript source instead; user settings live in src/config.ts.`

await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'iife',
  target: 'es2021',
  charset: 'utf8',
  banner: { js: SCRIPTABLE_HEADER },
  outfile: 'dist/MoneyWiz.js',
  logLevel: 'info'
})
