'use strict';
// Builds a single self-contained HTML demo (no server) from public/ + demo/mock.js.
const fs = require('node:fs'), path = require('node:path');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const icon = 'data:image/svg+xml;base64,' + Buffer.from(R('public/icon.svg')).toString('base64');
const csv = R('lib/csvimport.js').replace("module.exports = { parseCsv, parseDateTime };", 'window.ECCsv = { parseCsv, parseDateTime };');
// Illustrations are inlined as data URIs so the demo stays a single file.
const imgDir = path.join(__dirname, '..', 'public', 'img');
const images = Object.fromEntries(fs.readdirSync(imgDir).filter(f => f.endsWith('.webp'))
  .map(f => [f.replace(/\.webp$/, ''), 'data:image/webp;base64,' + fs.readFileSync(path.join(imgDir, f)).toString('base64')]));
let html = R('public/index.html')
  .replace('<link rel="manifest" href="/manifest.webmanifest">', '')
  .replace('<link rel="icon" href="/icon.svg" type="image/svg+xml">', `<link rel="icon" href="${icon}">`)
  .replace('<title>EndoControl</title>', '<title>EndoControl — demo</title>')
  .replace('<link rel="stylesheet" href="/app.css">', () => `<style>${R('public/app.css').replace(/url\(\/fonts\/([^)]+)\)/g, (m, f) => `url(data:font/woff2;base64,${fs.readFileSync(path.join(__dirname, '..', 'public', 'fonts', f)).toString('base64')})`)}</style>`)
  .replace(/<script src="\/i18n.js"><\/script>\s*<script src="\/charts.js"><\/script>\s*<script src="\/school.js"><\/script>\s*<script src="\/explain.js"><\/script>\s*<script src="\/urgent.js"><\/script>\s*<script src="\/app.js"><\/script>/,
    () => ['public/i18n.js', 'public/charts.js', 'public/school.js', 'public/explain.js', 'public/urgent.js'].map(f => `<script>${R(f)}</script>`).join('\n') + `\n<script>window.EC_IMG=${JSON.stringify(images)};</script>\n<script>(function(){${csv}})();</script>\n<script>${R('demo/mock.js')}</script>\n<script>${R('public/app.js').split('/icon.svg').join(icon)}</script>`);
html = html.split('src="/icon.svg"').join(`src="${icon}"`);
fs.mkdirSync(path.join(__dirname, '..', 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'dist', 'endocontrol-demo.html'), html);
console.log('dist/endocontrol-demo.html', (html.length / 1024).toFixed(0) + ' KB');
