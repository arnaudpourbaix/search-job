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
  staleDays: number;
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
      openInterviews: 0,
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
    const a = await create('Alpha', 'Entretiens');
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
      openInterviews: 0,
    });
    const count = (label: string) =>
      d.byStage.find((s) => s.label === label)?.count;
    expect(count('Entretiens')).toBe(1);
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

  it('relance reportée : la piste sort de « à relancer » jusqu’à la date choisie', async () => {
    const [{ opportunity }] = (await dashboard()).stale;
    const snooze = (until: string | null) =>
      http()
        .put(`/opportunities/${opportunity.id}/snooze`)
        .send({ until })
        .expect(204);
    const staleAlert = async () =>
      (
        (await http().get('/notifications').expect(200)).body as {
          items: { type: string; opportunity: { id: number } }[];
        }
      ).items.some(
        (n) =>
          n.type === 'STALE_OPPORTUNITY' && n.opportunity.id === opportunity.id,
      );

    await snooze(inDays(7));
    let d = await dashboard();
    expect(d.kpis.stale).toBe(0);
    expect(d.stale).toEqual([]);
    expect(await staleAlert()).toBe(false);
    const detail = (
      await http().get(`/opportunities/${opportunity.id}`).expect(200)
    ).body as { snoozedUntil: string | null };
    expect(detail.snoozedUntil).toBe(inDays(7));

    // Report échu : la piste revient.
    await snooze(inDays(0));
    expect((await dashboard()).kpis.stale).toBe(1);

    await snooze(null);
    d = await dashboard();
    expect(d.kpis.stale).toBe(1);
    expect(await staleAlert()).toBe(true);
    await http()
      .put(`/opportunities/${opportunity.id}/snooze`)
      .send({ until: 'demain' })
      .expect(400);
  });

  it('délai de relance réglable par utilisateur', async () => {
    const setDelay = (staleDays: unknown) =>
      http().patch('/settings/preferences').send({ staleDays });
    try {
      await setDelay(30).expect(204);
      expect(
        (
          (await http().get('/auth/me').expect(200)).body as {
            staleDays: number;
          }
        ).staleDays,
      ).toBe(30);
      const d = await dashboard();
      expect(d.staleDays).toBe(30);
      // Dernier contact il y a 20 jours : plus à relancer avec un délai de 30.
      expect(d.kpis.stale).toBe(0);
      await setDelay(0).expect(400);
      await setDelay(91).expect(400);
      await setDelay('dix').expect(400);
    } finally {
      await setDelay(14).expect(204);
    }
    expect((await dashboard()).kpis.stale).toBe(1);
  });

  it('compte les entretiens en cours (à venir, à planifier, en attente du retour)', async () => {
    const id = (
      (
        await http()
          .post('/opportunities')
          .send({ companyName: 'Delta', campaignId })
          .expect(201)
      ).body as { id: number }
    ).id;
    const round = (body: Record<string, unknown>) =>
      http()
        .post(`/opportunities/${id}/interviews`)
        .send({ type: 'Entretien RH', ...body })
        .expect(201);
    await round({ date: inDays(2) }); // à venir
    await round({}); // à planifier
    await round({ date: inDays(-3), status: 'DONE' }); // en attente du retour
    await round({ date: inDays(-10), status: 'PASSED' }); // tranché : ignoré
    const d = await dashboard();
    expect(d.kpis.openInterviews).toBe(3);
    expect(d.kpis.upcomingInterviews).toBe(1);
  });

  it('refuse un campaignId invalide', async () => {
    await http().get('/dashboard?campaignId=abc').expect(400);
  });
});
