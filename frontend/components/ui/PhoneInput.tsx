'use client';

import { useState, useRef, useEffect, useId } from 'react';

export interface CountryCodeItem {
  code: string;
  iso: string;
  name: string;
}

export const COUNTRY_CODES: CountryCodeItem[] = [
  { code: '+91', iso: 'IN', name: 'India' },
  { code: '+1', iso: 'US', name: 'United States / Canada' },
  { code: '+44', iso: 'GB', name: 'United Kingdom' },
  { code: '+971', iso: 'AE', name: 'United Arab Emirates' },
  { code: '+61', iso: 'AU', name: 'Australia' },
  { code: '+65', iso: 'SG', name: 'Singapore' },
  { code: '+49', iso: 'DE', name: 'Germany' },
  { code: '+33', iso: 'FR', name: 'France' },
  { code: '+81', iso: 'JP', name: 'Japan' },
  { code: '+966', iso: 'SA', name: 'Saudi Arabia' },
  { code: '+974', iso: 'QA', name: 'Qatar' },
  { code: '+965', iso: 'KW', name: 'Kuwait' },
  { code: '+64', iso: 'NZ', name: 'New Zealand' },
  { code: '+880', iso: 'BD', name: 'Bangladesh' },
  { code: '+977', iso: 'NP', name: 'Nepal' },
  { code: '+94', iso: 'LK', name: 'Sri Lanka' },
  { code: '+86', iso: 'CN', name: 'China' },
  { code: '+39', iso: 'IT', name: 'Italy' },
  { code: '+34', iso: 'ES', name: 'Spain' },
  { code: '+31', iso: 'NL', name: 'Netherlands' },
  { code: '+41', iso: 'CH', name: 'Switzerland' },
  { code: '+46', iso: 'SE', name: 'Sweden' },
  { code: '+47', iso: 'NO', name: 'Norway' },
  { code: '+45', iso: 'DK', name: 'Denmark' },
  { code: '+353', iso: 'IE', name: 'Ireland' },
];

interface PhoneInputProps {
  id?: string;
  name?: string;
  countryCode: string;
  phone: string;
  onCountryCodeChange: (code: string) => void;
  onPhoneChange: (phone: string) => void;
  onBlur?: () => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export default function PhoneInput({
  id = 'phone',
  name = 'phone',
  countryCode,
  phone,
  onCountryCodeChange,
  onPhoneChange,
  onBlur,
  error,
  required = false,
  disabled = false,
  placeholder,
}: PhoneInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchId = useId();

  const currentCountry =
    COUNTRY_CODES.find((c) => c.code === countryCode) || COUNTRY_CODES[0];

  const filteredCountries = COUNTRY_CODES.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.iso.toLowerCase().includes(q)
    );
  });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus search when dropdown opens
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close dropdown on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelectCountry = (country: CountryCodeItem) => {
    onCountryCodeChange(country.code);
    setIsOpen(false);
    setSearchQuery('');
    // Re-validate and trim phone if switching to/from India
    if (country.code === '+91' && phone.length > 10) {
      onPhoneChange(phone.slice(0, 10));
    }
    inputRef.current?.focus();
  };

  const handleDigitsOnly = (val: string) => {
    const digits = val.replace(/\D/g, '');
    const maxLen = countryCode === '+91' ? 10 : 15;
    onPhoneChange(digits.slice(0, maxLen));
  };

  const defaultPlaceholder =
    placeholder || (countryCode === '+91' ? '98765 43210' : 'Phone number');

  const isFocused = isInputFocused || isOpen;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
      }}
    >
      {/* Seamless Unified Input Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: '46px',
          backgroundColor: '#ffffff',
          border: error
            ? '1px solid #d93025'
            : isFocused
              ? '1px solid var(--color-black, #111111)'
              : '1px solid var(--color-border, #e5e5e5)',
          boxShadow: error
            ? '0 0 0 1px #d93025'
            : isFocused
              ? '0 0 0 1px var(--color-black, #111111)'
              : 'none',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          boxSizing: 'border-box',
        }}
      >
        {/* Country Code Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          disabled={disabled}
          title={`Selected country: ${currentCountry.name} (${currentCountry.code})`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            height: '100%',
            padding: '0 12px',
            background: 'transparent',
            border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '0.8125rem',
            color: 'var(--color-text, #111111)',
            flexShrink: 0,
            userSelect: 'none',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
              backgroundColor: '#f1f1f4',
              color: '#222222',
              padding: '2px 5px',
              borderRadius: '2px',
              textTransform: 'uppercase',
            }}
          >
            {currentCountry.iso}
          </span>
          <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#111111' }}>
            {currentCountry.code}
          </span>
          <svg
            aria-hidden="true"
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              color: '#777777',
              transition: 'transform 0.2s ease',
              transform: isOpen ? 'rotate(180deg)' : 'none',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Subtle Vertical Hairline Separator */}
        <div
          style={{
            width: '1px',
            height: '24px',
            backgroundColor: 'var(--color-border, #e5e5e5)',
            flexShrink: 0,
          }}
        />

        {/* Direct Digits Input */}
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="tel"
          inputMode="numeric"
          required={required}
          aria-required={required}
          disabled={disabled}
          value={phone}
          placeholder={defaultPlaceholder}
          maxLength={countryCode === '+91' ? 10 : 15}
          onChange={(e) => handleDigitsOnly(e.target.value)}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => {
            setIsInputFocused(false);
            if (onBlur) onBlur();
          }}
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            padding: '0 14px',
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            fontSize: '0.9375rem',
            color: 'var(--color-text, #111111)',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Luxury Popover Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: '320px',
            maxWidth: 'calc(100vw - 32px)',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e4e8',
            boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.12), 0 4px 12px -2px rgba(0, 0, 0, 0.06)',
            zIndex: 150,
            borderRadius: '0px',
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          {/* Quick Search Header */}
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid #f0f0f3',
              backgroundColor: '#fafafb',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#ffffff',
                border: '1px solid #e5e5e8',
                padding: '6px 10px',
              }}
            >
              <svg
                aria-hidden="true"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#888888"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchInputRef}
                id={searchId}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search country or code..."
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.8125rem',
                  width: '100%',
                  backgroundColor: 'transparent',
                  color: '#111111',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    color: '#999999',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Country List */}
          <div
            role="listbox"
            style={{
              maxHeight: '230px',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
            }}
          >
            {filteredCountries.length === 0 ? (
              <div
                style={{
                  padding: '20px 16px',
                  textAlign: 'center',
                  fontSize: '0.8125rem',
                  color: '#888888',
                }}
              >
                No country found for &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              filteredCountries.map((c) => {
                const isSelected = c.code === countryCode;
                return (
                  <button
                    key={`${c.iso}-${c.code}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelectCountry(c)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '9px 14px',
                      border: 'none',
                      backgroundColor: isSelected ? '#f5f7fb' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background-color 0.12s ease',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = '#f8f8fa';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          backgroundColor: isSelected ? '#000000' : '#ececf0',
                          color: isSelected ? '#ffffff' : '#444444',
                          padding: '2px 5px',
                          borderRadius: '2px',
                          minWidth: '22px',
                          textAlign: 'center',
                          textTransform: 'uppercase',
                        }}
                      >
                        {c.iso}
                      </span>
                      <span
                        style={{
                          fontSize: '0.84rem',
                          color: isSelected ? '#000000' : '#222222',
                          fontWeight: isSelected ? 700 : 500,
                        }}
                      >
                        {c.name}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: isSelected ? 'var(--color-navy, #1e40af)' : '#666666',
                      }}
                    >
                      {c.code}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
