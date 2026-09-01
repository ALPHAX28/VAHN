import type { Metadata } from 'next';
import '@/app/globals.css';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';
import StoreLayoutShell from '@/components/layout/StoreLayoutShell';

import ClientWarmup from '@/components/layout/ClientWarmup';
import ScrollToTop from '@/components/layout/ScrollToTop';

export const metadata: Metadata = {
  title: { default: 'VAHN — Bespoke Teamwear', template: '%s | VAHN' },
  description:
    'VAHN is a premium bespoke teamwear brand crafting exceptional sportswear for clubs, academies, and brands worldwide.',
  keywords: ['teamwear', 'sportswear', 'bespoke', 'football', 'kit', 'VAHN'],
  openGraph: {
    siteName: 'VAHN',
    type: 'website',
    locale: 'en_GB',
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/assets/logos/VAHN-Symbol-colour-transparent.png', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ClientWarmup />
        <ScrollToTop />
        <AuthProvider>
          <CartProvider>
            <StoreLayoutShell>{children}</StoreLayoutShell>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
