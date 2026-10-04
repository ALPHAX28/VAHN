import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const COUNTRY_NAMES: Record<string, { name: string; flag: string }> = {
  IN: { name: 'India', flag: '🇮🇳' },
  US: { name: 'United States', flag: '🇺🇸' },
  GB: { name: 'United Kingdom', flag: '🇬🇧' },
  CA: { name: 'Canada', flag: '🇨🇦' },
  AU: { name: 'Australia', flag: '🇦🇺' },
  AE: { name: 'United Arab Emirates', flag: '🇦🇪' },
  SG: { name: 'Singapore', flag: '🇸🇬' },
  DE: { name: 'Germany', flag: '🇩🇪' },
  FR: { name: 'France', flag: '🇫🇷' },
  JP: { name: 'Japan', flag: '🇯🇵' },
  NZ: { name: 'New Zealand', flag: '🇳🇿' },
  ZA: { name: 'South Africa', flag: '🇿🇦' },
  IE: { name: 'Ireland', flag: '🇮🇪' },
  NL: { name: 'Netherlands', flag: '🇳🇱' },
  IT: { name: 'Italy', flag: '🇮🇹' },
  ES: { name: 'Spain', flag: '🇪🇸' },
  CH: { name: 'Switzerland', flag: '🇨🇭' },
  SE: { name: 'Sweden', flag: '🇸🇪' },
  NO: { name: 'Norway', flag: '🇳🇴' },
  DK: { name: 'Denmark', flag: '🇩🇰' },
  SA: { name: 'Saudi Arabia', flag: '🇸🇦' },
  QA: { name: 'Qatar', flag: '🇶🇦' },
  KW: { name: 'Kuwait', flag: '🇰🇼' },
  MY: { name: 'Malaysia', flag: '🇲🇾' },
  TH: { name: 'Thailand', flag: '🇹🇭' },
  ID: { name: 'Indonesia', flag: '🇮🇩' },
  PH: { name: 'Philippines', flag: '🇵🇭' },
  BD: { name: 'Bangladesh', flag: '🇧🇩' },
  LK: { name: 'Sri Lanka', flag: '🇱🇰' },
  NP: { name: 'Nepal', flag: '🇳🇵' },
  BR: { name: 'Brazil', flag: '🇧🇷' },
  MX: { name: 'Mexico', flag: '🇲🇽' },
};

function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  const cleanIp = ip.trim();
  if (
    cleanIp === '127.0.0.1' ||
    cleanIp === '::1' ||
    cleanIp === 'localhost' ||
    cleanIp.startsWith('10.') ||
    cleanIp.startsWith('192.168.') ||
    cleanIp.startsWith('fc00:') ||
    cleanIp.startsWith('fe80:')
  ) {
    return true;
  }
  // Check 172.16.0.0 to 172.31.255.255
  if (cleanIp.startsWith('172.')) {
    const parts = cleanIp.split('.');
    if (parts.length >= 2) {
      const secondOctet = Number.parseInt(parts[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) {
        return true;
      }
    }
  }
  return false;
}

export async function GET(req: NextRequest) {
  try {
    const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '')
      .toLowerCase()
      .split(',')[0]
      .trim()
      .split(':')[0];

    const isProd =
      host === 'vahnsports.com' ||
      host === 'www.vahnsports.com' ||
      host === 'admin.vahnsports.com' ||
      (host.endsWith('vahnsports.com') && !host.startsWith('dev.') && !host.startsWith('dev-')) ||
      (process.env.NODE_ENV === 'production' && !host.includes('dev'));

    const isDevOrLocal =
      !isProd &&
      (host === 'localhost' ||
        host === '127.0.0.1' ||
        host.endsWith('.localhost') ||
        host.startsWith('dev.') ||
        host.includes('dev-') ||
        host.includes('staging') ||
        process.env.NODE_ENV !== 'production' ||
        process.env.NEXT_PUBLIC_APP_ENV === 'development');

    // 1. Check for testing override query param — STRICTLY restricted to dev & localhost environments
    const testGeo = isDevOrLocal ? req.nextUrl.searchParams.get('test_geo') : null;
    if (testGeo && /^[a-zA-Z]{2}$/.test(testGeo)) {
      const upper = testGeo.toUpperCase();
      const meta = COUNTRY_NAMES[upper] || { name: upper, flag: '🌐' };
      return NextResponse.json({
        countryCode: upper,
        countryName: meta.name,
        countryFlag: meta.flag,
        isServiceable: upper === 'IN',
        source: 'test_override',
      });
    }

    // 2. Check edge proxy headers (Cloudflare, Vercel, AWS CloudFront)
    const cfCountry = req.headers.get('cf-ipcountry');
    const vercelCountry = req.headers.get('x-vercel-ip-country');
    const cloudfrontCountry = req.headers.get('cloudfront-viewer-country');

    const edgeCountry = (cfCountry || vercelCountry || cloudfrontCountry || '')
      .trim()
      .toUpperCase();
    if (edgeCountry && /^[A-Z]{2}$/.test(edgeCountry) && edgeCountry !== 'XX') {
      const meta = COUNTRY_NAMES[edgeCountry] || { name: edgeCountry, flag: '🌐' };
      return NextResponse.json({
        countryCode: edgeCountry,
        countryName: meta.name,
        countryFlag: meta.flag,
        isServiceable: edgeCountry === 'IN',
        source: 'edge_header',
      });
    }

    // 3. Extract client IP
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    let clientIp = '';
    if (forwarded) {
      clientIp = forwarded.split(',')[0].trim();
    } else if (realIp) {
      clientIp = realIp.trim();
    }

    // If local or private IP, default to India for development & internal testing
    if (!clientIp || isPrivateIp(clientIp)) {
      return NextResponse.json({
        countryCode: 'IN',
        countryName: 'India',
        countryFlag: '🇮🇳',
        isServiceable: true,
        source: 'localhost_default',
      });
    }

    // 4. Fallback lookup to fast country API with 2.5s timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`https://api.country.is/${clientIp}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
        next: { revalidate: 3600 },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const country = (data.country || '').trim().toUpperCase();
        if (country && /^[A-Z]{2}$/.test(country)) {
          const meta = COUNTRY_NAMES[country] || { name: country, flag: '🌐' };
          return NextResponse.json({
            countryCode: country,
            countryName: meta.name,
            countryFlag: meta.flag,
            isServiceable: country === 'IN',
            source: 'ip_lookup',
          });
        }
      }
    } catch {
      // Lookup error or timeout -> fail open
    }

    // 5. Default fallback (Fail Open: allow access)
    return NextResponse.json({
      countryCode: 'IN',
      countryName: 'India',
      countryFlag: '🇮🇳',
      isServiceable: true,
      source: 'fallback_open',
    });
  } catch {
    // Ultimate fail open
    return NextResponse.json({
      countryCode: 'IN',
      countryName: 'India',
      countryFlag: '🇮🇳',
      isServiceable: true,
      source: 'safe_fail_open',
    });
  }
}
