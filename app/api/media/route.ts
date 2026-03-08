import { NextResponse } from 'next/server';
import { isAllowedInstagramMediaHost } from '@lib/instagramMedia';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const targetUrl = requestUrl.searchParams.get('url');

    if (!targetUrl) {
      return NextResponse.json({ error: 'url is required.' }, { status: 400 });
    }

    let parsedTargetUrl: URL;

    try {
      parsedTargetUrl = new URL(targetUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid media URL.' }, { status: 400 });
    }

    if (parsedTargetUrl.protocol !== 'https:') {
      return NextResponse.json({ error: 'Only https media URLs are allowed.' }, { status: 400 });
    }

    if (!isAllowedInstagramMediaHost(parsedTargetUrl.hostname)) {
      return NextResponse.json({ error: 'Unsupported media host.' }, { status: 400 });
    }

    const upstreamResponse = await fetch(parsedTargetUrl.toString(), {
      cache: 'no-store',
      headers: {
        accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        referer: 'https://www.instagram.com/',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
      },
    });

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        { error: `Upstream media request failed (${upstreamResponse.status}).` },
        { status: upstreamResponse.status }
      );
    }

    const contentType = upstreamResponse.headers.get('content-type') ?? 'application/octet-stream';
    const body = await upstreamResponse.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'cache-control': 'public, max-age=120, s-maxage=300, stale-while-revalidate=600',
        'content-type': contentType,
      },
    });
  } catch (error) {
    console.error('Error in media GET route:', error);
    return NextResponse.json({ error: 'Failed to load media.' }, { status: 500 });
  }
}
