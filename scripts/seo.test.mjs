import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { publicPaths, pageMeta, SITE_URL } from '../.prerender/prerender.js';

const read = path => readFile(path, 'utf8');
const config = JSON.parse(await read('vercel.json'));
const sitemap = await read('dist/sitemap.xml');
const titles = new Set();
for (const path of publicPaths) {
  test(`public HTML: ${path}`, async () => {
    const html = await read(path === '/' ? 'dist/index.html' : `dist${path}/index.html`);
    const meta = pageMeta(path);
    assert.equal((html.match(/<h1(?:\s|>)/g) ?? []).length, 1);
    assert.ok(html.includes(`<link rel="canonical" href="${SITE_URL}${path}">`));
    assert.ok(html.includes('content="index, follow"'));
    assert.ok(!html.includes('noindex'));
    assert.ok(html.includes(meta.title));
    assert.ok(!titles.has(meta.title), 'unique title'); titles.add(meta.title);
    assert.ok(sitemap.includes(`<loc>${SITE_URL}${path}</loc>`));
    for (const match of html.matchAll(/type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      const schema = JSON.parse(match[1]);
      assert.ok(!JSON.stringify(schema).match(/AggregateRating|"offers"|"Review"/));
    }
    for (const match of html.matchAll(/href="(\/assets\/[^"?#]+)"/g)) await access(`dist${match[1]}`);
    const cssFiles = [...html.matchAll(/href="(\/assets\/[^"?#]+\.css)"/g)].map(m => `dist${m[1]}`);
    const css = (await Promise.all(cssFiles.map(read))).join('\n');
    for (const match of html.matchAll(/class="([^"]+)"/g)) for (const name of match[1].split(' ')) {
      if (name.startsWith('_')) assert.ok(css.includes(`.${name}`), `missing prerender style ${name}`);
    }
    for (const match of html.matchAll(/href="(\/cozumler\/[^"#]+)"/g)) assert.ok(publicPaths.includes(match[1]), `broken internal link ${match[1]}`);
    if (path.startsWith('/cozumler/')) {
      assert.ok(!html.includes('<script type="module"'), 'solutions require no JS');
      assert.ok(html.includes('BreadcrumbList'));
      assert.ok(html.includes('<summary>'));
      assert.equal((html.match(/<article\b/g) ?? []).length, 3, 'all capability sections are rendered');
      assert.equal((html.match(/<details\b/g) ?? []).length, 2, 'both visible FAQ entries are rendered');
    }
  });
}
test('private shell has no marketing content and is noindex', async () => {
  const html = await read('dist/app.html');
  assert.ok(html.includes('noindex, nofollow'));
  assert.ok(html.includes('<div id="root"></div>'));
  assert.ok(!html.includes('rel="canonical"'));
  for (const path of ['/login', '/register', '/reports', '/jobs', '/super-admin', '/management/:path*', '/team/:path*']) {
    assert.equal(config.rewrites.find(r => r.source === path)?.destination, '/app.html');
    assert.ok(config.headers.find(r => r.source === path)?.headers.some(h => h.key === 'X-Robots-Tag' && h.value.includes('noindex')));
    assert.ok(!sitemap.includes(`<loc>${SITE_URL}${path}</loc>`));
  }
});
test('host redirect is one-way; unknown URLs have no catch-all rewrite', async () => {
  const redirect = config.redirects.find(r => r.has?.some(h => h.type === 'host'));
  assert.equal(redirect.has[0].value, 'www.mk-ops.tr');
  assert.equal(redirect.destination, 'https://mk-ops.tr/:path*');
  assert.ok(!config.rewrites.some(r => r.source === '/:path*'));
  assert.ok((await read('dist/404.html')).includes('noindex'));
});
test('home exposes all solutions and no fictional live dashboard', async () => {
  const html = await read('dist/index.html');
  for (const path of publicPaths.filter(p => p.startsWith('/cozumler/'))) assert.ok(html.includes(`href="${path}"`));
  assert.ok(!html.includes('284K'));
  assert.ok(!html.includes('Personel Yönetimi'));
  assert.ok(!html.includes('vardiya planlaması'));
  assert.ok(!html.includes('Fiber Ek Kayıtları'));
  assert.ok(!html.includes('opacity:0'), 'prerendered content must be visible without JS');
});
