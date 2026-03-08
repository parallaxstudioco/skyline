import type { AccountMetrics, CarouselMediaData, CommentData, PostData } from '@lib/types';
import { cacheService } from '@services/RedisCacheService';
import { enqueueMetricsRefresh } from '@mcp/queue/metricsQueue';
import { rateLimitService, RateLimitBackoffError } from '@services/RateLimitService';
import {
  type ConnectedInstagramAccountRecord,
  connectedAccountsStore,
} from '@lib/store/connectedAccounts';
import { getStringAtPath, toSafeInteger, graphRequest, buildGraphUrl } from '@mcp/instagram';
import { appConfig } from '@lib/config';

const INSTAGRAM_WEB_APP_ID = '936619743392459';
const PUBLIC_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

interface MetricsListResult {
  accounts: AccountMetrics[];
  warnings: string[];
}

interface RateLimitedRequestOptions {
  delayOnRateLimit: boolean;
  throwOnRateLimit?: boolean;
}

class InstagramPublicError extends Error {
  constructor(
    message: string,
    readonly status = 502
  ) {
    super(message);
    this.name = 'InstagramPublicError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round(total / values.length);
}

function normalizeUsername(username: string): string {
  return username.trim().replace(/^@+/, '').toLowerCase();
}

function getArrayAtPath(value: unknown, pathSegments: readonly string[]): unknown[] {
  let current: unknown = value;

  for (const segment of pathSegments) {
    if (!isRecord(current) || !(segment in current)) {
      return [];
    }

    current = current[segment];
  }

  return Array.isArray(current) ? current : [];
}

function getCountAtPath(value: unknown, pathSegments: readonly string[]): number | null {
  let current: unknown = value;

  for (const segment of pathSegments) {
    if (!isRecord(current) || !(segment in current)) {
      return null;
    }

    current = current[segment];
  }

  return toSafeInteger(current);
}

function getRecordAtPath(value: unknown, pathSegments: readonly string[]): Record<string, unknown> | null {
  let current: unknown = value;

  for (const segment of pathSegments) {
    if (!isRecord(current) || !(segment in current)) {
      return null;
    }

    current = current[segment];
  }

  return isRecord(current) ? current : null;
}

function buildPublicProfileEndpoints(username: string) {
  const normalizedUsername = normalizeUsername(username);

  return [
    {
      referer: `https://www.instagram.com/${normalizedUsername}/`,
      url:
        `https://www.instagram.com/api/v1/users/web_profile_info/?username=` +
        encodeURIComponent(normalizedUsername),
    },
    {
      referer: `https://www.instagram.com/${normalizedUsername}/`,
      url:
        `https://www.instagram.com/${encodeURIComponent(normalizedUsername)}/?__a=1&__d=dis`,
    },
  ];
}

function extractPublicUserNode(payload: unknown): Record<string, unknown> | null {
  if (isRecord(payload) && isRecord(payload.data) && isRecord(payload.data.user)) {
    return payload.data.user;
  }

  if (isRecord(payload) && isRecord(payload.graphql) && isRecord(payload.graphql.user)) {
    return payload.graphql.user;
  }

  if (isRecord(payload) && isRecord(payload.user)) {
    return payload.user;
  }

  return null;
}

function extractTimelineMedia(userNode: Record<string, unknown>): unknown[] {
  const directTimelineMedia = getArrayAtPath(userNode, [
    'edge_owner_to_timeline_media',
    'edges',
  ]);

  if (directTimelineMedia.length > 0) {
    return directTimelineMedia;
  }

  return getArrayAtPath(userNode, ['xdt_api__v1__feed__user_timeline_graphql_connection', 'edges']);
}

function createPlaceholderComment(index: number, permalink: string | null): CommentData {
  return {
    id: `placeholder-${index}`,
    likeCount: 0,
    text: null,
    timestamp: null,
    url: permalink,
    username: null,
  };
}

function createPlaceholderComments(count: number, permalink: string | null): CommentData[] {
  return Array.from({ length: count }, (_, index) =>
    createPlaceholderComment(index, permalink)
  );
}

function inferMediaType(node: Record<string, unknown>): string | null {
  const typename = getStringAtPath(node, ['__typename']);

  if (typename === 'GraphSidecar') {
    return 'CAROUSEL_ALBUM';
  }

  if (typename === 'GraphVideo' || node.is_video === true) {
    return 'VIDEO';
  }

  if (typename === 'GraphImage') {
    return 'IMAGE';
  }

  return null;
}

function buildPermalink(node: Record<string, unknown>): string | null {
  const shortcode = getStringAtPath(node, ['shortcode']);
  if (!shortcode) {
    return null;
  }

  const mediaType = inferMediaType(node);
  const productType = getStringAtPath(node, ['product_type'])?.toLowerCase();
  const pathSegment =
    productType === 'clips' || (mediaType === 'VIDEO' && productType === 'reels')
      ? 'reel'
      : 'p';

  return `https://www.instagram.com/${pathSegment}/${shortcode}/`;
}

function extractCaption(node: Record<string, unknown>): string | null {
  const captionEdges = getArrayAtPath(node, ['edge_media_to_caption', 'edges']);
  const firstCaption = captionEdges[0];

  return getStringAtPath(firstCaption, ['node', 'text']);
}

function extractCarouselChildren(node: Record<string, unknown>): CarouselMediaData[] {
  return getArrayAtPath(node, ['edge_sidecar_to_children', 'edges']).map((edge, index) => {
    const childNode =
      isRecord(edge) && isRecord(edge.node) ? (edge.node as Record<string, unknown>) : {};

    return {
      id: getStringAtPath(childNode, ['id']) ?? `child-${index}`,
      mediaType: inferMediaType(childNode),
      mediaUrl:
        getStringAtPath(childNode, ['video_url']) ??
        getStringAtPath(childNode, ['display_url']),
      thumbnailUrl:
        getStringAtPath(childNode, ['thumbnail_src']) ??
        getStringAtPath(childNode, ['display_url']),
    };
  });
}

function extractCommentsCount(node: Record<string, unknown>): number {
  return (
    getCountAtPath(node, ['edge_media_to_comment', 'count']) ??
    getCountAtPath(node, ['edge_media_to_parent_comment', 'count']) ??
    0
  );
}

function extractLikeCount(node: Record<string, unknown>): number {
  return (
    getCountAtPath(node, ['edge_media_preview_like', 'count']) ??
    getCountAtPath(node, ['edge_liked_by', 'count']) ??
    0
  );
}

function extractTimestamp(node: Record<string, unknown>): string | null {
  const unixSeconds =
    toSafeInteger(node.taken_at_timestamp) ?? toSafeInteger(node.taken_at);

  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
}

function createEmptyPostData(id: string): PostData {
  return {
    id,
    caption: null,
    carouselChildren: [],
    comments: [],
    commentsCount: 0,
    commentLikeCounts: [],
    likeCount: 0,
    maxCommentLikeCount: 0,
    mediaProductType: null,
    mediaType: null,
    mediaUrl: null,
    permalink: null,
    reach: null,
    saves: null,
    shares: null,
    thumbnailUrl: null,
    timestamp: null,
    views: null,
  };
}

function buildPostData(mediaEdge: unknown, index: number): PostData {
  const node =
    isRecord(mediaEdge) && isRecord(mediaEdge.node)
      ? (mediaEdge.node as Record<string, unknown>)
      : {};
  const mediaId = getStringAtPath(node, ['id']) ?? `media-${index}`;
  const permalink = buildPermalink(node);
  const commentsCount = extractCommentsCount(node);
  const comments = createPlaceholderComments(commentsCount, permalink);

  return {
    id: mediaId,
    caption: extractCaption(node),
    carouselChildren: extractCarouselChildren(node),
    comments,
    commentsCount,
    commentLikeCounts: comments.map(() => 0),
    likeCount: extractLikeCount(node),
    maxCommentLikeCount: 0,
    mediaProductType: getStringAtPath(node, ['product_type']),
    mediaType: inferMediaType(node),
    mediaUrl:
      getStringAtPath(node, ['video_url']) ?? getStringAtPath(node, ['display_url']),
    permalink,
    reach: null,
    saves: null,
    shares: null,
    thumbnailUrl:
      getStringAtPath(node, ['thumbnail_src']) ?? getStringAtPath(node, ['display_url']),
    timestamp: extractTimestamp(node),
    views:
      toSafeInteger(node.video_view_count) ??
      toSafeInteger(node.video_play_count) ??
      null,
  };
}

export class InstagramMetricsService {
  async listAccountMetrics(): Promise<MetricsListResult> {
    const connectedAccounts = await connectedAccountsStore.list();
    const results: Array<
      | {
          type: 'metrics';
          metrics: AccountMetrics;
        }
      | {
          type: 'warning';
          warning: string;
        }
    > = [];

    for (const account of connectedAccounts) {
      try {
        const metrics = await this.getAccountMetrics(account.username);
        results.push({ type: 'metrics', metrics });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          type: 'warning',
          warning: `Skipped @${account.username}. ${message}`,
        });
      }
    }

    return {
      accounts: results
        .filter((result) => result.type === 'metrics')
        .map((result) => result.metrics),
      warnings: results
        .filter((result) => result.type === 'warning')
        .map((result) => result.warning),
    };
  }

  async getAccountMetrics(accountKey: string): Promise<AccountMetrics> {
    const normalizedAccountKey = normalizeUsername(accountKey);
    const cachedMetrics = await cacheService.getAccountMetrics(normalizedAccountKey);
    if (cachedMetrics) {
      return cachedMetrics;
    }

    return this.refreshAccountMetrics(normalizedAccountKey, {
      delayOnRateLimit: true,
      enqueueOnSuccess: false,
      reason: 'cache-miss',
    });
  }

  async refreshAccountMetrics(
    accountKey: string,
    options: {
      delayOnRateLimit: boolean;
      enqueueOnSuccess?: boolean;
      reason: string;
      throwOnRateLimit?: boolean;
    }
  ): Promise<AccountMetrics> {
    const normalizedAccountKey = normalizeUsername(accountKey);
    const connectedAccount =
      await connectedAccountsStore.getByUsername(normalizedAccountKey);

    if (!connectedAccount) {
      throw new InstagramPublicError(
        `No stored Instagram username found for ${normalizedAccountKey}.`,
        404
      );
    }

    const metrics = await this.fetchFromInstagram(connectedAccount, options);
    await cacheService.setAccountMetrics(metrics);

    if (options.enqueueOnSuccess) {
      await enqueueMetricsRefresh(normalizedAccountKey, {
        reason: options.reason,
      });
    }

    return metrics;
  }

  private async requestWithRateLimit(
    accountKey: string,
    url: string,
    referer: string,
    options: RateLimitedRequestOptions
  ): Promise<unknown> {
    const decision = await rateLimitService.consume(accountKey);

    if (!decision.allowed) {
      if (options.throwOnRateLimit || !options.delayOnRateLimit) {
        throw new RateLimitBackoffError(accountKey, decision.retryAfterMs);
      }

      await rateLimitService.waitUntilAllowed(accountKey);
    }

    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        accept: '*/*',
        'accept-language': 'en-US,en;q=0.9',
        referer,
        'user-agent': PUBLIC_USER_AGENT,
        'x-ig-app-id': INSTAGRAM_WEB_APP_ID,
        'x-requested-with': 'XMLHttpRequest',
      },
    });

    const rawBody = await response.text();
    let payload: unknown = null;

    if (rawBody) {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        throw new InstagramPublicError(
          `Instagram returned a non-JSON profile response for ${accountKey}.`,
          response.status
        );
      }
    }

    if (!response.ok) {
      const message =
        getStringAtPath(payload, ['message']) ??
        getStringAtPath(payload, ['error']) ??
        `Instagram request failed (${response.status}) for ${accountKey}.`;

      throw new InstagramPublicError(message, response.status);
    }

    return payload;
  }

  private async fetchPublicUserNode(
    username: string,
    options: RateLimitedRequestOptions
  ): Promise<Record<string, unknown>> {
    let lastError: Error | null = null;

    for (const endpoint of buildPublicProfileEndpoints(username)) {
      try {
        const payload = await this.requestWithRateLimit(
          username,
          endpoint.url,
          endpoint.referer,
          options
        );
        const userNode = extractPublicUserNode(payload);

        if (userNode) {
          return userNode;
        }

        lastError = new InstagramPublicError(
          `Instagram returned an unexpected profile payload for @${username}.`
        );
      } catch (error) {
        if (error instanceof RateLimitBackoffError) {
          throw error;
        }

        lastError = error instanceof Error ? error : new Error('Unknown Instagram error');
      }
    }

    throw lastError ??
      new InstagramPublicError(`Unable to load public Instagram data for @${username}.`);
  }

  private async fetchGraphUserNode(
    username: string,
    options: RateLimitedRequestOptions
  ): Promise<{ userNode: Record<string, unknown>; postsData: PostData[] } | null> {
    if (!appConfig.instagramAccessToken) {
      return null;
    }

    try {
      // 1. Get the account ID for the username using Business Discovery
      // Note: We need a target account username to query against.
      // We'll use the first connected account as the "requester" or just assume the token has permissions.
      const fields = `business_discovery.username(${username}){followers_count,follows_count,media_count,username,media{id,caption,media_type,media_url,permalink,timestamp,username,thumbnail_url,like_count,comments_count,children{media_url,media_type}}}`;
      let url = buildGraphUrl('me', appConfig.instagramAccessToken, {
        fields,
      });

      const response = (await graphRequest(url)) as Record<string, unknown>;
      const userNode = getRecordAtPath(response, ['business_discovery']);

      if (!userNode) {
        return null;
      }

      const allPosts: PostData[] = [];
      let mediaConnection = getRecordAtPath(userNode, ['media']);

      while (mediaConnection) {
        const mediaNodes = getArrayAtPath(mediaConnection, ['data']);
        for (const node of mediaNodes) {
          if (isRecord(node)) {
            allPosts.push(this.buildPostFromGraphNode(node));
          }
        }

        const after = getStringAtPath(mediaConnection, ['paging', 'cursors', 'after']);
        if (!after) {
          break;
        }

        // Fetch next page
        const nextFields = `business_discovery.username(${username}){media.after(${after}){id,caption,media_type,media_url,permalink,timestamp,username,thumbnail_url,like_count,comments_count,children{media_url,media_type}}}`;
        url = buildGraphUrl('me', appConfig.instagramAccessToken, {
          fields: nextFields,
        });

        const nextResponse = (await graphRequest(url)) as Record<string, unknown>;
        mediaConnection = getRecordAtPath(nextResponse, ['business_discovery', 'media']);
      }

      return {
        userNode: {
          username: getStringAtPath(userNode, ['username']),
          edge_followed_by: { count: getCountAtPath(userNode, ['followers_count']) },
          edge_follow: { count: getCountAtPath(userNode, ['follows_count']) },
          edge_owner_to_timeline_media: { count: getCountAtPath(userNode, ['media_count']) },
        },
        postsData: allPosts,
      };
    } catch (error) {
      console.warn(`Graph API fetch failed for @${username}, falling back to public:`, error);
      return null;
    }
  }

  private buildPostFromGraphNode(node: Record<string, unknown>): PostData {
    const id = getStringAtPath(node, ['id']) ?? 'unknown';
    const mediaType = getStringAtPath(node, ['media_type']);
    const children = getArrayAtPath(node, ['children', 'data']).map((child, idx) => {
      const childRecord = isRecord(child) ? child : {};
      return {
        id: getStringAtPath(childRecord, ['id']) ?? `${id}-child-${idx}`,
        mediaType: getStringAtPath(childRecord, ['media_type']),
        mediaUrl: getStringAtPath(childRecord, ['media_url']),
        thumbnailUrl: getStringAtPath(childRecord, ['media_url']),
      };
    });

    return {
      id,
      caption: getStringAtPath(node, ['caption']),
      carouselChildren: children,
      comments: [],
      commentsCount: toSafeInteger(node.comments_count) ?? 0,
      commentLikeCounts: [],
      likeCount: toSafeInteger(node.like_count) ?? 0,
      maxCommentLikeCount: 0,
      mediaProductType: null, // Graph API doesn't distinguish REELS vs FEED as easily here
      mediaType,
      mediaUrl: getStringAtPath(node, ['media_url']),
      permalink: getStringAtPath(node, ['permalink']),
      reach: null,
      saves: null,
      shares: null,
      thumbnailUrl: getStringAtPath(node, ['thumbnail_url']) ?? getStringAtPath(node, ['media_url']),
      timestamp: getStringAtPath(node, ['timestamp']),
      views: null,
    };
  }

  private async fetchFromInstagram(
    account: ConnectedInstagramAccountRecord,
    rateLimitOptions: RateLimitedRequestOptions
  ): Promise<AccountMetrics> {
    // 1. Try Graph API first for deep data
    const graphData = await this.fetchGraphUserNode(account.username, rateLimitOptions);
    if (graphData) {
      return this.buildAccountMetrics(account, graphData.userNode, graphData.postsData);
    }

    // 2. Fallback to public scraping
    const userNode = await this.fetchPublicUserNode(account.username, rateLimitOptions);
    const postsData = extractTimelineMedia(userNode).map((mediaEdge, index) =>
      buildPostData(mediaEdge, index)
    );

    return this.buildAccountMetrics(account, userNode, postsData);
  }

  private buildAccountMetrics(
    account: ConnectedInstagramAccountRecord,
    userNode: Record<string, unknown>,
    postsData: readonly PostData[]
  ): AccountMetrics {
    const followers = getCountAtPath(userNode, ['edge_followed_by', 'count']);
    const following = getCountAtPath(userNode, ['edge_follow', 'count']);
    const posts =
      getCountAtPath(userNode, ['edge_owner_to_timeline_media', 'count']) ??
      getCountAtPath(userNode, ['xdt_api__v1__feed__user_timeline_graphql_connection', 'count']);
    const username =
      getStringAtPath(userNode, ['username']) ?? normalizeUsername(account.username);

    if (followers === null || following === null || posts === null) {
      throw new InstagramPublicError(
        `Instagram did not return complete public metrics for @${account.username}.`
      );
    }

    const normalizedPostsData = [...postsData];
    while (normalizedPostsData.length < posts) {
      normalizedPostsData.push(createEmptyPostData(`missing-post-${normalizedPostsData.length}`));
    }

    const visiblePosts = normalizedPostsData.filter(
      (post) => !post.id.startsWith('missing-post-')
    );
    const normalizedAccountKey = normalizeUsername(username);

    return {
      accountKey: normalizedAccountKey,
      username: normalizedAccountKey,
      followers,
      following,
      posts,
      avgLikes: average(visiblePosts.map((post) => post.likeCount)),
      cachedAt: new Date().toISOString(),
      engagementSummary: visiblePosts.reduce(
        (summary, post) => ({
          sampledPosts: summary.sampledPosts + 1,
          likes: summary.likes + post.likeCount,
          comments: summary.comments + post.commentsCount,
          shares: summary.shares + (post.shares ?? 0),
          saves: summary.saves + (post.saves ?? 0),
          views: summary.views + (post.views ?? 0),
        }),
        {
          sampledPosts: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          saves: 0,
          views: 0,
        }
      ),
      postsData: normalizedPostsData,
    };
  }
}

export const instagramMetricsService = new InstagramMetricsService();
