import type { Metadata } from 'next';
import './globals.css';
import { getBootstrapScript } from '@/i18n/browser';
import { getMessage } from '@/i18n/catalog';
import { LanguageProvider } from '@/i18n/LanguageProvider';
import { DEFAULT_LOCALE } from '@/i18n/types';

export const metadata: Metadata = {
  title: getMessage(DEFAULT_LOCALE, 'app.title'),
  description: getMessage(DEFAULT_LOCALE, 'app.description'),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={DEFAULT_LOCALE}
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: getBootstrapScript() }} />
      </head>
      <body className="min-h-full flex flex-col">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}