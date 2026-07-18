import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPage } from '@/lib/api';
import FAQAccordion from '@/components/ui/FAQAccordion';
import ContactForm from '@/components/ui/ContactForm';

interface Props {
  params: Promise<{ handle: string }>;
}

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
  const page = await getPage(handle).catch(() => null);
  if (!page) notFound();

  const isFAQ = handle === 'faqs-page' || handle === 'faq';
  const isContact = handle === 'contact';
  const isCatalogue = handle === 'catalogue-page';

  return (
    <div>
      {/* Page header */}
      <div
        style={{
          background: 'var(--color-grey-light)',
          borderBottom: '1px solid var(--color-border)',
          padding: 'var(--space-2xl) var(--space-xl)',
          textAlign: 'center',
        }}
      >
        <h1>{page.title}</h1>
      </div>

      {/* Catalogue page */}
      {isCatalogue && (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--space-2xl) var(--space-xl)', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.125rem', marginBottom: 'var(--space-xl)', color: 'var(--color-grey-dark)' }}>
            Download our latest bespoke teamwear catalogue and explore everything VAHN has to offer.
          </p>
          <a
            href="https://drive.google.com/file/d/1otQab6q8TzPgdPtEdZcdK3iRfv8-09c-/view?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ marginBottom: 'var(--space-xl)' }}
          >
            Download Catalogue 2025 ↗
          </a>
          <div
            style={{
              width: '100%',
              maxWidth: '500px',
              margin: '0 auto',
              aspectRatio: '3/4',
              background: 'var(--color-navy)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ textAlign: 'center', color: 'white' }}>
              <p style={{ fontFamily: 'var(--font-heading)', fontSize: '3rem', letterSpacing: '0.2em' }}>VAHN</p>
              <p style={{ fontSize: '0.875rem', opacity: 0.7, marginTop: '8px' }}>Bespoke Teamwear 2025</p>
            </div>
          </div>
        </div>
      )}

      {/* Contact page */}
      {isContact && <ContactForm />}

      {/* FAQ page */}
      {isFAQ && (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--space-2xl) var(--space-xl)' }}>
          <FAQAccordion bodyHtml={page.body} />
        </div>
      )}

      {/* Generic page */}
      {!isFAQ && !isContact && !isCatalogue && (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--space-2xl) var(--space-xl)' }}>
          <div
            className="product-description"
            style={{ border: 'none', paddingTop: 0 }}
            dangerouslySetInnerHTML={{ __html: page.body }}
          />
        </div>
      )}
    </div>
  );
}
