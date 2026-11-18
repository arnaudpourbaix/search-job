import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { addDays, formatDay, today } from '../src/common/dates.js';
import { PrismaExceptionFilter } from '../src/common/prisma-exception.filter.js';

type Campaign = {
  id: number;
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string | null;
  total: number;
  active: number;
  won: number;
};
type Summary = {
  id: number;
  campaign: { id: number; name: string };
  duplicateCompany: boolean;
};

const inDays = (n: number) => formatDay(addDays(today(), n));
/** Noms uniques : la spec reste rejouable sur une base non vidée. */
const run = String(Date.now()).slice(-6);
const JUIN = `Mission juin ${run}`;
const DECEMBRE = `Mission décembre ${run}`;
const CORP = `Vieille Corp ${run}`;

describe('Campaigns (e2e)', () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());
  const campaigns = async () =>
    (await http().get('/campaigns').expect(200)).body as Campaign[];
  const byName = async (name: string) =>
    (await campaigns()).find((c) => c.name === name)!;

  let first: Campaign;
  let second: Campaign;
  let oldOpportunity: number;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('crée une campagne (nom obligatoire et unique)', async () => {
    first = (
      await http()
        .post('/campaigns')
        .send({
          name: ` Mission  juin ${run} `,
          goal: 'TJM 550',
          startDate: inDays(-60),
        })
        .expect(201)
    ).body as Campaign;
    expect(first).toMatchObject({
      name: JUIN,
      goal: 'TJM 550',
      startDate: inDays(-60),
      endDate: null,
    });
    await http().post('/campaigns').send({ name: JUIN }).expect(409);
    await http().post('/campaigns').send({ name: '  ' }).expect(400);
    await http()
      .post('/campaigns')
      .send({ name: 'X', startDate: '01/02/2026' })
      .expect(400);
  });

  it('rattache une piste à une campagne donnée, et compte les pistes', async () => {
    const o = (
      await http()
        .post('/opportunities')
        .send({ companyName: CORP, campaignId: first.id })
        .expect(201)
    ).body as Summary;
    oldOpportunity = o.id;
    expect(o.campaign).toMatchObject({ id: first.id, name: JUIN });
    await http()
      .post('/opportunities/' + o.id + '/actions')
      .send({ label: 'Relancer', dueDate: inDays(-1) })
      .expect(201);

    await http()
      .post('/opportunities')
      .send({ companyName: CORP, campaignId: 999999 })
      .expect(400);

    expect(await byName(JUIN)).toMatchObject({
      total: 1,
      active: 1,
      won: 0,
    });
  });

  it('nouvelle campagne qui clôture les précédentes ; les nouvelles pistes y vont par défaut', async () => {
    second = (
      await http()
        .post('/campaigns')
        .send({ name: DECEMBRE, closeOthers: true })
        .expect(201)
    ).body as Campaign;
    expect(second.startDate).toBe(inDays(0));
    expect((await byName(JUIN)).endDate).toBe(inDays(-1));
    // En cours d'abord.
    expect((await campaigns())[0].id).toBe(second.id);

    const o = (
      await http()
        .post('/opportunities')
        .send({ companyName: CORP })
        .expect(201)
    ).body as Summary;
    expect(o.campaign.id).toBe(second.id);
    // Même entreprise, mais pas dans la même campagne : pas de doublon signalé.
    expect(o.duplicateCompany).toBe(false);
  });

  it('filtre les pistes par campagne, et toutes sans filtre', async () => {
    const old = (
      await http()
        .get('/opportunities?campaignId=' + first.id)
        .expect(200)
    ).body as Summary[];
    expect(old.map((o) => o.id)).toEqual([oldOpportunity]);
    const all = (
      await http()
        .get('/opportunities?q=' + encodeURIComponent(CORP))
        .expect(200)
    ).body as Summary[];
    expect(all).toHaveLength(2);
  });

  it("une campagne terminée ne génère plus d'alertes", async () => {
    const feed = (await http().get('/notifications').expect(200)).body as {
      items: { opportunity: { id: number } }[];
    };
    expect(feed.items.some((n) => n.opportunity.id === oldOpportunity)).toBe(
      false,
    );
  });

  it('modifie, rouvre, contrôle les dates', async () => {
    await http()
      .patch('/campaigns/' + first.id)
      .send({ endDate: inDays(-90) })
      .expect(400);
    await http()
      .patch('/campaigns/' + first.id)
      .send({ name: null })
      .expect(400);
    const reopened = (
      await http()
        .patch('/campaigns/' + first.id)
        .send({ name: `${JUIN} bis`, endDate: null })
        .expect(200)
    ).body as Campaign;
    expect(reopened).toMatchObject({
      name: `${JUIN} bis`,
      endDate: null,
    });
    await http()
      .patch('/campaigns/' + first.id)
      .send({ endDate: inDays(-1) })
      .expect(200);
    await http().patch('/campaigns/999999').send({ goal: 'x' }).expect(404);
  });

  it('déplace une piste de campagne, et ne supprime qu’une campagne vide', async () => {
    await http()
      .delete('/campaigns/' + first.id)
      .expect(409);
    await http()
      .patch('/opportunities/' + oldOpportunity)
      .send({ campaignId: null })
      .expect(400);
    const moved = (
      await http()
        .patch('/opportunities/' + oldOpportunity)
        .send({ campaignId: second.id })
        .expect(200)
    ).body as Summary;
    expect(moved.campaign.id).toBe(second.id);

    await http()
      .delete('/campaigns/' + first.id)
      .expect(204);
    await http()
      .delete('/campaigns/' + first.id)
      .expect(404);
  });
});
