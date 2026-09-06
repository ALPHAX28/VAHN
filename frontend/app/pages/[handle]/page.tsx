import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPage } from '@/lib/api';
import FAQAccordion from '@/components/ui/FAQAccordion';
import OurStoryPage from '@/components/pages/OurStoryPage';
import PolicyPageLayout from '@/components/pages/PolicyPageLayout';
import ContactPage from '@/components/pages/ContactPage';
import TrustBadgesBar from '@/components/ui/TrustBadgesBar';

interface Props {
  params: Promise<{ handle: string }>;
}

export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const page = await getPage(handle).catch(() => null);
  if (!page) return { title: 'Page Not Found' };
  return {
    title: page.seo.title ?? page.title,
    description: page.seo.description ?? page.bodySummary,
  };
}

export default async function PageRoute({ params }: Props) {
  const { handle } = await params;
  const normalized = handle.toLowerCase().trim();
  const page = await getPage(normalized).catch(() => null);
  if (!page) notFound();

  // 1. Dedicated Our Story / About Page
  if (normalized === 'about' || normalized === 'our-story') {
    return <OurStoryPage />;
  }

  // 2. Dedicated Contact Page
  if (normalized === 'contact' || normalized === 'contact-us') {
    return <ContactPage />;
  }

  // 3. Dedicated Policy Pages (Privacy, Terms, Shipping & Returns)
  const isPolicyPage = [
    'privacy-policy',
    'privacy',
    'terms-and-conditions',
    'terms',
    'terms-of-service',
    'shipping',
    'shipping-policy',
    'returns',
  ].includes(normalized);

  if (isPolicyPage) {
    return <PolicyPageLayout page={page} currentHandle={normalized} />;
  }

  // 4. FAQ Page
  const isFAQ = normalized === 'faqs-page' || normalized === 'faq';
  if (isFAQ) {
    return (
      <div style={{ background: '#ffffff', minHeight: '100vh' }}>
        <section
          style={{
            background: '#0d0d0d',
            color: '#ffffff',
            padding: 'clamp(52px, 7vw, 84px) clamp(24px, 5vw, 64px) clamp(40px, 5vw, 64px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: '960px', margin: '0 auto' }}>
            <p
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#4232d9',
                marginBottom: '16px',
              }}
            >
              Customer Care &bull; FAQs
            </p>
            <h1
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'clamp(1.85rem, 4vw, 3.25rem)',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                textTransform: 'uppercase',
                margin: '0 0 16px',
                color: '#ffffff',
              }}
            >
              Frequently Asked Questions
            </h1>
            <p style={{ fontFamily: 'var(--font-body), Georgia, serif', color: 'rgba(255, 255, 255, 0.75)', margin: 0 }}>
              Quick answers about our drops, sizing, pan-India delivery, and orders.
            </p>
          </div>
        </section>

        <div style={{ maxWidth: '840px', margin: '0 auto', padding: 'clamp(40px, 5vw, 64px) 24px' }}>
          <FAQAccordion bodyHtml={page.body} />
        </div>

        <TrustBadgesBar />
      </div>
    );
  }

  // 5. Catalogue Page
  const isCatalogue = normalized === 'catalogue-page' || normalized === 'catalogue';
  if (isCatalogue) {
    return (
      <div style={{ background: '#ffffff', minHeight: '100vh' }}>
        <section
          style={{
            background: '#0d0d0d',
            color: '#ffffff',
            padding: 'clamp(52px, 7vw, 84px) clamp(24px, 5vw, 64px) clamp(40px, 5vw, 64px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: '960px', margin: '0 auto' }}>
            <p
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#4232d9',
                marginBottom: '16px',
              }}
            >
              Bespoke Teamwear
            </p>
            <h1
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'clamp(1.85rem, 4vw, 3.25rem)',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                textTransform: 'uppercase',
                margin: '0 0 16px',
                color: '#ffffff',
              }}
            >
              Teamwear Catalogue
            </h1>
            <p style={{ fontFamily: 'var(--font-body), Georgia, serif', color: 'rgba(255, 255, 255, 0.75)', margin: 0 }}>
              Download our latest bespoke teamwear catalogue and explore everything VAHN has to offer.
            </p>
          </div>
        </section>

        <div style={{ maxWidth: '800px', margin: '0 auto', padding: 'clamp(48px, 6vw, 80px) 24px', textAlign: 'center' }}>
          <a
            href="https://drive.google.com/file/d/1otQab6q8TzPgdPtEdZcdK3iRfv8-09c-/view?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{
              background: '#4232d9',
              borderColor: '#4232d9',
              padding: '14px 32px',
              fontSize: '0.875rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              marginBottom: '36px',
              display: 'inline-block',
            }}
          >
            Download Catalogue 2025 ↗
          </a>
        </div>

        <TrustBadgesBar />
      </div>
    );
  }

  // 6. Generic Fallback
  return <PolicyPageLayout page={page} currentHandle={normalized} />;
}
