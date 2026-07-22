'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import SearchModal from '@/components/layout/SearchModal';
import MobileNav from '@/components/layout/MobileNav';

const NAV_LINKS = [
  { href: '/collections/vahn-beginning', label: 'Shop' },
  { href: '/pages/about', label: 'About' },
  { href: '/pages/catalogue-page', label: 'Catalogue' },
  { href: '/blogs/news', label: 'Journal' },
  { href: '/pages/contact', label: 'Contact' },
];

// Pages where the header starts transparent over the hero
const TRANSPARENT_PATHS = ['/'];

export default function Header() {
  const { totalQuantity, openCart } = useCart();
  const { user, openAuthModal, logout } = useAuth();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [shouldRenderNav, setShouldRenderNav] = useState(false);
  const [isClosingNav, setIsClosingNav] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    if (mobileOpen) {
      setShouldRenderNav(true);
      setIsClosingNav(false);
    } else if (shouldRenderNav) {
      setIsClosingNav(true);
      const timer = setTimeout(() => {
        setShouldRenderNav(false);
        setIsClosingNav(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [mobileOpen, shouldRenderNav]);

  // Derive transparent from pathname — no useEffect setState needed
  const isTransparent = TRANSPARENT_PATHS.some(
    (p) => p === pathname || (p !== '/' && pathname.startsWith(p))
  );

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const headerClass = [
    'header',
    isTransparent && !scrolled ? 'transparent' : '',
    scrolled ? 'scrolled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const logoLight = isTransparent && !scrolled;

  return (
    <>
      {/* Announcement Bar */}
      <div className="announcement-bar" role="banner">
        ✦ Shop our latest arrivals! ✦ Free shipping across India on orders over ₹999 ✦
      </div>

      <header className={headerClass}>
        <div className="header-inner">
          {/* Left: Desktop Nav */}
          <nav className="header-nav" aria-label="Primary navigation">
            {NAV_LINKS.slice(0, 3).map((link) => (
              <Link key={link.href} href={link.href} className="nav-link">
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Center: Logo */}
          <Link href="/" className="header-logo" aria-label="VAHN — Go to homepage" style={{ display: 'flex', alignItems: 'center', height: '28px' }}>
            {logoError ? (
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.5rem',
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                  color: logoLight ? '#ffffff' : '#000000',
                  lineHeight: 1,
                }}
              >
                VAHN
              </span>
            ) : (
              <Image
                src={logoLight ? '/assets/logo-white.png' : '/assets/logo.png'}
                alt="VAHN"
                width={120}
                height={28}
                priority
                style={{ display: 'block', height: '28px', width: 'auto' }}
                onError={() => setLogoError(true)}
              />
            )}
          </Link>

          {/* Right: Actions */}
          <div className="header-actions">
            {/* Extra nav links (hidden, handled in mobile nav) */}
            {NAV_LINKS.slice(3).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="nav-link"
                aria-hidden="true"
                tabIndex={-1}
                style={{ display: 'none' }}
              />
            ))}

            {/* Search */}
            <button
              className="header-icon"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8.5" cy="8.5" r="5.5" />
                <line x1="13" y1="13" x2="18" y2="18" />
              </svg>
            </button>

            {/* Cart */}
            <button
              className="header-icon"
              aria-label={`Cart (${totalQuantity} items)`}
              onClick={openCart}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 2h2l2.68 9.39a1 1 0 0 0 .94.67h8.16a1 1 0 0 0 .94-.67L18 6H6" />
                <circle cx="8" cy="17" r="1" fill="currentColor" stroke="none" />
                <circle cx="15" cy="17" r="1" fill="currentColor" stroke="none" />
              </svg>
              {totalQuantity > 0 && (
                <span className="cart-badge">{totalQuantity}</span>
              )}
            </button>

            {/* User Account / Auth */}
            <div className="header-user-menu-wrapper" style={{ position: 'relative' }}>
              <button
                className="header-icon"
                aria-label={user ? `Account (${user.full_name})` : "Sign In / Register"}
                onClick={() => {
                  if (user) {
                    setUserDropdownOpen(!userDropdownOpen);
                  } else {
                    openAuthModal('login');
                  }
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </button>

              {/* Logged In Dropdown Menu */}
              {user && userDropdownOpen && (
                <div className="header-user-dropdown" onClick={() => setUserDropdownOpen(false)}>
                  <div className="dropdown-user-greeting">
                    <span className="greeting-sub">Welcome</span>
                    <strong className="greeting-name">{user.full_name}</strong>
                  </div>
                  <hr className="dropdown-divider" />
                  <Link href="/account/profile" className="user-dropdown-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    Profile & Password
                  </Link>
                  <Link href="/account/orders" className="user-dropdown-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                    My Orders
                  </Link>
                  <hr className="dropdown-divider" />
                  <button
                    className="user-dropdown-item logout-btn"
                    onClick={() => {
                      logout();
                      setUserDropdownOpen(false);
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Log Out
                  </button>
                </div>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              className="hamburger header-icon"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="3" y1="5" x2="17" y2="5" />
                <line x1="3" y1="10" x2="17" y2="10" />
                <line x1="3" y1="15" x2="17" y2="15" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
      {shouldRenderNav && (
        <MobileNav links={NAV_LINKS} isClosing={isClosingNav} onClose={() => setMobileOpen(false)} />
      )}
    </>
  );
}
