import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { type Http, signIn } from './auth.js';
import { PrismaExceptionFilter } from '../src/common/prisma-exception.filter.js';

type ContactRef = {
  id: number;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  company: { id: number; name: string } | null;
};
type Contact = ContactRef & {
  linkedin: string | null;
  notes: string | null;
  opportunities: { id: number }[];
  interactionCount: number;
  interviewCount: number;
  lastInteractionAt: string | null;
};
type Detail = {
  id: number;
  contacts: ContactRef[];
  interactions: { id: number; contact: ContactRef | null }[];
};

describe('Contacts (e2e)', () => {
  let app: INestApplication<App>;
  let http: Http;
  // Noms uniques : la base de test n'est pas vidée entre deux lancements.
  const tag = String(Date.now());
  const name = (n: string) => `${n} ${tag}`;
  let campaignId: number;

  const createContact = async (body: Record<string, unknown>) =>
    (await http().post('/contacts').send(body).expect(201)).body as Contact;
  const createOpportunity = async (body: Record<string, unknown>) =>
    (
      (
        await http()
          .post('/opportunities')
          .send({ campaignId, ...body })
          .expect(201)
      ).body as Detail
    ).id;
  const detail = async (id: number) =>
    (
      await http()
        .get('/opportunities/' + id)
        .expect(200)
    ).body as Detail;
  const find = async (id: number) =>
    (
      (
        await http()
          .get('/contacts?q=' + tag)
          .expect(200)
      ).body as Contact[]
    ).find((c) => c.id === id)!;

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
          .send({ name: 'Contacts ' + tag })
          .expect(201)
      ).body as { id: number }
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('crée un contact avec sa société (créée si inconnue)', async () => {
    const c = await createContact({
      name: name('Julie Martin'),
      title: 'Chargée de recrutement',
      companyName: 'Cabinet ' + tag,
      email: 'julie@cabinet.test',
      phone: '06 12 34 56 78',
      linkedin: 'https://www.linkedin.com/in/julie',
    });
    expect(c).toMatchObject({
      title: 'Chargée de recrutement',
      company: { name: 'Cabinet ' + tag },
      email: 'julie@cabinet.test',
      opportunities: [],
      interactionCount: 0,
      lastInteractionAt: null,
    });
  });

  it('valide les champs et refuse un doublon dans la même société', async () => {
    await http().post('/contacts').send({ name: '  ' }).expect(400);
    await http()
      .post('/contacts')
      .send({ name: name('X'), email: 'pas-un-mail' })
      .expect(400);
    await http()
      .post('/contacts')
      .send({ name: name('julie martin'), companyName: 'Cabinet ' + tag })
      .expect(409);
    // Homonyme dans une autre société : accepté.
    await createContact({
      name: name('Julie Martin'),
      companyName: 'Autre ' + tag,
    });
  });

  it('recherche par nom, fonction ou société', async () => {
    const res = (
      await http()
        .get('/contacts?q=' + encodeURIComponent('chargée de recrutement'))
        .expect(200)
    ).body as Contact[];
    expect(res.some((c) => c.name === name('Julie Martin'))).toBe(true);
  });

  it('une piste a plusieurs contacts ; un contact sert sur plusieurs pistes', async () => {
    const julie = await createContact({ name: name('Julie') });
    const marc = await createContact({ name: name('Marc'), title: 'Manager' });
    const a = await createOpportunity({
      companyName: 'Client A ' + tag,
      contactIds: [julie.id, marc.id],
    });
    const b = await createOpportunity({
      companyName: 'Client B ' + tag,
      contactIds: [julie.id],
    });
    expect((await detail(a)).contacts.map((c) => c.id)).toEqual([
      julie.id,
      marc.id,
    ]);
    expect((await find(julie.id)).opportunities.map((o) => o.id)).toEqual([
      a,
      b,
    ]);

    // Mise à jour : liste complète, l'ordre des contacts conservés ne change pas.
    const paul = await createContact({ name: name('Paul') });
    await http()
      .patch('/opportunities/' + a)
      .send({ contactIds: [paul.id, julie.id] })
      .expect(200);
    expect((await detail(a)).contacts.map((c) => c.id)).toEqual([
      julie.id,
      paul.id,
    ]);

    await http()
      .patch('/opportunities/' + a)
      .send({ contactIds: [999999] })
      .expect(400);

    // Recherche de pistes par contact.
    const found = (
      await http()
        .get(`/opportunities?campaignId=${campaignId}&q=` + name('Paul'))
        .expect(200)
    ).body as { id: number }[];
    expect(found.map((o) => o.id)).toEqual([a]);
  });

  it("l'interlocuteur d'un échange rejoint les contacts de la piste", async () => {
    const sophie = await createContact({ name: name('Sophie') });
    const o = await createOpportunity({ companyName: 'Client C ' + tag });
    await http()
      .post(`/opportunities/${o}/interactions`)
      .send({ date: '2026-11-10', summary: 'Appel', contactId: sophie.id })
      .expect(201);
    const d = await detail(o);
    expect(d.contacts.map((c) => c.id)).toEqual([sophie.id]);
    expect(d.interactions[0].contact?.name).toBe(name('Sophie'));
    expect(await find(sophie.id)).toMatchObject({
      interactionCount: 1,
      lastInteractionAt: '2026-11-10',
    });

    // Changement puis retrait de l'interlocuteur.
    const leo = await createContact({ name: name('Léo') });
    await http()
      .patch('/interactions/' + d.interactions[0].id)
      .send({ contactId: leo.id })
      .expect(204);
    expect((await detail(o)).contacts.map((c) => c.id)).toEqual([
      sophie.id,
      leo.id,
    ]);
    await http()
      .patch('/interactions/' + d.interactions[0].id)
      .send({ contactId: null })
      .expect(204);
    expect((await detail(o)).interactions[0].contact).toBeNull();

    await http()
      .post(`/opportunities/${o}/interactions`)
      .send({ date: '2026-11-11', summary: 'X', contactId: 999999 })
      .expect(400);
  });

  it('modifie un contact ; la suppression le retire des pistes mais garde les échanges', async () => {
    const c = await createContact({ name: name('Temp'), phone: '01' });
    const updated = (
      await http()
        .patch('/contacts/' + c.id)
        .send({ phone: null, title: 'RH', companyName: 'Soc ' + tag })
        .expect(200)
    ).body as Contact;
    expect(updated).toMatchObject({
      phone: null,
      title: 'RH',
      company: { name: 'Soc ' + tag },
    });
    await http()
      .patch('/contacts/' + c.id)
      .send({ name: null })
      .expect(400);

    const o = await createOpportunity({
      companyName: 'Client D ' + tag,
      contactIds: [c.id],
    });
    await http()
      .post(`/opportunities/${o}/interactions`)
      .send({ date: '2026-11-12', summary: 'Mail', contactId: c.id })
      .expect(201);
    await http()
      .delete('/contacts/' + c.id)
      .expect(204);
    const d = await detail(o);
    expect(d.contacts).toEqual([]);
    expect(d.interactions).toHaveLength(1);
    expect(d.interactions[0].contact).toBeNull();
    await http()
      .delete('/contacts/' + c.id)
      .expect(404);
  });

  it("les interlocuteurs d'un entretien rejoignent les contacts de la piste", async () => {
    const rh = await createContact({ name: name('RH'), title: 'RH' });
    const lead = await createContact({ name: name('Lead'), title: 'Lead dev' });
    const o = await createOpportunity({ companyName: 'Client E ' + tag });
    type Round = { id: number; contacts: ContactRef[] };
    const rounds = async () =>
      (
        await http()
          .get('/opportunities/' + o)
          .expect(200)
      ).body as {
        interviews: Round[];
        contacts: ContactRef[];
      };

    await http()
      .post(`/opportunities/${o}/interviews`)
      .send({ type: 'Entretien technique', contactIds: [lead.id, rh.id] })
      .expect(201);
    let d = await rounds();
    const ids = (list: ContactRef[]) =>
      list.map((c) => c.id).sort((a, b) => a - b);
    const both = [lead.id, rh.id].sort((a, b) => a - b);
    // Enregistrés ensemble : ordre du carnet.
    expect(ids(d.interviews[0].contacts)).toEqual(both);
    expect(ids(d.contacts)).toEqual(both);

    // Liste complète en mise à jour ; un contact retiré du tour reste sur la piste.
    await http()
      .patch('/interviews/' + d.interviews[0].id)
      .send({ contactIds: [rh.id] })
      .expect(204);
    d = await rounds();
    expect(d.interviews[0].contacts.map((c) => c.id)).toEqual([rh.id]);
    expect(d.contacts).toHaveLength(2);
    expect((await find(rh.id)).interviewCount).toBe(1);

    await http()
      .patch('/interviews/' + d.interviews[0].id)
      .send({ contactIds: [999999] })
      .expect(400);
    // Sans contactIds, les interlocuteurs ne changent pas.
    await http()
      .patch('/interviews/' + d.interviews[0].id)
      .send({ status: 'DONE' })
      .expect(204);
    expect((await rounds()).interviews[0].contacts).toHaveLength(1);
  });
});
