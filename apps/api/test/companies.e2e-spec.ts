import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { type Http, signIn } from './auth.js';
import { PrismaExceptionFilter } from '../src/common/prisma-exception.filter.js';

type Company = {
  id: number;
  name: string;
  notes: string | null;
  contacts: { id: number; name: string; title: string | null }[];
  opportunities: { id: number; role: 'CLIENT' | 'INTERMEDIARY' }[];
};

describe('Companies (e2e)', () => {
  let app: INestApplication<App>;
  let http: Http;
  // Noms uniques : la base de test n'est pas vidée entre deux lancements.
  const tag = String(Date.now());
  const name = (n: string) => `${n} ${tag}`;
  let campaignId: number;

  const list = async () =>
    (await http().get('/companies').expect(200)).body as Company[];
  const find = async (id: number) => (await list()).find((c) => c.id === id);

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
          .send({ name: 'Entreprises ' + tag })
          .expect(201)
      ).body as { id: number }
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('crée une entreprise et refuse un doublon, casse comprise', async () => {
    const res = await http()
      .post('/companies')
      .send({ name: `  ${name('Acme')}  `, notes: 'Client grands comptes' })
      .expect(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      name: name('Acme'),
      notes: 'Client grands comptes',
      contacts: [],
      opportunities: [],
    });
    await http()
      .post('/companies')
      .send({ name: name('ACME') })
      .expect(409);
    await http().post('/companies').send({ name: '  ' }).expect(400);
  });

  it('liste les contacts et les pistes, comme client ou intermédiaire', async () => {
    const client = name('Banque');
    const esn = name('ESN');
    const contact = (
      await http()
        .post('/contacts')
        .send({ name: name('Paul'), title: 'Commercial', companyName: esn })
        .expect(201)
    ).body as { id: number; company: { id: number } };
    const opportunity = (
      await http()
        .post('/opportunities')
        .send({ campaignId, companyName: client, intermediaryName: esn })
        .expect(201)
    ).body as { id: number; company: { id: number } };

    const esnRow = (await find(contact.company.id))!;
    expect(esnRow.contacts).toEqual([
      { id: contact.id, name: name('Paul'), title: 'Commercial' },
    ]);
    expect(esnRow.opportunities).toEqual([
      expect.objectContaining({ id: opportunity.id, role: 'INTERMEDIARY' }),
    ]);
    const clientRow = (await find(opportunity.company.id))!;
    expect(clientRow.opportunities).toEqual([
      expect.objectContaining({ id: opportunity.id, role: 'CLIENT' }),
    ]);
  });

  it('renomme et modifie les notes, sans prendre le nom d’une autre', async () => {
    const a = (
      await http()
        .post('/companies')
        .send({ name: name('Alpha') })
        .expect(201)
    ).body as Company;
    await http()
      .post('/companies')
      .send({ name: name('Beta') })
      .expect(201);

    const renamed = (
      await http()
        .patch('/companies/' + a.id)
        .send({ name: name('Alpha Conseil'), notes: 'Rappeler en janvier' })
        .expect(200)
    ).body as Company;
    expect(renamed).toMatchObject({
      name: name('Alpha Conseil'),
      notes: 'Rappeler en janvier',
    });
    // Seules les notes changent ; une chaîne vide les efface.
    const cleared = (
      await http()
        .patch('/companies/' + a.id)
        .send({ notes: '' })
        .expect(200)
    ).body as Company;
    expect(cleared).toMatchObject({ name: name('Alpha Conseil'), notes: null });
    // Changer la casse de son propre nom reste permis.
    await http()
      .patch('/companies/' + a.id)
      .send({ name: name('ALPHA CONSEIL') })
      .expect(200);
    await http()
      .patch('/companies/' + a.id)
      .send({ name: name('beta') })
      .expect(409);
  });

  it('supprime une entreprise sans supprimer ses contacts ni ses pistes', async () => {
    const companyName = name('Éphémère');
    const contact = (
      await http()
        .post('/contacts')
        .send({ name: name('Léa'), companyName })
        .expect(201)
    ).body as { id: number; company: { id: number } };
    const opportunity = (
      await http()
        .post('/opportunities')
        .send({ campaignId, companyName })
        .expect(201)
    ).body as { id: number };

    await http()
      .delete('/companies/' + contact.company.id)
      .expect(204);
    expect(await find(contact.company.id)).toBeUndefined();

    const contacts = (
      await http()
        .get('/contacts?q=' + tag)
        .expect(200)
    ).body as { id: number; company: unknown }[];
    expect(contacts.find((c) => c.id === contact.id)?.company).toBeNull();
    const detail = (
      await http()
        .get('/opportunities/' + opportunity.id)
        .expect(200)
    ).body as { company: unknown };
    expect(detail.company).toBeNull();

    await http()
      .delete('/companies/' + contact.company.id)
      .expect(404);
  });
});
