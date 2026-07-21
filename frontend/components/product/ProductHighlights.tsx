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
              <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L2 7v13a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7l-4-5H6z" />
                <path d="M6 2v5h12V2" />
                <path d="M10 7a2 2 0 0 0 4 0" />
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
              <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M12 8v8" />
                <path d="M8 12h8" />
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
              <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
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
