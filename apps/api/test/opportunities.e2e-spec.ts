import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaExceptionFilter } from '../src/common/prisma-exception.filter.js';

type Opportunity = {
  id: number;
  reference: string | null;
  stage: string;
  company: { name: string } | null;
  intermediary: { name: string } | null;
  intermediaryType: string | null;
  contact: { name: string; email: string | null } | null;
  tags: string[];
  firstContactAt: string | null;
  lastContactAt: string | null;
  nextAction: { id: number; label: string; dueDate: string | null } | null;
  duplicateCompany: boolean;
  interactions: { id: number; date: string; summary: string }[];
  actions: {
    id: number;
    label: string;
    dueDate: string | null;
    doneAt: string | null;
  }[];
};

describe('Opportunities (e2e)', () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());

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

  let id: number;

  it('crée une piste avec entreprise, intermédiaire, contact et tags', async () => {
    const res = await http()
      .post('/opportunities')
      .send({
        companyName: 'Globex',
        intermediaryName: 'Acme',
        intermediaryType: "Apporteur d'affaires",
        contact: { name: 'Jane Doe', email: 'jane@acme.test' },
        tags: ['Angular', ' NestJS ', 'Angular'],
        tjmMin: 500,
        tjmMax: 600,
      })
      .expect(201);
    const o = res.body as Opportunity;
    id = o.id;
    expect(o.stage).toBe('TO_CONTACT');
    expect(o.reference).toBeNull();
    expect(o.company?.name).toBe('Globex');
    expect(o.intermediary?.name).toBe('Acme');
    expect(o.intermediaryType).toBe("Apporteur d'affaires");
    expect(o.contact?.email).toBe('jane@acme.test');
    expect(o.tags).toEqual(['Angular', 'NestJS']);
    expect(o.duplicateCompany).toBe(false);
  });

  it('exige au moins une entreprise ou un intermédiaire (400)', async () => {
    await http().post('/opportunities').send({ title: 'Dev' }).expect(400);
    await http()
      .patch('/opportunities/' + id)
      .send({ companyName: null, intermediaryName: null })
      .expect(400);
  });

  it('valide les entrées (400)', async () => {
    await http()
      .post('/opportunities')
      .send({ companyName: 'X', stage: 'NOPE' })
      .expect(400);
    await http()
      .post('/opportunities/' + id + '/actions')
      .send({ label: 'Rappeler', dueDate: '20/11/2026' })
      .expect(400);
  });

  it('calcule 1er / dernier contact depuis le journal', async () => {
    await http()
      .post('/opportunities/' + id + '/interactions')
      .send({ date: '2026-11-10', channel: 'Mail', summary: 'Premier mail' })
      .expect(201);
    const res = await http()
      .post('/opportunities/' + id + '/interactions')
      .send({ date: '2026-11-14', summary: 'Appel' })
      .expect(201);
    const o = res.body as Opportunity;
    expect(o.firstContactAt).toBe('2026-11-10');
    expect(o.lastContactAt).toBe('2026-11-14');
    expect(o.interactions.map((i) => i.summary)).toEqual([
      'Appel',
      'Premier mail',
    ]);
  });

  it('prochaine action = échéance la plus proche, sans date en dernier', async () => {
    const actionsUrl = '/opportunities/' + id + '/actions';
    await http().post(actionsUrl).send({ label: 'Sans date' }).expect(201);
    await http()
      .post(actionsUrl)
      .send({ label: 'Plus tard', dueDate: '2026-12-01' })
      .expect(201);
    const res = await http()
      .post(actionsUrl)
      .send({ label: 'Bientôt', dueDate: '2026-11-20' })
      .expect(201);
    const o = res.body as Opportunity;
    expect(o.nextAction?.label).toBe('Bientôt');
    expect(o.actions.map((a) => a.label)).toEqual([
      'Bientôt',
      'Plus tard',
      'Sans date',
    ]);

    // Terminer « Bientôt » : la suivante devient « Plus tard ».
    await http()
      .patch('/actions/' + o.nextAction?.id)
      .send({ done: true })
      .expect(204);
    const after = (
      await http()
        .get('/opportunities/' + id)
        .expect(200)
    ).body as Opportunity;
    expect(after.nextAction?.label).toBe('Plus tard');
    expect(after.actions.at(-1)?.label).toBe('Bientôt');
    expect(after.actions.at(-1)?.doneAt).not.toBeNull();
  });

  it('met à jour, retire l’intermédiaire (et son type) et remplace les tags', async () => {
    const res = await http()
      .patch('/opportunities/' + id)
      .send({
        stage: 'RECRUITER_TALK',
        reference: 'REF-42',
        intermediaryName: null,
        tags: ['Java'],
        contact: null,
      })
      .expect(200);
    const o = res.body as Opportunity;
    expect(o.stage).toBe('RECRUITER_TALK');
    expect(o.reference).toBe('REF-42');
    expect(o.intermediary).toBeNull();
    expect(o.intermediaryType).toBeNull();
    expect(o.contact).toBeNull();
    expect(o.tags).toEqual(['Java']);
    expect(o.company?.name).toBe('Globex');
  });

  it('accepte une piste sans entreprise connue (intermédiaire seul)', async () => {
    const res = await http()
      .post('/opportunities')
      .send({ intermediaryName: 'Edwyn', contractType: 'Freelance' })
      .expect(201);
    const o = res.body as Opportunity;
    expect(o.company).toBeNull();
    expect(o.intermediary?.name).toBe('Edwyn');
  });

  it('signale une entreprise proposée sur plusieurs pistes', async () => {
    await http()
      .post('/opportunities')
      .send({ companyName: 'Globex', intermediaryName: 'Autre ESN' })
      .expect(201);
    const list = (await http().get('/opportunities').expect(200))
      .body as Opportunity[];
    expect(list.filter((o) => o.duplicateCompany)).toHaveLength(2);
  });

  it('filtre par recherche, étape et pistes actives', async () => {
    const byQ = (await http().get('/opportunities?q=globex').expect(200))
      .body as Opportunity[];
    expect(byQ).toHaveLength(2);
    const byRef = (await http().get('/opportunities?q=REF-42').expect(200))
      .body as Opportunity[];
    expect(byRef.map((o) => o.id)).toEqual([id]);

    await http()
      .patch('/opportunities/' + id)
      .send({ stage: 'REJECTED' })
      .expect(200);
    const active = (await http().get('/opportunities?active=true').expect(200))
      .body as Opportunity[];
    expect(active.map((o) => o.id)).not.toContain(id);

    const rejected = (
      await http().get('/opportunities?stages=REJECTED,WON').expect(200)
    ).body as Opportunity[];
    expect(rejected.map((o) => o.id)).toEqual([id]);
  });

  it('expose les données de référence', async () => {
    const companies = (await http().get('/companies').expect(200)).body as {
      name: string;
    }[];
    expect(companies.map((c) => c.name)).toEqual(
      expect.arrayContaining(['Acme', 'Globex', 'Edwyn']),
    );
    const lists = (await http().get('/ref-lists').expect(200)).body as Record<
      string,
      string[]
    >;
    expect(lists.INTERMEDIARY_TYPE).toContain('Société de portage');
    await http().get('/tags').expect(200);
  });

  it('supprime une piste et ses éléments (404 ensuite)', async () => {
    await http()
      .delete('/opportunities/' + id)
      .expect(204);
    await http()
      .get('/opportunities/' + id)
      .expect(404);
    await http()
      .delete('/opportunities/' + id)
      .expect(404);
  });
});
