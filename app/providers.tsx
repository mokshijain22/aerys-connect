'use client';

import { SessionProvider } from 'next-auth/react';
import { LanguageProvider } from './lib/LanguageContext';
import AutoTranslate from './components/AutoTranslate';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LanguageProvider>
        <AutoTranslate>{children}</AutoTranslate>
      </LanguageProvider>
    </SessionProvider>
  );
}