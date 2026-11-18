import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaExceptionFilter } from '../src/common/prisma-exception.filter.js';

type Item = { id: number; value: string; order: number; usage: number };
type List = {
  category: string;
  items: Item[];
  unlisted: { value: string; usage: number }[];
};

describe('Settings / lists (e2e)', () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());
  const platforms = async () => {
    const lists = (await http().get('/settings/lists').expect(200))
      .body as List[];
    return lists.find((l) => l.category === 'PLATFORM')!;
  };

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
    // Une campagne en cours est nécessaire pour créer des pistes (201, ou 409 si déjà là).
    await request(app.getHttpServer())
      .post('/campaigns')
      .send({ name: 'Campagne de test' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('liste les 5 catégories', async () => {
    const lists = (await http().get('/settings/lists').expect(200))
      .body as List[];
    expect(lists.map((l) => l.category)).toEqual([
      'PLATFORM',
      'CONTRACT_TYPE',
      'INTERMEDIARY_TYPE',
      'CHANNEL',
      'INTERVIEW_TYPE',
    ]);
  });

  it('ajoute des valeurs à la fin, refuse doublon (casse/accents) et vide', async () => {
    await http()
      .post('/settings/lists/PLATFORM')
      .send({ value: ' Malt ' })
      .expect(201);
    await http()
      .post('/settings/lists/PLATFORM')
      .send({ value: 'Free-Work' })
      .expect(201);
    await http()
      .post('/settings/lists/PLATFORM')
      .send({ value: 'Indeed' })
      .expect(201);
    await http()
      .post('/settings/lists/PLATFORM')
      .send({ value: 'MALT' })
      .expect(409);
    await http()
      .post('/settings/lists/PLATFORM')
      .send({ value: '  ' })
      .expect(400);
    await http().post('/settings/lists/NOPE').send({ value: 'x' }).expect(400);

    const list = await platforms();
    expect(list.items.map((i) => i.value)).toEqual([
      'Malt',
      'Free-Work',
      'Indeed',
    ]);
  });

  it('compte les usages et remonte les valeurs hors liste', async () => {
    await http()
      .post('/opportunities')
      .send({ companyName: 'Initech', platform: 'Malt' })
      .expect(201);
    await http()
      .post('/opportunities')
      .send({ companyName: 'Umbrella', platform: 'Welcome to the Jungle' })
      .expect(201);

    const list = await platforms();
    expect(list.items.find((i) => i.value === 'Malt')?.usage).toBe(1);
    expect(list.unlisted).toEqual([
      { value: 'Welcome to the Jungle', usage: 1 },
    ]);
  });

  it('renomme une valeur et la répercute sur les pistes', async () => {
    const malt = (await platforms()).items.find((i) => i.value === 'Malt')!;
    const res = await http()
      .patch('/settings/lists/items/' + malt.id)
      .send({ value: 'Malt.fr' })
      .expect(200);
    expect(res.body).toMatchObject({ value: 'Malt.fr', updated: 1 });

    const opportunities = (
      await http().get('/opportunities?q=Initech').expect(200)
    ).body as { platform: string }[];
    expect(opportunities[0].platform).toBe('Malt.fr');

    const indeed = (await platforms()).items.find((i) => i.value === 'Indeed')!;
    await http()
      .patch('/settings/lists/items/' + indeed.id)
      .send({ value: 'free-work' })
      .expect(409);
  });

  it('réordonne la liste (ordre complet exigé)', async () => {
    const ids = (await platforms()).items.map((i) => i.id);
    await http()
      .put('/settings/lists/PLATFORM/order')
      .send({ ids: [...ids].reverse() })
      .expect(204);
    expect((await platforms()).items.map((i) => i.value)).toEqual([
      'Indeed',
      'Free-Work',
      'Malt.fr',
    ]);
    await http()
      .put('/settings/lists/PLATFORM/order')
      .send({ ids: ids.slice(1) })
      .expect(400);
  });

  it('supprime une valeur : conservée sur les pistes, ou remplacée', async () => {
    let list = await platforms();
    const malt = list.items.find((i) => i.value === 'Malt.fr')!;
    const indeed = list.items.find((i) => i.value === 'Indeed')!;

    // Remplacement par une valeur hors liste refusé.
    await http()
      .delete('/settings/lists/items/' + malt.id + '?replaceWith=Inconnu')
      .expect(400);

    // Remplacement : la piste passe à « Indeed ».
    const res = await http()
      .delete('/settings/lists/items/' + malt.id + '?replaceWith=Indeed')
      .expect(200);
    expect(res.body).toEqual({ updated: 1 });
    list = await platforms();
    expect(list.items.find((i) => i.id === indeed.id)?.usage).toBe(1);

    // Sans remplacement : la piste garde la valeur, désormais hors liste.
    await http()
      .delete('/settings/lists/items/' + indeed.id)
      .expect(200);
    list = await platforms();
    expect(list.unlisted.map((u) => u.value)).toContain('Indeed');

    await http()
      .delete('/settings/lists/items/' + indeed.id)
      .expect(404);
  });

  it('répercute un renommage de canal sur le journal', async () => {
    const lists = (await http().get('/settings/lists').expect(200))
      .body as List[];
    let channel = lists.find((l) => l.category === 'CHANNEL')!.items[0];
    if (!channel) {
      channel = (
        await http()
          .post('/settings/lists/CHANNEL')
          .send({ value: 'Visio' })
          .expect(201)
      ).body as Item;
    }
    const o = (
      await http()
        .post('/opportunities')
        .send({ companyName: 'Hooli' })
        .expect(201)
    ).body as { id: number };
    await http()
      .post('/opportunities/' + o.id + '/interactions')
      .send({ date: '2026-11-10', channel: channel.value, summary: 'Point' })
      .expect(201);

    await http()
      .patch('/settings/lists/items/' + channel.id)
      .send({ value: 'Visioconférence' })
      .expect(200);
    const detail = (
      await http()
        .get('/opportunities/' + o.id)
        .expect(200)
    ).body as { interactions: { channel: string }[] };
    expect(detail.interactions[0].channel).toBe('Visioconférence');
  });
});
