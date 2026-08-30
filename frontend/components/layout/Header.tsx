'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import SearchModal from '@/components/layout/SearchModal';
import MobileNav from '@/components/layout/MobileNav';
import AnnouncementBanner from '@/components/layout/AnnouncementBanner';

const NAV_LINKS = [
  { href: '/products', label: 'All Products' },
  { href: '/pages/about', label: 'Our Story' },
];

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

  const isHomepage = pathname === '/';

  useEffect(() => {
    if (mobileOpen || searchOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen, searchOpen]);

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

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 30);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isTransparent = isHomepage && !scrolled;

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        width: '100%',
      }}
    >
      {/* Dynamic Announcement & Notification Banner */}
      <AnnouncementBanner />

      {/* Main VAHN Header Bar */}
      <header
        style={{
          width: '100%',
          backgroundColor: '#111111',
          borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: scrolled ? '0 4px 20px rgba(0, 0, 0, 0.5)' : 'none',
          transition: 'background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
        }}
      >
        <div
          style={{
            maxWidth: '100%',
            margin: '0 auto',
            height: '60px',
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            padding: '0 clamp(16px, 3.5vw, 48px)',
          }}
        >
          {/* Left: Desktop Nav Links (Desktop) OR Hamburger (Mobile) */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {/* Desktop Navigation */}
            <nav
              className="header-desktop-nav"
              aria-label="Primary navigation"
            >
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontStyle: 'normal',
                    fontSize: '0.875rem',
                    fontWeight: 400,
                    letterSpacing: '-0.01em',
                    color: 'rgba(255, 255, 255, 0.92)',
                    textDecoration: 'none',
                    transition: 'color 0.2s ease, opacity 0.2s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.92)')}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Mobile Hamburger Button */}
            <button
              className="header-mobile-hamburger"
              aria-label="Open navigation menu"
              onClick={() => setMobileOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'rgba(255, 255, 255, 0.9)',
                padding: '6px',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)')}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>

          {/* Center: Official VAHN Logo */}
          <Link
            href="/"
            aria-label="VAHN — Go to homepage"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
            }}
          >
            <Image
              src={
                isTransparent
                  ? '/assets/logos/VAHN-Primary-white-transparent.png'
                  : '/assets/logos/VAHN-Primary-colour-transparent.png'
              }
              alt="VAHN"
              width={105}
              height={24}
              priority
              style={{
                height: '21px',
                width: 'auto',
                display: 'block',
                objectFit: 'contain',
                transition: 'opacity 0.2s ease',
              }}
            />
          </Link>

          {/* Right: Actions (Search, Account, Cart) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 'clamp(8px, 2vw, 16px)',
            }}
          >
            {/* 1. Search Icon */}
            <button
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'opacity 0.2s ease, transform 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.9';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <Image
                src="/icons/search.png"
                alt="Search"
                width={20}
                height={20}
                style={{ width: '20px', height: '20px', objectFit: 'contain', display: 'block' }}
              />
            </button>

            {/* 2. User Account Icon (Desktop) */}
            <div className="header-desktop-account" style={{ position: 'relative' }}>
              <button
                aria-label={user ? `Account (${user.full_name})` : 'Sign In / Register'}
                onClick={() => {
                  if (user) {
                    setUserDropdownOpen(!userDropdownOpen);
                  } else {
                    openAuthModal();
                  }
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'opacity 0.2s ease, transform 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <Image
                  src="/icons/user.png"
                  alt="Account"
                  width={20}
                  height={20}
                  style={{ width: '20px', height: '20px', objectFit: 'contain', display: 'block' }}
                />
              </button>

              {/* Dropdown Menu when logged in */}
              {user && userDropdownOpen && (
                <div
                  className="header-user-dropdown"
                  onClick={() => setUserDropdownOpen(false)}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    marginTop: '8px',
                    background: '#16181e',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '6px',
                    padding: '12px',
                    minWidth: '200px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                    zIndex: 200,
                  }}
                >
                  <div style={{ padding: '4px 8px 8px' }}>
                    <span style={{ fontSize: '0.6875rem', color: '#888', display: 'block' }}>Signed in as</span>
                    <strong style={{ fontSize: '0.875rem', color: '#fff' }}>{user.full_name}</strong>
                  </div>
                  <hr style={{ borderColor: 'rgba(255, 255, 255, 0.1)', margin: '4px 0 8px' }} />
                  <Link
                    href="/account/profile"
                    style={{
                      display: 'block',
                      padding: '6px 8px',
                      color: 'rgba(255, 255, 255, 0.8)',
                      textDecoration: 'none',
                      fontSize: '0.8125rem',
                    }}
                  >
                    Profile & Password
                  </Link>
                  <Link
                    href="/account/orders"
                    style={{
                      display: 'block',
                      padding: '6px 8px',
                      color: 'rgba(255, 255, 255, 0.8)',
                      textDecoration: 'none',
                      fontSize: '0.8125rem',
                    }}
                  >
                    My Orders
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      setUserDropdownOpen(false);
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 8px',
                      color: '#e02424',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                    }}
                  >
                    Log Out
                  </button>
                </div>
              )}
            </div>

            {/* 3. Shopping Bag Cart Icon */}
            <button
              aria-label={`Cart (${totalQuantity} items)`}
              onClick={openCart}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                transition: 'opacity 0.2s ease, transform 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.9';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <Image
                src="/icons/cart.png"
                alt="Cart"
                width={20}
                height={20}
                style={{ width: '20px', height: '20px', objectFit: 'contain', display: 'block' }}
              />
              {totalQuantity > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '0px',
                    right: '0px',
                    background: '#4232d9',
                    color: '#ffffff',
                    fontSize: '0.5625rem',
                    fontWeight: 700,
                    minWidth: '15px',
                    height: '15px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 3px',
                  }}
                >
                  {totalQuantity}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
      {shouldRenderNav && (
        <MobileNav links={NAV_LINKS} isClosing={isClosingNav} onClose={() => setMobileOpen(false)} />
      )}
    </div>
  );
}
