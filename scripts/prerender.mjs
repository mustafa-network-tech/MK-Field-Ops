import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { render, publicPaths, pageMeta, structuredData, SITE_URL } from '../.prerender/prerender.js';

const template = await readFile('dist/index.html', 'utf8');
const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'));
const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function stylesFor(path) {
  const name = path === '/' ? '/Landing.tsx' : path.startsWith('/cozumler/') || path === '/404' ? '/ProductPages.tsx' : path === '/kullanim-kilavuzu' ? '/UserGuide.tsx' : path === '/gizlilik-politikasi' ? '/PrivacyPolicy.tsx' : path === '/kullanim-sartlari' ? '/TermsOfUse.tsx' : '/RefundPolicy.tsx';
  const css = new Set(); const seen = new Set();
  function visit(key) { if (seen.has(key)) return; seen.add(key); const chunk = manifest[key]; if (!chunk) return; for (const file of chunk.css ?? []) css.add(file); for (const dependency of chunk.imports ?? []) visit(dependency); }
  Object.keys(manifest).filter(key => key.endsWith(name)).forEach(visit);
  return [...css].map(file => `<link rel="stylesheet" href="/${file}">`).join('\n');
}
function htmlFor(path) {
  const meta = pageMeta(path);
  const isSolution = path.startsWith('/cozumler/') || path === '/404';
  let html = template.replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(meta.title)}</title>`)
    .replace(/<meta (?:name="(?:description|robots|twitter:[^"]+)"|property="og:[^"]+")[^>]*>/g, '')
    .replace(/<link rel="canonical"[^>]*>/g, '');
  if (isSolution) html = html.replace(/<script type="module"[^>]*><\/script>/g, '').replace(/<link rel="modulepreload"[^>]*>/g, '').replace(/<link[^>]*https:\/\/fonts\.[^>]*>/g, '');
  const head = `<meta name="description" content="${escape(meta.description)}">
<meta name="robots" content="${meta.index ? 'index, follow' : 'noindex, nofollow'}">
${meta.index ? `<link rel="canonical" href="${SITE_URL}${meta.path}">` : ''}
<meta property="og:type" content="website"><meta property="og:site_name" content="MK OPS"><meta property="og:locale" content="tr_TR">
<meta property="og:title" content="${escape(meta.title)}"><meta property="og:description" content="${escape(meta.description)}"><meta property="og:url" content="${SITE_URL}${meta.path}"><meta property="og:image" content="${SITE_URL}/landing-logo.png">
<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escape(meta.title)}"><meta name="twitter:description" content="${escape(meta.description)}"><meta name="twitter:image" content="${SITE_URL}/landing-logo.png">
<script id="product-schema" type="application/ld+json">${JSON.stringify(structuredData(path)).replaceAll('<', '\\u003c')}</script>
${stylesFor(path)}
${path === '/' ? '<link rel="preload" as="image" href="/image/hero.jpeg">' : ''}`;
  return html.replace('</head>', `${head}\n</head>`).replace('<div id="root"></div>', `<div id="root">${render(path)}</div>`);
}
// Authenticated routes keep their original client application, without public content.
await writeFile('dist/app.html', template.replace('</head>', '<meta name="robots" content="noindex, nofollow"></head>'));
for (const path of publicPaths) {
  const destination = path === '/' ? 'dist/index.html' : `dist${path}/index.html`;
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, htmlFor(path));
}
await writeFile('dist/404.html', htmlFor('/404').replace('<title>MK OPS</title>', '<title>Sayfa bulunamadı | MK OPS</title>'));
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${publicPaths.map(path => `  <url><loc>${SITE_URL}${path}</loc></url>`).join('\n')}\n</urlset>\n`;
await writeFile('dist/sitemap.xml', sitemap);
console.log(`Prerendered ${publicPaths.length} public pages, private app shell and 404. Solutions ship no JavaScript.`);
