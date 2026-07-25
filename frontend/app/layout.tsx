import type { Metadata } from 'next';
import '@/app/globals.css';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';
import StoreLayoutShell from '@/components/layout/StoreLayoutShell';

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
  icons: { icon: '/assets/favicon.png' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          <CartProvider>
            <StoreLayoutShell>{children}</StoreLayoutShell>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
