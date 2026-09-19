import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '@/app/providers/AppContext';
import { pageMeta, SITE_URL, structuredData } from './content';

export function RouteMetadata() {
  const { pathname } = useLocation();
  const { user } = useApp();
  useEffect(() => {
    const meta = pageMeta(pathname);
    const privatePage = !meta.index || (pathname === '/' && !!user);
    document.title = privatePage ? 'MK OPS' : meta.title;
    const set = (attribute: string, key: string, content: string) => {
      let node = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
      if (!node) { node = document.createElement('meta'); node.setAttribute(attribute, key); document.head.append(node); }
      node.content = content;
    };
    set('name', 'robots', privatePage ? 'noindex, nofollow' : 'index, follow');
    set('name', 'description', meta.description);
    for (const prefix of ['og', 'twitter']) {
      const attr = prefix === 'og' ? 'property' : 'name';
      set(attr, `${prefix}:title`, document.title); set(attr, `${prefix}:description`, meta.description);
      set(attr, `${prefix}:image`, `${SITE_URL}/landing-logo.png`);
    }
    set('property', 'og:url', SITE_URL + meta.path);
    set('property', 'og:locale', 'tr_TR');
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (privatePage) canonical?.remove();
    else { if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); } canonical.href = SITE_URL + meta.path; }
    document.getElementById('product-schema')?.remove();
    if (!privatePage) { const script = document.createElement('script'); script.id = 'product-schema'; script.type = 'application/ld+json'; script.textContent = JSON.stringify(structuredData(meta.path)); document.head.append(script); }
  }, [pathname, user]);
  return null;
}
