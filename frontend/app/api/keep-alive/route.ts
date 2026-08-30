import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const backendUrl =
    process.env.INTERNAL_API_URL ||
    (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.startsWith('http')
      ? process.env.NEXT_PUBLIC_API_URL
      : 'http://backend:8000/api');

  const base = backendUrl.replace(/\/+$/, '');
  const healthUrl = `${base}/health`;
  const productsUrl = `${base}/products`;

  try {
    // Parallel warmup: ping health (DB connection) and products (query & model caching)
    const [healthRes, productsRes] = await Promise.allSettled([
      fetch(healthUrl, {
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

    const isHealthOk = healthRes.status === 'fulfilled' && healthRes.value.ok;
    const isProductsOk = productsRes.status === 'fulfilled' && productsRes.value.ok;

    return NextResponse.json({
      status: 'ok',
      warmed: true,
      timestamp: new Date().toISOString(),
      health_status: isHealthOk ? 200 : 500,
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
