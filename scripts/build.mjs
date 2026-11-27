import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { build } from 'esbuild'

const shared = { bundle: true, format: 'esm', target: 'es2022' }

await mkdir('dist', { recursive: true })
await Promise.all([
  build({ ...shared, entryPoints: ['src/worker.ts'], platform: 'node', outfile: 'dist/worker.mjs' }),
  build({ ...shared, entryPoints: ['src/panel.ts'], platform: 'browser', outfile: 'dist/panel.js' }),
  copyFile('src/panel.css', 'dist/panel.css'),
  writeFile('dist/panel.html', `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>セッションボード</title>
  <script type="module" src="./panel.js"></script>
</head>
<body></body>
</html>
`)
])
