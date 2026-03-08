import { Inngest, EventSchemas } from "inngest";
import { instagramMetricsService } from "@services/InstagramMetricsService";
import { realtimeUpdateService } from "@services/RealtimeUpdateService";
import { appConfig } from "@lib/config";

// Define event types
type Events = {
  "app/metrics.refresh": {
    data: {
      accountKey: string;
      reason?: string;
    };
  };
};

// Create a client to send and receive events
export const inngest = new Inngest({ 
  id: "social-skyline", 
  eventKey: appConfig.inngestKey,
  schemas: new EventSchemas().fromRecord<Events>()
});

// Define the function to refresh account metrics
export const refreshAccountMetrics = inngest.createFunction(
  { id: "refresh-account-metrics" },
  { event: "app/metrics.refresh" },
  async ({ event, step }: { event: any; step: any }) => {
    const { accountKey, reason } = event.data;

    const metrics = await step.run("fetch-instagram-metrics", async () => {
      return await instagramMetricsService.refreshAccountMetrics(accountKey, {
        delayOnRateLimit: false,
        reason: reason || "inngest-refresh",
        throwOnRateLimit: true,
      });
    });

    await step.run("publish-realtime-update", async () => {
      await realtimeUpdateService.publishMetricsUpdate(metrics, reason || "inngest-refresh");
    });

    return { status: "success", accountKey };
  }
);
