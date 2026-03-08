import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const fallbackUrl = new URL('/', request.url);
  fallbackUrl.searchParams.set(
    'oauth_error',
    'OAuth connect is disabled. Add Instagram usernames directly from the launcher.'
  );

  return NextResponse.redirect(fallbackUrl);
}
