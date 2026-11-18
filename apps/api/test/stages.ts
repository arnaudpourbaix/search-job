import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';

export type StageRow = {
  id: number;
  label: string;
  color: string;
  kind: string;
  order: number;
  usage: number;
};

/** Identifiants des étapes, par libellé (étapes d'origine créées par la migration). */
export async function stageIds(
  app: INestApplication<App>,
): Promise<Record<string, number>> {
  const res = await request(app.getHttpServer())
    .get('/settings/stages')
    .expect(200);
  return Object.fromEntries(
    (res.body as StageRow[]).map((s) => [s.label, s.id]),
  );
}
