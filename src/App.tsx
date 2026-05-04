import { Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { I18nProvider } from '@/lib/i18n/I18nContext';
import { AppProvider } from '@/app/providers/AppContext';
import { AppRoutes } from '@/app/router/AppRoutes';

function PageFallback() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh', color: '#94a3b8' }}>
      Loading…
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppProvider>
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
            <AppRoutes />
          </Suspense>
        </BrowserRouter>
      </AppProvider>
    </I18nProvider>
  );
}
