import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { type Http, signIn } from './auth.js';
import { addDays, formatDay, today } from '../src/common/dates.js';
import { PrismaExceptionFilter } from '../src/common/prisma-exception.filter.js';
import { stageIds } from './stages.js';

type Round = {
  id: number;
  type: string;
  label: string | null;
  date: string | null;
  time: string | null;
  status: string;
  notes: string | null;
};
type Progress = {
  total: number;
  passed: number;
  failed: boolean;
  steps: string[];
  current: Omit<Round, 'id' | 'notes'> | null;
} | null;
type Detail = { id: number; interviews: Round[]; interviewProgress: Progress };
type Summary = { id: number; interviews: Progress };
type Dashboard = {
  kpis: Record<string, number>;
  interviews: Record<
    'upcoming' | 'toSchedule' | 'awaiting',
    { type: string; opportunity: { id: number } }[]
  >;
};

const inDays = (n: number) => formatDay(addDays(today(), n));

describe('Interviews (e2e)', () => {
  let app: INestApplication<App>;
  let campaignId: number;
  let opportunity: number;
  let http: Http;
  const detail = async () =>
    (
      await http()
        .get('/opportunities/' + opportunity)
        .expect(200)
    ).body as Detail;
  const summary = async () =>
    (
      (
        await http()
          .get('/opportunities?campaignId=' + campaignId)
          .expect(200)
      ).body as Summary[]
    ).find((o) => o.id === opportunity)!;
  const add = async (body: Record<string, unknown>) =>
    (
      await http()
        .post(`/opportunities/${opportunity}/interviews`)
        .send(body)
        .expect(201)
    ).body as Detail;

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
    campaignId = (
      (
        await http()
          .post('/campaigns')
          .send({ name: 'Entretiens ' + Date.now() })
          .expect(201)
      ).body as { id: number }
    ).id;
    opportunity = (
      (
        await http()
          .post('/opportunities')
          .send({ companyName: 'Cap Test', campaignId })
          .expect(201)
      ).body as { id: number }
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('sans tour : pas de progression', async () => {
    expect((await detail()).interviewProgress).toBeNull();
    expect((await summary()).interviews).toBeNull();
  });

  it('ajoute les tours dans l’ordre, avec leurs valeurs', async () => {
    await add({ type: 'Échange client', date: inDays(-10), status: 'PASSED' });
    await add({
      type: 'Entretien RH',
      date: inDays(-5),
      time: '14:30',
      status: 'PASSED',
      notes: 'Bon feeling',
    });
    await add({
      type: 'Entretien technique',
      date: inDays(-1),
      status: 'DONE',
    });
    const o = await add({ type: ' Test ', label: 'anglais' });

    expect(o.interviews.map((r) => r.type)).toEqual([
      'Échange client',
      'Entretien RH',
      'Entretien technique',
      'Test',
    ]);
    expect(o.interviews[1]).toMatchObject({
      date: inDays(-5),
      time: '14:30',
      notes: 'Bon feeling',
    });
    expect(o.interviews[3]).toMatchObject({
      label: 'anglais',
      date: null,
      status: 'PLANNED',
    });
  });

  it('résume la progression : validés, tour en cours, frise', async () => {
    const expected = {
      total: 4,
      passed: 2,
      failed: false,
      steps: ['PASSED', 'PASSED', 'DONE', 'PLANNED'],
      current: expect.objectContaining({
        type: 'Entretien technique',
        status: 'DONE',
        date: inDays(-1),
      }) as unknown,
    };
    expect((await detail()).interviewProgress).toEqual(expected);
    expect((await summary()).interviews).toEqual(expected);
  });

  it('valide les champs', async () => {
    const url = `/opportunities/${opportunity}/interviews`;
    await http().post(url).send({ type: '  ' }).expect(400);
    await http().post(url).send({ type: 'X', time: '25:00' }).expect(400);
    await http().post(url).send({ type: 'X', date: '18/11/2026' }).expect(400);
    await http().post(url).send({ type: 'X', status: 'OK' }).expect(400);
    await http()
      .post('/opportunities/999999/interviews')
      .send({ type: 'X' })
      .expect(404);
  });

  it('met à jour un tour (statut, date, effacement) ; null refusé sur le type', async () => {
    const [, , tech, test] = (await detail()).interviews;
    await http()
      .patch('/interviews/' + tech.id)
      .send({ status: 'PASSED' })
      .expect(204);
    await http()
      .patch('/interviews/' + test.id)
      .send({ date: inDays(2), time: '10:00', label: 'anglais (TOEIC)' })
      .expect(204);
    await http()
      .patch('/interviews/' + test.id)
      .send({ type: null })
      .expect(400);
    await http()
      .patch('/interviews/' + test.id)
      .send({ status: null })
      .expect(400);
    await http()
      .patch('/interviews/999999')
      .send({ status: 'DONE' })
      .expect(404);

    const p = (await detail()).interviewProgress!;
    expect(p.passed).toBe(3);
    expect(p.current).toMatchObject({
      type: 'Test',
      label: 'anglais (TOEIC)',
      date: inDays(2),
      time: '10:00',
    });

    await http()
      .patch('/interviews/' + test.id)
      .send({ time: null, label: '' })
      .expect(204);
    expect((await detail()).interviews[3]).toMatchObject({
      time: null,
      label: null,
    });
  });

  it('réordonne (liste complète exigée)', async () => {
    const ids = (await detail()).interviews.map((r) => r.id);
    const swapped = [ids[1], ids[0], ...ids.slice(2)];
    const url = `/opportunities/${opportunity}/interviews/order`;
    await http().put(url).send({ ids: swapped }).expect(204);
    expect((await detail()).interviews.map((r) => r.id)).toEqual(swapped);
    await http()
      .put(url)
      .send({ ids: swapped.slice(1) })
      .expect(400);
    await http().put(url).send({ ids }).expect(204);
  });

  it('le tableau de bord liste les tours à venir, à planifier et en attente', async () => {
    await add({ type: 'Entretien final' });
    const d = (
      await http()
        .get('/dashboard?campaignId=' + campaignId)
        .expect(200)
    ).body as Dashboard;
    expect(d.interviews.upcoming.map((r) => r.type)).toEqual(['Test']);
    expect(d.interviews.toSchedule.map((r) => r.type)).toEqual([
      'Entretien final',
    ]);
    expect(d.interviews.awaiting).toEqual([]);
    expect(d.kpis.upcomingInterviews).toBe(1);
  });

  it('un tour non retenu est signalé ; suppression', async () => {
    const rounds = (await detail()).interviews;
    await http()
      .patch('/interviews/' + rounds[3].id)
      .send({ status: 'FAILED' })
      .expect(204);
    expect((await detail()).interviewProgress).toMatchObject({
      failed: true,
      current: expect.objectContaining({ type: 'Entretien final' }) as unknown,
    });

    await http()
      .delete('/interviews/' + rounds[0].id)
      .expect(204);
    expect((await detail()).interviews).toHaveLength(4);
    await http()
      .delete('/interviews/' + rounds[0].id)
      .expect(404);
  });

  it('un entretien ayant eu lieu compte comme un contact', async () => {
    const c = (
      (
        await http()
          .post('/campaigns')
          .send({ name: 'Contacts ' + Date.now() })
          .expect(201)
      ).body as { id: number }
    ).id;
    const o = (
      (
        await http()
          .post('/opportunities')
          .send({ companyName: 'Contact Test', campaignId: c })
          .expect(201)
      ).body as { id: number }
    ).id;
    const dash = async () =>
      (
        await http()
          .get('/dashboard?campaignId=' + c)
          .expect(200)
      ).body as {
        kpis: Record<string, number>;
        stale: { lastContactAt: string }[];
      };
    const lastContact = async () =>
      (
        (
          await http()
            .get('/opportunities/' + o)
            .expect(200)
        ).body as {
          lastContactAt: string | null;
        }
      ).lastContactAt;

    await http()
      .post(`/opportunities/${o}/interactions`)
      .send({ date: inDays(-20), summary: 'Premier contact' })
      .expect(201);
    expect((await dash()).stale).toEqual([
      expect.objectContaining({ lastContactAt: inDays(-20) }),
    ]);
    // Un tour à venir n'est pas un contact, mais il suspend la relance.
    await http()
      .post(`/opportunities/${o}/interviews`)
      .send({ type: 'Entretien technique', date: inDays(1) })
      .expect(201);
    expect(await lastContact()).toBe(inDays(-20));
    expect((await dash()).stale).toEqual([]);

    await http()
      .post(`/opportunities/${o}/interviews`)
      .send({ type: 'Entretien RH', date: inDays(-2), status: 'PASSED' })
      .expect(201);
    expect(await lastContact()).toBe(inDays(-2));
    const d = await dash();
    expect(d.stale).toEqual([]);
    expect(d.kpis.contactsLastWeek).toBe(1);
    expect(d.kpis.stale).toBe(0);
  });

  it('le type de tour est une liste modifiable des paramètres', async () => {
    const lists = (await http().get('/ref-lists').expect(200)).body as Record<
      string,
      string[]
    >;
    expect(lists.INTERVIEW_TYPE).toEqual(
      expect.arrayContaining(['Entretien RH', 'Entretien technique', 'Test']),
    );
    const settings = (await http().get('/settings/lists').expect(200)).body as {
      category: string;
      items: { value: string; usage: number }[];
    }[];
    const types = settings.find((l) => l.category === 'INTERVIEW_TYPE')!;
    expect(types.items.find((i) => i.value === 'Test')!.usage).toBeGreaterThan(
      0,
    );
  });

  it("un premier entretien fait passer la piste à l'étape des entretiens, sans jamais la faire reculer", async () => {
    const stages = await stageIds(http);
    const stageAfterInterview = async (stageLabel: string) => {
      const id = (
        (
          await http()
            .post('/opportunities')
            .send({
              companyName: 'Étape ' + stageLabel,
              stageId: stages[stageLabel],
              campaignId,
            })
            .expect(201)
        ).body as { id: number }
      ).id;
      const res = await http()
        .post(`/opportunities/${id}/interviews`)
        .send({ type: 'Entretien RH' })
        .expect(201);
      return (res.body as { stage: { label: string } }).stage.label;
    };
    expect(await stageAfterInterview('À contacter')).toBe('Entretiens');
    expect(await stageAfterInterview('Dossier envoyé')).toBe('Entretiens');
    // Déjà plus loin, ou close : inchangée.
    expect(await stageAfterInterview('Proposition')).toBe('Proposition');
    expect(await stageAfterInterview('Refusé')).toBe('Refusé');
    expect(await stageAfterInterview('Gagné')).toBe('Gagné');
  });
});
