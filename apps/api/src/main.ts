import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import type { RequestHandler } from 'express';
import * as helmetModule from 'helmet';
import type { HelmetOptions } from 'helmet';
import { AppModule } from './app.module.js';
import { PrismaExceptionFilter } from './common/prisma-exception.filter.js';

/**
 * helmet publie des types ESM et CJS. Le contrôle TypeScript du build Vercel
 * lit les types CJS, où l'import par défaut n'est pas la fonction : on la
 * récupère donc nous-mêmes, quelle que soit la forme du module.
 */
function resolveHelmet(): (options?: HelmetOptions) => RequestHandler {
  let candidate: unknown = helmetModule;
  while (typeof candidate !== 'function' && candidate) {
    candidate = (candidate as { default?: unknown }).default;
  }
  if (typeof candidate !== 'function') {
    throw new Error('Module helmet inattendu : fonction introuvable');
  }
  return candidate as (options?: HelmetOptions) => RequestHandler;
}
const helmet = resolveHelmet();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  // En-têtes de sécurité (anti-sniffing, anti-iframe, HSTS…).
  app.use(helmet());
  app.useGlobalFilters(
    new PrismaExceptionFilter(app.get(HttpAdapterHost).httpAdapter),
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
