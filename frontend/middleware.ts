import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Skip Next.js internals, API routes, and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/fonts') ||
    pathname === '/favicon.ico' ||
    pathname === '/icon.png' ||
    /\.(.*)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // 2. Extract and normalize hostname
  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').toLowerCase();
  const hostname = host.split(':')[0];

  const isLocalhost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.localhost');

  const isAdminSubdomain =
    hostname === 'admin.vahnsports.com' ||
    hostname === 'dev-admin.vahnsports.com' ||
    hostname === 'admin-dev.vahnsports.com' ||
    hostname === '10.8.0.1' ||
    hostname.startsWith('10.8.') ||
    hostname.startsWith('admin.') ||
    hostname.startsWith('dev-admin.');

  // 3. CASE: Admin Subdomains (admin.vahnsports.com & dev-admin.vahnsports.com)
  if (isAdminSubdomain) {
    // If accessing storefront tracking page from admin domain, redirect to storefront
    if (pathname === '/track' || pathname.startsWith('/track/')) {
      const isDev =
        hostname.includes('dev-admin') ||
        hostname.includes('admin-dev') ||
        hostname.includes('10.8.');
      const storefrontHost = isDev ? 'dev.vahnsports.com' : 'vahnsports.com';
      const redirectUrl = new URL(
        req.nextUrl.pathname + req.nextUrl.search,
        `https://${storefrontHost}`
      );
      return NextResponse.redirect(redirectUrl);
    }

    // If accessing root, rewrite to /admin
    if (pathname === '/') {
      const url = req.nextUrl.clone();
      url.pathname = '/admin';
      return NextResponse.rewrite(url);
    }

    // If accessing a non-admin path (e.g. /products, /orders, /login), rewrite to /admin/*
    if (!pathname.startsWith('/admin')) {
      const url = req.nextUrl.clone();
      url.pathname = `/admin${pathname}`;
      return NextResponse.rewrite(url);
    }

    // If already starts with /admin, allow through
    return NextResponse.next();
  }

  // 4. CASE: Storefront Domains (vahnsports.com, dev.vahnsports.com, etc.)
  // On non-localhost, any attempt to access /admin or /admin/* is completely blocked with 404
  if (!isLocalhost && (pathname === '/admin' || pathname.startsWith('/admin/'))) {
    const notFoundUrl = req.nextUrl.clone();
    notFoundUrl.pathname = '/_not-found';
    return NextResponse.rewrite(notFoundUrl, { status: 404 });
  }

  // 5. Allow standard storefront routes and localhost to proceed normally
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icon.png
     */
    '/((?!api|_next/static|_next/image|favicon.ico|icon.png).*)',
  ],
};
