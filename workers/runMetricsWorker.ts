import { metricsWorker } from '@workers/MetricsWorker';

async function main() {
  await metricsWorker.run();
  console.log('Social Skyline metrics worker is running.');
}

main().catch((error) => {
  console.error('Failed to start the Social Skyline metrics worker:', error);
  process.exit(1);
});
