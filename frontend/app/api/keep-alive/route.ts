import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const backendUrl = process.env.INTERNAL_API_URL || (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.startsWith('http') ? process.env.NEXT_PUBLIC_API_URL : 'http://backend:8000/api');
  const pingUrl = `${backendUrl.replace(/\/+$/, '')}/health`;

  try {
    const res = await fetch(pingUrl, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
      next: { revalidate: 0 },
    });

    const data = await res.json().catch(() => null);

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      backend_status: res.status,
      data,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Ping failed',
      },
      { status: 500 }
    );
  }
}
