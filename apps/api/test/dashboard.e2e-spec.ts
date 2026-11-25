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
  stale: {
    opportunity: { id: number };
    lastContactAt: string | null;
    followUpAt: string;
    planned: boolean;
  }[];
  noResponse: {
    opportunity: { id: number };
    reason: string;
    date: string;
  }[];
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
      noResponse: 0,
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
      noResponse: 0,
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
        // Dernier contact + délai de relance (14 jours).
        followUpAt: inDays(-6),
        planned: false,
      }),
    ]);
    expect(d.recent.map((r) => r.summary)).toEqual([
      'Entretien',
      'Premier appel',
    ]);
  });

  it('date de relance prévue : remplace le calcul, plus tôt ou plus tard', async () => {
    const [{ opportunity }] = (await dashboard()).stale;
    const setFollowUp = (followUpAt: unknown) =>
      http().patch(`/opportunities/${opportunity.id}`).send({ followUpAt });
    const detail = async () =>
      (await http().get(`/opportunities/${opportunity.id}`).expect(200))
        .body as {
        followUpAt: string | null;
        followUp: { status: string; date: string | null; planned: boolean };
      };
    const staleAlert = async () =>
      (
        (await http().get('/notifications').expect(200)).body as {
          items: { type: string; opportunity: { id: number } }[];
        }
      ).items.some(
        (n) =>
          n.type === 'STALE_OPPORTUNITY' && n.opportunity.id === opportunity.id,
      );

    // Reportée : la piste sort de « à relancer » jusqu'à la date choisie.
    await setFollowUp(inDays(7)).expect(200);
    let d = await dashboard();
    expect(d.kpis.stale).toBe(0);
    expect(d.stale).toEqual([]);
    expect(await staleAlert()).toBe(false);
    expect(await detail()).toMatchObject({
      followUpAt: inDays(7),
      followUp: { status: 'PLANNED', date: inDays(7), planned: true },
    });

    // Date atteinte : la piste revient.
    await setFollowUp(inDays(0)).expect(200);
    d = await dashboard();
    expect(d.stale).toEqual([
      expect.objectContaining({ followUpAt: inDays(0), planned: true }),
    ]);
    expect(await staleAlert()).toBe(true);

    // Effacée : retour au calcul « dernier contact + délai ».
    await setFollowUp(null).expect(200);
    expect(await detail()).toMatchObject({
      followUpAt: null,
      followUp: { status: 'DUE', date: inDays(-6), planned: false },
    });
    await setFollowUp('demain').expect(400);
  });

  it('un contact après la saisie annule la date de relance prévue', async () => {
    const id = (
      (
        await http()
          .post('/opportunities')
          .send({ companyName: 'Epsilon', campaignId, followUpAt: inDays(3) })
          .expect(201)
      ).body as { id: number }
    ).id;
    const detail = async () =>
      (await http().get(`/opportunities/${id}`).expect(200)).body as {
        followUpAt: string | null;
        followUp: { status: string; date: string | null };
      };
    // Sans aucun contact, la date prévue suffit à planifier la relance.
    expect(await detail()).toMatchObject({
      followUpAt: inDays(3),
      followUp: { status: 'PLANNED', date: inDays(3) },
    });
    // Un échange du jour de la saisie ne l'annule pas…
    await http()
      .post(`/opportunities/${id}/interactions`)
      .send({ date: inDays(0), summary: 'Candidature envoyée' })
      .expect(201);
    expect((await detail()).followUpAt).toBe(inDays(3));
    // …un échange postérieur, si : la relance redevient calculée.
    await http()
      .post(`/opportunities/${id}/interactions`)
      .send({ date: inDays(1), summary: 'Réponse du recruteur' })
      .expect(201);
    expect(await detail()).toMatchObject({
      followUpAt: null,
      followUp: { status: 'PLANNED', date: inDays(15) },
    });
    await http().delete(`/opportunities/${id}`).expect(204);
  });

  it('délai de réponse : pas de relance d’ici là, puis clôture proposée', async () => {
    const [{ opportunity }] = (await dashboard()).stale;
    const setDue = (responseDueAt: string | null) =>
      http()
        .patch(`/opportunities/${opportunity.id}`)
        .send({ responseDueAt })
        .expect(200);
    const alerts = async () =>
      (
        (await http().get('/notifications').expect(200)).body as {
          items: { type: string; opportunity: { id: number } }[];
        }
      ).items
        .filter((n) => n.opportunity.id === opportunity.id)
        .map((n) => n.type);
    try {
      // Réponse attendue dans 10 jours : rien à faire d'ici là.
      await setDue(inDays(10));
      let d = await dashboard();
      expect(d.kpis.stale).toBe(0);
      expect(d.kpis.noResponse).toBe(0);
      expect(await alerts()).not.toContain('STALE_OPPORTUNITY');

      // Une relance prévue avant l'échéance reste valable.
      await http()
        .patch(`/opportunities/${opportunity.id}`)
        .send({ followUpAt: inDays(-1) })
        .expect(200);
      expect((await dashboard()).kpis.stale).toBe(1);
      await http()
        .patch(`/opportunities/${opportunity.id}`)
        .send({ followUpAt: null })
        .expect(200);

      // Échéance passée : la piste est « sans réponse », plus « à relancer ».
      await setDue(inDays(-1));
      d = await dashboard();
      expect(d.kpis.stale).toBe(0);
      expect(d.noResponse).toEqual([
        expect.objectContaining({
          opportunity: expect.objectContaining({
            id: opportunity.id,
          }) as unknown,
          reason: 'DEADLINE',
          date: inDays(-1),
        }),
      ]);
      expect(await alerts()).toContain('NO_RESPONSE');
    } finally {
      await setDue(null);
    }
    expect((await dashboard()).kpis.stale).toBe(1);
  });

  it('silence malgré les relances : la piste passe « sans réponse »', async () => {
    const id = (
      (
        await http()
          .post('/opportunities')
          .send({ companyName: 'Zêta', campaignId })
          .expect(201)
      ).body as { id: number }
    ).id;
    const note = (date: string, answered?: boolean) =>
      http()
        .post(`/opportunities/${id}/interactions`)
        .send({ date, summary: 'Relance', answered })
        .expect(201);
    try {
      await note(inDays(-40));
      await note(inDays(-10), false);
      const detail = (await http().get(`/opportunities/${id}`).expect(200))
        .body as {
        lastContactAt: string;
        lastReplyAt: string;
        interactions: { answered: boolean }[];
      };
      expect(detail).toMatchObject({
        lastContactAt: inDays(-10),
        lastReplyAt: inDays(-40),
      });
      expect(detail.interactions.map((i) => i.answered)).toEqual([false, true]);
      expect((await dashboard()).noResponse).toContainEqual(
        expect.objectContaining({
          opportunity: expect.objectContaining({ id }) as unknown,
          reason: 'SILENCE',
          date: inDays(-40),
        }),
      );
    } finally {
      await http().delete(`/opportunities/${id}`).expect(204);
    }
  });

  it('entretien prévu : la piste n’est pas à relancer tant qu’il est à venir', async () => {
    const [{ opportunity }] = (await dashboard()).stale;
    const created = (
      await http()
        .post(`/opportunities/${opportunity.id}/interviews`)
        .send({ type: 'Entretien RH', date: inDays(9) })
        .expect(201)
    ).body as { interviews: { id: number }[] };
    const interviewId = created.interviews[0].id;
    const staleAlert = async () =>
      (
        (await http().get('/notifications').expect(200)).body as {
          items: { type: string; opportunity: { id: number } }[];
        }
      ).items.some(
        (n) =>
          n.type === 'STALE_OPPORTUNITY' && n.opportunity.id === opportunity.id,
      );
    try {
      const d = await dashboard();
      expect(d.kpis.stale).toBe(0);
      expect(d.stale).toEqual([]);
      expect(await staleAlert()).toBe(false);
      const detail = (
        await http().get(`/opportunities/${opportunity.id}`).expect(200)
      ).body as { nextInterviewAt: string | null };
      expect(detail.nextInterviewAt).toBe(inDays(9));

      // Date passée sans mise à jour du statut : il ne suspend plus la relance.
      await http()
        .patch(`/interviews/${interviewId}`)
        .send({ date: inDays(-1) })
        .expect(204);
      expect((await dashboard()).kpis.stale).toBe(1);
    } finally {
      await http().delete(`/interviews/${interviewId}`).expect(204);
    }
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

  it('adresse de départ des itinéraires : enregistrée, nettoyée, effacée', async () => {
    const me = async () =>
      (await http().get('/auth/me').expect(200)).body as {
        staleDays: number;
        homeAddress: string | null;
      };
    const set = (body: Record<string, unknown>) =>
      http().patch('/settings/preferences').send(body);

    await set({ homeAddress: '  1 place  du Capitole,  Toulouse ' }).expect(
      204,
    );
    // Le délai n'est pas touché quand il est absent.
    expect(await me()).toMatchObject({
      staleDays: 14,
      homeAddress: '1 place du Capitole, Toulouse',
    });
    await set({ homeAddress: 'x'.repeat(301) }).expect(400);
    await set({ homeAddress: '' }).expect(204);
    expect((await me()).homeAddress).toBeNull();
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
