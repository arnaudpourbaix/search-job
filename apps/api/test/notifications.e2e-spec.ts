import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { type Http, signIn } from './auth.js';
import { addDays, formatDay, today } from '../src/common/dates.js';
import { PrismaExceptionFilter } from '../src/common/prisma-exception.filter.js';
import { stageIds } from './stages.js';

type Notification = {
  id: number;
  type: string;
  message: string;
  read: boolean;
  opportunity: { id: number };
  action: { id: number; dueDate: string | null } | null;
};
type Feed = { unread: number; items: Notification[] };

const inDays = (n: number) => formatDay(addDays(today(), n));

describe('Notifications (e2e)', () => {
  let app: INestApplication<App>;
  let opportunityId: number;
  let stages: Record<string, number>;
  let http: Http;
  /** Notifications de la piste créée par ce test (la base est partagée). */
  const feed = async () => {
    const body = (await http().get('/notifications').expect(200)).body as Feed;
    return body.items.filter((n) => n.opportunity.id === opportunityId);
  };
  const addAction = async (label: string, dueDate: string | null) =>
    (
      await http()
        .post(`/opportunities/${opportunityId}/actions`)
        .send({ label, dueDate })
        .expect(201)
    ).body as { actions: { id: number; label: string }[] };

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
    // Une campagne en cours est nécessaire pour créer des pistes (201, ou 409 si déjà là).
    await http().post('/campaigns').send({ name: 'Campagne de test' });
    stages = await stageIds(http);

    const o = (
      await http()
        .post('/opportunities')
        .send({
          companyName: 'Notif Corp',
          stageId: stages['Échange recruteur'],
        })
        .expect(201)
    ).body as { id: number };
    opportunityId = o.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('alerte sur les actions en retard, du jour et à venir, pas au-delà de 7 jours', async () => {
    await addAction('Relancer', inDays(-2));
    await addAction('Appeler', inDays(0));
    await addAction('Envoyer le CV', inDays(5));
    await addAction('Plus tard', inDays(20));
    await addAction('Sans date', null);

    const items = await feed();
    expect(items.map((n) => [n.type, n.message])).toEqual([
      ['ACTION_OVERDUE', 'Relancer'],
      ['ACTION_DUE_TODAY', 'Appeler'],
      ['ACTION_UPCOMING', 'Envoyer le CV'],
    ]);
    expect(items.every((n) => !n.read)).toBe(true);
  });

  it('signale une piste sans échange depuis plus de 14 jours, plus après un nouvel échange', async () => {
    await http()
      .post(`/opportunities/${opportunityId}/interactions`)
      .send({ date: inDays(-20), summary: 'Premier appel' })
      .expect(201);
    let stale = (await feed()).find((n) => n.type === 'STALE_OPPORTUNITY');
    expect(stale?.message).toBe('Aucun échange depuis 20 jours');

    await http()
      .post(`/opportunities/${opportunityId}/interactions`)
      .send({ date: inDays(-1), summary: 'Relance' })
      .expect(201);
    stale = (await feed()).find((n) => n.type === 'STALE_OPPORTUNITY');
    expect(stale).toBeUndefined();
  });

  it('marque comme lu, garde l’état lu, et tout marquer comme lu', async () => {
    const [first] = await feed();
    await http()
      .patch(`/notifications/${first.id}`)
      .send({ read: true })
      .expect(204);
    let items = await feed();
    expect(items.find((n) => n.id === first.id)?.read).toBe(true);
    // Les lues passent après les non lues.
    expect(items.at(-1)?.id).toBe(first.id);

    await http()
      .patch(`/notifications/${first.id}`)
      .send({ read: 'oui' })
      .expect(400);
    await http()
      .patch('/notifications/999999')
      .send({ read: true })
      .expect(404);

    await http().post('/notifications/read-all').expect(204);
    items = await feed();
    expect(items.every((n) => n.read)).toBe(true);
    const body = (await http().get('/notifications').expect(200)).body as Feed;
    expect(body.unread).toBe(0);
  });

  it("retire l'alerte quand l'action est faite, et en recrée une si l'échéance change", async () => {
    let items = await feed();
    const today = items.find((n) => n.type === 'ACTION_DUE_TODAY')!;
    const upcoming = items.find((n) => n.type === 'ACTION_UPCOMING')!;

    await http()
      .patch(`/actions/${today.action!.id}`)
      .send({ done: true })
      .expect(204);
    await http()
      .patch(`/actions/${upcoming.action!.id}`)
      .send({ dueDate: inDays(-1) })
      .expect(204);

    items = await feed();
    expect(
      items.find((n) => n.action?.id === today.action!.id),
    ).toBeUndefined();
    const moved = items.find((n) => n.action?.id === upcoming.action!.id)!;
    expect(moved.type).toBe('ACTION_OVERDUE');
    expect(moved.read).toBe(false);
  });

  it('ignore les pistes clôturées', async () => {
    await http()
      .patch(`/opportunities/${opportunityId}`)
      .send({ stageId: stages['Refusé'] })
      .expect(200);
    expect(await feed()).toEqual([]);
  });
});
