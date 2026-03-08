export const appConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  redis: {
    url: process.env.REDIS_URL || undefined,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  instagramAppId: process.env.INSTAGRAM_APP_ID || '',
  instagramAppSecret: process.env.INSTAGRAM_APP_SECRET || '',
  instagramAccessToken: process.env.IG_ACCESS_TOKEN || '',
  instagramRedirectUri: process.env.INSTAGRAM_REDIRECT_URI || 'http://localhost:3000/api/auth/instagram/callback',
  pusher: {
    appId: process.env.PUSHER_APP_ID || '',
    key: process.env.PUSHER_KEY || '',
    secret: process.env.PUSHER_SECRET || '',
    cluster: process.env.PUSHER_CLUSTER || 'mt1',
  },
  inngestKey: process.env.INNGEST_EVENT_KEY || '',
  metricsQueueName: 'instagram-metrics-refresh',
  accountMetricsTtlMs: 5 * 60 * 1000, // 5 minutes
  postMetricsTtlMs: 2 * 60 * 1000,    // 2 minutes
  realtimeChannel: process.env.REALTIME_CHANNEL || 'metrics:updates',
  ipLocationProviderUrl: process.env.IP_LOCATION_PROVIDER_URL || 'https://ipapi.co/{ip}/json/',
  ipLocationTtlMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  rateLimitWindowMs: 60 * 60 * 1000,        // 1 hour
  globalRateLimitPerHour: 200,
  userRateLimitPerHour: 20,
};
