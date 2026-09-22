'use client';

import Link from 'next/link';
import { useState } from 'react';

const BRAND_COLOR = '#4232d9';

export interface FAQItemData {
  q: string;
  a: string;
  link?: { label: string; href: string };
  isHtml?: boolean;
}

// ── FAQ Data (identical to products page) ──
export const FAQ_ITEMS: FAQItemData[] = [
  {
    q: 'WHAT DOES VAHN MAKE?',
    a: 'Right now, jerseys, built for the way you actually play.\nThis is our first drop. More is coming.',
  },
  {
    q: 'ARE THE JERSEYS UNISEX?',
    a: 'Yes. Made for everyone.',
  },
  {
    q: 'HOW DOES THE FIT RUN?',
    a: "Relaxed, not oversized. If you're between sizes, we'd recommend sizing down for a fitted look or staying true to size for the intended relaxed drape.",
  },
  {
    q: 'WHAT FABRIC ARE THE JERSEYS MADE FROM?',
    a: '100% micro yarn polyester, 155 gsm. Built with moisture-wicking technology that pulls sweat away from the skin, and breathable panelling placed through the high-heat zones for airflow.',
  },
  {
    q: 'CAN I WEAR VAHN ON THE FIELD, OR IS IT STREETWEAR?',
    a: "Both. VAHN isn't gym wear and it isn't costume, it's for cricket on a Sunday, football after work, badminton with your building group. Wherever the game is, wear it there.",
  },
  {
    q: 'IS THIS A LIMITED DROP? WILL IT RESTOCK?',
    a: "Our first collection is a limited run, when it's gone, it's gone. That's the drop,\nnot a shortage. Follow us for what's next.",
  },
  {
    q: 'DO YOU SHIP ACROSS INDIA? HOW LONG DOES DELIVERY TAKE?',
    a: 'Yes, pan-India shipping. 5–7 business days.',
  },
  {
    q: "WHAT'S YOUR RETURN/EXCHANGE POLICY?",
    a: 'Refer to our ',
    link: { label: 'Shipping & Returns Policies', href: '/pages/shipping' },
  },
];

// Parse HTML body from Shopify / CMS page to extract FAQ Q&A pairs if provided
function parseFAQs(html: string): FAQItemData[] {
  const div = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (!div) return [];
  div.innerHTML = html;

  const faqs: FAQItemData[] = [];
  const headings = div.querySelectorAll('h2, h3, h4, strong');

  headings.forEach((heading) => {
    const question = heading.textContent?.trim();
    if (!question) return;

    let answerEl = heading.nextElementSibling;
    let answerHtml = '';

    while (answerEl && !['H2', 'H3', 'H4'].includes(answerEl.tagName)) {
      answerHtml += answerEl.outerHTML;
      answerEl = answerEl.nextElementSibling;
    }

    if (question && answerHtml) {
      faqs.push({
        q: question.toUpperCase(),
        a: answerHtml,
        isHtml: true,
      });
    }
  });

  return faqs;
}

interface FaqItemProps {
  item: FAQItemData;
  isOpen: boolean;
  onToggle: () => void;
}

export function FaqItem({ item, isOpen, onToggle }: FaqItemProps) {
  return (
    <div style={{ borderBottom: '1px solid #e5e5e5' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '20px 0',
          background: 'none',
          border: 'none',
          outline: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          gap: '16px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.0625rem',
            fontWeight: 400,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#000000',
          }}
        >
          {item.q}
        </span>
        <span
          style={{
            color: BRAND_COLOR,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'transform 0.25s ease, color 0.2s ease',
            transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
          }}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <title>{isOpen ? 'Collapse question' : 'Expand question'}</title>
            <line x1="12" y1="4" x2="12" y2="20" />
            <line x1="4" y1="12" x2="20" y2="12" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div style={{ paddingBottom: '20px', paddingRight: '48px' }}>
          {item.isHtml ? (
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.875rem',
                color: '#555555',
                lineHeight: 1.75,
                margin: 0,
              }}
              // biome-ignore lint/security/noDangerouslySetInnerHtml: Trusted CMS HTML
              dangerouslySetInnerHTML={{ __html: item.a }}
            />
          ) : (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.875rem',
                color: '#555555',
                lineHeight: 1.75,
                margin: 0,
                whiteSpace: 'pre-line',
              }}
            >
              {item.a}
              {item.link && (
                <Link href={item.link.href} style={{ color: BRAND_COLOR, textDecoration: 'none' }}>
                  {item.link.label}
                </Link>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  bodyHtml?: string;
  hideHeader?: boolean;
}

export default function FAQAccordion({ bodyHtml, hideHeader = false }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const parsed = bodyHtml ? parseFAQs(bodyHtml) : [];
  const items = parsed.length > 0 ? parsed : FAQ_ITEMS;

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      {!hideHeader && (
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(1.5rem, 2.5vw, 2rem)',
            fontWeight: 900,
            textTransform: 'uppercase',
            textAlign: 'center',
            letterSpacing: '0.02em',
            margin: '0 0 40px',
            lineHeight: 1.25,
          }}
        >
          FREQUENTLY ASKED
          <br />
          QUESTIONS
        </h2>
      )}
      <div style={{ borderTop: '1px solid #e5e5e5' }}>
        {items.map((item, i) => (
          <FaqItem
            key={item.q}
            item={item}
            isOpen={openIndex === i}
            onToggle={() => setOpenIndex(openIndex === i ? null : i)}
          />
        ))}
      </div>
    </div>
  );
}
