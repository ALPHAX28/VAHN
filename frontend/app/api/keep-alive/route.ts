import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const backendUrl =
    process.env.INTERNAL_API_URL ||
    (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.startsWith('http')
      ? process.env.NEXT_PUBLIC_API_URL
      : 'http://backend:8000/api');

  const base = backendUrl.replace(/\/+$/, '');
  const keepAliveUrl = `${base}/keep-alive`;
  const productsUrl = `${base}/products`;

  try {
    // Parallel warmup: ping backend keep-alive (DB SELECT 1) and products (query & model caching)
    const [keepAliveRes, productsRes] = await Promise.allSettled([
      fetch(keepAliveUrl, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        next: { revalidate: 0 },
      }),
      fetch(productsUrl, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        next: { revalidate: 0 },
      }),
    ]);

    const isKeepAliveOk = keepAliveRes.status === 'fulfilled' && keepAliveRes.value.ok;
    const isProductsOk = productsRes.status === 'fulfilled' && productsRes.value.ok;

    return NextResponse.json({
      status: 'ok',
      warmed: true,
      timestamp: new Date().toISOString(),
      backend_keepalive: isKeepAliveOk ? 200 : 500,
      products_warmed: isProductsOk,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Warmup failed',
      },
      { status: 500 }
    );
  }
}
