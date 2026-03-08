import { createServer } from 'http';

import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { appConfig } from '@lib/config';
import { bootstrapBackendServices } from '@/server/bootstrap';
import { realtimeUpdateService } from '@services/RealtimeUpdateService';

async function main() {
  const dev = process.env.NODE_ENV !== 'production';
  const app = next({
    dev,
    dir: process.cwd(),
    webpack: true,
  });
  const handle = app.getRequestHandler();

  await app.prepare();
  await bootstrapBackendServices();

  const httpServer = createServer((request, response) => {
    void handle(request, response);
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
    path: '/socket.io',
  });

  const disconnectRealtimeBridge = await realtimeUpdateService.bridgeSocketServer(io);

  io.on('connection', (socket) => {
    socket.emit('connection:ready', {
      connected: true,
    });
  });

  const shutdown = async () => {
    await disconnectRealtimeBridge();
    await io.close();
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });

  process.on('SIGTERM', () => {
    void shutdown();
  });

  httpServer.listen(appConfig.port, () => {
    console.log(`Social Skyline server listening on http://localhost:${appConfig.port}`);
  });
}

main().catch((error) => {
  console.error('Failed to start the Social Skyline server:', error);
  process.exit(1);
});
