'use client';

import { useState } from 'react';

// Parse HTML body from Shopify page to extract FAQ Q&A pairs
function parseFAQs(html: string): { question: string; answer: string }[] {
  // Try to parse structured content from HTML
  // Shopify FAQ pages typically use h2/h3 for questions and p for answers
  const div = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (!div) return [];
  div.innerHTML = html;

  const faqs: { question: string; answer: string }[] = [];
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
      faqs.push({ question, answer: answerHtml });
    }
  });

  return faqs;
}

// Default FAQs if page has no content
const DEFAULT_FAQS = [
  {
    question: 'What is VAHN?',
    answer: '<p>VAHN is a premium bespoke teamwear brand crafting exceptional sportswear for clubs, academies, and brands worldwide. We specialise in fully customised kits with no minimum order quantity.</p>',
  },
  {
    question: 'How do I place a bespoke order?',
    answer: '<p>Contact us via our contact page or download our catalogue to see our full range of customisation options. Our team will guide you through the design process from concept to delivery.</p>',
  },
  {
    question: 'What is the minimum order quantity?',
    answer: '<p>We have no minimum order quantity for bespoke teamwear. Whether you need 1 item or 1,000, we can accommodate your order.</p>',
  },
  {
    question: 'How long does production take?',
    answer: '<p>Standard production times are 3-4 weeks from artwork approval. Rush orders may be available — please contact us to discuss your timeline.</p>',
  },
  {
    question: 'Do you ship internationally?',
    answer: '<p>Yes, we ship worldwide. Shipping costs and estimated delivery times will be provided at checkout.</p>',
  },
];

interface Props { bodyHtml?: string; }

export default function FAQAccordion({ bodyHtml }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = bodyHtml ? parseFAQs(bodyHtml) : [];
  const items = faqs.length > 0 ? faqs : DEFAULT_FAQS;

  return (
    <div>
      <h2 style={{ marginBottom: 'var(--space-xl)', fontSize: 'clamp(1.5rem, 3vw, 2.5rem)' }}>
        Frequently Asked Questions
      </h2>
      <div className="faq-accordion">
        {items.map((item, i) => (
          <div key={i} className={`faq-item ${openIndex === i ? 'open' : ''}`}>
            <button
              className="faq-question"
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              aria-expanded={openIndex === i}
            >
              <span>{item.question}</span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="10" y1="3" x2="10" y2="17" />
                <line x1="3" y1="10" x2="17" y2="10" />
              </svg>
            </button>
            <div className="faq-answer">
              <div
                className="faq-answer-inner"
                dangerouslySetInnerHTML={{ __html: item.answer }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
