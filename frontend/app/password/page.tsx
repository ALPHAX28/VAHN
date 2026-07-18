import type { Metadata } from 'next';
import PasswordForm from '@/components/ui/PasswordForm';

export const metadata: Metadata = {
  title: 'Coming Soon — VAHN',
  description: 'Something extraordinary is coming. VAHN Bespoke Teamwear.',
  robots: { index: false, follow: false },
};

export default function PasswordPage() {
  return (
    <div className="password-page">
      {/* Logo */}
      <div>
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: '3rem', letterSpacing: '0.3em', color: 'var(--color-white)', textTransform: 'uppercase' }}>
          VAHN
        </p>
      </div>

      <div style={{ maxWidth: '480px' }}>
        <h1 style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontStyle: 'italic', textTransform: 'none', fontSize: 'clamp(1.5rem, 4vw, 3rem)', color: 'var(--color-white)', marginBottom: '16px' }}>
          this is where it starts
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.125rem', fontFamily: 'var(--font-body)', marginBottom: '32px' }}>
          Our debut collection is launching soon. Join the beginning.
        </p>
      </div>

      <PasswordForm />
    </div>
  );
}

