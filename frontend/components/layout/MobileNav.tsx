'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface NavLink { href: string; label: string; }

interface Props {
  links: NavLink[];
  onClose: () => void;
  isClosing?: boolean;
}

export default function MobileNav({ links, onClose, isClosing = false }: Props) {
  const { user, openAuthModal, logout } = useAuth();

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

        <nav className="mobile-nav-links-container">
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

        {/* Bottom Account Section in Mobile Sidebar */}
        <div className="mobile-nav-account-footer">
          {user ? (
            <div className="mobile-account-info">
              <div className="mobile-account-greeting">
                <span className="sub">Logged in as</span>
                <strong className="name">{user.full_name}</strong>
              </div>
              <div className="mobile-account-actions">
                <Link href="/account/profile" className="mobile-account-link" onClick={onClose}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  My Profile
                </Link>
                <Link href="/account/orders" className="mobile-account-link" onClick={onClose}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                  My Orders
                </Link>
                <button
                  className="mobile-account-logout-btn"
                  onClick={() => {
                    logout();
                    onClose();
                  }}
                >
                  Log Out
                </button>
              </div>
            </div>
          ) : (
            <button
              className="mobile-nav-auth-btn"
              onClick={() => {
                onClose();
                openAuthModal('login');
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Sign In / Register
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
