import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { type Http, signIn } from './auth.js';
import { addDays, formatDay, today } from '../src/common/dates.js';
import { PrismaExceptionFilter } from '../src/common/prisma-exception.filter.js';
import { stageIds } from './stages.js';

type Dashboard = {
  byStage: { label: string; count: number }[];
  kpis: Record<string, number>;
  todo: { label: string; dueDate: string; opportunity: { id: number } }[];
  stale: { opportunity: { id: number }; lastContactAt: string }[];
  recent: { summary: string; opportunity: { id: number } }[];
};

const inDays = (n: number) => formatDay(addDays(today(), n));

describe('Dashboard (e2e)', () => {
  let app: INestApplication<App>;
  let campaignId: number;
  let stages: Record<string, number>;
  let http: Http;
  const dashboard = async () =>
    (
      await http()
        .get('/dashboard?campaignId=' + campaignId)
        .expect(200)
    ).body as Dashboard;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(
      new PrismaExceptionFilter(app.get(HttpAdapterHost).httpAdapter),
    );
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    http = await signIn(app);
    stages = await stageIds(http);
    // Campagne dédiée : les chiffres ne dépendent pas des autres specs.
    campaignId = (
      (
        await http()
          .post('/campaigns')
          .send({ name: 'Tableau de bord ' + Date.now() })
          .expect(201)
      ).body as { id: number }
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('campagne vide : tout à zéro', async () => {
    const d = await dashboard();
    expect(d.kpis).toEqual({
      total: 0,
      active: 0,
      overdue: 0,
      dueToday: 0,
      stale: 0,
      interviews: 0,
      contactsLastWeek: 0,
      upcomingInterviews: 0,
    });
    expect(d.byStage.every((s) => s.count === 0)).toBe(true);
    expect(d).toMatchObject({ todo: [], stale: [], recent: [] });
  });

  it('synthétise étapes, actions, relances et échanges', async () => {
    const create = async (companyName: string, stageLabel: string) =>
      (
        (
          await http()
            .post('/opportunities')
            .send({ companyName, stageId: stages[stageLabel], campaignId })
            .expect(201)
        ).body as { id: number }
      ).id;
    const a = await create('Alpha', 'Entretien client');
    const b = await create('Beta', 'Échange recruteur');
    await create('Gamma', 'Refusé');

    const action = (id: number, label: string, dueDate: string | null) =>
      http()
        .post(`/opportunities/${id}/actions`)
        .send({ label, dueDate })
        .expect(201);
    await action(a, 'En retard', inDays(-1));
    await action(a, "Aujourd'hui", inDays(0));
    await action(b, 'Bientôt', inDays(3));
    await action(b, 'Plus tard', inDays(30));
    await action(b, 'Sans date', null);

    const contact = (id: number, date: string, summary: string) =>
      http()
        .post(`/opportunities/${id}/interactions`)
        .send({ date, summary })
        .expect(201);
    await contact(a, inDays(-2), 'Entretien');
    await contact(b, inDays(-20), 'Premier appel');

    const d = await dashboard();
    expect(d.kpis).toEqual({
      total: 3,
      active: 2,
      overdue: 1,
      dueToday: 1,
      stale: 1,
      interviews: 1,
      contactsLastWeek: 1,
      upcomingInterviews: 0,
    });
    const count = (label: string) =>
      d.byStage.find((s) => s.label === label)?.count;
    expect(count('Entretien client')).toBe(1);
    expect(count('Échange recruteur')).toBe(1);
    expect(count('Refusé')).toBe(1);
    expect(count('Gagné')).toBe(0);
    expect(d.todo.map((t) => t.label)).toEqual([
      'En retard',
      "Aujourd'hui",
      'Bientôt',
    ]);
    expect(d.stale).toEqual([
      expect.objectContaining({
        opportunity: expect.objectContaining({ id: b }) as unknown,
        lastContactAt: inDays(-20),
      }),
    ]);
    expect(d.recent.map((r) => r.summary)).toEqual([
      'Entretien',
      'Premier appel',
    ]);
  });

  it('refuse un campaignId invalide', async () => {
    await http().get('/dashboard?campaignId=abc').expect(400);
  });
});
