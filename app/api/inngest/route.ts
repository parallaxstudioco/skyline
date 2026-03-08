import { serve } from "inngest/next";
import { inngest, refreshAccountMetrics } from "@/lib/inngest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    refreshAccountMetrics,
  ],
});
