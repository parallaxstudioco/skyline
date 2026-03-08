import { NextResponse } from 'next/server';
import { bootstrapBackendServices } from '@/server/bootstrap';
import { scheduleRecurringMetricsRefresh } from '@mcp/queue/metricsQueue';
import { instagramMetricsService } from '@services/InstagramMetricsService';
import { connectedAccountsStore } from '@lib/store/connectedAccounts';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await bootstrapBackendServices();
    const result = await instagramMetricsService.listAccountMetrics();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in accounts GET route:', error);
    return NextResponse.json({ error: 'Failed to load accounts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
    };
    const normalizedUsername = body.username?.trim().replace(/^@+/, '').toLowerCase();

    if (!normalizedUsername) {
      return NextResponse.json(
        { error: 'username is required.' },
        { status: 400 }
      );
    }

    await bootstrapBackendServices();
    const existingAccount = await connectedAccountsStore.getByUsername(normalizedUsername);

    await connectedAccountsStore.upsert({
      username: normalizedUsername,
    });
    await scheduleRecurringMetricsRefresh(normalizedUsername);

    // Instead of waiting for the full fetch (which takes seconds), return a "pending" account immediately.
    // The background job triggered by scheduleRecurringMetricsRefresh will push the full data via Pusher.
    const pendingAccount: any = {
      accountKey: normalizedUsername,
      username: normalizedUsername,
      followers: 0,
      following: 0,
      posts: 0,
      avgLikes: 0,
      cachedAt: new Date().toISOString(),
      engagementSummary: {
        sampledPosts: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        views: 0,
      },
      postsData: [],
      isPending: true,
    };

    return NextResponse.json(
      {
        account: pendingAccount,
        saved: true,
      },
      { status: existingAccount ? 200 : 201 }
    );
  } catch (error) {
    console.error('Error in accounts POST route:', error);
    const status =
      typeof (error as { status?: unknown }).status === 'number'
        ? ((error as { status: number }).status)
        : 500;

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to add account',
      },
      { status }
    );
  }
}
