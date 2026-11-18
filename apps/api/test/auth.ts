import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { SessionsService } from '../src/auth/sessions.service.js';
import { UsersService } from '../src/auth/users.service.js';

let counter = 0;

/** Requêtes HTTP de test, avec le cookie de session d'un utilisateur (ou sans). */
export function client(app: INestApplication<App>, cookie?: string) {
  const server = app.getHttpServer();
  const auth = (t: request.Test) => (cookie ? t.set('Cookie', cookie) : t);
  return {
    get: (url: string) => auth(request(server).get(url)),
    post: (url: string) => auth(request(server).post(url)),
    patch: (url: string) => auth(request(server).patch(url)),
    put: (url: string) => auth(request(server).put(url)),
    delete: (url: string) => auth(request(server).delete(url)),
  };
}

export type Client = ReturnType<typeof client>;
export type Http = () => Client;

/**
 * Nouvel utilisateur (avec ses étapes et listes de départ) et sa session.
 * Chaque fichier de test travaille ainsi sur des données vierges, isolées des autres.
 */
export async function createUser(app: INestApplication<App>, label = 'test') {
  const email = `${label}-${Date.now()}-${++counter}@test.local`;
  const user = await app.get(UsersService).create({ email });
  const sessions = app.get(SessionsService);
  const { token } = await sessions.create(user.id);
  return { user, cookie: `${sessions.cookieName}=${token}` };
}

/** Client HTTP connecté en tant que nouvel utilisateur. */
export async function signIn(
  app: INestApplication<App>,
  label?: string,
): Promise<Http> {
  const { cookie } = await createUser(app, label);
  const c = client(app, cookie);
  return () => c;
}
