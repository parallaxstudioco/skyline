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

    try {
      const account = await instagramMetricsService.getAccountMetrics(normalizedUsername);

      return NextResponse.json(
        {
          account,
          saved: true,
        },
        { status: existingAccount ? 200 : 201 }
      );
    } catch (error) {
      if (!existingAccount) {
        await connectedAccountsStore.remove(normalizedUsername).catch(() => undefined);
      }

      throw error;
    }
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
