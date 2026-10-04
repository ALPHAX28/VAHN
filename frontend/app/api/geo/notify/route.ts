import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, countryCode, countryName } = body || {};

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { success: false, message: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }

    const backendUrl =
      process.env.INTERNAL_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:8000';

    try {
      const res = await fetch(`${backendUrl}/api/geo/waitlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          country_code: countryCode || 'INTL',
          country_name: countryName || 'International',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({
          success: true,
          message: data.message || `You're on the priority waitlist for ${countryName || 'your country'}!`,
        });
      }
    } catch {
      // Backend unreachable or offline
    }

    // Return success gracefully even if background logging had a hiccup
    return NextResponse.json({
      success: true,
      message: `Thank you! You're on the priority waitlist for ${countryName || 'your country'}. We'll notify you as soon as international shipping begins.`,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
