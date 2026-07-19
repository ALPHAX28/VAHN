import type { Metadata } from 'next';
import Link from 'next/link';
import HeroVideo from '@/components/home/HeroVideo';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import IconsWithText from '@/components/home/IconsWithText';
import BottomHero from '@/components/home/BottomHero';
import ImageWithText from '@/components/home/ImageWithText';
import MarqueeStrip from '@/components/home/MarqueeStrip';
import ComparisonSlider from '@/components/home/ComparisonSlider';
import PullQuote from '@/components/home/PullQuote';
import { getCollection } from '@/lib/api';

export const metadata: Metadata = {
  title: 'VAHN — Bespoke Teamwear',
  description:
    'Premium bespoke teamwear crafted for clubs, academies, and brands. This is where it starts.',
};

export default async function HomePage() {
  const collection = await getCollection('vahn-beginning', { first: 6 }).catch(() => null);
  const products = collection?.products.edges.map((e) => e.node) ?? [];

  return (
    <>
      {/* 1. Hero banner — video / background poster */}
      <HeroVideo />

      {/* 2. Featured products / "coming soon..." */}
      <section className="section" style={{ background: 'var(--color-grey-light)' }}>
        <div className="home-section-container">
          <div className="section-header" style={{ padding: 0, marginBottom: 'var(--space-xl)' }}>
            <div>
              <p className="section-title">The Collection</p>
              <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', marginTop: '4px' }}>
                Coming Soon…
              </h2>
            </div>
            {products.length > 0 && (
              <Link href="/collections/vahn-beginning" className="btn-link">
                View All
              </Link>
            )}
          </div>

          {products.length > 0 ? (
            <FeaturedProducts products={products} />
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: 'var(--space-3xl) var(--space-md)',
                border: '1px dashed var(--color-border)',
                background: 'var(--color-white)',
              }}
            >
              <p style={{ fontSize: '1.125rem', marginBottom: '8px', fontFamily: 'var(--font-body)', fontStyle: 'italic' }}>
                Something extraordinary is coming.
              </p>
              <p style={{ color: 'var(--color-grey-dark)', fontSize: '0.875rem' }}>
                Our debut collection is almost ready.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 3. Features — icons with text columns */}
      <IconsWithText />

      {/* 4. Bottom hero banner — introducing new arrivals */}
      <BottomHero />

      {/* 5. Image with text — signature product details */}
      <ImageWithText />

      {/* 6. Scrolling marquee strip — for every beginning */}
      <MarqueeStrip />

      {/* 7. Design comparison slider — interactive before/after */}
      <ComparisonSlider />

      {/* 8. Pull quote — inspired by sport */}
      <PullQuote />

      {/* 9. Brand statement / CTA section */}
      <section
        className="home-section-padding home-cta-section"
        style={{
          background: 'linear-gradient(180deg, #12131A 0%, #08090C 100%)',
          textAlign: 'center',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <p
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(1.5rem, 4vw, 3rem)',
              textTransform: 'uppercase',
              lineHeight: 1.15,
              marginBottom: 'var(--space-lg)',
              color: 'var(--color-white)',
              letterSpacing: '0.04em',
              fontWeight: 800,
            }}
          >
            Crafted for the bold. Built for the game.
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '1.125rem',
              color: 'rgba(255, 255, 255, 0.75)',
              marginBottom: 'var(--space-xl)',
              lineHeight: 1.7,
              maxWidth: '680px',
              margin: '0 auto var(--space-xl) auto',
            }}
          >
            VAHN creates bespoke teamwear for clubs, academies, and brands who refuse to compromise on quality, identity, or performance.
          </p>
          <Link href="/pages/catalogue-page" className="btn btn-white" style={{ marginTop: '12px' }}>
            Download Catalogue
          </Link>
        </div>
      </section>
    </>
  );
}
