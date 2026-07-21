'use client';

import type { Product } from '@/lib/api/types';

interface Props {
  product: Product;
}

export default function ProductHighlights({ product }: Props) {
  // Extract backend DB fields with dynamic fallbacks
  const fitValue = product.fit ?? (product.tags.find(t => ['slim', 'oversized', 'regular'].includes(t.toLowerCase()))?.toUpperCase() || 'OVERSIZED');
  const kitTypeValue = product.kitType ?? (product.productType ? product.productType.toUpperCase() : 'SIGNATURE');
  const activityValue = product.activity ?? 'LIFESTYLE';

  return (
    <section className="product-highlights-section">
      <div className="container">
        <div className="product-highlights-grid">
          {/* Fit Item */}
          <div className="highlight-item">
            <div className="highlight-icon">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
              </svg>
            </div>
            <div className="highlight-meta">
              <span className="highlight-label">Fit</span>
              <strong className="highlight-value">{fitValue}</strong>
            </div>
          </div>

          {/* Kit Type Item */}
          <div className="highlight-item">
            <div className="highlight-icon">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <div className="highlight-meta">
              <span className="highlight-label">Kit Type</span>
              <strong className="highlight-value">{kitTypeValue}</strong>
            </div>
          </div>

          {/* Activity Item */}
          <div className="highlight-item">
            <div className="highlight-icon">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="2" />
                <path d="M6 22l4-8 2 2v6" />
                <path d="M18 10l-4-4-4 2-3 4" />
              </svg>
            </div>
            <div className="highlight-meta">
              <span className="highlight-label">Activity</span>
              <strong className="highlight-value">{activityValue}</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
