import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { type Http, signIn } from './auth.js';
import { PrismaExceptionFilter } from '../src/common/prisma-exception.filter.js';
import type { StageRow } from './stages.js';

type Opportunity = {
  id: number;
  stage: { id: number; label: string; color: string; kind: string };
};

describe('Settings / stages (e2e)', () => {
  let app: INestApplication<App>;
  let http: Http;
  const stages = async () =>
    (await http().get('/settings/stages').expect(200)).body as StageRow[];
  const suffix = String(Date.now()).slice(-6);
  const label = (name: string) => `${name} ${suffix}`;

  let qualif: StageRow;
  let test: StageRow;
  let opportunity: number;

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
    await http().post('/campaigns').send({ name: 'Campagne de test' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('liste les étapes dans l’ordre, avec leur nature et leur usage', async () => {
    const list = await stages();
    const labels = list.map((s) => s.label);
    expect(labels).toEqual(
      expect.arrayContaining(['À contacter', 'Gagné', 'Refusé']),
    );
    const orders = list.map((s) => s.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(list.find((s) => s.label === 'Gagné')?.kind).toBe('WON');
    expect(list.every((s) => typeof s.usage === 'number')).toBe(true);
  });

  it('ajoute une étape en fin de pipeline ; libellé unique, couleur et nature valides', async () => {
    qualif = (
      await http()
        .post('/settings/stages')
        .send({ label: ` ${label('Qualification')} `, color: 'cyan' })
        .expect(201)
    ).body as StageRow;
    expect(qualif).toMatchObject({
      label: label('Qualification'),
      color: 'cyan',
      kind: 'OPEN',
    });
    expect((await stages()).at(-1)?.id).toBe(qualif.id);

    await http()
      .post('/settings/stages')
      .send({ label: label('QUALIFICATION') })
      .expect(409);
    await http().post('/settings/stages').send({ label: '  ' }).expect(400);
    await http()
      .post('/settings/stages')
      .send({ label: label('X'), color: 'fuchsia' })
      .expect(400);
    await http()
      .post('/settings/stages')
      .send({ label: label('X'), kind: 'DONE' })
      .expect(400);
  });

  it('modifie libellé, couleur et nature ; les pistes suivent', async () => {
    test = (
      await http()
        .post('/settings/stages')
        .send({ label: label('Test technique'), kind: 'ADVANCED' })
        .expect(201)
    ).body as StageRow;
    opportunity = (
      (
        await http()
          .post('/opportunities')
          .send({ companyName: 'Stage Corp', stageId: test.id })
          .expect(201)
      ).body as Opportunity
    ).id;

    await http()
      .patch('/settings/stages/' + test.id)
      .send({ label: label('Test tech'), color: 'orange' })
      .expect(200);
    const o = (
      await http()
        .get('/opportunities/' + opportunity)
        .expect(200)
    ).body as Opportunity;
    expect(o.stage).toMatchObject({
      label: label('Test tech'),
      color: 'orange',
      kind: 'ADVANCED',
    });

    await http()
      .patch('/settings/stages/' + test.id)
      .send({ label: 'Gagné' })
      .expect(409);
    await http()
      .patch('/settings/stages/' + test.id)
      .send({ label: null })
      .expect(400);
    await http()
      .patch('/settings/stages/999999')
      .send({ color: 'red' })
      .expect(404);
  });

  it("une étape de nature « perdue » clôt la piste (plus d'actives)", async () => {
    await http()
      .patch('/settings/stages/' + test.id)
      .send({ kind: 'LOST' })
      .expect(200);
    const active = (await http().get('/opportunities?active=true').expect(200))
      .body as Opportunity[];
    expect(active.map((o) => o.id)).not.toContain(opportunity);
    await http()
      .patch('/settings/stages/' + test.id)
      .send({ kind: 'ADVANCED' })
      .expect(200);
  });

  it('réordonne (liste complète exigée)', async () => {
    const before = (await stages()).map((s) => s.id);
    const moved = [qualif.id, ...before.filter((id) => id !== qualif.id)];
    await http().put('/settings/stages/order').send({ ids: moved }).expect(204);
    expect((await stages()).map((s) => s.id)).toEqual(moved);
    await http()
      .put('/settings/stages/order')
      .send({ ids: moved.slice(1) })
      .expect(400);
    // Ordre d'origine rétabli pour les autres specs.
    await http()
      .put('/settings/stages/order')
      .send({ ids: before })
      .expect(204);
  });

  it('supprime : remplacement obligatoire si des pistes y sont', async () => {
    await http()
      .delete('/settings/stages/' + test.id)
      .expect(400);
    await http()
      .delete(`/settings/stages/${test.id}?replaceWith=${test.id}`)
      .expect(400);
    await http()
      .delete(`/settings/stages/${test.id}?replaceWith=999999`)
      .expect(400);

    const res = await http()
      .delete(`/settings/stages/${test.id}?replaceWith=${qualif.id}`)
      .expect(200);
    expect(res.body).toEqual({ updated: 1 });
    const o = (
      await http()
        .get('/opportunities/' + opportunity)
        .expect(200)
    ).body as Opportunity;
    expect(o.stage.id).toBe(qualif.id);

    // Plus de pistes dans l'étape : on la remet ailleurs, puis suppression simple.
    const first = (await stages())[0];
    await http()
      .patch('/opportunities/' + opportunity)
      .send({ stageId: first.id })
      .expect(200);
    await http()
      .delete('/settings/stages/' + qualif.id)
      .expect(200);
    await http()
      .delete('/settings/stages/' + qualif.id)
      .expect(404);
  });

  it('une piste créée sans étape va dans la première du pipeline', async () => {
    const first = (await stages())[0];
    const o = (
      await http()
        .post('/opportunities')
        .send({ companyName: 'Sans étape' })
        .expect(201)
    ).body as Opportunity;
    expect(o.stage.id).toBe(first.id);
    await http()
      .post('/opportunities')
      .send({ companyName: 'X', stageId: 999999 })
      .expect(400);
  });
});
