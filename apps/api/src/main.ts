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

async function createApp() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  // En-têtes de sécurité (anti-sniffing, anti-iframe, HSTS…).
  app.use(helmet());
  app.useGlobalFilters(
    new PrismaExceptionFilter(app.get(HttpAdapterHost).httpAdapter),
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  return app;
}

const app = await createApp();

/*
 * Sur Vercel, le runtime remplace server.listen() par une version qui ne
 * signale jamais l'écoute : `await app.listen()` y bloquerait l'import du
 * module indéfiniment (requêtes en échec après 60 s). On y exporte donc le
 * gestionnaire Express, que Vercel appelle directement ; ailleurs on écoute.
 */
if (process.env.VERCEL) {
  await app.init();
} else {
  await app.listen(process.env.PORT ?? 3000);
}

export default app.getHttpAdapter().getInstance() as RequestHandler;
