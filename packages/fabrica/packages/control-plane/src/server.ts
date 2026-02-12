import Fastify, { FastifyInstance } from 'fastify';
import { registerRoutes } from './routes.js';

export interface ServerConfig {
  port: number;
  host: string;
}

const defaultConfig: ServerConfig = {
  port: 3000,
  host: '0.0.0.0',
};

export async function createServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  // Register content type parser for text/plain
  server.addContentTypeParser('text/plain', { parseAs: 'string' }, (_req, body, done) => {
    done(null, body);
  });

  // Register routes
  await registerRoutes(server);

  return server;
}

export async function startServer(config: Partial<ServerConfig> = {}): Promise<FastifyInstance> {
  const finalConfig = { ...defaultConfig, ...config };
  const server = await createServer();

  await server.listen({ port: finalConfig.port, host: finalConfig.host });
  console.log(`Fabrica API server listening on ${finalConfig.host}:${finalConfig.port}`);
  return server;
}
