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
    question: 'What does VAHN make?',
    answer:
      '<p>Right now, jerseys built for the way you actually play. This is our first drop. More performance apparel is coming soon.</p>',
  },
  {
    question: 'Are the jerseys unisex?',
    answer:
      '<p>Yes. Every VAHN jersey is designed with a versatile, athletic silhouette crafted for everyone.</p>',
  },
  {
    question: 'How does the fit run?',
    answer:
      '<p>Relaxed, not oversized. If you are between sizes, we recommend sizing down for a closer athletic fit, or choosing your true size for the intended relaxed drape.</p>',
  },
  {
    question: 'What fabric are the jerseys crafted from?',
    answer:
      '<p>100% micro-yarn polyester at 155 GSM. Engineered with high-performance moisture management that pulls sweat away from the skin, paired with micro-ventilation mesh across high-heat zones for airflow.</p>',
  },
  {
    question: 'Can I wear VAHN on the pitch, or is it lifestyle streetwear?',
    answer:
      '<p>Both. VAHN bridges high performance and streetwear. Whether it is competitive turf football, Sunday cricket, or casual wear, our kits are built to perform and look sharp anywhere.</p>',
  },
  {
    question: 'Is this a limited drop? Will it restock?',
    answer:
      '<p>Our core releases are strictly limited edition. Once a colorway or drop sells out, it will not be restocked in the same specification. You can sign up for restock notifications on any product page.</p>',
  },
  {
    question: 'Do you ship across India? How long does delivery take?',
    answer:
      '<p>Yes, we offer pan-India delivery across all serviceable PIN codes via Shiprocket express logistics. Standard delivery takes 5–7 business days.</p>',
  },
  {
    question: 'What is your return & exchange policy?',
    answer:
      '<p>We offer a hassle-free 10-day exchange and return window for unworn items in original packaging with tags intact. Please visit our <a href="/pages/shipping" style="color: #4232d9; text-decoration: underline;">Shipping & Returns page</a> for full details.</p>',
  },
];

interface Props {
  bodyHtml?: string;
}

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
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <line x1="10" y1="3" x2="10" y2="17" />
                <line x1="3" y1="10" x2="17" y2="10" />
              </svg>
            </button>
            <div className="faq-answer">
              <div className="faq-answer-inner" dangerouslySetInnerHTML={{ __html: item.answer }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
