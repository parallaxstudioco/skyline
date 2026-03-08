import { appConfig } from '@lib/config';

const GRAPH_API_VERSION = 'v22.0';
const GRAPH_API_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export class InstagramGraphError extends Error {
  constructor(
    message: string,
    readonly status = 502
  ) {
    super(message);
    this.name = 'InstagramGraphError';
  }
}

export function getStringAtPath(
  value: unknown,
  pathSegments: readonly string[]
): string | null {
  let current: unknown = value;

  for (const segment of pathSegments) {
    if (!isRecord(current) || !(segment in current)) {
      return null;
    }

    current = current[segment];
  }

  if (typeof current === 'string' && current.length > 0) {
    return current;
  }

  if (typeof current === 'number' && Number.isFinite(current)) {
    return String(current);
  }

  return null;
}

export function toSafeInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }

  return null;
}

export function buildGraphUrl(
  endpoint: string,
  accessToken: string,
  params: Record<string, string | number | undefined> = {}
): string {
  const url = new URL(`${GRAPH_API_BASE_URL}/${endpoint}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  url.searchParams.set('access_token', accessToken);
  return url.toString();
}

export async function graphRequest(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: 'no-store' });
  const rawBody = await response.text();
  let payload: unknown = null;

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new InstagramGraphError(
        `Instagram Graph API returned a non-JSON response (${response.status}).`,
        response.status
      );
    }
  }

  const graphError =
    isRecord(payload) && isRecord(payload.error) ? payload.error : null;
  const graphMessage =
    graphError && typeof graphError.message === 'string'
      ? graphError.message
      : null;
  const graphCode = graphError ? toSafeInteger(graphError.code) : null;

  if (!response.ok || graphMessage) {
    const detail =
      graphMessage && graphCode !== null
        ? `${graphMessage} (code ${graphCode})`
        : graphMessage ?? `Instagram Graph API request failed (${response.status}).`;

    throw new InstagramGraphError(detail, response.status);
  }

  return payload;
}

export function assertInstagramOauthConfigured() {
  if (!appConfig.instagramAppId || !appConfig.instagramAppSecret) {
    throw new InstagramGraphError(
      'Instagram OAuth is not configured. Set INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET.',
      500
    );
  }
}
