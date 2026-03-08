const ALLOWED_MEDIA_HOSTS = [
  'cdninstagram.com',
  'fbcdn.net',
  'instagram.com',
] as const;

export function isAllowedInstagramMediaHost(hostname: string): boolean {
  return ALLOWED_MEDIA_HOSTS.some((allowedHost) => {
    return hostname === allowedHost || hostname.endsWith(`.${allowedHost}`);
  });
}

export function buildInstagramMediaProxyUrl(rawUrl: string | null): string | null {
  if (!rawUrl) {
    return null;
  }

  return `/api/media?url=${encodeURIComponent(rawUrl)}`;
}
