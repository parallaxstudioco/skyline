'use client';

import { useEffect, useMemo, useState } from 'react';
import Pusher from 'pusher-js';
import { CityScene } from '@frontend/CityScene';
import { Tooltip } from '@frontend/Tooltip';
import { PostPanel } from '@frontend/PostPanel';
import { AddAccountForm } from '@frontend/AddAccountForm';
import { SessionLocationMap } from '@frontend/SessionLocationMap';
import { AccountMetrics, CommentData, PostData, SessionLocation } from '@lib/types';

type AccountsResponse =
  | AccountMetrics[]
  | {
      accounts: AccountMetrics[];
      warnings?: string[];
    };

type MetricsUpdatePayload = {
  metrics: AccountMetrics;
  reason: string;
  type: 'metrics:update';
  updatedAt: string;
};

type SelectedPost = {
  account: AccountMetrics;
  floorIndex: number;
  post: PostData;
};

function isAccountsResponse(
  value: unknown
): value is Extract<AccountsResponse, { accounts: AccountMetrics[] }> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'accounts' in value &&
    Array.isArray((value as { accounts?: unknown }).accounts)
  );
}

function createSelectedPost(
  account: AccountMetrics,
  post: PostData,
  floorIndex?: number
): SelectedPost {
  const resolvedFloorIndex =
    floorIndex ??
    Math.max(
      account.postsData.findIndex((candidate) => candidate.id === post.id),
      0
    );

  return {
    account,
    floorIndex: resolvedFloorIndex,
    post,
  };
}

function getEngagementScore(account: AccountMetrics): number {
  return account.postsData.reduce((total, post) => {
    return (
      total +
      post.likeCount +
      post.commentsCount +
      (post.shares ?? 0) +
      (post.saves ?? 0) +
      (post.views ?? 0)
    );
  }, 0);
}

function isEngagementSpike(previous: AccountMetrics, next: AccountMetrics): boolean {
  const previousScore = getEngagementScore(previous);
  const nextScore = getEngagementScore(next);

  if (previousScore === 0) {
    return nextScore > 0;
  }

  return nextScore >= previousScore * 1.15;
}

export default function Home() {
  const [accounts, setAccounts] = useState<AccountMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const [hoveredAccount, setHoveredAccount] = useState<AccountMetrics | null>(null);
  const [selectedPost, setSelectedPost] = useState<SelectedPost | null>(null);
  const [sessionLocation, setSessionLocation] = useState<SessionLocation | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [pulsingAccountIds, setPulsingAccountIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setMousePos({ x: event.clientX, y: event.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const response = await fetch('/api/accounts');
        if (!response.ok) {
          throw new Error('Failed to fetch data');
        }

        const data: unknown = await response.json();

        if (isAccountsResponse(data)) {
          setAccounts(data.accounts);
          setLoadWarning(data.warnings?.length ? data.warnings.join(' ') : null);
          return;
        }

        if (Array.isArray(data)) {
          setAccounts(data as AccountMetrics[]);
          setLoadWarning(null);
          return;
        }

        throw new Error('Unexpected accounts response');
      } catch (error) {
        console.error('Error fetching accounts:', error);
        setLoadWarning('Some accounts could not be loaded with verified Instagram metrics.');
      } finally {
        setLoading(false);
      }
    }

    fetchAccounts();
  }, []);

  useEffect(() => {
    async function fetchSessionLocation() {
      try {
        const response = await fetch('/api/session-location');
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          location?: SessionLocation | null;
        };

        setSessionLocation(payload.location ?? null);
      } catch (error) {
        console.error('Error fetching session location:', error);
      }
    }

    fetchSessionLocation();
  }, []);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_PUSHER_KEY) {
      console.warn('Pusher key missing, real-time updates disabled.');
      return;
    }

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1',
    });

    const channel = pusher.subscribe('social-skyline-updates');

    const handleMetricsUpdate = (payload: MetricsUpdatePayload) => {
      setAccounts((currentAccounts) => {
        const existingAccount = currentAccounts.find(
          (account) => account.accountKey === payload.metrics.accountKey
        );

        if (existingAccount && isEngagementSpike(existingAccount, payload.metrics)) {
          setPulsingAccountIds((currentPulses) => ({
            ...currentPulses,
            [payload.metrics.accountKey]: true,
          }));

          window.setTimeout(() => {
            setPulsingAccountIds((currentPulses) => {
              const nextPulses = { ...currentPulses };
              delete nextPulses[payload.metrics.accountKey];
              return nextPulses;
            });
          }, 12000);
        }

        if (!existingAccount) {
          return [...currentAccounts, payload.metrics];
        }

        return currentAccounts.map((account) =>
          account.accountKey === payload.metrics.accountKey
            ? payload.metrics
            : account
        );
      });

      setSelectedPost((currentSelection) => {
        if (
          !currentSelection ||
          currentSelection.account.accountKey !== payload.metrics.accountKey
        ) {
          return currentSelection;
        }

        const nextPost =
          payload.metrics.postsData.find((post) => post.id === currentSelection.post.id) ??
          payload.metrics.postsData[currentSelection.floorIndex];

        return nextPost
          ? createSelectedPost(payload.metrics, nextPost, currentSelection.floorIndex)
          : null;
      });
    };

    channel.bind('metrics:update', handleMetricsUpdate);

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, []);

  const handleFloorClick = (account: AccountMetrics, post: PostData, floorIndex: number) => {
    setSelectedPost(createSelectedPost(account, post, floorIndex));
  };

  const handleWindowClick = (account: AccountMetrics, post: PostData, comment: CommentData) => {
    setSelectedPost(createSelectedPost(account, post));

    const targetUrl = comment.url ?? post.permalink;
    if (targetUrl) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const pulsingAccounts = useMemo(() => pulsingAccountIds, [pulsingAccountIds]);

  const handleAccountAdded = (account: AccountMetrics) => {
    setAccounts((currentAccounts) => {
      const existingAccountIndex = currentAccounts.findIndex(
        (candidate) => candidate.accountKey === account.accountKey
      );

      if (existingAccountIndex === -1) {
        return [...currentAccounts, account];
      }

      return currentAccounts.map((candidate) =>
        candidate.accountKey === account.accountKey ? account : candidate
      );
    });

    setLoadWarning(null);
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#050510] font-sans text-xl text-primary">
        <div className="flex animate-pulse flex-col items-center">
          <div className="mb-4 h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="tracking-[0.3em] uppercase font-bold">Initializing Universe</span>
        </div>
      </div>
    );
  }

  const isEmpty = accounts.length === 0;

  return (
    <main className="relative h-screen w-screen bg-[#050510] overflow-hidden">
      {isEmpty ? (
        <div className="flex h-full w-full flex-col items-center justify-center p-12 text-center">
          <div className="absolute inset-0 z-0 bg-radial-[at_50%_50%] from-primary/10 to-transparent opacity-50" />
          
          <div className="relative z-10 max-w-2xl animate-in fade-in zoom-in duration-1000">
            <h1 className="mb-6 text-7xl font-black uppercase tracking-tighter text-white">
              Social<br />
              <span className="text-primary italic">Skyline</span>
            </h1>
            <p className="mb-12 text-xl font-medium text-white/50 leading-relaxed">
              Transform your Instagram presence into a living, reactive 3D metropolis. 
              Sync your metrics and watch your digital footprint grow skyward in realtime.
            </p>
            
            <button 
              onClick={() => document.getElementById('add-account-trigger')?.click()}
              className="group relative inline-flex items-center gap-3 rounded-full bg-primary px-8 py-4 text-lg font-bold text-black transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(13,204,242,0.3)] hover:shadow-[0_0_60px_rgba(13,204,242,0.5)]"
            >
              Construct Your First Building
              <div className="text-2xl transition-transform group-hover:translate-x-1">→</div>
            </button>
          </div>
        </div>
      ) : (
        <>
          <CityScene
            accounts={accounts}
            pulsingAccounts={pulsingAccounts}
            onHover={setHoveredAccount}
            onFloorClick={handleFloorClick}
            onWindowClick={handleWindowClick}
          />

          <Tooltip
            visible={!!hoveredAccount && !selectedPost}
            account={hoveredAccount}
            x={mousePos.x}
            y={mousePos.y}
          />

          <PostPanel selection={selectedPost} onClose={() => setSelectedPost(null)} />

          <SessionLocationMap location={sessionLocation} />

          <div className="pointer-events-none absolute left-10 top-10 z-30">
            <h1 className="text-4xl font-black uppercase tracking-tighter text-white/90">
              Social<br /><span className="text-primary italic">Skyline</span>
            </h1>
          </div>
        </>
      )}

      <AddAccountForm onAccountAdded={handleAccountAdded} onError={setLoadWarning} />

      {loadWarning && (
        <div className="absolute bottom-10 left-10 z-50 max-w-sm rounded-2xl border border-accent/30 bg-accent/10 px-6 py-4 text-sm text-accent-foreground backdrop-blur-2xl animate-in slide-in-from-left-10 shadow-2xl">
          <div className="flex gap-3 font-semibold decoration-accent">
            <span className="text-accent">⚠️</span>
            {loadWarning}
          </div>
        </div>
      )}
    </main>
  );
}
