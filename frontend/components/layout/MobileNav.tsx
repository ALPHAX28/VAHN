'use client';

import Link from 'next/link';

interface NavLink { href: string; label: string; }

interface Props {
  links: NavLink[];
  onClose: () => void;
  isClosing?: boolean;
}

export default function MobileNav({ links, onClose, isClosing = false }: Props) {
  return (
    <div className="mobile-nav" role="dialog" aria-label="Mobile navigation">
      {/* Backdrop overlay */}
      <div
        className={`backdrop ${isClosing ? 'closing' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div className={`mobile-nav-panel ${isClosing ? 'closing' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', letterSpacing: '0.2em' }}>VAHN</span>
          <button
            onClick={onClose}
            aria-label="Close menu"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="2" y1="2" x2="18" y2="18" /><line x1="18" y1="2" x2="2" y2="18" />
            </svg>
          </button>
        </div>
        <nav>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="mobile-nav-link"
              onClick={onClose}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
