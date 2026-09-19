import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { I18nProvider } from '@/lib/i18n/I18nContext';
import { Landing } from '@/features/landing/pages/Landing';
import { PrivacyPolicy } from '@/features/legal/pages/PrivacyPolicy';
import { TermsOfUse } from '@/features/legal/pages/TermsOfUse';
import { RefundPolicy } from '@/features/legal/pages/RefundPolicy';
import { UserGuide } from '@/features/legal/pages/UserGuide';
import { ProductPage } from './ProductPages';
import { solutions, solutionPath, supportingPages, pageMeta, structuredData, SITE_URL } from './content';

export { pageMeta, structuredData, SITE_URL };
export const publicPaths = ['/', ...solutions.map(s => solutionPath(s.slug)), ...supportingPages.map(p => p.path)];
export function render(path: string) {
  const content = path === '/' ? <Landing /> : path === '/gizlilik-politikasi' ? <PrivacyPolicy /> : path === '/kullanim-sartlari' ? <TermsOfUse /> : path === '/geri-odeme-politikasi' ? <RefundPolicy /> : path === '/kullanim-kilavuzu' ? <UserGuide /> : <ProductPage slug={path.split('/').pop() ?? ''} />;
  return renderToString(<StaticRouter location={path}><I18nProvider initialLocale="tr">{content}</I18nProvider></StaticRouter>);
}
