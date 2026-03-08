import type { SessionLocation } from '@lib/types';
import { appConfig } from '@lib/config';
import { getRedisClient } from '@mcp/redis';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isPrivateIp(ip: string): boolean {
  const normalizedIp = ip.replace(/^::ffff:/, '');
  const octets = normalizedIp.split('.').map((value) => Number.parseInt(value, 10));

  if (octets.length === 4 && octets.every((value) => Number.isFinite(value))) {
    const [first, second] = octets;

    if (first === 10 || first === 127) {
      return true;
    }

    if (first === 192 && second === 168) {
      return true;
    }

    if (first === 172 && second >= 16 && second <= 31) {
      return true;
    }

    if (first === 169 && second === 254) {
      return true;
    }
  }

  return (
    normalizedIp === '::1' ||
    normalizedIp === '127.0.0.1' ||
    normalizedIp === 'localhost'
  );
}

function extractClientIp(headers: Headers): string | null {
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  return headers.get('x-real-ip')?.trim() ?? null;
}

function buildProviderUrl(ip: string): string {
  if (appConfig.ipLocationProviderUrl.includes('{ip}')) {
    return appConfig.ipLocationProviderUrl.replace('{ip}', encodeURIComponent(ip));
  }

  const url = new URL(appConfig.ipLocationProviderUrl);
  url.searchParams.set('ip', ip);
  return url.toString();
}

export class SessionLocationService {
  private get redis() {
    return getRedisClient();
  }

  private buildCacheKey(ip: string): string {
    return `cache:ip-location:${ip}`;
  }

  private readEdgeHeaderLocation(headers: Headers): SessionLocation | null {
    const latitude =
      getNumber(headers.get('x-vercel-ip-latitude')) ??
      getNumber(headers.get('cf-iplatitude'));
    const longitude =
      getNumber(headers.get('x-vercel-ip-longitude')) ??
      getNumber(headers.get('cf-iplongitude'));
    const country =
      getString(headers.get('x-vercel-ip-country')) ??
      getString(headers.get('cf-ipcountry'));
    const region =
      getString(headers.get('x-vercel-ip-country-region')) ??
      getString(headers.get('x-vercel-ip-region'));
    const city =
      getString(headers.get('x-vercel-ip-city')) ??
      getString(headers.get('cf-ipcity'));
    const ip = extractClientIp(headers);

    if (latitude === null || longitude === null) {
      return null;
    }

    return {
      ip,
      city,
      region,
      country,
      latitude,
      longitude,
      source: 'edge-headers',
    };
  }

  private async fetchByIp(ip: string): Promise<SessionLocation | null> {
    const response = await fetch(buildProviderUrl(ip), {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as unknown;
    if (!isRecord(payload)) {
      return null;
    }

    const success =
      typeof payload.success === 'boolean' ? payload.success : true;

    if (!success) {
      return null;
    }

    const location: SessionLocation = {
      ip: getString(payload.ip) ?? ip,
      city: getString(payload.city),
      region:
        getString(payload.region) ??
        getString(payload.region_name) ??
        getString(payload.state),
      country:
        getString(payload.country) ??
        getString(payload.country_name),
      latitude: getNumber(payload.latitude) ?? getNumber(payload.lat),
      longitude: getNumber(payload.longitude) ?? getNumber(payload.lon),
      source: 'ip-geolocation',
    };

    if (location.latitude === null || location.longitude === null) {
      return null;
    }

    return location;
  }

  async resolveRequestLocation(request: Request): Promise<SessionLocation | null> {
    const headerLocation = this.readEdgeHeaderLocation(request.headers);
    if (headerLocation) {
      return headerLocation;
    }

    const ip = extractClientIp(request.headers);
    if (!ip || isPrivateIp(ip)) {
      return null;
    }

    const cachedValue = await this.redis.get(this.buildCacheKey(ip));
    if (cachedValue) {
      return JSON.parse(cachedValue) as SessionLocation;
    }

    const location = await this.fetchByIp(ip);
    if (!location) {
      return null;
    }

    await this.redis.set(
      this.buildCacheKey(ip),
      JSON.stringify(location),
      'PX',
      appConfig.ipLocationTtlMs
    );

    return location;
  }
}

export const sessionLocationService = new SessionLocationService();
